import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,

  Animated,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";

import { Feather } from "@expo/vector-icons";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";
const BASE = DOMAIN ? `https://${DOMAIN}` : "";
const SW = Dimensions.get("window").width;

type Mode = "image" | "animation";
type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";
type AnimStyle = "flow" | "zoom" | "pan" | "morph";

interface ImageResult {
  id: string;
  mode: "image";
  prompt: string;
  b64: string;
  size: ImageSize;
}
interface AnimationResult {
  id: string;
  mode: "animation";
  prompt: string;
  frames: string[];
  frameCount: number;
  fps: number;
}
type GenerationResult = ImageResult | AnimationResult;

const SIZE_OPTIONS: { label: string; value: ImageSize }[] = [
  { label: "Square", value: "1024x1024" },
  { label: "Landscape", value: "1536x1024" },
  { label: "Portrait", value: "1024x1536" },
];

const FRAME_OPTIONS = [4, 6, 8, 12];
const FPS_OPTIONS = [4, 6, 8, 12, 16];
const STYLE_OPTIONS: { label: string; value: AnimStyle; icon: string; desc: string }[] = [
  { label: "Flow", value: "flow", icon: "🌊", desc: "Organic motion" },
  { label: "Zoom", value: "zoom", icon: "🔍", desc: "Cinematic push" },
  { label: "Pan", value: "pan", icon: "🎬", desc: "Camera sweep" },
  { label: "Morph", value: "morph", icon: "✨", desc: "Transformation" },
];

// ── Save / Share helpers ───────────────────────────────────────────────────────
async function writeBase64ToCache(b64: string, filename: string): Promise<string> {
  const path = (FileSystem.cacheDirectory ?? "") + filename;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

async function saveToGallery(b64: string, filename: string): Promise<boolean> {
  if (Platform.OS === "web") {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${b64}`;
    link.download = filename;
    link.click();
    return true;
  }
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission Required", "Please allow access to your photo library to save images.");
    return false;
  }
  const path = await writeBase64ToCache(b64, filename);
  await MediaLibrary.saveToLibraryAsync(path);
  return true;
}

async function shareFile(b64: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${b64}`;
    link.download = filename;
    link.click();
    return;
  }
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) { Alert.alert("Sharing not available on this device."); return; }
  const path = await writeBase64ToCache(b64, filename);
  await Sharing.shareAsync(path, { mimeType: "image/png", dialogTitle: "Share AI Image" });
}

// ── Smooth cross-fade animation player ────────────────────────────────────────
// Double-buffered: current frame visible, next frame fades in on top.
function SmoothPlayer({ frames, fps }: { frames: string[]; fps: number }) {
  const [currIdx, setCurrIdx] = useState(0);
  const [nextIdx, setNextIdx] = useState(1 % frames.length);
  const [dotIdx, setDotIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [playing, setPlaying] = useState(true);
  const playingRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIdxRef = useRef(0);

  const frameDuration = Math.max(1000 / fps, 60);
  const fadeDuration = frameDuration * 0.7;

  const advance = useCallback(() => {
    if (!playingRef.current) return;
    const nextFrame = (currentIdxRef.current + 1) % frames.length;
    setNextIdx(nextFrame);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: fadeDuration,
      useNativeDriver: true,
    }).start(() => {
      currentIdxRef.current = nextFrame;
      setCurrIdx(nextFrame);
      setDotIdx(nextFrame);
      setNextIdx((nextFrame + 1) % frames.length);
      fadeAnim.setValue(0);
    });
  }, [frames.length, fadeDuration]);

  useEffect(() => {
    currentIdxRef.current = 0;
    setCurrIdx(0);
    setNextIdx(1 % frames.length);
    setDotIdx(0);
    fadeAnim.setValue(0);
    playingRef.current = true;
    setPlaying(true);

    intervalRef.current = setInterval(advance, frameDuration);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      fadeAnim.stopAnimation();
    };
  }, [frames, fps]);

  const togglePlay = () => {
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
    if (!playingRef.current) {
      fadeAnim.stopAnimation();
      fadeAnim.setValue(0);
    }
  };

  return (
    <View style={playerStyles.container}>
      {/* Current frame (always visible) */}
      <Image
        source={{ uri: `data:image/png;base64,${frames[currIdx]}` }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {/* Next frame fades in */}
      <Animated.Image
        source={{ uri: `data:image/png;base64,${frames[nextIdx]}` }}
        style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
        resizeMode="cover"
      />

      {/* Frame progress dots */}
      <View style={playerStyles.dots}>
        {frames.map((_, i) => (
          <View
            key={i}
            style={[
              playerStyles.dot,
              i === dotIdx ? playerStyles.dotActive : playerStyles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Play/Pause + fps badge */}
      <View style={playerStyles.controls}>
        <TouchableOpacity style={playerStyles.playBtn} onPress={togglePlay}>
          <Text style={playerStyles.playBtnText}>{playing ? "⏸" : "▶"}</Text>
        </TouchableOpacity>
        <View style={playerStyles.fpsBadge}>
          <Text style={playerStyles.fpsBadgeText}>{fps} fps · {frames.length} frames</Text>
        </View>
      </View>
    </View>
  );
}

const playerStyles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#080818",
  },
  dots: {
    position: "absolute",
    bottom: 44,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 16,
    backgroundColor: "#fff",
  },
  dotInactive: {
    width: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  controls: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnText: {
    fontSize: 12,
    color: "#fff",
  },
  fpsBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fpsBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: "#93C5FD",
  },
});

// ── Action Buttons ─────────────────────────────────────────────────────────────
function ResultActions({ result }: { result: GenerationResult }) {
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  const b64 = result.mode === "image" ? result.b64 : result.frames[0];
  const filename = `swiftop_${result.id}.png`;

  const handleSave = async () => {
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (result.mode === "animation") {
        for (let i = 0; i < result.frames.length; i++) {
          await saveToGallery(result.frames[i], `swiftop_${result.id}_f${i + 1}.png`);
        }
        if (Platform.OS !== "web") {
          Alert.alert("Saved!", `All ${result.frames.length} frames saved to your photo library.`);
        }
      } else {
        const ok = await saveToGallery(b64, filename);
        if (ok && Platform.OS !== "web") Alert.alert("Saved!", "Image saved to your photo library.");
      }
    } catch {
      Alert.alert("Save Failed", "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await shareFile(b64, filename);
    } catch {
      Alert.alert("Share Failed", "Could not share. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={actionStyles.row}>
      <TouchableOpacity style={[actionStyles.btn, actionStyles.saveBtn]} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : (
          <><Text style={actionStyles.icon}>⬇</Text><Text style={actionStyles.saveText}>{result.mode === "animation" ? "Save All Frames" : "Save to Gallery"}</Text></>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={[actionStyles.btn, actionStyles.shareBtn]} onPress={handleShare} disabled={sharing} activeOpacity={0.8}>
        {sharing ? <ActivityIndicator color="#A78BFA" size="small" /> : (
          <><Text style={actionStyles.shareIcon}>↑</Text><Text style={actionStyles.shareText}>Share</Text></>
        )}
      </TouchableOpacity>
    </View>
  );
}

const actionStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12 },
  saveBtn: { backgroundColor: "#7C3AED" },
  icon: { fontSize: 14, color: "#fff" },
  saveText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  shareBtn: { backgroundColor: "#1E1535", borderWidth: 1, borderColor: "#3D2F5A" },
  shareIcon: { fontSize: 14, color: "#A78BFA" },
  shareText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#A78BFA" },
});

// ── Quick prompts ──────────────────────────────────────────────────────────────
const IMAGE_PROMPTS = [
  "A glowing city skyline at night",
  "A wolf howling under a neon moon",
  "Crystal palace in a frozen tundra",
  "Cyberpunk street market in the rain",
];
const ANIMATION_PROMPTS = [
  "A rocket launching into space",
  "Ocean waves crashing at golden hour",
  "A phoenix rising from the ashes",
  "Storm clouds rolling over mountains",
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SwiftopAIScreen() {
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [frameCount, setFrameCount] = useState(8);
  const [animStyle, setAnimStyle] = useState<AnimStyle>("flow");
  const [fps, setFps] = useState(8);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [selected, setSelected] = useState<GenerationResult | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");

  const quickPrompts = mode === "image" ? IMAGE_PROMPTS : ANIMATION_PROMPTS;

  const generate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setLoadingMsg(mode === "image" ? "Synthesizing your image..." : `Chaining ${frameCount} frames with visual continuity...`);

    try {
      if (mode === "image") {
        const res = await fetch(`${BASE}/api/swiftop/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, size }),
        });
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json() as { b64_json: string };
        const result: ImageResult = { id: Date.now().toString(), mode: "image", prompt: trimmed, b64: data.b64_json, size };
        setResults((prev) => [result, ...prev]);
        setSelected(result);
      } else {
        const res = await fetch(`${BASE}/api/swiftop/generate-animation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, frameCount, style: animStyle, fps }),
        });
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json() as { frames: string[]; frameCount: number; fps: number };
        const result: AnimationResult = {
          id: Date.now().toString(),
          mode: "animation",
          prompt: trimmed,
          frames: data.frames,
          frameCount: data.frameCount,
          fps: data.fps ?? fps,
        };
        setResults((prev) => [result, ...prev]);
        setSelected(result);
      }
    } catch {
      Alert.alert("Generation Failed", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }, [prompt, mode, size, frameCount, animStyle, fps, loading]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <LinearGradient colors={["#0A0A12", "#0F0A1E", "#0A0A12"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Swiftop AI</Text>
            <Text style={styles.headerSub}>Cinematic image & animation generator</Text>
          </View>
          <Feather name="zap" size={22} color="#A78BFA" />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mode Toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity style={[styles.modeBtn, mode === "image" && styles.modeBtnImg]} onPress={() => { setMode("image"); setSelected(null); }}>
              <Text style={[styles.modeBtnText, mode === "image" && styles.modeBtnTextActive]}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modeBtn, mode === "animation" && styles.modeBtnAnim]} onPress={() => { setMode("animation"); setSelected(null); }}>
              <Text style={[styles.modeBtnText, mode === "animation" && styles.modeBtnTextActive]}>Animation</Text>
            </TouchableOpacity>
          </View>

          {/* Prompt */}
          <View style={styles.inputCard}>
            <TextInput
              style={[styles.promptInput, { color: "#F0E6FF" }]}
              value={prompt}
              onChangeText={setPrompt}
              placeholder={mode === "image" ? "Describe the image you want..." : "Describe your animation scene..."}
              placeholderTextColor="#4A3D6A"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={4000}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
              {quickPrompts.map((qp) => (
                <TouchableOpacity key={qp} style={styles.quickChip} onPress={() => setPrompt(qp)}>
                  <Text style={styles.quickChipText} numberOfLines={1}>{qp}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Settings */}
          {mode === "image" ? (
            <View style={styles.settingsRow}>
              {SIZE_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt.value} style={[styles.chip, size === opt.value && styles.chipActive]} onPress={() => setSize(opt.value)}>
                  <Text style={[styles.chipText, size === opt.value && styles.chipTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.animSettings}>
              {/* Style */}
              <Text style={styles.settingLabel}>Style</Text>
              <View style={styles.styleGrid}>
                {STYLE_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.styleCard, animStyle === s.value && styles.styleCardActive]}
                    onPress={() => setAnimStyle(s.value)}
                  >
                    <Text style={styles.styleIcon}>{s.icon}</Text>
                    <Text style={[styles.styleLabel, animStyle === s.value && styles.styleLabelActive]}>{s.label}</Text>
                    <Text style={styles.styleDesc}>{s.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Frames */}
              <Text style={styles.settingLabel}>Frames</Text>
              <View style={styles.chipRow}>
                {FRAME_OPTIONS.map((f) => (
                  <TouchableOpacity key={f} style={[styles.chip, frameCount === f && styles.chipActive]} onPress={() => setFrameCount(f)}>
                    <Text style={[styles.chipText, frameCount === f && styles.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* FPS */}
              <Text style={styles.settingLabel}>Speed (fps)</Text>
              <View style={styles.chipRow}>
                {FPS_OPTIONS.map((f) => (
                  <TouchableOpacity key={f} style={[styles.chip, fps === f && styles.chipActiveBlue]} onPress={() => setFps(f)}>
                    <Text style={[styles.chipText, fps === f && styles.chipTextBlue]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Generate */}
          <TouchableOpacity style={[styles.generateBtn, loading && styles.generateBtnDisabled]} onPress={generate} disabled={loading || !prompt.trim()} activeOpacity={0.8}>
            <LinearGradient
              colors={mode === "image" ? ["#7C3AED", "#9F5DFF"] : ["#1D4ED8", "#3B82F6"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.generateGradient}
            >
              {loading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.generateText}>{loadingMsg}</Text>
                </View>
              ) : (
                <Text style={styles.generateText}>
                  {mode === "image" ? "✦  Generate Image" : "✦  Generate Animation"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Result */}
          {selected && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>{selected.mode === "animation" ? "Animation" : "Generated Image"}</Text>
              <Text style={styles.resultPrompt} numberOfLines={2}>{selected.prompt}</Text>

              {selected.mode === "image" ? (
                <Image
                  source={{ uri: `data:image/png;base64,${selected.b64}` }}
                  style={[
                    styles.resultImage,
                    selected.size === "1536x1024" ? { aspectRatio: 1536 / 1024 } :
                    selected.size === "1024x1536" ? { aspectRatio: 1024 / 1536 } :
                    { aspectRatio: 1 },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <SmoothPlayer frames={selected.frames} fps={selected.fps} />
              )}

              <ResultActions result={selected} />
            </View>
          )}

          {/* History */}
          {results.length > 1 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Session History</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {results.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.historyThumb, r.id === selected?.id && styles.historyThumbSelected]}
                    onPress={() => setSelected(r)}
                  >
                    <Image
                      source={{ uri: `data:image/png;base64,${r.mode === "image" ? r.b64 : r.frames[0]}` }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>{r.mode === "image" ? "IMG" : "ANIM"}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Empty state */}
          {results.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✦</Text>
              <Text style={styles.emptyTitle}>Your AI Canvas</Text>
              <Text style={styles.emptySubtitle}>Type a prompt and generate something extraordinary</Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#2D1F4A" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backArrow: { fontSize: 22, color: "#A78BFA" },
  headerCenter: { flex: 1 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#E0D0FF", letterSpacing: 0.2 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#6B5B8A", marginTop: 1 },
  headerIcon: { width: 28, height: 28, borderRadius: 7 },
  scroll: { padding: 16, gap: 14 },
  modeRow: { flexDirection: "row", backgroundColor: "#14102A", borderRadius: 12, padding: 4, gap: 4 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  modeBtnImg: { backgroundColor: "#7C3AED" },
  modeBtnAnim: { backgroundColor: "#1D4ED8" },
  modeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#5A4A7A" },
  modeBtnTextActive: { color: "#fff" },
  inputCard: { backgroundColor: "#14102A", borderRadius: 14, borderWidth: 1, borderColor: "#2D1F4A", overflow: "hidden" },
  promptInput: { fontFamily: "Inter_400Regular", fontSize: 15, padding: 14, minHeight: 90, lineHeight: 22 },
  quickRow: { paddingHorizontal: 10, paddingBottom: 10 },
  quickChip: { backgroundColor: "#1E1535", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, borderWidth: 1, borderColor: "#3D2F5A" },
  quickChipText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#8B7AB0", maxWidth: 160 },
  settingsRow: { flexDirection: "row", gap: 8 },
  animSettings: { gap: 10 },
  settingLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#5A4A7A", textTransform: "uppercase", letterSpacing: 0.8 },
  styleGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  styleCard: { width: (SW - 52) / 4, padding: 10, borderRadius: 12, alignItems: "center", gap: 3, backgroundColor: "#14102A", borderWidth: 1, borderColor: "#2D1F4A" },
  styleCardActive: { backgroundColor: "#1E1A40", borderColor: "#7C3AED" },
  styleIcon: { fontSize: 18 },
  styleLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#5A4A7A" },
  styleLabelActive: { color: "#C4A8FF" },
  styleDesc: { fontFamily: "Inter_400Regular", fontSize: 9, color: "#3D2F5A", textAlign: "center" },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: "#14102A", borderWidth: 1, borderColor: "#2D1F4A" },
  chipActive: { backgroundColor: "#2D1A5A", borderColor: "#7C3AED" },
  chipActiveBlue: { backgroundColor: "#1A2B5A", borderColor: "#3B82F6" },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#5A4A7A" },
  chipTextActive: { color: "#C4A8FF" },
  chipTextBlue: { color: "#93C5FD" },
  generateBtn: { borderRadius: 14, overflow: "hidden" },
  generateBtnDisabled: { opacity: 0.75 },
  generateGradient: { paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  generateText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", letterSpacing: 0.3 },
  resultCard: { backgroundColor: "#14102A", borderRadius: 16, borderWidth: 1, borderColor: "#2D1F4A", padding: 14, gap: 10 },
  resultLabel: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#7C3AED", textTransform: "uppercase", letterSpacing: 1 },
  resultPrompt: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#8B7AB0", lineHeight: 18 },
  resultImage: { width: "100%", borderRadius: 12, backgroundColor: "#0A0818" },
  historySection: { gap: 10 },
  historyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#6B5B8A" },
  historyThumb: { width: 72, height: 72, borderRadius: 10, marginRight: 10, overflow: "hidden", borderWidth: 2, borderColor: "transparent", backgroundColor: "#14102A" },
  historyThumbSelected: { borderColor: "#7C3AED" },
  historyBadge: { position: "absolute", bottom: 4, left: 4, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 },
  historyBadgeText: { fontFamily: "Inter_700Bold", fontSize: 8, color: "#A78BFA" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 40, color: "#3D2F5A" },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#3D2F5A" },
  emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#2D1F4A", textAlign: "center", lineHeight: 20, maxWidth: SW * 0.7 },
});
