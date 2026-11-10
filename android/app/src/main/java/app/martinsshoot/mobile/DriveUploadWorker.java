package app.martinsshoot.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.ForegroundInfo;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.tasks.Tasks;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class DriveUploadWorker extends Worker {
    private static final int CHUNK = 8 * 1024 * 1024;
    private static final String CHANNEL = "shoot_uploads";
    private final Context context;
    private final String shootId;

    public DriveUploadWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
        super(context, parameters);
        this.context = context;
        this.shootId = parameters.getInputData().getString("shootId");
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("shoot_upload_progress", Context.MODE_PRIVATE);
    }

    private void status(String state, int count, String error) {
        prefs(context).edit()
            .putString(shootId + ".status", state)
            .putInt(shootId + ".count", count)
            .putString(shootId + ".error", error)
            .apply();
    }

    private ForegroundInfo foreground(int count, int total) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Shoot Martin photo uploads", NotificationManager.IMPORTANCE_LOW));
        }
        Notification notification = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("Shoot Martin · Google Drive")
            .setContentText("Uploading photo " + Math.min(count + 1, total) + " of " + total)
            .setProgress(total, count, false)
            .setOngoing(true)
            .build();
        int id = 10_000 + Math.abs(shootId.hashCode() % 20_000);
        if (Build.VERSION.SDK_INT >= 29)
            return new ForegroundInfo(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        return new ForegroundInfo(id, notification);
    }

    @NonNull
    @Override
    public Result doWork() {
        if (shootId == null || !shootId.matches("[a-fA-F0-9-]{36}")) return Result.failure();
        int count = prefs(context).getInt(shootId + ".count", 0);
        try {
            File manifestFile = new File(new File(context.getFilesDir(), "uploads"), shootId + ".json");
            byte[] bytes = new byte[(int) manifestFile.length()];
            try (FileInputStream stream = new FileInputStream(manifestFile)) {
                int read = 0;
                while (read < bytes.length) {
                    int next = stream.read(bytes, read, bytes.length - read);
                    if (next < 0) throw new IOException("Upload manifest is incomplete.");
                    read += next;
                }
            }
            JSONObject manifest = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
            String folderId = manifest.getString("folderId");
            JSONArray files = manifest.getJSONArray("photos");
            setForegroundAsync(foreground(count, files.length())).get();
            status("uploading", count, "");
            for (int index = 0; index < files.length(); index++) {
                if (isStopped()) return Result.retry();
                if (prefs(context).getBoolean(shootId + ".done." + index, false)) continue;
                String token = accessToken();
                if (!ShootNativePlugin.MARTIN_EMAIL.equalsIgnoreCase(accountEmail(token)))
                    throw new SecurityException("Reconnect Martin’s Google account to resume upload.");
                uploadPhoto(token, folderId, files.getJSONObject(index), index);
                prefs(context).edit().putBoolean(shootId + ".done." + index, true).apply();
                count++;
                status("uploading", count, "");
                setForegroundAsync(foreground(count, files.length())).get();
            }
            status("ready", count, "");
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification done = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setContentTitle("Shoot Martin · upload complete")
                .setContentText(count + " photos are in Google Drive")
                .setAutoCancel(true)
                .build();
            manager.notify(20_000 + Math.abs(shootId.hashCode() % 20_000), done);
            return Result.success();
        } catch (SecurityException error) {
            status("failed", count, error.getMessage());
            return Result.failure();
        } catch (Exception error) {
            if (getRunAttemptCount() >= 19) {
                status("failed", count, error.getMessage());
                return Result.failure();
            }
            status("uploading", count, "Network interruption; Android will retry automatically.");
            return Result.retry();
        }
    }

    private String accessToken() throws Exception {
        AuthorizationResult result = Tasks.await(
            Identity.getAuthorizationClient(context).authorize(ShootNativePlugin.authorizationRequest()),
            45, TimeUnit.SECONDS
        );
        if (result.hasResolution() || result.getAccessToken() == null)
            throw new SecurityException("Open Shoot Martin and reconnect Google.");
        return result.getAccessToken();
    }

    static String accountEmail(String token) throws Exception {
        HttpURLConnection connection = request("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", "GET", token);
        try {
            requireSuccess(connection, "Could not check Google account");
            return readJson(connection).getJSONObject("user").getString("emailAddress");
        } finally {
            connection.disconnect();
        }
    }

    private void uploadPhoto(String token, String folderId, JSONObject photo, int index) throws Exception {
        String name = photo.getString("name");
        String mime = photo.optString("type", "image/jpeg");
        if (mime.isEmpty() || "null".equals(mime)) mime = "image/jpeg";
        long size = photo.getLong("size");
        Uri uri = Uri.parse(photo.getString("uri"));
        String key = shootId + ".session." + index;
        String session = prefs(context).getString(key, "");
        if (!session.isEmpty()) {
            int state = uploadOffset(session, size);
            if (state == -1) {
                prefs(context).edit().remove(key).apply();
                session = "";
            } else if (state == -2) {
                return; // Google confirmed this file before the worker stopped.
            }
        }
        if (session.isEmpty()) {
            HttpURLConnection connection = request(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name", "POST", token
            );
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            connection.setRequestProperty("X-Upload-Content-Type", mime);
            connection.setRequestProperty("X-Upload-Content-Length", String.valueOf(size));
            JSONObject metadata = new JSONObject();
            metadata.put("name", name);
            metadata.put("mimeType", mime);
            metadata.put("parents", new JSONArray().put(folderId));
            try (OutputStream stream = connection.getOutputStream()) {
                stream.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
            }
            try {
                requireSuccess(connection, "Could not start photo upload");
                session = connection.getHeaderField("Location");
                if (session == null || !session.startsWith("https://www.googleapis.com/upload/drive/v3/files?"))
                    throw new IOException("Google did not return a valid upload session.");
                prefs(context).edit().putString(key, session).apply();
            } finally {
                connection.disconnect();
            }
        }
        int offset = uploadOffset(session, size);
        if (offset == -2) return;
        if (offset < 0) throw new IOException("Upload session expired; retry required.");
        while (offset < size) {
            if (isStopped()) throw new IOException("Upload was paused.");
            int length = (int) Math.min(CHUNK, size - offset);
            byte[] chunk = new byte[length];
            try (InputStream stream = context.getContentResolver().openInputStream(uri)) {
                if (stream == null) throw new IOException("Photo is no longer available: " + name);
                long skipped = 0;
                while (skipped < offset) {
                    long step = stream.skip(offset - skipped);
                    if (step <= 0) {
                        if (stream.read() == -1) throw new IOException("Photo ended before upload offset.");
                        step = 1;
                    }
                    skipped += step;
                }
                int read = 0;
                while (read < length) {
                    int next = stream.read(chunk, read, length - read);
                    if (next < 0) throw new IOException("Photo ended before upload chunk.");
                    read += next;
                }
            }
            HttpURLConnection connection = request(session, "PUT", null);
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(length);
            connection.setRequestProperty("Content-Range", "bytes " + offset + "-" + (offset + length - 1) + "/" + size);
            try (OutputStream stream = connection.getOutputStream()) {
                stream.write(chunk);
            }
            try {
                int status = connection.getResponseCode();
                if (status == 308) {
                    offset = confirmedOffset(connection.getHeaderField("Range"));
                } else if (status >= 200 && status < 300) {
                    if (readJson(connection).optString("id").isEmpty())
                        throw new IOException("Google did not confirm " + name);
                    prefs(context).edit().remove(key).apply();
                    return;
                } else {
                    throw new IOException("Google Drive upload returned HTTP " + status);
                }
            } finally {
                connection.disconnect();
            }
        }
        if (uploadOffset(session, size) != -2) throw new IOException("Google did not finish " + name);
    }

    private int uploadOffset(String session, long size) throws Exception {
        HttpURLConnection connection = request(session, "PUT", null);
        connection.setRequestProperty("Content-Range", "bytes */" + size);
        connection.setDoOutput(true);
        connection.setFixedLengthStreamingMode(0);
        try {
            int status = connection.getResponseCode();
            if (status == 404) return -1;
            if (status >= 200 && status < 300) {
                if (readJson(connection).optString("id").isEmpty()) throw new IOException("Unconfirmed Drive upload.");
                return -2;
            }
            if (status == 308) return confirmedOffset(connection.getHeaderField("Range"));
            throw new IOException("Could not resume Drive upload (HTTP " + status + ").");
        } finally {
            connection.disconnect();
        }
    }

    private static int confirmedOffset(String range) {
        if (range == null || !range.startsWith("bytes=0-")) return 0;
        try { return Integer.parseInt(range.substring(8)) + 1; }
        catch (NumberFormatException ignored) { return 0; }
    }

    private static HttpURLConnection request(String url, String method, String token) throws Exception {
        URL target = new URL(url);
        if (!"https".equals(target.getProtocol()) || !"www.googleapis.com".equals(target.getHost()))
            throw new SecurityException("Unexpected Google upload address.");
        HttpURLConnection connection = (HttpURLConnection) target.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(30_000);
        connection.setReadTimeout(90_000);
        connection.setInstanceFollowRedirects(false);
        if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
        return connection;
    }

    private static void requireSuccess(HttpURLConnection connection, String message) throws IOException {
        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) throw new IOException(message + " (HTTP " + status + ").");
    }

    private static JSONObject readJson(HttpURLConnection connection) throws Exception {
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
        }
    }
}
