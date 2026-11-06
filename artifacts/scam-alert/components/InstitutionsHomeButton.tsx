import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

export function InstitutionsHomeButton() {
  const colors = useColors();
  return (
    <Pressable
      testID="institutions-home-button"
      accessibilityRole="button"
      accessibilityLabel="Open Banks and Credit Unions plan information"
      onPress={() => router.push("/institutions" as never)}
      style={({ pressed }) => [
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Feather name="briefcase" size={16} color={colors.primary} />
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        Banks & Credit Unions
      </Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
        {Platform.OS === "web" ? "Plans" : "Services"}
      </Text>
      <View style={{ flex: 1 }} />
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, minHeight: 44,
  },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 13.5, flexShrink: 1 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12 },
});
