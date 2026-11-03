import React, { useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { usePremium } from "@/context/PremiumContext";

export function PremiumAccessCard() {
  const { user } = useAuth();
  const { status, monthlyPackage, loading, purchasing, error, message, testMode, refresh, purchase, restore } = usePremium();
  const [confirmTest, setConfirmTest] = useState(false);
  const canBuy = !!user && !!monthlyPackage && !purchasing && (testMode || !!status?.generationAvailable);
  const price = monthlyPackage ? `${monthlyPackage.product.priceString} ${monthlyPackage.product.currencyCode}` : undefined;
  return <View style={styles.card}>
    <Text style={styles.title}>{status?.premium ? "Premium active" : "Premium image & animation tools"}</Text>
    <Text style={styles.text}>100 credits per billing month. Each image uses 1 credit; each animation frame uses 1 credit. Unused credits do not roll over.</Text>
    {status?.premium && <Text style={styles.balance}>{status.creditsRemaining} / {status.monthlyCredits} credits available</Text>}
    {status?.periodEndsAt && <Text style={styles.text}>Current allowance ends {new Date(status.periodEndsAt).toLocaleDateString()}.</Text>}
    {!status?.generationAvailable && <Text style={styles.notice}>{status?.availabilityMessage ?? "Checking service availability…"}</Text>}
    {testMode && <Text style={styles.notice}>Test purchases only. No real charge. Test access cannot unlock production generation.</Text>}
    {!user ? <Pressable style={styles.button} onPress={() => router.push("/(auth)/login" as never)}><Text style={styles.buttonText}>Sign in to unlock Premium</Text></Pressable>
      : !status?.premium && <Pressable accessibilityRole="button" disabled={!canBuy} style={[styles.button, !canBuy && styles.disabled]}
        onPress={() => testMode ? setConfirmTest(true) : void purchase()}>
        <Text style={styles.buttonText}>{price ? `${testMode ? "Test" : "Subscribe"} · ${price} / month` : loading ? "Loading store price…" : "Store purchase unavailable"}</Text>
      </Pressable>}
    {price && !status?.premium && <Text style={styles.small}>Monthly subscription. Renews automatically at the store's displayed price unless cancelled in store settings. Cancel before renewal to avoid the next charge.</Text>}
    <View style={styles.row}>
      {!!user && <Pressable disabled={purchasing} onPress={() => void restore()}><Text style={styles.link}>Restore purchases</Text></Pressable>}
      <Pressable disabled={purchasing} onPress={() => void refresh(true)}><Text style={styles.link}>Refresh access</Text></Pressable>
    </View>
    {status?.premium && Platform.OS === "android" && <Pressable onPress={() => void Linking.openURL("https://play.google.com/store/account/subscriptions?package=com.spicetech.scamalert&sku=premium_monthly")}><Text style={styles.link}>Manage or cancel subscription</Text></Pressable>}
    <View style={styles.row}>
      <Pressable onPress={() => router.push("/legal/privacy" as never)}><Text style={styles.link}>Privacy</Text></Pressable>
      <Pressable onPress={() => router.push("/legal/premium-terms" as never)}><Text style={styles.link}>Subscription terms</Text></Pressable>
    </View>
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {message && <Text accessibilityRole="alert" style={styles.text}>{message}</Text>}
    {(loading || purchasing) && <ActivityIndicator color="#B99BFF" />}
    <Modal visible={confirmTest} transparent animationType="fade" onRequestClose={() => setConfirmTest(false)}>
      <View style={styles.backdrop}><View style={styles.dialog}>
        <Text style={styles.title}>Confirm test purchase</Text>
        <Text style={styles.text}>{price} per month in the Test Store. This is a simulated purchase with no real payment. It cannot grant production image credits.</Text>
        <Pressable style={styles.button} onPress={() => { setConfirmTest(false); void purchase(); }}><Text style={styles.buttonText}>Confirm test purchase</Text></Pressable>
        <Pressable onPress={() => setConfirmTest(false)}><Text style={styles.link}>Cancel</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderColor: "#62517D", borderWidth: 1, backgroundColor: "#1A1229", gap: 12, marginBottom: 18 },
  title: { color: "#F2EAFE", fontSize: 17, fontFamily: "Inter_700Bold" },
  text: { color: "#C6B9DE", fontSize: 13, lineHeight: 19 }, small: { color: "#C6B9DE", fontSize: 11, lineHeight: 16 },
  balance: { color: "#C4A9FF", fontFamily: "Inter_700Bold", fontSize: 17 },
  notice: { color: "#F2D398", fontSize: 12, lineHeight: 18 },
  button: { padding: 13, backgroundColor: "#7544D4", borderRadius: 10, alignItems: "center" },
  buttonText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  disabled: { opacity: 0.45 }, row: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  link: { color: "#C9B1FF", paddingVertical: 5, fontSize: 12 },
  error: { color: "#FFB7C0", fontSize: 12, lineHeight: 18 },
  backdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "#000B" },
  dialog: { backgroundColor: "#21162F", padding: 22, borderRadius: 18, gap: 16 },
});
