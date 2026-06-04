import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, FlatList, Platform,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";

type Step = "pick" | "music" | "caption";

// Small wrapper so useVideoPlayer can be called at component top level.
// Handles browser autoplay-block gracefully with a visible "Tap to play" overlay.
function VideoPreview({ uri, style }: { uri: string; style: object }) {
  const [blocked, setBlocked] = useState(false);

  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true; // must be muted for browser autoplay
  });

  const tryPlay = useCallback(() => {
    setBlocked(false);
    try {
      const result: unknown = player.play();
      if (result instanceof Promise) {
        (result as Promise<void>).catch(() => setBlocked(true));
      }
    } catch {
      setBlocked(true);
    }
  }, [player]);

  useEffect(() => {
    // Listen for player errors (covers native autoplay failures)
    const sub = player.addListener("statusChange", ({ error }: any) => {
      if (error) setBlocked(true);
    });
    // On web, play() returns a Promise that rejects if autoplay is blocked
    tryPlay();
    return () => sub.remove();
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={blocked ? 0.8 : 1}
      style={style as any}
      onPress={blocked ? tryPlay : undefined}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
      {blocked && (
        <View style={[StyleSheet.absoluteFill, styles.tapOverlay]}>
          <View style={styles.tapCircle}>
            <Feather name="play" size={28} color="#fff" />
          </View>
          <Text style={styles.tapLabel}>Tap to play</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tapOverlay: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  tapCircle:  { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  tapLabel:   { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 10, letterSpacing: 0.3 },
});

type MusicTrack = {
  id: string;
  name: string;
  emoji: string;
  genre: string;
  url: string | null;
};

// All tracks are CC0 / royalty-free — free to use commercially with no attribution required.
// Sources: SoundHelix (soundhelix.com — royalty-free), Free Music Archive CC0
const MUSIC_LIBRARY: MusicTrack[] = [
  { id: "none",  name: "No Music",        emoji: "🔇", genre: "",             url: null },
  { id: "s1",    name: "Breaking Alert",  emoji: "📰", genre: "News · CC0",   url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: "s2",    name: "Street Heat",     emoji: "🔥", genre: "Hip-Hop · CC0",url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: "s3",    name: "Tech Vibes",      emoji: "⚡", genre: "Electronic · CC0", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  { id: "s4",    name: "Dark Warning",    emoji: "🌑", genre: "Suspense · CC0",url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
  { id: "s5",    name: "Chill Wave",      emoji: "🌊", genre: "Lo-Fi · CC0",  url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
  { id: "s6",    name: "Hype Up",         emoji: "💥", genre: "Motivational · CC0", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
  { id: "s7",    name: "Alert Mode",      emoji: "🚨", genre: "Dramatic · CC0", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
  { id: "s8",    name: "Smooth Expose",   emoji: "🎙️", genre: "Jazz · CC0",   url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
];

export default function ReelsUpload() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{
    remixCaption?: string;
    remixMusicUrl?: string;
    remixMusicName?: string;
    remixMusicEmoji?: string;
  }>();

  const [videoUri, setVideoUri]         = useState<string | null>(null);
  const [caption, setCaption]           = useState("");
  const [uploading, setUploading]       = useState(false);
  const [progress, setProgress]         = useState(0);
  const [step, setStep]                 = useState<Step>("pick");
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack>(MUSIC_LIBRARY[0]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const previewSound = useRef<Audio.Sound | null>(null);
  const [isRemix, setIsRemix]           = useState(false);

  // Stop preview sound on unmount
  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false }).catch(() => {});
    return () => {
      previewSound.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // Pre-fill remix data if coming from Remix button
  useEffect(() => {
    if (params.remixCaption) {
      setCaption(`🔄 ${params.remixCaption}`);
      setIsRemix(true);
    }
    if (params.remixMusicUrl) {
      const match = MUSIC_LIBRARY.find((t) => t.url === params.remixMusicUrl);
      if (match) {
        setSelectedMusic(match);
      } else if (params.remixMusicName) {
        setSelectedMusic({
          id: "remix",
          name: params.remixMusicName,
          emoji: params.remixMusicEmoji ?? "🎵",
          genre: "Remix",
          url: params.remixMusicUrl,
        });
      }
    }
  }, []);

  const stopPreview = async () => {
    if (previewSound.current) {
      await previewSound.current.stopAsync().catch(() => {});
      await previewSound.current.unloadAsync().catch(() => {});
      previewSound.current = null;
    }
    setPreviewingId(null);
  };

  const togglePreview = async (track: MusicTrack) => {
    if (previewingId === track.id) {
      await stopPreview();
      return;
    }
    await stopPreview();
    if (!track.url) return;
    setLoadingPreview(true);
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.url },
        { shouldPlay: true, isLooping: true, volume: 1 },
      );
      previewSound.current = sound;
      setPreviewingId(track.id);
    } catch {
      Alert.alert("Preview unavailable", "Could not load this track. Try another one.");
    }
    setLoadingPreview(false);
  };

  const requestLibraryPermission = async (): Promise<boolean> => {
    let { granted, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!granted) {
      if (!canAskAgain) {
        Alert.alert("Permission Denied", "Photo library access was denied. Please enable it in your device Settings.");
        return false;
      }
      const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = res.granted;
    }
    if (!granted) {
      Alert.alert("Permission Needed", "Allow Scam Alert to access your photo library to pick a video.");
      return false;
    }
    return true;
  };

  const pickVideo = async () => {
    try {
      if (!(await requestLibraryPermission())) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"] as any,
        allowsEditing: false,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setVideoUri(result.assets[0].uri);
        setStep("music");
      }
    } catch {
      Alert.alert("Error", "Could not open your photo library. Please try again.");
    }
  };

  const recordVideo = async () => {
    try {
      let { granted: camGranted } = await ImagePicker.getCameraPermissionsAsync();
      if (!camGranted) {
        const res = await ImagePicker.requestCameraPermissionsAsync();
        camGranted = res.granted;
      }
      if (!camGranted) {
        Alert.alert("Camera Needed", "Allow camera access to record a reel.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"] as any,
        allowsEditing: false,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setVideoUri(result.assets[0].uri);
        setStep("music");
      }
    } catch {
      Alert.alert("Error", "Could not open camera. Please try again.");
    }
  };

  const handlePost = async () => {
    if (!videoUri) {
      Alert.alert("No video", "Please pick or record a video first.");
      return;
    }
    if (!user) {
      Alert.alert("Not signed in", "Please sign in to post a reel.");
      return;
    }
    if (!profile) {
      Alert.alert("Profile loading", "Your profile is still loading. Please wait a moment and try again.");
      return;
    }
    if (!caption.trim()) {
      Alert.alert("Caption needed", "Add a caption before posting your reel.");
      return;
    }
    await stopPreview();
    setUploading(true);
    setProgress(0);
    try {
      // Fetch video as blob
      let blob: Blob;
      try {
        const response = await fetch(videoUri);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        blob = await response.blob();
      } catch (fetchErr: any) {
        throw new Error(`Could not read video file: ${fetchErr?.message ?? fetchErr}`);
      }

      if (!blob || blob.size === 0) {
        throw new Error("Video file is empty. Please pick a different video.");
      }

      const storageRef = ref(storage, `reels/${user.uid}_${Date.now()}.mp4`);

      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob, { contentType: "video/mp4" });
        task.on(
          "state_changed",
          (snap) => {
            const pct = snap.totalBytes > 0
              ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
              : 0;
            setProgress(pct);
          },
          (err) => reject(err),
          () => resolve(),
        );
      });

      const videoUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "reels"), {
        userId:       user.uid,
        username:     profile.username,
        profilePhoto: profile.profilePhoto ?? null,
        videoUrl,
        caption:      caption.trim(),
        musicName:    selectedMusic.id === "none" ? null : selectedMusic.name,
        musicEmoji:   selectedMusic.id === "none" ? null : selectedMusic.emoji,
        musicUrl:     selectedMusic.url ?? null,
        likes:        [],
        dislikes:     [],
        views:        0,
        createdAt:    serverTimestamp(),
      });

      Alert.alert("Posted! 🎬", "Your reel is live.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error("[ReelsUpload] upload error:", msg);
      Alert.alert(
        "Upload failed",
        msg.includes("storage/unauthorized")
          ? "Storage permission denied. Please check Firebase Storage rules."
          : msg.includes("Could not read") || msg.includes("Fetch failed")
          ? msg
          : "Something went wrong uploading your reel. Please check your connection and try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const goBack = () => {
    if (step === "caption") { stopPreview(); setStep("music"); }
    else if (step === "music") { stopPreview(); setStep("pick"); }
    else router.back();
  };

  const stepLabel = step === "pick" ? "New Reel" : step === "music" ? "Add Music" : "Caption & Post";

  return (
    <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Feather name="arrow-left" size={20} color={colors.textSecondary} />
          <Text style={[S.headerIconLabel, { color: colors.textSecondary }]}>{step === "pick" ? "Close" : "Back"}</Text>
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>{stepLabel}</Text>
        {step === "caption" && !uploading ? (
          <TouchableOpacity onPress={handlePost}>
            <Text style={[S.postBtn, { color: colors.primary }]}>Post</Text>
          </TouchableOpacity>
        ) : step === "music" ? (
          <TouchableOpacity onPress={() => { stopPreview(); setStep("caption"); }}>
            <Text style={[S.postBtn, { color: colors.primary }]}>Next</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Step indicator */}
      <View style={S.stepBar}>
        {(["pick", "music", "caption"] as Step[]).map((s, i) => (
          <View
            key={s}
            style={[S.stepDot, {
              backgroundColor: step === s ? colors.primary : i < ["pick","music","caption"].indexOf(step) ? colors.primary + "80" : colors.border,
            }]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>

        {/* ── STEP 1: Pick ── */}
        {step === "pick" && (
          <View style={S.pickArea}>
            {isRemix && (
              <View style={[S.remixBanner, { backgroundColor: "#EC489918", borderColor: "#EC489940" }]}>
                <Text style={{ fontSize: 18 }}>🔄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[S.remixTitle, { color: "#EC4899" }]}>Remixing a Reel</Text>
                  <Text style={[S.remixSub, { color: colors.textSecondary }]}>
                    Caption &amp; music pre-filled — just record or pick your video
                  </Text>
                </View>
              </View>
            )}
            <View style={[S.pickCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 52 }}>🎬</Text>
              <Text style={[S.pickTitle, { color: colors.text }]}>{isRemix ? "Pick Your Remix Video" : "Create a Scam Alert Reel"}</Text>
              <Text style={[S.pickSub, { color: colors.textMuted }]}>
                Share scam warnings, tips, or awareness clips. Up to 60 seconds.
              </Text>
              <View style={S.pickBtns}>
                <TouchableOpacity style={[S.pickBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={pickVideo}>
                  <Feather name="film" size={18} color="#fff" />
                  <Text style={S.pickBtnTxt}>Choose Video</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.pickBtn, { backgroundColor: "#7C3AED", flex: 1 }]} onPress={recordVideo}>
                  <Feather name="video" size={18} color="#fff" />
                  <Text style={S.pickBtnTxt}>Record Video</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[S.tipsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[S.tipsTitle, { color: colors.text }]}>💡 Reel Ideas</Text>
              {[
                "🚨  Break down a real scam you spotted",
                "🔐  Share a tip to stay safe online",
                "📱  React to a scam message you received",
                "📢  Warn your community about a new scam type",
              ].map((tip, i) => (
                <Text key={i} style={[S.tip, { color: colors.textMuted }]}>{tip}</Text>
              ))}
            </View>
          </View>
        )}

        {/* ── STEP 2: Music ── */}
        {step === "music" && (
          <View style={S.musicArea}>
            {/* Mini video preview */}
            {videoUri && (
              <View style={[S.miniPreview, { backgroundColor: "#000" }]}>
                <VideoPreview uri={videoUri} style={StyleSheet.absoluteFill} />
                <View style={S.miniLabel}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#fff" }}>Your Reel</Text>
                </View>
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={[S.musicTitle, { color: colors.text }]}>🎵 Background Music</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#16a34a18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Feather name="check-circle" size={13} color="#16a34a" />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#16a34a" }}>Royalty-free</Text>
              </View>
            </View>
            <Text style={[S.musicSub, { color: colors.textMuted }]}>
              All tracks are CC0 — free to use with no copyright restrictions. Tap to preview.
            </Text>

            {MUSIC_LIBRARY.map((track) => {
              const isSelected = selectedMusic.id === track.id;
              const isPreviewing = previewingId === track.id;
              return (
                <TouchableOpacity
                  key={track.id}
                  style={[
                    S.trackRow,
                    {
                      backgroundColor: isSelected ? colors.primary + "18" : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedMusic(track)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 22, width: 30, textAlign: "center" }}>{track.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[S.trackName, { color: colors.text }]}>{track.name}</Text>
                    {track.genre ? (
                      <Text style={[S.trackGenre, { color: colors.textMuted }]}>{track.genre}</Text>
                    ) : null}
                  </View>

                  {/* Preview button — only for tracks with a URL */}
                  {track.url && (
                    <TouchableOpacity
                      style={[S.previewBtn, { backgroundColor: isPreviewing ? "#EC4899" : colors.muted }]}
                      onPress={() => togglePreview(track)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {loadingPreview && previewingId === null ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Feather name={isPreviewing ? "pause" : "play"} size={14} color="#fff" />
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Selected check */}
                  {isSelected && (
                    <View style={[S.checkBadge, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[S.nextBtn, { backgroundColor: colors.primary }]}
              onPress={() => { stopPreview(); setStep("caption"); }}
            >
              <Text style={S.nextBtnTxt}>
                {selectedMusic.id === "none" ? "Continue without music" : `Use "${selectedMusic.name}"`}
              </Text>
              <Feather name="arrow-right" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 3: Caption ── */}
        {step === "caption" && (
          <View>
            {/* Video preview */}
            {videoUri && (
              <View style={S.previewWrap}>
                <VideoPreview uri={videoUri} style={S.preview} />
                {/* Music badge */}
                {selectedMusic.id !== "none" && (
                  <View style={S.musicBadge}>
                    <Text style={{ fontSize: 13 }}>{selectedMusic.emoji}</Text>
                    <Text style={S.musicBadgeTxt}>{selectedMusic.name}</Text>
                  </View>
                )}
                <TouchableOpacity style={S.changeVideo} onPress={() => setStep("music")}>
                  <Feather name="music" size={14} color={colors.textSecondary} />
                  <Text style={S.changeVideoTxt}>Change Music</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Caption */}
            <View style={[S.captionWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[S.captionInput, { color: colors.text }]}
                placeholder="Write a caption… (e.g. 'Spotted this phishing scam — here's how to avoid it!')"
                placeholderTextColor={colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={300}
              />
              <Text style={[S.charCount, { color: colors.textMuted }]}>{caption.length}/300</Text>
            </View>

            {/* Upload progress */}
            {uploading && (
              <View style={[S.progressWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[S.uploadingTxt, { color: colors.text }]}>Uploading reel… {progress}%</Text>
                  <View style={[S.progressTrack, { backgroundColor: colors.muted }]}>
                    <View style={[S.progressBar, { width: `${progress}%` as any, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              </View>
            )}

            {!uploading && (
              <TouchableOpacity
                style={[S.postBtnFull, { backgroundColor: colors.primary }]}
                onPress={handlePost}
                activeOpacity={0.85}
              >
                <Feather name="upload-cloud" size={18} color="#fff" />
                <Text style={S.postBtnFullTxt}>Post Reel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle:  { fontFamily: "Inter_700Bold", fontSize: 17 },
  postBtn:      { fontFamily: "Inter_700Bold", fontSize: 16 },

  stepBar:      { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 10 },
  stepDot:      { width: 28, height: 4, borderRadius: 2 },

  pickArea:     { padding: 16, gap: 16 },
  remixBanner:  { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  remixTitle:   { fontFamily: "Inter_700Bold", fontSize: 14 },
  remixSub:     { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  pickCard:     { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 12 },
  pickTitle:    { fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" },
  pickSub:      { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, textAlign: "center" },
  pickBtns:     { flexDirection: "row", gap: 10, marginTop: 4, width: "100%" },
  pickBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
  pickBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },

  tipsCard:     { borderRadius: 20, borderWidth: 1, padding: 16, gap: 8 },
  tipsTitle:    { fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 2 },
  tip:          { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },

  musicArea:    { padding: 16, gap: 10 },
  miniPreview:  { borderRadius: 14, overflow: "hidden", height: 120, marginBottom: 6 },
  miniLabel:    { position: "absolute", bottom: 8, left: 10 },
  musicTitle:   { fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 4 },
  musicSub:     { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginBottom: 4 },

  trackRow:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  trackName:    { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  trackGenre:   { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  previewBtn:   { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  checkBadge:   { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },

  nextBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, marginTop: 6 },
  nextBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },

  previewWrap:  { marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: "hidden", aspectRatio: 9 / 16, maxHeight: 360, backgroundColor: "#000" },
  preview:      { flex: 1 },
  musicBadge:   { position: "absolute", bottom: 46, left: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  musicBadgeTxt:{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  changeVideo:  { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  changeVideoTxt:{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },

  captionWrap:  { margin: 16, borderRadius: 16, borderWidth: 1, padding: 14 },
  captionInput: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22, minHeight: 90, textAlignVertical: "top" },
  charCount:    { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", marginTop: 6 },

  progressWrap: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 4, padding: 14, borderRadius: 16, borderWidth: 1 },
  uploadingTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 6 },
  progressTrack:{ height: 5, borderRadius: 3, overflow: "hidden" },
  progressBar:  { height: "100%", borderRadius: 3 },

  postBtnFull:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginTop: 8, borderRadius: 16, paddingVertical: 14 },
  postBtnFullTxt:{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },

  headerIcon:      { width: 20, height: 20, borderRadius: 4 },
  headerIconLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  pickBtnIcon:     { width: 18, height: 18, borderRadius: 4 },
  badgeIcon:       { width: 11, height: 11, borderRadius: 3 },
  previewPlayIcon: { width: 14, height: 14, borderRadius: 3 },
  checkBadgeIcon:  { width: 12, height: 12, borderRadius: 3 },
  nextBtnIcon:     { width: 18, height: 18, borderRadius: 4 },
  changeMusicIcon: { width: 13, height: 13, borderRadius: 3 },
  postBtnIcon:     { width: 18, height: 18, borderRadius: 4 },
  tapPlayIcon:     { width: 28, height: 28, borderRadius: 6 },
});
