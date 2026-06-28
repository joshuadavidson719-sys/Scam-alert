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
  Alert,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";
import { CategoryPill } from "@/components/CategoryPill";
import { formatTimeAgo } from "@/lib/utils";
const isVideoUri = (uri: string) => /\.(mp4|mov|webm|ogg|avi|mkv|m4v|3gp)$/i.test(uri.split("?")[0]);
import type { PostData } from "@/components/PostCard";

function VideoPlayer({ uri }: { uri: string }) {
  if (Platform.OS === "web") {
    return (
      // @ts-ignore
      <video
        src={uri}
        controls
        playsInline
        style={{
          width: "100%",
          maxHeight: 360,
          borderRadius: 12,
          backgroundColor: "#000",
          display: "block",
        }}
      />
    );
  }
  return (
    <View style={styles.videoPlaceholder}>
      <Feather name="video" size={40} color="#fff" />
      <Text style={styles.videoPlaceholderText}>Video</Text>
    </View>
  );
}

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
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
      } else {
        router.back();
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

  const handleDelete = () => {
    if (!post) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "posts", post.id));
              router.back();
            } catch {
              Alert.alert("Error", "Could not delete post. Please try again.");
            }
          },
        },
      ]
    );
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

  const isAuthor = user?.uid === post.authorId;
  const isAdmin = profile?.isAdmin === true;
  const canDelete = isAuthor || isAdmin;

  const mediaUri = post.videoUrl || (post.images.length > 0 ? post.images[0] : null);
  const isVideo = mediaUri ? (post.videoUrl ? true : isVideoUri(mediaUri)) : false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.navBar,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Post</Text>
        <View style={styles.navRight}>
          {canDelete && (
            <TouchableOpacity onPress={handleDelete} style={styles.navBtn}>
              <Feather name="trash-2" size={20} color={colors.destructive} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() =>
              Share.share({ message: `🚨 ${post.title}\n\n${post.description}\n\nShared from Scam Alert` })
            }
            style={styles.navBtn}
          >
            <Feather name="share-2" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
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

        {mediaUri && (
          isVideo ? (
            <VideoPlayer uri={mediaUri} />
          ) : (
            <Image
              source={{ uri: mediaUri }}
              style={[styles.image, { backgroundColor: colors.muted }]}
              resizeMode="cover"
            />
          )
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={handleLike}>
            <Feather
              name="heart"
              size={20}
              color={liked ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.actionText,
                { color: liked ? colors.primary : colors.textSecondary },
              ]}
            >
              {likeCount} {likeCount === 1 ? "Like" : "Likes"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={() => setShowComments(true)}>
            <Feather name="message-circle" size={20} color={colors.textSecondary} />
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
            <Feather name="flag" size={20} color={colors.textMuted} />
            <Text style={[styles.actionText, { color: colors.textMuted }]}>Report</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.disclaimerBox, { backgroundColor: colors.warning + "10", borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.textMuted} />
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
    flex: 1,
    textAlign: "center",
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navBtn: { padding: 4 },
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
  videoPlaceholder: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  videoPlaceholderText: {
    color: "#fff",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
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
