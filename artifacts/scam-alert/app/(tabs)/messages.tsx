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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { router } from "expo-router";
import { formatTimeAgo } from "@/lib/utils";

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
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          ...(d.data() as Omit<Chat, "id">),
          id: d.id,
        }));
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
        <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
        <View
          style={[
            styles.searchBar,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="message-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No conversations yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Visit a user's profile to start a conversation
          </Text>
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
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    marginBottom: 12,
    height: 50,
    textAlignVertical: "center",
  },
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
