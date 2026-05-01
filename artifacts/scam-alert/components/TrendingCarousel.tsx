import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useTrendingPosts } from "@/hooks/useTrendingPosts";
import { CategoryPill } from "./CategoryPill";

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

const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

export function TrendingCarousel() {
  const colors = useColors();
  const { trending, loading, refresh } = useTrendingPosts(8);

  if (!loading && trending.length === 0) return null;

  return (
    <View style={[styles.section, { borderBottomColor: colors.border }]}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <Text style={styles.fireEmoji}>🔥</Text>
          <Text style={[styles.sectionTitleText, { color: colors.text }]}>
            Trending Now
          </Text>
        </View>
        <TouchableOpacity
          onPress={refresh}
          style={[styles.refreshBtn, { backgroundColor: colors.muted }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="refresh-cw" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {trending.map((post, index) => {
            const accentColor = CATEGORY_COLORS[post.category] ?? colors.primary;
            const rankColor = RANK_COLORS[index] ?? colors.textMuted;
            const isTop3 = index < 3;

            return (
              <TouchableOpacity
                key={post.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isTop3 ? accentColor + "44" : colors.border,
                    borderLeftColor: accentColor,
                  },
                ]}
                onPress={() => router.push(`/post/${post.id}` as never)}
                activeOpacity={0.8}
              >
                {/* Rank badge */}
                <View style={styles.rankRow}>
                  <View
                    style={[
                      styles.rankBadge,
                      {
                        backgroundColor: isTop3 ? rankColor + "22" : colors.muted,
                        borderColor: isTop3 ? rankColor + "66" : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankText,
                        { color: isTop3 ? rankColor : colors.textMuted },
                      ]}
                    >
                      #{index + 1}
                    </Text>
                  </View>
                  <CategoryPill category={post.category} />
                </View>

                {/* Title */}
                <Text
                  style={[styles.cardTitle, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {post.title}
                </Text>

                {/* Author */}
                <Text
                  style={[styles.cardAuthor, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {post.authorName}
                </Text>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Feather name="heart" size={11} color={colors.primary} />
                    <Text style={[styles.statText, { color: colors.textMuted }]}>
                      {post.likes?.length ?? 0}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Feather name="message-circle" size={11} color={colors.info} />
                    <Text style={[styles.statText, { color: colors.textMuted }]}>
                      {post.commentCount ?? 0}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Feather name="share-2" size={11} color={colors.success} />
                    <Text style={[styles.statText, { color: colors.textMuted }]}>
                      {post.shareCount ?? 0}
                    </Text>
                  </View>
                  {isTop3 && (
                    <View style={[styles.hotBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.hotText}>HOT</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderBottomWidth: 1,
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fireEmoji: {
    fontSize: 16,
  },
  sectionTitleText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  card: {
    width: 200,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 14,
    gap: 6,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  rankBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  rankText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    lineHeight: 18,
  },
  cardAuthor: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  hotBadge: {
    marginLeft: "auto",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hotText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
