import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

interface Theme {
  id: ThemeMode;
  name: string;
  emoji: string;
  preview: string[];
  description: string;
}

const THEMES: Theme[] = [
  {
    id: "dark",
    name: "Dark",
    emoji: "🌑",
    preview: ["#000000", "#1A1A1A", "#FF3B3B"],
    description: "Classic dark mode",
  },
  {
    id: "light",
    name: "Neon Green",
    emoji: "💚",
    preview: ["#39FF14", "#FFFFFF", "#FF3B3B"],
    description: "Fluorescent green theme",
  },
  {
    id: "alert-red",
    name: "Alert Red",
    emoji: "🔴",
    preview: ["#0A0000", "#1E0000", "#FF1A1A"],
    description: "High-alert crimson dark",
  },
  {
    id: "midnight",
    name: "Midnight",
    emoji: "🌌",
    preview: ["#020617", "#1E293B", "#818CF8"],
    description: "Deep navy indigo",
  },
  {
    id: "safe-green",
    name: "Safe Green",
    emoji: "🛡️",
    preview: ["#001A0F", "#003322", "#10B981"],
    description: "Forest security green",
  },
  {
    id: "ocean",
    name: "Ocean",
    emoji: "🌊",
    preview: ["#001824", "#003044", "#0EA5E9"],
    description: "Deep ocean blue",
  },
  {
    id: "purple-haze",
    name: "Purple Haze",
    emoji: "💜",
    preview: ["#0D0018", "#1E0033", "#A855F7"],
    description: "Mystic violet dark",
  },
  {
    id: "system",
    name: "System",
    emoji: "📱",
    preview: ["#000000", "#FFFFFF", "#FF3B3B"],
    description: "Follows device theme",
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CustomThemePicker({ visible, onClose }: Props) {
  const colors = useColors();
  const { mode, setMode } = useTheme();

  const handleSelect = async (id: ThemeMode) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(id);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Choose Theme</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {THEMES.map((t) => {
            const isActive = mode === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => handleSelect(t.id)}
                activeOpacity={0.8}
                style={[
                  styles.themeCard,
                  { backgroundColor: colors.surface ?? colors.background, borderColor: isActive ? colors.primary : colors.border },
                  isActive && { borderWidth: 2 },
                ]}
              >
                {/* Preview dots */}
                <View style={styles.previewRow}>
                  {t.preview.map((c, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: c }]} />
                  ))}
                </View>

                <Text style={styles.themeEmoji}>{t.emoji}</Text>
                <Text style={[styles.themeName, { color: colors.text }]}>{t.name}</Text>
                <Text style={[styles.themeDesc, { color: colors.textMuted }]}>{t.description}</Text>

                {isActive && (
                  <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={10} color="#fff" />
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "75%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 20 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  themeCard: {
    width: "47%",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 6,
    alignItems: "flex-start",
  },
  previewRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  themeEmoji: { fontSize: 22 },
  themeName: { fontFamily: "Inter_700Bold", fontSize: 14 },
  themeDesc: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  activeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#fff" },
});
