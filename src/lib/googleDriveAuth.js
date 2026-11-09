const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

let scriptPromise;
let accessToken = "";
let expiresAt = 0;

export const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";

export function hasDriveAccess() {
  return Boolean(accessToken && Date.now() < expiresAt - 60_000);
}

export function getDriveAccessToken() {
  if (!hasDriveAccess()) {
    throw new Error(
      "Google Drive access expired. Ask Martin to reconnect Drive.",
    );
  }
  return accessToken;
}

export function loadGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve();
      else reject(new Error("Google sign-in did not load."));
    };
    script.onerror = () =>
      reject(new Error("Could not load Google sign-in. Check the connection."));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}

// Call from a click handler after loadGoogleIdentity() has resolved. Google
// requires the account chooser to be opened by a direct user gesture.
export function connectGoogleDrive() {
  if (!googleClientId) {
    return Promise.reject(new Error("Google Drive is not configured yet."));
  }
  if (!window.google?.accounts?.oauth2) {
    return Promise.reject(new Error("Google sign-in is still loading."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(
      () => fail(new Error("Google sign-in timed out. Try again.")),
      120_000,
    );
    function finish(token) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      accessToken = token.access_token;
      expiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
      resolve();
    }
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          fail(
            new Error(
              response.error_description ||
                "Google Drive authorization failed.",
            ),
          );
        } else if (
          !window.google.accounts.oauth2.hasGrantedAllScopes(
            response,
            DRIVE_SCOPE,
          )
        ) {
          fail(new Error("Google Drive access was not granted."));
        } else {
          finish(response);
        }
      },
      error_callback: (error) =>
        fail(new Error(error.message || "Google sign-in was closed.")),
    });
    try {
      client.requestAccessToken({ prompt: "select_account" });
    } catch (error) {
      fail(error);
    }
  });
}
