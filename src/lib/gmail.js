const GMAIL_SEND =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function base64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function encodeGmailMessage(to, subject, text, from = "") {
  if (to.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) {
    throw new Error("The customer email address is invalid.");
  }
  if (
    from &&
    (from.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from))
  )
    throw new Error("The sender email address is invalid.");
  const encoder = new TextEncoder();
  const cleanSubject = subject.replace(/[\r\n]/g, " ");
  const encodedSubject = base64(encoder.encode(cleanSubject));
  const encodedBody =
    base64(encoder.encode(text))
      .match(/.{1,76}/g)
      ?.join("\r\n") || "";
  const message = [
    ...(from ? [`From: ${from}`] : []),
    `To: ${to}`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");
  return base64(encoder.encode(message))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export async function sendGmailMessage(token, to, subject, text, from = "") {
  const response = await fetch(GMAIL_SEND, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodeGmailMessage(to, subject, text, from) }),
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json()).error?.message || "";
    } catch {
      // Gmail can return an empty error response.
    }
    const error = new Error(
      detail || `Gmail could not send the email (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  const result = await response.json();
  if (!result.id) throw new Error("Gmail did not confirm the email send.");
  return result.id;
}
