import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import {
  cookieValue,
  hasRequiredScopes,
  sameOrigin,
  seal,
  unseal,
} from "./googleAuth.js";
import connect from "../api/google/connect.js";
import session from "../api/google/session.js";

const previousEnvironment = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_SESSION_SECRET: process.env.GOOGLE_SESSION_SECRET,
  MARTIN_GOOGLE_EMAIL: process.env.MARTIN_GOOGLE_EMAIL,
};
const originalFetch = globalThis.fetch;

before(() => {
  process.env.GOOGLE_CLIENT_ID = "client-id";
  process.env.GOOGLE_CLIENT_SECRET = "client-secret";
  process.env.GOOGLE_SESSION_SECRET = randomBytes(32).toString("base64url");
  process.env.MARTIN_GOOGLE_EMAIL = "martin@example.com";
});

after(() => {
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = originalFetch;
});

function response() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("encrypted cookie rejects tampering", () => {
  const encrypted = seal("refresh-token");
  assert.equal(unseal(encrypted), "refresh-token");
  assert.equal(unseal(`${encrypted}x`), "");
  assert.equal(
    cookieValue({
      headers: { cookie: `x=1; martin_google_session=${encrypted}` },
    }),
    encrypted,
  );
});

test("scope and origin checks require both permissions and same site", () => {
  assert.equal(
    hasRequiredScopes(
      "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send",
    ),
    true,
  );
  assert.equal(
    hasRequiredScopes("https://www.googleapis.com/auth/drive.file"),
    false,
  );
  assert.equal(
    sameOrigin({
      headers: {
        origin: "https://martinsshoot.vercel.app",
        host: "martinsshoot.vercel.app",
      },
    }),
    true,
  );
  assert.equal(
    sameOrigin({
      headers: {
        origin: "https://evil.example",
        host: "martinsshoot.vercel.app",
      },
    }),
    false,
  );
});

test("only Martin receives a persistent session", async () => {
  globalThis.fetch = async (url) => {
    if (url.includes("oauth2.googleapis.com"))
      return {
        ok: true,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
          scope:
            "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send",
        }),
      };
    return {
      ok: true,
      json: async () => ({ user: { emailAddress: "martin@example.com" } }),
    };
  };
  const result = response();
  await connect(
    {
      method: "POST",
      headers: {
        origin: "https://martinsshoot.vercel.app",
        host: "martinsshoot.vercel.app",
        "x-requested-with": "XMLHttpRequest",
      },
      body: { code: "authorization-code" },
    },
    result,
  );
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.email, "martin@example.com");
  assert.match(
    result.headers["Set-Cookie"],
    /HttpOnly; Secure; SameSite=Strict/,
  );
  assert.doesNotMatch(result.headers["Set-Cookie"], /refresh-token/);
  const restored = response();
  await session(
    {
      method: "GET",
      headers: { cookie: result.headers["Set-Cookie"].split(";")[0] },
    },
    restored,
  );
  assert.equal(restored.body.connected, true);
});

test("a different Google account does not receive a cookie", async () => {
  globalThis.fetch = async (url) => {
    if (url.includes("oauth2.googleapis.com"))
      return {
        ok: true,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "refresh-token",
          scope:
            "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/gmail.send",
        }),
      };
    return {
      ok: true,
      json: async () => ({ user: { emailAddress: "other@example.com" } }),
    };
  };
  const result = response();
  await connect(
    {
      method: "POST",
      headers: {
        origin: "https://martinsshoot.vercel.app",
        host: "martinsshoot.vercel.app",
        "x-requested-with": "XMLHttpRequest",
      },
      body: { code: "authorization-code" },
    },
    result,
  );
  assert.equal(result.statusCode, 400);
  assert.equal(result.headers["Set-Cookie"], undefined);
});
