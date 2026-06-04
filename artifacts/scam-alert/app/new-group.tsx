import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,

} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { collection, query, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";

import { Feather } from "@expo/vector-icons";

interface UserResult {
  id: string;
  username: string;
  profilePhoto: string | null;
  niche: string;
}

export default function NewGroupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [step, setStep] = useState<"select" | "name">("select");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setUsers([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "users"));
      const results: UserResult[] = [];
      snap.forEach((d) => {
        if (d.id === user?.uid) return;
        const data = d.data();
        if (data.username?.toLowerCase().includes(search.toLowerCase())) {
          results.push({ id: d.id, username: data.username, profilePhoto: data.profilePhoto ?? null, niche: data.niche ?? "" });
        }
      });
      setUsers(results.slice(0, 20));
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleSelect = (u: UserResult) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) =>
      prev.find((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]
    );
  };

  const isSelected = (id: string) => !!selected.find((u) => u.id === id);

  const createGroup = async () => {
    if (!groupName.trim()) { Alert.alert("Name required", "Please enter a group name."); return; }
    if (!user || !profile) return;
    setCreating(true);
    try {
      const now = Date.now();
      const participantIds = [user.uid, ...selected.map((u) => u.id)];
      const participantNames: Record<string, string> = { [user.uid]: profile.username };
      const participantAvatars: Record<string, string | null> = { [user.uid]: profile.profilePhoto ?? null };
      selected.forEach((u) => {
        participantNames[u.id] = u.username;
        participantAvatars[u.id] = u.profilePhoto;
      });
      const docRef = await addDoc(collection(db, "groupChats"), {
        name: groupName.trim(),
        description: groupDesc.trim(),
        createdBy: user.uid,
        participants: participantIds,
        participantNames,
        participantAvatars,
        lastMessage: "",
        lastMessageAt: now,
        createdAt: now,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/group-chat/${docRef.id}` as never);
    } catch {
      Alert.alert("Error", "Could not create group.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => step === "name" ? setStep("select") : router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {step === "select" ? "New Group" : "Group Details"}
        </Text>
        {step === "select" ? (
          <TouchableOpacity
            onPress={() => { if (selected.length > 0) setStep("name"); }}
            disabled={selected.length === 0}
          >
            <Text style={[styles.nextBtn, { color: selected.length > 0 ? colors.primary : colors.textMuted }]}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={createGroup} disabled={creating}>
            {creating ? <ActivityIndicator color={colors.primary} /> : (
              <Text style={[styles.nextBtn, { color: colors.primary }]}>Create</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {step === "select" ? (
        <>
          {selected.length > 0 && (
            <View style={[styles.selectedRow, { borderBottomColor: colors.border }]}>
              {selected.map((u) => (
                <TouchableOpacity key={u.id} style={styles.selectedChip} onPress={() => toggleSelect(u)}>
                  <UserAvatar uri={u.profilePhoto} name={u.username} size={28} />
                  <Text style={[styles.chipName, { color: colors.text }]}>{u.username}</Text>
                  <Feather name="x" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.card, margin: 16 }]}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search users..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(u) => u.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.userRow, { borderBottomColor: colors.border }]}
                  onPress={() => toggleSelect(item)}
                >
                  <UserAvatar uri={item.profilePhoto} name={item.username} size={44} />
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{item.username}</Text>
                    <Text style={[styles.userNiche, { color: colors.textMuted }]}>{item.niche}</Text>
                  </View>
                  <View style={[styles.checkbox, { borderColor: colors.border }, isSelected(item.id) && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    {isSelected(item.id) && <Feather name="check" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : (
        <View style={{ padding: 20, gap: 16 }}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Group Name *</Text>
          <TextInput
            style={[styles.nameInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
            placeholder="e.g. Scam Fighters Squad"
            placeholderTextColor={colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
            autoFocus
          />
          <Text style={[styles.label, { color: colors.textMuted }]}>Description (optional)</Text>
          <TextInput
            style={[styles.nameInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text, height: 80 }]}
            placeholder="What's this group about?"
            placeholderTextColor={colors.textMuted}
            value={groupDesc}
            onChangeText={setGroupDesc}
            multiline
            maxLength={200}
          />
          <Text style={[styles.memberLabel, { color: colors.textSecondary }]}>
            {selected.length + 1} members selected
          </Text>
          <View style={styles.memberChips}>
            {selected.map((u) => (
              <View key={u.id} style={[styles.memberChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <UserAvatar uri={u.profilePhoto} name={u.username} size={24} />
                <Text style={[styles.chipName, { color: colors.text }]}>{u.username}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  nextBtn: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  selectedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, borderBottomWidth: 1 },
  selectedChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "rgba(255,59,59,0.12)" },
  chipName: { fontFamily: "Inter_500Medium", fontSize: 12 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  userInfo: { flex: 1 },
  userName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  userNiche: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  navIcon:   { width: 22, height: 22, borderRadius: 6 },
  chipIcon:  { width: 12, height: 12, borderRadius: 3 },
  searchIcon:{ width: 16, height: 16, borderRadius: 4 },
  checkIcon: { width: 14, height: 14, borderRadius: 3 },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  nameInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 15 },
  memberLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  memberChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
});
