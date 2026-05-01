import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Constants from "expo-constants";
import { Platform } from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Scam Alert",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF3B3B",
      sound: "default",
    });
  }

  try {
    const projectId =
      Constants.default.expoConfig?.extra?.eas?.projectId ??
      Constants.default.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch {
    return null;
  }
}

export async function sendPushNotification(
  toUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    const snap = await getDoc(doc(db, "users", toUserId));
    if (!snap.exists()) return;
    const pushToken = snap.data()?.expoPushToken as string | undefined;
    if (!pushToken || !pushToken.startsWith("ExponentPushToken")) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify({
        to: pushToken,
        title,
        body,
        data: data ?? {},
        sound: "default",
        priority: "high",
        channelId: "default",
        _contentAvailable: true,
      }),
    });
  } catch {
    // Silently fail — notifications are best-effort
  }
}
