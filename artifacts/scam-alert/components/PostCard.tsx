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
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { doc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc } from "firebase/firestore";
import { ScamVoteBar } from "./ScamVoteBar";
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
  scamVotes?: string[];
  notScamVotes?: string[];
}

interface Props {
  post: PostData;
  onComment?: () => void;
  onReport?: () => void;
  onDelete?: (id: string) => void;
}

const REACTIONS = [
  { emoji: "🌹", key: "rose",    color: "#FF3B3B" },
  { emoji: "❤️",  key: "heart",   color: "#FF6B6B" },
  { emoji: "🐱",  key: "cat",     color: "#F59E0B" },
  { emoji: "🐶",  key: "dog",     color: "#10B981" },
  { emoji: "🔥",  key: "fire",    color: "#F97316" },
  { emoji: "😱",  key: "shocked", color: "#8B5CF6" },
  { emoji: "😡",  key: "angry",   color: "#EF4444" },
  { emoji: "💪",  key: "strong",  color: "#3B82F6" },
];

function ActionPill({
  emoji,
  label,
  count,
  active,
  activeColor,
  bgColor,
  onPress,
}: {
  emoji: string;
  label?: string;
  count?: number | string;
  active?: boolean;
  activeColor: string;
  bgColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pill,
        { backgroundColor: active ? activeColor + "22" : bgColor },
        active && { borderColor: activeColor + "66", borderWidth: 1 },
      ]}
    >
      <Text style={styles.pillEmoji}>{emoji}</Text>
      {(count !== undefined && count !== "" && count !== 0) && (
        <Text style={[styles.pillCount, { color: active ? activeColor : "#9CA3AF" }]}>
          {count}
        </Text>
      )}
      {label && !count && (
        <Text style={[styles.pillCount, { color: active ? activeColor : "#9CA3AF" }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

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
          "🌹 New Like",
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
        { dialogTitle: "Share this scam alert", subject: `Scam Alert: ${post.title}` }
      );
      const didShare =
        result.action === Share.sharedAction || result.action === "sharedAction";
      if (didShare) {
        setShareCount((n) => n + 1);
        await updateDoc(doc(db, "posts", post.id), { shareCount: increment(1) });
        if (post.authorId !== user?.uid) {
          sendPushNotification(
            post.authorId,
            "📢 Someone shared your alert",
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
    } catch {}
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
  const myReaction = user
    ? REACTIONS.find((r) => (reactions[r.key] ?? []).includes(user.uid))
    : null;

  const handleMore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Edit Post", "Delete Post"], cancelButtonIndex: 0, destructiveButtonIndex: 2 },
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.authorRow}
          onPress={() => router.push(`/user/${post.authorId}` as never)}
        >
          <UserAvatar uri={post.authorAvatar} name={post.authorName} size={38} />
          <View style={styles.authorInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.authorName, { color: colors.text }]}>{post.authorName}</Text>
              {post.authorVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: "#2563EB" }]}>
                  <Feather name="check" size={8} color="#fff" />
                  <Text style={styles.verifiedText}>EXPERT</Text>
                </View>
              )}
            </View>
            <Text style={[styles.time, { color: colors.textMuted }]}>{formatTimeAgo(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <CategoryPill categoryId={post.category} size="sm" />
          {isOwner && (
            <TouchableOpacity onPress={handleMore} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.moreBtn}>
              <Feather name="more-horizontal" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <Text style={[styles.title, { color: colors.text }]}>{post.title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
        {post.description}
      </Text>

      {post.images.length > 0 && (
        <Image source={{ uri: post.images[0] }} style={[styles.image, { backgroundColor: colors.muted }]} resizeMode="cover" />
      )}

      {/* Hashtags */}
      {post.hashtags && post.hashtags.length > 0 && (
        <View style={styles.hashtagRow}>
          {post.hashtags.slice(0, 5).map((tag) => (
            <TouchableOpacity key={tag} onPress={() => router.push(`/hashtag/${tag}` as never)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <Text style={[styles.hashtag, { color: colors.primary }]}>#{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Scam verification voting */}
      <ScamVoteBar
        postId={post.id}
        scamVotes={post.scamVotes}
        notScamVotes={post.notScamVotes}
        compact
      />

      {/* Reaction picker popup */}
      {showReactions && (
        <View style={[styles.reactionPopup, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
          <Text style={[styles.reactionHint, { color: colors.textMuted }]}>React with</Text>
          <View style={styles.reactionGrid}>
            {REACTIONS.map((r) => {
              const count = (reactions[r.key] ?? []).length;
              const mine = !!user && (reactions[r.key] ?? []).includes(user.uid);
              return (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => handleReaction(r.key)}
                  style={[styles.reactionChip, { backgroundColor: mine ? r.color + "25" : colors.muted }]}
                >
                  <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                  {count > 0 && (
                    <Text style={[styles.reactionCount, { color: mine ? r.color : colors.textMuted }]}>{count}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Action row */}
      <View style={styles.actions}>
        {/* Like */}
        <ActionPill
          emoji={liked ? "🌹" : "🤍"}
          count={likeCount || undefined}
          active={liked}
          activeColor="#FF3B3B"
          bgColor={colors.muted}
          onPress={handleLike}
        />

        {/* Reactions */}
        <ActionPill
          emoji={myReaction ? myReaction.emoji : "🐱"}
          count={totalReactions || undefined}
          active={!!myReaction}
          activeColor={myReaction?.color ?? "#F59E0B"}
          bgColor={colors.muted}
          onPress={() => setShowReactions((v) => !v)}
        />

        {/* Comment */}
        <ActionPill
          emoji="💬"
          count={post.commentCount || undefined}
          active={false}
          activeColor="#3B82F6"
          bgColor={colors.muted}
          onPress={() => onComment?.()}
        />

        {/* Share */}
        <ActionPill
          emoji="📢"
          count={shareCount || undefined}
          active={false}
          activeColor="#10B981"
          bgColor={colors.muted}
          onPress={handleShare}
        />

        {/* Bookmark */}
        <ActionPill
          emoji={saved ? "🔖" : "📌"}
          active={saved}
          activeColor="#F59E0B"
          bgColor={colors.muted}
          onPress={handleBookmark}
        />

        {/* Report — only for others' posts */}
        {!isOwner && (
          <ActionPill
            emoji="🚩"
            active={false}
            activeColor="#EF4444"
            bgColor={colors.muted}
            onPress={handleReport}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
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
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  authorName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  time: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  moreBtn: { padding: 2 },
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
  image: { width: "100%", height: 200 },
  hashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  hashtag: { fontFamily: "Inter_500Medium", fontSize: 13 },

  reactionPopup: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  reactionHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reactionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  reactionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reactionEmoji: { fontSize: 20 },
  reactionCount: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  divider: { height: 1, marginHorizontal: 14, marginTop: 4 },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  pillEmoji: { fontSize: 16 },
  pillCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
