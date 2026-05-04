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
} from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { formatTimeAgo } from "@/lib/utils";

const APP_ICON = require("@/assets/images/icon.png");

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

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "resolved" | "dismissed">("pending");

  useEffect(() => {
    const q = query(
      collection(db, "reports"),
      where("status", "==", filter)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({
          ...(d.data() as Omit<Report, "id">),
          id: d.id,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
      setReports(data);
      setLoading(false);
    });
    return unsub;
  }, [filter]);

  if (!profile?.isAdmin) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={[styles.noAccess, { color: colors.textSecondary }]}>
          Admin access required
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleResolve = async (report: Report) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateDoc(doc(db, "reports", report.id), { status: "resolved" });
  };

  const handleDismiss = async (report: Report) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateDoc(doc(db, "reports", report.id), { status: "dismissed" });
  };

  const handleDeletePost = (report: Report) => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "posts", report.targetId));
            await updateDoc(doc(db, "reports", report.id), { status: "resolved" });
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={APP_ICON} style={styles.navIcon} resizeMode="cover" />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Moderation</Text>
        <Image source={APP_ICON} style={styles.headerIcon} resizeMode="cover" />
      </View>

      <View style={styles.filterRow}>
        {(["pending", "resolved", "dismissed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterBtn,
              {
                backgroundColor: filter === f ? colors.primary : colors.card,
                borderColor: filter === f ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f ? "#fff" : colors.textSecondary },
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : reports.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No {filter} reports
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.reportCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.reportHeader}>
                <View
                  style={[styles.reportType, { backgroundColor: colors.primary + "20" }]}
                >
                  <Text style={{ fontSize: 12 }}>🚩</Text>
                  <Text style={[styles.reportTypeText, { color: colors.primary }]}>
                    {item.targetType}
                  </Text>
                </View>
                <Text style={[styles.reportTime, { color: colors.textMuted }]}>
                  {formatTimeAgo(item.createdAt)}
                </Text>
              </View>
              <Text style={[styles.reportReason, { color: colors.text }]}>
                {item.reason}
              </Text>
              {item.details && (
                <Text style={[styles.reportDetails, { color: colors.textSecondary }]}>
                  {item.details}
                </Text>
              )}
              <Text style={[styles.postId, { color: colors.textMuted }]}>
                Post ID: {item.targetId.substring(0, 12)}...
              </Text>

              {item.status === "pending" && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
                    onPress={() => handleDeletePost(item)}
                  >
                    <Text style={{ fontSize: 14 }}>🗑️</Text>
                    <Text style={styles.actionBtnText}>Delete Post</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                    onPress={() => handleResolve(item)}
                  >
                    <Text style={{ fontSize: 14 }}>✓</Text>
                    <Text style={styles.actionBtnText}>Resolve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                    onPress={() => handleDismiss(item)}
                  >
                    <Text style={{ fontSize: 14, color: colors.text }}>✕</Text>
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  navIcon:    { width: 24, height: 24, borderRadius: 6 },
  headerIcon: { width: 22, height: 22, borderRadius: 6 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  reportCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportType: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reportTypeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
  },
  reportTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  reportReason: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  reportDetails: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  postId: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
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
    fontSize: 12,
  },
  noAccess: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    textAlign: "center",
  },
  back: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
});
