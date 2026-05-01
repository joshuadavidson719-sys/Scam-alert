import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

interface BannerConfig {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  action?: { label: string; route: string };
}

const SCAM_TIPS = [
  {
    icon: "alert-triangle" as const,
    title: "Never share OTPs",
    subtitle: "Legitimate banks and services will never call or message asking for a one-time password.",
    action: { label: "Check a message", route: "/scam-checker" },
  },
  {
    icon: "shield" as const,
    title: "Verify before you pay",
    subtitle: "Romance scams cost victims millions each year. Always verify identities before sending money.",
    action: { label: "Learn more", route: "/scam-checker" },
  },
  {
    icon: "link" as const,
    title: "Suspicious link?",
    subtitle: "Phishing URLs often mimic real sites. Paste any suspicious link into our AI checker.",
    action: { label: "Check now", route: "/scam-checker" },
  },
  {
    icon: "phone-off" as const,
    title: "Impersonation calls",
    subtitle: "Scammers pretend to be government agencies, telecom companies, and tech support.",
    action: { label: "Report a scam", route: "/(tabs)/create" },
  },
  {
    icon: "gift" as const,
    title: "\"You've won a prize\"",
    subtitle: "Lottery and prize scams ask for upfront fees. Legitimate wins require no payment.",
    action: { label: "Post an alert", route: "/(tabs)/create" },
  },
];

function getGreeting(name: string): { title: string; subtitle: string; icon: keyof typeof Feather.glyphMap } {
  const hour = new Date().getHours();
  const firstName = name.split(" ")[0];
  if (hour < 12) {
    return {
      icon: "sun",
      title: `Good morning, ${firstName} ☀️`,
      subtitle: "Stay sharp — scammers are most active in the morning. Check today's alerts.",
    };
  }
  if (hour < 17) {
    return {
      icon: "coffee",
      title: `Good afternoon, ${firstName}`,
      subtitle: "Catch up on what the community has flagged today.",
    };
  }
  return {
    icon: "moon",
    title: `Good evening, ${firstName}`,
    subtitle: "Review the day's scam reports and keep your community informed.",
  };
}

export function SmartBanner() {
  const colors = useColors();
  const { profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [tipIndex] = useState(() => Math.floor(Math.random() * SCAM_TIPS.length));
  const opacity = useRef(new Animated.Value(1)).current;

  if (!profile || dismissed) return null;

  const greeting = getGreeting(profile.username ?? "there");
  const tip = SCAM_TIPS[tipIndex];

  // Decide which banner to show: greeting for first 15 mins of day, tip otherwise
  const minuteOfDay = new Date().getHours() * 60 + new Date().getMinutes();
  const showGreeting = minuteOfDay < 15 || minuteOfDay > 23 * 60;

  const config: BannerConfig = showGreeting
    ? {
        icon: greeting.icon,
        iconColor: colors.warning,
        title: greeting.title,
        subtitle: greeting.subtitle,
        action: { label: "View feed", route: "/(tabs)/" },
      }
    : {
        icon: tip.icon,
        iconColor: colors.primary,
        title: tip.title,
        subtitle: tip.subtitle,
        action: tip.action,
      };

  const handleDismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  return (
    <Animated.View style={{ opacity }}>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: config.iconColor + "12",
            borderColor: config.iconColor + "35",
          },
        ]}
      >
        {/* Icon */}
        <View style={[styles.iconBox, { backgroundColor: config.iconColor + "22" }]}>
          <Feather name={config.icon} size={18} color={config.iconColor} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
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
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
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
    marginTop: 6,
  },
  actionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  dismissBtn: {
    padding: 2,
    flexShrink: 0,
  },
});
