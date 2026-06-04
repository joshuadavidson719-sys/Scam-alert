import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, getDocs, query, limit, doc, setDoc } from "firebase/firestore";
import { router } from "expo-router";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import type { UserProfile } from "@/context/AuthContext";

import { Feather } from "@expo/vector-icons";

export default function NewMessageScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), limit(200)));
        const users = snap.docs
          .map((d) => d.data() as UserProfile)
          .filter((u) => u.uid !== user?.uid);
        setAllUsers(users);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filtered = allUsers.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleStartChat = async (target: UserProfile) => {
    if (!user || !profile || starting) return;
    setStarting(target.uid);
    try {
      const chatId = [user.uid, target.uid].sort().join("_");
      await setDoc(
        doc(db, "chats", chatId),
        {
          participants: [user.uid, target.uid],
          participantNames: {
            [user.uid]: profile.username ?? "Me",
            [target.uid]: target.username,
          },
          participantAvatars: {
            [user.uid]: profile.profilePhoto ?? null,
            [target.uid]: target.profilePhoto ?? null,
          },
          lastMessage: "",
          lastMessageAt: Date.now(),
        },
        { merge: true }
      );
      router.replace(`/chat/${chatId}` as never);
    } catch {
      setStarting(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>New Message</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search users..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.textMuted} />
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
          <Feather name="users" size={48} color={colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {search ? "No users found" : "No users yet"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.userRow, { borderBottomColor: colors.border }]}
              onPress={() => handleStartChat(item)}
              disabled={starting === item.uid}
              activeOpacity={0.7}
            >
              <UserAvatar uri={item.profilePhoto} name={item.username} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
                {item.niche ? (
                  <Text style={[styles.niche, { color: colors.textMuted }]}>{item.niche}</Text>
                ) : null}
              </View>
              {starting === item.uid ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <View style={[styles.msgIcon, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name="send" size={16} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  username: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  niche: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  msgIcon:    { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  navIcon:    { width: 22, height: 22, borderRadius: 6 },
  searchIcon: { width: 16, height: 16, borderRadius: 4 },
  clearIcon:  { width: 15, height: 15, borderRadius: 4 },
  emptyIcon:  { width: 48, height: 48, borderRadius: 12 },
  msgIconImg: { width: 20, height: 20, borderRadius: 5 },
});
