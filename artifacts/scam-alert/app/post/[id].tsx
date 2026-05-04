import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Share,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";
import { CategoryPill } from "@/components/CategoryPill";
import { ScamVoteBar } from "@/components/ScamVoteBar";
import { formatTimeAgo } from "@/lib/utils";
import type { PostData } from "@/components/PostCard";

const APP_ICON = require("@/assets/images/icon.png");

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "posts", id), (snap) => {
      if (snap.exists()) {
        const data = { ...(snap.data() as Omit<PostData, "id">), id: snap.id };
        setPost(data);
        setLiked(!!user && data.likes.includes(user.uid));
        setLikeCount(data.likes.length);
      }
      setLoading(false);
    });
    return unsub;
  }, [id, user]);

  const handleLike = async () => {
    if (!user || !post) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ref = doc(db, "posts", post.id);
    if (liked) {
      setLiked(false);
      setLikeCount((n) => n - 1);
      await updateDoc(ref, { likes: arrayRemove(user.uid) });
    } else {
      setLiked(true);
      setLikeCount((n) => n + 1);
      await updateDoc(ref, { likes: arrayUnion(user.uid) });
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Post not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Image source={APP_ICON} style={styles.navIcon} resizeMode="cover" />
          <Text style={[{ fontFamily: "Inter_600SemiBold", fontSize: 13 }, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Post</Text>
        <TouchableOpacity
          onPress={() =>
            Share.share({ message: `🚨 ${post.title}\n\n${post.description}\n\nShared from Scam Alert` })
          }
        >
          <Image source={APP_ICON} style={styles.navIcon} resizeMode="cover" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={() => router.push(`/user/${post.authorId}` as never)}
        >
          <UserAvatar uri={post.authorAvatar} name={post.authorName} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.authorName, { color: colors.text }]}>{post.authorName}</Text>
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {formatTimeAgo(post.createdAt)}
            </Text>
          </View>
          <CategoryPill categoryId={post.category} size="sm" />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {post.description}
        </Text>

        {post.images.length > 0 && (
          <Image
            source={{ uri: post.images[0] }}
            style={[styles.image, { backgroundColor: colors.muted }]}
            resizeMode="cover"
          />
        )}

        <ScamVoteBar
          postId={post.id}
          scamVotes={post.scamVotes}
          notScamVotes={post.notScamVotes}
          compact={false}
        />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={handleLike}>
            <Text style={{ fontSize: 20 }}>{liked ? "❤️" : "🤍"}</Text>
            <Text style={[styles.actionText, { color: liked ? colors.primary : colors.textSecondary }]}>
              {likeCount} {likeCount === 1 ? "Like" : "Likes"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={() => setShowComments(true)}>
            <Text style={{ fontSize: 20 }}>💬</Text>
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>
              {post.commentCount} {post.commentCount === 1 ? "Comment" : "Comments"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.action}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setShowReport(true);
            }}
          >
            <Text style={{ fontSize: 20 }}>🚩</Text>
            <Text style={[styles.actionText, { color: colors.textMuted }]}>Report</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.disclaimerBox, { backgroundColor: colors.warning + "10", borderColor: colors.border }]}>
          <Text style={{ fontSize: 14 }}>ℹ️</Text>
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            All content is user-submitted and for awareness purposes only.
          </Text>
        </View>
      </ScrollView>

      <CommentSheet
        visible={showComments}
        postId={post.id}
        postAuthorId={post.authorId}
        postTitle={post.title}
        onClose={() => setShowComments(false)}
      />
      <ReportModal
        visible={showReport}
        postId={post.id}
        onClose={() => setShowReport(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  navIcon: { width: 22, height: 22, borderRadius: 6 },
  content: {
    padding: 16,
    gap: 12,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authorName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    lineHeight: 28,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 24,
  },
  image: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 4,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    justifyContent: "center",
  },
  actionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  disclaimerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
});
