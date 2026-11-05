export const POST_MEDIA_TYPES = [
  "video/mp4", "video/webm", "video/quicktime", "video/ogg",
  "video/x-m4v", "video/3gpp",
  "image/jpeg", "image/png", "image/webp", "image/gif",
];
export const MAX_POST_MEDIA_BYTES = 100 * 1024 * 1024;
export const POST_MEDIA_PATH = /^post-media\/([A-Za-z0-9_-]{1,128})\/([a-f0-9-]{36})\.(mp4|webm|mov|ogv|m4v|3gp|jpg|png|webp|gif)$/i;

export function validatePostMediaPath(pathname: string, uid: string) {
  const match = POST_MEDIA_PATH.exec(pathname);
  if (!match || match[1] !== uid) {
    throw new Error("You may upload media only to your own account.");
  }
}
