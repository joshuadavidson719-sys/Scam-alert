import React from "react";
import { ScrollView, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
export default function PremiumTerms() {
  const colors = useColors();
  return <ScrollView contentContainerStyle={styles.page} style={{ backgroundColor: colors.background }}>
    <Pressable onPress={() => router.back()}><Text style={{ color: colors.primary }}>Back</Text></Pressable>
    <Text style={[styles.title, { color: colors.text }]}>Premium subscription terms</Text>
    <Text style={[styles.body, { color: colors.text }]}>
      Premium is a monthly, automatically renewing subscription. The purchase screen and store checkout show the applicable price, currency, and renewal terms before you confirm. Google Play handles Android purchases and payments.
      {"\n\n"}Each paid billing period includes 100 image credits. One image consumes one credit; an animation consumes one credit per generated frame. Unused credits expire at the end of that billing period and do not roll over. Cancelling stops future renewals; access continues for the paid period while the store reports the subscription as active.
      {"\n\n"}Manage cancellations, purchases, and refund requests through your app store. Use Restore purchases if you reinstall or change devices, and sign in to the same Scam Alert account. Do not purchase again while verification is pending.
      {"\n\n"}Credits are reserved before generation. Failed frames are not charged; successfully generated frames remain available to recover if a response is interrupted. Partial animations charge only for completed frames. Credits have no cash value.
      {"\n\n"}OpenAI processes image prompts and images for generation. Groq processes text-tool requests. Do not submit passwords, banking credentials, or sensitive personal information. AI output may be inaccurate and does not establish whether a person, phone number, or website is safe.
      {"\n\n"}Test Store and Expo preview purchases are simulations and do not unlock production generation. Premium purchases remain unavailable while the generation service is not ready.
    </Text>
  </ScrollView>;
}
const styles = StyleSheet.create({ page: { padding: 24, paddingTop: 70, gap: 20, paddingBottom: 50 }, title: { fontSize: 24, fontFamily: "Inter_700Bold" }, body: { fontSize: 15, lineHeight: 24 } });
