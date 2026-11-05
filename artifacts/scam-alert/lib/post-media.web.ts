import { upload } from "@vercel/blob/client";
import { auth } from "./firebase";
import { getApiOrigin } from "./api-base";

const types: Record<string, string> = {
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
  "video/ogg": "ogv", "video/x-m4v": "m4v", "video/3gpp": "3gp",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
const fileTypes: Record<string, string> = Object.fromEntries(
  Object.entries(types).map(([mime, extension]) => [extension, mime]),
);

export function postMediaType(file: File): { contentType: string; extension: string } {
  const declaredType = file.type.toLowerCase().split(";")[0].trim();
  // Some browsers/OS file pickers label real MP4s as generic binary files.
  const contentType = ["", "application/octet-stream", "binary/octet-stream"].includes(declaredType)
    ? fileTypes[file.name.split(".").pop()?.toLowerCase() ?? ""]
    : declaredType;
  const extension = types[contentType];
  if (!extension) throw new Error("Choose an MP4, WebM, MOV video, or a JPG, PNG, WebP, or GIF photo.");
  if (!file.size) throw new Error("This file is empty. Please choose another.");
  if (file.size > 100 * 1024 * 1024) throw new Error("Choose a video or photo smaller than 100 MB.");
  return { contentType, extension };
}

export async function uploadWebPostMedia(
  file: File,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in before uploading your video or photo.");
  const { contentType, extension } = postMediaType(file);
  const origin = getApiOrigin();
  const pathname = `post-media/${user.uid}/${crypto.randomUUID()}.${extension}`;
  const token = await user.getIdToken();
  await upload(pathname, file, {
    access: "private",
    contentType,
    handleUploadUrl: `${origin}/api/post-media/uploads`,
    headers: { Authorization: `Bearer ${token}` },
    multipart: true,
    abortSignal: signal,
    onUploadProgress: ({ percentage }) => onProgress(percentage / 100),
  });
  if (auth.currentUser?.uid !== user.uid) {
    throw new Error("Your account changed during upload. Sign in and try again.");
  }
  return `${origin}/api/${pathname}`;
}
