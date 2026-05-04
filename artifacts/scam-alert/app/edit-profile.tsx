import React, { useState } from "react";
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
  ActionSheetIOS,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth, NICHES } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { storage } from "@/lib/firebase";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile, updateUserProfile, refreshProfile } = useAuth();

  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [niche, setNiche] = useState(profile?.niche ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.profilePhoto ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
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
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
    }
    if (!result.canceled && result.assets[0]?.base64) {
      setUploading(true);
      try {
        const base64 = result.assets[0].base64;
        const storageRef = ref(storage, `avatars/${user?.uid}_${Date.now()}.jpg`);
        await uploadString(storageRef, base64, "base64", { contentType: "image/jpeg" });
        const url = await getDownloadURL(storageRef);
        setAvatarUri(url);
      } catch (err: any) {
        const code = err?.code ?? "";
        const msg = code === "storage/unauthorized"
          ? "Upload blocked by Firebase rules. Please check your Firebase Storage security rules."
          : code
          ? `Firebase error: ${code}`
          : err?.message ?? "Unknown error";
        Alert.alert("Upload failed", msg);
      } finally {
        setUploading(false);
      }
    }
  };

  const showImagePicker = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Library"], cancelButtonIndex: 0 },
        (i) => { if (i === 1) pickImage("camera"); else if (i === 2) pickImage("gallery"); }
      );
    } else {
      Alert.alert("Change Photo", "Select source", [
        { text: "Cancel", style: "cancel" },
        { text: "Camera", onPress: () => pickImage("camera") },
        { text: "Photo Library", onPress: () => pickImage("gallery") },
      ]);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert("Username required", "Please enter a username.");
      return;
    }
    setSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateUserProfile({
        username: username.trim(),
        bio: bio.trim(),
        niche: niche.trim(),
        profilePhoto: avatarUri,
      });
      await refreshProfile();
      router.back();
    } catch {
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 20, color: colors.text }}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <TouchableOpacity style={styles.avatarSection} onPress={showImagePicker} disabled={uploading}>
          <View style={styles.avatarWrap}>
            <UserAvatar uri={avatarUri} name={username || "?"} size={90} />
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ fontSize: 16, color: "#fff" }}>📷</Text>
              )}
            </View>
          </View>
          <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Profile Photo</Text>
        </TouchableOpacity>

        {/* Username */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          placeholderTextColor={colors.textMuted}
          maxLength={30}
          autoCapitalize="none"
        />

        {/* Bio */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
        <TextInput
          style={[styles.textArea, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people about yourself..."
          placeholderTextColor={colors.textMuted}
          maxLength={200}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, { color: colors.textMuted }]}>{bio.length}/200</Text>

        {/* Niche / Focus Area */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Focus Area</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nichesRow}>
          {NICHES.map((n) => (
            <TouchableOpacity
              key={n}
              style={[
                styles.nicheChip,
                {
                  backgroundColor: niche === n ? colors.primary : colors.card,
                  borderColor: niche === n ? colors.primary : colors.border,
                },
              ]}
              onPress={() => { setNiche(n === niche ? "" : n); Haptics.selectionAsync(); }}
            >
              <Text
                style={[styles.nicheText, { color: niche === n ? "#fff" : colors.text }]}
              >
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  saveBtn: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  content: { padding: 16, gap: 8 },
  avatarSection: { alignItems: "center", gap: 12, paddingVertical: 20 },
  avatarWrap: { position: "relative" },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  changePhotoText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    minHeight: 100,
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "right",
    marginTop: 2,
  },
  nichesRow: { gap: 8, paddingVertical: 4, paddingRight: 16 },
  nicheChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  nicheText: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
