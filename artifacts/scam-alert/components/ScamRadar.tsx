import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface ScamRadarProps {
  alertLevel?: "low" | "medium" | "high" | "critical";
  count?: number;
}

const LEVEL_CONFIG = {
  low:      { color: "#10B981", label: "Low Activity",    emoji: "🟢", rings: 1 },
  medium:   { color: "#F59E0B", label: "Moderate Activity", emoji: "🟡", rings: 2 },
  high:     { color: "#F97316", label: "High Activity",   emoji: "🟠", rings: 3 },
  critical: { color: "#FF3B3B", label: "Critical Alert",  emoji: "🔴", rings: 3 },
};

function Ring({
  delay,
  color,
  size,
}: {
  delay: number;
  color: string;
  size: number;
}) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
  }, []);

  // Stagger by resetting offset
  useEffect(() => {
    anim.value = delay / 2400;
  }, [delay]);

  const style = useAnimatedStyle(() => {
    const progress = (anim.value + delay / 2400) % 1;
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [0.8, 0.3, 0]),
      transform: [{ scale: interpolate(progress, [0, 1], [0.3, 1.6]) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          borderWidth: 1.5,
          position: "absolute",
        },
        style,
      ]}
    />
  );
}

export function ScamRadar({ alertLevel = "medium", count = 0 }: ScamRadarProps) {
  const colors = useColors();
  const cfg = LEVEL_CONFIG[alertLevel];
  const rotate = useSharedValue(0);

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const SIZE = 80;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: cfg.color + "40" }]}>
      {/* Radar visual */}
      <View style={styles.radarWrap}>
        <View style={[styles.radarBase, { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderColor: cfg.color + "30", backgroundColor: cfg.color + "08" }]}>
          {[0, 800, 1600].slice(0, cfg.rings).map((d, i) => (
            <Ring key={i} delay={d} color={cfg.color} size={SIZE} />
          ))}
          {/* Sweep line */}
          <Animated.View
            style={[
              styles.sweep,
              { width: SIZE / 2 - 4, backgroundColor: cfg.color + "60" },
              sweepStyle,
            ]}
          />
          {/* Center dot */}
          <View style={[styles.centerDot, { backgroundColor: cfg.color }]} />
          {/* Cross hairs */}
          <View style={[styles.crossH, { backgroundColor: cfg.color + "30" }]} />
          <View style={[styles.crossV, { backgroundColor: cfg.color + "30" }]} />
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.radarTitle, { color: colors.text }]}>Scam Radar</Text>
        <View style={[styles.levelPill, { backgroundColor: cfg.color + "20" }]}>
          <Text style={styles.levelEmoji}>{cfg.emoji}</Text>
          <Text style={[styles.levelLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={[styles.subText, { color: colors.textMuted }]}>
          {count} report{count !== 1 ? "s" : ""} detected today
        </Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Scanning for new scam patterns...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  radarWrap: { alignItems: "center", justifyContent: "center" },
  radarBase: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  ring: {},
  sweep: {
    position: "absolute",
    height: 2,
    left: "50%",
    transformOrigin: "0% 50%",
    top: "50%",
    marginTop: -1,
  },
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
  },
  crossH: {
    position: "absolute",
    height: 1,
    left: 0,
    right: 0,
  },
  crossV: {
    position: "absolute",
    width: 1,
    top: 0,
    bottom: 0,
  },
  info: { flex: 1, gap: 6 },
  radarTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelEmoji: { fontSize: 12 },
  levelLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  subText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 11, fontStyle: "italic" },
});
