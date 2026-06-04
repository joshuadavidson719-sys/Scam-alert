import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  ScrollView,

} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

import { Feather } from "@expo/vector-icons";

interface LinkResult {
  isSuspicious: boolean;
  riskLevel: "high" | "medium" | "low" | "safe";
  explanation: string;
  redFlags: string[];
  recommendation: string;
}

const RISK_CONFIG = {
  high: { color: "#EF4444", bg: "#EF444415", label: "High Risk — Do Not Open" },
  medium: { color: "#F59E0B", bg: "#F59E0B15", label: "Caution Advised" },
  low: { color: "#3B82F6", bg: "#3B82F615", label: "Low Risk" },
  safe: { color: "#10B981", bg: "#10B98115", label: "Appears Safe" },
} as const;

export default function QRScannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);
  const processingRef = useRef(false);

  const handleBarcode = async ({ data }: { data: string }) => {
    if (processingRef.current || scanned) return;
    processingRef.current = true;
    setScanned(true);
    setScannedUrl(data);
    setResult(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    if (data.startsWith("http://") || data.startsWith("https://")) {
      setAnalyzing(true);
      try {
        const res = await fetch("/api/link-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: data }),
        });
        const json = await res.json() as LinkResult;
        setResult(json);
      } catch {
        // ignore analysis errors
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const handleReset = () => {
    setScanned(false);
    setScannedUrl(null);
    setResult(null);
    setAnalyzing(false);
    processingRef.current = false;
  };

  const handleOpen = () => {
    if (scannedUrl) Linking.openURL(scannedUrl);
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.text }]}>QR Scanner</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.permissionBox}>
          <Text style={{ fontSize: 48 }}>📷</Text>
          <Text style={[styles.permTitle, { color: colors.text }]}>Camera Access Needed</Text>
          <Text style={[styles.permText, { color: colors.textSecondary }]}>
            Allow camera access to scan QR codes and check them for safety.
          </Text>
          <TouchableOpacity
            style={[styles.permBtn, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.permBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const config = result ? RISK_CONFIG[result.riskLevel] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>QR Scanner</Text>
        <View style={{ width: 24 }} />
      </View>

      {!scanned ? (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcode}
          />
          <View style={styles.overlay}>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL, { borderColor: colors.primary }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: colors.primary }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: colors.primary }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: colors.primary }]} />
            </View>
          </View>
          <Text style={[styles.hint, { color: "#fff" }]}>Point at a QR code to scan</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.resultContent, { paddingBottom: insets.bottom + 40 }]}>
          <View style={[styles.scannedBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 20, color: colors.textMuted }}>⤢</Text>
            <Text style={[styles.scannedLabel, { color: colors.textMuted }]}>Scanned Content</Text>
            <Text style={[styles.scannedUrl, { color: colors.text }]} numberOfLines={3}>
              {scannedUrl}
            </Text>
          </View>

          {analyzing && (
            <View style={[styles.analyzingBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.analyzingText, { color: colors.textSecondary }]}>
                Checking safety...
              </Text>
            </View>
          )}

          {config && result && (
            <View style={[styles.verdictCard, { backgroundColor: config.bg, borderColor: config.color + "40" }]}>
              <Text style={[styles.verdictLabel, { color: config.color }]}>{config.label}</Text>
              <Text style={[styles.verdictText, { color: colors.text }]}>{result.explanation}</Text>
              {result.redFlags.length > 0 && (
                <View style={styles.flagList}>
                  {result.redFlags.map((f, i) => (
                    <View key={i} style={styles.flagRow}>
                      <Text style={{ fontSize: 12, color: "#EF4444" }}>⚠️</Text>
                      <Text style={[styles.flagText, { color: colors.textSecondary }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={[styles.recommend, { color: colors.textSecondary }]}>{result.recommendation}</Text>
            </View>
          )}

          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleReset}
            >
              <Text style={{ fontSize: 16, color: colors.text }}>🔄</Text>
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Scan Again</Text>
            </TouchableOpacity>

            {scannedUrl?.startsWith("http") && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: result?.isSuspicious ? "#EF444420" : colors.primary + "20",
                    borderColor: result?.isSuspicious ? "#EF4444" : colors.primary,
                  },
                ]}
                onPress={handleOpen}
              >
                <Text style={{ fontSize: 16, color: result?.isSuspicious ? "#EF4444" : colors.primary }}>↗️</Text>
                <Text
                  style={[styles.actionBtnText, { color: result?.isSuspicious ? "#EF4444" : colors.primary }]}
                >
                  {result?.isSuspicious ? "Open Anyway" : "Open Link"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
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
  cameraWrap: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  frame: {
    width: 240,
    height: 240,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  permissionBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  permTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  permText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 },
  permBtn: { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, marginTop: 8 },
  permBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  resultContent: { padding: 16, gap: 14 },
  scannedBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  scannedLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  scannedUrl: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  analyzingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  analyzingText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  verdictCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  verdictLabel: { fontFamily: "Inter_700Bold", fontSize: 16 },
  verdictText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  flagList: { gap: 6 },
  flagRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  flagText: { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, lineHeight: 17 },
  recommend: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, fontStyle: "italic" },
  actionBtns: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
