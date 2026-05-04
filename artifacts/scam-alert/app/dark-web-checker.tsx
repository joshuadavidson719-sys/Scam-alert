import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const APP_ICON = require("@/assets/images/icon.png");

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

interface BreachResult {
  safe: boolean;
  breachCount: number;
  breaches: {
    name: string;
    date: string;
    dataTypes: string[];
    description: string;
  }[];
  recommendations: string[];
  checkedAt: string;
}

export default function DarkWebCheckerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BreachResult | null>(null);
  const [error, setError] = useState("");

  const check = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setResult(null);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await fetch(`${BASE}/api/dark-web-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();
      setResult(json);
      Haptics.notificationAsync(json.safe ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    } catch {
      setError("Could not complete the check. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={APP_ICON} style={{ width: 22, height: 22, borderRadius: 6 }} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Dark Web Checker</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
        {/* Intro */}
        <View style={[styles.introBanner, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED30" }]}>
          <Text style={{ fontSize: 22, color: "#7C3AED" }}>🕵️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.introTitle, { color: colors.text }]}>Data Breach Scanner</Text>
            <Text style={[styles.introText, { color: colors.textSecondary }]}>
              Check if your email has appeared in known data breaches or dark web databases.
            </Text>
          </View>
        </View>

        {/* Input */}
        <View style={[styles.inputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 18, color: colors.textMuted }}>📧</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Enter your email address"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={(t) => { setEmail(t); setError(""); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {email.length > 0 && (
            <TouchableOpacity onPress={() => { setEmail(""); setResult(null); }}>
              <Text style={{ fontSize: 16, color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {error !== "" && (
          <Text style={[styles.errorText, { color: colors.primary }]}>{error}</Text>
        )}

        <TouchableOpacity
          style={[styles.checkBtn, { backgroundColor: loading ? colors.muted : "#7C3AED" }]}
          onPress={check}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={{ fontSize: 18, color: "#fff" }}>🔍</Text>
              <Text style={styles.checkBtnText}>Scan for Breaches</Text>
            </>
          )}
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingState}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>🔍 Scanning breach databases...</Text>
          </View>
        )}

        {result && (
          <>
            {/* Verdict */}
            <View style={[styles.verdict, {
              backgroundColor: result.safe ? "#10B98115" : colors.primary + "15",
              borderColor: result.safe ? "#10B981" : colors.primary,
            }]}>
              <Text style={{ fontSize: 28, color: result.safe ? "#10B981" : colors.primary }}>
                {result.safe ? "✅" : "⚠️"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.verdictTitle, { color: result.safe ? "#10B981" : colors.primary }]}>
                  {result.safe ? "No Breaches Found" : `${result.breachCount} Breach${result.breachCount > 1 ? "es" : ""} Detected`}
                </Text>
                <Text style={[styles.verdictSub, { color: colors.textSecondary }]}>
                  {result.safe
                    ? "Your email was not found in any known data breach databases."
                    : "Your email was found in leaked databases. Take action immediately."}
                </Text>
              </View>
            </View>

            {/* Breaches */}
            {result.breaches.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Compromised In:</Text>
                {result.breaches.map((b, i) => (
                  <View key={i} style={[styles.breachCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.breachHeader}>
                      <View style={[styles.breachIcon, { backgroundColor: colors.primary + "20" }]}>
                        <Text style={{ fontSize: 16, color: colors.primary }}>🗄️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.breachName, { color: colors.text }]}>{b.name}</Text>
                        <Text style={[styles.breachDate, { color: colors.textMuted }]}>Breach date: {b.date}</Text>
                      </View>
                    </View>
                    <Text style={[styles.breachDesc, { color: colors.textSecondary }]} numberOfLines={3}>{b.description}</Text>
                    <View style={styles.dataTypes}>
                      {b.dataTypes.map((t) => (
                        <View key={t} style={[styles.dataChip, { backgroundColor: colors.primary + "15" }]}>
                          <Text style={[styles.dataChipText, { color: colors.primary }]}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <View style={[styles.recoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>What to Do Now:</Text>
                {result.recommendations.map((r, i) => (
                  <View key={i} style={styles.recoRow}>
                    <View style={[styles.recoDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.recoText, { color: colors.textSecondary }]}>{r}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.hibpBtn, { borderColor: "#7C3AED" }]}
              onPress={() => Linking.openURL(`https://haveibeenpwned.com/account/${encodeURIComponent(email.trim())}`)}
            >
              <Text style={{ fontSize: 16, color: "#7C3AED" }}>↗️</Text>
              <Text style={[styles.hibpBtnText, { color: "#7C3AED" }]}>View full report on HaveIBeenPwned.com</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={[styles.privacyNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>🔒</Text>
          <Text style={[styles.privacyText, { color: colors.textMuted }]}>
            Your email is only used for this lookup and is never stored or shared.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  introBanner: { flexDirection: "row", gap: 14, alignItems: "flex-start", borderRadius: 16, borderWidth: 1, padding: 16 },
  introTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 },
  introText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  inputBox: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14 },
  input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: -8 },
  checkBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14 },
  checkBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 },
  loadingState: { alignItems: "center", paddingVertical: 16 },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  verdict: { flexDirection: "row", gap: 14, alignItems: "flex-start", borderRadius: 16, borderWidth: 2, padding: 18 },
  verdictTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 4 },
  verdictSub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 },
  breachCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  breachHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  breachIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  breachName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  breachDate: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  breachDesc: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  dataTypes: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dataChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dataChipText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  recoCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  recoRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  recoDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  recoText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  hibpBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14 },
  hibpBtnText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  privacyNote: { flexDirection: "row", gap: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12 },
  privacyText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12 },
});
