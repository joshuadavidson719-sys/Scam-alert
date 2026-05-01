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
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface AnalysisResult {
  isScam: boolean;
  confidence: "high" | "medium" | "low";
  explanation: string;
  redFlags: string[];
  recommendation: string;
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
      }
      );
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

  const confidenceColor = (c: "high" | "medium" | "low") => {
    if (c === "high") return colors.success;
    if (c === "medium") return colors.warning;
    return colors.textMuted;
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
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>AI Scam Checker</Text>
        <View style={{ width: 24 }} />
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
          <Feather name="alert-circle" size={16} color={colors.destructive} />
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
                {
                  backgroundColor: result.isScam ? colors.destructive : colors.success,
                },
              ]}
            >
              <Feather
                name={result.isScam ? "alert-triangle" : "check-circle"}
                size={24}
                color="#fff"
              />
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
              <Text style={[styles.confidence, { color: confidenceColor(result.confidence) }]}>
                {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)} confidence
              </Text>
            </View>
          </View>

          <Text style={[styles.explanation, { color: colors.text }]}>
            {result.explanation}
          </Text>

          {result.redFlags.length > 0 && (
            <View style={styles.redFlagsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Red Flags</Text>
              {result.redFlags.map((flag, i) => (
                <View key={i} style={styles.redFlagRow}>
                  <Feather name="alert-circle" size={13} color={colors.destructive} />
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
            <Feather name="info" size={14} color={colors.info} />
            <Text style={[styles.recommendationText, { color: colors.text }]}>
              {result.recommendation}
            </Text>
          </View>
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
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
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
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    textAlign: "center",
  },
  heroDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
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
  analyzeBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resultIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  verdict: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  confidence: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 2,
  },
  explanation: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  redFlagsSection: { gap: 6 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginBottom: 4,
  },
  redFlagRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  redFlagText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  recommendationBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  recommendationText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    marginTop: 8,
  },
});
