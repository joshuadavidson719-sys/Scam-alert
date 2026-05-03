import React, { useState, useRef, useCallback } from "react";
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
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import ViewShot from "react-native-view-shot";
import { useColors } from "@/hooks/useColors";

// ── Types ─────────────────────────────────────────────────────────────────────
type ElementType = "text" | "sticker" | "shape";
type ToolTab = "background" | "text" | "sticker" | "shape";

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
  shapeType?: "rect" | "circle";
  shapeSize?: number;
}

interface Background {
  type: "solid" | "gradient" | "image";
  colors: string[];
  imageUri?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CANVAS_SIZE = Math.min(Dimensions.get("window").width - 32, 340);

const BG_PRESETS: Background[] = [
  { type: "solid", colors: ["#0F0F0F"] },
  { type: "solid", colors: ["#FFFFFF"] },
  { type: "solid", colors: ["#FF3B3B"] },
  { type: "solid", colors: ["#1A1A2E"] },
  { type: "solid", colors: ["#0D1B2A"] },
  { type: "solid", colors: ["#1B4332"] },
  { type: "gradient", colors: ["#FF3B3B", "#8B0000"] },
  { type: "gradient", colors: ["#1A1A2E", "#16213E"] },
  { type: "gradient", colors: ["#0D1B2A", "#1B4332"] },
  { type: "gradient", colors: ["#FF6B6B", "#FFD93D"] },
  { type: "gradient", colors: ["#6C63FF", "#3F3D56"] },
  { type: "gradient", colors: ["#11998E", "#38EF7D"] },
  { type: "gradient", colors: ["#FC5C7D", "#6A3093"] },
  { type: "gradient", colors: ["#F7971E", "#FFD200"] },
  { type: "gradient", colors: ["#000000", "#434343"] },
];

const TEXT_COLORS = [
  "#FFFFFF", "#FF3B3B", "#FFD93D", "#10B981", "#3B82F6",
  "#EC4899", "#F97316", "#8B5CF6", "#06B6D4", "#000000",
];

const FONT_SIZES = [14, 18, 24, 32, 42, 56];

const STICKER_ROWS = [
  ["🚨", "⚠️", "🔥", "💯", "❗", "‼️", "🆘", "🛑"],
  ["😱", "😡", "😤", "🤯", "😰", "🫢", "🙈", "💀"],
  ["👀", "👁️", "🔍", "🕵️", "🔒", "🛡️", "⚡", "💥"],
  ["✅", "❌", "🚫", "💔", "🤝", "👊", "💪", "🦾"],
  ["💰", "💳", "🏦", "📱", "💻", "📩", "🎣", "🕷️"],
  ["🌹", "⭐", "🏆", "🎯", "📢", "📣", "🔔", "💬"],
];

const SHAPE_COLORS = [
  "#FF3B3B", "#F97316", "#FFD93D", "#10B981", "#3B82F6",
  "#8B5CF6", "#EC4899", "#FFFFFF", "#000000", "#6B7280",
];

// ── Draggable element ─────────────────────────────────────────────────────────
function DraggableElement({
  el,
  selected,
  canvasSize,
  onSelect,
  onMove,
}: {
  el: CanvasElement;
  selected: boolean;
  canvasSize: number;
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
        const nx = Math.max(0, Math.min(canvasSize - 40, posRef.current.x + g.dx));
        const ny = Math.max(0, Math.min(canvasSize - 40, posRef.current.y + g.dy));
        onMove(nx, ny);
      },
    })
  ).current;

  const renderContent = () => {
    if (el.type === "shape") {
      const size = el.shapeSize ?? 60;
      return (
        <View
          style={{
            width: size,
            height: el.shapeType === "circle" ? size : size * 0.6,
            borderRadius: el.shapeType === "circle" ? size / 2 : 8,
            backgroundColor: el.color,
          }}
        />
      );
    }
    return (
      <Text
        style={{
          fontSize: el.fontSize,
          color: el.type === "sticker" ? undefined : el.color,
          fontWeight: el.bold ? "bold" : "normal",
          fontStyle: el.italic ? "italic" : "normal",
          textShadowColor: el.type === "text" ? "rgba(0,0,0,0.5)" : undefined,
          textShadowOffset: el.type === "text" ? { width: 1, height: 1 } : undefined,
          textShadowRadius: el.type === "text" ? 3 : 0,
        }}
      >
        {el.content}
      </Text>
    );
  };

  return (
    <View
      {...pan.panHandlers}
      style={[
        styles.element,
        { left: el.x, top: el.y },
        selected && styles.elementSelected,
      ]}
    >
      {renderContent()}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CreatorStudio() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const shotRef = useRef<ViewShot>(null);

  const [bg, setBg] = useState<Background>(BG_PRESETS[6]);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolTab>("background");
  const [history, setHistory] = useState<CanvasElement[][]>([[]]);

  // Text editor modal
  const [textModal, setTextModal] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textSize, setTextSize] = useState(24);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Shape options
  const [shapeType, setShapeType] = useState<"rect" | "circle">("rect");
  const [shapeColor, setShapeColor] = useState("#FF3B3B");
  const [shapeSize, setShapeSize] = useState(80);

  const selectedEl = elements.find((e) => e.id === selectedId) ?? null;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const pushHistory = (els: CanvasElement[]) => {
    setHistory((h) => [...h.slice(-20), els]);
  };

  const undo = () => {
    if (history.length <= 1) return;
    const prev = history[history.length - 2];
    setHistory((h) => h.slice(0, -1));
    setElements(prev);
    setSelectedId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addElement = (el: CanvasElement) => {
    const next = [...elements, el];
    setElements(next);
    pushHistory(next);
    setSelectedId(el.id);
  };

  const updateElement = (id: string, patch: Partial<CanvasElement>) => {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const next = elements.filter((e) => e.id !== selectedId);
    setElements(next);
    pushHistory(next);
    setSelectedId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

  // ── Text ──────────────────────────────────────────────────────────────────
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
      setTextInput("");
      setTextColor("#FFFFFF");
      setTextSize(24);
      setTextBold(false);
      setTextItalic(false);
      setEditingId(null);
    }
    setTextModal(true);
  };

  const commitText = () => {
    if (!textInput.trim()) { setTextModal(false); return; }
    if (editingId) {
      updateElement(editingId, {
        content: textInput.trim(),
        color: textColor,
        fontSize: textSize,
        bold: textBold,
        italic: textItalic,
      });
    } else {
      addElement({
        id: Date.now().toString(),
        type: "text",
        content: textInput.trim(),
        x: CANVAS_SIZE / 2 - 60,
        y: CANVAS_SIZE / 2 - 20,
        color: textColor,
        fontSize: textSize,
        bold: textBold,
        italic: textItalic,
      });
    }
    setTextModal(false);
  };

  // ── Sticker ───────────────────────────────────────────────────────────────
  const addSticker = (emoji: string) => {
    addElement({
      id: Date.now().toString(),
      type: "sticker",
      content: emoji,
      x: CANVAS_SIZE / 2 - 24,
      y: CANVAS_SIZE / 2 - 24,
      color: "#000",
      fontSize: 48,
      bold: false,
      italic: false,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Shape ─────────────────────────────────────────────────────────────────
  const addShape = () => {
    addElement({
      id: Date.now().toString(),
      type: "shape",
      content: "",
      x: CANVAS_SIZE / 2 - shapeSize / 2,
      y: CANVAS_SIZE / 2 - shapeSize / 2,
      color: shapeColor,
      fontSize: 14,
      bold: false,
      italic: false,
      shapeType,
      shapeSize,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ── Image background ──────────────────────────────────────────────────────
  const pickBgImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setBg({ type: "image", colors: [], imageUri: result.assets[0].uri });
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setSelectedId(null);
      await new Promise((r) => setTimeout(r, 100));
      const uri = await (shotRef.current as any).capture();
      await Share.share({ url: uri, title: "My Scam Alert Creation" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Export failed", "Could not export your design. Please try again.");
    }
  };

  // ── Canvas background render ───────────────────────────────────────────────
  const renderBg = () => {
    if (bg.type === "image" && bg.imageUri) {
      return (
        <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
          {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }]} />
        </View>
      );
    }
    if (bg.type === "gradient") {
      return (
        <LinearGradient
          colors={bg.colors as [string, string]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      );
    }
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: bg.colors[0] }]} />;
  };

  // ── Tool panels ───────────────────────────────────────────────────────────
  const renderToolPanel = () => {
    switch (activeTool) {
      case "background":
        return (
          <View style={styles.toolPanel}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Background</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.bgRow}>
                {BG_PRESETS.map((preset, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setBg(preset); Haptics.selectionAsync(); }}
                    style={[styles.bgSwatch, bg === preset && styles.bgSwatchSelected]}
                  >
                    {preset.type === "gradient" ? (
                      <LinearGradient
                        colors={preset.colors as [string, string]}
                        style={styles.bgSwatchInner}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    ) : (
                      <View style={[styles.bgSwatchInner, { backgroundColor: preset.colors[0] }]} />
                    )}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={pickBgImage} style={[styles.bgSwatch, { borderStyle: "dashed" }]}>
                  <View style={[styles.bgSwatchInner, { backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }]}>
                    <Feather name="image" size={18} color={colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        );

      case "text":
        return (
          <View style={styles.toolPanel}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Text</Text>
            <TouchableOpacity
              style={[styles.addTextBtn, { backgroundColor: colors.primary }]}
              onPress={() => { setActiveTool("text"); openTextModal(); }}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.addTextBtnLabel}>Add Text</Text>
            </TouchableOpacity>
            {selectedEl?.type === "text" && (
              <TouchableOpacity
                style={[styles.addTextBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, marginTop: 8 }]}
                onPress={() => openTextModal(selectedEl.id)}
              >
                <Feather name="edit-2" size={14} color={colors.text} />
                <Text style={[styles.addTextBtnLabel, { color: colors.text }]}>Edit Selected Text</Text>
              </TouchableOpacity>
            )}
          </View>
        );

      case "sticker":
        return (
          <ScrollView style={styles.toolPanel} showsVerticalScrollIndicator={false}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Stickers</Text>
            {STICKER_ROWS.map((row, ri) => (
              <View key={ri} style={styles.stickerRow}>
                {row.map((emoji) => (
                  <TouchableOpacity key={emoji} style={styles.stickerBtn} onPress={() => addSticker(emoji)}>
                    <Text style={styles.stickerEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        );

      case "shape":
        return (
          <View style={styles.toolPanel}>
            <Text style={[styles.panelTitle, { color: colors.textMuted }]}>Shapes</Text>
            <View style={styles.shapeTypeRow}>
              {(["rect", "circle"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.shapeTypeBtn, { backgroundColor: shapeType === t ? colors.primary : colors.muted }]}
                  onPress={() => setShapeType(t)}
                >
                  <Text style={[styles.shapeTypeBtnLabel, { color: shapeType === t ? "#fff" : colors.text }]}>
                    {t === "rect" ? "Rectangle" : "Circle"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
                {SHAPE_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setShapeColor(c)}
                    style={[styles.colorDot, { backgroundColor: c }, shapeColor === c && styles.colorDotSelected]}
                  />
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.addTextBtn, { backgroundColor: shapeColor }]}
              onPress={addShape}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.addTextBtnLabel}>Add {shapeType === "rect" ? "Rectangle" : "Circle"}</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Nav */}
      <View style={[styles.nav, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Creator Studio</Text>
        <View style={styles.navRight}>
          <TouchableOpacity onPress={undo} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="corner-up-left" size={20} color={history.length > 1 ? colors.text : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: colors.primary }]}
            onPress={handleExport}
          >
            <Feather name="share" size={14} color="#fff" />
            <Text style={styles.exportBtnLabel}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas */}
      <View style={styles.canvasWrapper}>
        <ViewShot
          ref={shotRef}
          options={{ format: "jpg", quality: 0.95 }}
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        >
          <View style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, overflow: "hidden" }}>
            {renderBg()}
            {/* Watermark */}
            <Text style={styles.watermark}>Scam Alert</Text>
            {/* Elements */}
            {elements.map((el) => (
              <DraggableElement
                key={el.id}
                el={el}
                selected={el.id === selectedId}
                canvasSize={CANVAS_SIZE}
                onSelect={() => setSelectedId(el.id)}
                onMove={(x, y) => updateElement(el.id, { x, y })}
              />
            ))}
          </View>
        </ViewShot>

        {/* Element action bar */}
        {selectedEl && (
          <View style={[styles.elementActions, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {selectedEl.type === "text" && (
              <TouchableOpacity style={styles.elAction} onPress={() => openTextModal(selectedEl.id)}>
                <Feather name="edit-2" size={16} color={colors.primary} />
                <Text style={[styles.elActionLabel, { color: colors.primary }]}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.elAction} onPress={bringForward}>
              <Feather name="arrow-up" size={16} color={colors.text} />
              <Text style={[styles.elActionLabel, { color: colors.text }]}>Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.elAction} onPress={deleteSelected}>
              <Feather name="trash-2" size={16} color="#EF4444" />
              <Text style={[styles.elActionLabel, { color: "#EF4444" }]}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.elAction} onPress={() => setSelectedId(null)}>
              <Feather name="x" size={16} color={colors.textMuted} />
              <Text style={[styles.elActionLabel, { color: colors.textMuted }]}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tool tabs */}
      <View style={[styles.toolTabs, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
        {([
          { key: "background", icon: "image", label: "BG" },
          { key: "text", icon: "type", label: "Text" },
          { key: "sticker", icon: "smile", label: "Sticker" },
          { key: "shape", icon: "square", label: "Shape" },
        ] as { key: ToolTab; icon: string; label: string }[]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.toolTab, activeTool === t.key && { borderTopColor: colors.primary, borderTopWidth: 2 }]}
            onPress={() => { setActiveTool(t.key); Haptics.selectionAsync(); }}
          >
            <Feather name={t.icon as any} size={20} color={activeTool === t.key ? colors.primary : colors.textMuted} />
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

      {/* Text editor modal */}
      <Modal visible={textModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingId ? "Edit Text" : "Add Text"}
              </Text>
              <TouchableOpacity onPress={() => setTextModal(false)}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Preview */}
            <View style={[styles.textPreview, { backgroundColor: colors.background }]}>
              <Text style={{
                color: textColor,
                fontSize: textSize,
                fontWeight: textBold ? "bold" : "normal",
                fontStyle: textItalic ? "italic" : "normal",
              }}>
                {textInput || "Preview text"}
              </Text>
            </View>

            {/* Input */}
            <TextInput
              style={[styles.textInputField, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="Type something..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={120}
              autoFocus
            />

            {/* Color */}
            <Text style={[styles.optionLabel, { color: colors.textMuted }]}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.colorRow}>
                {TEXT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setTextColor(c)}
                    style={[styles.colorDot, { backgroundColor: c }, textColor === c && styles.colorDotSelected]}
                  />
                ))}
              </View>
            </ScrollView>

            {/* Size */}
            <Text style={[styles.optionLabel, { color: colors.textMuted }]}>Size</Text>
            <View style={styles.sizeRow}>
              {FONT_SIZES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setTextSize(s)}
                  style={[styles.sizeBtn, { backgroundColor: textSize === s ? colors.primary : colors.muted }]}
                >
                  <Text style={[styles.sizeBtnLabel, { color: textSize === s ? "#fff" : colors.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Bold / Italic */}
            <View style={styles.styleRow}>
              <TouchableOpacity
                onPress={() => setTextBold((v) => !v)}
                style={[styles.styleBtn, { backgroundColor: textBold ? colors.primary : colors.muted }]}
              >
                <Text style={[styles.styleBtnLabel, { color: textBold ? "#fff" : colors.text, fontWeight: "bold" }]}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTextItalic((v) => !v)}
                style={[styles.styleBtn, { backgroundColor: textItalic ? colors.primary : colors.muted }]}
              >
                <Text style={[styles.styleBtnLabel, { color: textItalic ? "#fff" : colors.text, fontStyle: "italic" }]}>I</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.commitBtn, { backgroundColor: colors.primary }]}
              onPress={commitText}
            >
              <Text style={styles.commitBtnLabel}>{editingId ? "Update" : "Add to Canvas"}</Text>
            </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  navRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  navBtn: { padding: 2 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  exportBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },

  canvasWrapper: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  element: {
    position: "absolute",
  },
  elementSelected: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 4,
    padding: 2,
  },
  watermark: {
    position: "absolute",
    bottom: 8,
    right: 10,
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 1,
  },
  elementActions: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  elAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  elActionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  toolTabs: {
    flexDirection: "row",
    borderTopWidth: 1,
  },
  toolTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    gap: 3,
    borderTopWidth: 2,
    borderTopColor: "transparent",
  },
  toolTabLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10 },

  toolPanelWrap: {
    flex: 1,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toolPanel: { flex: 1 },
  panelTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  bgRow: { flexDirection: "row", gap: 8 },
  bgSwatch: {
    width: 54,
    height: 54,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  bgSwatchSelected: { borderColor: "#FF3B3B" },
  bgSwatchInner: { flex: 1 },

  addTextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addTextBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },

  stickerRow: { flexDirection: "row", gap: 4, marginBottom: 4 },
  stickerBtn: { flex: 1, alignItems: "center", paddingVertical: 6 },
  stickerEmoji: { fontSize: 28 },

  shapeTypeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  shapeTypeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  shapeTypeBtnLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  colorRow: { flexDirection: "row", gap: 8 },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotSelected: { borderColor: "#fff", transform: [{ scale: 1.2 }] },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
    maxHeight: "90%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  textPreview: {
    height: 70,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  textInputField: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    minHeight: 60,
  },
  optionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sizeRow: { flexDirection: "row", gap: 6 },
  sizeBtn: {
    width: 44,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 13 },
  styleRow: { flexDirection: "row", gap: 8 },
  styleBtn: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  styleBtnLabel: { fontSize: 20 },
  commitBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  commitBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
});
