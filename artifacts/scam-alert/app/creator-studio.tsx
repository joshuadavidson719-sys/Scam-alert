import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  Modal,
  TextInput,
  Alert,
  Share,
  Dimensions,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import ViewShot from "react-native-view-shot";
import { useColors } from "@/hooks/useColors";

// ── Types ──────────────────────────────────────────────────────────────────────
type ElementType = "text" | "sticker" | "shape" | "image";
type ToolTab = "background" | "text" | "sticker" | "shape" | "image";
type CanvasFormat = "square" | "story" | "banner";

interface CanvasElement {
  id: string;
  type: ElementType;
  content: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  scale: number;
  rotation: number;
  shapeType?: "rect" | "circle";
  shapeSize?: number;
  imageUri?: string;
  imageW?: number;
  imageH?: number;
}

interface Background {
  type: "solid" | "gradient" | "image";
  colors: string[];
  imageUri?: string;
  icon: string;
  name: string;
}

interface Draft {
  id: string;
  name: string;
  savedAt: number;
  bg: Background;
  elements: CanvasElement[];
  format: CanvasFormat;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const SW = Dimensions.get("window").width;

const FORMATS: Record<CanvasFormat, { label: string; icon: string; w: number; h: number }> = {
  square: { label: "Square", icon: "⬜", w: Math.min(SW - 32, 320), h: Math.min(SW - 32, 320) },
  story:  { label: "Story",  icon: "📱", w: Math.min(SW - 32, 320) * (9 / 16), h: Math.min(SW - 32, 320) },
  banner: { label: "Banner", icon: "🖼️", w: Math.min(SW - 32, 320), h: Math.min(SW - 32, 320) * (9 / 16) },
};

const BG_PRESETS: Background[] = [
  { type: "solid",    colors: ["#0F0F0F"], icon: "🌑", name: "Dark" },
  { type: "solid",    colors: ["#FFFFFF"], icon: "☀️",  name: "White" },
  { type: "solid",    colors: ["#FF3B3B"], icon: "🚨", name: "Alert" },
  { type: "solid",    colors: ["#1A1A2E"], icon: "🌌", name: "Deep Blue" },
  { type: "solid",    colors: ["#0D1B2A"], icon: "🌊", name: "Ocean" },
  { type: "solid",    colors: ["#1B4332"], icon: "🌲", name: "Forest" },
  { type: "gradient", colors: ["#FF3B3B", "#8B0000"], icon: "🔥", name: "Fire" },
  { type: "gradient", colors: ["#1A1A2E", "#16213E"], icon: "🌃", name: "Night" },
  { type: "gradient", colors: ["#FF6B6B", "#FFD93D"], icon: "🌅", name: "Sunset" },
  { type: "gradient", colors: ["#6C63FF", "#3F3D56"], icon: "💜", name: "Purple" },
  { type: "gradient", colors: ["#11998E", "#38EF7D"], icon: "💚", name: "Emerald" },
  { type: "gradient", colors: ["#FC5C7D", "#6A3093"], icon: "🌸", name: "Pink" },
  { type: "gradient", colors: ["#F7971E", "#FFD200"], icon: "🌟", name: "Gold" },
  { type: "gradient", colors: ["#000000", "#434343"], icon: "💨", name: "Smoke" },
  { type: "gradient", colors: ["#0F2027", "#2C5364"], icon: "🌐", name: "Deep Sea" },
];

const TEXT_COLORS: { hex: string; icon: string; name: string }[] = [
  { hex: "#FFFFFF", icon: "⬜", name: "White" },
  { hex: "#FF3B3B", icon: "🔴", name: "Red" },
  { hex: "#FFD93D", icon: "🟡", name: "Yellow" },
  { hex: "#10B981", icon: "🟢", name: "Green" },
  { hex: "#3B82F6", icon: "🔵", name: "Blue" },
  { hex: "#EC4899", icon: "🌸", name: "Pink" },
  { hex: "#F97316", icon: "🟠", name: "Orange" },
  { hex: "#8B5CF6", icon: "💜", name: "Purple" },
  { hex: "#06B6D4", icon: "🩵", name: "Cyan" },
  { hex: "#000000", icon: "⬛", name: "Black" },
];
const FONT_SIZES  = [12, 16, 20, 28, 36, 48];
const SCALE_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ROT_STEP    = 15;

const STICKER_ROWS = [
  ["🚨","⚠️","🔥","💯","❗","‼️","🆘","🛑"],
  ["😱","😡","😤","🤯","😰","🫢","🙈","💀"],
  ["👀","👁️","🔍","🕵️","🔒","🛡️","⚡","💥"],
  ["✅","❌","🚫","💔","🤝","👊","💪","🦾"],
  ["💰","💳","🏦","📱","💻","📩","🎣","🕷️"],
  ["🌹","⭐","🏆","🎯","📢","📣","🔔","💬"],
];
const SHAPE_COLORS: { hex: string; icon: string; name: string }[] = [
  { hex: "#FF3B3B", icon: "🔴", name: "Red" },
  { hex: "#F97316", icon: "🟠", name: "Orange" },
  { hex: "#FFD93D", icon: "🟡", name: "Yellow" },
  { hex: "#10B981", icon: "🟢", name: "Green" },
  { hex: "#3B82F6", icon: "🔵", name: "Blue" },
  { hex: "#8B5CF6", icon: "💜", name: "Purple" },
  { hex: "#EC4899", icon: "🌸", name: "Pink" },
  { hex: "#FFFFFF", icon: "⬜", name: "White" },
  { hex: "#000000", icon: "⬛", name: "Black" },
  { hex: "#6B7280", icon: "🩶", name: "Grey" },
];

const TEXT_PRESETS = [
  { icon: "🔠", name: "Heading",   color: "#FFFFFF", size: 36, bold: true,  italic: false, sample: "HEADING" },
  { icon: "📝", name: "Body",      color: "#FFFFFF", size: 20, bold: false, italic: false, sample: "Body text" },
  { icon: "💬", name: "Caption",   color: "#CCCCCC", size: 14, bold: false, italic: true,  sample: "Caption..." },
  { icon: "🚨", name: "Alert",     color: "#FF3B3B", size: 28, bold: true,  italic: false, sample: "ALERT!" },
  { icon: "💡", name: "Tip",       color: "#FFD93D", size: 20, bold: false, italic: true,  sample: "Pro tip:" },
  { icon: "⬛", name: "Dark",      color: "#000000", size: 22, bold: true,  italic: false, sample: "Dark text" },
];

const STICKER_CATEGORIES = [
  { icon: "🚨", label: "Alerts & Danger" },
  { icon: "😱", label: "Reactions" },
  { icon: "🔍", label: "Investigation" },
  { icon: "✅", label: "Status & Actions" },
  { icon: "💰", label: "Cyber & Scams" },
  { icon: "📢", label: "Broadcast" },
];

const DRAFTS_KEY = "@studio_drafts_v2";
const MAX_DRAFTS = 8;

// ── Draggable element ──────────────────────────────────────────────────────────
function DraggableElement({
  el, selected, canvasW, canvasH, onSelect, onMove,
}: {
  el: CanvasElement; selected: boolean;
  canvasW: number; canvasH: number;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const posRef = useRef({ x: el.x, y: el.y });

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        posRef.current = { x: el.x, y: el.y };
        onSelect();
        Haptics.selectionAsync();
      },
      onPanResponderMove: (_, g) => {
        const nx = Math.max(0, Math.min(canvasW - 20, posRef.current.x + g.dx));
        const ny = Math.max(0, Math.min(canvasH - 20, posRef.current.y + g.dy));
        onMove(nx, ny);
      },
    })
  ).current;

  const transform = [{ scale: el.scale }, { rotate: `${el.rotation}deg` }];

  const renderContent = () => {
    if (el.type === "shape") {
      const sz = (el.shapeSize ?? 60) * el.scale;
      return (
        <View style={{
          width: sz,
          height: el.shapeType === "circle" ? sz : sz * 0.6,
          borderRadius: el.shapeType === "circle" ? sz / 2 : 8,
          backgroundColor: el.color,
          transform: [{ rotate: `${el.rotation}deg` }],
        }} />
      );
    }
    if (el.type === "image" && el.imageUri) {
      const w = (el.imageW ?? 100) * el.scale;
      const h = (el.imageH ?? 100) * el.scale;
      return (
        <Image
          source={{ uri: el.imageUri }}
          style={{ width: w, height: h, borderRadius: 8, transform: [{ rotate: `${el.rotation}deg` }] }}
          resizeMode="cover"
        />
      );
    }
    return (
      <Text style={{
        fontSize: el.fontSize,
        color: el.type === "sticker" ? undefined : el.color,
        fontWeight: el.bold ? "bold" : "normal",
        fontStyle: el.italic ? "italic" : "normal",
        transform: [{ scale: el.scale }, { rotate: `${el.rotation}deg` }],
        textShadowColor: el.type === "text" ? "rgba(0,0,0,0.55)" : undefined,
        textShadowOffset: el.type === "text" ? { width: 1, height: 1 } : undefined,
        textShadowRadius: el.type === "text" ? 4 : 0,
      }}>
        {el.content}
      </Text>
    );
  };

  return (
    <View
      {...pan.panHandlers}
      style={[styles.element, { left: el.x, top: el.y }, selected && styles.elementSelected]}
    >
      {renderContent()}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function CreatorStudio() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const shotRef = useRef<any>(null);

  const [format, setFormat]     = useState<CanvasFormat>("square");
  const [bg, setBg]             = useState<Background>(BG_PRESETS[6]);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolTab>("background");
  const [history, setHistory]   = useState<CanvasElement[][]>([[]]);

  // Text modal
  const [textModal, setTextModal]   = useState(false);
  const [textInput, setTextInput]   = useState("");
  const [textColor, setTextColor]   = useState("#FFFFFF");
  const [textSize, setTextSize]     = useState(24);
  const [textBold, setTextBold]     = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);

  // Shape options
  const [shapeType, setShapeType]   = useState<"rect" | "circle">("rect");
  const [shapeColor, setShapeColor] = useState("#FF3B3B");
  const [shapeSize, setShapeSize]   = useState(80);

  // Drafts modal
  const [draftsModal, setDraftsModal] = useState(false);
  const [drafts, setDrafts]           = useState<Draft[]>([]);

  const canvasW = FORMATS[format].w;
  const canvasH = FORMATS[format].h;
  const selectedEl = elements.find((e) => e.id === selectedId) ?? null;

  // Load drafts on mount
  useEffect(() => {
    AsyncStorage.getItem(DRAFTS_KEY).then((v) => {
      if (v) setDrafts(JSON.parse(v));
    });
  }, []);

  // ── History ────────────────────────────────────────────────────────────────
  const pushHistory = (els: CanvasElement[]) =>
    setHistory((h) => [...h.slice(-25), els]);

  const undo = () => {
    if (history.length <= 1) return;
    const prev = history[history.length - 2];
    setHistory((h) => h.slice(0, -1));
    setElements(prev);
    setSelectedId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Elements ───────────────────────────────────────────────────────────────
  const addElement = (el: CanvasElement) => {
    const next = [...elements, el];
    setElements(next);
    pushHistory(next);
    setSelectedId(el.id);
  };

  const updateEl = (id: string, patch: Partial<CanvasElement>) =>
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const deleteSelected = () => {
    if (!selectedId) return;
    const next = elements.filter((e) => e.id !== selectedId);
    setElements(next);
    pushHistory(next);
    setSelectedId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const duplicateSelected = () => {
    if (!selectedEl) return;
    const clone: CanvasElement = {
      ...selectedEl,
      id: Date.now().toString(),
      x: selectedEl.x + 20,
      y: selectedEl.y + 20,
    };
    addElement(clone);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const bringForward = () => {
    if (!selectedId) return;
    const idx = elements.findIndex((e) => e.id === selectedId);
    if (idx < elements.length - 1) {
      const next = [...elements];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      setElements(next);
    }
  };

  const sendBackward = () => {
    if (!selectedId) return;
    const idx = elements.findIndex((e) => e.id === selectedId);
    if (idx > 0) {
      const next = [...elements];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      setElements(next);
    }
  };

  const scaleSelected = (delta: number) => {
    if (!selectedEl) return;
    const cur = SCALE_STEPS.indexOf(
      SCALE_STEPS.reduce((a, b) => Math.abs(b - selectedEl.scale) < Math.abs(a - selectedEl.scale) ? b : a)
    );
    const next = SCALE_STEPS[Math.max(0, Math.min(SCALE_STEPS.length - 1, cur + delta))];
    updateEl(selectedEl.id, { scale: next });
    Haptics.selectionAsync();
  };

  const rotateSelected = (deg: number) => {
    if (!selectedEl) return;
    updateEl(selectedEl.id, { rotation: ((selectedEl.rotation + deg) % 360 + 360) % 360 });
    Haptics.selectionAsync();
  };

  // ── Text ───────────────────────────────────────────────────────────────────
  const openTextModal = (id?: string) => {
    if (id) {
      const el = elements.find((e) => e.id === id);
      if (el) {
        setTextInput(el.content);
        setTextColor(el.color);
        setTextSize(el.fontSize);
        setTextBold(el.bold);
        setTextItalic(el.italic);
        setEditingId(id);
      }
    } else {
      setTextInput(""); setTextColor("#FFFFFF"); setTextSize(24);
      setTextBold(false); setTextItalic(false); setEditingId(null);
    }
    setTextModal(true);
  };

  const commitText = () => {
    if (!textInput.trim()) { setTextModal(false); return; }
    if (editingId) {
      updateEl(editingId, {
        content: textInput.trim(), color: textColor,
        fontSize: textSize, bold: textBold, italic: textItalic,
      });
    } else {
      addElement({
        id: Date.now().toString(), type: "text",
        content: textInput.trim(),
        x: canvasW / 2 - 60, y: canvasH / 2 - 20,
        color: textColor, fontSize: textSize,
        bold: textBold, italic: textItalic,
        scale: 1, rotation: 0,
      });
    }
    setTextModal(false);
  };

  // ── Sticker ────────────────────────────────────────────────────────────────
  const addSticker = (emoji: string) => {
    addElement({
      id: Date.now().toString(), type: "sticker", content: emoji,
      x: canvasW / 2 - 24, y: canvasH / 2 - 24,
      color: "#000", fontSize: 48, bold: false, italic: false,
      scale: 1, rotation: 0,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Image sticker ──────────────────────────────────────────────────────────
  const pickImageSticker = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const { uri, width: iw, height: ih } = result.assets[0];
      const displayH = 100;
      const displayW = iw && ih ? (iw / ih) * displayH : 100;
      addElement({
        id: Date.now().toString(), type: "image", content: "",
        x: canvasW / 2 - displayW / 2, y: canvasH / 2 - displayH / 2,
        color: "#000", fontSize: 14, bold: false, italic: false,
        scale: 1, rotation: 0,
        imageUri: uri, imageW: displayW, imageH: displayH,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // ── Shape ──────────────────────────────────────────────────────────────────
  const addShape = () => {
    addElement({
      id: Date.now().toString(), type: "shape", content: "",
      x: canvasW / 2 - shapeSize / 2, y: canvasH / 2 - shapeSize / 2,
      color: shapeColor, fontSize: 14, bold: false, italic: false,
      scale: 1, rotation: 0, shapeType, shapeSize,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── BG image ───────────────────────────────────────────────────────────────
  const pickBgImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setBg({ type: "image", colors: [], imageUri: result.assets[0].uri });
    }
  };

  // ── Drafts ─────────────────────────────────────────────────────────────────
  const saveDraft = async () => {
    const now = Date.now();
    const draft: Draft = {
      id: now.toString(),
      name: `Design ${new Date(now).toLocaleDateString()} ${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      savedAt: now,
      bg, elements, format,
    };
    const next = [draft, ...drafts].slice(0, MAX_DRAFTS);
    setDrafts(next);
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Draft saved!", "Your design has been saved to drafts.");
  };

  const loadDraft = (draft: Draft) => {
    setBg(draft.bg);
    setElements(draft.elements);
    setFormat(draft.format);
    setSelectedId(null);
    setHistory([draft.elements]);
    setDraftsModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const deleteDraft = async (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setSelectedId(null);
      await new Promise((r) => setTimeout(r, 120));
      const uri = await shotRef.current.capture();
      await Share.share({ url: uri, title: "My Scam Alert Design" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Export failed", "Could not export. Please try again.");
    }
  };

  // ── Canvas BG render ───────────────────────────────────────────────────────
  const renderBg = () => {
    if (bg.type === "image" && bg.imageUri) {
      return (
        <Image
          source={{ uri: bg.imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      );
    }
    if (bg.type === "gradient") {
      return (
        <LinearGradient
          colors={bg.colors as [string, string]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
      );
    }
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: bg.colors[0] }]} />;
  };

  // ── Tool panel ─────────────────────────────────────────────────────────────
  const renderToolPanel = () => {
    switch (activeTool) {
      case "background":
        return (
          <View style={styles.toolPanel}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Canvas Size</Text>
            <View style={styles.formatRow}>
              {(Object.keys(FORMATS) as CanvasFormat[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.formatBtn, { backgroundColor: format === f ? colors.primary : colors.muted }]}
                  onPress={() => { setFormat(f); Haptics.selectionAsync(); }}
                >
                  <Text style={styles.formatIcon}>{FORMATS[f].icon}</Text>
                  <Text style={[styles.formatLabel, { color: format === f ? "#fff" : colors.text }]}>
                    {FORMATS[f].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.panelTitle, { color: colors.textMuted, marginTop: 10 }]}>Background</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.bgRow}>
                {BG_PRESETS.map((preset, i) => {
                  const selected = bg === preset;
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { setBg(preset); Haptics.selectionAsync(); }}
                      style={[styles.bgCard, selected && styles.bgCardSelected]}
                    >
                      {preset.type === "gradient" ? (
                        <LinearGradient
                          colors={preset.colors as [string, string]}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, { backgroundColor: preset.colors[0] }]} />
                      )}
                      <Text style={styles.bgCardIcon}>{preset.icon}</Text>
                      <Text style={styles.bgCardName}>{preset.name}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity onPress={pickBgImage} style={[styles.bgCard, { borderStyle: "dashed", backgroundColor: colors.muted }]}>
                  <Feather name="image" size={22} color={colors.textMuted} />
                  <Text style={[styles.bgCardName, { color: colors.textMuted }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        );

      case "text":
        return (
          <View style={styles.toolPanel}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Quick Styles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {TEXT_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.name}
                    style={[styles.textPresetCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      setTextInput("");
                      setTextColor(p.color);
                      setTextSize(p.size);
                      setTextBold(p.bold);
                      setTextItalic(p.italic);
                      setEditingId(null);
                      setTextModal(true);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text style={styles.textPresetIcon}>{p.icon}</Text>
                    <Text style={[
                      styles.textPresetSample,
                      { color: p.color, fontSize: Math.min(p.size * 0.55, 15),
                        fontWeight: p.bold ? "bold" : "normal",
                        fontStyle: p.italic ? "italic" : "normal" }
                    ]} numberOfLines={1}>{p.sample}</Text>
                    <Text style={[styles.textPresetLabel, { color: colors.textMuted }]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
                {/* Custom */}
                <TouchableOpacity
                  style={[styles.textPresetCard, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "60" }]}
                  onPress={() => openTextModal()}
                >
                  <Text style={styles.textPresetIcon}>✏️</Text>
                  <Text style={[styles.textPresetSample, { color: colors.primary, fontSize: 13, fontWeight: "bold" }]}>Custom</Text>
                  <Text style={[styles.textPresetLabel, { color: colors.primary }]}>Your own</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {selectedEl?.type === "text" && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginTop: 10 }]}
                onPress={() => openTextModal(selectedEl.id)}
              >
                <Text style={{ fontSize: 15 }}>✏️</Text>
                <Text style={[styles.actionBtnLabel, { color: colors.text }]}>Edit Selected Text</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case "sticker":
        return (
          <ScrollView style={styles.toolPanel} showsVerticalScrollIndicator={false}>
            {STICKER_ROWS.map((row, ri) => (
              <View key={ri}>
                <View style={styles.stickerCategoryHeader}>
                  <Text style={styles.stickerCategoryIcon}>{STICKER_CATEGORIES[ri].icon}</Text>
                  <Text style={[styles.stickerCategoryLabel, { color: colors.textMuted }]}>
                    {STICKER_CATEGORIES[ri].label}
                  </Text>
                </View>
                <View style={styles.stickerRow}>
                  {row.map((emoji) => (
                    <TouchableOpacity key={emoji} style={[styles.stickerBtn, { backgroundColor: colors.card }]} onPress={() => addSticker(emoji)}>
                      <Text style={styles.stickerEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        );

      case "image":
        return (
          <View style={styles.toolPanel}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Photo Sticker</Text>
            <View style={styles.photoFeatureGrid}>
              {[
                { icon: "🖼️", title: "Any Photo",   desc: "Pick any image from your gallery" },
                { icon: "↔️", title: "Free Resize",  desc: "Scale up or down with +/− buttons" },
                { icon: "🔄", title: "Rotate",       desc: "Spin it to any angle you like" },
                { icon: "📐", title: "Free Move",    desc: "Drag anywhere on the canvas" },
              ].map((f) => (
                <View key={f.title} style={[styles.photoFeatureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.photoFeatureCardIcon}>{f.icon}</Text>
                  <Text style={[styles.photoFeatureCardTitle, { color: colors.text }]}>{f.title}</Text>
                  <Text style={[styles.photoFeatureCardDesc, { color: colors.textMuted }]}>{f.desc}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 8 }]} onPress={pickImageSticker}>
              <Text style={{ fontSize: 16 }}>🖼️</Text>
              <Text style={styles.actionBtnLabel}>Pick from Gallery</Text>
            </TouchableOpacity>
          </View>
        );

      case "shape":
        return (
          <View style={styles.toolPanel}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Shape</Text>
            <View style={styles.shapeTypeRow}>
              {([
                { t: "rect",   icon: "▬", label: "Rectangle" },
                { t: "circle", icon: "⬤", label: "Circle" },
              ] as const).map(({ t, icon, label }) => {
                const active = shapeType === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.shapeCard, { backgroundColor: active ? shapeColor + "22" : colors.card, borderColor: active ? shapeColor : colors.border }]}
                    onPress={() => setShapeType(t)}
                  >
                    <View style={[
                      styles.shapePreview,
                      { backgroundColor: active ? shapeColor : colors.muted },
                      t === "circle" ? { borderRadius: 999 } : { borderRadius: 6 },
                    ]} />
                    <Text style={styles.shapeCardIcon}>{icon}</Text>
                    <Text style={[styles.shapeCardLabel, { color: active ? shapeColor : colors.text }]}>{label}</Text>
                    {active && <Text style={[styles.shapeCardCheck, { color: shapeColor }]}>✓ Selected</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.panelTitle, { color: colors.textMuted, marginTop: 8 }]}>Colour</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 6, paddingVertical: 4 }}>
                {SHAPE_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => setShapeColor(c.hex)}
                    style={[styles.colorPill, shapeColor === c.hex && { borderColor: c.hex, borderWidth: 2 }, { backgroundColor: colors.muted }]}
                  >
                    <Text style={styles.colorPillIcon}>{c.icon}</Text>
                    <Text style={[styles.colorPillLabel, { color: shapeColor === c.hex ? c.hex : colors.textMuted }]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: shapeColor }]} onPress={addShape}>
              <Text style={{ fontSize: 16 }}>{shapeType === "rect" ? "▬" : "⬤"}</Text>
              <Text style={styles.actionBtnLabel}>Add {shapeType === "rect" ? "Rectangle" : "Circle"}</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      {/* Nav bar */}
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Creator Studio</Text>
        <View style={styles.navRight}>
          <TouchableOpacity
            onPress={undo}
            style={[styles.navLabelBtn, { backgroundColor: history.length > 1 ? colors.card : "transparent", opacity: history.length > 1 ? 1 : 0.35 }]}
          >
            <Feather name="corner-up-left" size={15} color={colors.text} />
            <Text style={[styles.navLabelBtnText, { color: colors.text }]}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDraftsModal(true)}
            style={[styles.navLabelBtn, { backgroundColor: colors.card }]}
          >
            <Feather name="folder" size={15} color={colors.text} />
            <Text style={[styles.navLabelBtnText, { color: colors.text }]}>Drafts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={saveDraft}
            style={[styles.navLabelBtn, { backgroundColor: colors.card }]}
          >
            <Feather name="save" size={15} color={colors.text} />
            <Text style={[styles.navLabelBtnText, { color: colors.text }]}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navLabelBtn, { backgroundColor: colors.primary }]}
            onPress={handleExport}
          >
            <Feather name="share" size={15} color="#fff" />
            <Text style={[styles.navLabelBtnText, { color: "#fff" }]}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas */}
      <View style={[styles.canvasWrapper, { backgroundColor: colors.muted }]}>
        <ViewShot ref={shotRef} options={{ format: "jpg", quality: 0.95 }}
          style={{ width: canvasW, height: canvasH }}>
          <View style={{ width: canvasW, height: canvasH, overflow: "hidden" }}>
            {renderBg()}
            <Text style={styles.watermark}>Scam Alert</Text>
            {elements.map((el) => (
              <DraggableElement
                key={el.id}
                el={el}
                selected={el.id === selectedId}
                canvasW={canvasW}
                canvasH={canvasH}
                onSelect={() => setSelectedId(el.id)}
                onMove={(x, y) => updateEl(el.id, { x, y })}
              />
            ))}
          </View>
        </ViewShot>
      </View>

      {/* Selected element controls */}
      {selectedEl && (
        <View style={[styles.elControls, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Row 1: scale + rotate */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.elCtrlRow}>
            <View style={styles.ctrlGroup}>
              <Text style={[styles.ctrlGroupLabel, { color: colors.textMuted }]}>Size</Text>
              <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: colors.muted }]} onPress={() => scaleSelected(-1)}>
                <Feather name="minus" size={14} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.ctrlValue, { color: colors.text }]}>{Math.round(selectedEl.scale * 100)}%</Text>
              <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: colors.muted }]} onPress={() => scaleSelected(1)}>
                <Feather name="plus" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.ctrlDivider, { backgroundColor: colors.border }]} />

            <View style={styles.ctrlGroup}>
              <Text style={[styles.ctrlGroupLabel, { color: colors.textMuted }]}>Rotate</Text>
              <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: colors.muted }]} onPress={() => rotateSelected(-ROT_STEP)}>
                <Feather name="rotate-ccw" size={14} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.ctrlValue, { color: colors.text }]}>{selectedEl.rotation}°</Text>
              <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: colors.muted }]} onPress={() => rotateSelected(ROT_STEP)}>
                <Feather name="rotate-cw" size={14} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.ctrlDivider, { backgroundColor: colors.border }]} />

            {/* Actions */}
            {selectedEl.type === "text" && (
              <TouchableOpacity style={[styles.ctrlAction, { backgroundColor: colors.primary + "20" }]} onPress={() => openTextModal(selectedEl.id)}>
                <Feather name="edit-2" size={14} color={colors.primary} />
                <Text style={[styles.ctrlActionLabel, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.ctrlAction, { backgroundColor: colors.muted }]} onPress={duplicateSelected}>
              <Feather name="copy" size={14} color={colors.text} />
              <Text style={[styles.ctrlActionLabel, { color: colors.text }]}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlAction, { backgroundColor: colors.muted }]} onPress={bringForward}>
              <Feather name="arrow-up" size={14} color={colors.text} />
              <Text style={[styles.ctrlActionLabel, { color: colors.text }]}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlAction, { backgroundColor: colors.muted }]} onPress={sendBackward}>
              <Feather name="arrow-down" size={14} color={colors.text} />
              <Text style={[styles.ctrlActionLabel, { color: colors.text }]}>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlAction, { backgroundColor: "#EF444420" }]} onPress={deleteSelected}>
              <Feather name="trash-2" size={14} color="#EF4444" />
              <Text style={[styles.ctrlActionLabel, { color: "#EF4444" }]}>Del</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctrlAction, { backgroundColor: colors.muted }]} onPress={() => setSelectedId(null)}>
              <Feather name="x" size={14} color={colors.textMuted} />
              <Text style={[styles.ctrlActionLabel, { color: colors.textMuted }]}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Tool tabs */}
      <View style={[styles.toolTabs, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
        {([
          { key: "background", icon: "image",   label: "BG" },
          { key: "text",       icon: "type",    label: "Text" },
          { key: "sticker",    icon: "smile",   label: "Sticker" },
          { key: "image",      icon: "camera",  label: "Photo" },
          { key: "shape",      icon: "square",  label: "Shape" },
        ] as { key: ToolTab; icon: string; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.toolTab, activeTool === t.key && { borderTopColor: colors.primary, borderTopWidth: 2 }]}
            onPress={() => { setActiveTool(t.key); Haptics.selectionAsync(); }}
          >
            <Feather name={t.icon as any} size={18} color={activeTool === t.key ? colors.primary : colors.textMuted} />
            <Text style={[styles.toolTabLabel, { color: activeTool === t.key ? colors.primary : colors.textMuted }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tool panel */}
      <View style={[styles.toolPanelWrap, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        {renderToolPanel()}
      </View>

      {/* ── Text editor modal ─────────────────────────────────────────────── */}
      <Modal visible={textModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{editingId ? "Edit Text" : "Add Text"}</Text>
              <TouchableOpacity onPress={() => setTextModal(false)}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.textPreview, { backgroundColor: colors.background }]}>
              <Text style={{ color: textColor, fontSize: textSize, fontWeight: textBold ? "bold" : "normal", fontStyle: textItalic ? "italic" : "normal" }}>
                {textInput || "Preview text"}
              </Text>
            </View>

            <TextInput
              style={[styles.textInputField, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={textInput} onChangeText={setTextInput}
              placeholder="Type something..." placeholderTextColor={colors.textMuted}
              multiline maxLength={120} autoFocus
            />

            <Text style={[styles.optionLabel, { color: colors.textMuted }]}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {TEXT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => setTextColor(c.hex)}
                    style={[styles.colorPill, textColor === c.hex && { borderColor: c.hex, borderWidth: 2 }, { backgroundColor: colors.muted }]}
                  >
                    <Text style={styles.colorPillIcon}>{c.icon}</Text>
                    <Text style={[styles.colorPillLabel, { color: textColor === c.hex ? c.hex : colors.textMuted }]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.optionLabel, { color: colors.textMuted }]}>Size</Text>
            <View style={styles.sizeRow}>
              {FONT_SIZES.map((s) => (
                <TouchableOpacity key={s} onPress={() => setTextSize(s)}
                  style={[styles.sizeBtn, { backgroundColor: textSize === s ? colors.primary : colors.muted }]}>
                  <Text style={[styles.sizeBtnLabel, { color: textSize === s ? "#fff" : colors.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.styleRow}>
              <TouchableOpacity onPress={() => setTextBold((v) => !v)}
                style={[styles.styleBtn, { backgroundColor: textBold ? colors.primary : colors.muted }]}>
                <Text style={[styles.styleBtnLabel, { color: textBold ? "#fff" : colors.text, fontWeight: "bold" }]}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTextItalic((v) => !v)}
                style={[styles.styleBtn, { backgroundColor: textItalic ? colors.primary : colors.muted }]}>
                <Text style={[styles.styleBtnLabel, { color: textItalic ? "#fff" : colors.text, fontStyle: "italic" }]}>I</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.commitBtn, { backgroundColor: colors.primary }]} onPress={commitText}>
              <Text style={styles.commitBtnLabel}>{editingId ? "Update" : "Add to Canvas"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Drafts modal ─────────────────────────────────────────────────── */}
      <Modal visible={draftsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Saved Drafts</Text>
              <TouchableOpacity onPress={() => setDraftsModal(false)}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {drafts.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
                <Feather name="folder" size={36} color={colors.textMuted} />
                <Text style={[styles.panelHint, { color: colors.textMuted, textAlign: "center" }]}>
                  No drafts yet. Tap the save icon to save your current design.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {drafts.map((d) => (
                  <View key={d.id} style={[styles.draftRow, { borderColor: colors.border }]}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => loadDraft(d)}>
                      <Text style={[styles.draftName, { color: colors.text }]}>{d.name}</Text>
                      <Text style={[styles.draftMeta, { color: colors.textMuted }]}>
                        {FORMATS[d.format].icon} {FORMATS[d.format].label} · {d.elements.length} elements
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteDraft(d.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1,
  },
  navTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  navRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  navLabelBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20,
  },
  navLabelBtnText: { fontFamily: "Inter_700Bold", fontSize: 11 },

  canvasWrapper: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 10,
  },
  element: { position: "absolute" },
  elementSelected: {
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)",
    borderRadius: 4, padding: 2,
    shadowColor: "#fff", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  watermark: {
    position: "absolute", bottom: 6, right: 8,
    fontFamily: "Inter_700Bold", fontSize: 9,
    color: "rgba(255,255,255,0.28)", letterSpacing: 1,
  },

  // Element controls
  elControls: {
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  elCtrlRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  ctrlGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  ctrlGroupLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10, textTransform: "uppercase" },
  ctrlBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ctrlValue: { fontFamily: "Inter_600SemiBold", fontSize: 12, minWidth: 36, textAlign: "center" },
  ctrlDivider: { width: 1, height: 24, marginHorizontal: 2 },
  ctrlAction: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
  },
  ctrlActionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11 },

  // Tool tabs
  toolTabs: { flexDirection: "row", borderTopWidth: 1 },
  toolTab: {
    flex: 1, alignItems: "center", paddingVertical: 8, gap: 2,
    borderTopWidth: 2, borderTopColor: "transparent",
  },
  toolTabLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9 },

  toolPanelWrap: { flex: 1, borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 10 },
  toolPanel: { flex: 1 },
  panelTitle: {
    fontFamily: "Inter_700Bold", fontSize: 10,
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8,
  },
  panelHint: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },

  // Format
  formatRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  formatBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    justifyContent: "center", paddingVertical: 8, borderRadius: 10,
  },
  formatIcon: { fontSize: 14 },
  formatLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  // BG cards
  bgRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  bgCard: {
    width: 68, height: 80, borderRadius: 12,
    borderWidth: 2, borderColor: "transparent", overflow: "hidden",
    alignItems: "center", justifyContent: "center", gap: 2,
  },
  bgCardSelected: { borderColor: "#FF3B3B" },
  bgCardIcon: { fontSize: 22 },
  bgCardName: {
    fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#fff",
    textAlign: "center", textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  // Buttons
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
  },
  actionBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },

  // Text presets
  textPresetCard: {
    width: 80, paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1,
    alignItems: "center", gap: 4,
  },
  textPresetIcon: { fontSize: 20 },
  textPresetSample: { fontFamily: "Inter_700Bold", textAlign: "center" },
  textPresetLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10 },

  // Stickers
  stickerCategoryHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 4 },
  stickerCategoryIcon: { fontSize: 14 },
  stickerCategoryLabel: { fontFamily: "Inter_700Bold", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  stickerRow: { flexDirection: "row", gap: 4, marginBottom: 4 },
  stickerBtn: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 10 },
  stickerEmoji: { fontSize: 24 },

  // Photo features
  photoFeatureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  photoFeatureCard: {
    width: "47%", borderRadius: 12, borderWidth: 1,
    padding: 10, gap: 3,
  },
  photoFeatureCardIcon: { fontSize: 22 },
  photoFeatureCardTitle: { fontFamily: "Inter_700Bold", fontSize: 12 },
  photoFeatureCardDesc: { fontFamily: "Inter_400Regular", fontSize: 10, lineHeight: 14 },

  // Shapes
  shapeTypeRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  shapeCard: {
    flex: 1, borderRadius: 14, borderWidth: 2,
    alignItems: "center", paddingVertical: 10, paddingHorizontal: 6, gap: 4,
  },
  shapePreview: { width: 36, height: 22 },
  shapeCardIcon: { fontSize: 18 },
  shapeCardLabel: { fontFamily: "Inter_700Bold", fontSize: 12 },
  shapeCardCheck: { fontFamily: "Inter_600SemiBold", fontSize: 9 },

  // Color pills
  colorPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: 20,
    borderWidth: 2, borderColor: "transparent",
  },
  colorPillIcon: { fontSize: 14 },
  colorPillLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11 },

  // Text modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  textPreview: {
    height: 64, borderRadius: 12, alignItems: "center",
    justifyContent: "center", paddingHorizontal: 12,
  },
  textInputField: {
    borderWidth: 1, borderRadius: 12, padding: 12,
    fontFamily: "Inter_400Regular", fontSize: 15, minHeight: 56,
  },
  optionLabel: {
    fontFamily: "Inter_600SemiBold", fontSize: 10,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  sizeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  sizeBtn: { width: 44, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  sizeBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 12 },
  styleRow: { flexDirection: "row", gap: 8 },
  styleBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  styleBtnLabel: { fontSize: 20 },
  commitBtn: { paddingVertical: 14, borderRadius: 14, alignItems: "center", marginTop: 4 },
  commitBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },

  // Drafts
  draftRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  draftName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  draftMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
});
