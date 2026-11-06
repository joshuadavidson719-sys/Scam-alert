import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, Platform, useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { InstitutionPaymentPanel } from "@/components/InstitutionPaymentPanel";
import {
  INSTITUTION_REGIONS, DEFAULT_REGION_ID, INSTITUTION_SERVICES, INSTITUTION_CAVEATS,
  type InstitutionRegion,
} from "@/constants/institutionPlans";

const GROUPS: InstitutionRegion["group"][] = [
  "Eastern Caribbean (XCD)", "Canada (CAD)", "Other Caribbean", "International",
];

export default function InstitutionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [regionId, setRegionId] = useState<string>(DEFAULT_REGION_ID);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const region = useMemo(
    () => INSTITUTION_REGIONS.find((r) => r.id === regionId) ?? INSTITUTION_REGIONS[0],
    [regionId]
  );
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as never));

  const priceCard = (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>INSTITUTION PLAN</Text>
      <Text style={[styles.label, { color: colors.text }]}>Country or region</Text>
      <Pressable
        testID="region-selector"
        accessibilityRole="button"
        accessibilityLabel={`Country or region: ${region.name}. Change`}
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [
          styles.select,
          { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="map-pin" size={16} color={colors.primary} />
        <Text style={[styles.selectText, { color: colors.text }]} numberOfLines={1}>{region.name}</Text>
        <Feather name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <InstitutionPaymentPanel key={region.id} region={region} />

      <Pressable
        testID="plan-details-button"
        accessibilityRole="button"
        onPress={() => setDetailsOpen(true)}
        style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={styles.ctaText}>View plan details</Text>
        <Feather name="arrow-right" size={16} color="#fff" />
      </Pressable>
    </View>
  );

  const content = (
    <View style={{ flex: 1, gap: 20 }}>
      {INSTITUTION_SERVICES.map((s, i) => (
        <View key={s.title} style={[styles.service, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.serviceHead}>
            <Text style={[styles.num, { color: colors.primary }]}>{String(i + 1).padStart(2, "0")}</Text>
            <Feather name={s.icon} size={18} color={colors.text} />
            <Text style={[styles.serviceTitle, { color: colors.text }]}>{s.title}</Text>
          </View>
          <Text style={[styles.body, { color: colors.textSecondary }]}>{s.body}</Text>
        </View>
      ))}

      <View>
        <Text style={[styles.section, { color: colors.text }]}>Useful now, free</Text>
        <LinkRow icon="book-open" title="Free scam lessons" sub="Share with staff and customers" onPress={() => router.push("/scam-videos" as never)} />
        <LinkRow icon="flag" title="Report a suspected fake page" sub="Posts to the community feed. Not an official takedown request." onPress={() => router.push("/(tabs)/create" as never)} />
      </View>

      <View style={[styles.caveats, { borderColor: colors.border }]}>
        {INSTITUTION_CAVEATS.map((c) => (
          <View key={c} style={styles.caveatRow}>
            <Feather name="info" size={14} color={colors.textMuted} style={{ marginTop: 2 }} />
            <Text style={[styles.caveat, { color: colors.textSecondary }]}>{c}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  function LinkRow(p: { icon: "book-open" | "flag"; title: string; sub: string; onPress: () => void }) {
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${p.title}. ${p.sub}`}
        onPress={p.onPress}
        style={({ pressed }) => [styles.linkRow, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 }]}
      >
        <Feather name={p.icon} size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.linkTitle, { color: colors.text }]}>{p.title}</Text>
          <Text style={[styles.linkSub, { color: colors.textSecondary }]}>{p.sub}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={back} style={styles.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]} accessibilityRole="header">Banks & Credit Unions</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad + 32 }}>
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={styles.inner}>
            <Text style={styles.heroEyebrow}>FOR BANKS & CREDIT UNIONS</Text>
            <Text style={[styles.heroTitle, wide && { fontSize: 40, lineHeight: 46 }]}>
              Your name is what scammers borrow. Let's guard it together.
            </Text>
            <Text style={styles.heroBody}>
              A Caribbean-founded scam-awareness community, starting in Grenada and expanding across the Caribbean and Canada. A proposed managed service to help institutions protect trust and educate people.
            </Text>
          </View>
        </View>

        <View style={[styles.inner, styles.main, wide && styles.mainWide]}>
          {wide ? (
            <>
              {content}
              <View style={{ width: 380 }}>{priceCard}</View>
            </>
          ) : (
            <>
              {priceCard}
              {content}
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} accessibilityLabel="Close country list">
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose country or region</Text>
            <ScrollView style={{ maxHeight: 460 }}>
              {GROUPS.map((g) => (
                <View key={g}>
                  <Text style={[styles.groupLabel, { color: colors.textMuted }]}>{g.toUpperCase()}</Text>
                  {INSTITUTION_REGIONS.filter((r) => r.group === g).map((r) => {
                    const sel = r.id === regionId;
                    return (
                      <Pressable
                        key={r.id}
                        testID={`region-${r.id}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: sel }}
                        onPress={() => { setRegionId(r.id); setPickerOpen(false); }}
                        style={[styles.option, sel && { backgroundColor: colors.primary + "1A" }]}
                      >
                        <Text style={[styles.optionText, { color: colors.text }]}>{r.name}</Text>
                        <Text style={[styles.optionPrice, { color: colors.textSecondary }]}>{r.status === "set" ? r.priceLabel : r.status === "tbc" ? "TBC" : "Not set"}</Text>
                        {sel && <Feather name="check" size={16} color={colors.primary} />}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={detailsOpen} transparent animationType="fade" onRequestClose={() => setDetailsOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]} accessibilityViewIsModal>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Plan details</Text>
            <Detail k="Plan" v="Banks & Credit Unions" c={colors} />
            <Detail k="Country" v={region.name} c={colors} />
            <Detail k="Price" v={region.status === "set" ? `${region.priceLabel} / month per institution` : region.priceLabel} c={colors} />
            <Detail k="Includes" v="Name protection watch, daily scam education, public-awareness ads" c={colors} />
            <Detail k="Billing" v="Hosted website checkout through Whop. Automatically renews every 30 days; cancel future renewals in Whop Orders." c={colors} />
            <Text style={[styles.body, { color: colors.textSecondary, marginTop: 12 }]}>
              Viewing these details does not purchase a subscription. Service delivery, advertising budget and onboarding require agreement. Check your Whop receipt and Orders for payment status.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDetailsOpen(false)}
              style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, marginTop: 16 }]}
            >
              <Text style={styles.ctaText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Detail({ k, v, c }: { k: string; v: string; c: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: c.border }]}>
      <Text style={[styles.detailK, { color: c.textMuted }]}>{k}</Text>
      <Text style={[styles.detailV, { color: c.text }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  inner: { width: "100%", maxWidth: 1100, alignSelf: "center", paddingHorizontal: 16 },
  hero: { paddingVertical: 28 },
  heroEyebrow: { color: "#fff", opacity: 0.85, fontFamily: "Inter_600SemiBold", fontSize: 11.5, letterSpacing: 1.4 },
  heroTitle: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 26, lineHeight: 32, marginTop: 8, letterSpacing: -0.5, maxWidth: 720 },
  heroBody: { color: "#fff", opacity: 0.92, fontFamily: "Inter_400Regular", fontSize: 14.5, lineHeight: 21, marginTop: 10, maxWidth: 640 },
  main: { marginTop: 20, gap: 20 },
  mainWide: { flexDirection: "row", alignItems: "flex-start", gap: 28 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.2 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13.5, marginTop: 12, marginBottom: 6 },
  select: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  selectText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15 },
  priceBlock: { borderTopWidth: 1, marginTop: 16, paddingTop: 16 },
  price: { fontFamily: "Inter_700Bold", fontSize: 34, letterSpacing: -1 },
  priceAlt: { fontFamily: "Inter_700Bold", fontSize: 22 },
  per: { fontFamily: "Inter_500Medium", fontSize: 15, letterSpacing: 0 },
  priceNote: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4, lineHeight: 18 },
  notice: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 },
  noticeText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 18 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, minHeight: 48, marginTop: 14 },
  ctaText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  service: { borderWidth: 1, borderRadius: 16, padding: 16 },
  serviceHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  num: { fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 1 },
  serviceTitle: { fontFamily: "Inter_700Bold", fontSize: 16, flex: 1 },
  body: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  section: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 8 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8, minHeight: 56 },
  linkTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14.5 },
  linkSub: { fontFamily: "Inter_400Regular", fontSize: 12.5, marginTop: 2 },
  caveats: { borderWidth: 1, borderStyle: "dashed", borderRadius: 14, padding: 14, gap: 8 },
  caveatRow: { flexDirection: "row", gap: 8 },
  caveat: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12.5, lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 },
  sheet: { borderRadius: 18, padding: 18, width: "100%", maxWidth: 480, alignSelf: "center" },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 10 },
  groupLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1, marginTop: 12, marginBottom: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, minHeight: 44, borderRadius: 10 },
  optionText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14.5 },
  optionPrice: { fontFamily: "Inter_400Regular", fontSize: 12.5 },
  detailRow: { paddingVertical: 10, borderBottomWidth: 1 },
  detailK: { fontFamily: "Inter_600SemiBold", fontSize: 11.5, letterSpacing: 0.6 },
  detailV: { fontFamily: "Inter_500Medium", fontSize: 14.5, marginTop: 2 },
});
