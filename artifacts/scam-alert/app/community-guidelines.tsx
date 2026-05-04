import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

interface Rule {
  id: string;
  number: number;
  title: string;
  description: string;
  icon: string;
  color: string;
  details: string[];
}

const RULES: Rule[] = [
  {
    id: "truth",
    number: 1,
    title: "Share Truthful Information",
    description: "Only post scam alerts, news, or stories you believe to be accurate.",
    icon: "✅",
    color: "#10B981",
    details: [
      "Include sources or evidence when possible.",
      "Mark unverified information clearly.",
      "Do not fabricate or exaggerate scam scenarios.",
      "Correct your own posts if you discover an error.",
    ],
  },
  {
    id: "respect",
    number: 2,
    title: "Be Respectful",
    description: "Treat every member with dignity, regardless of their views.",
    icon: "❤️",
    color: "#EC4899",
    details: [
      "No personal attacks, insults, or harassment.",
      "Disagree with ideas — not with people.",
      "Be patient with new members learning to navigate scams.",
      "Constructive criticism is welcome; cruelty is not.",
    ],
  },
  {
    id: "privacy",
    number: 3,
    title: "Protect Privacy",
    description: "Never share someone's personal information without consent.",
    icon: "🔒",
    color: "#8B5CF6",
    details: [
      "Do not post real names, phone numbers, or addresses.",
      "Blur or redact personal data in screenshots.",
      "Exposing scammers is encouraged — but not their personal info beyond what is public.",
      "Respect the privacy of victims sharing their stories.",
    ],
  },
  {
    id: "reporting",
    number: 4,
    title: "Report Don't Retaliate",
    description: "Use the in-app report system rather than engaging with scammers.",
    icon: "🚨",
    color: "#FF3B3B",
    details: [
      "Use the Report button on any post you find suspicious.",
      "Do not engage, provoke, or retaliate against suspected scammers.",
      "Let the community and moderators handle verification.",
      "False reports to harass users are a violation of these guidelines.",
    ],
  },
  {
    id: "spam",
    number: 5,
    title: "No Spam or Self-Promotion",
    description: "Keep content relevant to scam awareness and community well-being.",
    icon: "🚫",
    color: "#F59E0B",
    details: [
      "No unsolicited advertisements or affiliate links.",
      "One post per topic — do not spam the same alert repeatedly.",
      "Promotional content must be clearly labeled.",
      "Off-topic posts may be removed by moderators.",
    ],
  },
  {
    id: "language",
    number: 6,
    title: "Use Appropriate Language",
    description: "Keep the community safe for all age groups and backgrounds.",
    icon: "💬",
    color: "#3B82F6",
    details: [
      "No profanity, hate speech, or discriminatory language.",
      "Avoid graphic descriptions unless critical to the scam alert.",
      "Write clearly so everyone can understand your warning.",
      "Translate or summarize non-English content where possible.",
    ],
  },
  {
    id: "evidence",
    number: 7,
    title: "Support Claims With Evidence",
    description: "Back up serious accusations with screenshots or references.",
    icon: "📄",
    color: "#06B6D4",
    details: [
      "Screenshots of scam messages strengthen your post.",
      "Link to news articles for broader scam reports.",
      "Mention official sources (FTC, FBI, banks) where applicable.",
      "Unsubstantiated claims may be removed or flagged.",
    ],
  },
  {
    id: "legal",
    number: 8,
    title: "Stay Within the Law",
    description: "Do not post content that could expose you or others to legal risk.",
    icon: "🛡️",
    color: "#F97316",
    details: [
      "Do not doxx, stalk, or coordinate attacks on individuals.",
      "Do not share copyrighted material without permission.",
      "Defamatory statements about individuals are prohibited.",
      "We cooperate with law enforcement when required.",
    ],
  },
];

function RuleCard({ rule }: { rule: Rule }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setExpanded((v) => !v);
      }}
      style={[
        styles.ruleCard,
        { backgroundColor: colors.card, borderColor: expanded ? rule.color + "60" : colors.border },
        expanded && { borderWidth: 1.5 },
      ]}
    >
      {/* Number badge + icon */}
      <View style={styles.ruleHeader}>
        <View style={[styles.iconCircle, { backgroundColor: rule.color + "20" }]}>
          <Text style={{ fontSize: 20 }}>{rule.icon}</Text>
        </View>
        <View style={styles.ruleMeta}>
          <Text style={[styles.ruleNumber, { color: rule.color }]}>Rule {rule.number}</Text>
          <Text style={[styles.ruleTitle, { color: colors.text }]}>{rule.title}</Text>
        </View>
        <Text style={{ fontSize: 18, color: colors.textMuted }}>{expanded ? "▲" : "▼"}</Text>
      </View>

      <Text style={[styles.ruleDesc, { color: colors.textSecondary }]}>{rule.description}</Text>

      {expanded && (
        <View style={[styles.details, { borderTopColor: colors.border }]}>
          {rule.details.map((d, i) => (
            <View key={i} style={styles.detailRow}>
              <View style={[styles.bullet, { backgroundColor: rule.color }]} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>{d}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function CommunityGuidelinesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Nav */}
      <View
        style={[
          styles.nav,
          {
            paddingTop: insets.top + 10,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>Community Guidelines</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero banner */}
        <View style={[styles.hero, { backgroundColor: "#FF3B3B15", borderColor: "#FF3B3B40" }]}>
          <View style={[styles.heroIcon, { backgroundColor: "#FF3B3B" }]}>
            <Text style={{ fontSize: 28, color: "#fff" }}>👥</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Our Community Standards
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            Scam Alert is a place to inform, protect, and support each other. These 8 rules keep our community safe, honest, and respectful.
          </Text>
          <View style={styles.heroStats}>
            {[
              { label: "Rules", value: "8" },
              { label: "Categories", value: "9" },
              { label: "Mission", value: "Protect" },
            ].map((s) => (
              <View key={s.label} style={styles.heroStat}>
                <Text style={[styles.heroStatVal, { color: "#FF3B3B" }]}>{s.value}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tap to expand hint */}
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Tap any rule to see details
        </Text>

        {/* Rules list */}
        {RULES.map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}

        {/* Consequences card */}
        <View style={[styles.consequencesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.consequencesHeader}>
            <Text style={{ fontSize: 18, color: "#F59E0B" }}>⚠️</Text>
            <Text style={[styles.consequencesTitle, { color: colors.text }]}>Enforcement</Text>
          </View>
          <Text style={[styles.consequencesText, { color: colors.textSecondary }]}>
            Violations may result in post removal, temporary restrictions, or permanent account suspension depending on severity. We review all reports within 24–48 hours. Appeal decisions by contacting our moderation team.
          </Text>
        </View>

        {/* Last updated */}
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
          Last updated · May 2025 · Scam Alert Community Team
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  navTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  content: { padding: 16, gap: 12 },

  hero: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center" },
  heroSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  heroStats: { flexDirection: "row", gap: 24, marginTop: 8 },
  heroStat: { alignItems: "center" },
  heroStatVal: { fontFamily: "Inter_700Bold", fontSize: 20 },
  heroStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },

  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },

  ruleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  ruleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ruleMeta: { flex: 1 },
  ruleNumber: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  ruleTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 1 },
  ruleDesc: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, paddingLeft: 56 },
  details: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
    marginTop: 4,
  },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  detailText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, flex: 1 },

  consequencesCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  consequencesHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  consequencesTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  consequencesText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },

  lastUpdated: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
  },
});
