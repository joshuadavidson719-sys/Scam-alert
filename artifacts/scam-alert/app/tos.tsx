import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const EFFECTIVE_DATE = "May 1, 2026";
const DMCA_EMAIL = "dmca@scamalert.app";
const SUPPORT_EMAIL = "support@scamalert.app";
const APP_NAME = "Scam Alert";

type Section = { title: string; icon: string; body: string[] };

const SECTIONS: Section[] = [
  {
    title: "Acceptance of Terms",
    icon: "check-circle",
    body: [
      `By accessing or using ${APP_NAME} (\"the App\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree to all of these Terms, do not use the App.`,
      "We may update these Terms at any time. Continued use of the App after changes constitutes your acceptance of the updated Terms.",
    ],
  },
  {
    title: "User Content",
    icon: "upload",
    body: [
      "You retain ownership of any content you post (videos, images, text). By posting, you grant Scam Alert a non-exclusive, worldwide, royalty-free licence to display, distribute, and promote your content within the App.",
      "You are solely responsible for ensuring you have the rights to any content you upload. Do not post content that infringes the copyright, trademark, or other intellectual property rights of any third party.",
      "Prohibited content includes but is not limited to: copyrighted material without permission, hate speech, harassment, nudity, violence, or illegal material. Violations may result in immediate account termination.",
    ],
  },
  {
    title: "Copyright & DMCA Policy",
    icon: "shield",
    body: [
      `${APP_NAME} respects intellectual property rights and complies with the Digital Millennium Copyright Act (DMCA).`,
      "If you believe content on the App infringes your copyright, please send a DMCA takedown notice to:",
      `📧  ${DMCA_EMAIL}`,
      "Your notice must include: (1) identification of the copyrighted work claimed to have been infringed; (2) identification of the infringing material and its location; (3) your contact information; (4) a statement of good-faith belief; (5) a statement of accuracy under penalty of perjury; (6) your signature.",
      "We will respond to valid DMCA notices promptly and remove or disable access to the infringing content. Repeat infringers will have their accounts terminated.",
    ],
  },
  {
    title: "Music & Audio",
    icon: "music",
    body: [
      "All background music tracks provided within the App's music library are royalty-free and licensed for use in user-generated content (CC0 / royalty-free licence). You do not need to pay additional licence fees to use these tracks in reels posted within the App.",
      "If you add external audio to your content, you are responsible for ensuring you hold the appropriate licence for that audio.",
    ],
  },
  {
    title: "Privacy",
    icon: "lock",
    body: [
      "We collect only the information needed to operate the App: email address, username, profile data you choose to provide, and content you post.",
      "We do not sell your personal information to third parties.",
      "Your data is stored securely via Firebase (Google). Please review Google's Privacy Policy for details on their data practices.",
      `To request deletion of your account and data, contact ${SUPPORT_EMAIL} or use the \"Delete Account\" option in Settings.`,
    ],
  },
  {
    title: "Community Guidelines",
    icon: "users",
    body: [
      "Be respectful — no harassment, bullying, or hate speech.",
      "Be accurate — only share scam alerts you have reasonable grounds to believe are real.",
      "No spam — do not post repetitive or promotional content unrelated to scam awareness.",
      "No illegal content — do not post content that violates any applicable law.",
      "Violations may result in content removal, account suspension, or permanent bans.",
    ],
  },
  {
    title: "Disclaimers & Limitation of Liability",
    icon: "alert-triangle",
    body: [
      `${APP_NAME} is provided \"as is\" without warranties of any kind. We do not verify the accuracy of user-submitted scam reports.`,
      "All content is user-submitted and for public awareness purposes only. Do not rely solely on App content for financial, legal, or security decisions.",
      "To the fullest extent permitted by law, Scam Alert shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App.",
    ],
  },
  {
    title: "Contact Us",
    icon: "mail",
    body: [
      `For general support: ${SUPPORT_EMAIL}`,
      `For copyright / DMCA notices: ${DMCA_EMAIL}`,
      "We aim to respond within 5 business days.",
    ],
  },
];

function SectionCard({ section, colors }: { section: Section; colors: ReturnType<typeof useColors> }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={S.cardHeader} onPress={() => setOpen(o => !o)} activeOpacity={0.75}>
        <View style={[S.iconBadge, { backgroundColor: colors.primary + "18" }]}>
          <Feather name={section.icon as any} size={16} color={colors.primary} />
        </View>
        <Text style={[S.cardTitle, { color: colors.text }]}>{section.title}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={S.cardBody}>
          {section.body.map((para, i) => {
            const isEmail = para.includes("@");
            const isHighlight = para.startsWith("📧");
            return (
              <TouchableOpacity
                key={i}
                disabled={!isEmail}
                onPress={isEmail ? () => Linking.openURL(`mailto:${para.replace("📧  ", "").trim()}`) : undefined}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    S.para,
                    { color: isHighlight ? colors.primary : isEmail && !isHighlight ? colors.primary : colors.textSecondary },
                    isHighlight && S.emailHighlight,
                  ]}
                >
                  {para}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function TosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[S.screen, { backgroundColor: colors.background }]}>
      <View style={[S.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[S.headerTitle, { color: colors.text }]}>Terms & Legal</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[S.hero, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Feather name="shield" size={28} color={colors.primary} />
          <Text style={[S.heroTitle, { color: colors.text }]}>Terms of Service</Text>
          <Text style={[S.heroSub, { color: colors.textMuted }]}>Effective {EFFECTIVE_DATE}</Text>
        </View>

        {/* DMCA Quick-link banner */}
        <TouchableOpacity
          style={[S.dmcaBanner, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED40" }]}
          onPress={() => Linking.openURL(`mailto:${DMCA_EMAIL}`)}
          activeOpacity={0.8}
        >
          <Feather name="alert-octagon" size={18} color="#7C3AED" />
          <View style={{ flex: 1 }}>
            <Text style={[S.dmcaTitle, { color: "#7C3AED" }]}>Copyright / DMCA Takedown?</Text>
            <Text style={[S.dmcaSub, { color: colors.textMuted }]}>Tap to email {DMCA_EMAIL}</Text>
          </View>
          <Feather name="external-link" size={14} color="#7C3AED" />
        </TouchableOpacity>

        {/* Sections */}
        {SECTIONS.map(sec => (
          <SectionCard key={sec.title} section={sec} colors={colors} />
        ))}

        <Text style={[S.footer, { color: colors.textMuted }]}>
          {APP_NAME} · All rights reserved © {new Date().getFullYear()}
        </Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  screen:       { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle:  { fontFamily: "Inter_700Bold", fontSize: 17 },

  content:      { padding: 16, gap: 12 },

  hero:         { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: "center", gap: 8, marginBottom: 4 },
  heroTitle:    { fontFamily: "Inter_700Bold", fontSize: 20 },
  heroSub:      { fontFamily: "Inter_400Regular", fontSize: 13 },

  dmcaBanner:   { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  dmcaTitle:    { fontFamily: "Inter_700Bold", fontSize: 14 },
  dmcaSub:      { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },

  card:         { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHeader:   { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  iconBadge:    { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle:    { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  cardBody:     { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  para:         { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
  emailHighlight:{ fontFamily: "Inter_600SemiBold", fontSize: 14 },

  footer:       { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 8 },
});
