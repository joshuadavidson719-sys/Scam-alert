import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function CreatePollScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState<24 | 48 | 72>(24);
  const [submitting, setSubmitting] = useState(false);

  const addOption = () => {
    if (options.length >= 5) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOptions([...options, ""]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOptions(options.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const canSubmit =
    question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= 2;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const validOptions = options.filter((o) => o.trim().length > 0);
      const votes: Record<string, number> = {};
      validOptions.forEach((_, i) => { votes[String(i)] = 0; });

      await addDoc(collection(db, "polls"), {
        question: question.trim(),
        options: validOptions,
        votes,
        voters: {},
        authorId: user.uid,
        authorName: profile?.displayName ?? "Anonymous",
        expiresAt: Date.now() + duration * 60 * 60 * 1000,
        createdAt: serverTimestamp(),
        totalVotes: 0,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert("Error", "Could not create poll. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const DURATIONS: { label: string; value: 24 | 48 | 72 }[] = [
    { label: "24h", value: 24 },
    { label: "48h", value: 48 },
    { label: "72h", value: 72 },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Nav bar */}
      <View
        style={[
          styles.nav,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Create Poll</Text>
        <TouchableOpacity
          style={[
            styles.publishBtn,
            { backgroundColor: canSubmit ? colors.primary : colors.muted },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.publishBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Question */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>QUESTION</Text>
          <TextInput
            style={[styles.questionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="What would you like to ask the community?"
            placeholderTextColor={colors.textMuted}
            value={question}
            onChangeText={setQuestion}
            maxLength={200}
            multiline
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{question.length}/200</Text>
        </View>

        {/* Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>OPTIONS</Text>
          {options.map((opt, i) => (
            <View key={i} style={styles.optionRow}>
              <View style={[styles.optionNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.optionNumberText}>{i + 1}</Text>
              </View>
              <TextInput
                style={[styles.optionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
                placeholder={`Option ${i + 1}${i < 2 ? " (required)" : ""}`}
                placeholderTextColor={colors.textMuted}
                value={opt}
                onChangeText={(v) => updateOption(i, v)}
                maxLength={80}
              />
              {options.length > 2 && (
                <TouchableOpacity onPress={() => removeOption(i)} style={styles.removeBtn}>
                  <Feather name="minus-circle" size={20} color={colors.destructive} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {options.length < 5 && (
            <TouchableOpacity
              onPress={addOption}
              style={[styles.addOptionBtn, { borderColor: colors.border }]}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={[styles.addOptionText, { color: colors.primary }]}>Add Option</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>POLL DURATION</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d.value}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDuration(d.value); }}
                style={[
                  styles.durationBtn,
                  { borderColor: duration === d.value ? colors.primary : colors.border },
                  duration === d.value && { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text style={[styles.durationText, { color: duration === d.value ? colors.primary : colors.textSecondary }]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            Polls appear in the Community Polls section on the home feed and expire after the chosen duration.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  navTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  publishBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  publishBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  content: { padding: 16, gap: 28, paddingBottom: 60 },
  section: { gap: 10 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  questionInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
  },
  charCount: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionNumberText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  removeBtn: { padding: 4 },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 12,
    justifyContent: "center",
    marginTop: 4,
  },
  addOptionText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  durationRow: { flexDirection: "row", gap: 10 },
  durationBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  durationText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  infoCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, lineHeight: 18 },
});
