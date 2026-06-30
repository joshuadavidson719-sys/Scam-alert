import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, isFirebaseConfigured as _isFBConfigured } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard, type PostData } from "@/components/PostCard";
import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";
import { router } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const THEME_COLORS = [
  { name: "Red",         value: "#FF3B3B" },
  { name: "Neon Green",  value: "#39FF14" },
  { name: "Purple",      value: "#8B5CF6" },
  { name: "Blue",        value: "#3B82F6" },
  { name: "Orange",      value: "#F97316" },
  { name: "Pink",        value: "#EC4899" },
  { name: "Teal",        value: "#06B6D4" },
  { name: "Gold",        value: "#EAB308" },
  { name: "Neon Blue",   value: "#00BFFF" },
  { name: "Lime",        value: "#BFFF00" },
];

const GAMES = [
  { label: "Galaxy Strike", route: "/galaxy-strike", icon: "zap" },
  { label: "Games Hub",     route: "/games-hub",     icon: "grid" },
];

type TabId = "posts" | "media" | "reels";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "posts", label: "Posts",        icon: "grid" },
  { id: "media", label: "Photos & Videos", icon: "image" },
  { id: "reels", label: "Reels",        icon: "film" },
];

function isDark(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile, logout, updateUserProfile } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentPost, setCommentPost] = useState<PostData | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [themeColor, setThemeColor] = useState("#FF3B3B");
  const [activeTab, setActiveTab] = useState<TabId>("posts");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const headerTextColor = isDark(themeColor) ? "#FFFFFF" : "#000000";

  useEffect(() => {
    if (profile?.bio) setBioText(profile.bio);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "posts"),
      where("authorId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          ...(d.data() as Omit<PostData, "id">),
          id: d.id,
        }));
        setPosts(data);
        setLoading(false);
      },
      () => { setLoading(false); }
    );
    return unsub;
  }, [user]);

  const filteredPosts = posts.filter((p) => {
    if (activeTab === "posts") return true;
    if (activeTab === "media") return (p.images?.length > 0) || !!p.videoUrl;
    if (activeTab === "reels") return !!p.videoUrl;
    return true;
  });

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login" as never);
        },
      },
    ]);
  };

  const handleSaveBio = async () => {
    await updateUserProfile({ bio: bioText });
    setEditingBio(false);
  };

  const handlePickProfilePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photo library.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (!user) return;
        setPhotoUploading(true);
        try {
          if (_isFBConfigured) {
            const path = `profile-photos/${user.uid}`;
            const blob = await (await fetch(uri)).blob();
            const downloadUrl = await new Promise<string>((resolve, reject) => {
              const task = uploadBytesResumable(ref(storage, path), blob);
              task.on("state_changed", null, reject, async () =>
                resolve(await getDownloadURL(task.snapshot.ref))
              );
            });
            await updateUserProfile({ profilePhoto: downloadUrl });
            await updateDoc(doc(db, "users", user.uid), { profilePhoto: downloadUrl });
          }
        } catch {
          Alert.alert("Upload Failed", "Could not upload photo. Please try again.");
        } finally {
          setPhotoUploading(false);
        }
      }
    } catch {
      Alert.alert("Error", "Could not open photo library. Please try again.");
    }
  };

  if (!user) return null;
  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </View>
    );
  }

  const Header = (
    <View>
      {/* Coloured header banner */}
      <View style={[styles.banner, { backgroundColor: themeColor, paddingTop: topPad + 10 }]}>
        <View style={styles.headerActions}>
          {profile.isAdmin && (
            <TouchableOpacity onPress={() => router.push("/admin" as never)} style={styles.iconBtn}>
              <Feather name="shield" size={18} color={headerTextColor} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push("/legal/privacy" as never)} style={styles.iconBtn}>
            <Feather name="info" size={18} color={headerTextColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <Feather name="log-out" size={18} color={headerTextColor} />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickProfilePhoto} style={styles.avatarWrapper}>
            <UserAvatar uri={profile.profilePhoto} name={profile.username} size={90} />
            <View style={[styles.cameraOverlay, { backgroundColor: themeColor }]}>
              {photoUploading
                ? <ActivityIndicator size="small" color={headerTextColor} />
                : <Feather name="camera" size={14} color={headerTextColor} />}
            </View>
          </TouchableOpacity>
          <Text style={[styles.username, { color: headerTextColor }]}>{profile.username}</Text>
          <Text style={[styles.niche, { color: headerTextColor, opacity: 0.85 }]}>
            {profile.niche || "Scam Alert Community"}
          </Text>
        </View>
      </View>

      {/* Bio */}
      <View style={[styles.bioSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {editingBio ? (
          <View style={{ gap: 8 }}>
            <TextInput
              style={[styles.bioInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={bioText}
              onChangeText={setBioText}
              multiline
              maxLength={160}
              placeholder="Tell people about yourself..."
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.bioActions}>
              <TouchableOpacity onPress={() => setEditingBio(false)} style={[styles.bioBtn, { backgroundColor: colors.muted }]}>
                <Text style={[styles.bioBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveBio} style={[styles.bioBtn, { backgroundColor: themeColor }]}>
                <Text style={[styles.bioBtnText, { color: headerTextColor }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setBioText(profile.bio ?? ""); setEditingBio(true); }}>
            <Text style={[styles.bio, { color: colors.textSecondary }]}>
              {profile.bio || "Tap to add a bio..."}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: themeColor }]}>{posts.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Posts</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: themeColor }]}>{profile.followers?.length ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: themeColor }]}>{profile.following?.length ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
        </View>
      </View>

      {/* Theme colour picker */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🎨 Page Theme</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
          {THEME_COLORS.map((c) => (
            <TouchableOpacity
              key={c.value}
              onPress={() => setThemeColor(c.value)}
              style={[styles.colorSwatch, { backgroundColor: c.value }, themeColor === c.value && styles.colorSwatchSelected]}
            >
              {themeColor === c.value && <Feather name="check" size={14} color={isDark(c.value) ? "#fff" : "#000"} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.colorName, { color: colors.textMuted }]}>
          {THEME_COLORS.find((c) => c.value === themeColor)?.name ?? "Custom"}
        </Text>
      </View>

      {/* Games */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>🎮 Games</Text>
        {GAMES.map((game) => (
          <TouchableOpacity key={game.route} style={[styles.gameRow, { borderColor: colors.border }]} onPress={() => router.push(game.route as never)}>
            <View style={[styles.gameIcon, { backgroundColor: themeColor + "22" }]}>
              <Feather name={game.icon as keyof typeof Feather.glyphMap} size={18} color={themeColor} />
            </View>
            <Text style={[styles.gameLabel, { color: colors.text }]}>{game.label}</Text>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick links */}
      <View style={styles.quickLinks}>
        {[
          { label: "Privacy Policy",       route: "/legal/privacy",    icon: "lock" },
          { label: "Community Guidelines", route: "/legal/guidelines", icon: "book" },
          { label: "AI Scam Checker",      route: "/scam-checker",     icon: "shield" },
        ].map((item) => (
          <TouchableOpacity key={item.route} style={[styles.quickLink, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => router.push(item.route as never)}>
            <Feather name={item.icon as keyof typeof Feather.glyphMap} size={16} color={themeColor} />
            <Text style={[styles.quickLinkText, { color: colors.text }]}>{item.label}</Text>
            <Feather name="chevron-right" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Content tabs */}
      <View style={[styles.tabBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { borderBottomColor: themeColor, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Feather name={tab.icon as keyof typeof Feather.glyphMap} size={16} color={activeTab === tab.id ? themeColor : colors.textMuted} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? themeColor : colors.textMuted }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <ActivityIndicator color={themeColor} style={{ margin: 20 }} />}
            {!loading && filteredPosts.length === 0 && (
        <View style={styles.emptyPosts}>
          <Feather name={activeTab === "reels" ? "film" : activeTab === "media" ? "image" : "file-text"} size={36} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {activeTab === "reels" ? "No reels yet" : activeTab === "media" ? "No photos or videos yet" : "No posts yet"}
          </Text>
          {activeTab === "reels" && (
            <TouchableOpacity
              style={[styles.uploadReelBtn, { backgroundColor: themeColor }]}
              onPress={() => router.push("/(tabs)/create" as never)}
            >
              <Feather name="upload" size={18} color={isDark(themeColor) ? "#fff" : "#000"} />
              <Text style={[styles.uploadReelText, { color: isDark(themeColor) ? "#fff" : "#000" }]}>Upload a Reel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 12 }}>
            <PostCard post={item} onComment={() => setCommentPost(item)} onReport={() => setReportPostId(item.id)} />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      />

      {commentPost && (
        <CommentSheet visible={!!commentPost} postId={commentPost.id} postAuthorId={commentPost.authorId} postTitle={commentPost.title} onClose={() => setCommentPost(null)} />
      )}
      {reportPostId && (
        <ReportModal visible={!!reportPostId} postId={reportPostId} onClose={() => setReportPostId(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { paddingBottom: 20, paddingHorizontal: 16 },
  headerActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingBottom: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" },
  avatarSection: { alignItems: "center", gap: 6 },
  avatarWrapper: { position: "relative" },
  cameraOverlay: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  username: { fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 10 },
  niche: { fontFamily: "Inter_500Medium", fontSize: 13 },
  bioSection: { marginHorizontal: 16, marginTop: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  bio: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 19 },
  bioInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontFamily: "Inter_400Regular", fontSize: 14, minHeight: 70, textAlignVertical: "top" },
  bioActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  bioBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  bioBtnText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  statsRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 20 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  statDivider: { width: 1, height: 30 },
  section: { margin: 16, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  colorRow: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  colorSwatch: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  colorSwatchSelected: { borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 5, elevation: 5 },
  colorName: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  gameRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: 1 },
  gameIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  gameLabel: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  quickLinks: { padding: 16, gap: 8 },
  quickLink: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  quickLinkText: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, marginTop: 8 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, gap: 4 },
  tabLabel: { fontFamily: "Inter_500Medium", fontSize: 11 },
  emptyPosts: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
});
