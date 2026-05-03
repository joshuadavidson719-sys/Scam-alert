import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
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
import { router } from "expo-router";

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
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Scam Alert
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push("/stories" as never)}
              style={[styles.iconBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            >
              <Feather name="camera" size={16} color={colors.textSecondary} />
              <Text style={[styles.iconBtnLabel, { color: colors.textSecondary }]}>Stories</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/chatbot" as never)}
              style={[styles.iconBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            >
              <Feather name="cpu" size={16} color={colors.textSecondary} />
              <Text style={[styles.iconBtnLabel, { color: colors.textSecondary }]}>AI Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/scam-checker" as never)}
              style={[styles.iconBtn, { backgroundColor: colors.primary + "20", borderWidth: 1, borderColor: colors.primary + "40" }]}
            >
              <Feather name="shield" size={16} color={colors.primary} />
              <Text style={[styles.iconBtnLabel, { color: colors.primary }]}>Checker</Text>
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
          <Feather name="inbox" size={48} color={colors.textMuted} />
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
  headerLogo: {
    width: 32,
    height: 32,
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
