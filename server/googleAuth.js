import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const COOKIE = "martin_google_session";
const MAX_AGE = 7 * 24 * 60 * 60;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export function configured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_SESSION_SECRET &&
    process.env.MARTIN_GOOGLE_EMAIL,
  );
}

function key() {
  const secret = process.env.GOOGLE_SESSION_SECRET || "";
  const bytes = Buffer.from(secret, "base64url");
  if (bytes.length !== 32) throw new Error("Invalid session configuration");
  return bytes;
}

export function seal(refreshToken) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(refreshToken, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function unseal(value) {
  const parts = value?.split(".");
  if (parts?.length !== 3) return "";
  try {
    const [iv, tag, encrypted] = parts.map((part) =>
      Buffer.from(part, "base64url"),
    );
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export function cookieValue(request) {
  const cookie = request.headers.cookie || "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
}

export function setSessionCookie(response, refreshToken) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE}=${seal(refreshToken)}; HttpOnly; Secure; SameSite=Strict; Path=/api/google; Max-Age=${MAX_AGE}`,
  );
}

export function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/api/google; Max-Age=0`,
  );
}

export function noStore(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

export function sameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  try {
    return Boolean(
      origin &&
      host &&
      new URL(origin).origin ===
        `${request.headers["x-forwarded-proto"] || "https"}://${host}`,
    );
  } catch {
    return false;
  }
}

async function tokenRequest(params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(result.error || "Google token request failed");
  }
  return result;
}

export function exchangeCode(code, origin) {
  return tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: origin,
    grant_type: "authorization_code",
  });
}

export function refreshAccess(refreshToken) {
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
}

export function hasRequiredScopes(scope) {
  const scopes = new Set((scope || "").split(" "));
  return scopes.has(DRIVE_SCOPE) && scopes.has(GMAIL_SCOPE);
}

export async function verifyMartin(accessToken) {
  const response = await fetch(
    "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error("Could not verify Google account");
  const data = await response.json();
  const email = data.user?.emailAddress?.toLowerCase() || "";
  if (email !== process.env.MARTIN_GOOGLE_EMAIL.toLowerCase()) {
    throw new Error("Connect Martin’s Google account");
  }
  return email;
}

export function publicSession(token, email) {
  return {
    configured: true,
    connected: true,
    accessToken: token.access_token,
    expiresIn: Number(token.expires_in || 3600),
    email,
  };
}
