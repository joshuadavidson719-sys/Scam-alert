import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth, CATEGORIES, type CategoryId } from "@/context/AuthContext";
import { CategoryPill } from "@/components/CategoryPill";
import { router } from "expo-router";

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("scam-alert");
  const [loading, setLoading] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handlePost = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please add a title for your post.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Missing Description", "Please add a description.");
      return;
    }
    if (!user || !profile) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName: profile.username,
        authorAvatar: profile.profilePhoto ?? null,
        title: title.trim(),
        description: description.trim(),
        images: imageUrl.trim() ? [imageUrl.trim()] : [],
        category: selectedCategory,
        likes: [],
        commentCount: 0,
        shareCount: 0,
        reports: [],
        createdAt: serverTimestamp(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle("");
      setDescription("");
      setImageUrl("");
      setSelectedCategory("scam-alert");
      router.replace("/(tabs)/" as never);
    } catch {
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 10, paddingBottom: insets.bottom + 100 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>New Post</Text>
        <TouchableOpacity
          style={[
            styles.postBtn,
            { backgroundColor: title && description ? colors.primary : colors.muted },
          ]}
          onPress={handlePost}
          disabled={loading || !title || !description}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Category
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat.id}
            categoryId={cat.id}
            isSelected={selectedCategory === cat.id}
            onPress={() => setSelectedCategory(cat.id)}
          />
        ))}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Title *
      </Text>
      <TextInput
        style={[
          styles.titleInput,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
        ]}
        placeholder="What's the scam or news?"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        multiline
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>
        {title.length}/100
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Description *
      </Text>
      <TextInput
        style={[
          styles.descInput,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
        ]}
        placeholder="Provide details about the scam, how it works, what to watch out for..."
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Image URL (optional)
      </Text>
      <View
        style={[
          styles.inputRow,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <Feather name="image" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.urlInput, { color: colors.text }]}
          placeholder="https://example.com/image.jpg"
          placeholderTextColor={colors.textMuted}
          value={imageUrl}
          onChangeText={setImageUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
      </View>

      <View
        style={[
          styles.disclaimerBox,
          { backgroundColor: colors.warning + "15", borderColor: colors.warning + "44" },
        ]}
      >
        <Feather name="info" size={14} color={colors.warning} />
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          All content is user-submitted and for awareness purposes only. Ensure your post follows our Community Guidelines.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
  },
  postBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  postBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  sectionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  categoryRow: {
    paddingBottom: 4,
    paddingRight: 16,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    lineHeight: 24,
    minHeight: 60,
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  descInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    minHeight: 160,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  urlInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
  },
  disclaimerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
