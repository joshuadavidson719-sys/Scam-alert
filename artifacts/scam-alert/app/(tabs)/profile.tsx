import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard, type PostData } from "@/components/PostCard";
import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";
import { router } from "expo-router";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile, logout, updateUserProfile } = useAuth();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState(profile?.bio ?? "");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "posts"),
      where("authorId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        ...(d.data() as Omit<PostData, "id">),
        id: d.id,
      }));
      setPosts(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

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

  if (!profile) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.header,
                { paddingTop: topPad + 10, borderBottomColor: colors.border },
              ]}
            >
              <View style={styles.headerActions}>
                {profile.isAdmin && (
                  <TouchableOpacity
                    onPress={() => router.push("/admin" as never)}
                    style={[styles.iconBtn, { backgroundColor: colors.card }]}
                  >
                    <Feather name="shield" size={18} color={colors.primary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => router.push("/legal/privacy" as never)}
                  style={[styles.iconBtn, { backgroundColor: colors.card }]}
                >
                  <Feather name="info" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLogout}
                  style={[styles.iconBtn, { backgroundColor: colors.card }]}
                >
                  <Feather name="log-out" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.avatarSection}>
                <UserAvatar
                  uri={profile.profilePhoto}
                  name={profile.username}
                  size={90}
                />
                <Text style={[styles.username, { color: colors.text }]}>
                  {profile.username}
                </Text>
                <Text style={[styles.niche, { color: colors.primary }]}>
                  {profile.niche || "Scam Alert Community"}
                </Text>

                {editingBio ? (
                  <View style={styles.bioEdit}>
                    <TextInput
                      style={[
                        styles.bioInput,
                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
                      ]}
                      value={bioText}
                      onChangeText={setBioText}
                      multiline
                      maxLength={160}
                      placeholder="Tell people about yourself..."
                      placeholderTextColor={colors.textMuted}
                      autoFocus
                    />
                    <View style={styles.bioActions}>
                      <TouchableOpacity
                        onPress={() => setEditingBio(false)}
                        style={[styles.bioBtn, { backgroundColor: colors.muted }]}
                      >
                        <Text style={[styles.bioBtnText, { color: colors.text }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleSaveBio}
                        style={[styles.bioBtn, { backgroundColor: colors.primary }]}
                      >
                        <Text style={styles.bioBtnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => { setBioText(profile.bio); setEditingBio(true); }}>
                    <Text style={[styles.bio, { color: colors.textSecondary }]}>
                      {profile.bio || "Tap to add a bio..."}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.statsRow, { borderColor: colors.border }]}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>
                    {posts.length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Posts</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>
                    {profile.followers?.length ?? 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>
                    {profile.following?.length ?? 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
                </View>
              </View>
            </View>

            <View style={styles.quickLinks}>
              {[
                { label: "Privacy Policy", route: "/legal/privacy", icon: "lock" },
                { label: "Community Guidelines", route: "/legal/guidelines", icon: "book" },
                { label: "AI Scam Checker", route: "/scam-checker", icon: "shield" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.quickLink, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={() => router.push(item.route as never)}
                >
                  <Feather name={item.icon as keyof typeof Feather.glyphMap} size={16} color={colors.textSecondary} />
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>{item.label}</Text>
                  <Feather name="chevron-right" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.postsHeader, { color: colors.text }]}>Posts</Text>
            {loading && <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />}
            {!loading && posts.length === 0 && (
              <View style={styles.emptyPosts}>
                <Feather name="file-text" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No posts yet
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 12 }}>
            <PostCard
              post={item}
              onComment={() => setCommentPostId(item.id)}
              onReport={() => setReportPostId(item.id)}
            />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      />

      {commentPostId && (
        <CommentSheet
          visible={!!commentPostId}
          postId={commentPostId}
          onClose={() => setCommentPostId(null)}
        />
      )}
      {reportPostId && (
        <ReportModal
          visible={!!reportPostId}
          postId={reportPostId}
          onClose={() => setReportPostId(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  username: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginTop: 10,
  },
  niche: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 19,
  },
  bioEdit: {
    width: "100%",
    gap: 8,
    marginTop: 8,
  },
  bioInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
  },
  bioActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  bioBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bioBtnText: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  quickLinks: {
    padding: 16,
    gap: 8,
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickLinkText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flex: 1,
  },
  postsHeader: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  emptyPosts: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});
