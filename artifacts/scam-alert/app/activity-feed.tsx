import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,

} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, type UserProfile } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";

import { Feather } from "@expo/vector-icons";

type FeedItem = {
  id: string;
  type: "post" | "reel";
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  authorNiche: string;
  title?: string;
  description?: string;
  caption?: string;
  imageUrl?: string | null;
  createdAt: number;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function ActivityFeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const following: string[] = profile?.following ?? [];

  useEffect(() => {
    if (!user || following.length === 0) {
      setLoading(false);
      return;
    }

    const loadFeed = async () => {
      setLoading(true);
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < following.length; i += 30) {
          chunks.push(following.slice(i, i + 30));
        }

        const userCache: Record<string, UserProfile> = {};
        const getUser = async (uid: string): Promise<UserProfile | null> => {
          if (userCache[uid]) return userCache[uid];
          const snap = await getDoc(doc(db, "users", uid));
          if (snap.exists()) {
            userCache[uid] = snap.data() as UserProfile;
            return userCache[uid];
          }
          return null;
        };

        const [postResults, reelResults] = await Promise.all([
          Promise.all(
            chunks.map((chunk) =>
              getDocs(query(collection(db, "posts"), where("authorId", "in", chunk)))
            )
          ),
          Promise.all(
            chunks.map((chunk) =>
              getDocs(query(collection(db, "reels"), where("userId", "in", chunk)))
            )
          ),
        ]);

        const rawPosts = postResults.flatMap((snap) =>
          snap.docs.map((d) => ({ id: d.id, type: "post" as const, ...d.data() }))
        );
        const rawReels = reelResults.flatMap((snap) =>
          snap.docs.map((d) => ({
            id: d.id,
            type: "reel" as const,
            ...d.data(),
            createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
          }))
        );

        const allAuthorIds = [...new Set([
          ...rawPosts.map((p: any) => p.authorId),
          ...rawReels.map((r: any) => r.userId),
        ])];
        await Promise.all(allAuthorIds.map(getUser));

        const items: FeedItem[] = [
          ...rawPosts.map((p: any) => {
            const u = userCache[p.authorId];
            return {
              id: p.id,
              type: "post" as const,
              authorId: p.authorId,
              authorName: u?.username ?? p.authorName ?? "Unknown",
              authorPhoto: u?.profilePhoto ?? null,
              authorNiche: u?.niche ?? "",
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl ?? null,
              createdAt: typeof p.createdAt === "number" ? p.createdAt : (p.createdAt?.toMillis?.() ?? Date.now()),
            };
          }),
          ...rawReels.map((r: any) => {
            const u = userCache[r.userId];
            return {
              id: r.id,
              type: "reel" as const,
              authorId: r.userId,
              authorName: u?.username ?? r.username ?? "Unknown",
              authorPhoto: u?.profilePhoto ?? null,
              authorNiche: u?.niche ?? "",
              caption: r.caption,
              createdAt: r.createdAt,
            };
          }),
        ].sort((a, b) => b.createdAt - a.createdAt);

        setFeed(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    loadFeed();
  }, [following.join(",")]);

  const renderItem = ({ item }: { item: FeedItem }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.85}
      onPress={() => router.push(`/user/${item.authorId}` as never)}
    >
      <View style={styles.cardTop}>
        <UserAvatar uri={item.authorPhoto} name={item.authorName} size={42} />
        <View style={styles.cardMeta}>
          <View style={styles.nameRow}>
            <Text style={[styles.authorName, { color: colors.text }]}>{item.authorName}</Text>
            <View style={[styles.typePill, { backgroundColor: item.type === "reel" ? "#EC489918" : "#FF3B3B18" }]}>
              <Text style={[styles.typePillTxt, { color: item.type === "reel" ? "#EC4899" : colors.primary }]}>
                {item.type === "reel" ? "🎬 Reel" : "📄 Post"}
              </Text>
            </View>
          </View>
          {!!item.authorNiche && (
            <Text style={[styles.niche, { color: colors.primary }]}>{item.authorNiche}</Text>
          )}
          <Text style={[styles.timeAgo, { color: colors.textMuted }]}>{timeAgo(item.createdAt)}</Text>
        </View>
      </View>

      {(item.title || item.caption) && (
        <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title ?? item.caption}
        </Text>
      )}
      {!!item.description && (
        <Text style={[styles.postDesc, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.description}
        </Text>
      )}
      {!!item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.postImage, { borderColor: colors.border }]}
          resizeMode="cover"
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.text} />
          <Text style={[styles.backTxt, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Activity Feed</Text>
        <View style={{ width: 56 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingTxt, { color: colors.textMuted }]}>Loading activity…</Text>
        </View>
      ) : following.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>👥</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No one followed yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            Follow people in the community to see their posts and reels here.
          </Text>
          <TouchableOpacity
            style={[styles.discoverBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/people-to-follow" as never)}
          >
            <Text style={styles.discoverBtnTxt}>Discover People</Text>
          </TouchableOpacity>
        </View>
      ) : feed.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📭</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No activity yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            The people you follow haven't posted anything yet. Check back soon!
          </Text>
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id + item.type}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={[styles.followingBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 18 }}>👥</Text>
              <Text style={[styles.followingTxt, { color: colors.textSecondary }]}>
                Activity from <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>{following.length}</Text> people you follow
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  centered:    { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle:  { fontFamily: "Inter_600SemiBold", fontSize: 17, flex: 1, textAlign: "center" },
  backBtn:   { flexDirection: "row", alignItems: "center", gap: 6, width: 56 },
  backIcon:  { width: 22, height: 22, borderRadius: 6 },
  backTxt:   { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  list:        { paddingHorizontal: 16, paddingTop: 12, gap: 12 },

  followingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  followingTxt: { fontFamily: "Inter_400Regular", fontSize: 13 },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardTop:   { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardMeta:  { flex: 1, gap: 2 },
  nameRow:   { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  authorName:{ fontFamily: "Inter_600SemiBold", fontSize: 14 },
  typePill:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  typePillTxt:{ fontFamily: "Inter_600SemiBold", fontSize: 11 },
  niche:     { fontFamily: "Inter_400Regular", fontSize: 11 },
  timeAgo:   { fontFamily: "Inter_400Regular", fontSize: 11 },

  postTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 20 },
  postDesc:  { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  postImage: { width: "100%", height: 180, borderRadius: 10, borderWidth: 1 },

  loadingTxt:   { fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 12 },
  emptyTitle:   { fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center", marginBottom: 8 },
  emptyDesc:    { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 },
  discoverBtn:  { marginTop: 20, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  discoverBtnTxt:{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
});
