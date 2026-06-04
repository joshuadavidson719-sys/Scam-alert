import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,

} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { router } from "expo-router";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { getBadgeForPoints } from "@/hooks/usePoints";

import { Feather } from "@expo/vector-icons";

interface LeaderUser {
  uid: string;
  username: string;
  profilePhoto: string | null;
  points: number;
  niche: string;
}

const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<LeaderUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(
          collection(db, "users"),
          orderBy("points", "desc"),
          limit(50)
        );
        const snap = await getDocs(q);
        const data = snap.docs
          .map((d) => {
            const u = d.data();
            return {
              uid: d.id,
              username: u.username ?? "Unknown",
              profilePhoto: u.profilePhoto ?? null,
              points: (u.points as number) ?? 0,
              niche: u.niche ?? "",
            } as LeaderUser;
          })
          .filter((u) => u.points > 0);
        setLeaders(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const myRank = leaders.findIndex((l) => l.uid === user?.uid) + 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Leaderboard</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : leaders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48 }}>🏆</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No rankings yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Start posting to earn points and appear here!
          </Text>
        </View>
      ) : (
        <FlatList
          data={leaders}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListHeaderComponent={
            myRank > 0 ? (
              <View style={[styles.myRankBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
                <Text style={{ fontSize: 16 }}>📈</Text>
                <Text style={[styles.myRankText, { color: colors.primary }]}>
                  Your rank: #{myRank} · {leaders[myRank - 1]?.points ?? 0} pts
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const badge = getBadgeForPoints(item.points);
            const isMe = item.uid === user?.uid;
            const rankColor = index < 3 ? RANK_COLORS[index] : colors.textMuted;
            return (
              <TouchableOpacity
                style={[
                  styles.row,
                  {
                    backgroundColor: isMe ? colors.primary + "10" : colors.card,
                    borderColor: isMe ? colors.primary + "40" : colors.border,
                  },
                ]}
                onPress={() => router.push(`/user/${item.uid}` as never)}
                activeOpacity={0.8}
              >
                <Text style={[styles.rank, { color: rankColor }]}>
                  {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                </Text>
                <UserAvatar uri={item.profilePhoto} name={item.username} size={44} />
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                      {item.username}
                    </Text>
                    {isMe && (
                      <View style={[styles.youChip, { backgroundColor: colors.primary }]}>
                        <Text style={styles.youText}>You</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.niche, { color: colors.textMuted }]}>{item.niche || badge.label}</Text>
                </View>
                <View style={styles.pointsCol}>
                  <Text style={[styles.badge, {}]}>{badge.icon}</Text>
                  <Text style={[styles.points, { color: colors.text }]}>{item.points}</Text>
                  <Text style={[styles.pts, { color: colors.textMuted }]}>pts</Text>
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
  myRankBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  myRankText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rank: { fontFamily: "Inter_700Bold", fontSize: 15, width: 32, textAlign: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  username: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  youChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  youText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 9 },
  niche: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  pointsCol: { alignItems: "center", minWidth: 48 },
  badge: { fontSize: 18 },
  points: { fontFamily: "Inter_700Bold", fontSize: 16 },
  pts: { fontFamily: "Inter_400Regular", fontSize: 10 },
});
