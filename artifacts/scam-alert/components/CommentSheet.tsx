import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
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
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/notifications";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "./UserAvatar";
import { formatTimeAgo, generateId } from "@/lib/utils";

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  text: string;
  createdAt: number;
}

interface Props {
  visible: boolean;
  postId: string;
  onClose: () => void;
}

export function CommentSheet({ visible, postId, onClose }: Props) {
  const colors = useColors();
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible || !postId) return;
    setFetching(true);
    const q = query(
      collection(db, "posts", postId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        ...(d.data() as Omit<Comment, "id">),
        id: d.id,
      }));
      setComments(data);
      setFetching(false);
    });
    return unsub;
  }, [visible, postId]);

  const handleSend = async () => {
    if (!text.trim() || !user || !profile) return;
    setLoading(true);
    const newComment: Omit<Comment, "id"> = {
      postId,
      authorId: user.uid,
      authorName: profile.username,
      authorAvatar: profile.profilePhoto,
      text: text.trim(),
      createdAt: Date.now(),
    };
    try {
      await addDoc(collection(db, "posts", postId, "comments"), {
        ...newComment,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", postId), {
        commentCount: increment(1),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const postSnap = await getDoc(doc(db, "posts", postId));
      if (postSnap.exists()) {
        const authorId = postSnap.data()?.authorId as string | undefined;
        if (authorId && authorId !== user.uid) {
          sendPushNotification(
            authorId,
            "💬 New Comment",
            `${profile.username}: "${text.trim().substring(0, 60)}"`,
            { type: "comment", postId }
          );
        }
      }
      setText("");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <Text style={[styles.title, { color: colors.text }]}>Comments</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {fetching ? (
          <ActivityIndicator color={colors.primary} style={{ margin: 40 }} />
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="message-circle" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No comments yet. Be first!
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <UserAvatar
                  uri={item.authorAvatar}
                  name={item.authorName}
                  size={32}
                />
                <View
                  style={[
                    styles.bubble,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.commenterName, { color: colors.primary }]}>
                    {item.authorName}
                  </Text>
                  <Text style={[styles.commentText, { color: colors.text }]}>
                    {item.text}
                  </Text>
                  <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                    {formatTimeAgo(item.createdAt)}
                  </Text>
                </View>
              </View>
            )}
          />
        )}

        <View
          style={[
            styles.inputRow,
            { borderTopColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <UserAvatar
            uri={profile?.profilePhoto}
            name={profile?.username || "?"}
            size={32}
          />
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
            ]}
            placeholder="Write a comment..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
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
              <Feather name="send" size={16} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    height: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  bubble: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },
  commenterName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  commentText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 19,
  },
  commentTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
