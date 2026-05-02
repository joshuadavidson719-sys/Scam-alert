import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { doc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useBookmarks } from "@/hooks/useBookmarks";
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
  authorVerified?: boolean;
  title: string;
  description: string;
  images: string[];
  category: CategoryId;
  likes: string[];
  reactions?: Record<string, string[]>;
  hashtags?: string[];
  commentCount: number;
  shareCount: number;
  reports: string[];
  createdAt: number;
}

interface Props {
  post: PostData;
  onComment?: () => void;
  onReport?: () => void;
  onDelete?: (id: string) => void;
}

const REACTIONS = [
  { emoji: "🚨", key: "alert" },
  { emoji: "😱", key: "shocked" },
  { emoji: "😡", key: "angry" },
  { emoji: "👍", key: "helpful" },
  { emoji: "💪", key: "strong" },
];

export function PostCard({ post, onComment, onReport, onDelete }: Props) {
  const colors = useColors();
  const { user, profile } = useAuth();
  const { toggle, isBookmarked } = useBookmarks();
  const [liked, setLiked] = useState(!!user && post.likes.includes(user.uid));
  const [likeCount, setLikeCount] = useState(post.likes.length);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const [saved, setSaved] = useState(isBookmarked(post.id));
  const [reactions, setReactions] = useState<Record<string, string[]>>(post.reactions ?? {});
  const [showReactions, setShowReactions] = useState(false);

  const isOwner = !!user && user.uid === post.authorId;

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
          {
            type: "like",
            postId: post.id,
            postTitle: post.title,
            actorId: user.uid,
            actorName: profile?.username ?? "Someone",
            actorAvatar: profile?.profilePhoto ?? "",
          }
        );
      }
    }
  };

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await Share.share(
        {
          title: `⚠️ Scam Alert: ${post.title}`,
          message: [
            `⚠️ SCAM ALERT`,
            ``,
            `${post.title}`,
            ``,
            post.description,
            ``,
            `— Posted by ${post.authorName} on Scam Alert`,
            `Stay informed. Stay safe.`,
          ].join("\n"),
          url: "https://scam-alert.app",
        },
        {
          dialogTitle: "Share this scam alert",
          subject: `Scam Alert: ${post.title}`,
        }
      );

      const didShare =
        result.action === Share.sharedAction ||
        result.action === "sharedAction";

      if (didShare) {
        setShareCount((n) => n + 1);
        await updateDoc(doc(db, "posts", post.id), { shareCount: increment(1) });
        if (post.authorId !== user?.uid) {
          sendPushNotification(
            post.authorId,
            "🔁 Someone shared your alert",
            `${profile?.username ?? "Someone"} shared "${post.title}" — spreading awareness!`,
            {
              type: "share",
              postId: post.id,
              postTitle: post.title,
              actorId: user?.uid ?? "",
              actorName: profile?.username ?? "Someone",
              actorAvatar: profile?.profilePhoto ?? "",
            }
          );
        }
      }
    } catch {
      // Sheet cancelled — no-op
    }
  };

  const handleBookmark = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nowSaved = await toggle(post.id);
    setSaved(nowSaved);
  };

  const handleReport = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onReport?.();
  };

  const handleReaction = async (key: string) => {
    if (!user) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowReactions(false);
    const current = reactions[key] ?? [];
    const hasReacted = current.includes(user.uid);
    const updated = hasReacted
      ? { ...reactions, [key]: current.filter((id) => id !== user.uid) }
      : { ...reactions, [key]: [...current, user.uid] };
    setReactions(updated);
    await updateDoc(doc(db, "posts", post.id), { [`reactions.${key}`]: updated[key] });
  };

  const totalReactions = Object.values(reactions).reduce((s, arr) => s + arr.length, 0);
  const myReaction = user ? REACTIONS.find((r) => (reactions[r.key] ?? []).includes(user.uid)) : null;

  const handleMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Edit Post", "Delete Post"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
        },
        (i) => {
          if (i === 1) router.push(`/edit-post/${post.id}` as never);
          else if (i === 2) confirmDelete();
        }
      );
    } else {
      Alert.alert("Post Options", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Edit Post", onPress: () => router.push(`/edit-post/${post.id}` as never) },
        { text: "Delete Post", style: "destructive", onPress: confirmDelete },
      ]);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "posts", post.id));
            onDelete?.(post.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert("Error", "Could not delete post. Please try again.");
          }
        },
      },
    ]);
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
            <View style={styles.nameRow}>
              <Text style={[styles.authorName, { color: colors.text }]}>
                {post.authorName}
              </Text>
              {post.authorVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={9} color="#fff" />
                </View>
              )}
            </View>
            <Text style={[styles.time, { color: colors.textMuted }]}>
              {formatTimeAgo(post.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <CategoryPill categoryId={post.category} size="sm" />
          {isOwner && (
            <TouchableOpacity
              onPress={handleMore}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.moreBtn}
            >
              <Feather name="more-horizontal" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
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

      {/* Hashtags */}
      {post.hashtags && post.hashtags.length > 0 && (
        <View style={styles.hashtagRow}>
          {post.hashtags.slice(0, 5).map((tag) => (
            <TouchableOpacity
              key={tag}
              onPress={() => router.push(`/hashtag/${tag}` as never)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={[styles.hashtag, { color: colors.primary }]}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Reaction picker popup */}
      {showReactions && (
        <View style={[styles.reactionPopup, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.text }]}>
          {REACTIONS.map((r) => {
            const count = (reactions[r.key] ?? []).length;
            return (
              <TouchableOpacity key={r.key} style={styles.reactionOption} onPress={() => handleReaction(r.key)}>
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                {count > 0 && <Text style={[styles.reactionCount, { color: colors.textMuted }]}>{count}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={handleLike}>
          <Feather
            name="heart"
            size={18}
            color={liked ? colors.primary : colors.textSecondary}
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

        {/* Emoji reaction button */}
        <TouchableOpacity style={styles.action} onPress={() => setShowReactions((v) => !v)}>
          <Text style={styles.reactionBtnEmoji}>{myReaction ? myReaction.emoji : "🚨"}</Text>
          {totalReactions > 0 && (
            <Text style={[styles.actionText, { color: myReaction ? colors.primary : colors.textSecondary }]}>
              {totalReactions}
            </Text>
          )}
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
            {shareCount > 0 ? shareCount : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={handleBookmark}>
          <Feather
            name="bookmark"
            size={18}
            color={saved ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>

        {!isOwner && (
          <TouchableOpacity style={styles.action} onPress={handleReport}>
            <Feather name="flag" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
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
  authorInfo: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  authorName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  time: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  moreBtn: {
    padding: 2,
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
  },
  hashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  hashtag: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  reactionPopup: {
    position: "absolute",
    bottom: 52,
    left: 14,
    flexDirection: "row",
    gap: 4,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    zIndex: 100,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
  reactionOption: {
    alignItems: "center",
    paddingHorizontal: 6,
  },
  reactionEmoji: { fontSize: 24 },
  reactionCount: { fontFamily: "Inter_500Medium", fontSize: 10, marginTop: 2 },
  reactionBtnEmoji: { fontSize: 16 },
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
    paddingHorizontal: 6,
    paddingVertical: 4,
    flex: 1,
  },
  actionText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
