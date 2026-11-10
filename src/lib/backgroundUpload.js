import { deliveryEmail } from "./email.js";
import { sendGmailMessage } from "./gmail.js";
import {
  createShootFolder,
  getDriveAccount,
  shareShootFolder,
  uploadShootPhoto,
} from "./googleDrive.js";
import {
  getDriveAccessToken,
  getGmailAccessToken,
  hasGmailAccess,
  hasPersistentSession,
  martinGoogleEmail,
  refreshGoogleSessionIfNeeded,
} from "./googleDriveAuth.js";
import { photoKey, previouslyUploadedIndexes } from "./photoSelection.js";

const tasks = new Map();
const retryDelays = [5_000, 15_000, 45_000, 120_000, 300_000];

function completedBytes(task) {
  return task.files.reduce(
    (total, file, index) => total + (task.uploaded.has(index) ? file.size : 0),
    0,
  );
}

function canRetryAutomatically(error) {
  return (
    !navigator.onLine ||
    error instanceof TypeError ||
    [408, 429, 500, 502, 503, 504].includes(error.status)
  );
}

function scheduleRetry(task, error) {
  const delay = retryDelays[Math.min(task.retryCount, retryDelays.length - 1)];
  task.retryCount += 1;
  save(task, {
    uploadStatus: "retrying",
    uploadError: error.message || "Connection interrupted.",
    retryAt: Date.now() + delay,
  });
  task.retryTimer = setTimeout(() => {
    task.retryTimer = null;
    void run(task);
  }, delay);
}

function save(task, patch) {
  if (!task.onPatchShoot(task.shoot.id, patch))
    throw new Error("The upload status could not be saved on this phone.");
  task.shoot = { ...task.shoot, ...patch };
  task.onChange?.(patch);
}

async function sendLink(task) {
  if (!task.shoot.email || task.shoot.emailStatus === "sent") return;
  if (!hasGmailAccess() && !hasPersistentSession()) {
    save(task, { emailStatus: "not_connected" });
    return;
  }
  try {
    save(task, { emailStatus: "sending" });
    await refreshGoogleSessionIfNeeded();
    const token = getGmailAccessToken();
    const account = await getDriveAccount(token);
    if (account.toLowerCase() !== martinGoogleEmail)
      throw new Error("Connect Martin’s Google account to send email.");
    const message = deliveryEmail(task.settings, task.shoot, task.shoot.link);
    const emailId = await sendGmailMessage(
      token,
      task.shoot.email,
      message.subject,
      message.text,
      martinGoogleEmail,
      message.html,
    );
    save(task, { emailStatus: "sent", emailId, emailError: "" });
  } catch (error) {
    save(task, { emailStatus: "failed", emailError: error.message });
  }
}

async function run(task) {
  if (task.running) return;
  task.running = true;
  try {
    await refreshGoogleSessionIfNeeded();
    let token = getDriveAccessToken();
    const totalBytes = task.files.reduce((total, file) => total + file.size, 0);
    save(task, {
      uploadTotalBytes: totalBytes,
      uploadedBytes: completedBytes(task),
      retryAt: 0,
      uploadError: "",
    });
    let folderId = task.shoot.driveFolderId;
    if (!folderId) {
      save(task, { uploadStatus: "creating" });
      folderId = await createShootFolder(token, task.shoot.folder);
      save(task, { driveFolderId: folderId, uploadStatus: "sharing" });
    }
    if (!task.shoot.link) {
      const link = await shareShootFolder(token, folderId);
      save(task, { link, uploadStatus: "uploading", uploadError: "" });
    } else if (task.shoot.uploadStatus !== "uploading") {
      save(task, { uploadStatus: "uploading", uploadError: "" });
    }
    // The client receives the real shared folder link before large photos
    // begin transferring. Gmail errors do not hold back the Drive upload.
    await sendLink(task);
    for (let index = 0; index < task.files.length; index++) {
      if (task.uploaded.has(index)) continue;
      await refreshGoogleSessionIfNeeded();
      token = getDriveAccessToken();
      const session = task.sessions.get(index) || { url: "" };
      task.sessions.set(index, session);
      await uploadShootPhoto(
        token,
        folderId,
        task.files[index],
        session,
        (bytes) => {
          const uploadedBytes = completedBytes(task) + bytes;
          if (uploadedBytes !== task.shoot.uploadedBytes)
            save(task, { uploadedBytes, uploadCurrentFile: index + 1 });
        },
      );
      task.uploaded.add(index);
      task.retryCount = 0;
      save(task, {
        uploadedPhotos: task.uploaded.size,
        uploadedBytes: completedBytes(task),
        uploadedFileKeys: [
          ...(task.shoot.uploadedFileKeys || []),
          photoKey(task.files[index]),
        ],
      });
    }
    save(task, {
      uploadStatus: "ready",
      uploadedBytes: totalBytes,
      uploadError: "",
      retryAt: 0,
    });
    tasks.delete(task.shoot.id);
    task.files = [];
    task.sessions.clear();
  } catch (error) {
    try {
      if (canRetryAutomatically(error)) scheduleRetry(task, error);
      else
        save(task, {
          uploadStatus: "failed",
          uploadError: error.message || "Google Drive upload failed.",
          retryAt: 0,
        });
    } catch {
      // App already reports local storage errors.
    }
  } finally {
    task.running = false;
  }
}

export function startShootUpload({
  shoot,
  files,
  settings,
  onPatchShoot,
  onChange,
}) {
  if (tasks.has(shoot.id)) return false;
  const task = {
    shoot,
    files: [...files],
    settings,
    onPatchShoot,
    onChange,
    uploaded: previouslyUploadedIndexes(shoot, files),
    sessions: new Map(),
    running: false,
    retryCount: 0,
    retryTimer: null,
  };
  tasks.set(shoot.id, task);
  void run(task);
  return true;
}

export function canRetryShootUpload(id) {
  const task = tasks.get(id);
  return Boolean(task && !task.running);
}

export function isShootUploadRunning(id) {
  return Boolean(tasks.get(id)?.running);
}

export function hasShootUploadTask(id) {
  return tasks.has(id);
}

export function retryShootUpload(id) {
  const task = tasks.get(id);
  if (!task || task.running) return false;
  if (task.retryTimer) clearTimeout(task.retryTimer);
  task.retryTimer = null;
  void run(task);
  return true;
}

export function hasActiveUploads() {
  return [...tasks.values()].some((task) => task.running || task.retryTimer);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    for (const task of tasks.values()) {
      if (task.retryTimer) retryShootUpload(task.shoot.id);
    }
  });
}
