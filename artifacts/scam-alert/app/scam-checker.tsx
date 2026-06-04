import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,

} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

import { Feather } from "@expo/vector-icons";

interface AnalysisResult {
  isScam: boolean;
  confidence: "high" | "medium" | "low";
  explanation: string;
  redFlags: string[];
  recommendation: string;
  scamType: string | null;
}

// ── Scam type → emoji + colour ────────────────────────────────────────────────
interface ScamTypeConfig {
  emoji: string;
  color: string;
}

const SCAM_TYPE_CONFIG: Record<string, ScamTypeConfig> = {
  "Phishing":              { emoji: "🔗", color: "#F97316" },
  "Lottery scam":          { emoji: "🎁", color: "#8B5CF6" },
  "Prize scam":            { emoji: "🏆", color: "#8B5CF6" },
  "Romance scam":          { emoji: "❤️", color: "#EC4899" },
  "Tech support scam":     { emoji: "🖥️", color: "#3B82F6" },
  "Investment fraud":      { emoji: "📈", color: "#059669" },
  "Impersonation":         { emoji: "🎭", color: "#EF4444" },
  "OTP scam":              { emoji: "🔒", color: "#EAB308" },
  "Cryptocurrency scam":   { emoji: "💎", color: "#06B6D4" },
  "Job scam":              { emoji: "💼", color: "#6366F1" },
  "Advance fee fraud":     { emoji: "💸", color: "#DC2626" },
  "Identity theft":        { emoji: "🪪", color: "#7C3AED" },
  "Smishing":              { emoji: "💬", color: "#F59E0B" },
  "Vishing":               { emoji: "📵", color: "#EF4444" },
};

function getScamTypeConfig(scamType: string | null): ScamTypeConfig {
  if (!scamType) return { emoji: "⚠️", color: "#FF3B3B" };
  if (SCAM_TYPE_CONFIG[scamType]) return SCAM_TYPE_CONFIG[scamType];
  const lower = scamType.toLowerCase();
  for (const key of Object.keys(SCAM_TYPE_CONFIG)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return SCAM_TYPE_CONFIG[key];
    }
  }
  return { emoji: "⚠️", color: "#FF3B3B" };
}

export default function ScamCheckerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleCheck = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const base =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : `https://${process.env.EXPO_PUBLIC_REPLIT_DEV_DOMAIN ?? "localhost"}`;
      const response = await fetch(`${base}/api/scam-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!response.ok) throw new Error("Analysis failed");
      const data = await response.json() as AnalysisResult;
      setResult(data);
      Haptics.notificationAsync(
        data.isScam
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
    } catch {
      setError("Could not analyze the message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (c: "high" | "medium" | "low", isScam: boolean) => {
    if (c === "low") return colors.textMuted;
    if (c === "medium") return colors.warning;
    return isScam ? colors.destructive : colors.success;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 10, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.text} />
          <Text style={[styles.backLabel, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>AI Scam Checker</Text>
        <View style={{ width: 60 }} />
      </View>

      <View
        style={[
          styles.heroBanner,
          { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" },
        ]}
      >
        <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
          <Feather name="shield" size={28} color="#fff" />
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Detect Scams Instantly
        </Text>
        <Text style={[styles.heroDesc, { color: colors.textSecondary }]}>
          Paste any suspicious message, email, or text and our AI will analyze it for scam patterns.
        </Text>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Paste suspicious message
      </Text>
      <TextInput
        style={[
          styles.textArea,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
        ]}
        placeholder="e.g. 'Congratulations! You've won $10,000. Click here to claim your prize...'"
        placeholderTextColor={colors.textMuted}
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        maxLength={3000}
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>
        {message.length}/3000
      </Text>

      <TouchableOpacity
        style={[
          styles.analyzeBtn,
          { backgroundColor: message.trim() ? colors.primary : colors.muted },
        ]}
        onPress={handleCheck}
        disabled={!message.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="search" size={18} color="#fff" />
            <Text style={styles.analyzeBtnText}>Analyze Message</Text>
          </>
        )}
      </TouchableOpacity>

      {error ? (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" },
          ]}
        >
          <Text style={{ fontSize: 16 }}>⚠️</Text>
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : null}

      {result && (
        <View
          style={[
            styles.resultCard,
            {
              backgroundColor: result.isScam ? colors.destructive + "10" : colors.success + "10",
              borderColor: result.isScam ? colors.destructive + "44" : colors.success + "44",
            },
          ]}
        >
          <View style={styles.resultHeader}>
            <View
              style={[
                styles.resultIcon,
                { backgroundColor: result.isScam ? colors.destructive : colors.success },
              ]}
            >
              <Feather name={result.isScam ? "alert-circle" : "check-circle"} size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.verdict,
                  { color: result.isScam ? colors.destructive : colors.success },
                ]}
              >
                {result.isScam ? "⚠️ Likely a SCAM" : "✅ Likely Safe"}
              </Text>
              <Text style={[styles.confidence, { color: confidenceColor(result.confidence, result.isScam) }]}>
                {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)} confidence
              </Text>
            </View>
          </View>

          {result.scamType
            ? (() => {
                const cfg = getScamTypeConfig(result.scamType!);
                return (
                  <View style={[styles.scamTypeChip, { backgroundColor: cfg.color + "18", borderColor: cfg.color + "44" }]}>
                    <Text style={{ fontSize: 13 }}>{cfg.emoji}</Text>
                    <Text style={[styles.scamTypeText, { color: cfg.color }]}>
                      {result.scamType}
                    </Text>
                  </View>
                );
              })()
            : null}

          <Text style={[styles.explanation, { color: colors.text }]}>
            {result.explanation}
          </Text>

          {result.redFlags.length > 0 && (
            <View style={styles.redFlagsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Red Flags Detected</Text>
              {result.redFlags.map((flag, i) => (
                <View key={i} style={styles.redFlagRow}>
                  <Text style={{ fontSize: 13 }}>🚩</Text>
                  <Text style={[styles.redFlagText, { color: colors.textSecondary }]}>
                    {flag}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View
            style={[
              styles.recommendationBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={{ fontSize: 14 }}>ℹ️</Text>
            <Text style={[styles.recommendationText, { color: colors.text }]}>
              {result.recommendation}
            </Text>
          </View>

          {result.isScam && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.postAlertBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({
                    pathname: "/(tabs)/create",
                    params: {
                      prefillTitle: result.scamType
                        ? `⚠️ ${result.scamType} Alert`
                        : "⚠️ Scam Alert",
                      prefillDescription: [
                        result.explanation,
                        result.redFlags.length > 0
                          ? `\n🚩 Red flags:\n${result.redFlags.map(f => `• ${f}`).join("\n")}`
                          : "",
                        `\n💡 ${result.recommendation}`,
                      ].join(""),
                      prefillCategory: "scam-alert",
                    },
                  } as never);
                }}
              >
                <Feather name="bell" size={16} color="#fff" />
                <Text style={styles.postAlertText}>Post an Alert</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.checkAnotherBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => {
                  setResult(null);
                  setMessage("");
                  Haptics.selectionAsync();
                }}
              >
                <Text style={{ fontSize: 14 }}>🔄</Text>
                <Text style={[styles.checkAnotherText, { color: colors.textSecondary }]}>
                  Check Another
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!result.isScam && (
            <TouchableOpacity
              style={[styles.checkAnotherBtn, { borderColor: colors.border, backgroundColor: colors.card, alignSelf: "center" }]}
              onPress={() => {
                setResult(null);
                setMessage("");
                Haptics.selectionAsync();
              }}
            >
              <Text style={{ fontSize: 14 }}>🔄</Text>
              <Text style={[styles.checkAnotherText, { color: colors.textSecondary }]}>
                Check Another Message
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        AI analysis is for informational purposes only. When in doubt, do not share personal information or click unknown links.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  backIcon: { width: 22, height: 22, borderRadius: 6 },
  backLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  title: { fontFamily: "Inter_700Bold", fontSize: 18 },
  heroBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconImg: { width: 36, height: 36, borderRadius: 10 },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" },
  heroDesc: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 19 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    minHeight: 140,
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
    marginBottom: 12,
  },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 16,
  },
  analyzeBtnIcon: { width: 20, height: 20, borderRadius: 5 },
  analyzeBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  resultIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  resultIconImg: { width: 32, height: 32, borderRadius: 8 },
  verdict: { fontFamily: "Inter_700Bold", fontSize: 17 },
  confidence: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 2 },
  explanation: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  scamTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  scamTypeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, letterSpacing: 0.3 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  postAlertBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionBtnIcon: { width: 16, height: 16, borderRadius: 4 },
  postAlertText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  checkAnotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkAnotherText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  redFlagsSection: { gap: 6 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 4 },
  redFlagRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  redFlagText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 19 },
  recommendationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  recommendationText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 19 },
  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 8,
  },
});
