import React, { useState, useEffect, useRef } from "react";
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
  Image,
  ActionSheetIOS,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth, CATEGORIES, type CategoryId } from "@/context/AuthContext";
import { CategoryPill } from "@/components/CategoryPill";
import { router, useLocalSearchParams } from "expo-router";
import { awardPoints, POINTS } from "@/hooks/usePoints";

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const params = useLocalSearchParams<{
    prefillTitle?: string;
    prefillDescription?: string;
    prefillCategory?: CategoryId;
  }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>("scam-alert");
  const [loading, setLoading] = useState(false);
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [hashtags, setHashtags] = useState("");

  // Image state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const titleInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const appliedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const titleParam = params.prefillTitle;
    if (!titleParam) return;
    const key = `${titleParam}::${params.prefillDescription ?? ""}`;
    if (appliedKeyRef.current === key) return;
    appliedKeyRef.current = key;
    setTitle(titleParam);
    if (params.prefillDescription) setDescription(params.prefillDescription);
    if (params.prefillCategory) setSelectedCategory(params.prefillCategory as CategoryId);
    setIsPrefilled(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 350);
  }, [params.prefillTitle, params.prefillDescription, params.prefillCategory]);

  const pickImage = async (source: "camera" | "gallery") => {
    let result;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Camera permission is required.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Photo library permission is required.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      setImageUploading(true);
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `posts/${user?.uid}_${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
        const url = await getDownloadURL(storageRef);
        setUploadedImageUrl(url);
      } catch {
        Alert.alert("Upload failed", "Could not upload image. It won't be attached to the post.");
        setImageUri(null);
        setUploadedImageUrl(null);
      } finally {
        setImageUploading(false);
      }
    }
  };

  const showImagePicker = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take Photo", "Choose from Library", "Remove Image"],
          cancelButtonIndex: 0,
          destructiveButtonIndex: imageUri ? 3 : undefined,
        },
        (i) => {
          if (i === 1) pickImage("camera");
          else if (i === 2) pickImage("gallery");
          else if (i === 3) { setImageUri(null); setUploadedImageUrl(null); }
        }
      );
    } else {
      const options: { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[] = [
        { text: "Cancel", style: "cancel" },
        { text: "Take Photo", onPress: () => pickImage("camera") },
        { text: "Photo Library", onPress: () => pickImage("gallery") },
      ];
      if (imageUri) {
        options.push({ text: "Remove Image", style: "destructive", onPress: () => { setImageUri(null); setUploadedImageUrl(null); } });
      }
      Alert.alert("Add Image", "Select source", options);
    }
  };

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
    if (imageUploading) {
      Alert.alert("Please wait", "Image is still uploading...");
      return;
    }

    setLoading(true);
    try {
      const images = uploadedImageUrl ? [uploadedImageUrl] : [];
      // Parse hashtags from dedicated field + auto-detect in title/description
      const rawTags = hashtags.split(/[\s,]+/).map((t) => t.replace(/^#/, "").toLowerCase().trim()).filter(Boolean);
      const autoTags = [...title, " ", description].join("").match(/#(\w+)/g)?.map((t) => t.slice(1).toLowerCase()) ?? [];
      const allTags = Array.from(new Set([...rawTags, ...autoTags])).slice(0, 10);
      await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName: profile.username,
        authorAvatar: profile.profilePhoto ?? null,
        title: title.trim(),
        description: description.trim(),
        images,
        category: selectedCategory,
        hashtags: allTags,
        likes: [],
        reactions: {},
        commentCount: 0,
        shareCount: 0,
        reports: [],
        createdAt: serverTimestamp(),
      });
      // Award points for creating a post
      await awardPoints(user.uid, POINTS.POST_CREATED);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitle("");
      setDescription("");
      setHashtags("");
      setImageUri(null);
      setUploadedImageUrl(null);
      setSelectedCategory("scam-alert");
      appliedKeyRef.current = null;
      setIsPrefilled(false);
      router.replace("/(tabs)/" as never);
    } catch {
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 10, paddingBottom: insets.bottom + 100 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>New Post</Text>
        <TouchableOpacity
          style={[
            styles.postBtn,
            { backgroundColor: title && description ? colors.primary : colors.muted },
          ]}
          onPress={handlePost}
          disabled={loading || !title || !description || imageUploading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {isPrefilled && (
        <View style={[styles.prefillBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
          <Feather name="cpu" size={13} color={colors.primary} />
          <Text style={[styles.prefillBannerText, { color: colors.primary }]}>
            Pre-filled from AI Scam Checker — edit before posting
          </Text>
          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setIsPrefilled(false)}>
            <Feather name="x" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Category</Text>
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

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Title *</Text>
      <TextInput
        ref={titleInputRef}
        style={[
          styles.titleInput,
          isPrefilled ? styles.glowInput : null,
          {
            color: colors.text,
            borderColor: isPrefilled ? colors.primary : colors.border,
            backgroundColor: isPrefilled ? colors.primary + "12" : colors.card,
            ...(isPrefilled && {
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 4,
            }),
          },
        ]}
        placeholder="What's the scam or news?"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={(t) => { setTitle(t); setIsPrefilled(false); }}
        maxLength={100}
        multiline
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>{title.length}/100</Text>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Description *</Text>
      <TextInput
        style={[
          styles.descInput,
          isPrefilled ? styles.glowInput : null,
          {
            color: colors.text,
            borderColor: isPrefilled ? colors.primary : colors.border,
            backgroundColor: isPrefilled ? colors.primary + "12" : colors.card,
            ...(isPrefilled && {
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 10,
              elevation: 4,
            }),
          },
        ]}
        placeholder="Provide details about the scam, how it works, what to watch out for..."
        placeholderTextColor={colors.textMuted}
        value={description}
        onChangeText={(t) => { setDescription(t); setIsPrefilled(false); }}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Hashtags (optional)</Text>
      <TextInput
        style={[styles.titleInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, minHeight: 44 }]}
        placeholder="#phishing #cryptoscam #warning"
        placeholderTextColor={colors.textMuted}
        value={hashtags}
        onChangeText={setHashtags}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>Separate with spaces or commas · max 10 tags</Text>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Image (optional)</Text>

      {imageUri ? (
        <View style={styles.imagePreviewWrap}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          {imageUploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}
          {!imageUploading && uploadedImageUrl && (
            <View style={styles.uploadedBadge}>
              <Feather name="check-circle" size={14} color="#10B981" />
              <Text style={styles.uploadedText}>Uploaded</Text>
            </View>
          )}
          <TouchableOpacity style={styles.removeImageBtn} onPress={showImagePicker}>
            <Feather name="edit-2" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.imagePickerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={showImagePicker}
        >
          <Feather name="image" size={22} color={colors.textMuted} />
          <View>
            <Text style={[styles.imagePickerTitle, { color: colors.text }]}>Add Photo</Text>
            <Text style={[styles.imagePickerSub, { color: colors.textMuted }]}>
              Camera or photo library
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={[styles.disclaimerBox, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "44" }]}>
        <Feather name="info" size={14} color={colors.warning} />
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          All content is user-submitted and for awareness purposes only. Ensure your post follows our Community Guidelines.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  pageTitle: { fontFamily: "Inter_700Bold", fontSize: 24 },
  postBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  postBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  glowInput: { borderWidth: 1.5 },
  prefillBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  prefillBannerText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 12, lineHeight: 17 },
  sectionLabel: {
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
    fontSize: 18,
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
    minHeight: 160,
  },
  imagePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    borderRadius: 12,
    borderStyle: "dashed",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  imagePickerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  imagePickerSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  imagePreviewWrap: { borderRadius: 12, overflow: "hidden", position: "relative" },
  imagePreview: { width: "100%", height: 220 },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadingText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
  uploadedBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  uploadedText: { color: "#10B981", fontFamily: "Inter_500Medium", fontSize: 12 },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
  disclaimerText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, flex: 1 },
});
