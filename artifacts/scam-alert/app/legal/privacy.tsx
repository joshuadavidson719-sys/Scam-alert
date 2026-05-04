import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const APP_ICON = require("@/assets/images/icon.png");

const SECTIONS = [
  {
    title: "Information We Collect",
    content:
      "We collect information you provide directly to us, such as when you create an account (username, email address), create posts, comments, or messages. We may also collect device information and usage data to improve our services.",
  },
  {
    title: "How We Use Your Information",
    content:
      "We use the information we collect to provide, maintain, and improve our services, to personalize your experience, to communicate with you about our services, and to ensure the safety and security of our platform.",
  },
  {
    title: "Information Sharing",
    content:
      "We do not sell your personal information to third parties. We may share information with service providers who assist in our operations, when required by law, or to protect the rights and safety of our users.",
  },
  {
    title: "Data Security",
    content:
      "We take reasonable measures to protect your personal information from unauthorized access, use, or disclosure. However, no method of transmission over the Internet is 100% secure.",
  },
  {
    title: "User Content",
    content:
      "All content is user-submitted and for awareness purposes only. You are responsible for the content you post. By posting content, you grant us a license to display and distribute that content on our platform.",
  },
  {
    title: "Your Rights",
    content:
      "You have the right to access, update, or delete your personal information at any time by managing your account settings. You may also request deletion of your account and associated data.",
  },
  {
    title: "Cookies & Analytics",
    content:
      "We use standard analytics tools to understand how our app is used. This helps us improve performance and user experience. You can disable analytics through your device settings.",
  },
  {
    title: "Changes to This Policy",
    content:
      "We may update this Privacy Policy from time to time. We will notify you of significant changes through the app. Continued use of our services after changes constitutes acceptance of the updated policy.",
  },
  {
    title: "Contact Us",
    content:
      "If you have questions about this Privacy Policy or our data practices, please contact us through the Scam Alert app.",
  },
];

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={APP_ICON} style={styles.closeIcon} resizeMode="cover" />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
          Last updated: May 2026
        </Text>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Scam Alert ("we", "our", or "us") is committed to protecting your privacy. This policy explains how we collect, use, and share information about you when you use our app.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
            <Text style={[styles.sectionContent, { color: colors.textSecondary }]}>
              {section.content}
            </Text>
          </View>
        ))}

        <View
          style={[
            styles.disclaimer,
            { backgroundColor: colors.warning + "15", borderColor: colors.warning + "44" },
          ]}
        >
          <Text style={{ fontSize: 16 }}>ℹ️</Text>
          <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            All content on Scam Alert is user-submitted and for awareness purposes only. Scam Alert is not liable for the accuracy of user-submitted content.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  closeIcon: { width: 24, height: 24, borderRadius: 6 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  lastUpdated: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  intro: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  section: { gap: 6 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  sectionContent: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  disclaimerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
