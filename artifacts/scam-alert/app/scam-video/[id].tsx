import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { useColors } from "@/hooks/useColors";
import { SCAM_VIDEO_LESSONS, type ScamVideoLesson } from "@/lib/scam-video-catalog";

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.round(s % 60).toString().padStart(2, "0")}`;
}

export default function ScamVideoDetail() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = SCAM_VIDEO_LESSONS.find((l) => l.id === id);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/scam-videos" as never));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]} numberOfLines={1}>Lesson</Text>
        <View style={styles.backBtn} />
      </View>
      {!lesson ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color={colors.textMuted} />
          <Text style={[styles.h2, { color: colors.text }]}>Lesson not found</Text>
          <Pressable onPress={() => router.replace("/scam-videos" as never)} accessibilityRole="button"
            style={[styles.btn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Browse all lessons</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 32, gap: 16 }}>
          {lesson.status === "ready" && lesson.videoUrl ? (
            <LessonPlayer url={lesson.videoUrl} title={lesson.title} />
          ) : (
            <View style={[styles.planned, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="file-text" size={22} color={colors.textSecondary} />
              <Text style={[styles.plannedText, { color: colors.textSecondary }]}>
                The video for this lesson is not available yet. The written warning signs and safety steps below are ready to use now.
              </Text>
            </View>
          )}
          <Header lesson={lesson} />
          <Section title="Warning signs" icon="alert-triangle" tint={colors.warning} items={lesson.warningSigns} />
          <Section title="How to stay safe" icon="shield" tint={colors.success} items={lesson.safetySteps} />
          {!!lesson.transcript && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.h3, { color: colors.text }]} accessibilityRole="header">Transcript</Text>
              <Text style={[styles.body, { color: colors.textSecondary }]} selectable>{lesson.transcript}</Text>
            </View>
          )}
          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            Videos are AI-generated dramatizations for education. Names, people and situations are not real. If you think you have been targeted, stop contact and call your bank or local police using a number you look up yourself.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function Header({ lesson }: { lesson: ScamVideoLesson }) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.cat, { color: colors.primary }]}>{lesson.category.toUpperCase()}</Text>
      <Text style={[styles.h1, { color: colors.text }]} accessibilityRole="header">{lesson.title}</Text>
      {lesson.status === "ready" && lesson.videoUrl ? (
        <Text style={[styles.meta, { color: colors.textSecondary }]}>Video · {formatDuration(lesson.durationSeconds)}</Text>
      ) : (
        <Text style={[styles.meta, { color: colors.textSecondary }]}>Written lesson · video coming later</Text>
      )}
      <Text style={[styles.body, { color: colors.textSecondary }]}>{lesson.summary}</Text>
    </View>
  );
}

function Section({ title, icon, tint, items }: { title: string; icon: keyof typeof Feather.glyphMap; tint: string; items: string[] }) {
  const colors = useColors();
  if (!items?.length) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.secHead}>
        <Feather name={icon} size={18} color={tint} />
        <Text style={[styles.h3, { color: colors.text }]} accessibilityRole="header">{title}</Text>
      </View>
      {items.map((t, i) => (
        <View key={i} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: tint }]} />
          <Text style={[styles.body, { color: colors.text, flex: 1 }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function LessonPlayer({ url, title }: { url: string; title: string }) {
  const colors = useColors();
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  const { status, error } = useEvent(player, "statusChange", { status: player.status });
  const [retryError, setRetryError] = useState(false);

  useFocusEffect(useCallback(() => () => { try { player.pause(); } catch {} }, [player]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") { try { player.pause(); } catch {} }
    });
    return () => sub.remove();
  }, [player]);

  const retry = async () => {
    setRetryError(false);
    try {
      await player.replaceAsync(url);
    } catch {
      setRetryError(true);
    }
  };

  return (
    <View style={[styles.videoWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={`Video: ${title}`}>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" allowsFullscreen />
      {status === "loading" && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.overlayText, { color: colors.textSecondary }]}>Loading video</Text>
        </View>
      )}
      {(status === "error" || retryError) && (
        <View style={[styles.overlay, { backgroundColor: colors.surface }]}>
          <Feather name="wifi-off" size={28} color={colors.textMuted} />
          <Text style={[styles.overlayText, { color: colors.text }]}>
            {error?.message ? "The video could not be played." : "The video could not be loaded."}
          </Text>
          <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel="Retry loading video"
            style={[styles.btn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Try again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  videoWrap: { width: "100%", maxWidth: 420, alignSelf: "center", aspectRatio: 9 / 16, maxHeight: 620, borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
  overlayText: { fontFamily: "Inter_500Medium", fontSize: 14, textAlign: "center" },
  planned: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "flex-start" },
  plannedText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13.5, lineHeight: 19 },
  cat: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.2 },
  h1: { fontFamily: "Inter_700Bold", fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h2: { fontFamily: "Inter_700Bold", fontSize: 18 },
  h3: { fontFamily: "Inter_700Bold", fontSize: 16 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12.5 },
  body: { fontFamily: "Inter_400Regular", fontSize: 14.5, lineHeight: 21 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  secHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  item: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, minHeight: 44, justifyContent: "center" },
  btnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  disclaimer: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
});
