import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { chatWithScamBot } from "@/lib/gemini";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: Date;
}

const QUICK_STARTERS = [
  "How do I spot a phishing email?",
  "Is this a romance scam?",
  "What are crypto scam red flags?",
  "Someone asked for gift cards — scam?",
];

export default function ScamBotScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      text: "👋 Hi! I'm ScamBot, your AI scam prevention advisor.\n\nAsk me anything about scams, phishing, fraud, or suspicious activity. I'm here to help you stay safe!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role === "user" ? "user" : "bot", text: m.text }));

      const reply = await chatWithScamBot(history, trimmed);

      const botMsg: Message = {
        id: `b-${Date.now()}`,
        role: "bot",
        text: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg: Message = {
        id: `e-${Date.now()}`,
        role: "bot",
        text: "Sorry, I couldn't connect right now. Please check your internet connection and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isBot = item.role === "bot";
    return (
      <View style={[styles.messageRow, isBot ? styles.botRow : styles.userRow]}>
        {isBot && (
          <View style={[styles.botAvatar, { backgroundColor: "#FF3B3B" }]}>
            <Feather name="shield" size={14} color="#fff" />
          </View>
        )}
        <View style={{ maxWidth: "78%", gap: 4 }}>
          <View
            style={[
              styles.bubble,
              isBot
                ? [styles.botBubble, { backgroundColor: colors.card, borderColor: colors.border }]
                : [styles.userBubble, { backgroundColor: "#FF3B3B" }],
            ]}
          >
            <Text style={[styles.bubbleText, { color: isBot ? colors.text : "#fff" }]}>
              {item.text}
            </Text>
          </View>
          <Text style={[styles.timestamp, { color: colors.textMuted, alignSelf: isBot ? "flex-start" : "flex-end" }]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
        {!isBot && (
          <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
            <Feather name="user" size={14} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.headerAvatar, { backgroundColor: "#FF3B3B" }]}>
            <Feather name="shield" size={18} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>ScamBot</Text>
            <Text style={[styles.headerSub, { color: "#22c55e" }]}>● Online</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() =>
            setMessages([{
              id: "welcome",
              role: "bot",
              text: "👋 Hi! I'm ScamBot, your AI scam prevention advisor.\n\nAsk me anything about scams, phishing, fraud, or suspicious activity. I'm here to help you stay safe!",
              timestamp: new Date(),
            }])
          }
          style={styles.clearBtn}
        >
          <Feather name="refresh-cw" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingRow}>
              <View style={[styles.botAvatar, { backgroundColor: "#FF3B3B" }]}>
                <Feather name="shield" size={14} color="#fff" />
              </View>
              <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color="#FF3B3B" />
                <Text style={[styles.typingText, { color: colors.textMuted }]}>ScamBot is thinking...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {messages.length === 1 && (
        <View style={[styles.startersSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.startersLabel, { color: colors.textMuted }]}>Quick questions</Text>
          <View style={styles.starters}>
            {QUICK_STARTERS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[styles.starter, { backgroundColor: colors.card, borderColor: "#FF3B3B" }]}
                onPress={() => sendMessage(q)}
              >
                <Text style={[styles.starterText, { color: colors.text }]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Ask ScamBot anything..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage(input)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? "#FF3B3B" : colors.muted, opacity: loading ? 0.5 : 1 }]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
  clearBtn: { padding: 4 },
  messageList: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  botRow: { justifyContent: "flex-start" },
  userRow: { justifyContent: "flex-end" },
  botAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  userAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  botBubble: { borderWidth: 1, borderBottomLeftRadius: 4 },
  userBubble: { borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  timestamp: { fontFamily: "Inter_400Regular", fontSize: 11, marginHorizontal: 4 },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginTop: 8 },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderBottomLeftRadius: 4, borderWidth: 1 },
  typingText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  startersSection: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  startersLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  starters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  starter: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  starterText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
