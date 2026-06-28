import React, { useState, useRef } from "react";
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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { chatWithScamBot } from "@/lib/gemini";
const APP_ICON = require("@/assets/images/icon.png");

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
}

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

const QUICK_PROMPTS = [
  "How do I spot a phishing email?",
  "What are common phone scam tactics?",
  "Is this prize winner message a scam?",
  "How do romance scams work?",
  "What should I do if I was scammed?",
];

export default function ChatbotScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Hi${profile?.username ? ` ${profile.username}` : ""}! 👋 I'm ScamBot, your AI scam prevention advisor.\n\nAsk me anything about scams, fraud, phishing, or how to protect yourself and your community.`,
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const trimmed = text.trim();
    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: Date.now().toString(), role: "user", text: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

        try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
      const replyText = await chatWithScamBot(history, trimmed);
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: replyText,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "I'm having trouble connecting. Please check your connection and try again.",
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
    
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={APP_ICON} style={styles.backIcon} resizeMode="cover" />
          <Text style={[styles.backLabel, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.botIcon, { backgroundColor: colors.primary + "20" }]}>
            <Image source={APP_ICON} style={styles.botIconImg} resizeMode="cover" />
          </View>
          <View>
            <Text style={[styles.botName, { color: colors.text }]}>ScamBot</Text>
            <Text style={[styles.botStatus, { color: "#10B981" }]}>● Online 24/7</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setMessages([{
            id: "welcome",
            role: "assistant",
            text: "Chat cleared! Ask me anything about scams and fraud protection.",
            ts: Date.now(),
          }])}
          style={styles.clearBtn}
        >
          <Text style={[styles.clearEmoji, { color: colors.textMuted }]}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
        ListFooterComponent={
          loading ? (
            <View style={[styles.bubble, styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.msgRow, item.role === "user" ? styles.userRow : styles.assistantRow]}>
            {item.role === "assistant" && (
              <View style={[styles.botAvatar, { backgroundColor: colors.primary }]}>
                <Image source={APP_ICON} style={styles.botAvatarImg} resizeMode="cover" />
              </View>
            )}
            <View
              style={[
                styles.bubble,
                item.role === "user"
                  ? [styles.userBubble, { backgroundColor: colors.primary }]
                  : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
              ]}
            >
              <Text style={[styles.bubbleText, { color: item.role === "user" ? "#fff" : colors.text }]}>
                {item.text}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Quick prompts (only when no user messages yet) */}
      {messages.length === 1 && (
        <View style={styles.quickPrompts}>
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => send(p)}
            >
              <Text style={[styles.quickChipText, { color: colors.text }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8, backgroundColor: colors.background }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Ask ScamBot anything..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: input.trim() && !loading ? colors.primary : colors.muted }]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
        >
          <Image source={APP_ICON} style={styles.sendIcon} resizeMode="cover" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backIcon: { width: 20, height: 20, borderRadius: 6 },
  backLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  botIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  botIconImg: { width: 26, height: 26, borderRadius: 8 },
  botName: { fontFamily: "Inter_700Bold", fontSize: 16 },
  botStatus: { fontFamily: "Inter_400Regular", fontSize: 12 },
  clearBtn: { padding: 4 },
  clearEmoji: { fontSize: 18 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  botAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  botAvatarImg: { width: 18, height: 18, borderRadius: 5 },
  bubble: { maxWidth: "80%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: {},
  assistantBubble: { borderWidth: 1 },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  quickPrompts: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  quickChip: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  quickChipText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendIcon: { width: 22, height: 22, borderRadius: 6 },
});
