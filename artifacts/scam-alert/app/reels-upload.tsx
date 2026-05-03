import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";

export default function ReelsUpload() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const videoRef = useRef<InstanceType<typeof Video>>(null);

  const [videoUri, setVideoUri]     = useState<string | null>(null);
  const [caption, setCaption]       = useState("");
  const [uploading, setUploading]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [step, setStep]             = useState<"pick" | "caption">("pick");

  const pickVideo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Allow Scam Alert to access your photo library to pick a video.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setVideoUri(result.assets[0].uri);
        setStep("caption");
      }
    } catch {
      Alert.alert("Error", "Could not open your photo library.");
    }
  };

  const handlePost = async () => {
    if (!videoUri || !user || !profile) return;
    if (!caption.trim()) {
      Alert.alert("Caption needed", "Add a caption before posting your reel.");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const response = await fetch(videoUri);
      const blob = await response.blob();
      const storageRef = ref(storage, `reels/${user.uid}_${Date.now()}.mp4`);

      await new Promise<void>((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, blob, { contentType: "video/mp4" });
        task.on(
          "state_changed",
          (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
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
        likes:        [],
        views:        0,
        createdAt:    serverTimestamp(),
      });

      Alert.alert("Posted! 🎬", "Your reel is live.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Upload failed", "Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="x" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>New Reel</Text>
        {step === "caption" && !uploading ? (
          <TouchableOpacity onPress={handlePost}>
            <Text style={[S.postBtn, { color: colors.primary }]}>Post</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {step === "pick" ? (
          /* ── Pick step ── */
          <View style={S.pickArea}>
            <View style={[S.pickCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 52 }}>🎬</Text>
              <Text style={[S.pickTitle, { color: colors.text }]}>Create a Scam Alert Reel</Text>
              <Text style={[S.pickSub, { color: colors.textMuted }]}>
                Share scam warnings, tips, or awareness clips. Up to 60 seconds.
              </Text>
              <TouchableOpacity style={[S.pickBtn, { backgroundColor: colors.primary }]} onPress={pickVideo}>
                <Feather name="video" size={18} color="#fff" />
                <Text style={S.pickBtnTxt}>Choose Video</Text>
              </TouchableOpacity>
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
        ) : (
          /* ── Caption step ── */
          <View>
            {/* Video preview */}
            {videoUri && (
              <View style={S.previewWrap}>
                <Video
                  ref={videoRef}
                  source={{ uri: videoUri }}
                  style={S.preview}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay
                  isLooping
                  isMuted
                />
                <TouchableOpacity style={S.changeVideo} onPress={pickVideo}>
                  <Feather name="refresh-cw" size={14} color="#fff" />
                  <Text style={S.changeVideoTxt}>Change</Text>
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

            {/* Post button (bottom) */}
            {!uploading && (
              <TouchableOpacity
                style={[S.postBtnFull, { backgroundColor: colors.primary }]}
                onPress={handlePost}
                activeOpacity={0.85}
              >
                <Feather name="send" size={18} color="#fff" />
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

  pickArea:     { padding: 16, gap: 16 },
  pickCard:     { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 12 },
  pickTitle:    { fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" },
  pickSub:      { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, textAlign: "center" },
  pickBtn:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  pickBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },

  tipsCard:     { borderRadius: 20, borderWidth: 1, padding: 16, gap: 8 },
  tipsTitle:    { fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 2 },
  tip:          { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },

  previewWrap:  { marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: "hidden", aspectRatio: 9 / 16, maxHeight: 360, backgroundColor: "#000" },
  preview:      { flex: 1 },
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
});
