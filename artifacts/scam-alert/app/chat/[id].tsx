import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/notifications";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { formatTimeAgo } from "@/lib/utils";

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}

interface ChatMeta {
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string | null>;
  participants: string[];
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatMeta, setChatMeta] = useState<ChatMeta | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const otherId = chatMeta?.participants.find((p) => p !== user?.uid) ?? "";
  const otherName = chatMeta?.participantNames[otherId] ?? "User";
  const otherAvatar = chatMeta?.participantAvatars[otherId] ?? null;

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "chats", id)).then((snap) => {
      if (snap.exists()) setChatMeta(snap.data() as ChatMeta);
    });
    const q = query(
      collection(db, "chats", id, "messages"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        ...(d.data() as Omit<Message, "id">),
        id: d.id,
      }));
      setMessages(data);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const handleSend = async () => {
    if (!text.trim() || !user || !id) return;
    const msgText = text.trim();
    setText("");
    setSending(true);
    try {
      await addDoc(collection(db, "chats", id, "messages"), {
        senderId: user.uid,
        text: msgText,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "chats", id), {
        lastMessage: msgText,
        lastMessageAt: Date.now(),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (otherId && chatMeta) {
        const senderName = chatMeta.participantNames[user.uid] ?? "Someone";
        sendPushNotification(
          otherId,
          `💬 ${senderName}`,
          msgText.substring(0, 100),
          { type: "message", chatId: id }
        );
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.navBar,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.navUser}>
          <UserAvatar uri={otherAvatar} name={otherName} size={34} />
          <Text style={[styles.navName, { color: colors.text }]}>{otherName}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerStyle={styles.messageList}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!!messages.length}
          renderItem={({ item }) => {
            const isMe = item.senderId === user?.uid;
            return (
              <View
                style={[
                  styles.messageRow,
                  isMe ? styles.messageRowMe : styles.messageRowThem,
                ]}
              >
                {!isMe && (
                  <UserAvatar uri={otherAvatar} name={otherName} size={28} />
                )}
                <View
                  style={[
                    styles.bubble,
                    isMe
                      ? { backgroundColor: colors.primary, alignSelf: "flex-end" }
                      : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: isMe ? "#fff" : colors.text },
                    ]}
                  >
                    {item.text}
                  </Text>
                  <Text
                    style={[
                      styles.bubbleTime,
                      { color: isMe ? "rgba(255,255,255,0.6)" : colors.textMuted },
                    ]}
                  >
                    {item.createdAt ? formatTimeAgo(item.createdAt) : ""}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>
                No messages yet. Say hello!
              </Text>
            </View>
          }
        />
      )}

      <View
        style={[
          styles.inputBar,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: text.trim() ? colors.primary : colors.muted },
          ]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navUser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "center",
  },
  navName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  messageList: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  messageRowMe: {
    justifyContent: "flex-end",
  },
  messageRowThem: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 16,
    padding: 12,
    gap: 3,
  },
  bubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    textAlign: "right",
  },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyChatText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
