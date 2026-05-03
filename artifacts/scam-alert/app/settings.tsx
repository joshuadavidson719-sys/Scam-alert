import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { CustomThemePicker } from "@/components/CustomThemePicker";
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { mode, setMode, isDark } = useTheme();
  const { user, profile, logout } = useAuth();
  const [notifPosts, setNotifPosts] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);

  const [showThemePicker, setShowThemePicker] = useState(false);

  const themeLabels: Record<string, string> = {
    system: "System Default", dark: "Dark", light: "Neon Green",
    "alert-red": "Alert Red", midnight: "Midnight",
    "safe-green": "Safe Green", ocean: "Ocean", "purple-haze": "Purple Haze",
  };
  const themeLabel = themeLabels[mode] ?? mode;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login" as never);
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all your posts. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!user || !auth.currentUser) return;
            try {
              await deleteDoc(doc(db, "users", user.uid));
              await deleteUser(auth.currentUser);
              router.replace("/login" as never);
            } catch {
              Alert.alert("Error", "Could not delete account. Please sign out and sign in again before trying.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* Account */}
        <Text style={[styles.section, { color: colors.textMuted }]}>Account</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push("/edit-profile" as never)}
          >
            <Feather name="user" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Edit Profile</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                {profile?.username ?? "—"}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <Feather name="mail" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Email</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                {user?.email ?? "—"}
              </Text>
            </View>
          </View>
        </View>

        {/* Appearance */}
        <Text style={[styles.section, { color: colors.textMuted }]}>Appearance</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.row} onPress={() => { Haptics.selectionAsync(); setShowThemePicker(true); }}>
            <Feather name="droplet" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Theme</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>{themeLabel}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <Text style={[styles.section, { color: colors.textMuted }]}>Notifications</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "New Posts", sub: "From people you follow", value: notifPosts, set: setNotifPosts },
            { label: "Comments", sub: "When someone comments on your post", value: notifComments, set: setNotifComments },
            { label: "Likes", sub: "When someone likes your post", value: notifLikes, set: setNotifLikes },
            { label: "Messages", sub: "Direct messages", value: notifMessages, set: setNotifMessages },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <View style={styles.row}>
                <Feather name="bell" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>{item.sub}</Text>
                </View>
                <Switch
                  value={item.value}
                  onValueChange={(v) => { item.set(v); Haptics.selectionAsync(); }}
                  trackColor={{ false: colors.muted, true: colors.primary + "80" }}
                  thumbColor={item.value ? colors.primary : "#fff"}
                />
              </View>
              {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Safety Tools */}
        <Text style={[styles.section, { color: colors.textMuted }]}>Safety Tools</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { label: "AI Scam Checker", sub: "Analyze suspicious messages", icon: "cpu", route: "/scam-checker" },
            { label: "Link Checker", sub: "Check if a URL is safe", icon: "link", route: "/link-checker" },
            { label: "Phone Checker", sub: "Check suspicious numbers", icon: "phone", route: "/phone-checker" },
            { label: "QR Scanner", sub: "Scan QR codes safely", icon: "camera", route: "/qr-scanner" },
            { label: "Dark Web Checker", sub: "See if your email was breached", icon: "eye-off", route: "/dark-web-checker" },
            { label: "ScamBot AI", sub: "24/7 scam advice chatbot", icon: "message-circle", route: "/chatbot" },
            { label: "Scam Map", sub: "Global scam heat map", icon: "map", route: "/scam-map" },
            { label: "Scam Quiz", sub: "Test your scam awareness", icon: "help-circle", route: "/scam-quiz" },
            { label: "Emergency Contacts", sub: "Report to authorities", icon: "alert-triangle", route: "/emergency-contacts" },
            { label: "Leaderboard", sub: "Top community contributors", icon: "award", route: "/leaderboard" },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(item.route as never)}
              >
                <Feather name={item.icon as "link"} size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]}>{item.sub}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* About */}
        <Text style={[styles.section, { color: colors.textMuted }]}>About</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Feather name="info" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Version</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>1.0.0</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.row} onPress={() => router.push("/community-guidelines" as never)}>
            <Feather name="users" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Community Guidelines</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>Our 8 community rules</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.row} onPress={() => router.push("/tos" as never)}>
            <Feather name="shield" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Terms, Privacy & DMCA</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>Legal · Copyright · Data policy</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <Text style={[styles.section, { color: colors.textMuted }]}>Account Actions</Text>
        <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <Feather name="log-out" size={18} color="#F59E0B" />
            <Text style={[styles.rowTitle, { color: "#F59E0B" }]}>Sign Out</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
            <Feather name="trash-2" size={18} color="#EF4444" />
            <Text style={[styles.rowTitle, { color: "#EF4444" }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <CustomThemePicker visible={showThemePicker} onClose={() => setShowThemePicker(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  content: { padding: 16, gap: 6 },
  section: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTitle: { fontFamily: "Inter_500Medium", fontSize: 15 },
  rowSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  divider: { height: 1, marginLeft: 48 },
});
