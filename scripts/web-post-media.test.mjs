import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(file, dependencies = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", "__DEV__", js)(
    module, module.exports, (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
      return dependencies[name];
    }, false,
  );
  return module.exports;
}
const policy = load("../artifacts/api-server/src/lib/postMediaPolicy.ts");
const uid = "media-test-user";
const id = "57a97732-083d-4863-a1db-abd686afbc63";

test("upload paths are limited to caller-owned media with safe extensions", () => {
  policy.validatePostMediaPath(`post-media/${uid}/${id}.mp4`, uid);
  for (const path of [
    `post-media/someone-else/${id}.mp4`, `profile-photos/${uid}/${id}.mp4`,
    `post-media/${uid}/${id}.html`, `post-media/${uid}/../${id}.mp4`,
    `post-media/${uid}/${id}.mp4?token=bad`,
  ]) assert.throws(() => policy.validatePostMediaPath(path, uid));
});

function client({ fail = false } = {}) {
  const calls = [];
  const auth = { currentUser: { uid, getIdToken: async () => "test-token-not-a-real-credential" } };
  const result = load("../artifacts/scam-alert/lib/post-media.web.ts", {
    "@vercel/blob/client": {
      upload: async (path, file, options) => {
        calls.push({ path, file, options });
        if (fail) throw new Error("Upload unavailable");
        options.onUploadProgress({ percentage: 100 });
        return { pathname: path };
      },
    },
    "./firebase": { auth },
    "./api-base": { getApiOrigin: () => "https://example.test" },
  });
  return { ...result, calls, auth };
}

test("uses real file metadata, not a browser blob URL, and supports missing MIME", () => {
  const api = client();
  assert.deepEqual(api.postMediaType({ name: "awareness.MP4", type: "", size: 10 }),
    { contentType: "video/mp4", extension: "mp4" });
  assert.deepEqual(api.postMediaType({ name: "awareness.mp4", type: "application/octet-stream", size: 10 }),
    { contentType: "video/mp4", extension: "mp4" });
  assert.equal(api.postMediaType({ name: "photo", type: "image/jpeg", size: 10 }).extension, "jpg");
});

test("rejects oversized, empty and unsafe files before any upload", () => {
  const api = client();
  for (const file of [
    { name: "bad.html", type: "text/html", size: 10 },
    { name: "empty.mp4", type: "video/mp4", size: 0 },
    { name: "large.mp4", type: "video/mp4", size: policy.MAX_POST_MEDIA_BYTES + 1 },
  ]) assert.throws(() => api.postMediaType(file));
  assert.equal(api.calls.length, 0);
});

test("uploads directly in multipart mode with auth, progress and cancellation", async () => {
  const api = client();
  const controller = new AbortController();
  let progress = 0;
  const file = new File(["tiny test"], "awareness.mp4", { type: "video/mp4" });
  const url = await api.uploadWebPostMedia(file, (value) => { progress = value; }, controller.signal);
  assert.match(url, /^https:\/\/example.test\/api\/post-media\/media-test-user\/[a-f0-9-]+\.mp4$/);
  const call = api.calls[0];
  assert.equal(call.file, file);
  assert.equal(call.options.access, "private");
  assert.equal(call.options.multipart, true);
  assert.equal(call.options.abortSignal, controller.signal);
  assert.equal(call.options.headers.Authorization, "Bearer test-token-not-a-real-credential");
  assert.equal(progress, 1);
});

test("failed uploads reject rather than returning a URL for an unposted video", async () => {
  const api = client({ fail: true });
  await assert.rejects(api.uploadWebPostMedia(
    new File(["video"], "test.mp4", { type: "video/mp4" }), () => {}, new AbortController().signal,
  ), /Upload unavailable/);
});

test("rejects unsigned and switched accounts", async () => {
  const api = client();
  api.auth.currentUser = null;
  await assert.rejects(api.uploadWebPostMedia(
    new File(["video"], "test.mp4", { type: "video/mp4" }), () => {}, new AbortController().signal,
  ), /Sign in/);
});
