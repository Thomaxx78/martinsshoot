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
import { isNativeAndroid, ShootNative } from "./native.js";

const tasks = new Map();

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
    let folderId = task.shoot.driveFolderId;
    if (!folderId) {
      folderId = await createShootFolder(token, task.shoot.folder);
      save(task, { driveFolderId: folderId, uploadStatus: "sharing" });
    }
    if (!task.shoot.link) {
      const link = await shareShootFolder(token, folderId);
      save(task, { link, uploadStatus: "uploading", uploadError: "" });
    } else if (task.shoot.uploadStatus !== "uploading") {
      save(task, { uploadStatus: "uploading", uploadError: "" });
    }
    if (isNativeAndroid) {
      await ShootNative.enqueue({
        shootId: task.shoot.id,
        folderId,
        photos: task.files,
      });
      save(task, {
        uploadStatus: "uploading",
        uploadError: "",
        nativeQueued: true,
      });
      await sendLink(task);
      tasks.delete(task.shoot.id);
      task.files = [];
      return;
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
        () => {},
      );
      task.uploaded.add(index);
      save(task, {
        uploadedPhotos: task.uploaded.size,
        uploadedFileKeys: [
          ...(task.shoot.uploadedFileKeys || []),
          photoKey(task.files[index]),
        ],
      });
    }
    save(task, { uploadStatus: "ready", uploadError: "" });
    tasks.delete(task.shoot.id);
    task.files = [];
    task.sessions.clear();
  } catch (error) {
    try {
      save(task, {
        uploadStatus: "failed",
        uploadError: error.message || "Google Drive upload failed.",
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

export function retryShootUpload(id) {
  const task = tasks.get(id);
  if (!task || task.running) return false;
  void run(task);
  return true;
}

export function hasActiveUploads() {
  return [...tasks.values()].some((task) => task.running);
}
