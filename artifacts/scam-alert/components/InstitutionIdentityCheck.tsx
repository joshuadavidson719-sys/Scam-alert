import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential,
  reauthenticateWithPopup, sendEmailVerification,
} from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export function InstitutionIdentityCheck({ onReady }: { onReady: (ready: boolean) => void }) {
  const { user } = useAuth();
  const colors = useColors();
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [emailSentAt, setEmailSentAt] = useState(0);
  const passwordLogin = user?.providerData.some(provider => provider.providerId === "password");
  const googleLogin = user?.providerData.some(provider => provider.providerId === "google.com");

  const refresh = useCallback(async () => {
    if (!user || Platform.OS !== "web") { onReady(false); return; }
    await user.reload();
    const token = await user.getIdTokenResult(true);
    const emailOkay = user.emailVerified && token.claims.email_verified === true;
    const age = Date.now() / 1000 - Number(token.claims.auth_time);
    const okay = emailOkay && Number.isFinite(age) && age >= -60 && age <= 15 * 60;
    setVerifiedEmail(emailOkay);
    setReady(okay);
    onReady(okay);
  }, [user, onReady]);

  useEffect(() => {
    let disposed = false;
    void refresh().catch(() => { if (!disposed) { setReady(false); onReady(false); } });
    const timer = setInterval(() => {
      void refresh().catch(() => { if (!disposed) { setReady(false); onReady(false); } });
    }, 60_000);
    return () => { disposed = true; clearInterval(timer); onReady(false); };
  }, [refresh, onReady]);

  const verifyEmail = async () => {
    if (!user || busy || Date.now() - emailSentAt < 60_000) return;
    setBusy(true);
    try {
      await sendEmailVerification(user);
      setEmailSentAt(Date.now());
      setMessage("Check your email for the verification link, then press Check verification.");
    } catch { setMessage("The verification email could not be sent. Wait a minute and try again."); }
    finally { setBusy(false); }
  };
  const confirmIdentity = async () => {
    if (!user || busy || Platform.OS !== "web") return;
    setBusy(true);
    setMessage("");
    try {
      if (passwordLogin && user.email) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      } else if (googleLogin) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } else {
        setMessage("Sign out and sign in again with your account provider, then return to this page.");
        return;
      }
      setPassword("");
      await refresh();
      setMessage("Identity checked. Your email must also be verified to continue.");
    } catch { setMessage("Identity could not be confirmed. Check your password or try your sign-in provider again."); }
    finally { setPassword(""); setBusy(false); }
  };
  if (!user || Platform.OS !== "web") return null;
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Checkout identity check</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {ready ? "Email verified and identity recently confirmed. The server checks both again before checkout." : !verifiedEmail ? "Verify your email before subscribing for an institution." : "For high-value payments, confirm your identity within the last 15 minutes."}
      </Text>
      {!verifiedEmail && (
        <View style={{ gap: 10 }}>
          <Pressable disabled={busy} accessibilityRole="button" onPress={() => void verifyEmail()}>
            <Text style={[styles.link, { color: colors.primary }]}>Send verification email</Text>
          </Pressable>
          <Pressable disabled={busy} accessibilityRole="button" onPress={() => void refresh().catch(() => setMessage("Could not check verification. Please try again."))}>
            <Text style={[styles.link, { color: colors.primary }]}>Check verification</Text>
          </Pressable>
        </View>
      )}
      {verifiedEmail && !ready && (
        <>
          {passwordLogin && <TextInput
            value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"
            accessibilityLabel="Confirm account password" placeholder="Your account password"
            placeholderTextColor={colors.textMuted} editable={!busy}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />}
          <Pressable disabled={busy || (!!passwordLogin && !password)} accessibilityRole="button" onPress={() => void confirmIdentity()}>
            <Text style={[styles.link, { color: colors.primary }]}>{busy ? "Confirming…" : googleLogin && !passwordLogin ? "Confirm with Google" : "Confirm identity"}</Text>
          </Pressable>
        </>
      )}
      {!!message && <Text accessibilityRole="alert" style={[styles.body, { color: colors.textSecondary }]}>{message}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  body: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  link: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  input: { borderWidth: 1, padding: 10, borderRadius: 8, minHeight: 44, fontSize: 14 },
});
