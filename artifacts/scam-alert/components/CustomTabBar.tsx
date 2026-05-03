import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";

const TAB_CONFIG: Record<
  string,
  { label: string; icon: keyof typeof Feather.glyphMap; activeIcon: keyof typeof Feather.glyphMap }
> = {
  index:         { label: "Home",     icon: "home",           activeIcon: "home" },
  explore:       { label: "Explore",  icon: "compass",        activeIcon: "compass" },
  create:        { label: "Post",     icon: "plus-circle",    activeIcon: "plus-circle" },
  notifications: { label: "Alerts",  icon: "bell",           activeIcon: "bell" },
  messages:      { label: "Messages", icon: "message-circle", activeIcon: "message-circle" },
  profile:       { label: "Profile", icon: "user",           activeIcon: "user" },
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

      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const cfg = TAB_CONFIG[route.name];
          if (!cfg) return null;

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
              activeOpacity={0.7}
            >
              {/* Plain icon — no circle/bucket background */}
              <View style={styles.iconWrap}>
                <Feather
                  name={isFocused ? cfg.activeIcon : cfg.icon}
                  size={22}
                  color={isFocused ? colors.primary : (colors.mutedForeground ?? colors.textSecondary)}
                />
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
                  { color: isFocused ? colors.primary : (colors.mutedForeground ?? colors.textSecondary) },
                  isFocused && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 28,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#fff",
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FF3B3B",
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
});
