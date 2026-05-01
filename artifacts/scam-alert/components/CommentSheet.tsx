import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  increment,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { router } from "expo-router";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/notifications";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "./UserAvatar";
import { formatTimeAgo, generateId } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  text: string;
  createdAt: number;
  optimistic?: boolean; // local-only flag
}

interface Props {
  visible: boolean;
  postId: string;
  postAuthorId?: string;    // to show "Author" badge
  postTitle?: string;       // to show post context in header
  onClose: () => void;
}

const MAX_CHARS = 500;

// ── Comment row ───────────────────────────────────────────────────────────────
const CommentRow = React.memo(function CommentRow({
  item,
  postAuthorId,
  onReply,
  colors,
}: {
  item: Comment;
  postAuthorId?: string;
  onReply: (name: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const isAuthor = postAuthorId && item.authorId === postAuthorId;
  const fadeAnim = useRef(new Animated.Value(item.optimistic ? 0.5 : 1)).current;

  useEffect(() => {
    if (item.optimistic) return;
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [item.optimistic]);

  return (
    <Animated.View style={[styles.commentRow, { opacity: fadeAnim }]}>
      {/* Avatar — taps to profile */}
      <TouchableOpacity
        onPress={() => {
          router.push(`/user/${item.authorId}` as never);
        }}
        activeOpacity={0.8}
      >
        <UserAvatar uri={item.authorAvatar} name={item.authorName} size={34} />
      </TouchableOpacity>

      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.card,
            borderColor: isAuthor ? colors.primary + "50" : colors.border,
            borderWidth: isAuthor ? 1.5 : 1,
          },
        ]}
      >
        {/* Name row */}
        <View style={styles.nameLine}>
          <TouchableOpacity
            onPress={() => router.push(`/user/${item.authorId}` as never)}
            activeOpacity={0.7}
          >
            <Text style={[styles.commenterName, { color: colors.primary }]}>
              {item.authorName}
            </Text>
          </TouchableOpacity>
          {isAuthor && (
            <View style={[styles.authorChip, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.authorChipText, { color: colors.primary }]}>Author</Text>
            </View>
          )}
          <Text style={[styles.commentTime, { color: colors.textMuted }]}>
            · {formatTimeAgo(item.createdAt)}
          </Text>
        </View>

        {/* Body */}
        <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>

        {/* Reply button */}
        <TouchableOpacity
          onPress={() => onReply(item.authorName)}
          style={styles.replyBtn}
          hitSlop={{ top: 6, bottom: 6 }}
        >
          <Text style={[styles.replyText, { color: colors.textMuted }]}>Reply</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

// ── Main sheet ────────────────────────────────────────────────────────────────
export function CommentSheet({ visible, postId, postAuthorId, postTitle, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  // Live listener
  useEffect(() => {
    if (!visible || !postId) return;
    setFetching(true);
    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: Comment[] = snap.docs.map((d) => ({
        ...(d.data() as Omit<Comment, "id">),
        id: d.id,
        optimistic: false,
      }));
      setComments(data);
      setFetching(false);
    });
    return unsub;
  }, [visible, postId]);

  // Auto-focus + scroll to bottom when sheet opens
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      if (comments.length > 0) {
        listRef.current?.scrollToEnd({ animated: false });
      }
    }, 350); // wait for modal animation
    return () => clearTimeout(t);
  }, [visible]);

  // Scroll to bottom whenever new comments arrive
  useEffect(() => {
    if (comments.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [comments.length]);

  const handleReply = useCallback((name: string) => {
    setText((prev) => {
      const mention = `@${name} `;
      return prev.includes(mention) ? prev : mention + prev;
    });
    inputRef.current?.focus();
    Haptics.selectionAsync();
  }, []);

  const handleSend = async () => {
    if (!text.trim() || !user || !profile) return;
    const trimmed = text.trim();

    // Optimistic insert
    const optimisticId = generateId();
    const optimistic: Comment = {
      id: optimisticId,
      postId,
      authorId: user.uid,
      authorName: profile.username,
      authorAvatar: profile.profilePhoto,
      text: trimmed,
      createdAt: Date.now(),
      optimistic: true,
    };
    setComments((prev) => [...prev, optimistic]);
    setText("");
    setLoading(true);
    listRef.current?.scrollToEnd({ animated: true });

    try {
      await addDoc(collection(db, "posts", postId, "comments"), {
        postId,
        authorId: user.uid,
        authorName: profile.username,
        authorAvatar: profile.profilePhoto,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", postId), {
        commentCount: increment(1),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Notify post author
      const snap = await getDoc(doc(db, "posts", postId));
      if (snap.exists()) {
        const pd = snap.data();
        const authorId = pd?.authorId as string | undefined;
        const pTitle = pd?.title as string | undefined;
        if (authorId && authorId !== user.uid) {
          sendPushNotification(
            authorId,
            "💬 New Comment",
            `${profile.username}: "${trimmed.substring(0, 60)}"`,
            {
              type: "comment",
              postId,
              postTitle: pTitle ?? "",
              actorId: user.uid,
              actorName: profile.username ?? "Someone",
              actorAvatar: profile.profilePhoto ?? "",
            }
          );
        }
      }
    } catch {
      // Roll back optimistic comment on failure
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setText(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const charsLeft = MAX_CHARS - text.length;
  const nearLimit = charsLeft <= 60;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Dark semi-opaque backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        {/* Header */}
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: colors.text }]}>Comments</Text>
            {!fetching && (
              <View style={[styles.countChip, { backgroundColor: colors.muted }]}>
                <Text style={[styles.countText, { color: colors.textMuted }]}>
                  {comments.length}
                </Text>
              </View>
            )}
          </View>
          {postTitle && (
            <Text style={[styles.postContext, { color: colors.textMuted }]} numberOfLines={1}>
              on "{postTitle}"
            </Text>
          )}
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Comment list */}
        {fetching ? (
          <ActivityIndicator color={colors.primary} style={{ margin: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={comments}
            keyExtractor={(c) => c.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="message-circle" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No comments yet
                </Text>
                <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
                  Be the first to share your thoughts.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <CommentRow
                item={item}
                postAuthorId={postAuthorId}
                onReply={handleReply}
                colors={colors}
              />
            )}
          />
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputRow,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16,
            },
          ]}
        >
          <UserAvatar
            uri={profile?.profilePhoto}
            name={profile?.username || "?"}
            size={32}
          />
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
              ]}
              placeholder="Write a comment…"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={MAX_CHARS}
              onSubmitEditing={handleSend}
            />
            {nearLimit && (
              <Text
                style={[
                  styles.charCounter,
                  { color: charsLeft <= 20 ? "#EF4444" : colors.textMuted },
                ]}
              >
                {charsLeft}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || loading}
            style={[
              styles.sendBtn,
              { backgroundColor: text.trim() ? colors.primary : colors.muted },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={15} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    height: "78%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  countChip: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  postContext: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flex: 1,
    textAlign: "right",
    marginRight: 4,
  },
  listContent: {
    padding: 14,
    paddingBottom: 8,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  bubble: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    gap: 3,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  commenterName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  authorChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  authorChipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.3,
  },
  commentTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  commentText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  replyBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  replyText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
  },
  inputWrap: {
    flex: 1,
    position: "relative",
  },
  input: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    paddingRight: 44,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    maxHeight: 110,
    lineHeight: 20,
  },
  charCounter: {
    position: "absolute",
    bottom: 9,
    right: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 1,
  },
});
