import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  Image,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import {
  collection,
  query,
  onSnapshot,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { router } from "expo-router";
import { formatTimeAgo } from "@/lib/utils";

const APP_ICON = require("@/assets/images/icon.png");

interface Chat {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string | null>;
  lastMessage: string;
  lastMessageAt: number;
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map((d) => ({
            ...(d.data() as Omit<Chat, "id">),
            id: d.id,
          }))
          .sort((a, b) => (b.lastMessageAt as number) - (a.lastMessageAt as number));
        setChats(data);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [user]);

  const filtered = chats.filter((c) => {
    if (!search) return true;
    const otherId = c.participants.find((p) => p !== user?.uid) ?? "";
    const name = c.participantNames[otherId] ?? "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getOtherUser = (chat: Chat) => {
    const otherId = chat.participants.find((p) => p !== user?.uid) ?? "";
    return {
      id: otherId,
      name: chat.participantNames[otherId] ?? "Unknown",
      avatar: chat.participantAvatars[otherId] ?? null,
    };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, paddingTop: topPad },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
          <View style={styles.headerBtns}>
            <View style={styles.btnWrap}>
              <TouchableOpacity
                style={[styles.newMsgBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => router.push("/new-group" as never)}
              >
                <Image source={APP_ICON} style={styles.btnIcon} resizeMode="cover" />
              </TouchableOpacity>
              <Text style={[styles.btnLabel, { color: colors.textSecondary }]}>Group</Text>
            </View>
            <View style={styles.btnWrap}>
              <TouchableOpacity
                style={[styles.newMsgBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/new-message" as never)}
              >
                <Image source={APP_ICON} style={styles.btnIcon} resizeMode="cover" />
              </TouchableOpacity>
              <Text style={[styles.btnLabel, { color: colors.textSecondary }]}>New Chat</Text>
            </View>
          </View>
        </View>
        <View
          style={[
            styles.searchBar,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Image source={APP_ICON} style={styles.searchIcon} resizeMode="cover" />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Image source={APP_ICON} style={styles.emptyIcon} resizeMode="cover" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No conversations yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Tap the compose button above to start a new chat
          </Text>
          <TouchableOpacity
            style={[styles.newChatBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/new-message" as never)}
          >
            <Image source={APP_ICON} style={styles.btnIcon} resizeMode="cover" />
            <Text style={styles.newChatBtnText}>New Message</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => {
            const other = getOtherUser(item);
            return (
              <TouchableOpacity
                style={[
                  styles.chatRow,
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => router.push(`/chat/${item.id}` as never)}
                activeOpacity={0.7}
              >
                <UserAvatar uri={other.avatar} name={other.name} size={50} />
                <View style={styles.chatContent}>
                  <View style={styles.chatTop}>
                    <Text style={[styles.chatName, { color: colors.text }]}>
                      {other.name}
                    </Text>
                    <Text style={[styles.chatTime, { color: colors.textMuted }]}>
                      {item.lastMessageAt ? formatTimeAgo(item.lastMessageAt) : ""}
                    </Text>
                  </View>
                  <Text
                    style={[styles.lastMsg, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {item.lastMessage || "No messages yet"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    height: 50,
  },
  headerBtns: {
    flexDirection: "row",
    gap: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
  },
  newMsgBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  btnWrap:    { alignItems: "center", gap: 3 },
  btnIcon:    { width: 20, height: 20, borderRadius: 5 },
  btnLabel:   { fontFamily: "Inter_400Regular", fontSize: 10 },
  searchIcon: { width: 16, height: 16, borderRadius: 4 },
  emptyIcon:  { width: 52, height: 52, borderRadius: 14 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  newChatBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  chatContent: { flex: 1 },
  chatTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  chatName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  chatTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  lastMsg: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
});
