import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { CategoryId } from "@/context/AuthContext";
import { CATEGORIES } from "@/context/AuthContext";

interface Props {
  categoryId: CategoryId | "all";
  label?: string;
  isSelected?: boolean;
  postCount?: number;
  onPress?: () => void;
  size?: "sm" | "md";
}

export function CategoryPill({
  categoryId,
  label,
  isSelected = false,
  postCount,
  onPress,
  size = "md",
}: Props) {
  const colors = useColors();
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  const displayLabel = label ?? cat?.label ?? "All";
  const iconName =
    categoryId === "all"
      ? "grid"
      : (cat?.icon as keyof typeof Feather.glyphMap) ?? "tag";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.pill,
        size === "sm" && styles.pillSm,
        {
          backgroundColor: isSelected ? colors.primary : colors.card,
          borderColor: isSelected ? colors.primary : colors.border,
        },
      ]}
    >
      <Feather
        name={iconName}
        size={size === "sm" ? 12 : 14}
        color={isSelected ? "#fff" : colors.textSecondary}
      />
      <Text
        style={[
          styles.label,
          size === "sm" && styles.labelSm,
          { color: isSelected ? "#fff" : colors.text },
        ]}
      >
        {displayLabel}
      </Text>
      {postCount !== undefined && (
        <View
          style={[
            styles.badge,
            { backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : colors.muted },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: isSelected ? "#fff" : colors.textMuted },
            ]}
          >
            {postCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    gap: 6,
    marginRight: 8,
  },
  pillSm: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  labelSm: {
    fontSize: 11,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
