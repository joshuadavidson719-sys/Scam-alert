import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useLocalSearchParams, router } from "expo-router";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth, CATEGORIES, type CategoryId } from "@/context/AuthContext";
import { CategoryPill } from "@/components/CategoryPill";

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("scam-alert");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "posts", id));
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title ?? "");
          setDescription(data.description ?? "");
          setSelectedCategory((data.category as CategoryId) ?? "scam-alert");
        }
      } catch {
        Alert.alert("Error", "Could not load post.");
        router.back();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please add a title.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Missing Description", "Please add a description.");
      return;
    }
    if (!user || !id) return;
    setSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateDoc(doc(db, "posts", id), {
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
        updatedAt: serverTimestamp(),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Could not save post. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 10, paddingBottom: insets.bottom + 80 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 20, color: colors.text }}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Edit Post</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: title && description ? colors.primary : colors.muted }]}
          onPress={handleSave}
          disabled={saving || !title || !description}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat.id}
            categoryId={cat.id}
            isSelected={selectedCategory === cat.id}
            onPress={() => setSelectedCategory(cat.id)}
          />
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
      <TextInput
        style={[styles.titleInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
        placeholder="Post title"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        multiline
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>{title.length}/100</Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
      <TextInput
        style={[styles.descInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
        placeholder="Describe the scam in detail..."
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  pageTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10 },
  saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  categoryRow: { paddingBottom: 4, paddingRight: 16 },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    lineHeight: 24,
    minHeight: 60,
  },
  charCount: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", marginTop: 4 },
  descInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    minHeight: 180,
  },
});
