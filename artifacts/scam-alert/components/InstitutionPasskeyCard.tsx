import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { getGetInstitutionPasskeysQueryKey, useGetInstitutionPasskeys } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { passkeyErrorMessage, registerInstitutionPasskey, supportsInstitutionPasskeys } from "@/lib/institutionPasskeys";

export function InstitutionPasskeyCard({ enabled, onReady }: { enabled: boolean; onReady: (ready: boolean) => void }) {
  const { user } = useAuth();
  const colors = useColors();
  const supported = supportsInstitutionPasskeys();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = useGetInstitutionPasskeys({
    query: {
      queryKey: [...getGetInstitutionPasskeysQueryKey(), user?.uid, typeof window !== "undefined" ? window.location.origin : ""],
      enabled: !!user && enabled && supported, retry: false, staleTime: 15_000,
    },
  });
  const hasKeys = !status.isError && !!status.data?.count;
  useEffect(() => {
    onReady(enabled && supported && hasKeys);
    return () => onReady(false);
  }, [enabled, supported, hasKeys, onReady]);
  const enroll = async () => {
    if (!enabled || !supported || busy) return;
    setBusy(true); setError("");
    try {
      await registerInstitutionPasskey(hasKeys);
      const refreshed = await status.refetch();
      if (refreshed.isError) throw refreshed.error;
    } catch (failure) { setError(passkeyErrorMessage(failure)); }
    finally { setBusy(false); }
  };
  return (
    <View style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.heading}>
        <Feather name="key" size={18} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Required passkey protection</Text>
      </View>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {!supported ? "This browser cannot use passkeys. Open this website in a supported browser on a device with a secure screen lock. There is no email-only bypass." :
          !enabled ? "Complete the email and recent identity checks above before registering or using a passkey." :
          hasKeys ? `${status.data!.count} passkey${status.data!.count === 1 ? "" : "s"} registered for this website. Every checkout needs a fresh fingerprint, face or secure device-PIN approval.` :
          "Create a passkey using your device's fingerprint, face recognition or secure PIN. The server verifies approval; your biometric information stays on your device."}
      </Text>
      {status.isFetching && <ActivityIndicator color={colors.primary} />}
      {status.isError && <Text accessibilityRole="alert" style={[styles.body, { color: colors.destructive }]}>Protected passkey storage is unavailable. Checkout remains locked.</Text>}
      {enabled && supported && (
        <Pressable
          accessibilityRole="button" testID="institution-register-passkey"
          disabled={busy || status.isFetching || status.isError || (status.data?.count ?? 0) >= (status.data?.maxKeys ?? 5)}
          onPress={() => void enroll()}
          style={[styles.action, { backgroundColor: colors.primary, opacity: busy || status.isError ? 0.5 : 1 }]}
        >
          <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
            {busy ? "Follow your device's passkey prompt…" : hasKeys ? "Add a backup passkey" : "Create a passkey"}
          </Text>
        </Pressable>
      )}
      {status.isError && <Pressable accessibilityRole="button" onPress={() => void status.refetch()}><Text style={{ color: colors.primary }}>Retry passkey status</Text></Pressable>}
      {hasKeys && <Text style={[styles.small, { color: colors.textMuted }]}>{status.data?.recoveryMessage} Adding a backup also requires an existing passkey.</Text>}
      {!!status.data?.rpId && <Text style={[styles.small, { color: colors.textMuted }]}>Registered for {status.data.rpId}. A preview website uses separate passkeys from the live website.</Text>}
      {!!error && <Text accessibilityRole="alert" style={[styles.body, { color: colors.destructive }]}>{error}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  body: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  small: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17 },
  action: { minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 8, padding: 10 },
  actionText: { fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "center" },
});
