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
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  increment,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/notifications";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { formatTimeAgo } from "@/lib/utils";
import { VoiceNoteRecorder, VoiceNotePlayer } from "@/components/VoiceNote";

const APP_ICON = require("@/assets/images/icon.png");

interface Message {
  id: string;
  senderId: string;
  text: string;
  type?: "text" | "voice";
  voiceUri?: string;
  voiceDuration?: number;
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
  const [showVoice, setShowVoice] = useState(false);

  const otherId = chatMeta?.participants.find((p) => p !== user?.uid) ?? "";
  const otherName = chatMeta?.participantNames[otherId] ?? "User";
  const otherAvatar = chatMeta?.participantAvatars[otherId] ?? null;

  useEffect(() => {
    if (!id || !user) return;
    getDoc(doc(db, "chats", id)).then((snap) => {
      if (snap.exists()) setChatMeta(snap.data() as ChatMeta);
    });
    // Clear unread count for this user when they open the chat
    updateDoc(doc(db, "chats", id), {
      [`unreadCounts.${user.uid}`]: 0,
    }).catch(() => {});
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
  }, [id, user]);

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
        ...(otherId ? { [`unreadCounts.${otherId}`]: increment(1) } : {}),
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

  const handleVoiceSend = async (uri: string, durationMs: number) => {
    if (!user || !id) return;
    setShowVoice(false);
    setSending(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response as Blob);
        xhr.onerror = () => reject(new Error("Failed to read voice file."));
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
      });
      const storageRef = ref(storage, `voice/${id}/${user.uid}/${Date.now()}.m4a`);
      await uploadBytes(storageRef, blob);
      const voiceUri = await getDownloadURL(storageRef);
      await addDoc(collection(db, "chats", id, "messages"), {
        senderId: user.uid,
        text: "🎤 Voice note",
        type: "voice",
        voiceUri,
        voiceDuration: durationMs,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "chats", id), {
        lastMessage: "🎤 Voice note",
        lastMessageAt: Date.now(),
        ...(otherId ? { [`unreadCounts.${otherId}`]: increment(1) } : {}),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setSending(false);
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
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Image source={APP_ICON} style={{ width: 22, height: 22, borderRadius: 6 }} resizeMode="cover" />
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.text }}>Back</Text>
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
                  {item.type === "voice" && item.voiceUri ? (
                    <VoiceNotePlayer
                      uri={item.voiceUri}
                      durationMs={item.voiceDuration ?? 0}
                      isMine={isMe}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isMe ? "#fff" : colors.text },
                      ]}
                    >
                      {item.text}
                    </Text>
                  )}
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
        {showVoice ? null : (
          <>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowVoice(true); }}
              style={[styles.micBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Image source={APP_ICON} style={{ width: 18, height: 18, borderRadius: 5 }} resizeMode="cover" />
            </TouchableOpacity>
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
              <Image source={APP_ICON} style={{ width: 18, height: 18, borderRadius: 5 }} resizeMode="cover" />
            </TouchableOpacity>
          </>
        )}
      </View>
      {showVoice && (
        <VoiceNoteRecorder
          onSend={handleVoiceSend}
          onCancel={() => setShowVoice(false)}
        />
      )}
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
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
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
