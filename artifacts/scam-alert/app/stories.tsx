import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { UserAvatar } from "@/components/UserAvatar";

const { width: SCREEN_W } = Dimensions.get("window");
const STORY_DURATION = 5000;

interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  type: "text" | "image";
  text?: string;
  imageUrl?: string;
  bgColor?: string;
  viewers: string[];
  createdAt: number;
  expiresAt: number;
}

interface StoryGroup {
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  stories: Story[];
  hasUnseen: boolean;
}

const BG_COLORS = [
  "#FF3B3B", "#FF6B35", "#F7C59F", "#3B82F6",
  "#10B981", "#8B5CF6", "#EC4899", "#1F2937",
];

export default function StoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ authorId?: string; storyIndex?: string }>();

  const [mode, setMode] = useState<"browse" | "view" | "create">("browse");
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [storyReactions, setStoryReactions] = useState<Record<string, string[]>>({});
  const [showReactionBar, setShowReactionBar] = useState(false);

  // Create mode
  const [createType, setCreateType] = useState<"text" | "image">("text");
  const [storyText, setStoryText] = useState("");
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0]);
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    const cutoff = Date.now();
    const q = query(
      collection(db, "stories"),
      where("expiresAt", ">", cutoff),
      orderBy("expiresAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const all: Story[] = snap.docs.map((d) => ({
        ...(d.data() as Omit<Story, "id">),
        id: d.id,
      }));
      // Group by author
      const map = new Map<string, StoryGroup>();
      for (const s of all) {
        if (!map.has(s.authorId)) {
          map.set(s.authorId, {
            authorId: s.authorId,
            authorName: s.authorName,
            authorAvatar: s.authorAvatar,
            stories: [],
            hasUnseen: false,
          });
        }
        const g = map.get(s.authorId)!;
        g.stories.push(s);
        if (!s.viewers.includes(user.uid)) g.hasUnseen = true;
      }
      // Put own stories first
      const sorted = Array.from(map.values()).sort((a, b) => {
        if (a.authorId === user.uid) return -1;
        if (b.authorId === user.uid) return 1;
        return b.hasUnseen ? 1 : -1;
      });
      setGroups(sorted);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const startViewing = (group: StoryGroup, idx = 0) => {
    setActiveGroup(group);
    setActiveStoryIdx(idx);
    setMode("view");
    setShowReactionBar(false);
    startProgress();
    // Load current story reactions
    const story = group.stories[idx];
    if (story) {
      const data = (story as Story & { reactions?: Record<string, string[]> }).reactions ?? {};
      setStoryReactions(data);
    }
  };

  const startProgress = () => {
    progressAnim.setValue(0);
    if (progressTimer.current) clearTimeout(progressTimer.current);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start();
    progressTimer.current = setTimeout(nextStory, STORY_DURATION);
  };

  const nextStory = () => {
    setActiveStoryIdx((prev) => {
      if (!activeGroup) return prev;
      if (prev < activeGroup.stories.length - 1) {
        startProgress();
        markSeen(activeGroup.stories[prev + 1]);
        return prev + 1;
      } else {
        setMode("browse");
        setActiveGroup(null);
        return 0;
      }
    });
  };

  const prevStory = () => {
    setActiveStoryIdx((prev) => {
      if (prev > 0) {
        startProgress();
        return prev - 1;
      }
      return prev;
    });
  };

  const markSeen = async (story: Story) => {
    if (!user || story.viewers.includes(user.uid)) return;
    await updateDoc(doc(db, "stories", story.id), {
      viewers: arrayUnion(user.uid),
    });
  };

  useEffect(() => {
    if (mode === "view" && activeGroup) {
      const s = activeGroup.stories[activeStoryIdx];
      if (s) markSeen(s);
    }
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [mode, activeStoryIdx]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setPickedImage(res.assets[0].uri);
      setCreateType("image");
    }
  };

  const publishStory = async () => {
    if (!user || !profile) return;
    if (createType === "text" && !storyText.trim()) {
      Alert.alert("Empty", "Add some text to your story.");
      return;
    }
    setUploading(true);
    try {
      let imageUrl: string | undefined;
      if (createType === "image" && pickedImage) {
        const blob = await (await fetch(pickedImage)).blob();
        const r = ref(storage, `stories/${user.uid}/${Date.now()}`);
        await uploadBytes(r, blob);
        imageUrl = await getDownloadURL(r);
      }
      const now = Date.now();
      await addDoc(collection(db, "stories"), {
        authorId: user.uid,
        authorName: profile.username,
        authorAvatar: profile.profilePhoto ?? null,
        type: createType,
        text: storyText.trim() || undefined,
        imageUrl,
        bgColor: selectedBg,
        viewers: [],
        createdAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStoryText("");
      setPickedImage(null);
      setMode("browse");
    } catch {
      Alert.alert("Error", "Could not publish story.");
    } finally {
      setUploading(false);
    }
  };

  if (mode === "view" && activeGroup) {
    const story = activeGroup.stories[activeStoryIdx];
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: story?.bgColor ?? "#1F2937" }]}>
        {/* Progress bars */}
        <View style={[styles.progressRow, { paddingTop: insets.top + 8 }]}>
          {activeGroup.stories.map((_, i) => (
            <View key={i} style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
              {i < activeStoryIdx && <View style={[styles.progressFill, { width: "100%" }]} />}
              {i === activeStoryIdx && (
                <Animated.View
                  style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
                />
              )}
            </View>
          ))}
        </View>

        {/* Author */}
        <View style={styles.storyAuthor}>
          <UserAvatar uri={activeGroup.authorAvatar} name={activeGroup.authorName} size={36} />
          <Text style={styles.storyAuthorName}>{activeGroup.authorName}</Text>
          <Text style={styles.storyTime}>
            {story ? Math.round((story.expiresAt - Date.now()) / 3600000) + "h left" : ""}
          </Text>
        </View>

        {/* Close */}
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={() => { setMode("browse"); setActiveGroup(null); }}
        >
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Story content */}
        {story?.type === "image" && story.imageUrl ? (
          <Image source={{ uri: story.imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.textStoryContent}>
            <Text style={styles.textStoryText}>{story?.text}</Text>
          </View>
        )}

        {/* Tap zones */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <TouchableOpacity style={styles.tapLeft} onPress={prevStory} />
          <TouchableOpacity style={styles.tapRight} onPress={nextStory} />
        </View>

        {/* Story Reactions */}
        <View style={[styles.reactionsContainer, { bottom: insets.bottom + 20 }]}>
          {showReactionBar ? (
            <View style={styles.reactionBar}>
              {["😱", "🔥", "👀", "💪", "🚨", "😂", "💔", "👍"].map((emoji) => {
                const key = `${story?.id}_${emoji}`;
                const reactors = storyReactions[emoji] ?? [];
                const hasReacted = user ? reactors.includes(user.uid) : false;
                return (
                  <TouchableOpacity
                    key={emoji}
                    onPress={async () => {
                      if (!user || !story) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const updated = hasReacted
                        ? reactors.filter((id) => id !== user.uid)
                        : [...reactors, user.uid];
                      setStoryReactions((prev) => ({ ...prev, [emoji]: updated }));
                      try {
                        await updateDoc(doc(db, "stories", story.id), {
                          [`reactions.${emoji}`]: updated,
                        });
                      } catch {}
                      setShowReactionBar(false);
                    }}
                    style={[
                      styles.reactionBtn,
                      hasReacted && { backgroundColor: "rgba(255,255,255,0.3)" },
                    ]}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.reactBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowReactionBar(true);
              }}
            >
              <Text style={styles.reactBtnText}>😊 React</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (mode === "create") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setMode("browse")}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Story</Text>
          <TouchableOpacity onPress={publishStory} disabled={uploading}>
            {uploading ? <ActivityIndicator color={colors.primary} /> : (
              <Text style={[styles.publishBtn, { color: colors.primary }]}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <View style={styles.typeToggle}>
            {(["text", "image"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, createType === t && { backgroundColor: colors.primary }]}
                onPress={() => setCreateType(t)}
              >
                <Feather name={t === "text" ? "type" : "image"} size={16} color={createType === t ? "#fff" : colors.textSecondary} />
                <Text style={[styles.typeBtnText, { color: createType === t ? "#fff" : colors.textSecondary }]}>
                  {t === "text" ? "Text" : "Photo"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {createType === "text" ? (
            <>
              <View style={[styles.preview, { backgroundColor: selectedBg }]}>
                <TextInput
                  style={styles.storyTextInput}
                  placeholder="What's your scam alert story?"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  multiline
                  value={storyText}
                  onChangeText={setStoryText}
                  maxLength={280}
                />
              </View>
              <Text style={[styles.label, { color: colors.textMuted }]}>Background Color</Text>
              <View style={styles.colorRow}>
                {BG_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorSwatch, { backgroundColor: c }, selectedBg === c && styles.colorSelected]}
                    onPress={() => setSelectedBg(c)}
                  />
                ))}
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={pickImage}
            >
              {pickedImage ? (
                <Image source={{ uri: pickedImage }} style={styles.pickedImage} resizeMode="cover" />
              ) : (
                <>
                  <Feather name="image" size={40} color={colors.textMuted} />
                  <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Tap to choose a photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Stories</Text>
        <TouchableOpacity onPress={() => setMode("create")}>
          <Feather name="plus-circle" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="camera" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No stories yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Be the first to share a 24-hour story</Text>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={() => setMode("create")}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.createBtnText}>Create Story</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          {/* Add story button */}
          <TouchableOpacity
            style={[styles.addStoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setMode("create")}
          >
            <View style={[styles.addStoryIcon, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="plus" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.addStoryText, { color: colors.text }]}>Add Story</Text>
            <Text style={[styles.addStoryHint, { color: colors.textMuted }]}>Disappears in 24h</Text>
          </TouchableOpacity>

          {groups.map((group) => (
            <TouchableOpacity
              key={group.authorId}
              style={[styles.storyCard, { backgroundColor: colors.card, borderColor: group.hasUnseen ? colors.primary : colors.border }]}
              onPress={() => startViewing(group)}
            >
              <View style={[styles.storyRing, { borderColor: group.hasUnseen ? colors.primary : "transparent" }]}>
                <UserAvatar uri={group.authorAvatar} name={group.authorName} size={56} />
              </View>
              <View style={styles.storyCardInfo}>
                <Text style={[styles.storyCardName, { color: colors.text }]}>{group.authorName}</Text>
                <Text style={[styles.storyCardCount, { color: colors.textMuted }]}>
                  {group.stories.length} {group.stories.length === 1 ? "story" : "stories"}
                  {group.hasUnseen ? " · New" : ""}
                </Text>
              </View>
              {group.hasUnseen && (
                <View style={[styles.unseenDot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  publishBtn: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  createBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  addStoryCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  addStoryIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  addStoryText: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  addStoryHint: { fontFamily: "Inter_400Regular", fontSize: 12 },
  storyCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 16, borderWidth: 2 },
  storyRing: { borderWidth: 2, borderRadius: 32, padding: 2 },
  storyCardInfo: { flex: 1 },
  storyCardName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  storyCardCount: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  unseenDot: { width: 10, height: 10, borderRadius: 5 },
  // View mode
  progressRow: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", gap: 4, paddingHorizontal: 12, zIndex: 10 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff" },
  storyAuthor: { position: "absolute", top: 56, left: 12, flexDirection: "row", alignItems: "center", gap: 10, zIndex: 10 },
  storyAuthorName: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  storyTime: { color: "rgba(255,255,255,0.7)", fontFamily: "Inter_400Regular", fontSize: 12 },
  closeBtn: { position: "absolute", right: 16, zIndex: 10 },
  textStoryContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  textStoryText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 24, textAlign: "center", lineHeight: 34 },
  tapLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: "40%" },
  tapRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: "60%" },
  reactionsContainer: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 20 },
  reactionBar: { flexDirection: "row", gap: 8, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 32, paddingHorizontal: 16, paddingVertical: 10 },
  reactionBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  reactionEmoji: { fontSize: 24 },
  reactBtn: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10 },
  reactBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  // Create mode
  typeToggle: { flexDirection: "row", gap: 10 },
  typeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.06)" },
  typeBtnText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  preview: { height: 280, borderRadius: 20, alignItems: "center", justifyContent: "center", padding: 24 },
  storyTextInput: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center", width: "100%" },
  label: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorSwatch: { width: 40, height: 40, borderRadius: 20 },
  colorSelected: { borderWidth: 3, borderColor: "#fff" },
  imagePicker: { height: 280, borderRadius: 20, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 12 },
  pickedImage: { width: "100%", height: "100%", borderRadius: 18 },
  imagePickerText: { fontFamily: "Inter_400Regular", fontSize: 14 },
});
