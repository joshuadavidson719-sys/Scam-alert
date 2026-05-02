import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { CATEGORIES, type CategoryId } from "@/context/AuthContext";
import { router } from "expo-router";
import { UserAvatar } from "@/components/UserAvatar";
import { CategoryPill } from "@/components/CategoryPill";
import { ScamStatsChart } from "@/components/ScamStatsChart";
import { formatTimeAgo } from "@/lib/utils";
import type { PostData } from "@/components/PostCard";

interface UserResult {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string | null;
  bio?: string;
  followerCount?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  "scam-alert": "#FF3B3B",
  news: "#3B82F6",
  motivation: "#F59E0B",
  health: "#22C55E",
  finance: "#8B5CF6",
  "crime-awareness": "#EF4444",
  technology: "#06B6D4",
  education: "#F97316",
  entertainment: "#EC4899",
};

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [searching, setSearching] = useState(false);
  const [postResults, setPostResults] = useState<PostData[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Fetch category post counts once
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const counts: Record<string, number> = {};
        await Promise.all(
          CATEGORIES.map(async (cat) => {
            try {
              const snap = await getCountFromServer(query(collection(db, "posts")));
              counts[cat.id] = snap.data().count;
            } catch {
              counts[cat.id] = 0;
            }
          })
        );
        setCategoryCounts(counts);
      } catch {
        // ignore
      } finally {
        setCountsLoading(false);
      }
    };
    fetchCounts();
  }, []);

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setPostResults([]);
      setUserResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const lower = term.toLowerCase();
    try {
      const [postsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(80))),
        getDocs(query(collection(db, "users"), orderBy("displayName"), limit(60))),
      ]);

      const posts = postsSnap.docs
        .map((d) => ({ ...(d.data() as Omit<PostData, "id">), id: d.id }))
        .filter(
          (p) =>
            p.title?.toLowerCase().includes(lower) ||
            p.description?.toLowerCase().includes(lower) ||
            p.category?.toLowerCase().includes(lower) ||
            p.authorName?.toLowerCase().includes(lower)
        )
        .slice(0, 20);

      const users = usersSnap.docs
        .map((d) => ({ uid: d.id, ...(d.data() as Omit<UserResult, "uid">) }))
        .filter(
          (u) =>
            u.displayName?.toLowerCase().includes(lower) ||
            u.username?.toLowerCase().includes(lower) ||
            u.bio?.toLowerCase().includes(lower)
        )
        .slice(0, 8);

      setPostResults(posts);
      setUserResults(users);
    } catch {
      setPostResults([]);
      setUserResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      setPostResults([]);
      setUserResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => doSearch(search), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, doSearch]);

  const clearSearch = () => {
    setSearch("");
    setIsActive(false);
    setPostResults([]);
    setUserResults([]);
    inputRef.current?.blur();
  };

  // ── Category tile ────────────────────────────────────
  const renderCategory = ({ item }: { item: (typeof CATEGORIES)[0] }) => {
    const color = CATEGORY_COLORS[item.id] ?? colors.primary;
    return (
      <TouchableOpacity
        style={[styles.catCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/(tabs)/" as never)}
        activeOpacity={0.8}
      >
        <View style={[styles.catIcon, { backgroundColor: color + "20" }]}>
          <Feather name={item.icon as keyof typeof Feather.glyphMap} size={22} color={color} />
        </View>
        <View style={styles.catContent}>
          <Text style={[styles.catTitle, { color: colors.text }]}>{item.label}</Text>
          <Text style={[styles.catCount, { color: colors.textMuted }]}>
            {countsLoading ? "..." : `${categoryCounts[item.id] ?? 0} posts`}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  // ── User result row ──────────────────────────────────
  const renderUser = (user: UserResult) => (
    <TouchableOpacity
      key={user.uid}
      style={[styles.userRow, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/user/${user.uid}` as never)}
      activeOpacity={0.7}
    >
      <UserAvatar uri={user.photoURL} name={user.displayName} size={44} />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>{user.displayName}</Text>
        {user.username ? (
          <Text style={[styles.userHandle, { color: colors.textMuted }]}>@{user.username}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );

  // ── Post result row ──────────────────────────────────
  const renderPost = (post: PostData) => {
    const color = CATEGORY_COLORS[post.category] ?? colors.primary;
    return (
      <TouchableOpacity
        key={post.id}
        style={[styles.postRow, { borderBottomColor: colors.border }]}
        onPress={() => router.push(`/post/${post.id}` as never)}
        activeOpacity={0.7}
      >
        <View style={[styles.postCatDot, { backgroundColor: color }]} />
        <View style={styles.postInfo}>
          <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>
            {post.title}
          </Text>
          <View style={styles.postMeta}>
            <CategoryPill category={post.category} />
            <Text style={[styles.postAuthor, { color: colors.textMuted }]}>
              {" · "}{post.authorName}{" · "}{formatTimeAgo(post.createdAt)}
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  // ── Empty search state ───────────────────────────────
  const noResults = !searching && search.trim() && postResults.length === 0 && userResults.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: topPad }]}>
        <Text style={[styles.title, { color: colors.text }]}>Explore</Text>
        {/* Search bar */}
        <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.textMuted} style={{ marginLeft: 2 }} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search posts, users, categories..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setIsActive(true)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator size="small" color={colors.primary} />}
          {search.length > 0 && !searching && (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          {isActive && !search && (
            <TouchableOpacity onPress={clearSearch}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Search results ─────────────────────────────── */}
      {isActive && search.trim() ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={() => (
            <View>
              {noResults ? (
                <View style={styles.emptyState}>
                  <Feather name="search" size={40} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No results found</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    Try a different keyword or browse by category
                  </Text>
                </View>
              ) : (
                <>
                  {/* Users section */}
                  {userResults.length > 0 && (
                    <View>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted, borderBottomColor: colors.border }]}>
                        PEOPLE
                      </Text>
                      {userResults.map(renderUser)}
                    </View>
                  )}
                  {/* Posts section */}
                  {postResults.length > 0 && (
                    <View>
                      <Text style={[styles.sectionLabel, { color: colors.textMuted, borderBottomColor: colors.border }]}>
                        POSTS
                      </Text>
                      {postResults.map(renderPost)}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        />
      ) : (
        /* ── Browse view (idle) ──────────────────────── */
        <FlatList
          data={CATEGORIES}
          keyExtractor={(item) => item.id}
          renderItem={renderCategory}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={() => (
            <>
              {/* AI Checker banner */}
              <TouchableOpacity
                style={[styles.aiBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
                onPress={() => router.push("/scam-checker" as never)}
                activeOpacity={0.85}
              >
                <View style={[styles.aiIconBox, { backgroundColor: colors.primary }]}>
                  <Feather name="shield" size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aiTitle, { color: colors.text }]}>AI Scam Checker</Text>
                  <Text style={[styles.aiDesc, { color: colors.textSecondary }]}>
                    Paste a suspicious message — our AI will analyze it instantly
                  </Text>
                </View>
                <View style={[styles.aiArrow, { backgroundColor: colors.primary }]}>
                  <Feather name="arrow-right" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              {/* Scam statistics chart */}
              <ScamStatsChart />
              <Text style={[styles.browseLabel, { color: colors.textMuted }]}>BROWSE BY CATEGORY</Text>
            </>
          )}
          contentContainerStyle={[styles.catList, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    padding: 0,
  },
  cancelText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  browseLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    marginHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  // Category browse
  catList: { padding: 14, gap: 0 },
  catCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  catIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  catContent: { flex: 1 },
  catTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  catCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  // AI banner
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  aiIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  aiDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  aiArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  // Search results
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userInfo: { flex: 1 },
  userName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  userHandle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 1,
  },
  postRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  postCatDot: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  postInfo: { flex: 1 },
  postTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  postAuthor: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
