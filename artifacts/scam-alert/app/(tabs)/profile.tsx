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
  ActionSheetIOS,
  Modal,
  Pressable,
  Switch,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { useBookmarks } from "@/hooks/useBookmarks";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard, type PostData } from "@/components/PostCard";
import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";
import { router } from "expo-router";
import { pickAndUploadImage } from "@/lib/uploadImage";
import { useStreak } from "@/hooks/useStreak";
import { useAchievements, getRarityColor, ALL_ACHIEVEMENTS } from "@/hooks/useAchievements";
import { AchievementToast } from "@/components/AchievementToast";
import { CustomThemePicker } from "@/components/CustomThemePicker";

type TabType = "posts" | "bookmarks" | "reels";

type ReelItem = {
  id: string; userId: string; videoUrl: string;
  caption: string; likes: string[]; views: number; createdAt: number;
};

export default function ProfileScreen() {
  const colors = useColors();
  const { mode, setMode, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, profile, logout, updateUserProfile } = useAuth();
  const { bookmarks } = useBookmarks();
  const streak = useStreak();
  const { unlocked: achievements, newlyUnlocked, clearNewlyUnlocked } = useAchievements(user?.uid);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [commentPost, setCommentPost] = useState<PostData | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState(profile?.bio ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // My posts
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "posts"),
      where("authorId", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({
          ...(d.data() as Omit<PostData, "id">),
          id: d.id,
        }))
        .sort((a, b) => (b.createdAt as number) - (a.createdAt as number));
      setPosts(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // My reels — fetch when tab switches to reels
  useEffect(() => {
    if (activeTab !== "reels" || !user) return;
    setReelsLoading(true);
    getDocs(
      query(collection(db, "reels"), where("userId", "==", user.uid))
    ).then((snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toMillis?.() ?? Date.now() } as ReelItem))
        .sort((a, b) => b.createdAt - a.createdAt);
      setReels(data);
      setReelsLoading(false);
    }).catch(() => setReelsLoading(false));
  }, [activeTab, user]);

  // Bookmarked posts — fetch when tab switches
  useEffect(() => {
    if (activeTab !== "bookmarks" || bookmarks.length === 0) {
      if (bookmarks.length === 0) setSavedPosts([]);
      return;
    }
    setSavedLoading(true);
    Promise.all(
      bookmarks.map((id) =>
        getDoc(doc(db, "posts", id)).then((d) =>
          d.exists() ? ({ ...d.data(), id: d.id } as PostData) : null
        )
      )
    ).then((results) => {
      setSavedPosts(results.filter(Boolean) as PostData[]);
      setSavedLoading(false);
    });
  }, [activeTab, bookmarks]);

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

  const handlePickPhoto = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Gallery"], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await doUpload("camera");
          if (idx === 2) await doUpload("gallery");
        }
      );
    } else {
      setShowPhotoSheet(true);
    }
  };

  const doUpload = async (source: "camera" | "gallery") => {
    if (!user) return;
    setUploadingPhoto(true);
    setShowPhotoSheet(false);
    try {
      const url = await pickAndUploadImage(user.uid, source);
      if (url) await updateUserProfile({ profilePhoto: url });
    } catch {
      Alert.alert("Error", "Failed to upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const cycleDarkMode = () => {
    const next = mode === "system" ? "dark" : mode === "dark" ? "light" : "system";
    setMode(next);
  };

  const themeModeLabel: Record<string, string> = {
    system: "Auto",
    dark: "Dark",
    light: "Light",
  };

  if (!profile) return null;

  const displayedPosts = activeTab === "posts" ? posts : activeTab === "bookmarks" ? savedPosts : [];
  const displayedLoading = activeTab === "posts" ? loading : activeTab === "bookmarks" ? savedLoading : reelsLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={displayedPosts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
              <View style={styles.headerActions}>
                {profile.isAdmin && (
                  <TouchableOpacity
                    onPress={() => router.push("/admin" as never)}
                    style={[styles.iconBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
                  >
                    <Feather name="shield" size={16} color={colors.primary} />
                    <Text style={[styles.iconBtnLabel, { color: colors.primary }]}>Admin</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => router.push("/legal/privacy" as never)}
                  style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Feather name="file-text" size={16} color={colors.textSecondary} />
                  <Text style={[styles.iconBtnLabel, { color: colors.textSecondary }]}>Privacy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLogout}
                  style={[styles.iconBtn, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}
                >
                  <Feather name="log-out" size={16} color="#EF4444" />
                  <Text style={[styles.iconBtnLabel, { color: "#EF4444" }]}>Log Out</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.avatarSection}>
                <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} activeOpacity={0.8} style={styles.avatarWrapper}>
                  <UserAvatar uri={profile.profilePhoto} name={profile.username} size={90} />
                  <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Feather name="camera" size={14} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
                <Text style={[styles.changePhotoLabel, { color: colors.primary }]}>
                  {uploadingPhoto ? "Uploading…" : "Change Photo"}
                </Text>

                <View style={styles.nameRow}>
                  <Text style={[styles.username, { color: colors.text }]}>{profile.username}</Text>
                  {(profile.isAdmin) && (
                    <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={[styles.niche, { color: colors.primary }]}>
                  {profile.niche || "Scam Alert Community"}
                </Text>

                {/* Streak pill */}
                {streak.streak > 0 && (
                  <View style={[
                    styles.streakPill,
                    { backgroundColor: streak.streak >= 7 ? "#FF3B3B20" : "#F59E0B15",
                      borderColor: streak.streak >= 7 ? "#FF3B3B60" : "#F59E0B50" }
                  ]}>
                    <Text style={styles.streakFire}>{streak.streak >= 30 ? "💎" : streak.streak >= 7 ? "🔥" : "⚡"}</Text>
                    <Text style={[styles.streakNum, { color: streak.streak >= 7 ? "#FF3B3B" : "#F59E0B" }]}>
                      {streak.streak} day{streak.streak !== 1 ? "s" : ""} streak
                    </Text>
                    {streak.longestStreak > streak.streak && (
                      <Text style={[styles.streakBest, { color: colors.textMuted }]}>
                        best {streak.longestStreak}
                      </Text>
                    )}
                  </View>
                )}

                {editingBio ? (
                  <View style={styles.bioEdit}>
                    <TextInput
                      style={[styles.bioInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
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
                      <TouchableOpacity onPress={handleSaveBio} style={[styles.bioBtn, { backgroundColor: colors.primary }]}>
                        <Text style={styles.bioBtnText}>Save</Text>
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

              <View style={[styles.statsRow, { borderColor: colors.border }]}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>{posts.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Posts</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.stat} onPress={() => setActiveTab("reels")}>
                  <Text style={[styles.statNum, { color: colors.text }]}>{reels.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reels</Text>
                </TouchableOpacity>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>{profile.followers?.length ?? 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>{profile.following?.length ?? 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
                </View>
              </View>

              {/* Achievement badges row */}
              {achievements.length > 0 && (
                <View style={styles.achieveSection}>
                  <Text style={[styles.achieveTitle, { color: colors.textMuted }]}>
                    🏅 Achievements ({achievements.length}/{ALL_ACHIEVEMENTS.length})
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achieveRow}>
                    {ALL_ACHIEVEMENTS.map((a) => {
                      const earned = achievements.some((u) => u.id === a.id);
                      const color = getRarityColor(a.rarity);
                      return (
                        <View
                          key={a.id}
                          style={[
                            styles.achieveChip,
                            earned
                              ? { backgroundColor: color + "18", borderColor: color + "60" }
                              : { backgroundColor: colors.muted, borderColor: colors.border, opacity: 0.45 },
                          ]}
                        >
                          <Text style={styles.achieveEmoji}>{a.emoji}</Text>
                          <Text style={[styles.achieveLabel, { color: earned ? color : colors.textMuted }]} numberOfLines={1}>
                            {a.title}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.quickLinks}>
              <TouchableOpacity
                style={[styles.quickLink, { borderColor: "#EC489960", backgroundColor: "#EC48990D" }]}
                onPress={() => router.push("/reels-upload" as never)}
              >
                <Text style={{ fontSize: 16 }}>🎬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>Post a Reel</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    Share scam warnings as short videos
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLink, { borderColor: "#7C3AED60", backgroundColor: "#7C3AED0D" }]}
                onPress={() => router.push("/games-hub" as never)}
              >
                <Text style={{ fontSize: 16 }}>🎮</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>Scam Games</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    4 games — run, tap, swipe & race to beat friends
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLink, { borderColor: "#FF3B3B60", backgroundColor: "#FF3B3B0D" }]}
                onPress={() => router.push("/creator-studio" as never)}
              >
                <Text style={{ fontSize: 16 }}>🎨</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>Creator Studio</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    Design posts, graphics & alerts
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLink, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => router.push("/edit-profile" as never)}
              >
                <Feather name="edit-2" size={16} color={colors.primary} />
                <Text style={[styles.quickLinkText, { color: colors.text }]}>Edit Profile</Text>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLink, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => router.push("/settings" as never)}
              >
                <Feather name="settings" size={16} color={colors.textSecondary} />
                <Text style={[styles.quickLinkText, { color: colors.text }]}>Settings</Text>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLink, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowThemePicker(true)}
              >
                <Feather
                  name="droplet"
                  size={16}
                  color={colors.tint ?? colors.primary}
                />
                <Text style={[styles.quickLinkText, { color: colors.text }]}>Theme</Text>
                <View style={[styles.themePill, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.themePillText, { color: colors.primary }]}>
                    {themeModeLabel[mode] ?? mode}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Safety Tools */}
            <View style={[styles.toolsHeader, { paddingHorizontal: 16 }]}>
              <Text style={[styles.toolsTitle, { color: colors.textMuted }]}>Safety Tools</Text>
            </View>
            <View style={styles.toolsGrid}>
              {[
                { label: "AI Scam Check", icon: "cpu", route: "/scam-checker", color: "#FF3B3B" },
                { label: "ScamBot AI", icon: "message-circle", route: "/chatbot", color: "#FF3B3B" },
                { label: "Link Checker", icon: "link", route: "/link-checker", color: "#3B82F6" },
                { label: "Phone Check", icon: "phone", route: "/phone-checker", color: "#10B981" },
                { label: "QR Scanner", icon: "camera", route: "/qr-scanner", color: "#F59E0B" },
                { label: "Dark Web", icon: "eye-off", route: "/dark-web-checker", color: "#7C3AED" },
                { label: "Scam Map", icon: "map", route: "/scam-map", color: "#3B82F6" },
                { label: "Scam Quiz", icon: "help-circle", route: "/scam-quiz", color: "#EC4899" },
                { label: "Contacts", icon: "alert-triangle", route: "/emergency-contacts", color: "#EF4444" },
                { label: "Leaderboard", icon: "award", route: "/leaderboard", color: "#8B5CF6" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.toolCard, { backgroundColor: item.color + "15", borderColor: item.color + "30" }]}
                  onPress={() => router.push(item.route as never)}
                >
                  <Feather name={item.icon as keyof typeof Feather.glyphMap} size={20} color={item.color} />
                  <Text style={[styles.toolLabel, { color: colors.text }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Posts / Bookmarks / Reels tabs */}
            <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
              {([
                { key: "posts",     icon: "file-text",  label: `Posts (${posts.length})` },
                { key: "reels",     icon: "video",       label: `Reels (${reels.length})` },
                { key: "bookmarks", icon: "bookmark",    label: `Saved (${bookmarks.length})` },
              ] as { key: TabType; icon: string; label: string }[]).map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabBtn, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Feather
                    name={tab.icon as keyof typeof Feather.glyphMap}
                    size={14}
                    color={activeTab === tab.key ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, { color: activeTab === tab.key ? colors.primary : colors.textMuted }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {displayedLoading && <ActivityIndicator color={colors.primary} style={{ margin: 20 }} />}

            {/* Reels grid */}
            {activeTab === "reels" && !reelsLoading && (
              <>
                {/* Post reel CTA */}
                <TouchableOpacity
                  style={[styles.reelsCta, { backgroundColor: "#EC489910", borderColor: "#EC489930" }]}
                  onPress={() => router.push("/reels-upload" as never)}
                >
                  <Text style={{ fontSize: 20 }}>🎬</Text>
                  <Text style={[styles.reelsCtaTxt, { color: colors.text }]}>
                    {reels.length === 0 ? "Post your first reel" : "Post another reel"}
                  </Text>
                  <Feather name="plus-circle" size={18} color="#EC4899" />
                </TouchableOpacity>

                {reels.length === 0 ? (
                  <View style={styles.emptyPosts}>
                    <Text style={{ fontSize: 42 }}>🎬</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No reels yet</Text>
                    <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                      Share short scam-awareness videos with your followers
                    </Text>
                  </View>
                ) : (
                  <View style={styles.reelsGrid}>
                    {reels.map((reel, idx) => (
                      <TouchableOpacity
                        key={reel.id}
                        style={[styles.reelThumb, { backgroundColor: colors.muted }]}
                        onPress={() => router.push(`/reels-viewer?userId=${user?.uid}&startIndex=${idx}` as never)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.reelPlayOverlay}>
                          <Feather name="play" size={22} color="#fff" />
                        </View>
                        <View style={[styles.reelStats, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                          <Feather name="eye" size={10} color="#fff" />
                          <Text style={styles.reelStatTxt}>{reel.views.toLocaleString()}</Text>
                          <Feather name="heart" size={10} color="#fff" style={{ marginLeft: 6 }} />
                          <Text style={styles.reelStatTxt}>{reel.likes.length}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {!displayedLoading && activeTab !== "reels" && displayedPosts.length === 0 && (
              <View style={styles.emptyPosts}>
                <Feather name={activeTab === "posts" ? "file-text" : "bookmark"} size={36} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {activeTab === "posts" ? "No posts yet" : "No saved posts yet"}
                </Text>
                {activeTab === "bookmarks" && (
                  <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                    Tap the bookmark icon on any post to save it here
                  </Text>
                )}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 12 }}>
            <PostCard
              post={item}
              onComment={() => setCommentPost(item)}
              onReport={() => setReportPostId(item.id)}
            />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      />

      {commentPost && (
        <CommentSheet
          visible={!!commentPost}
          postId={commentPost.id}
          postAuthorId={commentPost.authorId}
          postTitle={commentPost.title}
          onClose={() => setCommentPost(null)}
        />
      )}
      {reportPostId && (
        <ReportModal
          visible={!!reportPostId}
          postId={reportPostId}
          onClose={() => setReportPostId(null)}
        />
      )}

      {/* Android / Web photo source picker */}
      <Modal visible={showPhotoSheet} transparent animationType="fade" onRequestClose={() => setShowPhotoSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowPhotoSheet(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Change Profile Photo</Text>
            <TouchableOpacity style={[styles.sheetOption, { borderBottomColor: colors.border }]} onPress={() => doUpload("camera")}>
              <Feather name="camera" size={20} color={colors.primary} />
              <Text style={[styles.sheetOptionText, { color: colors.text }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetOption} onPress={() => doUpload("gallery")}>
              <Feather name="image" size={20} color={colors.primary} />
              <Text style={[styles.sheetOptionText, { color: colors.text }]}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetCancel, { backgroundColor: colors.muted }]} onPress={() => setShowPhotoSheet(false)}>
              <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <AchievementToast achievement={newlyUnlocked} onHide={clearNewlyUnlocked} />
      <CustomThemePicker visible={showThemePicker} onClose={() => setShowThemePicker(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 16, borderBottomWidth: 1 },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconBtnLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  avatarSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 6,
  },
  avatarWrapper: { position: "relative", marginBottom: 4 },
  changePhotoLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginTop: 2,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { fontFamily: "Inter_700Bold", fontSize: 22 },
  niche: { fontFamily: "Inter_500Medium", fontSize: 13 },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 19,
  },
  bioEdit: { width: "100%", gap: 8, marginTop: 8 },
  bioInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
  },
  bioActions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  bioBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  bioBtnText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 20 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  statDivider: { width: 1, height: 30 },
  quickLinks: { padding: 16, gap: 8 },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickLinkText: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  themePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  themePillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  tabLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  emptyPosts: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  emptyHint: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", paddingHorizontal: 32 },
  toolsHeader: { marginTop: 4, marginBottom: 6 },
  toolsTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  toolCard: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  toolLabel: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 4,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 12,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sheetOptionText: { fontFamily: "Inter_500Medium", fontSize: 16 },
  sheetCancel: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  // Streak
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    marginTop: 6,
  },
  streakFire: { fontSize: 16 },
  streakNum: { fontFamily: "Inter_700Bold", fontSize: 14 },
  streakBest: { fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: 2 },
  // Achievements
  achieveSection: {
    paddingTop: 16,
    paddingHorizontal: 0,
    gap: 10,
  },
  achieveTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
  },
  achieveRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  achieveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  achieveEmoji: { fontSize: 15 },
  achieveLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  reelsCta:     { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 10, marginBottom: 6, padding: 14, borderRadius: 14, borderWidth: 1 },
  reelsCtaTxt:  { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
  reelsGrid:    { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 3, paddingBottom: 16 },
  reelThumb:    { width: "32%", aspectRatio: 9 / 16, borderRadius: 8, overflow: "hidden", justifyContent: "flex-end" },
  reelPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.25)" },
  reelStats:    { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
  reelStatTxt:  { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#fff", marginLeft: 2 },
});
