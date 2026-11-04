import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

export function ScamVideoHomeButton() {
  const colors = useColors();
  return (
    <Pressable
      testID="scam-videos-home-button"
      accessibilityRole="button"
      accessibilityLabel="Open Scam Video Lessons library"
      accessibilityHint="Learn how common scams work with short lessons and safety tips"
      onPress={() => router.push("/scam-videos" as never)}
      style={({ pressed }) => [
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primary + "1F" }]}>
        <Feather name="play-circle" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>Scam Video Lessons</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
          Spot the warning signs before you pay
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 12, marginTop: 10, padding: 12,
    borderRadius: 14, borderWidth: 1, minHeight: 56,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12.5, marginTop: 2 },
});
