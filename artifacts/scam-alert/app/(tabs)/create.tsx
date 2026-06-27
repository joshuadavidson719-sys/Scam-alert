import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { uploadMedia, isFirebaseConfigured as _isFBConfigured } from "@/lib/storage";
import { useColors } from "@/hooks/useColors";
import { useAuth, CATEGORIES, type CategoryId } from "@/context/AuthContext";
import { CategoryPill } from "@/components/CategoryPill";
import { router, useLocalSearchParams } from "expo-router";

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

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const titleInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const appliedKeyRef = useRef<string | null>(null);
  const fileInputRef = useRef<any>(null);

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

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleWebFileChange = useCallback((e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const uri = URL.createObjectURL(file);
    const isVid = file.type.startsWith("video/");
    setMediaUri(uri);
    setMediaType(isVid ? "video" : "image");
    input.value = "";
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.style.display = "none";
    input.addEventListener("change", handleWebFileChange);
    document.body.appendChild(input);
    fileInputRef.current = input;
    return () => {
      input.removeEventListener("change", handleWebFileChange);
      document.body.removeChild(input);
    };
  }, [handleWebFileChange]);

  const handlePickMedia = async () => {
    if (Platform.OS === "web") {
      fileInputRef.current?.click();
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photo library to attach media.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: true,
        quality: 0.85,
        videoMaxDuration: 120,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setMediaUri(asset.uri);
        setMediaType(asset.type === "video" ? "video" : "image");
      }
    } catch {
      Alert.alert("Error", "Could not open media library. Please try again.");
    }
  };

  const handleRemoveMedia = () => {
    setMediaUri(null);
    setMediaType(null);
    setUploadProgress(0);
  };

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
    let uploadedImageUrl: string | null = null;
    let uploadedVideoUrl: string | null = null;

    try {
      if (mediaUri && _isFBConfigured) {
        setUploading(true);
        const ext = mediaUri.split(".").pop() ?? (mediaType === "video" ? "mp4" : "jpg");
        const path = `post-media/${user.uid}/${Date.now()}.${ext}`;
        const downloadUrl = await uploadMedia(mediaUri, path, setUploadProgress);
        if (mediaType === "video") {
          uploadedVideoUrl = downloadUrl;
        } else {
          uploadedImageUrl = downloadUrl;
        }
        setUploading(false);
      }

      await addDoc(collection(db, "posts"), {
        authorId: user.uid,
        authorName: profile.username,
        authorAvatar: profile.profilePhoto ?? null,
        title: title.trim(),
        description: description.trim(),
        images: uploadedImageUrl ? [uploadedImageUrl] : [],
        videoUrl: uploadedVideoUrl ?? null,
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
      setMediaUri(null);
      setMediaType(null);
      setUploadProgress(0);
      setSelectedCategory("scam-alert");
      appliedKeyRef.current = null;
      setIsPrefilled(false);
      router.replace("/(tabs)/" as never);
    } catch (err) {
      setUploading(false);
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
        <Text style={[styles.title, { color: colors.text }]}>New Post</Text>
        <TouchableOpacity
          style={[
            styles.postBtn,
            { backgroundColor: title && description ? colors.primary : colors.muted },
          ]}
          onPress={handlePost}
          disabled={loading || uploading || !title || !description}
        >
          {loading || uploading ? (
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
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setIsPrefilled(false)}
          >
            <Feather name="x" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Category</Text>
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
      <Text style={[styles.charCount, { color: colors.textMuted }]}>
        {title.length}/100
      </Text>

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

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        Photo / Video (optional)
      </Text>

      {mediaUri ? (
        <View style={[styles.mediaPreview, { borderColor: colors.border }]}>
          {mediaType === "video" ? (
            <View style={[styles.videoThumb, { backgroundColor: colors.card }]}>
              <Feather name="video" size={32} color={colors.primary} />
              <Text style={[styles.videoThumbText, { color: colors.text }]}>
                Video selected
              </Text>
            </View>
          ) : (
            <Image source={{ uri: mediaUri }} style={styles.imageThumb} resizeMode="cover" />
          )}
          {uploading && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.uploadText}>
                Uploading {Math.round(uploadProgress * 100)}%
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.removeMediaBtn, { backgroundColor: colors.destructive }]}
            onPress={handleRemoveMedia}
          >
            <Feather name="x" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.pickMediaBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={handlePickMedia}
        >
          <Feather name="paperclip" size={18} color={colors.textSecondary} />
          <Text style={[styles.pickMediaText, { color: colors.textSecondary }]}>
            Select photo or video from gallery
          </Text>
        </TouchableOpacity>
      )}

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
  container: { paddingHorizontal: 16 },
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
  prefillBannerText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 17,
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
  pickMediaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: "dashed",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  pickMediaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flex: 1,
  },
  mediaPreview: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  imageThumb: {
    width: "100%",
    height: 180,
  },
  videoThumb: {
    width: "100%",
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  videoThumbText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  removeMediaBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
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
  disclaimerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});
