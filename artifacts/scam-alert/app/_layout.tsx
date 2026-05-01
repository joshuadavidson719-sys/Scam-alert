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
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

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
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData;
      navigateFromNotification(data);
    });
    return () => sub.remove();
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

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Handle notification received in foreground (native only)
    if (Platform.OS !== "web") {
      notificationListener.current = Notifications.addNotificationReceivedListener(
        () => {
          // Foreground display handled by setNotificationHandler in lib/notifications.ts
        }
      );
    }

    // Handle cold-launch: app opened by tapping a notification (native only)
    if (Platform.OS !== "web") {
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as NotificationData;
        // Delay so the router is mounted before we navigate
        setTimeout(() => navigateFromNotification(data), 500);
      });
    }

    return () => {
      notificationListener.current?.remove();
    };
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
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
