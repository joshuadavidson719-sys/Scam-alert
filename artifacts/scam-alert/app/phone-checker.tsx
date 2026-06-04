import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const APP_ICON = require("@/assets/images/icon.png");

interface PhoneResult {
  isSuspicious: boolean;
  riskLevel: "high" | "medium" | "low" | "safe";
  explanation: string;
  redFlags: string[];
  recommendation: string;
  scamType: string | null;
}

const RISK_CONFIG = {
  high:   { color: "#EF4444", bg: "#EF444415", label: "High Risk",     emoji: "🚨" },
  medium: { color: "#F59E0B", bg: "#F59E0B15", label: "Medium Risk",   emoji: "⚠️" },
  low:    { color: "#3B82F6", bg: "#3B82F615", label: "Low Risk",      emoji: "ℹ️" },
  safe:   { color: "#10B981", bg: "#10B98115", label: "Appears Safe",  emoji: "✅" },
} as const;

export default function PhoneCheckerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PhoneResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    const trimmed = phone.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch("/api/phone-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json() as PhoneResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
      await Haptics.notificationAsync(
        data.isSuspicious
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const config = result ? RISK_CONFIG[result.riskLevel] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Image source={APP_ICON} style={styles.navIcon} resizeMode="cover" />
          <Text style={[{ fontFamily: "Inter_600SemiBold", fontSize: 13 }, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Phone Checker</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.heroBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Text style={{ fontSize: 32 }}>📞</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Phone Number Check</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Enter a suspicious phone number to check if it's associated with robocalls, scams, or fraud.
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Enter phone number</Text>
        <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 16 }}>📱</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            returnKeyType="go"
            onSubmitEditing={handleCheck}
          />
          {phone.length > 0 && (
            <TouchableOpacity onPress={() => setPhone("")}>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.checkBtn,
            { backgroundColor: phone.trim() ? colors.primary : colors.muted },
          ]}
          onPress={handleCheck}
          disabled={!phone.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Image source={APP_ICON} style={styles.btnIcon} resizeMode="cover" />
              <Text style={styles.checkBtnText}>Analyze Number</Text>
            </>
          )}
        </TouchableOpacity>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: "#EF444415", borderColor: "#EF444440" }]}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={[styles.errorText, { color: "#EF4444" }]}>{error}</Text>
          </View>
        )}

        {result && config && (
          <View style={styles.resultSection}>
            <View style={[styles.verdictCard, { backgroundColor: config.bg, borderColor: config.color + "40" }]}>
              <Text style={{ fontSize: 28 }}>{config.emoji}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.verdictTop}>
                  <Text style={[styles.verdictLabel, { color: config.color }]}>{config.label}</Text>
                  {result.scamType && (
                    <View style={[styles.scamTypeChip, { backgroundColor: config.color + "20" }]}>
                      <Text style={[styles.scamTypeText, { color: config.color }]}>{result.scamType}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.verdictExplain, { color: colors.text }]}>{result.explanation}</Text>
              </View>
            </View>

            {result.redFlags.length > 0 && (
              <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Red Flags</Text>
                {result.redFlags.map((flag, i) => (
                  <View key={i} style={styles.flagRow}>
                    <Text style={{ fontSize: 13 }}>🚨</Text>
                    <Text style={[styles.flagText, { color: colors.textSecondary }]}>{flag}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommendation</Text>
              <Text style={[styles.recommend, { color: colors.textSecondary }]}>{result.recommendation}</Text>
            </View>
          </View>
        )}

        <View style={[styles.tipsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>Protect Yourself</Text>
          {[
            "Never give OTPs, passwords, or banking details over a phone call",
            "Legitimate banks and government agencies never ask for money via gift cards",
            "If uncertain, hang up and call the organization's official number",
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={{ fontSize: 13 }}>✅</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
            </View>
          ))}
        </View>
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
  navIcon: { width: 22, height: 22, borderRadius: 6 },
  navTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  content: { padding: 16, gap: 16 },
  heroBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  heroSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: -8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnIcon: { width: 18, height: 18, borderRadius: 5 },
  checkBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
  resultSection: { gap: 12 },
  verdictCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  verdictTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  verdictLabel: { fontFamily: "Inter_700Bold", fontSize: 16 },
  scamTypeChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  scamTypeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  verdictExplain: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 2 },
  flagRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  flagText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 18 },
  recommend: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  tipsBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  tipsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 2 },
  tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  tipText: { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1, lineHeight: 18 },
});
