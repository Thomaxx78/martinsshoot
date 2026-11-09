const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const CHUNK_SIZE = 8 * 1024 * 1024; // Google requires non-final chunks in multiples of 256 KiB.

export class GoogleDriveError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "GoogleDriveError";
    this.status = status;
  }
}

async function errorFromResponse(response, fallback) {
  let detail = "";
  try {
    const data = await response.json();
    detail = data.error?.message || data.error_description || "";
  } catch {
    // Google upload status responses can have no JSON body.
  }
  return new GoogleDriveError(
    detail || `${fallback} (${response.status})`,
    response.status,
  );
}

async function driveRequest(token, path, options = {}) {
  const response = await fetch(`${DRIVE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body
        ? { "Content-Type": "application/json; charset=UTF-8" }
        : {}),
      ...options.headers,
    },
  });
  if (!response.ok)
    throw await errorFromResponse(response, "Google Drive request failed");
  return response.json();
}

export async function createShootFolder(token, name) {
  const folder = await driveRequest(token, "/files?fields=id,name", {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!folder.id)
    throw new GoogleDriveError("Google Drive did not return a folder ID.");
  return folder.id;
}

export async function getDriveAccount(token) {
  const about = await driveRequest(token, "/about?fields=user(emailAddress)");
  if (!about.user?.emailAddress) {
    throw new GoogleDriveError(
      "Could not identify the connected Google Drive account.",
    );
  }
  return about.user.emailAddress;
}

export async function shareShootFolder(token, folderId) {
  const permissions = await driveRequest(
    token,
    `/files/${encodeURIComponent(folderId)}/permissions?fields=permissions(id,type,role)`,
  );
  if (
    !permissions.permissions?.some(
      (permission) =>
        permission.type === "anyone" && permission.role === "reader",
    )
  ) {
    await driveRequest(
      token,
      `/files/${encodeURIComponent(folderId)}/permissions?fields=id`,
      {
        method: "POST",
        body: JSON.stringify({ type: "anyone", role: "reader" }),
      },
    );
  }
  const folder = await driveRequest(
    token,
    `/files/${encodeURIComponent(folderId)}?fields=id,webViewLink`,
  );
  if (folder.id !== folderId) {
    throw new GoogleDriveError("Could not verify the shared Drive folder.");
  }
  return (
    folder.webViewLink || `https://drive.google.com/drive/folders/${folderId}`
  );
}

async function beginUpload(token, folderId, file) {
  const response = await fetch(
    `${DRIVE_UPLOAD}/files?uploadType=resumable&fields=id,name`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        parents: [folderId],
      }),
    },
  );
  if (!response.ok)
    throw await errorFromResponse(response, "Could not start photo upload");
  const sessionUrl = response.headers.get("Location");
  if (!sessionUrl?.startsWith(`${DRIVE_UPLOAD}/files?`)) {
    throw new GoogleDriveError(
      "Google Drive did not return an upload session.",
    );
  }
  return sessionUrl;
}

async function resumeUpload(sessionUrl, file) {
  const response = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "Content-Range": `bytes */${file.size}` },
  });
  if (response.ok) {
    const uploaded = await response.json();
    if (!uploaded.id)
      throw new GoogleDriveError(
        "Google Drive did not confirm the photo upload.",
      );
    return { uploaded, offset: file.size };
  }
  if (response.status === 404) return { expired: true, offset: 0 };
  if (response.status !== 308)
    throw await errorFromResponse(response, "Could not resume photo upload");
  const range = response.headers.get("Range");
  const match = range?.match(/bytes=0-(\d+)/);
  return { offset: match ? Number(match[1]) + 1 : 0 };
}

export async function uploadShootPhoto(
  token,
  folderId,
  file,
  session,
  onProgress,
) {
  if (!file.size) throw new GoogleDriveError(`${file.name} is empty.`);
  let sessionUrl = session.url;
  let offset = 0;
  if (sessionUrl) {
    const state = await resumeUpload(sessionUrl, file);
    if (state.uploaded) return state.uploaded;
    if (state.expired) sessionUrl = "";
    else offset = state.offset;
  }
  if (!sessionUrl) {
    sessionUrl = await beginUpload(token, folderId, file);
    session.url = sessionUrl;
  }
  onProgress(offset);
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const response = await fetch(sessionUrl, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${offset}-${end - 1}/${file.size}` },
      body: file.slice(offset, end),
    });
    if (response.status === 308) {
      const range = response.headers.get("Range")?.match(/bytes=0-(\d+)/);
      // Without a Range header, Drive has not confirmed any bytes yet.
      offset = range ? Number(range[1]) + 1 : 0;
      onProgress(offset);
      continue;
    }
    if (!response.ok)
      throw await errorFromResponse(response, `Could not upload ${file.name}`);
    const uploaded = await response.json();
    if (!uploaded.id)
      throw new GoogleDriveError(`Google Drive did not confirm ${file.name}.`);
    onProgress(file.size);
    return uploaded;
  }
  // A previous request may have completed just before a network interruption.
  const state = await resumeUpload(sessionUrl, file);
  if (state.uploaded) return state.uploaded;
  throw new GoogleDriveError(`Google Drive did not finish ${file.name}.`);
}
