import { Platform } from "react-native";
import { Tabs } from "expo-router";
import React from "react";

import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { CustomTabBar } from "@/components/CustomTabBar";

function IOSNativeTabLayout() {
  const unread = useUnreadMessages();
  const unreadNotif = useUnreadNotifications();

  // Lazy-require iOS-only modules so Android never imports them
  const { isLiquidGlassAvailable } = require("expo-glass-effect") as {
    isLiquidGlassAvailable: () => boolean;
  };
  const { NativeTabs, Icon, Label } = require(
    "expo-router/unstable-native-tabs"
  ) as {
    NativeTabs: React.ComponentType<{ children: React.ReactNode }> & {
      Trigger: React.ComponentType<{
        name: string;
        badgeCount?: number;
        children: React.ReactNode;
      }>;
    };
    Icon: React.ComponentType<{ sf: { default: string; selected: string } }>;
    Label: React.ComponentType<{ children: React.ReactNode }>;
  };

  if (!isLiquidGlassAvailable()) return <ClassicTabLayout />;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <Icon sf={{ default: "safari", selected: "safari.fill" }} />
        <Label>Explore</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create">
        <Icon sf={{ default: "plus.circle", selected: "plus.circle.fill" }} />
        <Label>Post</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="notifications"
        badgeCount={unreadNotif > 0 ? unreadNotif : undefined}
      >
        <Icon sf={{ default: "bell", selected: "bell.fill" }} />
        <Label>Alerts</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger
        name="messages"
        badgeCount={unread > 0 ? unread : undefined}
      >
        <Icon sf={{ default: "bubble.left", selected: "bubble.left.fill" }} />
        <Label>Messages</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const unread = useUnreadMessages();
  const unreadNotif = useUnreadNotifications();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="create" options={{ title: "Post" }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarBadge:
            unreadNotif > 0
              ? unreadNotif > 99
                ? "99+"
                : unreadNotif
              : undefined,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge:
            unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

export default function TabLayout() {
  // iOS-native Liquid Glass tabs — Android always uses classic layout
  if (Platform.OS === "ios") {
    return <IOSNativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
