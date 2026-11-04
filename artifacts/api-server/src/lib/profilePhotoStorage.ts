import { put, get, del } from "@vercel/blob";
import { Readable } from "node:stream";
import { appStorage } from "./generationStorage";

export const MAX_PROFILE_PHOTO_BYTES = 3 * 1024 * 1024;
export const PROFILE_PHOTO_SIZE_ERROR = "Choose an image smaller than 3 MB.";

function pathname(uid: string, photoId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[a-f0-9-]{36}$/i.test(photoId)) {
    throw new Error("Invalid photo path");
  }
  return `profile-photos/${uid}/${photoId}`;
}

function legacyFile(path: string) {
  const dir = process.env.PRIVATE_OBJECT_DIR?.replace(/^\/+/, "");
  if (!dir) throw new Error("Profile photo storage is unavailable");
  const [bucket, ...prefix] = dir.split("/");
  return appStorage.bucket(bucket).file(`${prefix.join("/")}/${path}`);
}

export async function saveProfilePhoto(uid: string, id: string, bytes: Buffer, contentType: string) {
  const path = pathname(uid, id);
  if (process.env.PROFILE_PHOTO_STORAGE === "vercel-blob") {
    await put(path, bytes, {
      access: "private", addRandomSuffix: false, contentType, cacheControlMaxAge: 86400,
    });
    return;
  }
  await legacyFile(path).save(bytes, {
    resumable: false, contentType,
    metadata: { cacheControl: "public, max-age=86400, immutable", metadata: { owner: uid, purpose: "community-profile-photo" } },
  });
}

export async function readProfilePhoto(uid: string, id: string) {
  const path = pathname(uid, id);
  if (process.env.PROFILE_PHOTO_STORAGE === "vercel-blob") {
    const result = await get(path, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return {
      contentType: result.blob.contentType,
      stream: Readable.fromWeb(result.stream as import("node:stream/web").ReadableStream<Uint8Array>),
    };
  }
  const file = legacyFile(path);
  const [metadata] = await file.getMetadata();
  return { contentType: metadata.contentType ?? "", stream: file.createReadStream() };
}

export async function deleteProfilePhotoFile(uid: string, id: string) {
  const path = pathname(uid, id);
  if (process.env.PROFILE_PHOTO_STORAGE === "vercel-blob") {
    await del(path);
    return;
  }
  await legacyFile(path).delete({ ignoreNotFound: true });
}
