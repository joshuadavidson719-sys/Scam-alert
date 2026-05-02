import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

interface ScamCard {
  emoji: string;
  title: string;
  risk: "Low" | "Medium" | "High" | "Very High";
  desc: string;
  tips: string[];
  color: string;
}

const SCAM_CARDS: ScamCard[] = [
  {
    emoji: "📧",
    title: "Phishing Emails",
    risk: "Very High",
    desc: "Fake emails impersonating banks, PayPal, or government agencies asking you to click a link and verify your account.",
    tips: ["Check the sender's email domain carefully", "Never click links — go directly to the website", "Hover over links to see the real URL"],
    color: "#3B82F6",
  },
  {
    emoji: "💔",
    title: "Romance Scams",
    risk: "Very High",
    desc: "Criminals build fake romantic relationships online over weeks or months, then invent a crisis to extract money.",
    tips: ["Never send money to someone you haven't met", "Reverse image search their profile photos", "Be wary of fast-moving emotional connections"],
    color: "#EC4899",
  },
  {
    emoji: "📱",
    title: "SMS Smishing",
    risk: "High",
    desc: "Fake text messages pretending to be delivery companies, banks, or the IRS with urgent links to steal your info.",
    tips: ["Don't click links in unexpected texts", "Call the company directly using official numbers", "Report smishing texts to 7726 (SPAM)"],
    color: "#F59E0B",
  },
  {
    emoji: "💻",
    title: "Tech Support Fraud",
    risk: "High",
    desc: "Scammers call claiming your computer is infected and ask for remote access or payment to 'fix' it.",
    tips: ["Microsoft & Apple never call you unsolicited", "Never give remote access to cold-callers", "Hang up and call the company's official number"],
    color: "#8B5CF6",
  },
  {
    emoji: "📈",
    title: "Investment Fraud",
    risk: "Very High",
    desc: "Fake investment schemes (often crypto) promising huge guaranteed returns with little to no risk.",
    tips: ["Guaranteed returns are always a red flag", "Research any investment through official channels", "Be skeptical of tips from social media influencers"],
    color: "#10B981",
  },
  {
    emoji: "🎰",
    title: "Lottery & Prize Scams",
    risk: "High",
    desc: "You're told you've won a prize but must pay a fee or tax upfront to receive your winnings.",
    tips: ["You can't win a lottery you didn't enter", "Legitimate prizes never require upfront payment", "Never share financial info to 'claim' a prize"],
    color: "#F59E0B",
  },
  {
    emoji: "💼",
    title: "Job Offer Scams",
    risk: "Medium",
    desc: "Fake job listings requiring upfront payment for training, equipment, or background checks — then disappear.",
    tips: ["Legitimate employers never ask you to pay", "Verify companies on official registrar websites", "Be wary of jobs promising unrealistic salaries"],
    color: "#6366F1",
  },
  {
    emoji: "🪪",
    title: "Identity Theft",
    risk: "Very High",
    desc: "Criminals steal your personal information to open credit cards, take loans, or commit tax fraud in your name.",
    tips: ["Shred documents with personal info", "Use strong unique passwords for every account", "Monitor your credit report regularly"],
    color: "#EF4444",
  },
  {
    emoji: "🏠",
    title: "Rental Scams",
    risk: "High",
    desc: "Fake rental listings often stolen from real estate sites, asking for a deposit before you can view the property.",
    tips: ["Never pay a deposit without seeing the property", "Meet the landlord in person", "Verify ownership through county records"],
    color: "#14B8A6",
  },
  {
    emoji: "🛒",
    title: "Online Shopping Fraud",
    risk: "Medium",
    desc: "Fake online stores that take payment but never deliver goods, or counterfeit items shipped in place of name brands.",
    tips: ["Check seller reviews and return policies", "Use credit cards for better fraud protection", "Be suspicious of prices that are too good"],
    color: "#F97316",
  },
  {
    emoji: "👴",
    title: "Grandparent Scam",
    risk: "High",
    desc: "Caller claims to be a grandchild in trouble (arrested, in hospital) and urgently needs money wired or gift cards sent.",
    tips: ["Hang up and call the family member directly", "Create a family code word for emergencies", "Never send gift cards as payment"],
    color: "#06B6D4",
  },
  {
    emoji: "🌐",
    title: "Dark Web Data Sales",
    risk: "High",
    desc: "Your personal data (email, passwords, SSN) may already be for sale on the dark web from previous data breaches.",
    tips: ["Use the Dark Web Checker in this app", "Enable 2FA on all important accounts", "Use a password manager with breach alerts"],
    color: "#7C3AED",
  },
];

const RISK_COLOR: Record<string, string> = {
  Low: "#10B981",
  Medium: "#F59E0B",
  High: "#F97316",
  "Very High": "#FF3B3B",
};

function todayIndex() {
  return Math.floor(Date.now() / 86400000) % SCAM_CARDS.length;
}

export function ScamOfTheDay() {
  const colors = useColors();
  const card = SCAM_CARDS[todayIndex()];
  const [expanded, setExpanded] = useState(false);
  const riskColor = RISK_COLOR[card.risk];

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      activeOpacity={0.92}
      style={[styles.card, { backgroundColor: colors.card, borderColor: card.color + "40" }]}
    >
      <LinearGradient
        colors={[card.color + "18", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <View style={[styles.tagPill, { backgroundColor: "#FF3B3B20", borderColor: "#FF3B3B50" }]}>
          <Text style={styles.tagText}>📅 Scam of the Day</Text>
        </View>
        <View style={[styles.riskPill, { backgroundColor: riskColor + "20" }]}>
          <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
          <Text style={[styles.riskText, { color: riskColor }]}>{card.risk} Risk</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.cardEmoji}>{card.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={expanded ? undefined : 2}>
            {card.desc}
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textMuted}
        />
      </View>

      {expanded && (
        <View style={[styles.tipsBox, { borderColor: card.color + "30" }]}>
          <Text style={[styles.tipsTitle, { color: card.color }]}>🛡️ How to stay safe</Text>
          {card.tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={[styles.tipBullet, { backgroundColor: card.color }]} />
              <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    overflow: "hidden",
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#FF3B3B",
  },
  riskPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskDot: { width: 6, height: 6, borderRadius: 3 },
  riskText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardEmoji: { fontSize: 32, lineHeight: 38 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 3 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  tipsBox: {
    marginTop: 4,
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  tipsTitle: { fontFamily: "Inter_700Bold", fontSize: 13, marginBottom: 2 },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
    flexShrink: 0,
  },
  tipText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, flex: 1 },
});
