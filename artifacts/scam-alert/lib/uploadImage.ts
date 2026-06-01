import * as ImagePicker from "expo-image-picker";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Platform, Alert } from "react-native";

export type PickSource = "camera" | "gallery";

async function requestIfNeeded(source: PickSource): Promise<boolean> {
  if (Platform.OS === "web") return true;
  if (source === "camera") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Permission",
        "Please allow camera access in your device settings to take photos."
      );
      return false;
    }
  }
  // For gallery: skip manual permission request — let the OS photo picker handle it natively.
  // (Expo Go on Android restricts `requestMediaLibraryPermissionsAsync` but the picker itself still works)
  return true;
}

/**
 * Pick an image and upload it to Firebase Storage as an avatar (1:1).
 */
export async function pickAndUploadImage(
  uid: string,
  source: PickSource
): Promise<string | null> {
  const ok = await requestIfNeeded(source);
  if (!ok) return null;

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          base64: true,
        });

  if (result.canceled || !result.assets?.[0]?.base64) return null;

  const base64 = result.assets[0].base64!;
  const storageRef = ref(storage, `avatars/${uid}_${Date.now()}.jpg`);
  await uploadString(storageRef, base64, "base64", { contentType: "image/jpeg" });
  return await getDownloadURL(storageRef);
}

/**
 * Pick a banner image (16:9) and upload it to Firebase Storage.
 */
export async function pickAndUploadBanner(
  uid: string,
  source: PickSource
): Promise<string | null> {
  const ok = await requestIfNeeded(source);
  if (!ok) return null;

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.7,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.7,
          base64: true,
        });

  if (result.canceled || !result.assets?.[0]?.base64) return null;

  const base64 = result.assets[0].base64!;
  const storageRef = ref(storage, `banners/${uid}_${Date.now()}.jpg`);
  await uploadString(storageRef, base64, "base64", { contentType: "image/jpeg" });
  return await getDownloadURL(storageRef);
}
