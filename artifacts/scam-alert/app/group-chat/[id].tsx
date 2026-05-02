import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, router } from "expo-router";
import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";
import { formatTimeAgo } from "@/lib/utils";

interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  text: string;
  createdAt: number;
}

interface GroupChat {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string | null>;
  lastMessage: string;
  lastMessageAt: number;
}

export default function GroupChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [chat, setChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "groupChats", id), (snap) => {
      if (snap.exists()) setChat({ ...(snap.data() as Omit<GroupChat, "id">), id: snap.id });
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "groupChats", id, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ ...(d.data() as Omit<GroupMessage, "id">), id: d.id }));
      setMessages(data);
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [id]);

  const sendMessage = async () => {
    if (!text.trim() || !user || !profile || !id) return;
    const trimmed = text.trim();
    setText("");
    setSending(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const now = Date.now();
      await addDoc(collection(db, "groupChats", id, "messages"), {
        senderId: user.uid,
        senderName: profile.username,
        senderAvatar: profile.profilePhoto ?? null,
        text: trimmed,
        createdAt: now,
      });
      await updateDoc(doc(db, "groupChats", id), {
        lastMessage: trimmed,
        lastMessageAt: now,
      });
    } catch {
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const isMe = (msg: GroupMessage) => msg.senderId === user?.uid;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.groupIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="users" size={18} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>{chat?.name ?? "Group"}</Text>
            <Text style={[styles.memberCount, { color: colors.textMuted }]}>{chat?.participants.length ?? 0} members</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push(`/group-info/${id}` as never)}>
          <Feather name="info" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: insets.bottom + 80 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const mine = isMe(item);
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showAvatar = !mine && (!prevMsg || prevMsg.senderId !== item.senderId);
          return (
            <View style={[styles.msgRow, mine ? styles.msgRowMe : styles.msgRowThem]}>
              {!mine && (
                <View style={{ width: 32 }}>
                  {showAvatar && <UserAvatar uri={item.senderAvatar} name={item.senderName} size={32} />}
                </View>
              )}
              <View style={{ maxWidth: "75%" }}>
                {!mine && showAvatar && (
                  <Text style={[styles.senderName, { color: colors.primary }]}>{item.senderName}</Text>
                )}
                <View style={[styles.bubble, mine ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.bubbleText, { color: mine ? "#fff" : colors.text }]}>{item.text}</Text>
                  <Text style={[styles.bubbleTime, { color: mine ? "rgba(255,255,255,0.7)" : colors.textMuted }]}>
                    {formatTimeAgo(item.createdAt)}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Input */}
      <View style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8, backgroundColor: colors.background }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Message..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
        >
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  groupIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  groupName: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  memberCount: { fontFamily: "Inter_400Regular", fontSize: 12 },
  msgRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowThem: { justifyContent: "flex-start" },
  senderName: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginBottom: 4, marginLeft: 2 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontFamily: "Inter_400Regular", fontSize: 10, alignSelf: "flex-end" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
