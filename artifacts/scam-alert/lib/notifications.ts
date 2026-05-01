import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// expo-notifications Android push support was removed from Expo Go in SDK 53.
// Detect Expo Go early and never attempt to load expo-notifications at all.
// In a real development build or production build this is false and push works.
const IS_EXPO_GO = Constants.appOwnership === "expo";

if (!IS_EXPO_GO && Platform.OS !== "web") {
  // Safely initialise the notification handler only in builds that support it
  (async () => {
    try {
      const Notifications = await import("expo-notifications");
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      // Not supported in this environment
    }
  })();
}

export type NotificationType = "like" | "comment" | "share" | "follow" | "report";

export interface NotificationPayload {
  type: NotificationType;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
  postId?: string;
  postTitle?: string;
}

export async function registerForPushNotifications(): Promise<string | null> {
  // Skip entirely in Expo Go or on web
  if (IS_EXPO_GO || Platform.OS === "web") return null;

  try {
    const Device = await import("expo-device");
    if (!Device.default.isDevice) return null;

    const Notifications = await import("expo-notifications");
    const Constants2 = await import("expo-constants");

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

    const projectId =
      Constants2.default.expoConfig?.extra?.eas?.projectId ??
      Constants2.default.easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Sends a push notification AND writes a Firestore in-app notification record.
 * Both operations are best-effort — failures are silent.
 */
export async function sendPushNotification(
  toUserId: string,
  title: string,
  body: string,
  data?: Record<string, string> & { type?: string }
) {
  // ── 1. Write in-app Firestore notification ───────────────
  try {
    await addDoc(collection(db, "notifications"), {
      recipientId: toUserId,
      type: data?.type ?? "system",
      actorId: data?.actorId ?? null,
      actorName: data?.actorName ?? null,
      actorAvatar: data?.actorAvatar ?? null,
      postId: data?.postId ?? null,
      postTitle: data?.postTitle ?? null,
      title,
      body,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // in-app notification write failed — continue to push
  }

  // ── 2. Send Expo push notification (skipped in Expo Go) ──
  if (IS_EXPO_GO) return;

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
    // push delivery failed — notification is already in Firestore
  }
}
