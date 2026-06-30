import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
} from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth, type UserProfile } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { PostCard, type PostData } from "@/components/PostCard";
import { CommentSheet } from "@/components/CommentSheet";
import { ReportModal } from "@/components/ReportModal";

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [commentPost, setCommentPost] = useState<PostData | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

  const isMe = user?.uid === id;

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "users", id), (snap) => {
      if (snap.exists()) {
        const u = snap.data() as UserProfile;
        setTargetUser(u);
        setFollowing(!!user && (u.followers ?? []).includes(user.uid));
      }
      setLoading(false);
    });
    return unsub;
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "posts"),
      where("authorId", "==", id),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setPosts(
        snap.docs.map((d) => ({
          ...(d.data() as Omit<PostData, "id">),
          id: d.id,
        }))
      );
    });
    return unsub;
  }, [id]);

  const handleFollow = async () => {
    if (!user || !targetUser || followLoading) return;
    setFollowLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const targetRef = doc(db, "users", id);
      const myRef = doc(db, "users", user.uid);
      if (following) {
        await updateDoc(targetRef, { followers: arrayRemove(user.uid) });
        await updateDoc(myRef, { following: arrayRemove(id) });
      } else {
        await updateDoc(targetRef, { followers: arrayUnion(user.uid) });
        await updateDoc(myRef, { following: arrayUnion(id) });
      }
      refreshProfile();
    } catch {
      Alert.alert("Error", "Could not update follow. Please try again.");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!user || !targetUser) return;
    const chatId = [user.uid, id].sort().join("_");
    await setDoc(
      doc(db, "chats", chatId),
      {
        participants: [user.uid, id],
        participantNames: {
          [user.uid]: myProfile?.username ?? "Me",
          [id]: targetUser.username,
        },
        participantAvatars: {
          [user.uid]: myProfile?.profilePhoto ?? null,
          [id]: targetUser.profilePhoto ?? null,
        },
        lastMessage: "",
        lastMessageAt: Date.now(),
      },
      { merge: true }
    );
    router.push(`/chat/${chatId}` as never);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!targetUser) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View
              style={[
                styles.navBar,
                { paddingTop: insets.top + 8, borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity onPress={() => router.back()}>
                <Feather name="arrow-left" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>
                {targetUser.username}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.profileSection}>
              <UserAvatar uri={targetUser.profilePhoto} name={targetUser.username} size={84} />
              <Text style={[styles.username, { color: colors.text }]}>{targetUser.username}</Text>
              <Text style={[styles.niche, { color: colors.primary }]}>
                {targetUser.niche || "Scam Alert Community"}
              </Text>
              {targetUser.bio ? (
                <Text style={[styles.bio, { color: colors.textSecondary }]}>{targetUser.bio}</Text>
              ) : null}

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>{posts.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Posts</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>
                    {targetUser.followers?.length ?? 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.text }]}>
                    {targetUser.following?.length ?? 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
                </View>
              </View>

              {!isMe && (
                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      {
                        backgroundColor: following ? colors.card : "#FF3B3B",
                        borderColor: following ? colors.border : "#FF3B3B",
                        opacity: followLoading ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color={following ? colors.text : "#fff"} />
                    ) : (
                      <Text
                        style={[
                          styles.followBtnText,
                          { color: following ? colors.text : "#fff" },
                        ]}
                      >
                        {following ? "✓ Following" : "Follow"}
                      </Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.msgBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                    onPress={handleMessage}
                  >
                    <Feather name="message-circle" size={16} color={colors.text} />
                    <Text style={[styles.msgBtnText, { color: colors.text }]}>Message</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={[styles.postsHeader, { color: colors.text, borderBottomColor: colors.border }]}>
              Posts
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 12 }}>
            <PostCard
              post={item}
              onComment={() => setCommentPost(item)}
              onReport={() => setReportPostId(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Feather name="file-text" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No posts yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      />

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
  profileSection: {
    alignItems: "center",
    padding: 20,
    gap: 6,
  },
  username: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginTop: 8,
  },
  niche: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    marginTop: 12,
  },
  stat: { alignItems: "center", gap: 2 },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 20 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  statDivider: { width: 1, height: 28 },
  actionBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  followBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 100,
    alignItems: "center",
  },
  followBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  msgBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  postsHeader: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  emptyPosts: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});
