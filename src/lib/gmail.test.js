import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { deliveryEmail } from "./email.js";
import { encodeGmailMessage, sendGmailMessage } from "./gmail.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("builds a localized email with the real Drive link", () => {
  const email = deliveryEmail(
    {},
    { lang: "fr", name: "Alex", shootName: "Tour Eiffel" },
    "https://drive.google.com/drive/folders/folder-123",
  );
  assert.equal(email.subject, "Vos photos – Tour Eiffel");
  assert.match(email.text, /Bonjour Alex/);
  assert.match(
    email.text,
    /https:\/\/drive\.google\.com\/drive\/folders\/folder-123/,
  );
});

test("keeps the link in customized email messages", () => {
  const email = deliveryEmail(
    { emailMessages: { en: "Hello {{name}} from {{shoot}}" } },
    { lang: "en", name: "Alex", shootName: "Eiffel Tower" },
    "https://drive.google.com/drive/folders/folder-123",
  );
  assert.match(email.text, /Hello Alex from Eiffel Tower/);
  assert.match(email.text, /folder-123$/);
});

test("encodes a Unicode subject and body as a valid Gmail raw message", () => {
  const raw = encodeGmailMessage(
    "alex@example.com",
    "Vos photos – Tour Eiffel",
    "Bonjour Alex, voici vos photos : https://drive.google.com/folder",
  );
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(mime, /^To: alex@example\.com\r\n/);
  const subject = mime.match(/Subject: =\?UTF-8\?B\?(.+)\?=/)[1];
  assert.equal(
    Buffer.from(subject, "base64").toString("utf8"),
    "Vos photos – Tour Eiffel",
  );
  const body = mime.split("\r\n\r\n")[1].replaceAll("\r\n", "");
  assert.equal(
    Buffer.from(body, "base64").toString("utf8"),
    "Bonjour Alex, voici vos photos : https://drive.google.com/folder",
  );
});

test("includes Martin as sender and rejects a forged header", () => {
  const raw = encodeGmailMessage(
    "alex@example.com",
    "Your photos",
    "Here is your link",
    "noplanphotography@gmail.com",
  );
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(
    mime,
    /^From: noplanphotography@gmail\.com\r\nTo: alex@example\.com/,
  );
  assert.throws(
    () =>
      encodeGmailMessage(
        "alex@example.com",
        "Your photos",
        "Here is your link",
        "martin@example.com\r\nBcc: stranger@example.com",
      ),
    /invalid/,
  );
});

test("sends via Gmail API and requires a confirmed message ID", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(
      url,
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    );
    assert.equal(options.headers.Authorization, "Bearer gmail-token");
    assert.ok(JSON.parse(options.body).raw);
    return new Response(JSON.stringify({ id: "message-123" }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  assert.equal(
    await sendGmailMessage(
      "gmail-token",
      "alex@example.com",
      "Your photos",
      "Here is your link",
    ),
    "message-123",
  );
});

test("rejects invalid recipient addresses before calling Gmail", () => {
  assert.throws(
    () =>
      encodeGmailMessage(
        "alex@example.com\r\nBcc: other@example.com",
        "Photos",
        "Link",
      ),
    /invalid/,
  );
});
