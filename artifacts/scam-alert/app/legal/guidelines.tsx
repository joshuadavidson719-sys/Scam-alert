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

import { Feather } from "@expo/vector-icons";

const PROHIBITED = [
  {
    rule: "No Hate Speech",
    description:
      "Content that promotes hatred or discrimination based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin is strictly prohibited.",
    emoji: "🚫",
  },
  {
    rule: "No Harassment or Bullying",
    description:
      "We do not tolerate targeted harassment, intimidation, or bullying of individuals or groups. Treat all community members with respect.",
    emoji: "🛑",
  },
  {
    rule: "No Sexual Content",
    description:
      "Explicit sexual content, nudity, or sexual exploitation of any kind is not permitted on Scam Alert.",
    emoji: "⛔",
  },
  {
    rule: "No Violence or Threats",
    description:
      "Content that depicts, glorifies, or threatens real-world violence against individuals or groups is prohibited.",
    emoji: "⚠️",
  },
  {
    rule: "No Illegal Activity",
    description:
      "Do not post content that promotes, facilitates, or glorifies illegal activities including fraud, theft, drug trafficking, or any other criminal acts.",
    emoji: "❌",
  },
];

const ENCOURAGED = [
  "Share verified scam reports with evidence",
  "Provide detailed descriptions to help others identify scams",
  "Warn others about new or emerging fraud tactics",
  "Share educational content about staying safe online",
  "Be respectful and constructive in comments",
  "Report suspicious or inaccurate content",
  "Include sources when possible",
];

export default function GuidelinesScreen() {
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
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Community Guidelines</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <View style={[styles.introBanner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "33" }]}>
          <Text style={[styles.introTitle, { color: colors.text }]}>
            Our Community Standards
          </Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            Scam Alert is a community dedicated to protecting people from fraud and promoting digital safety. To maintain a trusted and safe environment, all users must follow these guidelines.
          </Text>
        </View>

        <View style={[styles.disclaimerBox, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "33" }]}>
          <Text style={{ fontSize: 16 }}>ℹ️</Text>
          <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
            All content is user-submitted and for awareness purposes only.
          </Text>
        </View>

        <Text style={[styles.sectionHeader, { color: colors.text }]}>
          Prohibited Content
        </Text>

        {PROHIBITED.map((item) => (
          <View
            key={item.rule}
            style={[
              styles.ruleCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.ruleIcon, { backgroundColor: colors.destructive + "20" }]}>
              <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.ruleName, { color: colors.text }]}>{item.rule}</Text>
              <Text style={[styles.ruleDesc, { color: colors.textSecondary }]}>
                {item.description}
              </Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionHeader, { color: colors.text }]}>
          What We Encourage
        </Text>

        {ENCOURAGED.map((item, i) => (
          <View key={i} style={styles.encouragedRow}>
            <View style={[styles.checkDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.encouragedText, { color: colors.textSecondary }]}>
              {item}
            </Text>
          </View>
        ))}

        <View
          style={[
            styles.enforcementBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.enforcementTitle, { color: colors.text }]}>
            Enforcement
          </Text>
          <Text style={[styles.enforcementText, { color: colors.textSecondary }]}>
            Violations may result in content removal, temporary suspension, or permanent account termination. Our moderation team reviews all reported content. Use the Report button on any post to flag violations.
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
    padding: 16,
    gap: 16,
  },
  introBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  introTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
  },
  introText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  disclaimerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  sectionHeader: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 4,
  },
  ruleCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
  },
  ruleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  ruleName: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  ruleDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  encouragedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  encouragedText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flex: 1,
    lineHeight: 19,
  },
  enforcementBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  enforcementTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  enforcementText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
});
