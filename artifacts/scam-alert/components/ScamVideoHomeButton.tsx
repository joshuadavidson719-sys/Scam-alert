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
      accessibilityLabel="Open Free Scam Lessons"
      accessibilityHint="50 free lessons on how to spot a scammer"
      onPress={() => router.push("/scam-videos" as never)}
      style={({ pressed }) => [
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primary + "1F" }]}>
        <Feather name="book-open" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.text }]}>Free Scam Lessons</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
          50 short lessons to help you spot a scammer
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
