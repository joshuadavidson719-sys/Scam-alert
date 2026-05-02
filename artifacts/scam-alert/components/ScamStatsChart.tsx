import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { CATEGORIES } from "@/context/AuthContext";
import type { CategoryId } from "@/context/AuthContext";

interface CategoryCount {
  id: CategoryId;
  label: string;
  icon: string;
  count: number;
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "scam-alert": "#FF3B3B",
  news: "#3B82F6",
  motivation: "#F59E0B",
  health: "#22C55E",
  finance: "#8B5CF6",
  "crime-awareness": "#EF4444",
  technology: "#06B6D4",
  education: "#F97316",
  entertainment: "#EC4899",
};

export function ScamStatsChart() {
  const colors = useColors();
  const [data, setData] = useState<CategoryCount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(500))
        );

        const counts: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const cat = d.data().category as string;
          counts[cat] = (counts[cat] ?? 0) + 1;
        });

        const result: CategoryCount[] = CATEGORIES.map((cat) => ({
          id: cat.id,
          label: cat.label,
          icon: cat.icon,
          count: counts[cat.id] ?? 0,
          color: CATEGORY_COLORS[cat.id] ?? colors.primary,
        }))
          .filter((c) => c.count > 0)
          .sort((a, b) => b.count - a.count);

        setData(result);
        setTotal(snap.size);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (data.length === 0) return null;

  const maxCount = data[0]?.count ?? 1;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.titleRow}>
        <View style={[styles.titleIcon, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="bar-chart-2" size={16} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Trending Topics</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {total} post{total !== 1 ? "s" : ""} in the community
          </Text>
        </View>
      </View>

      <View style={styles.bars}>
        {data.slice(0, 6).map((item) => {
          const pct = total > 0 ? (item.count / maxCount) * 100 : 0;
          return (
            <View key={item.id} style={styles.barRow}>
              <View style={styles.barLabel}>
                <Feather
                  name={item.icon as keyof typeof Feather.glyphMap}
                  size={13}
                  color={item.color}
                />
                <Text style={[styles.catLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.label}
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%` as `${number}%`, backgroundColor: item.color },
                  ]}
                />
              </View>
              <Text style={[styles.barCount, { color: colors.text }]}>{item.count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 1,
  },
  bars: {
    gap: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    width: 110,
  },
  catLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flex: 1,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 4,
    minWidth: 4,
  },
  barCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    width: 24,
    textAlign: "right",
  },
});
