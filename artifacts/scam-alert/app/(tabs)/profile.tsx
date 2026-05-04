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
  Share,
  Linking,
  Image,
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
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  deleteDoc,
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
import { UserActivityCalendar } from "@/components/UserActivityCalendar";
import * as VideoThumbnails from "expo-video-thumbnails";

const APP_ICON = require("@/assets/images/icon.png");

// ── ReelThumbnail ────────────────────────────────────────────────────────────
// Web  → native <video preload="metadata"> shows first frame automatically.
// Native → expo-video-thumbnails generates a real JPEG frame at 500ms.
function ReelThumbnail({ videoUrl, style }: { videoUrl: string; style: object }) {
  const [thumbUri, setThumbUri] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    VideoThumbnails.getThumbnailAsync(videoUrl, { time: 500 })
      .then(({ uri }) => { if (!cancelled) setThumbUri(uri); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [videoUrl]);

  if (Platform.OS === "web") {
    return (
      <View style={style}>
        {React.createElement("video", {
          src: videoUrl,
          preload: "metadata",
          muted: true,
          playsInline: true,
          style: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
          onLoadedMetadata: (e: any) => { e.target.currentTime = 0.5; },
        })}
      </View>
    );
  }

  // Native — show generated thumbnail or dark placeholder while loading
  return (
    <View style={[style, { backgroundColor: "#111" }]}>
      {thumbUri ? (
        <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Image source={APP_ICON} style={styles.reelThumbPlaceholder} resizeMode="cover" />
        </View>
      )}
    </View>
  );
}

type TabType = "posts" | "bookmarks" | "reels";

type ReelItem = {
  id: string; userId: string; videoUrl: string;
  caption: string; likes: string[]; dislikes: string[]; views: number; createdAt: number;
  musicUrl?: string | null; musicName?: string | null; musicEmoji?: string | null;
};

// ── Social sharing constants ─────────────────────────────────────────────────
const HASHTAGS = "#ScamAlert #ScamAwareness #FraudAlert";

type SocialPlatform = {
  id: string; name: string; emoji: string; color: string;
  buildUrl?: (videoUrl: string, text: string) => string;
};

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "facebook", name: "Facebook", emoji: "📘", color: "#1877F2",
    buildUrl: (u, t) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}&quote=${encodeURIComponent(t + " " + HASHTAGS)}`,
  },
  {
    id: "twitter", name: "X (Twitter)", emoji: "🐦", color: "#1a1a1a",
    buildUrl: (u, t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t.slice(0, 180) + " " + HASHTAGS)}`,
  },
  {
    id: "linkedin", name: "LinkedIn", emoji: "💼", color: "#0A66C2",
    buildUrl: (u, t) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}&summary=${encodeURIComponent(t + " " + HASHTAGS)}`,
  },
  {
    id: "reddit", name: "Reddit", emoji: "🤖", color: "#FF4500",
    buildUrl: (u, t) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(t.slice(0, 200) + " " + HASHTAGS)}`,
  },
  {
    id: "pinterest", name: "Pinterest", emoji: "📌", color: "#E60023",
    buildUrl: (u, t) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(u)}&description=${encodeURIComponent(t + " " + HASHTAGS)}`,
  },
  { id: "instagram", name: "Instagram", emoji: "📸", color: "#E1306C" },
  { id: "tiktok",    name: "TikTok",    emoji: "🎵", color: "#EE1D52" },
  { id: "youtube",   name: "YouTube",   emoji: "▶️",  color: "#FF0000" },
];

// ── Social Share Modal ───────────────────────────────────────────────────────
function SocialShareModal({
  visible, onClose, videoUrl, caption,
}: {
  visible: boolean;
  onClose: () => void;
  videoUrl: string;
  caption: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const shareText = `${caption} ${HASHTAGS}`;

  const handlePlatform = async (platform: SocialPlatform) => {
    try {
      if (platform.buildUrl) {
        const url = platform.buildUrl(videoUrl, caption);
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          // Fallback to native share sheet
          await Share.share({ message: shareText + "\n" + videoUrl, url: videoUrl });
        }
      } else {
        // Instagram / TikTok / YouTube — use native share sheet
        await Share.share({
          message: `${shareText}\n\nWatch on Scam Alert: ${videoUrl}`,
          url: videoUrl,
          title: "Scam Alert Reel",
        });
      }
    } catch {}
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: `${shareText}\n\nWatch on Scam Alert: ${videoUrl}`,
        url: videoUrl,
        title: "Scam Alert Reel",
      });
    } catch {}
  };

  const handleCopyLink = async () => {
    try {
      await Share.share({ message: videoUrl });
      Alert.alert("Link copied!", "Video link ready to share.");
    } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={SSM.backdrop} onPress={onClose} />
      <View style={[SSM.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
        <View style={[SSM.handle, { backgroundColor: colors.border }]} />
        <Text style={[SSM.title, { color: colors.text }]}>Share Reel</Text>
        <Text style={[SSM.sub, { color: colors.textMuted }]}>
          Shared with tags: <Text style={{ color: colors.primary }}>{HASHTAGS}</Text>
        </Text>

        {/* Platform grid */}
        <View style={SSM.grid}>
          {SOCIAL_PLATFORMS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={SSM.platformBtn}
              onPress={() => handlePlatform(p)}
              activeOpacity={0.75}
            >
              <View style={[SSM.platformIcon, { backgroundColor: p.color + "18", borderColor: p.color + "40" }]}>
                <Text style={{ fontSize: 22 }}>{p.emoji}</Text>
              </View>
              <Text style={[SSM.platformName, { color: colors.textSecondary }]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom actions */}
        <View style={[SSM.divider, { backgroundColor: colors.border }]} />
        <View style={SSM.bottomRow}>
          <TouchableOpacity style={[SSM.bottomBtn, { backgroundColor: colors.muted }]} onPress={handleCopyLink}>
            <Feather name="link" size={16} color={colors.text} />
            <Text style={[SSM.bottomBtnTxt, { color: colors.text }]}>Copy Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[SSM.bottomBtn, { backgroundColor: "#FF3B3B" }]} onPress={handleNativeShare}>
            <Feather name="share-2" size={16} color="#fff" />
            <Text style={[SSM.bottomBtnTxt, { color: "#fff" }]}>Share via…</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const SSM = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, paddingHorizontal: 20 },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  title:        { fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" },
  sub:          { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 16 },
  grid:         { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, paddingBottom: 4 },
  platformBtn:  { width: "22%", alignItems: "center", gap: 6 },
  platformIcon: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  platformName: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center" },
  divider:      { height: 1, marginVertical: 14 },
  bottomRow:    { flexDirection: "row", gap: 10 },
  bottomBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14 },
  bottomBtnTxt: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});

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
  const [shareReel, setShareReel] = useState<ReelItem | null>(null);
  const [savedReelIds, setSavedReelIds] = useState<Set<string>>(new Set());
  const [localLikes, setLocalLikes] = useState<Record<string, string[]>>({});
  const [localDislikes, setLocalDislikes] = useState<Record<string, string[]>>({});
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

  // My reels — always fetch on mount so count is accurate
  useEffect(() => {
    if (!user) return;
    setReelsLoading(true);
    getDocs(
      query(collection(db, "reels"), where("userId", "==", user.uid))
    ).then((snap) => {
      const data = snap.docs
        .map((d) => ({
          id: d.id, ...d.data(),
          createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
          dislikes: d.data().dislikes ?? [],
        } as ReelItem))
        .sort((a, b) => b.createdAt - a.createdAt);
      setReels(data);
      setReelsLoading(false);
    }).catch(() => setReelsLoading(false));
  }, [user]);

  // Load saved reel IDs
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, "users", user.uid, "savedReels"))
      .then((snap) => setSavedReelIds(new Set(snap.docs.map((d) => d.id))))
      .catch(() => {});
  }, [user]);

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

  const handleReelLike = async (reel: ReelItem) => {
    if (!user) return;
    const current = localLikes[reel.id] ?? reel.likes;
    const liked = current.includes(user.uid);
    setLocalLikes((p) => ({ ...p, [reel.id]: liked ? current.filter((u) => u !== user.uid) : [...current, user.uid] }));
    if (!liked) {
      setLocalDislikes((p) => ({ ...p, [reel.id]: (p[reel.id] ?? reel.dislikes ?? []).filter((u) => u !== user.uid) }));
      updateDoc(doc(db, "reels", reel.id), { likes: arrayUnion(user.uid), dislikes: arrayRemove(user.uid) }).catch(() => {});
    } else {
      updateDoc(doc(db, "reels", reel.id), { likes: arrayRemove(user.uid) }).catch(() => {});
    }
  };

  const handleReelDislike = async (reel: ReelItem) => {
    if (!user) return;
    const current = localDislikes[reel.id] ?? reel.dislikes ?? [];
    const disliked = current.includes(user.uid);
    setLocalDislikes((p) => ({ ...p, [reel.id]: disliked ? current.filter((u) => u !== user.uid) : [...current, user.uid] }));
    if (!disliked) {
      setLocalLikes((p) => ({ ...p, [reel.id]: (p[reel.id] ?? reel.likes).filter((u) => u !== user.uid) }));
      updateDoc(doc(db, "reels", reel.id), { dislikes: arrayUnion(user.uid), likes: arrayRemove(user.uid) }).catch(() => {});
    } else {
      updateDoc(doc(db, "reels", reel.id), { dislikes: arrayRemove(user.uid) }).catch(() => {});
    }
  };

  const handleReelSave = async (reel: ReelItem) => {
    if (!user) return;
    const saved = savedReelIds.has(reel.id);
    const next = new Set(savedReelIds);
    if (saved) {
      next.delete(reel.id);
      setSavedReelIds(next);
      deleteDoc(doc(db, "users", user.uid, "savedReels", reel.id)).catch(() => {});
    } else {
      next.add(reel.id);
      setSavedReelIds(next);
      setDoc(doc(db, "users", user.uid, "savedReels", reel.id), { reelId: reel.id, savedAt: Date.now() }).catch(() => {});
    }
  };

  const handleReelRemix = (reel: ReelItem) => {
    const p: Record<string, string> = { remixCaption: reel.caption || "" };
    if (reel.musicUrl) p.remixMusicUrl = reel.musicUrl;
    if (reel.musicName) p.remixMusicName = reel.musicName;
    if (reel.musicEmoji) p.remixMusicEmoji = reel.musicEmoji;
    router.push(("/reels-upload?" + new URLSearchParams(p).toString()) as never);
  };

  const handleReelReport = async (reel: ReelItem, reason: string) => {
    if (!user) return;
    try {
      const { addDoc, collection: col, serverTimestamp: sts } = await import("firebase/firestore");
      await addDoc(col(db, "reports"), {
        type: "reel",
        contentId: reel.id,
        reportedBy: user.uid,
        reason,
        createdAt: sts(),
      });
      Alert.alert("Report Submitted", "Thanks for keeping the community safe. We'll review this reel.");
    } catch {
      Alert.alert("Error", "Could not submit report. Please try again.");
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
                    <Image source={APP_ICON} style={styles.iconBtnImg} resizeMode="cover" />
                    <Text style={[styles.iconBtnLabel, { color: colors.primary }]}>Admin</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => router.push("/legal/privacy" as never)}
                  style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Image source={APP_ICON} style={styles.iconBtnImg} resizeMode="cover" />
                  <Text style={[styles.iconBtnLabel, { color: colors.textSecondary }]}>Privacy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLogout}
                  style={[styles.iconBtn, { backgroundColor: "#EF444415", borderColor: "#EF444430" }]}
                >
                  <Image source={APP_ICON} style={styles.iconBtnImg} resizeMode="cover" />
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
                      <Image source={APP_ICON} style={{ width: 16, height: 16, borderRadius: 4 }} resizeMode="cover" />
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

            {/* Activity Calendar */}
            {user && (
              <UserActivityCalendar
                userId={user.uid}
                joinedAt={profile.createdAt ?? null}
              />
            )}

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
                style={[styles.quickLink, { borderColor: "#0A66C260", backgroundColor: "#0A66C20D" }]}
                onPress={() => {
                  if (reels.length > 0) {
                    setShareReel(reels[0]);
                  } else {
                    Alert.alert(
                      "No reels yet",
                      "Post your first reel to share it across social media.",
                      [
                        { text: "Post a Reel", onPress: () => router.push("/reels-upload" as never) },
                        { text: "Cancel", style: "cancel" },
                      ],
                    );
                  }
                }}
              >
                <Text style={{ fontSize: 16 }}>📣</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quickLinkText, { color: colors.text }]}>Share to Social Media</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                    Facebook, TikTok, Instagram, Reddit & more
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
                <Image source={APP_ICON} style={styles.quickLinkIcon} resizeMode="cover" />
                <Text style={[styles.quickLinkText, { color: colors.text }]}>Edit Profile</Text>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLink, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => router.push("/settings" as never)}
              >
                <Image source={APP_ICON} style={styles.quickLinkIcon} resizeMode="cover" />
                <Text style={[styles.quickLinkText, { color: colors.text }]}>Settings</Text>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickLink, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowThemePicker(true)}
              >
                <Image source={APP_ICON} style={styles.quickLinkIcon} resizeMode="cover" />
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
                  <Image source={APP_ICON} style={styles.toolIcon} resizeMode="cover" />
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
                  <Image
                    source={APP_ICON}
                    style={[styles.tabIcon, { opacity: activeTab === tab.key ? 1 : 0.4 }]}
                    resizeMode="cover"
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
                  <Image source={APP_ICON} style={styles.reelCtaIcon} resizeMode="cover" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#EC4899" }}>Post Reel</Text>
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
                    {reels.map((reel, idx) => {
                      const likes = localLikes[reel.id] ?? reel.likes;
                      const dislikes = localDislikes[reel.id] ?? reel.dislikes ?? [];
                      const liked = user ? likes.includes(user.uid) : false;
                      const disliked = user ? dislikes.includes(user.uid) : false;
                      const saved = savedReelIds.has(reel.id);
                      return (
                        <View key={reel.id} style={[styles.reelCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          {/* Thumbnail — shows real first video frame on web */}
                          <TouchableOpacity
                            style={styles.reelThumb}
                            onPress={() => router.push(`/reels-viewer?userId=${user?.uid}&startIndex=${idx}` as never)}
                            activeOpacity={0.85}
                          >
                            <ReelThumbnail videoUrl={reel.videoUrl} style={StyleSheet.absoluteFill} />
                            <View style={styles.reelPlayOverlay}>
                              <Image source={APP_ICON} style={styles.reelPlayIcon} resizeMode="cover" />
                              <Text style={styles.reelPlayLabel}>Play</Text>
                            </View>
                            {reel.caption ? (
                              <View style={styles.reelCaptionOverlay}>
                                <Text style={styles.reelCaptionTxt} numberOfLines={1}>{reel.caption}</Text>
                              </View>
                            ) : null}
                            <View style={[styles.reelStats, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                              <Image source={APP_ICON} style={styles.reelStatIcon} resizeMode="cover" />
                              <Text style={styles.reelStatTxt}>{reel.views.toLocaleString()} views</Text>
                            </View>
                          </TouchableOpacity>

                          {/* Action row */}
                          <View style={[styles.reelActions, { borderTopColor: colors.border }]}>
                            {/* Like */}
                            <TouchableOpacity
                              style={styles.reelActionBtn}
                              onPress={() => handleReelLike(reel)}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <Image source={APP_ICON} style={styles.reelActionIcon} resizeMode="cover" />
                              <Text style={[styles.reelActionCount, { color: liked ? "#FF3B3B" : colors.textMuted }]}>Like</Text>
                              <Text style={[styles.reelActionCount, { color: liked ? "#FF3B3B" : colors.textMuted }]}>{likes.length}</Text>
                            </TouchableOpacity>

                            {/* Dislike */}
                            <TouchableOpacity
                              style={styles.reelActionBtn}
                              onPress={() => handleReelDislike(reel)}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <Image source={APP_ICON} style={styles.reelActionIcon} resizeMode="cover" />
                              <Text style={[styles.reelActionCount, { color: disliked ? "#F59E0B" : colors.textMuted }]}>Dislike</Text>
                              <Text style={[styles.reelActionCount, { color: disliked ? "#F59E0B" : colors.textMuted }]}>{dislikes.length}</Text>
                            </TouchableOpacity>

                            {/* Remix */}
                            <TouchableOpacity
                              style={styles.reelActionBtn}
                              onPress={() => handleReelRemix(reel)}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <Image source={APP_ICON} style={styles.reelActionIcon} resizeMode="cover" />
                              <Text style={[styles.reelActionCount, { color: "#EC4899" }]}>Remix</Text>
                            </TouchableOpacity>

                            {/* Save */}
                            <TouchableOpacity
                              style={styles.reelActionBtn}
                              onPress={() => handleReelSave(reel)}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <Image source={APP_ICON} style={styles.reelActionIcon} resizeMode="cover" />
                              <Text style={[styles.reelActionCount, { color: saved ? colors.primary : colors.textMuted }]}>{saved ? "Saved" : "Save"}</Text>
                            </TouchableOpacity>

                            {/* Follow / Share Profile */}
                            <TouchableOpacity
                              style={styles.reelActionBtn}
                              onPress={() =>
                                Share.share({
                                  message: `Follow me on Scam Alert! @${profile?.username ?? ""}`,
                                  url: `https://${process.env.EXPO_PUBLIC_DOMAIN}/user/${user?.uid}`,
                                }).catch(() => {})
                              }
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <Text style={styles.reelFollowEagle}>🦅</Text>
                              <Text style={[styles.reelActionCount, { color: "#3B82F6", fontFamily: "Inter_700Bold" }]}>Follow</Text>
                            </TouchableOpacity>

                            {/* Report */}
                            <TouchableOpacity
                              style={styles.reelActionBtn}
                              onPress={() =>
                                Alert.alert(
                                  "Report Reel",
                                  "Why are you reporting this reel?",
                                  [
                                    { text: "Spam", onPress: () => handleReelReport(reel, "Spam") },
                                    { text: "Misinformation", onPress: () => handleReelReport(reel, "Misinformation") },
                                    { text: "Inappropriate", onPress: () => handleReelReport(reel, "Inappropriate") },
                                    { text: "Cancel", style: "cancel" },
                                  ]
                                )
                              }
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <Image source={APP_ICON} style={styles.reelActionIcon} resizeMode="cover" />
                              <Text style={[styles.reelActionCount, { color: "#EF4444" }]}>Report</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
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

      {shareReel && (
        <SocialShareModal
          visible={!!shareReel}
          onClose={() => setShareReel(null)}
          videoUrl={shareReel.videoUrl}
          caption={shareReel.caption}
        />
      )}
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
  iconBtnImg: { width: 16, height: 16, borderRadius: 4 },
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
  quickLinkIcon: { width: 18, height: 18, borderRadius: 5 },
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
  tabIcon: { width: 15, height: 15, borderRadius: 4 },
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
  toolIcon: { width: 22, height: 22, borderRadius: 6 },
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
  reelsGrid:        { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10, paddingBottom: 16 },
  reelCard:         { width: "47%", borderRadius: 12, overflow: "hidden", borderWidth: 1 },
  reelThumb:        { width: "100%", aspectRatio: 9 / 16, overflow: "hidden", justifyContent: "flex-end" },
  reelPlayOverlay:  { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.28)" },
  reelCaptionOverlay: { position: "absolute", bottom: 24, left: 0, right: 0, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: "rgba(0,0,0,0.45)" },
  reelCaptionTxt:   { fontFamily: "Inter_400Regular", fontSize: 10, color: "#fff" },
  reelStats:        { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  reelStatTxt:      { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#fff", marginLeft: 2 },
  reelActions:      { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, paddingVertical: 6, paddingHorizontal: 4, gap: 2 },
  reelActionBtn:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 3 },
  reelActionCount:  { fontFamily: "Inter_500Medium", fontSize: 9 },

  reelThumbPlaceholder: { width: 28, height: 28, borderRadius: 6, opacity: 0.3 },
  reelCtaIcon:          { width: 18, height: 18, borderRadius: 4 },
  reelPlayIcon:         { width: 34, height: 34, borderRadius: 8 },
  reelPlayLabel:        { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff", marginTop: 4, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  reelStatIcon:         { width: 9, height: 9, borderRadius: 2 },
  reelActionIcon:       { width: 15, height: 15, borderRadius: 3 },
  reelFollowEagle:      { fontSize: 22 },
});
