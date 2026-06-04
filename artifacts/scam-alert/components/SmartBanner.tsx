import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";



interface BannerConfig {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  urgency: "greeting" | "tip";
  title: string;
  subtitle: string;
  action?: { label: string; route: string };
}

// ── Colour constants ─────────────────────────────────────
const AMBER = "#F59E0B";   // greeting — warm, welcoming
const RED   = "#FF3B3B";   // scam tip — urgent, alerting
const TEAL  = "#0EA5E9";   // info tip  — informational

// ── Scam tips (red) ──────────────────────────────────────
const SCAM_TIPS: Omit<BannerConfig, "iconColor" | "bgColor" | "borderColor" | "urgency">[] = [
  {
    icon: "alert-triangle",
    title: "Never share OTPs",
    subtitle: "Legitimate banks and services will never call or message asking for a one-time password.",
    action: { label: "Check a message", route: "/scam-checker" },
  },
  {
    icon: "shield",
    title: "Verify before you pay",
    subtitle: "Romance scams cost victims millions each year. Always verify identities before sending money.",
    action: { label: "Check now", route: "/scam-checker" },
  },
  {
    icon: "link",
    title: "Got a suspicious link?",
    subtitle: "Phishing URLs mimic real sites. Paste any suspicious link into the AI Scam Checker instantly.",
    action: { label: "AI Checker →", route: "/scam-checker" },
  },
  {
    icon: "phone-off",
    title: "Impersonation call?",
    subtitle: "Scammers pose as government agencies, banks, and tech support. Hang up and verify.",
    action: { label: "Report it", route: "/(tabs)/create" },
  },
  {
    icon: "gift",
    title: '"You\'ve won a prize"',
    subtitle: "Lottery scams always ask for an upfront fee. No legitimate prize requires payment.",
    action: { label: "Post an alert", route: "/(tabs)/create" },
  },
  {
    icon: "credit-card",
    title: "Card skimming on the rise",
    subtitle: "Always cover the keypad when entering a PIN. Prefer tap-to-pay wherever possible.",
    action: { label: "Read more alerts", route: "/(tabs)/" },
  },
];

// ── Time-based greeting (amber) ───────────────────────────
function buildGreetingConfig(name: string): Omit<BannerConfig, "iconColor" | "bgColor" | "borderColor" | "urgency"> {
  const hour = new Date().getHours();
  const firstName = (name ?? "there").split(" ")[0];

  if (hour >= 5 && hour < 12) {
    return {
      icon: "sun",
      title: `Good morning, ${firstName} ☀️`,
      subtitle: "Stay sharp today — check this morning's scam alerts before you start your day.",
      action: { label: "See today's alerts", route: "/(tabs)/" },
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      icon: "coffee",
      title: `Good afternoon, ${firstName}`,
      subtitle: "Catch up on what the community has flagged since this morning.",
      action: { label: "Browse feed", route: "/(tabs)/" },
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      icon: "sunset",
      title: `Good evening, ${firstName}`,
      subtitle: "Wind down with the day's top community reports and scam awareness posts.",
      action: { label: "View trending", route: "/(tabs)/" },
    };
  }
  return {
    icon: "moon",
    title: `Still up, ${firstName}?`,
    subtitle: "Review today's scam reports and be ready to stay protected tomorrow.",
    action: { label: "Night check", route: "/(tabs)/" },
  };
}

// ── Which banner to show ──────────────────────────────────
// Morning (5am–11:59am) → amber greeting
// Afternoon / evening   → red scam tip
function resolveConfig(name: string, tipIndex: number): BannerConfig {
  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 12;

  if (isMorning) {
    const base = buildGreetingConfig(name);
    return {
      ...base,
      urgency: "greeting",
      iconColor: AMBER,
      bgColor: AMBER + "14",
      borderColor: AMBER + "40",
    };
  }

  const tip = SCAM_TIPS[tipIndex % SCAM_TIPS.length];
  return {
    ...tip,
    urgency: "tip",
    iconColor: RED,
    bgColor: RED + "10",
    borderColor: RED + "38",
  };
}

// ── Component ─────────────────────────────────────────────
export function SmartBanner() {
  const colors = useColors();
  const { profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [tipIndex] = useState(() => Math.floor(Math.random() * SCAM_TIPS.length));
  const opacity = useRef(new Animated.Value(1)).current;

  if (!profile || dismissed) return null;

  const config = resolveConfig(profile.username ?? "there", tipIndex);

  const handleDismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  return (
    <Animated.View style={[styles.wrapper, { opacity }]}>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: config.bgColor,
            borderColor: config.borderColor,
          },
        ]}
      >
        {/* Urgency stripe on the left edge */}
        <View style={[styles.stripe, { backgroundColor: config.iconColor }]} />

        {/* Shield icon */}
        <Feather name="shield" size={22} color={config.iconColor} />

        {/* Text */}
        <View style={styles.content}>
          {/* Urgency label chip */}
          <View style={[styles.urgencyChip, { backgroundColor: config.iconColor }]}>
            <Text style={styles.urgencyLabel}>🚨  BE AWARE OF SCAMMERS EVERY DAY</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {config.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {config.subtitle}
          </Text>

          {config.action && (
            <TouchableOpacity
              onPress={() => router.push(config.action!.route as never)}
              style={styles.actionRow}
              hitSlop={{ top: 6, bottom: 6 }}
            >
              <Text style={[styles.actionText, { color: config.iconColor }]}>
                {config.action.label}
              </Text>
              <Feather name="arrow-right" size={12} color={config.iconColor} />
            </TouchableOpacity>
          )}
        </View>

        {/* Dismiss */}
        <TouchableOpacity
          onPress={handleDismiss}
          style={styles.dismissBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    overflow: "hidden",
  },
  stripe: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    flexShrink: 0,
    marginTop: 2,
    marginLeft: 6,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  urgencyChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginBottom: 1,
  },
  urgencyLabel: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    lineHeight: 18,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  actionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  dismissBtn: {
    paddingTop: 2,
    flexShrink: 0,
  },
});
