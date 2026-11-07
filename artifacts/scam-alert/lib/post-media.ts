// Metro selects post-media.web.ts in browsers. Native uploads continue through
// Firebase in the create screen; never bundle the browser-only Blob SDK there.
export async function uploadWebPostMedia(
  _file: File,
  _onProgress: (progress: number) => void,
  _signal: AbortSignal,
): Promise<string> {
  throw new Error("Browser uploads are unavailable on this platform. Use the native media uploader.");
}
