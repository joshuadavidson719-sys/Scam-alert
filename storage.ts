import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, isFirebaseConfigured } from "./firebase";

export { isFirebaseConfigured };

export async function uploadMedia(
  localUri: string,
  path: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  if (!isFirebaseConfigured) throw new Error("Firebase not configured");

  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob);
    task.on(
      "state_changed",
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(snap.bytesTransferred / snap.totalBytes);
        }
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export function isVideoUri(uri: string): boolean {
  const lower = uri.toLowerCase().split("?")[0];
  return /\.(mp4|mov|webm|ogg|avi|mkv|m4v|3gp)$/.test(lower);
}
