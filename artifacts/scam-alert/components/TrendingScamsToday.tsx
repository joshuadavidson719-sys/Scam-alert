import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { CATEGORIES } from "@/context/AuthContext";
import { router } from "expo-router";

interface TrendItem {
  categoryId: string;
  label: string;
  emoji: string;
  count: number;
  color: string;
}

const CAT_META: Record<string, { emoji: string; color: string }> = {
  "scam-alert":        { emoji: "🚨", color: "#FF3B3B" },
  phishing:            { emoji: "🎣", color: "#3B82F6" },
  "romance-scam":      { emoji: "💔", color: "#EC4899" },
  "investment-fraud":  { emoji: "📈", color: "#F59E0B" },
  "tech-support":      { emoji: "💻", color: "#8B5CF6" },
  "identity-theft":    { emoji: "🪪", color: "#EF4444" },
  "lottery-scam":      { emoji: "🎰", color: "#10B981" },
  "job-scam":          { emoji: "💼", color: "#6366F1" },
  other:               { emoji: "⚠️", color: "#9CA3AF" },
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function TrendingScamsToday() {
  const colors = useColors();
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const since = Timestamp.fromDate(startOfToday());
        const snap = await getDocs(
          query(collection(db, "posts"), where("createdAt", ">=", since))
        );
        const counts: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const cat = (d.data().category as string) ?? "other";
          counts[cat] = (counts[cat] ?? 0) + 1;
        });

        const result: TrendItem[] = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6)
          .map(([id, count]) => {
            const cat = CATEGORIES.find((c) => c.id === id);
            const meta = CAT_META[id] ?? { emoji: "⚠️", color: "#9CA3AF" };
            return {
              categoryId: id,
              label: cat?.label ?? id,
              emoji: meta.emoji,
              color: meta.color,
              count,
            };
          });

        setItems(result);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading || items.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>🔥 Trending Today</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>Most reported scams</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={item.categoryId}
            style={[
              styles.chip,
              { backgroundColor: item.color + "15", borderColor: item.color + "50" },
            ]}
            onPress={() =>
              router.push({ pathname: "/(tabs)/", params: { category: item.categoryId } } as never)
            }
            activeOpacity={0.75}
          >
            {i === 0 && (
              <View style={[styles.topBadge, { backgroundColor: item.color }]}>
                <Text style={styles.topBadgeText}>#1</Text>
              </View>
            )}
            <Text style={styles.chipEmoji}>{item.emoji}</Text>
            <Text style={[styles.chipLabel, { color: colors.text }]}>{item.label}</Text>
            <View style={[styles.countBadge, { backgroundColor: item.color + "25" }]}>
              <Text style={[styles.countText, { color: item.color }]}>{item.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 16 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12 },
  row: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    position: "relative",
  },
  topBadge: {
    position: "absolute",
    top: -6,
    right: -4,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  topBadgeText: { fontFamily: "Inter_700Bold", fontSize: 9, color: "#fff" },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: { fontFamily: "Inter_700Bold", fontSize: 11 },
});
