import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";

const APP_ICON = require("@/assets/images/icon.png");

const TAB_CONFIG: Record<
  string,
  { label: string; icon: keyof typeof Feather.glyphMap; activeIcon: keyof typeof Feather.glyphMap }
> = {
  index:         { label: "Home",     icon: "home",          activeIcon: "home" },
  explore:       { label: "Explore",  icon: "compass",       activeIcon: "compass" },
  create:        { label: "Post",     icon: "plus-circle",   activeIcon: "plus-circle" },
  notifications: { label: "Alerts",  icon: "bell",          activeIcon: "bell" },
  messages:      { label: "Messages", icon: "message-circle", activeIcon: "message-circle" },
  profile:       { label: "Profile", icon: "user",          activeIcon: "user" },
};

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const bottomPad = isWeb ? 8 : Math.max(insets.bottom, 8);

  return (
    <View style={[styles.wrapper, { borderTopColor: colors.border }]}>
      {/* Blur background on iOS */}
      {isIOS ? (
        <BlurView
          intensity={90}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface ?? colors.background }]} />
      )}

      {/* App icon strip above the tabs */}
      <View style={styles.iconStrip}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const cfg = TAB_CONFIG[route.name];
          if (!cfg) return null;

          // Get badge count from descriptor options
          const { options } = descriptors[route.key];
          const badge = (options as any).tabBarBadge;

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              activeOpacity={0.75}
            >
              {/* App icon above each button */}
              <View style={[styles.appIconWrap, isFocused && styles.appIconWrapActive]}>
                <Image
                  source={APP_ICON}
                  style={[styles.appIcon, !isFocused && styles.appIconInactive]}
                  resizeMode="cover"
                />
              </View>

              {/* Tab icon */}
              <View style={styles.iconWrap}>
                <Feather
                  name={isFocused ? cfg.activeIcon : cfg.icon}
                  size={22}
                  color={isFocused ? colors.primary : colors.mutedForeground ?? colors.textSecondary}
                />
                {/* Badge */}
                {badge !== undefined && badge !== null && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </View>

              {/* Label */}
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? colors.primary : colors.mutedForeground ?? colors.textSecondary },
                  isFocused && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {cfg.label}
              </Text>

              {/* Active indicator dot */}
              {isFocused && (
                <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Safe area spacer */}
      <View style={{ height: bottomPad }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
  },
  iconStrip: {
    flexDirection: "row",
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  appIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    overflow: "hidden",
    marginBottom: 2,
    opacity: 0.35,
    borderWidth: 1,
    borderColor: "transparent",
  },
  appIconWrapActive: {
    opacity: 1,
    borderColor: "#FF3B3B",
    shadowColor: "#FF3B3B",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  appIcon: {
    width: "100%",
    height: "100%",
  },
  appIconInactive: {},
  iconWrap: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#FF3B3B",
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    letterSpacing: 0.1,
  },
  labelActive: {
    fontFamily: "Inter_600SemiBold",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});
