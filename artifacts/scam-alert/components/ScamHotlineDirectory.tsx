import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { findScamHotlines, type ScamHotline } from "@/lib/scam-hotlines";

function telHref(phone: string) {
  return "tel:" + phone.replace(/[^\d+]/g, "");
}

export function ScamHotlineDirectory() {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const results = useMemo<ScamHotline[]>(() => {
    return findScamHotlines(q);
  }, [q]);

  const openUrl = async (url: string) => {
    setLinkError(null);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError(
        url.startsWith("tel:")
          ? "This device could not start a call. Copy the number and dial it manually."
          : "Could not open the source link. Try again from a browser."
      );
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.head} onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <View style={[styles.icon, { backgroundColor: colors.primary + "1F" }]}>
          <Feather name="phone-call" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Official scam hotlines</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Report fraud to government agencies by country
          </Text>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <View style={{ gap: 10 }}>
          <View style={[styles.notice, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
            <Feather name="alert-circle" size={14} color={colors.primary} />
            <Text style={[styles.noticeText, { color: colors.text }]}>
              These are non-emergency reporting lines. If you are in immediate danger, call your local
              emergency number. Most numbers work only when dialled from inside that country.
            </Text>
          </View>

          <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <Feather name="search" size={15} color={colors.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search country or agency"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text }]}
            />
            {!!q && (
              <TouchableOpacity onPress={() => setQ("")} accessibilityLabel="Clear search">
                <Feather name="x" size={15} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {linkError && <Text style={[styles.err, { color: "#E5484D" }]}>{linkError}</Text>}

          {results.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="map-pin" size={22} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No verified listing yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                We only list numbers confirmed on official sources. Check your national police or
                consumer protection website, or contact your bank directly if money was taken.
              </Text>
            </View>
          ) : (
            results.map((h) => (
              <View key={h.countryCode + h.agency + h.phone} style={[styles.row, { borderColor: colors.border }]}>
                <View style={styles.rowTop}>
                  <Text style={[styles.code, { color: colors.primary, borderColor: colors.primary + "55" }]}>
                    {h.countryCode}
                  </Text>
                  <Text style={[styles.country, { color: colors.text }]}>{h.country}</Text>
                </View>
                <Text style={[styles.agency, { color: colors.text }]}>{h.agency}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{h.purpose}</Text>
                {!!h.hours && <Text style={[styles.meta, { color: colors.textMuted }]}>Hours: {h.hours}</Text>}
                <View style={styles.actions}>
                  <TouchableOpacity
                    onPress={() => void openUrl(telHref(h.phone))}
                    style={[styles.call, { backgroundColor: colors.primary }]}
                    accessibilityLabel={`Call ${h.agency}`}
                  >
                    <Feather name="phone" size={13} color="#fff" />
                    <Text selectable style={styles.callText}>{h.phone}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => void openUrl(h.sourceUrl)} style={styles.source}>
                    <Feather name="external-link" size={13} color={colors.textSecondary} />
                    <Text style={[styles.sourceText, { color: colors.textSecondary }]}>Official source</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.verified, { color: colors.textMuted }]}>Verified {h.verifiedOn}</Text>
              </View>
            ))
          )}
          <Text style={[styles.foot, { color: colors.textMuted }]}>
            Not every country has a dedicated scam line. Numbers can change; confirm on the source page.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, marginBottom: 0, borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  notice: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  noticeText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10 },
  input: { flex: 1, paddingVertical: 9, fontFamily: "Inter_400Regular", fontSize: 14 },
  err: { fontFamily: "Inter_500Medium", fontSize: 12 },
  empty: { alignItems: "center", gap: 6, paddingVertical: 16, paddingHorizontal: 8 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 17 },
  row: { borderTopWidth: 1, paddingTop: 10, gap: 3 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  code: { fontFamily: "Inter_700Bold", fontSize: 10, borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  country: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  agency: { fontFamily: "Inter_500Medium", fontSize: 13 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6, flexWrap: "wrap" },
  call: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  callText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  source: { flexDirection: "row", alignItems: "center", gap: 5 },
  sourceText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  verified: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 },
  foot: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 15 },
});
