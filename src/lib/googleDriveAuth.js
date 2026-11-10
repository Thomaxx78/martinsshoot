const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

let scriptPromise;
let accessToken = "";
let expiresAt = 0;
let gmailToken = "";
let gmailExpiresAt = 0;
let persistentSession = false;
let sessionPromise;

export const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
export const martinGoogleEmail =
  import.meta.env.VITE_MARTIN_GOOGLE_EMAIL?.trim().toLowerCase() || "";

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

export function clearDriveAccess() {
  accessToken = "";
  expiresAt = 0;
}

export function hasGmailAccess() {
  return Boolean(gmailToken && Date.now() < gmailExpiresAt - 60_000);
}

export function getGmailAccessToken() {
  if (!hasGmailAccess()) {
    throw new Error("Gmail access expired. Ask Martin to reconnect Gmail.");
  }
  return gmailToken;
}

export function clearGmailAccess() {
  gmailToken = "";
  gmailExpiresAt = 0;
}

export function hasPersistentSession() {
  return persistentSession;
}

function applySession(session) {
  if (!session.connected) return false;
  const expiresAtValue = Date.now() + Number(session.expiresIn || 3600) * 1000;
  accessToken = session.accessToken;
  gmailToken = session.accessToken;
  expiresAt = expiresAtValue;
  gmailExpiresAt = expiresAtValue;
  persistentSession = true;
  return true;
}

async function sessionRequest(path, options) {
  const response = await fetch(`/api/google/${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Google connection failed.");
  return result;
}

export function restoreGoogleSession() {
  if (!sessionPromise) {
    sessionPromise = sessionRequest("session")
      .then((session) => {
        if (!session.connected && persistentSession) {
          persistentSession = false;
          clearDriveAccess();
          clearGmailAccess();
        }
        return { ...session, connected: applySession(session) };
      })
      .finally(() => {
        sessionPromise = undefined;
      });
  }
  return sessionPromise;
}

export function refreshGoogleSessionIfNeeded() {
  if (!persistentSession || (hasDriveAccess() && hasGmailAccess()))
    return Promise.resolve();
  return restoreGoogleSession().then((session) => {
    if (!session.connected) {
      persistentSession = false;
      clearDriveAccess();
      clearGmailAccess();
      throw new Error("Google session expired. Ask Martin to reconnect.");
    }
  });
}

export async function disconnectPersistentGoogle() {
  await sessionRequest("disconnect", {
    method: "POST",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  persistentSession = false;
  clearDriveAccess();
  clearGmailAccess();
}

export function connectPersistentGoogle() {
  if (!googleClientId || !window.google?.accounts?.oauth2)
    return Promise.reject(new Error("Google sign-in is still loading."));
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(
      () => fail(new Error("Google sign-in timed out. Try again.")),
      120_000,
    );
    function finish(session) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(session);
    }
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    }
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: googleClientId,
      scope: `${DRIVE_SCOPE} ${GMAIL_SCOPE}`,
      ux_mode: "popup",
      select_account: true,
      callback: async (response) => {
        if (response.error || !response.code)
          return fail(
            new Error(
              response.error_description || "Google authorization failed.",
            ),
          );
        try {
          const session = await sessionRequest("connect", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify({ code: response.code }),
          });
          applySession(session);
          finish(session);
        } catch (error) {
          fail(error);
        }
      },
      error_callback: (error) =>
        fail(new Error(error.message || "Google sign-in was closed.")),
    });
    try {
      client.requestCode();
    } catch (error) {
      fail(error);
    }
  });
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
// requires each token request to be opened by a direct user gesture.
function requestGoogleAccess(scope) {
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
      resolve(token);
    }
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope,
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
            ...scope.split(" "),
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

export async function connectGoogleDrive() {
  const token = await requestGoogleAccess(DRIVE_SCOPE);
  accessToken = token.access_token;
  expiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
}

export async function connectGmail() {
  const token = await requestGoogleAccess(`${DRIVE_SCOPE} ${GMAIL_SCOPE}`);
  gmailToken = token.access_token;
  gmailExpiresAt = Date.now() + Number(token.expires_in || 3600) * 1000;
}
