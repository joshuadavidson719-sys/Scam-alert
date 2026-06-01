import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Text, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

const APP_ICON = require("@/assets/images/icon.png");

function AppLoadingScreen() {
  const [progress, setProgress] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          if (tickRef.current) clearInterval(tickRef.current);
          return 95;
        }
        return prev + 1;
      });
    }, 60); // 95 ticks × 60ms ≈ 5.7s (covers the full retry window)
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barWidth = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={{
      flex: 1, alignItems: "center", justifyContent: "center",
      backgroundColor: "#080808",
    }}>
      <Image
        source={APP_ICON}
        style={{ width: 88, height: 88, borderRadius: 22, marginBottom: 20 }}
        resizeMode="cover"
      />
      <Text style={{
        color: "#FF3B3B", fontSize: 30, fontFamily: "Inter_700Bold",
        letterSpacing: 0.5, marginBottom: 4,
      }}>
        Scam Alert
      </Text>
      <Text style={{
        color: "#555", fontSize: 13, fontFamily: "Inter_400Regular",
        marginBottom: 52, letterSpacing: 0.3,
      }}>
        Protecting your community
      </Text>

      <View style={{
        width: 220, height: 3, backgroundColor: "#1c1c1c",
        borderRadius: 2, overflow: "hidden", marginBottom: 14,
      }}>
        <Animated.View style={{
          width: barWidth, height: 3,
          backgroundColor: "#FF3B3B", borderRadius: 2,
        }} />
      </View>

      <Text style={{
        color: "#FF3B3B", fontSize: 15, fontFamily: "Inter_600SemiBold",
        fontVariant: ["tabular-nums"],
      }}>
        {progress}%
      </Text>
    </View>
  );
}

export default function Index() {
  const { user, profile, loading } = useAuth();

  if (loading) return <AppLoadingScreen />;

  if (!user) return <Redirect href="/(auth)/login" />;
  if (profile !== null && !profile.niche) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)/" />;
}
