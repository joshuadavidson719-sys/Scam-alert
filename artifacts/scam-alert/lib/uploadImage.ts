import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Platform } from "react-native";

export type PickSource = "camera" | "gallery";

/**
 * Converts a local file URI to a Blob using XMLHttpRequest.
 * `fetch(uri).blob()` does not produce a valid Blob in React Native —
 * XHR is the correct approach for local file URIs on iOS/Android.
 */
function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error("Failed to read file for upload."));
    xhr.responseType = "blob";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
}

export async function pickAndUploadImage(
  uid: string,
  source: PickSource
): Promise<string | null> {
  if (Platform.OS !== "web") {
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return null;
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return null;
    }
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

  if (result.canceled || !result.assets[0]) return null;

  const uri = result.assets[0].uri;
  const blob = await uriToBlob(uri);

  const storageRef = ref(storage, `avatars/${uid}_${Date.now()}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
  const downloadUrl = await getDownloadURL(storageRef);

  // Release the blob from memory
  if (typeof (blob as any).close === "function") (blob as any).close();

  return downloadUrl;
}
