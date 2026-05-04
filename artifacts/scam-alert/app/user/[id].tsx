import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth, type UserProfile } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard, type PostData } from "@/components/PostCard";
import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";
import { UserActivityCalendar } from "@/components/UserActivityCalendar";
import { generateId } from "@/lib/utils";

const APP_ICON = require("@/assets/images/icon.png");
const SCREEN_W = Dimensions.get("window").width;
const REEL_COL = 3;
const REEL_W = (SCREEN_W - 32 - 8) / REEL_COL;

type ReelItem = {
  id: string;
  userId: string;
  username: string;
  videoUrl: string;
  caption: string;
  likes: string[];
  views: number;
  createdAt: number;
};

type TabType = "posts" | "reels";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile: myProfile, refreshProfile } = useAuth();

  const [targetUser, setTargetUser]   = useState<UserProfile | null>(null);
  const [posts, setPosts]             = useState<PostData[]>([]);
  const [reels, setReels]             = useState<ReelItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [following, setFollowing]     = useState(false);
  const [activeTab, setActiveTab]     = useState<TabType>("posts");
  const [commentPost, setCommentPost] = useState<PostData | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  const isMe = user?.uid === id;

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      // User profile
      const snap = await getDoc(doc(db, "users", id));
      if (snap.exists()) {
        const u = snap.data() as UserProfile;
        setTargetUser(u);
        setFollowing(!!user && (u.followers ?? []).includes(user.uid));
      }

      // Posts + Reels in parallel
      const [postsSnap, reelsSnap] = await Promise.all([
        getDocs(query(collection(db, "posts"), where("authorId", "==", id))),
        getDocs(query(collection(db, "reels"), where("userId",   "==", id))),
      ]);

      setPosts(
        postsSnap.docs
          .map((d) => ({ ...(d.data() as Omit<PostData, "id">), id: d.id }))
          .sort((a, b) => (b.createdAt as number) - (a.createdAt as number))
      );

      setReels(
        reelsSnap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ReelItem, "id">),
            createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
          }))
          .sort((a, b) => b.createdAt - a.createdAt)
      );

      setLoading(false);
    };
    fetch();
  }, [id, user]);

  const handleFollow = async () => {
    if (!user || !targetUser) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const targetRef = doc(db, "users", targetUser.uid);
    const myRef     = doc(db, "users", user.uid);
    if (following) {
      await updateDoc(targetRef, { followers: arrayRemove(user.uid) });
      await updateDoc(myRef,     { following: arrayRemove(targetUser.uid) });
      setFollowing(false);
      setTargetUser((u) => u ? { ...u, followers: (u.followers ?? []).filter((f) => f !== user.uid) } : u);
    } else {
      await updateDoc(targetRef, { followers: arrayUnion(user.uid) });
      await updateDoc(myRef,     { following: arrayUnion(targetUser.uid) });
      setFollowing(true);
      setTargetUser((u) => u ? { ...u, followers: [...(u.followers ?? []), user.uid] } : u);
    }
    refreshProfile();
  };

  const handleMessage = async () => {
    if (!user || !targetUser) return;
    const chatId = [user.uid, targetUser.uid].sort().join("_");
    await setDoc(
      doc(db, "chats", chatId),
      {
        participants: [user.uid, targetUser.uid],
        participantNames: {
          [user.uid]: myProfile?.username ?? "Me",
          [targetUser.uid]: targetUser.username,
        },
        participantAvatars: {
          [user.uid]: myProfile?.profilePhoto ?? null,
          [targetUser.uid]: targetUser.profilePhoto ?? null,
        },
        lastMessage: "",
        lastMessageAt: Date.now(),
      },
      { merge: true }
    );
    router.push(`/chat/${chatId}` as never);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!targetUser) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {/* Nav bar */}
        <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Image source={APP_ICON} style={styles.backIcon} resizeMode="cover" />
            <Text style={[styles.backTxt, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
            {targetUser.username}
          </Text>
          <View style={{ width: 56 }} />
        </View>

        {/* Profile header */}
        <View style={styles.profileSection}>
          <UserAvatar uri={targetUser.profilePhoto} name={targetUser.username} size={84} />
          <Text style={[styles.username, { color: colors.text }]}>{targetUser.username}</Text>
          <Text style={[styles.niche, { color: colors.primary }]}>
            {targetUser.niche || "Scam Alert Community"}
          </Text>
          {targetUser.bio ? (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{targetUser.bio}</Text>
          ) : null}

          {/* Stats */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <TouchableOpacity style={styles.stat} onPress={() => setActiveTab("posts")}>
              <Text style={[styles.statNum, { color: colors.text }]}>{posts.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Posts</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.stat} onPress={() => setActiveTab("reels")}>
              <Text style={[styles.statNum, { color: colors.text }]}>{reels.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reels</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.text }]}>{targetUser.followers?.length ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.text }]}>{targetUser.following?.length ?? 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
            </View>
          </View>

          {/* Action buttons */}
          {!isMe && (
            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={[styles.followBtn, {
                  backgroundColor: following ? colors.card : colors.primary,
                  borderColor: following ? colors.border : colors.primary,
                }]}
                onPress={handleFollow}
              >
                <Text style={[styles.followBtnText, { color: following ? colors.text : "#fff" }]}>
                  {following ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.msgBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={handleMessage}
              >
                <Image source={APP_ICON} style={{ width: 16, height: 16, borderRadius: 4 }} resizeMode="cover" />
                <Text style={[styles.msgBtnText, { color: colors.text }]}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Activity Calendar */}
        <UserActivityCalendar userId={id as string} joinedAt={targetUser.createdAt ?? null} />

        {/* Posts / Reels Tab Bar */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {(["posts", "reels"] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Image
                source={APP_ICON}
                style={[styles.tabIcon, { opacity: activeTab === tab ? 1 : 0.35 }]}
                resizeMode="cover"
              />
              <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.textMuted }]}>
                {tab === "posts" ? `Posts (${posts.length})` : `Reels (${reels.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Posts tab ─────────────────────────────────────── */}
        {activeTab === "posts" && (
          <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            {posts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Image source={APP_ICON} style={{ width: 48, height: 48, borderRadius: 14, opacity: 0.3 }} resizeMode="cover" />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet</Text>
              </View>
            ) : (
              posts.map((item) => (
                <PostCard
                  key={item.id}
                  post={item}
                  onComment={() => setCommentPost(item)}
                  onReport={() => setReportPostId(item.id)}
                />
              ))
            )}
          </View>
        )}

        {/* ── Reels tab ─────────────────────────────────────── */}
        {activeTab === "reels" && (
          <View style={styles.reelsSection}>
            {reels.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 40 }}>🎬</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No reels yet</Text>
              </View>
            ) : (
              <View style={styles.reelsGrid}>
                {reels.map((reel, idx) => (
                  <TouchableOpacity
                    key={reel.id}
                    style={[styles.reelCard, { backgroundColor: colors.card, borderColor: colors.border, width: REEL_W, height: REEL_W * 1.55 }]}
                    activeOpacity={0.82}
                    onPress={() => router.push(`/reels-viewer?userId=${id}&startIndex=${idx}` as never)}
                  >
                    {/* Dark video placeholder */}
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: "#0d0000" }]} />

                    {/* Play button */}
                    <View style={styles.reelPlay}>
                      <View style={styles.reelPlayCircle}>
                        <Image source={APP_ICON} style={styles.reelPlayIcon} resizeMode="cover" />
                      </View>
                    </View>

                    {/* Stats bar */}
                    <View style={styles.reelStatBar}>
                      <Image source={APP_ICON} style={styles.reelStatIcon} resizeMode="cover" />
                      <Text style={styles.reelStatTxt}>{reel.views?.toLocaleString() ?? 0}</Text>
                      <Text style={styles.reelStatDot}>·</Text>
                      <Text style={styles.reelStatTxt}>❤️ {reel.likes?.length ?? 0}</Text>
                    </View>

                    {/* Caption */}
                    {!!reel.caption && (
                      <View style={styles.reelCapBar}>
                        <Text style={styles.reelCapTxt} numberOfLines={1}>{reel.caption}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  centered:   { alignItems: "center", justifyContent: "center" },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle:   { fontFamily: "Inter_600SemiBold", fontSize: 17, flex: 1, textAlign: "center" },
  backBtn:    { flexDirection: "row", alignItems: "center", gap: 6 },
  backIcon:   { width: 22, height: 22, borderRadius: 6 },
  backTxt:    { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  profileSection: { alignItems: "center", padding: 20, gap: 6 },
  username:   { fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 8 },
  niche:      { fontFamily: "Inter_500Medium", fontSize: 13 },
  bio:        { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 19 },

  statsRow:   { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 0, marginTop: 12 },
  stat:       { flex: 1, alignItems: "center", gap: 2 },
  statNum:    { fontFamily: "Inter_700Bold", fontSize: 18 },
  statLabel:  { fontFamily: "Inter_400Regular", fontSize: 11 },
  statDivider:{ width: 1, height: 28 },

  actionBtns: { flexDirection: "row", gap: 10, marginTop: 12 },
  followBtn:  { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  followBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  msgBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  msgBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },

  tabBar:     { flexDirection: "row", borderBottomWidth: 1, marginTop: 4 },
  tabBtn:     { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  tabIcon:    { width: 15, height: 15, borderRadius: 4 },
  tabLabel:   { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  emptyBox:   { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText:  { fontFamily: "Inter_400Regular", fontSize: 14 },

  reelsSection: { paddingHorizontal: 16, paddingTop: 12 },
  reelsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reelCard:   { borderRadius: 12, overflow: "hidden", borderWidth: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  reelPlay:   { alignItems: "center", justifyContent: "center" },
  reelPlayCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,59,59,0.85)", alignItems: "center", justifyContent: "center" },
  reelPlayIcon:   { width: 22, height: 22, borderRadius: 6 },
  reelStatBar:    { position: "absolute", bottom: 26, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 5, paddingVertical: 3 },
  reelStatIcon:   { width: 10, height: 10, borderRadius: 3 },
  reelStatTxt:    { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#fff" },
  reelStatDot:    { color: "rgba(255,255,255,0.5)", fontSize: 9 },
  reelCapBar:     { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 5, paddingVertical: 4 },
  reelCapTxt:     { fontFamily: "Inter_400Regular", fontSize: 9, color: "#fff" },
});
