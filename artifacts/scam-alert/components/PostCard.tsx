import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "./UserAvatar";
import { CategoryPill } from "./CategoryPill";
import type { CategoryId } from "@/context/AuthContext";
import { formatTimeAgo } from "@/lib/utils";
import { sendPushNotification } from "@/lib/notifications";

export interface PostData {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  title: string;
  description: string;
  images: string[];
  category: CategoryId;
  likes: string[];
  commentCount: number;
  shareCount: number;
  reports: string[];
  createdAt: number;
}

interface Props {
  post: PostData;
  onComment?: () => void;
  onReport?: () => void;
}

export function PostCard({ post, onComment, onReport }: Props) {
  const colors = useColors();
  const { user, profile } = useAuth();
  const [liked, setLiked] = useState(
    !!user && post.likes.includes(user.uid)
  );
  const [likeCount, setLikeCount] = useState(post.likes.length);

  const handleLike = async () => {
    if (!user) return;
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
      if (post.authorId !== user.uid) {
        sendPushNotification(
          post.authorId,
          "❤️ New Like",
          `${profile?.username ?? "Someone"} liked your post: "${post.title}"`,
          { type: "like", postId: post.id }
        );
      }
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🚨 ${post.title}\n\n${post.description}\n\nShared from Scam Alert`,
      });
    } catch {
      // ignore
    }
  };

  const handleReport = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onReport?.();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => router.push(`/post/${post.id}` as never)}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={() => router.push(`/user/${post.authorId}` as never)}
        >
          <UserAvatar uri={post.authorAvatar} name={post.authorName} size={38} />
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: colors.text }]}>
              {post.authorName}
            </Text>
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {formatTimeAgo(post.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
        <CategoryPill categoryId={post.category} size="sm" />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>
      <Text
        style={[styles.description, { color: colors.textSecondary }]}
        numberOfLines={3}
      >
        {post.description}
      </Text>

      {post.images.length > 0 && (
        <Image
          source={{ uri: post.images[0] }}
          style={[styles.image, { backgroundColor: colors.muted }]}
          resizeMode="cover"
        />
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike}>
          <Feather
            name="heart"
            size={18}
            color={liked ? colors.primary : colors.textSecondary}
            style={liked && styles.likedIcon}
          />
          <Text
            style={[
              styles.actionText,
              { color: liked ? colors.primary : colors.textSecondary },
            ]}
          >
            {likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={onComment}>
          <Feather name="message-circle" size={18} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            {post.commentCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handleShare}>
          <Feather name="share-2" size={18} color={colors.textSecondary} />
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>
            Share
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handleReport}>
          <Feather name="flag" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 1,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    paddingHorizontal: 14,
    marginBottom: 6,
    lineHeight: 22,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingHorizontal: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  image: {
    width: "100%",
    height: 200,
    marginBottom: 0,
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 1,
  },
  actionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  likedIcon: {
    // visual style when liked
  },
});
