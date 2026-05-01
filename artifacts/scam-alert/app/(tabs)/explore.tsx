import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { collection, query, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { CATEGORIES, type CategoryId } from "@/context/AuthContext";
import { router } from "expo-router";

interface CategoryStat {
  id: CategoryId;
  label: string;
  icon: string;
  count: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  "scam-alert": "#FF3B3B",
  "news": "#3B82F6",
  "motivation": "#F59E0B",
  "health": "#22C55E",
  "finance": "#8B5CF6",
  "crime-awareness": "#EF4444",
  "technology": "#06B6D4",
  "education": "#F97316",
  "entertainment": "#EC4899",
};

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const results = await Promise.all(
          CATEGORIES.map(async (cat) => {
            try {
              const q = query(collection(db, "posts"));
              const snap = await getCountFromServer(q);
              return { ...cat, count: snap.data().count };
            } catch {
              return { ...cat, count: 0 };
            }
          })
        );
        setStats(results);
      } catch {
        setStats(CATEGORIES.map((c) => ({ ...c, count: 0 })));
      } finally {
        setLoading(false);
      }
    };
    fetchCounts();
  }, []);

  const renderCategory = ({ item }: { item: CategoryStat }) => {
    const color = CATEGORY_COLORS[item.id] ?? colors.primary;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/(tabs)/` as never)}
        activeOpacity={0.8}
      >
        <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
          <Feather
            name={item.icon as keyof typeof Feather.glyphMap}
            size={24}
            color={color}
          />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.label}</Text>
          <Text style={[styles.cardCount, { color: colors.textMuted }]}>
            {loading ? "..." : `${item.count} posts`}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, paddingTop: topPad },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>Explore</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Browse posts by category
        </Text>
      </View>

      <View
        style={[
          styles.aiCheckerBanner,
          { backgroundColor: colors.primary + "15", borderColor: colors.primary + "44" },
        ]}
      >
        <View style={styles.aiBannerContent}>
          <View style={[styles.aiIcon, { backgroundColor: colors.primary }]}>
            <Feather name="shield" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.aiTitle, { color: colors.text }]}>AI Scam Checker</Text>
            <Text style={[styles.aiDesc, { color: colors.textSecondary }]}>
              Paste a suspicious message and our AI will analyze it
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.aiBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/scam-checker" as never)}
        >
          <Text style={styles.aiBtnText}>Check Now</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={stats}
        keyExtractor={(item) => item.id}
        renderItem={renderCategory}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    height: 110,
    justifyContent: "flex-end",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 2,
  },
  aiCheckerBanner: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  aiBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  aiDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  aiBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  aiBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: { flex: 1 },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  cardCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
