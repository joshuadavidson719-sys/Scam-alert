import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { createInstitutionCheckout, getGetInstitutionBillingQueryKey, useGetInstitutionBilling } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { configureApi } from "@/lib/api-base";
import type { InstitutionRegion } from "@/constants/institutionPlans";
import { InstitutionIdentityCheck } from "./InstitutionIdentityCheck";
import { InstitutionPasskeyCard } from "./InstitutionPasskeyCard";
import { approveInstitutionCheckout, passkeyErrorMessage } from "@/lib/institutionPasskeys";

function messageFor(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  }
  return fallback;
}

export function InstitutionPaymentPanel({ region }: { region: InstitutionRegion }) {
  const colors = useColors();
  const { user } = useAuth();
  const { checkout_returned } = useLocalSearchParams<{ checkout_returned?: string }>();
  const configError = useMemo(() => {
    try { configureApi(); return null; }
    catch { return "The billing server address is not configured for this app."; }
  }, []);
  const billing = useGetInstitutionBilling({
    query: { queryKey: getGetInstitutionBillingQueryKey(), enabled: !configError, retry: false, staleTime: 60_000 },
  });
  const market = region.currency === "XCD" ? "ec" : region.id === "ca" ? "ca" : null;
  const offer = billing.data?.offers.find((item) => item.market === market);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [passkeyReady, setPasskeyReady] = useState(false);
  const actionRef = useRef(false);
  const mounted = useRef(true);
  const currentUid = useRef(user?.uid);
  currentUid.current = user?.uid;
  const retryRequest = useRef<{ key: string; id: string } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const subscribe = async () => {
    if (!user) { router.push("/(auth)/login" as never); return; }
    if (Platform.OS !== "web" || !market || !offer?.available || actionRef.current) return;
    if (!identityReady || !passkeyReady || name.trim().length < 2 || !accepted) {
      setError("Complete the identity and passkey checks, enter your institution's name and accept the recurring billing terms.");
      return;
    }
    actionRef.current = true;
    setBusy(true);
    setError(null);
    const uid = user.uid;
    try {
      const key = `${uid}:${market}:${name.trim()}`;
      if (retryRequest.current?.key !== key) retryRequest.current = { key, id: window.crypto.randomUUID() };
      configureApi();
      const intent = {
        market, institutionName: name.trim(), acceptedBillingTerms: true, requestId: retryRequest.current.id,
      } as const;
      const passkeyApproval = await approveInstitutionCheckout(intent);
      if (!mounted.current || currentUid.current !== uid) return;
      const result = await createInstitutionCheckout({ ...intent, passkeyApproval });
      if (!mounted.current || currentUid.current !== uid) return;
      const url = new URL(result.purchaseUrl);
      if (url.protocol !== "https:" || url.hostname !== "whop.com" || url.port || url.username || url.password ||
          !/^\/checkout\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) || url.hash) {
        throw new Error("Invalid checkout destination.");
      }
      // No paid status is stored or granted here. Whop owns checkout and Orders.
      window.location.assign(url.toString());
    } catch (failure) {
      if (mounted.current) setError(messageFor(failure, passkeyErrorMessage(failure)));
    } finally {
      actionRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const manage = async () => {
    const url = billing.data?.manageUrl;
    if (!url) return;
    if (url !== "https://whop.com/@me/settings/orders/") {
      setError("Subscription management is temporarily unavailable.");
      return;
    }
    try { await Linking.openURL(url); }
    catch { setError("Could not open Whop Orders. Please try again."); }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.price}>
        <Text style={[styles.priceText, { color: colors.text }]} testID="institution-live-price">
          {offer ? offer.formattedPrice : market ? "Checking price…" : region.priceLabel}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {offer ? `Per institution · ${offer.currency}. ${offer.message}` : market ? "Checkout stays unavailable until the live price is confirmed." : `${region.currency ?? "Local"} pricing must be agreed before payment.`}
        </Text>
      </View>
      {billing.isLoading && !configError ? <ActivityIndicator color={colors.primary} /> : null}
      {(configError || billing.isError) && (
        <View accessibilityRole="alert" style={[styles.notice, { borderColor: colors.warning }]}>
          <Text style={[styles.body, { color: colors.text }]}>
            {configError || messageFor(billing.error, "Billing is temporarily unavailable. No payment has been taken.")}
          </Text>
          {!configError && <Pressable onPress={() => void billing.refetch()} accessibilityRole="button"><Text style={{ color: colors.primary }}>Retry billing</Text></Pressable>}
        </View>
      )}
      {checkout_returned === "1" && (
        <View accessibilityRole="alert" style={[styles.notice, { borderColor: colors.info }]}>
          <Text style={[styles.body, { color: colors.text }]}>You returned from checkout. This does not confirm payment. Check your receipt and subscription status in Whop Orders before trying another purchase.</Text>
        </View>
      )}
      {Platform.OS === "web" && market && offer?.available ? (
        <>
          <InstitutionIdentityCheck onReady={setIdentityReady} />
          <InstitutionPasskeyCard key={user?.uid ?? "signed-out"} enabled={!!user && identityReady && !busy} onReady={setPasskeyReady} />
          <Text style={[styles.label, { color: colors.text }]}>Institution name</Text>
          <TextInput
            value={name} onChangeText={setName} editable={!busy} maxLength={150}
            accessibilityLabel="Institution name" testID="institution-name"
            placeholder="Your bank or credit union" placeholderTextColor={colors.textMuted}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          />
          <Text style={[styles.small, { color: colors.textMuted }]}>Your institution name and app account ID are sent to Whop to associate the checkout with your request. Card and bank details are entered only on Whop.</Text>
          <Pressable
            onPress={() => setAccepted((value) => !value)} disabled={busy} accessibilityRole="checkbox"
            accessibilityLabel="Accept recurring institutional billing" accessibilityState={{ checked: accepted, disabled: busy }}
            testID="institution-billing-terms" style={styles.checkRow}
          >
            <Feather name={accepted ? "check-square" : "square"} size={24} color={colors.primary} />
            <Text style={[styles.body, { color: colors.textSecondary, flex: 1 }]}>
              I am authorised to subscribe for this institution. I agree to {offer.formattedPrice}, automatically renewed every {offer.billingDays} days until cancelled in Whop Orders. Applicable taxes are shown at checkout. Service delivery and advertising spend require separate onboarding agreement.
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void subscribe()} disabled={busy || (!!user && (!identityReady || !passkeyReady || !accepted || name.trim().length < 2))}
            accessibilityRole="button" testID="institution-subscribe"
            style={[styles.button, { backgroundColor: colors.primary, opacity: busy || (!!user && (!identityReady || !passkeyReady || !accepted || name.trim().length < 2)) ? 0.5 : 1 }]}
          >
            {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="lock" size={16} color={colors.primaryForeground} />}
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{busy ? "Approve on your device…" : user ? "Approve with passkey & continue" : "Sign in to subscribe"}</Text>
          </Pressable>
          <Text style={[styles.small, { color: colors.textMuted }]}>No setup fee. Whop confirms the final amount before you pay. We request the issuer's 3-D Secure challenge for supported card payments; availability depends on the card and processor. You will use a Whop account for receipts and billing.</Text>
        </>
      ) : Platform.OS !== "web" ? (
        <Text style={[styles.body, { color: colors.textSecondary }]}>Institutional service information only. No institutional purchases or payment links are available in the Android app.</Text>
      ) : null}
      {error && <Text accessibilityRole="alert" style={[styles.body, { color: colors.destructive }]}>{error}</Text>}
      {billing.data?.manageUrl && Platform.OS === "web" && (
        <View style={[styles.manage, { borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.text }]}>Already subscribed?</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>View billing history, update payment methods or cancel future renewals in Whop Orders. Sign in with the Whop account used for payment.</Text>
          <Pressable onPress={() => void manage()} accessibilityRole="link" testID="institution-manage">
            <Text style={[styles.label, { color: colors.primary }]}>Manage subscription in Whop</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 }, price: { gap: 8, paddingVertical: 16 },
  priceText: { fontFamily: "Inter_700Bold", fontSize: 27, lineHeight: 34 },
  body: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48, fontFamily: "Inter_400Regular", fontSize: 15 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
  button: { minHeight: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, gap: 8 },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 14, flexShrink: 1 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  small: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17 },
  manage: { borderTopWidth: 1, paddingTop: 16, gap: 10 },
});
