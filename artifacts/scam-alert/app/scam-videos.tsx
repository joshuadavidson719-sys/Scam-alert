import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, ScrollView, Platform, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import {
  SCAM_VIDEO_LESSONS, SCAM_VIDEO_CATEGORIES, type ScamVideoLesson,
} from "@/lib/scam-video-catalog";

export function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function isPlayable(l: ScamVideoLesson) {
  return l.status === "ready" && !!l.videoUrl;
}

export default function ScamVideosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const readyCount = useMemo(() => SCAM_VIDEO_LESSONS.filter(isPlayable).length, []);
  const plannedCount = SCAM_VIDEO_LESSONS.length - readyCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SCAM_VIDEO_LESSONS.filter((l) => {
      if (category !== "all" && l.category !== category) return false;
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q)
      );
    }).sort((a, b) => Number(isPlayable(b)) - Number(isPlayable(a)));
  }, [category, search]);

  const header = (
    <View>
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>LEARN TO SPOT IT</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Short lessons that help you pause before you pay.
        </Text>
        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: colors.success + "1F" }]}>
            <Text style={[styles.statNum, { color: colors.success }]}>{readyCount}</Text>
            <Text style={[styles.statLabel, { color: colors.text }]}>
              {readyCount === 1 ? "video available" : "videos available"}
            </Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.muted }]}>
            <Text style={[styles.statNum, { color: colors.text }]}>{plannedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>written lessons, video coming</Text>
          </View>
        </View>
        <View style={[styles.notice, { borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.textSecondary} />
          <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
            Videos are AI-generated dramatizations. People and situations shown are not real, and are made only to teach the warning signs.
          </Text>
        </View>
      </View>

      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search lessons, e.g. lottery, WhatsApp"
          placeholderTextColor={colors.textMuted}
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel="Search scam lessons"
          returnKeyType="search"
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {["all", ...SCAM_VIDEO_CATEGORIES].map((c) => {
          const sel = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`Filter: ${c === "all" ? "All categories" : c}`}
              style={[styles.chip, {
                backgroundColor: sel ? colors.primary : colors.card,
                borderColor: sel ? colors.primary : colors.border,
              }]}
            >
              <Text style={[styles.chipText, { color: sel ? colors.primaryForeground : colors.text }]}>
                {c === "all" ? "All" : c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
        {filtered.length} {filtered.length === 1 ? "lesson" : "lessons"}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))}
          accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]} accessibilityRole="header">Scam Video Lessons</Text>
        <View style={styles.backBtn} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 24, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="search" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No lessons match</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Try a different word or category.</Text>
            <Pressable
              onPress={() => { setSearch(""); setCategory("all"); }}
              accessibilityRole="button"
              style={[styles.resetBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>Show all lessons</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <LessonRow lesson={item} />}
      />
    </View>
  );
}

function LessonRow({ lesson }: { lesson: ScamVideoLesson }) {
  const colors = useColors();
  const ready = isPlayable(lesson);
  return (
    <Pressable
      testID={`lesson-${lesson.id}`}
      onPress={() => router.push(`/scam-video/${lesson.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`${lesson.title}. ${lesson.category}. ${ready ? `Video, ${formatDuration(lesson.durationSeconds)}` : "Written lesson, video not yet available"}`}
      style={({ pressed }) => [styles.row, {
        backgroundColor: colors.card, borderColor: ready ? colors.primary + "55" : colors.border,
        opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={[styles.thumb, { backgroundColor: ready ? colors.primary + "1A" : colors.muted }]}>
        {ready && lesson.thumbnailUrl ? (
          <Image source={{ uri: lesson.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        <Feather name={ready ? "play" : "file-text"} size={20} color={ready ? colors.primary : colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.cat, { color: colors.textSecondary }]}>{lesson.category.toUpperCase()}</Text>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>{lesson.title}</Text>
        <Text style={[styles.rowSummary, { color: colors.textSecondary }]} numberOfLines={2}>{lesson.summary}</Text>
        <View style={[styles.badge, { backgroundColor: ready ? colors.success + "1F" : colors.muted }]}>
          <Text style={[styles.badgeText, { color: ready ? colors.success : colors.textSecondary }]}>
            {ready ? `Watch now · ${formatDuration(lesson.durationSeconds)}` : "Read tips · video coming later"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  hero: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  eyebrow: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.4 },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 21, lineHeight: 27, letterSpacing: -0.3 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: 12 },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 22 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  notice: { flexDirection: "row", gap: 8, borderTopWidth: 1, paddingTop: 10 },
  noticeText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, minHeight: 46 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, paddingVertical: 10 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, minHeight: 36, justifyContent: "center" },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  resultCount: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 4 },
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  thumb: { width: 64, height: 96, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cat: { fontFamily: "Inter_600SemiBold", fontSize: 10.5, letterSpacing: 0.8 },
  rowTitle: { fontFamily: "Inter_700Bold", fontSize: 15, lineHeight: 20 },
  rowSummary: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 2 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11.5 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  resetBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
});
