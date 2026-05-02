import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Expo Go on Android removed push notification support in SDK 53.
// Detect it upfront so we never attempt to load expo-notifications.
const IS_EXPO_GO = Constants.appOwnership === "expo";

type NotificationData = {
  type?: string;
  postId?: string;
  chatId?: string;
};

function navigateFromNotification(data: NotificationData) {
  if (!data?.type) return;
  try {
    if ((data.type === "like" || data.type === "comment") && data.postId) {
      router.push(`/post/${data.postId}` as never);
    } else if (data.type === "message" && data.chatId) {
      router.push(`/chat/${data.chatId}` as never);
    }
  } catch {
    // Router not ready yet — handled by cold-launch useEffect
  }
}

function RootLayoutNav() {
  useEffect(() => {
    // Skip in Expo Go (Android push removed in SDK 53) and web
    if (IS_EXPO_GO || Platform.OS === "web") return;

    let sub: { remove: () => void } | null = null;
    import("expo-notifications").then((Notifications) => {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as NotificationData;
        navigateFromNotification(data);
      });
    }).catch(() => {/* not supported */});

    return () => { sub?.remove(); };
  }, []);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="post/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="scam-checker"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="admin"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="people-to-follow"
        options={{ headerShown: false, presentation: "card" }}
      />
      <Stack.Screen
        name="legal/privacy"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="legal/guidelines"
        options={{ headerShown: false, presentation: "modal" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [nativeFontsLoaded, nativeFontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  // On web, the browser handles fonts natively — don't block rendering
  const fontsLoaded = Platform.OS === "web" ? true : nativeFontsLoaded;
  const fontError = Platform.OS === "web" ? null : nativeFontError;
  const [fontTimedOut, setFontTimedOut] = useState(false);

  const notificationListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    // Skip in Expo Go (Android push removed in SDK 53) and web
    if (IS_EXPO_GO || Platform.OS === "web") return;

    import("expo-notifications").then((Notifications) => {
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {
        // Foreground display handled by setNotificationHandler in lib/notifications.ts
      });

      return Notifications.getLastNotificationResponseAsync();
    }).then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as NotificationData;
      setTimeout(() => navigateFromNotification(data), 500);
    }).catch(() => {/* not supported */});

    return () => { notificationListener.current?.remove(); };
  }, []);

  // Safety timeout — if fonts never resolve, proceed anyway after 3s
  useEffect(() => {
    const t = setTimeout(() => setFontTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || fontTimedOut) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, fontTimedOut]);

  if (!fontsLoaded && !fontError && !fontTimedOut) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000000" }}>
        <ActivityIndicator color="#FF3B3B" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider>
                <AuthProvider>
                  <RootLayoutNav />
                </AuthProvider>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
