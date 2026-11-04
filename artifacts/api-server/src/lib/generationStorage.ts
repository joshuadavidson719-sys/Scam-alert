import { Storage } from "@google-cloud/storage";

const endpoint = "http://127.0.0.1:1106";
const storage = new Storage({
  projectId: "",
  credentials: {
    audience: "replit", subject_token_type: "access_token",
    token_url: `${endpoint}/token`, type: "external_account",
    credential_source: { url: `${endpoint}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  },
});
export const appStorage = storage;

function resultFile(userId: string, requestId: string) {
  const dir = process.env.PRIVATE_OBJECT_DIR?.replace(/^\/+/, "");
  if (!dir) throw new Error("Private result storage is not configured");
  const [bucket, ...prefix] = dir.split("/");
  // User and request identifiers are validated before this function is called.
  return storage.bucket(bucket).file(`${prefix.join("/")}/premium/${encodeURIComponent(userId)}/${requestId}.json`);
}
export async function saveGeneration(userId: string, requestId: string, value: unknown) {
  await resultFile(userId, requestId).save(JSON.stringify(value), {
    resumable: false, contentType: "application/json", metadata: { cacheControl: "private, no-store" },
  });
}
export async function readGeneration(userId: string, requestId: string) {
  const file = resultFile(userId, requestId);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  return JSON.parse(buffer.toString("utf8"));
}

export async function deleteGenerationResult(userId: string, requestId: string) {
  await resultFile(userId, requestId).delete({ ignoreNotFound: true });
}
