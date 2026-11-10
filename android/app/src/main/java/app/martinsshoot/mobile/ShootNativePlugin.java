package app.martinsshoot.mobile;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.common.api.Scope;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "ShootNative",
    requestCodes = {9910},
    permissions = {@Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})}
)
public class ShootNativePlugin extends Plugin {
    static final String MARTIN_EMAIL = "noplanphotography@gmail.com";
    static final Scope DRIVE = new Scope("https://www.googleapis.com/auth/drive.file");
    static final Scope GMAIL = new Scope("https://www.googleapis.com/auth/gmail.send");
    private PluginCall pendingAuthorization;

    static AuthorizationRequest authorizationRequest() {
        return AuthorizationRequest.builder()
            .setRequestedScopes(Arrays.asList(DRIVE, GMAIL))
            .build();
    }

    @PluginMethod
    public void session(PluginCall call) {
        authorize(call, false);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        authorize(call, true);
    }

    private void authorize(PluginCall call, boolean interactive) {
        Identity.getAuthorizationClient(getContext()).authorize(authorizationRequest())
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    if (!interactive) {
                        JSObject response = new JSObject();
                        response.put("configured", true);
                        response.put("connected", false);
                        call.resolve(response);
                        return;
                    }
                    try {
                        pendingAuthorization = call;
                        getBridge().saveCall(call);
                        getActivity().startIntentSenderForResult(
                            result.getPendingIntent().getIntentSender(), 9910, null, 0, 0, 0
                        );
                    } catch (Exception error) {
                        pendingAuthorization = null;
                        call.reject("Could not open Google authorization: " + error.getMessage());
                    }
                } else {
                    resolveAuthorization(call, result);
                }
            })
            .addOnFailureListener(error -> call.reject("Google authorization failed: " + error.getMessage()));
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != 9910) return;
        PluginCall call = pendingAuthorization != null ? pendingAuthorization : getSavedCall();
        pendingAuthorization = null;
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK || data == null) {
            call.reject("Google authorization was cancelled.");
            return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getContext())
                .getAuthorizationResultFromIntent(data);
            resolveAuthorization(call, result);
        } catch (Exception error) {
            call.reject("Google authorization failed: " + error.getMessage());
        }
    }

    private void resolveAuthorization(PluginCall call, AuthorizationResult result) {
        if (result.getAccessToken() == null ||
            !result.getGrantedScopes().contains(DRIVE.getScopeUri()) ||
            !result.getGrantedScopes().contains(GMAIL.getScopeUri())) {
            call.reject("Drive and Gmail permissions are required.");
            return;
        }
        // Verify the actual account with Drive before returning a token to JavaScript.
        getBridge().execute(() -> {
            try {
                String email = DriveUploadWorker.accountEmail(result.getAccessToken());
                if (!MARTIN_EMAIL.equalsIgnoreCase(email)) {
                    call.reject("Connect Martin’s Google account: " + MARTIN_EMAIL);
                    return;
                }
                JSObject response = new JSObject();
                response.put("configured", true);
                response.put("connected", true);
                response.put("email", email);
                response.put("accessToken", result.getAccessToken());
                response.put("expiresIn", 3300);
                call.resolve(response);
            } catch (Exception error) {
                call.reject("Could not verify Martin’s Google account: " + error.getMessage());
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        Identity.getAuthorizationClient(getContext())
            .revokeAccess(RevokeAccessRequest.builder().setScopes(Arrays.asList(DRIVE, GMAIL)).build())
            .addOnSuccessListener(ignored -> call.resolve())
            .addOnFailureListener(error -> call.reject(error.getMessage()));
    }

    @PluginMethod
    public void requestUploadNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
            call.resolve();
        } else {
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
        }
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        call.resolve(); // Upload still works if the user hides its notification.
    }

    @PluginMethod
    public void pickPhotos(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("image/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "onPhotosPicked");
    }

    @ActivityCallback
    private void onPhotosPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.resolve(new JSObject().put("photos", new JSArray()));
            return;
        }
        try {
            JSONArray selected = new JSONArray();
            if (data.getClipData() != null) {
                for (int index = 0; index < data.getClipData().getItemCount(); index++) {
                    selected.put(photoDetails(data.getClipData().getItemAt(index).getUri()));
                }
            } else if (data.getData() != null) {
                selected.put(photoDetails(data.getData()));
            }
            JSObject response = new JSObject();
            response.put("photos", selected);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Could not read selected photos: " + error.getMessage());
        }
    }

    private JSONObject photoDetails(Uri uri) throws Exception {
        getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        String name = "photo";
        long size = 0;
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameColumn >= 0) name = cursor.getString(nameColumn);
                if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) size = cursor.getLong(sizeColumn);
            }
        }
        if (size <= 0) throw new IllegalArgumentException(name + " has no readable size.");
        JSONObject photo = new JSONObject();
        photo.put("uri", uri.toString());
        photo.put("name", name);
        photo.put("size", size);
        photo.put("type", getContext().getContentResolver().getType(uri));
        photo.put("lastModified", 0);
        return photo;
    }

    @PluginMethod
    public void enqueue(PluginCall call) {
        String shootId = call.getString("shootId", "");
        String folderId = call.getString("folderId", "");
        JSArray photos = call.getArray("photos");
        if (!shootId.matches("[a-fA-F0-9-]{36}") || !folderId.matches("[a-zA-Z0-9_-]+") || photos == null) {
            call.reject("Invalid upload request.");
            return;
        }
        try {
            JSONArray files = new JSONArray(photos.toString());
            if (files.length() == 0) throw new IllegalArgumentException("No photos selected.");
            for (int index = 0; index < files.length(); index++) {
                Uri uri = Uri.parse(files.getJSONObject(index).getString("uri"));
                if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException("Photo URI is invalid.");
                try (java.io.InputStream stream = getContext().getContentResolver().openInputStream(uri)) {
                    if (stream == null) throw new IllegalArgumentException("Photo is unavailable.");
                }
            }
            JSONObject manifest = new JSONObject();
            manifest.put("folderId", folderId);
            manifest.put("photos", files);
            File directory = new File(getContext().getFilesDir(), "uploads");
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Could not save upload queue.");
            File file = new File(directory, shootId + ".json");
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(manifest.toString().getBytes(StandardCharsets.UTF_8));
                output.getFD().sync();
            }
            schedule(shootId, ExistingWorkPolicy.KEEP);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not queue photo upload: " + error.getMessage());
        }
    }

    private void schedule(String shootId, ExistingWorkPolicy policy) {
        Data input = new Data.Builder().putString("shootId", shootId).build();
        OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(DriveUploadWorker.class)
            .setInputData(input)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag("shoot-upload")
            .build();
        WorkManager.getInstance(getContext()).enqueueUniqueWork("shoot-" + shootId, policy, work);
    }

    @PluginMethod
    public void retry(PluginCall call) {
        String shootId = call.getString("shootId", "");
        if (!shootId.matches("[a-fA-F0-9-]{36}") ||
            !new File(new File(getContext().getFilesDir(), "uploads"), shootId + ".json").isFile()) {
            call.reject("No saved upload for this shoot.");
            return;
        }
        schedule(shootId, ExistingWorkPolicy.REPLACE);
        call.resolve();
    }

    @PluginMethod
    public void statuses(PluginCall call) {
        JSObject result = new JSObject();
        JSArray ids = call.getArray("shootIds");
        if (ids != null) {
            try {
                JSONArray array = new JSONArray(ids.toString());
                for (int index = 0; index < array.length(); index++) {
                    String id = array.getString(index);
                    if (!id.matches("[a-fA-F0-9-]{36}")) continue;
                    JSObject status = new JSObject();
                    status.put("uploadStatus", DriveUploadWorker.prefs(getContext()).getString(id + ".status", "uploading"));
                    status.put("uploadedPhotos", DriveUploadWorker.prefs(getContext()).getInt(id + ".count", 0));
                    status.put("uploadError", DriveUploadWorker.prefs(getContext()).getString(id + ".error", ""));
                    result.put(id, status);
                }
            } catch (Exception error) {
                call.reject(error.getMessage());
                return;
            }
        }
        call.resolve(new JSObject().put("statuses", result));
    }
}
