import * as ImagePicker from "expo-image-picker";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { Platform } from "react-native";

export type PickSource = "camera" | "gallery";

/**
 * Pick an image and upload it to Firebase Storage.
 * Uses base64 from ImagePicker directly — avoids all file-system / XHR issues
 * that affect React Native / Expo Go.
 */
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
          quality: 0.6,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          base64: true,
        });

  if (result.canceled || !result.assets[0]?.base64) return null;

  const base64 = result.assets[0].base64;
  const storageRef = ref(storage, `avatars/${uid}_${Date.now()}.jpg`);
  await uploadString(storageRef, base64, "base64", { contentType: "image/jpeg" });
  return await getDownloadURL(storageRef);
}
