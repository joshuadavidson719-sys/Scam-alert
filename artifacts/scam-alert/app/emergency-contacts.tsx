import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const APP_ICON = require("@/assets/images/icon.png");

interface Contact {
  name: string;
  description: string;
  phone?: string;
  url?: string;
  email?: string;
  icon: string;
  color: string;
  category: string;
}

const CONTACTS: Contact[] = [
  {
    category: "🇺🇸 United States",
    name: "FTC — Federal Trade Commission",
    description: "Report fraud, scams, identity theft, and deceptive business practices.",
    url: "https://reportfraud.ftc.gov",
    phone: "1-877-382-4357",
    icon: "shield",
    color: "#3B82F6",
  },
  {
    category: "🇺🇸 United States",
    name: "FBI IC3 — Internet Crime Complaint Center",
    description: "Report internet-related crimes including phishing, ransomware, and online fraud.",
    url: "https://www.ic3.gov",
    icon: "globe",
    color: "#1F2937",
  },
  {
    category: "🇺🇸 United States",
    name: "CISA — Cybersecurity & Infrastructure Security Agency",
    description: "Report cyber incidents, phishing emails, and infrastructure threats.",
    url: "https://www.cisa.gov/report",
    phone: "1-888-282-0870",
    icon: "cpu",
    color: "#0EA5E9",
  },
  {
    category: "🇺🇸 United States",
    name: "Social Security Administration OIG",
    description: "Report Social Security number theft and government impersonation scams.",
    url: "https://oig.ssa.gov/report",
    phone: "1-800-269-0271",
    icon: "user-check",
    color: "#6366F1",
  },
  {
    category: "🇬🇧 United Kingdom",
    name: "Action Fraud",
    description: "UK's national reporting centre for fraud and cyber crime.",
    url: "https://www.actionfraud.police.uk",
    phone: "0300 123 2040",
    icon: "shield",
    color: "#DC2626",
  },
  {
    category: "🇬🇧 United Kingdom",
    name: "NCSC — National Cyber Security Centre",
    description: "Report suspicious emails and cyber threats to the UK government.",
    url: "https://www.ncsc.gov.uk/collection/phishing-scams",
    email: "report@phishing.gov.uk",
    icon: "mail",
    color: "#0D6EFD",
  },
  {
    category: "🇨🇦 Canada",
    name: "Canadian Anti-Fraud Centre",
    description: "Report mass marketing fraud, identity theft, and online scams.",
    url: "https://antifraudcentre-centreantifraude.ca",
    phone: "1-888-495-8501",
    icon: "alert-triangle",
    color: "#EF4444",
  },
  {
    category: "🇦🇺 Australia",
    name: "Scamwatch — ACCC",
    description: "Report scams to the Australian Competition and Consumer Commission.",
    url: "https://www.scamwatch.gov.au/report-a-scam",
    icon: "flag",
    color: "#F59E0B",
  },
  {
    category: "🌍 Global",
    name: "INTERPOL Financial Crimes",
    description: "Report cross-border financial crimes and organized fraud networks.",
    url: "https://www.interpol.int/en/Crimes/Financial-crime",
    icon: "globe",
    color: "#7C3AED",
  },
  {
    category: "🌍 Global",
    name: "Have I Been Pwned",
    description: "Check if your email or phone has appeared in a data breach.",
    url: "https://haveibeenpwned.com",
    icon: "search",
    color: "#059669",
  },
];

const grouped = CONTACTS.reduce((acc, c) => {
  if (!acc[c.category]) acc[c.category] = [];
  acc[c.category].push(c);
  return acc;
}, {} as Record<string, Contact[]>);

export default function EmergencyContactsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const open = (contact: Contact) => {
    const options: { text: string; onPress: () => void }[] = [];
    if (contact.url) options.push({ text: "Visit Website", onPress: () => Linking.openURL(contact.url!) });
    if (contact.phone) options.push({ text: `Call ${contact.phone}`, onPress: () => Linking.openURL(`tel:${contact.phone!.replace(/\s/g, "")}`) });
    if (contact.email) options.push({ text: `Email ${contact.email}`, onPress: () => Linking.openURL(`mailto:${contact.email}`) });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (options.length === 1) {
      options[0].onPress();
    } else {
      Alert.alert(contact.name, contact.description, [
        ...options.map((o) => ({ text: o.text, onPress: o.onPress })),
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Image source={APP_ICON} style={styles.navIcon} resizeMode="cover" />
          <Text style={[{ fontFamily: "Inter_600SemiBold", fontSize: 13 }, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Emergency Contacts</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <View style={[styles.banner, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <Text style={{ fontSize: 20 }}>⚠️</Text>
          <Text style={[styles.bannerText, { color: colors.text }]}>
            If you've been scammed, act fast — contact your bank immediately, then report to authorities below.
          </Text>
        </View>

        {Object.entries(grouped).map(([category, contacts]) => (
          <View key={category} style={{ marginTop: 24 }}>
            <Text style={[styles.categoryLabel, { color: colors.textMuted }]}>{category}</Text>
            <View style={styles.contactList}>
              {contacts.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => open(c)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconBox, { backgroundColor: c.color + "18" }]}>
                    <Image source={APP_ICON} style={styles.contactIcon} resizeMode="cover" />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: colors.text }]}>{c.name}</Text>
                    <Text style={[styles.contactDesc, { color: colors.textSecondary }]} numberOfLines={2}>{c.description}</Text>
                    <View style={styles.contactLinks}>
                      {c.phone && (
                        <View style={styles.linkChip}>
                          <Text style={{ fontSize: 11 }}>📞</Text>
                          <Text style={[styles.linkChipText, { color: colors.textMuted }]}>{c.phone}</Text>
                        </View>
                      )}
                      {c.url && (
                        <View style={styles.linkChip}>
                          <Text style={{ fontSize: 11 }}>🌐</Text>
                          <Text style={[styles.linkChipText, { color: colors.textMuted }]}>Website</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Image source={APP_ICON} style={styles.chevron} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  navIcon: { width: 22, height: 22, borderRadius: 6 },
  banner: { flexDirection: "row", gap: 12, alignItems: "flex-start", borderRadius: 14, borderWidth: 1, padding: 16 },
  bannerText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  categoryLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  contactList: { gap: 10 },
  contactCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, padding: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  contactIcon: { width: 24, height: 24, borderRadius: 6 },
  contactInfo: { flex: 1, gap: 4 },
  contactName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  contactDesc: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  contactLinks: { flexDirection: "row", gap: 8, marginTop: 4 },
  linkChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  linkChipText: { fontFamily: "Inter_400Regular", fontSize: 11 },
  chevron: { width: 14, height: 14, borderRadius: 3, opacity: 0.4 },
});
