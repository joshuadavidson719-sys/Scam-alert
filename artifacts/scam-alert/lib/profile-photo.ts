import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { uploadProfilePhoto, deleteProfilePhoto } from "@workspace/api-client-react";
import { configureApi, getApiOrigin } from "./api-base";
import { auth } from "./firebase";

export async function chooseAndUploadProfilePhoto(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in before changing your profile photo.");
  // Android's system photo picker grants access to the selected image itself.
  // A denied broad-library permission must not prevent opening that picker.
  // Web must also launch directly within the click gesture.
  if (Platform.OS === "ios") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(permission.canAskAgain
        ? "Photo access was not allowed. Try again and allow access to a selected photo."
        : "Photo access is disabled. Enable photo access for Scam Alert in your device settings.");
    }
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
  });
  if (picked.canceled) return null;
  const image = picked.assets[0];
  if (!image?.base64) throw new Error("This photo could not be read. Choose a JPG, PNG, or WebP image.");
  if ((image.fileSize ?? 0) > 3 * 1024 * 1024 || image.base64.length > 4194304) {
    throw new Error("This photo is too large. Crop it or choose an image smaller than 3 MB.");
  }
  if (auth.currentUser?.uid !== user.uid) throw new Error("Your account changed. Sign in again before uploading.");
  configureApi();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const result = await uploadProfilePhoto({ imageBase64: image.base64 }, { signal: controller.signal });
    if (auth.currentUser?.uid !== user.uid) throw new Error("Your account changed during the upload. Please try again.");
    // Older released clients already understand HTTPS photo URLs. Development
    // references stay relative so a temporary preview hostname is never saved.
    return __DEV__ ? result.path : `${getApiOrigin()}${result.path}`;
  } catch (failure) {
    if (failure && typeof failure === "object" && "status" in failure && failure.status === 404) {
      throw new Error("Profile photo uploads are unavailable because the app server needs an update. Your current photo is unchanged.");
    }
    if (failure && typeof failure === "object" && "data" in failure) {
      const data = failure.data;
      if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
        throw new Error(data.error);
      }
    }
    if (failure instanceof Error && failure.message.includes("account changed")) throw failure;
    throw new Error("Your photo could not be uploaded. Check your connection and try again; your current photo is unchanged.");
  } finally { clearTimeout(timeout); }
}
export async function discardUploadedProfilePhoto(uri: string) {
  let path = uri;
  if (!uri.startsWith("/")) {
    try {
      const url = new URL(uri);
      if (url.origin !== getApiOrigin()) return;
      path = url.pathname;
    } catch { return; }
  }
  const match = /^\/api\/profile-photos\/([A-Za-z0-9_-]+)\/([a-f0-9-]{36})$/i.exec(path);
  if (!match || match[1] !== auth.currentUser?.uid) return;
  configureApi();
  await deleteProfilePhoto(match[1], match[2]);
}
