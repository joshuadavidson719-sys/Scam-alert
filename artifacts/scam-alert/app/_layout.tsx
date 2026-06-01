import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Text, View } from "react-native";
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

const APP_ICON = require("@/assets/images/icon.png");

export default function RootLayout() {
  const [nativeFontsLoaded, nativeFontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Feather icon font — native only (web loads it automatically via CSS)
    ...(Platform.OS !== "web" ? Feather.font : {}),
  });
  // On web, the browser handles fonts natively — don't block rendering
  const fontsLoaded = Platform.OS === "web" ? true : nativeFontsLoaded;
  const fontError = Platform.OS === "web" ? null : nativeFontError;
  const [fontTimedOut, setFontTimedOut] = useState(false);

  // Loading progress — counts 0→95 automatically, jumps to 100 when ready
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const notificationListener = useRef<{ remove: () => void } | null>(null);

  // Start progress counter on mount
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          if (tickRef.current) clearInterval(tickRef.current);
          return 95;
        }
        return prev + 1;
      });
    }, 28); // 95 ticks × 28ms ≈ 2.7s
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // Animate bar width whenever progress changes
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 80,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

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
      // Jump to 100 then hide
      if (tickRef.current) clearInterval(tickRef.current);
      setProgress(100);
      setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 120);
    }
  }, [fontsLoaded, fontError, fontTimedOut]);

  if (!fontsLoaded && !fontError && !fontTimedOut) {
    const barWidth = progressAnim.interpolate({
      inputRange: [0, 100],
      outputRange: ["0%", "100%"],
    });

    return (
      <View style={{
        flex: 1, alignItems: "center", justifyContent: "center",
        backgroundColor: "#080808",
      }}>
        {/* Logo */}
        <Image
          source={APP_ICON}
          style={{ width: 88, height: 88, borderRadius: 22, marginBottom: 20 }}
          resizeMode="cover"
        />

        {/* App name */}
        <Text style={{
          color: "#FF3B3B", fontSize: 30, fontWeight: "800",
          letterSpacing: 0.5, marginBottom: 4,
        }}>
          Scam Alert
        </Text>
        <Text style={{
          color: "#666", fontSize: 13, marginBottom: 52,
          letterSpacing: 0.3,
        }}>
          Protecting your community
        </Text>

        {/* Progress bar track */}
        <View style={{
          width: 220, height: 3, backgroundColor: "#1c1c1c",
          borderRadius: 2, overflow: "hidden", marginBottom: 14,
        }}>
          <Animated.View style={{
            width: barWidth, height: 3,
            backgroundColor: "#FF3B3B", borderRadius: 2,
          }} />
        </View>

        {/* Percentage number */}
        <Text style={{
          color: "#FF3B3B", fontSize: 15, fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}>
          {progress}%
        </Text>
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
