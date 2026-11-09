import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  createShootFolder,
  getDriveAccount,
  shareShootFolder,
  uploadShootPhoto,
} from "./googleDrive.js";
import { nextShootReference, shootFolderName } from "./shoots.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

test("creates Shoots at Drive root and the named shoot inside it", async () => {
  const name = "Eiffel Tower – Alex – 2026-11-09 – REF-000123";
  const created = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer access-token");
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      created.push(body);
      return json({
        id: body.name === "Shoots" ? "shoots-root" : "folder-123",
      });
    }
    const query = new URL(url).searchParams.get("q");
    assert.match(query, /trashed = false/);
    return json({ files: [] });
  };
  assert.equal(await createShootFolder("access-token", name), "folder-123");
  assert.deepEqual(created, [
    {
      name: "Shoots",
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root"],
    },
    {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: ["shoots-root"],
    },
  ]);
});

test("reuses the existing Shoots folder and shoot folder on retry", async () => {
  let creates = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") creates++;
    const query = new URL(url).searchParams.get("q");
    if (query.includes("name = 'Shoots'"))
      return json({ files: [{ id: "shoots-root", name: "Shoots" }] });
    assert.match(query, /'shoots-root' in parents/);
    return json({ files: [{ id: "folder-123", name: "Eiffel Tower" }] });
  };
  assert.equal(
    await createShootFolder("access-token", "Eiffel Tower"),
    "folder-123",
  );
  assert.equal(creates, 0);
});

test("creates only the shoot folder when Shoots already exists", async () => {
  const created = [];
  globalThis.fetch = async (url, options) => {
    if (options.method === "POST") {
      created.push(JSON.parse(options.body));
      return json({ id: "folder-123" });
    }
    const query = new URL(url).searchParams.get("q");
    if (query.includes("name = 'Shoots'"))
      return json({ files: [{ id: "shoots-root", name: "Shoots" }] });
    return json({ files: [] });
  };
  assert.equal(
    await createShootFolder("access-token", "Eiffel Tower"),
    "folder-123",
  );
  assert.deepEqual(
    created.map((folder) => folder.parents),
    [["shoots-root"]],
  );
});

test("checks which Google account owns the new folders", async () => {
  globalThis.fetch = async (url) => {
    assert.match(url, /\/drive\/v3\/about\?fields=user\(emailAddress\)$/);
    return json({ user: { emailAddress: "martin@example.com" } });
  };
  assert.equal(await getDriveAccount("access-token"), "martin@example.com");
});

test("uploads the selected photo into the created folder and reports completion", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "POST") {
      assert.deepEqual(JSON.parse(options.body).parents, ["folder-123"]);
      return new Response(null, {
        status: 200,
        headers: {
          Location:
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=abc",
        },
      });
    }
    assert.equal(options.headers["Content-Range"], "bytes 0-4/5");
    return json({ id: "photo-456" });
  };
  const file = new File(["photo"], "portrait.jpg", { type: "image/jpeg" });
  const session = { url: "" };
  const progress = [];
  const result = await uploadShootPhoto(
    "access-token",
    "folder-123",
    file,
    session,
    (bytes) => progress.push(bytes),
  );
  assert.equal(result.id, "photo-456");
  assert.equal(calls.length, 2);
  assert.equal(progress.at(-1), 5);
  assert.match(session.url, /upload_id=abc$/);
});

test("resumes an interrupted upload without starting a second file", async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(options);
    if (calls.length === 1) {
      assert.equal(options.headers["Content-Range"], "bytes */5");
      return new Response(null, {
        status: 308,
        headers: { Range: "bytes=0-1" },
      });
    }
    assert.equal(options.headers["Content-Range"], "bytes 2-4/5");
    return json({ id: "photo-456" });
  };
  const file = new File(["photo"], "portrait.jpg", { type: "image/jpeg" });
  const session = {
    url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=abc",
  };
  const result = await uploadShootPhoto(
    "access-token",
    "folder-123",
    file,
    session,
    () => {},
  );
  assert.equal(result.id, "photo-456");
  assert.equal(calls.length, 2);
});

test("reuses an existing public permission when sharing is retried", async () => {
  let permissionCreates = 0;
  globalThis.fetch = async (url, options) => {
    if (url.includes("/permissions?") && options.method === "POST")
      permissionCreates++;
    if (url.includes("/permissions?"))
      return json({
        permissions: [{ id: "public", type: "anyone", role: "reader" }],
      });
    return json({
      id: "folder-123",
      webViewLink: "https://drive.google.com/drive/folders/folder-123",
    });
  };
  const link = await shareShootFolder("access-token", "folder-123");
  assert.equal(link, "https://drive.google.com/drive/folders/folder-123");
  assert.equal(permissionCreates, 0);
});

test("creates a reader link permission for a new folder", async () => {
  let permissionCreates = 0;
  globalThis.fetch = async (url, options) => {
    if (url.includes("/permissions?") && options.method === "POST") {
      permissionCreates++;
      assert.deepEqual(JSON.parse(options.body), {
        type: "anyone",
        role: "reader",
      });
      return json({ id: "public" });
    }
    if (url.includes("/permissions?")) return json({ permissions: [] });
    return json({
      id: "folder-123",
      webViewLink: "https://drive.google.com/drive/folders/folder-123",
    });
  };
  assert.equal(
    await shareShootFolder("access-token", "folder-123"),
    "https://drive.google.com/drive/folders/folder-123",
  );
  assert.equal(permissionCreates, 1);
});

test("retries an unconfirmed chunk from byte zero", async () => {
  let puts = 0;
  globalThis.fetch = async (_url, options) => {
    if (options.method === "POST") {
      return new Response(null, {
        status: 200,
        headers: {
          Location:
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=abc",
        },
      });
    }
    puts++;
    assert.equal(options.headers["Content-Range"], "bytes 0-4/5");
    if (puts === 1) return new Response(null, { status: 308 });
    return json({ id: "photo-456" });
  };
  const file = new File(["photo"], "portrait.jpg", { type: "image/jpeg" });
  await uploadShootPhoto(
    "access-token",
    "folder-123",
    file,
    { url: "" },
    () => {},
  );
  assert.equal(puts, 2);
});

test("continues the highest shooting reference instead of reusing deleted numbers", () => {
  assert.equal(
    nextShootReference([
      { ref: "REF-000001" },
      { ref: "PAST" },
      { ref: "REF-000123" },
    ]),
    "REF-000124",
  );
});

test("uses the photographer's shoot name and customer details for the folder", () => {
  assert.equal(
    shootFolderName(" Eiffel Tower ", " Alex ", "2026-11-09", "REF-000123"),
    "Eiffel Tower – Alex – 2026-11-09 – REF-000123",
  );
});
