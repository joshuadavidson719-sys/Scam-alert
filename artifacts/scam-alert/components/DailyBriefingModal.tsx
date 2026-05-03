import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Linking, Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

// ── Types ────────────────────────────────────────────────────────────────────
type WeatherData = {
  city: string;
  country: string;
  temp: number;
  feelsLike: number;
  condition: string;
  emoji: string;
  wind: number;
  humidity: number;
};

type NewsItem = {
  title: string;
  source: string;
  link: string;
  pubDate: string;
};

// ── Module-level flag — show once per app session ────────────────────────────
let _shownThisSession = false;

// ── Weather helpers ──────────────────────────────────────────────────────────
function wmoToEmoji(code: number): string {
  if (code === 0)            return "☀️";
  if (code <= 2)             return "🌤️";
  if (code === 3)            return "☁️";
  if (code <= 48)            return "🌫️";
  if (code <= 67)            return "🌧️";
  if (code <= 77)            return "🌨️";
  if (code <= 82)            return "🌦️";
  if (code <= 99)            return "⛈️";
  return "🌡️";
}
function wmoToLabel(code: number): string {
  if (code === 0)            return "Clear Sky";
  if (code <= 2)             return "Partly Cloudy";
  if (code === 3)            return "Overcast";
  if (code <= 48)            return "Foggy";
  if (code <= 55)            return "Light Drizzle";
  if (code <= 67)            return "Rain";
  if (code <= 77)            return "Snow";
  if (code <= 82)            return "Showers";
  if (code <= 99)            return "Thunderstorm";
  return "Unknown";
}

// ── Simple RSS XML parser ────────────────────────────────────────────────────
function parseRSS(xml: string, sourceName: string): NewsItem[] {
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  const items: NewsItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRx.exec(xml)) !== null && items.length < 6) {
    const block = m[1];
    const title = (
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
      block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""
    ).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").trim();
    const link = (
      block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ??
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? ""
    ).trim();
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    if (title) items.push({ title, source: sourceName, link, pubDate });
  }
  return items;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const geo = await fetch("https://ip-api.com/json?fields=lat,lon,city,country", { signal: AbortSignal.timeout(6000) });
    const { lat, lon, city, country } = await geo.json();
    const wx = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&temperature_unit=celsius&wind_speed_unit=kmh`,
      { signal: AbortSignal.timeout(6000) },
    );
    const data = await wx.json();
    const c = data.current;
    return {
      city: city || "Your City",
      country: country || "",
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      condition: wmoToLabel(c.weather_code),
      emoji: wmoToEmoji(c.weather_code),
      wind: Math.round(c.wind_speed_10m),
      humidity: Math.round(c.relative_humidity_2m),
    };
  } catch {
    return null;
  }
}

async function fetchNews(): Promise<NewsItem[]> {
  const feeds = [
    { url: "https://feeds.feedburner.com/TheHackersNews", name: "The Hacker News" },
    { url: "https://krebsonsecurity.com/feed/",            name: "Krebs on Security" },
  ];
  const all: NewsItem[] = [];
  await Promise.allSettled(
    feeds.map(async ({ url, name }) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
        const xml = await res.text();
        all.push(...parseRSS(xml, name));
      } catch {}
    }),
  );
  return all.slice(0, 6);
}

// ── Daily tips rotation ───────────────────────────────────────────────────────
const DAILY_TIPS = [
  "🔐 Never share OTPs or PINs — no legitimate bank or company will ever ask for them.",
  "📱 Enable two-factor authentication on all your important accounts today.",
  "🔗 Hover over links before clicking — scammers use lookalike domains.",
  "💸 Unsolicited prize or lottery wins are almost always scams. Ignore them.",
  "📞 Hang up on unexpected calls claiming to be from government agencies or tech support.",
  "🛡️ Regularly check your credit report for unauthorized activity.",
  "📧 Verify email senders carefully — 1 character difference can mean a scam.",
];

// ── Main Component ────────────────────────────────────────────────────────────
export function DailyBriefingModal() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [news, setNews]       = useState<NewsItem[]>([]);
  const [wxLoading, setWxLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const tipIdx = useRef(new Date().getDate() % DAILY_TIPS.length).current;

  useEffect(() => {
    if (_shownThisSession) return;
    // Delay slightly so the home screen settles first
    const t = setTimeout(() => {
      _shownThisSession = true;
      setVisible(true);
      // Load data only when modal opens
      fetchWeather().then((w) => { setWeather(w); setWxLoading(false); });
      fetchNews().then((n)   => { setNews(n);   setNewsLoading(false); });
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const close = () => setVisible(false);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={S.backdrop} onPress={close} />
      <View style={[S.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>

        {/* Handle */}
        <View style={[S.handle, { backgroundColor: colors.border }]} />

        {/* Header row */}
        <View style={S.headerRow}>
          <View>
            <Text style={[S.greeting, { color: colors.text }]}>{greeting} 👋</Text>
            <Text style={[S.dateStr, { color: colors.textMuted }]}>{dateStr}</Text>
          </View>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 18, paddingBottom: 8 }}>

          {/* ── Weather card ── */}
          <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={S.cardHeader}>
              <Feather name="cloud" size={15} color={colors.primary} />
              <Text style={[S.cardTitle, { color: colors.text }]}>Weather</Text>
              {weather && (
                <Text style={[S.cityTxt, { color: colors.textMuted }]}>{weather.city}, {weather.country}</Text>
              )}
            </View>
            {wxLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : weather ? (
              <View style={S.wxRow}>
                <Text style={S.wxEmoji}>{weather.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={S.wxTempRow}>
                    <Text style={[S.wxTemp, { color: colors.text }]}>{weather.temp}°C</Text>
                    <Text style={[S.wxCond, { color: colors.textSecondary }]}>{weather.condition}</Text>
                  </View>
                  <Text style={[S.wxSub, { color: colors.textMuted }]}>
                    Feels like {weather.feelsLike}°C  •  💨 {weather.wind} km/h  •  💧 {weather.humidity}%
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[S.wxSub, { color: colors.textMuted, marginTop: 6 }]}>Weather unavailable</Text>
            )}
          </View>

          {/* ── Daily safety tip ── */}
          <View style={[S.tipCard, { backgroundColor: "#FF3B3B0D", borderColor: "#FF3B3B30" }]}>
            <Text style={[S.tipTitle, { color: colors.primary }]}>🛡️ Safety Tip of the Day</Text>
            <Text style={[S.tipText, { color: colors.text }]}>{DAILY_TIPS[tipIdx]}</Text>
          </View>

          {/* ── Global News ── */}
          <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={S.cardHeader}>
              <Feather name="globe" size={15} color={colors.primary} />
              <Text style={[S.cardTitle, { color: colors.text }]}>Global Scam & Security News</Text>
            </View>
            {newsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 14 }} />
            ) : news.length === 0 ? (
              <Text style={[S.wxSub, { color: colors.textMuted, marginTop: 6 }]}>No news available right now.</Text>
            ) : (
              news.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[S.newsItem, i < news.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => item.link && Linking.openURL(item.link).catch(() => {})}
                  activeOpacity={0.7}
                >
                  <View style={[S.newsBadge, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[S.newsBadgeTxt, { color: colors.primary }]}>{item.source.split(" ")[0]}</Text>
                  </View>
                  <Text style={[S.newsTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                  <Feather name="external-link" size={12} color={colors.textMuted} style={{ marginTop: 2 }} />
                </TouchableOpacity>
              ))
            )}
          </View>

        </ScrollView>

        {/* Close button */}
        <TouchableOpacity
          style={[S.closeBtn, { backgroundColor: colors.primary }]}
          onPress={close}
        >
          <Text style={S.closeBtnTxt}>Got it — Stay Safe Today!</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:        { maxHeight: "88%", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12 },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },

  headerRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 18, marginBottom: 16 },
  greeting:     { fontFamily: "Inter_700Bold", fontSize: 20 },
  dateStr:      { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },

  card:         { borderRadius: 18, borderWidth: 1, padding: 14 },
  cardHeader:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardTitle:    { fontFamily: "Inter_700Bold", fontSize: 14, flex: 1 },
  cityTxt:      { fontFamily: "Inter_400Regular", fontSize: 12 },

  wxRow:        { flexDirection: "row", alignItems: "center", gap: 12 },
  wxEmoji:      { fontSize: 38 },
  wxTempRow:    { flexDirection: "row", alignItems: "baseline", gap: 8 },
  wxTemp:       { fontFamily: "Inter_700Bold", fontSize: 32 },
  wxCond:       { fontFamily: "Inter_400Regular", fontSize: 14 },
  wxSub:        { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 },

  tipCard:      { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  tipTitle:     { fontFamily: "Inter_700Bold", fontSize: 13 },
  tipText:      { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },

  newsItem:     { paddingVertical: 10, gap: 5 },
  newsBadge:    { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  newsBadgeTxt: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  newsTitle:    { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },

  closeBtn:     { marginHorizontal: 18, marginTop: 12, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  closeBtnTxt:  { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
});
