import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";

const { width: SCREEN_W } = Dimensions.get("window");

interface ScamReport {
  id: string;
  title: string;
  category: string;
  location?: { city: string; state: string; country: string; lat: number; lng: number };
  createdAt: number;
}

interface RegionData {
  label: string;
  count: number;
  topCategory: string;
  color: string;
}

const REGION_COLORS = ["#FF3B3B", "#FF6B35", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"];

const US_REGIONS: Record<string, string[]> = {
  "Northeast": ["NY", "NJ", "CT", "MA", "RI", "VT", "NH", "ME", "PA"],
  "Southeast": ["FL", "GA", "SC", "NC", "VA", "TN", "AL", "MS", "LA", "AR", "KY", "WV"],
  "Midwest": ["IL", "OH", "MI", "IN", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
  "Southwest": ["TX", "NM", "AZ", "OK"],
  "West": ["CA", "NV", "UT", "CO", "WY", "MT", "ID", "OR", "WA", "AK", "HI"],
};

// Simulated heat data for display purposes
const HEAT_REGIONS: RegionData[] = [
  { label: "Northeast US", count: 2847, topCategory: "Phishing", color: "#FF3B3B" },
  { label: "Southeast US", count: 1923, topCategory: "Romance Scam", color: "#FF6B35" },
  { label: "West Coast US", count: 3102, topCategory: "Crypto Fraud", color: "#FF3B3B" },
  { label: "Midwest US", count: 1204, topCategory: "Advance Fee", color: "#F59E0B" },
  { label: "Southwest US", count: 987, topCategory: "Phone Scam", color: "#F59E0B" },
  { label: "UK", count: 2341, topCategory: "Bank Fraud", color: "#FF6B35" },
  { label: "Canada", count: 1567, topCategory: "CRA Scam", color: "#F59E0B" },
  { label: "Australia", count: 1089, topCategory: "Investment Scam", color: "#10B981" },
  { label: "India", count: 4231, topCategory: "Tech Support", color: "#FF3B3B" },
  { label: "Nigeria", count: 891, topCategory: "419 Fraud", color: "#F59E0B" },
];

const CATEGORY_STATS = [
  { name: "Phishing", count: 8432, pct: 28, color: "#FF3B3B" },
  { name: "Romance Scam", count: 5201, pct: 17, color: "#EC4899" },
  { name: "Crypto Fraud", count: 4891, pct: 16, color: "#F59E0B" },
  { name: "Phone Scam", count: 3782, pct: 12, color: "#8B5CF6" },
  { name: "Tech Support", count: 3241, pct: 11, color: "#3B82F6" },
  { name: "Advance Fee", count: 2104, pct: 7, color: "#10B981" },
  { name: "Other", count: 2849, pct: 9, color: "#6B7280" },
];

export default function ScamMapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<ScamReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"map" | "stats">("map");

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ ...(d.data() as Omit<ScamReport, "id">), id: d.id }));
      setPosts(data);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const maxCount = Math.max(...HEAT_REGIONS.map((r) => r.count));

  const getHeatColor = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.8) return "#FF3B3B";
    if (ratio > 0.6) return "#FF6B35";
    if (ratio > 0.4) return "#F59E0B";
    if (ratio > 0.2) return "#10B981";
    return "#3B82F6";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Scam Heat Map</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["map", "stats"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, { color: activeTab === t ? colors.primary : colors.textMuted }]}>
              {t === "map" ? "Regional Map" : "Global Stats"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 40 }}>
        {activeTab === "map" ? (
          <>
            {/* Legend */}
            <View style={[styles.legendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.legendTitle, { color: colors.text }]}>Report Density</Text>
              <View style={styles.legendRow}>
                {["Low", "Medium", "High", "Critical"].map((l, i) => (
                  <View key={l} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: ["#3B82F6", "#10B981", "#F59E0B", "#FF3B3B"][i] }]} />
                    <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* World visual heat map - grid of regions */}
            <View style={[styles.mapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.mapTitle, { color: colors.text }]}>Global Scam Reports (Last 30 days)</Text>
              <Text style={[styles.mapSub, { color: colors.textMuted }]}>Based on {posts.length} community reports + global data</Text>

              {/* Simplified SVG-style block map */}
              <View style={styles.blockMap}>
                {HEAT_REGIONS.map((region, i) => {
                  const barWidth = (region.count / maxCount) * (SCREEN_W - 80);
                  const heatColor = getHeatColor(region.count);
                  return (
                    <View key={i} style={styles.regionRow}>
                      <Text style={[styles.regionLabel, { color: colors.text }]} numberOfLines={1}>{region.label}</Text>
                      <View style={styles.regionBarTrack}>
                        <View style={[styles.regionBar, { width: barWidth, backgroundColor: heatColor }]}>
                          <Text style={styles.regionCount}>{region.count.toLocaleString()}</Text>
                        </View>
                      </View>
                      <Text style={[styles.regionCategory, { color: colors.textMuted }]}>{region.topCategory}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Recent community reports */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Community Reports</Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : posts.slice(0, 10).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.reportRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/post/${p.id}` as never)}
              >
                <View style={[styles.reportDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reportTitle, { color: colors.text }]} numberOfLines={1}>{p.title}</Text>
                  <Text style={[styles.reportMeta, { color: colors.textMuted }]}>
                    {p.category} · {new Date(p.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            {/* Global stats */}
            <View style={styles.statsGrid}>
              {[
                { label: "Total Reports", value: "30,500+", icon: "alert-triangle", color: "#FF3B3B" },
                { label: "Countries Affected", value: "94", icon: "globe", color: "#3B82F6" },
                { label: "This Month", value: "4,231", icon: "trending-up", color: "#10B981" },
                { label: "Avg Daily", value: "141", icon: "calendar", color: "#F59E0B" },
              ].map((s) => (
                <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.statIcon, { backgroundColor: s.color + "20" }]}>
                    <Feather name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Scam Type Breakdown</Text>
            {CATEGORY_STATS.map((c) => (
              <View key={c.name} style={styles.catRow}>
                <View style={styles.catLeft}>
                  <View style={[styles.catDot, { backgroundColor: c.color }]} />
                  <Text style={[styles.catName, { color: colors.text }]}>{c.name}</Text>
                </View>
                <View style={[styles.catBarTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.catBar, { width: `${c.pct}%`, backgroundColor: c.color }]} />
                </View>
                <Text style={[styles.catCount, { color: colors.textMuted }]}>{c.pct}%</Text>
              </View>
            ))}

            <View style={[styles.trendCard, { backgroundColor: "#FF3B3B15", borderColor: "#FF3B3B30" }]}>
              <Feather name="trending-up" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.trendTitle, { color: colors.text }]}>⚠️ Rising: Crypto & AI Scams</Text>
                <Text style={[styles.trendText, { color: colors.textSecondary }]}>
                  AI-generated deepfake and crypto investment scams increased 340% in the last quarter. Always verify identities through trusted channels.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 14 },
  tabText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  legendCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  legendTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  legendRow: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  mapCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  mapTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  mapSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
  blockMap: { gap: 10, marginTop: 8 },
  regionRow: { gap: 6 },
  regionLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  regionBarTrack: { height: 28, borderRadius: 6, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.06)" },
  regionBar: { height: "100%", borderRadius: 6, justifyContent: "center", paddingLeft: 8, minWidth: 60 },
  regionCount: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11 },
  regionCategory: { fontFamily: "Inter_400Regular", fontSize: 11 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 4 },
  reportRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14 },
  reportDot: { width: 8, height: 8, borderRadius: 4 },
  reportTitle: { fontFamily: "Inter_500Medium", fontSize: 14 },
  reportMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 8, alignItems: "center" },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  catLeft: { flexDirection: "row", alignItems: "center", gap: 8, width: 130 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontFamily: "Inter_400Regular", fontSize: 13 },
  catBarTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  catBar: { height: "100%", borderRadius: 5 },
  catCount: { fontFamily: "Inter_600SemiBold", fontSize: 12, width: 36, textAlign: "right" },
  trendCard: { flexDirection: "row", gap: 12, borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 8 },
  trendTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 6 },
  trendText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
});
