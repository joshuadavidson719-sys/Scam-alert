import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
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
import { useColors } from "@/hooks/useColors";

const APP_ICON = require("@/assets/images/icon.png");

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

const SW = Dimensions.get("window").width;

type Mode = "image" | "animation";
type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

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
}

type GenerationResult = ImageResult | AnimationResult;

const SIZE_OPTIONS: { label: string; value: ImageSize }[] = [
  { label: "Square", value: "1024x1024" },
  { label: "Landscape", value: "1536x1024" },
  { label: "Portrait", value: "1024x1536" },
];

const FRAME_OPTIONS = [2, 3, 4, 5, 6];

// ── Save / Share helpers ───────────────────────────────────────────────────────

async function writeBase64ToCache(b64: string, filename: string): Promise<string> {
  const path = (FileSystem.cacheDirectory ?? "") + filename;
  await FileSystem.writeAsStringAsync(path, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

async function saveToGallery(b64: string, filename: string): Promise<void> {
  if (Platform.OS === "web") {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${b64}`;
    link.download = filename;
    link.click();
    return;
  }
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission Required", "Please allow access to your photo library to save images.");
    return;
  }
  const path = await writeBase64ToCache(b64, filename);
  await MediaLibrary.saveToLibraryAsync(path);
  Alert.alert("Saved!", "Image saved to your photo library.");
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
  if (!isAvailable) {
    Alert.alert("Sharing not available on this device.");
    return;
  }
  const path = await writeBase64ToCache(b64, filename);
  await Sharing.shareAsync(path, { mimeType: "image/png", dialogTitle: "Share AI Image" });
}

// ── Animated Frame Player ──────────────────────────────────────────────────────
function AnimatedPlayer({ frames, style }: { frames: string[]; style?: object }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (frames.length < 2) return;
    timerRef.current = setInterval(() => {
      setIdx((prev) => (prev + 1) % frames.length);
    }, 333);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [frames]);

  if (!frames[idx]) return null;
  return (
    <Image
      source={{ uri: `data:image/png;base64,${frames[idx]}` }}
      style={[{ width: "100%", aspectRatio: 1, borderRadius: 12 }, style]}
      resizeMode="cover"
    />
  );
}

// ── Action bar below a result ─────────────────────────────────────────────────
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
        // Save all frames
        for (let i = 0; i < result.frames.length; i++) {
          await saveToGallery(result.frames[i], `swiftop_${result.id}_frame${i + 1}.png`);
        }
        if (Platform.OS !== "web") {
          Alert.alert("Saved!", `All ${result.frames.length} frames saved to your photo library.`);
        }
      } else {
        await saveToGallery(b64, filename);
      }
    } catch {
      Alert.alert("Save Failed", "Could not save the image. Please try again.");
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
      Alert.alert("Share Failed", "Could not share the image. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={actionStyles.row}>
      <TouchableOpacity
        style={[actionStyles.btn, actionStyles.saveBtn]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={actionStyles.btnIcon}>⬇</Text>
            <Text style={actionStyles.saveText}>
              {result.mode === "animation" ? "Save All Frames" : "Save to Gallery"}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[actionStyles.btn, actionStyles.shareBtn]}
        onPress={handleShare}
        disabled={sharing}
        activeOpacity={0.8}
      >
        {sharing ? (
          <ActivityIndicator color="#A78BFA" size="small" />
        ) : (
          <>
            <Text style={actionStyles.shareIcon}>↑</Text>
            <Text style={actionStyles.shareText}>Share</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const actionStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  saveBtn: {
    backgroundColor: "#7C3AED",
  },
  btnIcon: {
    fontSize: 14,
    color: "#fff",
  },
  saveText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
  },
  shareBtn: {
    backgroundColor: "#1E1535",
    borderWidth: 1,
    borderColor: "#3D2F5A",
  },
  shareIcon: {
    fontSize: 14,
    color: "#A78BFA",
  },
  shareText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#A78BFA",
  },
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
  "Ocean waves at sunrise, evolving",
  "A flower blooming in slow motion",
  "Lightning storm over mountains",
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function SwiftopAIScreen() {
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [frameCount, setFrameCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [selected, setSelected] = useState<GenerationResult | null>(null);

  const quickPrompts = mode === "image" ? IMAGE_PROMPTS : ANIMATION_PROMPTS;

  const generate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    try {
      if (mode === "image") {
        const res = await fetch(`${BASE}/api/swiftop/generate-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, size }),
        });
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json() as { b64_json: string };
        const result: ImageResult = {
          id: Date.now().toString(),
          mode: "image",
          prompt: trimmed,
          b64: data.b64_json,
          size,
        };
        setResults((prev) => [result, ...prev]);
        setSelected(result);
      } else {
        const res = await fetch(`${BASE}/api/swiftop/generate-animation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, frameCount }),
        });
        if (!res.ok) throw new Error("Generation failed");
        const data = await res.json() as { frames: string[]; frameCount: number };
        const result: AnimationResult = {
          id: Date.now().toString(),
          mode: "animation",
          prompt: trimmed,
          frames: data.frames,
          frameCount: data.frameCount,
        };
        setResults((prev) => [result, ...prev]);
        setSelected(result);
      }
    } catch {
      Alert.alert("Generation Failed", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [prompt, mode, size, frameCount, loading]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#0A0A12", "#0F0A1E", "#0A0A12"]}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Swiftop AI</Text>
            <Text style={styles.headerSub}>Image & Animation Generator</Text>
          </View>
          <Image source={APP_ICON} style={styles.headerIcon} resizeMode="cover" />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mode Toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "image" && styles.modeBtnActive]}
              onPress={() => { setMode("image"); setSelected(null); }}
            >
              <Text style={[styles.modeBtnText, mode === "image" && styles.modeBtnTextActive]}>
                Image
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === "animation" && styles.modeBtnActiveAnim]}
              onPress={() => { setMode("animation"); setSelected(null); }}
            >
              <Text style={[styles.modeBtnText, mode === "animation" && styles.modeBtnTextActive]}>
                Animation
              </Text>
            </TouchableOpacity>
          </View>

          {/* Prompt Input */}
          <View style={styles.inputCard}>
            <TextInput
              style={[styles.promptInput, { color: "#F0E6FF" }]}
              value={prompt}
              onChangeText={setPrompt}
              placeholder={mode === "image" ? "Describe the image you want to create..." : "Describe the animation scene..."}
              placeholderTextColor="#4A3D6A"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={4000}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
              {quickPrompts.map((qp) => (
                <TouchableOpacity
                  key={qp}
                  style={styles.quickChip}
                  onPress={() => setPrompt(qp)}
                >
                  <Text style={styles.quickChipText} numberOfLines={1}>{qp}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Settings */}
          {mode === "image" ? (
            <View style={styles.settingsRow}>
              {SIZE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.settingChip, size === opt.value && styles.settingChipActive]}
                  onPress={() => setSize(opt.value)}
                >
                  <Text style={[styles.settingChipText, size === opt.value && styles.settingChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.frameRow}>
              <Text style={styles.frameLabel}>Frames:</Text>
              {FRAME_OPTIONS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.frameChip, frameCount === f && styles.frameChipActive]}
                  onPress={() => setFrameCount(f)}
                >
                  <Text style={[styles.frameChipText, frameCount === f && styles.frameChipTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Generate Button */}
          <TouchableOpacity
            style={[styles.generateBtn, loading && styles.generateBtnLoading]}
            onPress={generate}
            disabled={loading || !prompt.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={mode === "image" ? ["#7C3AED", "#9F5DFF"] : ["#1D4ED8", "#3B82F6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.generateBtnGradient}
            >
              {loading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.generateBtnText}>
                    {mode === "image" ? "Creating image..." : `Generating ${frameCount} frames...`}
                  </Text>
                </View>
              ) : (
                <Text style={styles.generateBtnText}>
                  {mode === "image" ? "✦  Generate Image" : "✦  Generate Animation"}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Result Display */}
          {selected && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>
                {selected.mode === "animation" ? "Animation" : "Generated Image"}
              </Text>
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
                <View style={styles.animationWrap}>
                  <AnimatedPlayer frames={selected.frames} />
                  <View style={styles.animBadge}>
                    <Text style={styles.animBadgeText}>{selected.frameCount} frames · looping</Text>
                  </View>
                </View>
              )}

              {/* ── Save / Share Actions ── */}
              <ResultActions result={selected} />
            </View>
          )}

          {/* History Gallery */}
          {results.length > 1 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Session History</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.historyRow}>
                {results.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.historyThumb, r.id === selected?.id && styles.historyThumbSelected]}
                    onPress={() => setSelected(r)}
                  >
                    {r.mode === "image" ? (
                      <Image
                        source={{ uri: `data:image/png;base64,${r.b64}` }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image
                        source={{ uri: `data:image/png;base64,${r.frames[0]}` }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>
                        {r.mode === "image" ? "IMG" : "ANIM"}
                      </Text>
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
              <Text style={styles.emptySubtitle}>
                Type a prompt and tap Generate to create something extraordinary
              </Text>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2D1F4A",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    fontSize: 22,
    color: "#A78BFA",
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#E0D0FF",
    letterSpacing: 0.2,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "#6B5B8A",
    marginTop: 1,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  modeRow: {
    flexDirection: "row",
    backgroundColor: "#14102A",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  modeBtnActive: {
    backgroundColor: "#7C3AED",
  },
  modeBtnActiveAnim: {
    backgroundColor: "#1D4ED8",
  },
  modeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#5A4A7A",
  },
  modeBtnTextActive: {
    color: "#fff",
  },
  inputCard: {
    backgroundColor: "#14102A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2D1F4A",
    overflow: "hidden",
  },
  promptInput: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    padding: 14,
    minHeight: 90,
    lineHeight: 22,
  },
  quickRow: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  quickChip: {
    backgroundColor: "#1E1535",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#3D2F5A",
  },
  quickChipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#8B7AB0",
    maxWidth: 160,
  },
  settingsRow: {
    flexDirection: "row",
    gap: 8,
  },
  settingChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#14102A",
    borderWidth: 1,
    borderColor: "#2D1F4A",
  },
  settingChipActive: {
    backgroundColor: "#2D1A5A",
    borderColor: "#7C3AED",
  },
  settingChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#5A4A7A",
  },
  settingChipTextActive: {
    color: "#C4A8FF",
  },
  frameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  frameLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#6B5B8A",
  },
  frameChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#14102A",
    borderWidth: 1,
    borderColor: "#2D1F4A",
  },
  frameChipActive: {
    backgroundColor: "#1A2B5A",
    borderColor: "#3B82F6",
  },
  frameChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#5A4A7A",
  },
  frameChipTextActive: {
    color: "#93C5FD",
  },
  generateBtn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  generateBtnLoading: {
    opacity: 0.75,
  },
  generateBtnGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  generateBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
    letterSpacing: 0.3,
  },
  resultCard: {
    backgroundColor: "#14102A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2D1F4A",
    padding: 14,
    gap: 10,
  },
  resultLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "#7C3AED",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resultPrompt: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#8B7AB0",
    lineHeight: 18,
  },
  resultImage: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "#0A0818",
  },
  animationWrap: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  animBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  animBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#93C5FD",
  },
  historySection: {
    gap: 10,
  },
  historyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#6B5B8A",
  },
  historyRow: {
    flexDirection: "row",
  },
  historyThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    marginRight: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#14102A",
  },
  historyThumbSelected: {
    borderColor: "#7C3AED",
  },
  historyBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  historyBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: "#A78BFA",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
    color: "#3D2F5A",
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#3D2F5A",
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#2D1F4A",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: SW * 0.7,
  },
});
