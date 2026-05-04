import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  orderBy,
  getDocs,
} from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { formatTimeAgo } from "@/lib/utils";

const APP_ICON = require("@/assets/images/icon.png");

type AdminTab = "reports" | "users";

interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  targetType: string;
  reason: string;
  details?: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: number;
}

interface ManagedUser {
  uid: string;
  username: string;
  email: string;
  profilePhoto: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: number;
  followers: string[];
  following: string[];
}

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [tab, setTab] = useState<AdminTab>("reports");

  // ── Reports state ──────────────────────────────────────────
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportFilter, setReportFilter] = useState<"pending" | "resolved" | "dismissed">("pending");

  // ── Users state ────────────────────────────────────────────
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [usersFetched, setUsersFetched] = useState(false);

  // ── Reports listener ───────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, "reports"),
      where("status", "==", reportFilter)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ ...(d.data() as Omit<Report, "id">), id: d.id }))
        .sort((a, b) => b.createdAt - a.createdAt);
      setReports(data);
      setReportsLoading(false);
    });
    return unsub;
  }, [reportFilter]);

  // ── Users fetch (once when tab opens) ─────────────────────
  useEffect(() => {
    if (tab !== "users" || usersFetched) return;
    setUsersLoading(true);
    getDocs(collection(db, "users")).then((snap) => {
      const data = snap.docs.map((d) => d.data() as ManagedUser);
      data.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setUsers(data);
      setUsersLoading(false);
      setUsersFetched(true);
    });
  }, [tab, usersFetched]);

  // ── Guard ──────────────────────────────────────────────────
  if (!profile?.isAdmin) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={[styles.noAccess, { color: colors.textSecondary }]}>
          Admin access required
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Report actions ─────────────────────────────────────────
  const handleResolve = async (report: Report) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateDoc(doc(db, "reports", report.id), { status: "resolved" });
  };

  const handleDismiss = async (report: Report) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateDoc(doc(db, "reports", report.id), { status: "dismissed" });
  };

  const handleDeletePost = (report: Report) => {
    Alert.alert("Delete Post", "Delete this post? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "posts", report.targetId));
          await updateDoc(doc(db, "reports", report.id), { status: "resolved" });
        },
      },
    ]);
  };

  // ── User actions ───────────────────────────────────────────
  const handleToggleBan = (u: ManagedUser) => {
    const action = u.isBanned ? "Unblock" : "Block";
    const msg = u.isBanned
      ? `Unblock @${u.username}? They will be able to log in again.`
      : `Block @${u.username}? They will be immediately locked out of the app.`;
    Alert.alert(`${action} User`, msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: action,
        style: u.isBanned ? "default" : "destructive",
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await updateDoc(doc(db, "users", u.uid), { isBanned: !u.isBanned });
          setUsers((prev) =>
            prev.map((x) => (x.uid === u.uid ? { ...x, isBanned: !u.isBanned } : x))
          );
        },
      },
    ]);
  };

  const handleToggleAdmin = (u: ManagedUser) => {
    if (u.uid === profile.uid) {
      Alert.alert("Cannot change your own admin status.");
      return;
    }
    const action = u.isAdmin ? "Remove admin" : "Make admin";
    Alert.alert(`${action}?`, `@${u.username} will ${u.isAdmin ? "lose" : "gain"} admin privileges.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: action,
        onPress: async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          await updateDoc(doc(db, "users", u.uid), { isAdmin: !u.isAdmin });
          setUsers((prev) =>
            prev.map((x) => (x.uid === u.uid ? { ...x, isAdmin: !u.isAdmin } : x))
          );
        },
      },
    ]);
  };

  const handleDeleteUser = (u: ManagedUser) => {
    if (u.uid === profile.uid) {
      Alert.alert("Cannot delete your own account from here.");
      return;
    }
    Alert.alert(
      "Delete Account",
      `Permanently delete @${u.username}'s account data from Firestore? Their Firebase Auth login must be removed separately via the Firebase Console.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Data",
          style: "destructive",
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await deleteDoc(doc(db, "users", u.uid));
            setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
          },
        },
      ]
    );
  };

  // ── Filtered users ─────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  // ── Render: report card ────────────────────────────────────
  const renderReport = ({ item }: { item: Report }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
          <Text style={{ fontSize: 11 }}>🚩</Text>
          <Text style={[styles.badgeText, { color: colors.primary }]}>{item.targetType}</Text>
        </View>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>{formatTimeAgo(item.createdAt)}</Text>
      </View>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{item.reason}</Text>
      {item.details ? (
        <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{item.details}</Text>
      ) : null}
      <Text style={[styles.metaText, { color: colors.textMuted }]}>
        Target ID: {item.targetId.slice(0, 14)}…
      </Text>
      {item.status === "pending" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
            onPress={() => handleDeletePost(item)}
          >
            <Text style={{ fontSize: 13 }}>🗑️</Text>
            <Text style={styles.actionBtnText}>Delete Post</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={() => handleResolve(item)}
          >
            <Text style={{ fontSize: 13 }}>✓</Text>
            <Text style={styles.actionBtnText}>Resolve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.muted }]}
            onPress={() => handleDismiss(item)}
          >
            <Text style={{ fontSize: 13, color: colors.text }}>✕</Text>
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ── Render: user card ──────────────────────────────────────
  const renderUser = ({ item }: { item: ManagedUser }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: item.isBanned ? colors.destructive + "60" : colors.border }]}>
      <View style={styles.userRow}>
        {item.profilePhoto ? (
          <Image source={{ uri: item.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary + "30" }]}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>@{item.username}</Text>
            {item.isAdmin && (
              <View style={[styles.badge, { backgroundColor: "#7C3AED20" }]}>
                <Text style={[styles.badgeText, { color: "#7C3AED" }]}>ADMIN</Text>
              </View>
            )}
            {item.isBanned && (
              <View style={[styles.badge, { backgroundColor: colors.destructive + "20" }]}>
                <Text style={[styles.badgeText, { color: colors.destructive }]}>BLOCKED</Text>
              </View>
            )}
          </View>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>{item.email}</Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            👥 {item.followers?.length ?? 0} followers · joined {item.createdAt ? formatTimeAgo(item.createdAt) : "—"}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionRow}>
        {/* Block / Unblock */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: item.isBanned ? "#10B98120" : colors.destructive + "20", flex: 1.4 },
          ]}
          onPress={() => handleToggleBan(item)}
        >
          <Text style={{ fontSize: 13 }}>{item.isBanned ? "✅" : "🚫"}</Text>
          <Text style={[styles.actionBtnText, { color: item.isBanned ? "#10B981" : colors.destructive }]}>
            {item.isBanned ? "Unblock" : "Block"}
          </Text>
        </TouchableOpacity>

        {/* Admin toggle */}
        {item.uid !== profile.uid && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#7C3AED20", flex: 1.4 }]}
            onPress={() => handleToggleAdmin(item)}
          >
            <Text style={{ fontSize: 13 }}>🛡️</Text>
            <Text style={[styles.actionBtnText, { color: "#7C3AED" }]}>
              {item.isAdmin ? "Revoke" : "Make Admin"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Delete */}
        {item.uid !== profile.uid && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.destructive + "15", flex: 1 }]}
            onPress={() => handleDeleteUser(item)}
          >
            <Text style={{ fontSize: 13 }}>🗑️</Text>
            <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={APP_ICON} style={styles.navIcon} resizeMode="cover" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Panel</Text>
        <Image source={APP_ICON} style={styles.navIcon} resizeMode="cover" />
      </View>

      {/* Top tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {([
          { key: "reports", label: "🚩 Reports" },
          { key: "users",   label: "👥 Users" },
        ] as { key: AdminTab; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.tabBtn,
              tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, { color: tab === t.key ? colors.primary : colors.textMuted }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── REPORTS TAB ── */}
      {tab === "reports" && (
        <>
          <View style={styles.filterRow}>
            {(["pending", "resolved", "dismissed"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterBtn,
                  { backgroundColor: reportFilter === f ? colors.primary : colors.card, borderColor: reportFilter === f ? colors.primary : colors.border },
                ]}
                onPress={() => setReportFilter(f)}
              >
                <Text style={[styles.filterText, { color: reportFilter === f ? "#fff" : colors.textSecondary }]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {reportsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : reports.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ fontSize: 40 }}>✅</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No {reportFilter} reports</Text>
            </View>
          ) : (
            <FlatList
              data={reports}
              keyExtractor={(i) => i.id}
              renderItem={renderReport}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
            />
          )}
        </>
      )}

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <>
          {/* Search */}
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by username or email…"
              placeholderTextColor={colors.textMuted}
              value={userSearch}
              onChangeText={setUserSearch}
              autoCapitalize="none"
            />
            {userSearch.length > 0 && (
              <TouchableOpacity onPress={() => setUserSearch("")}>
                <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.text }]}>{users.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: "#10B981" }]}>{users.filter((u) => !u.isBanned).length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: colors.destructive }]}>{users.filter((u) => u.isBanned).length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Blocked</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: "#7C3AED" }]}>{users.filter((u) => u.isAdmin).length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Admins</Text>
            </View>
          </View>

          {usersLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : filteredUsers.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ fontSize: 40 }}>👤</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {userSearch ? "No users match your search" : "No users found"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(u) => u.uid}
              renderItem={renderUser}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  centered:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  navIcon:      { width: 24, height: 24, borderRadius: 6 },
  headerTitle:  { fontFamily: "Inter_700Bold", fontSize: 18 },

  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },

  filterRow:    { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterText:   { fontFamily: "Inter_500Medium", fontSize: 13 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput:  { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },

  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginTop: 12,
  },
  statItem:     { flex: 1, alignItems: "center" },
  statVal:      { fontFamily: "Inter_700Bold", fontSize: 20 },
  statLabel:    { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle:    { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  cardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  metaText:     { fontFamily: "Inter_400Regular", fontSize: 11 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeText:    { fontFamily: "Inter_600SemiBold", fontSize: 10, textTransform: "uppercase" },

  userRow:      { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar:       { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },

  actionRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },

  noAccess:     { fontFamily: "Inter_400Regular", fontSize: 16, textAlign: "center" },
  backLink:     { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  emptyText:    { fontFamily: "Inter_400Regular", fontSize: 15 },
});
