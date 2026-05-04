import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { PostCard, type PostData } from "@/components/PostCard";

import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";

const APP_ICON = require("@/assets/images/icon.png");

export default function HashtagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentPost, setCommentPost] = useState<PostData | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  const normalizedTag = tag?.toLowerCase().replace(/^#/, "") ?? "";

  useEffect(() => {
    if (!normalizedTag) return;
    const q = query(
      collection(db, "posts"),
      where("hashtags", "array-contains", normalizedTag),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ ...(d.data() as Omit<PostData, "id">), id: d.id }))
        .sort((a, b) => (b.createdAt as number) - (a.createdAt as number));
      setPosts(sorted);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [normalizedTag]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={APP_ICON} style={{ width: 22, height: 22, borderRadius: 6 }} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.hashSymbol, { color: colors.primary }]}>#</Text>
          <Text style={[styles.tagName, { color: colors.text }]}>{normalizedTag}</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.tagInfo, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.postCount, { color: colors.textSecondary }]}>
          {loading ? "..." : `${posts.length} post${posts.length !== 1 ? "s" : ""}`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>🏷️</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No posts yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Be the first to post with #{normalizedTag}
          </Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/create" as never)}
          >
            <Text style={styles.createBtnText}>Create Post</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onComment={() => setCommentPost(item)}
              onReport={() => setReportPostId(item.id)}
            />
          )}
        />
      )}

      {commentPost && (
        <CommentSheet visible postId={commentPost.id} postAuthorId={commentPost.authorId} postTitle={commentPost.title} onClose={() => setCommentPost(null)} />
      )}
      {reportPostId && (
        <ReportModal visible postId={reportPostId} onClose={() => setReportPostId(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  hashSymbol: { fontFamily: "Inter_700Bold", fontSize: 24 },
  tagName: { fontFamily: "Inter_700Bold", fontSize: 22 },
  tagInfo: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  postCount: { fontFamily: "Inter_400Regular", fontSize: 13 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
  createBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  createBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
