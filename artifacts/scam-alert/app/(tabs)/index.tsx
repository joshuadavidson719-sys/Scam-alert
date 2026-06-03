import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth, CATEGORIES, type CategoryId } from "@/context/AuthContext";
import { PostCard, type PostData } from "@/components/PostCard";
import { CategoryPill } from "@/components/CategoryPill";
import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";
import { TrendingCarousel } from "@/components/TrendingCarousel";
import { FollowSuggestions } from "@/components/FollowSuggestions";
import { SmartBanner } from "@/components/SmartBanner";
import { TrendingScamsToday } from "@/components/TrendingScamsToday";
import { ScamOfTheDay } from "@/components/ScamOfTheDay";
import { NearbyAlerts } from "@/components/NearbyAlerts";
import { ActivePoll } from "@/components/CommunityPoll";
import { LiveScamCounter } from "@/components/LiveScamCounter";
import { ScamRadar } from "@/components/ScamRadar";
import { DailyBriefingModal } from "@/components/DailyBriefingModal";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

// ── Invisible War Featured Banner ─────────────────────────────────────────────
function InvisibleWarBanner() {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push("/invisible-war" as never)}
      style={iwb.wrap}
    >
      <LinearGradient
        colors={["#0D0020", "#1a0035", "#0D0020"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={iwb.card}
      >
        {/* Glow accents */}
        <View style={iwb.glowLeft} />
        <View style={iwb.glowRight} />

        {/* Left — fighter emojis */}
        <View style={iwb.fighters}>
          <Text style={iwb.fighterEmoji}>🥷</Text>
          <Text style={iwb.vsText}>VS</Text>
          <Text style={iwb.fighterEmoji}>👑</Text>
        </View>

        {/* Right — text */}
        <View style={iwb.info}>
          <View style={iwb.badgeRow}>
            <View style={iwb.newBadge}><Text style={iwb.newTxt}>NEW</Text></View>
            <Text style={iwb.genre}>Fighting Game</Text>
          </View>
          <Text style={iwb.title}>INVISIBLE WAR</Text>
          <Text style={iwb.subtitle}>8 fighters · Special moves · AI battles</Text>
          <View style={iwb.playBtn}>
            <Text style={iwb.playTxt}>⚔️  PLAY NOW</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const iwb = StyleSheet.create({
  wrap:         { paddingHorizontal: 16, marginTop: 12 },
  card:         { borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, overflow: "hidden", borderWidth: 1, borderColor: "#6C63FF44" },
  glowLeft:     { position: "absolute", left: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: "#6C63FF", opacity: 0.12 },
  glowRight:    { position: "absolute", right: -20, bottom: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: "#FF00CC", opacity: 0.12 },
  fighters:     { alignItems: "center", gap: 4 },
  fighterEmoji: { fontSize: 34 },
  vsText:       { fontFamily: "Inter_700Bold", fontSize: 10, color: "#555", letterSpacing: 1 },
  info:         { flex: 1, gap: 5 },
  badgeRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  newBadge:     { backgroundColor: "#FF00CC", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  newTxt:       { fontFamily: "Inter_700Bold", fontSize: 9, color: "#fff", letterSpacing: 1 },
  genre:        { fontFamily: "Inter_500Medium", fontSize: 10, color: "#888" },
  title:        { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff", letterSpacing: 1, textShadowColor: "#6C63FF", textShadowRadius: 10 },
  subtitle:     { fontFamily: "Inter_400Regular", fontSize: 11, color: "#888" },
  playBtn:      { backgroundColor: "#6C63FF", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, alignSelf: "flex-start", marginTop: 2 },
  playTxt:      { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff", letterSpacing: 0.5 },
});

// ── Video Feed Strip ──────────────────────────────────────────────────────────
type ReelPreview = {
  id: string;
  userId: string;
  username: string;
  caption: string;
  videoUrl: string;
  profilePhoto?: string | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function VideoFeedStrip() {
  const colors = useColors();
  const [reels, setReels] = useState<ReelPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    getDocs(query(collection(db, "reels"), orderBy("createdAt", "desc"), limit(40)))
      .then((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReelPreview, "id">) }));
        setReels(shuffle(data));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={vStyles.loadingRow}>
        <ActivityIndicator color="#FF3B3B" size="small" />
        <Text style={[vStyles.loadingTxt, { color: colors.textMuted }]}>Loading videos…</Text>
      </View>
    );
  }

  if (reels.length === 0) return null;

  return (
    <View style={vStyles.section}>
      {/* Header */}
      <View style={vStyles.sectionHeader}>
        <Text style={[vStyles.sectionTitle, { color: colors.text }]}>🎬 Videos</Text>
        <TouchableOpacity onPress={() => router.push("/reels-viewer" as never)}>
          <Text style={[vStyles.seeAll, { color: colors.primary }]}>See All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={reels}
        horizontal
        keyExtractor={(r) => r.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={vStyles.strip}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[vStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.85}
            onPress={() => router.push(`/reels-viewer?startIndex=${index}` as never)}
          >
            {/* Dark video placeholder */}
            <View style={vStyles.thumb}>
              <View style={vStyles.thumbBg} />
              {/* Play overlay */}
              <View style={vStyles.playOverlay}>
                <View style={vStyles.playCircle}>
                  <Image source={APP_ICON} style={vStyles.playIcon} resizeMode="cover" />
                </View>
                <Text style={vStyles.playLabel}>Play</Text>
              </View>
              {/* Username badge */}
              <View style={vStyles.userBadge}>
                {item.profilePhoto ? (
                  <Image source={{ uri: item.profilePhoto }} style={vStyles.avatar} resizeMode="cover" />
                ) : (
                  <View style={[vStyles.avatar, { backgroundColor: "#FF3B3B", alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" }}>
                      {(item.username ?? "?")[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={vStyles.username} numberOfLines={1}>@{item.username}</Text>
              </View>
            </View>
            {/* Caption */}
            {!!item.caption && (
              <Text style={[vStyles.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.caption}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const vStyles = StyleSheet.create({
  section:       { marginTop: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle:  { fontFamily: "Inter_700Bold", fontSize: 16 },
  seeAll:        { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  strip:         { paddingHorizontal: 16, gap: 10 },
  loadingRow:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  loadingTxt:    { fontFamily: "Inter_400Regular", fontSize: 13 },

  card:          { width: 120, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  thumb:         { width: "100%", height: 180, backgroundColor: "#111", position: "relative" },
  thumbBg:       { ...StyleSheet.absoluteFillObject, backgroundColor: "#1a0000" },
  playOverlay:   { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 6 },
  playCircle:    { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,59,59,0.85)", alignItems: "center", justifyContent: "center" },
  playIcon:      { width: 24, height: 24, borderRadius: 6 },
  playLabel:     { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff" },
  userBadge:     { position: "absolute", bottom: 6, left: 6, right: 6, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 3 },
  avatar:        { width: 16, height: 16, borderRadius: 8 },
  username:      { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#fff", flex: 1 },
  caption:       { fontFamily: "Inter_400Regular", fontSize: 10, lineHeight: 14, padding: 7 },
});

const APP_ICON = require("@/assets/images/icon.png");
const HEADER_HEIGHT = 60;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState<CategoryId | "all">("all");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentPost, setCommentPost] = useState<PostData | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    setLoading(true);
    const base = collection(db, "posts");
    const q =
      activeCategory === "all"
        ? query(base, orderBy("createdAt", "desc"), limit(30))
        : query(base, where("category", "==", activeCategory), limit(30));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw = snap.docs.map((d) => ({
          ...(d.data() as Omit<PostData, "id">),
          id: d.id,
        }));
        const data =
          activeCategory === "all"
            ? raw
            : raw.sort((a, b) => (b.createdAt as number) - (a.createdAt as number));
        setPosts(data);
        setLoading(false);
        setRefreshing(false);
      },
      () => {
        setLoading(false);
        setRefreshing(false);
      }
    );
    return unsub;
  }, [activeCategory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: topPad,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.logoRow}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Scam Alert
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push("/stories" as never)}
              style={[styles.iconBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            >
              <Image source={APP_ICON} style={styles.headerBtnIcon} resizeMode="cover" />
              <Text style={[styles.iconBtnLabel, { color: colors.textSecondary }]}>Stories</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/chatbot" as never)}
              style={[styles.iconBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            >
              <Image source={APP_ICON} style={styles.headerBtnIcon} resizeMode="cover" />
              <Text style={[styles.iconBtnLabel, { color: colors.textSecondary }]}>AI Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/scam-checker" as never)}
              style={[styles.iconBtn, { backgroundColor: colors.primary + "20", borderWidth: 1, borderColor: colors.primary + "40" }]}
            >
              <Image source={APP_ICON} style={styles.headerBtnIcon} resizeMode="cover" />
              <Text style={[styles.iconBtnLabel, { color: colors.primary }]}>Checker</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/recording-studio" as never)}
              style={[styles.iconBtn, { backgroundColor: "#00FF8818", borderWidth: 1, borderColor: "#00FF8830" }]}
            >
              <Text style={{ fontSize: 13 }}>🎵</Text>
              <Text style={[styles.iconBtnLabel, { color: "#00FF88" }]}>Studio</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          <CategoryPill
            categoryId="all"
            label="All"
            isSelected={activeCategory === "all"}
            onPress={() => setActiveCategory("all")}
          />
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              categoryId={cat.id}
              isSelected={activeCategory === cat.id}
              onPress={() => setActiveCategory(cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      <SmartBanner />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.centered}>
          <Image source={APP_ICON} style={styles.emptyIcon} resizeMode="cover" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No posts yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Be the first to post a scam alert!
          </Text>
          <TouchableOpacity
            style={[styles.postBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/create" as never)}
          >
            <Text style={styles.postBtnText}>Create Post</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              {activeCategory === "all" && (
                <>
                  <InvisibleWarBanner />
                  <VideoFeedStrip />
                  <ScamOfTheDay />
                  <LiveScamCounter />
                  <TrendingScamsToday />
                  <ScamRadar alertLevel="medium" count={0} />
                  <ActivePoll />
                  <NearbyAlerts />
                  <TrendingCarousel />
                </>
              )}
              <FollowSuggestions />
            </>
          }
          renderItem={({ item, index }) => (
            <View style={{ paddingHorizontal: 12, marginTop: index === 0 ? 12 : 0 }}>
              <PostCard
                post={item}
                onComment={() => setCommentPost(item)}
                onReport={() => setReportPostId(item.id)}
              />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!posts.length}
        />
      )}

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
      <DailyBriefingModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: HEADER_HEIGHT,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogoCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 2,
    minWidth: 52,
  },
  iconBtnLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 0.2,
  },
  headerBtnIcon: { width: 16, height: 16, borderRadius: 4 },
  emptyIcon: { width: 52, height: 52, borderRadius: 14 },
  categories: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  list: {
    padding: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginTop: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  postBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  postBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
