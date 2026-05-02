import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  useAnimatedStyle,
} from "react-native-reanimated";
import { type Achievement, getRarityColor } from "@/hooks/useAchievements";

interface Props {
  achievement: Achievement | null;
  onHide: () => void;
}

const RARITY_LABEL: Record<string, string> = {
  common: "Common",
  rare: "Rare ✦",
  epic: "Epic ✦✦",
  legendary: "Legendary ✦✦✦",
};

export function AchievementToast({ achievement, onHide }: Props) {
  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    if (!achievement) return;

    translateY.value = withSequence(
      withTiming(0, { duration: 450, easing: Easing.out(Easing.back(1.6)) }),
      withDelay(2400, withTiming(120, { duration: 350, easing: Easing.in(Easing.quad) }))
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 350 }),
      withDelay(2500, withTiming(0, { duration: 350 }))
    );
    scale.value = withSequence(
      withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.4)) }),
      withDelay(2400, withTiming(0.9, { duration: 300 }))
    );

    const t = setTimeout(onHide, 3300);
    return () => clearTimeout(t);
  }, [achievement?.id]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!achievement) return null;

  const color = getRarityColor(achievement.rarity);

  return (
    <Animated.View style={[styles.toast, { borderColor: color + "80" }, animStyle]}>
      <View style={[styles.glowDot, { backgroundColor: color }]} />
      <View style={[styles.iconWrap, { backgroundColor: color + "20" }]}>
        <Text style={styles.emoji}>{achievement.emoji}</Text>
      </View>
      <View style={styles.textCol}>
        <Text style={styles.unlockLabel}>Achievement Unlocked!</Text>
        <Text style={styles.title}>{achievement.title}</Text>
        <Text style={styles.desc} numberOfLines={1}>{achievement.desc}</Text>
        <View style={[styles.rarityPill, { backgroundColor: color + "20" }]}>
          <Text style={[styles.rarityText, { color }]}>{RARITY_LABEL[achievement.rarity]}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 110,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1A1A1A",
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    zIndex: 9998,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 14,
  },
  glowDot: {
    position: "absolute",
    top: -4,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emoji: { fontSize: 26 },
  textCol: { flex: 1, gap: 2 },
  unlockLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#9CA3AF",
  },
  rarityPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 3,
  },
  rarityText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
});
