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
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
    // Router not ready yet
  }
}

function RootLayoutNav() {
  useEffect(() => {
    if (IS_EXPO_GO || Platform.OS === "web") return;

    let sub: { remove: () => void } | null = null;
    import("expo-notifications").then((Notifications) => {
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as NotificationData;
        navigateFromNotification(data);
      });
    }).catch(() => {});

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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const notificationListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (IS_EXPO_GO || Platform.OS === "web") return;

    import("expo-notifications").then((Notifications) => {
      notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
      return Notifications.getLastNotificationResponseAsync();
    }).then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as NotificationData;
      setTimeout(() => navigateFromNotification(data), 500);
    }).catch(() => {});

    return () => { notificationListener.current?.remove(); };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
