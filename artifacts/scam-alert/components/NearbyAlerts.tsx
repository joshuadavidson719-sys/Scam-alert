import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import * as Location from "expo-location";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";

interface NearbyPost {
  id: string;
  title: string;
  category: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  distance?: number;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Status = "idle" | "requesting" | "granted" | "denied" | "loading" | "done";

export function NearbyAlerts() {
  const colors = useColors();
  const [status, setStatus] = useState<Status>("idle");
  const [posts, setPosts] = useState<NearbyPost[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [cityName, setCityName] = useState("");

  const requestAndLoad = async () => {
    setStatus("requesting");
    const { status: perm } = await Location.requestForegroundPermissionsAsync();
    if (perm !== "granted") { setStatus("denied"); return; }

    setStatus("loading");
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude: lat, longitude: lng } = loc.coords;
    setUserLocation({ lat, lng });

    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geo[0]) {
        setCityName(geo[0].city ?? geo[0].region ?? geo[0].country ?? "your area");
      }
    } catch {}

    try {
      const snap = await getDocs(
        query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(100))
      );
      const nearby: NearbyPost[] = snap.docs
        .map((d) => {
          const data = d.data();
          const pLat = data.lat as number | undefined;
          const pLng = data.lng as number | undefined;
          const dist =
            pLat !== undefined && pLng !== undefined
              ? haversine(lat, lng, pLat, pLng)
              : undefined;
          return {
            id: d.id,
            title: data.title as string,
            category: data.category as string,
            city: data.city as string | undefined,
            country: data.country as string | undefined,
            lat: pLat,
            lng: pLng,
            distance: dist,
          };
        })
        .filter((p) => p.distance !== undefined && p.distance <= 200)
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
        .slice(0, 10);

      setPosts(nearby);
    } catch {}
    setStatus("done");
  };

  if (status === "idle") {
    return (
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={requestAndLoad}
        activeOpacity={0.8}
      >
        <Feather name="map-pin" size={20} color="#FF3B3B" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>Nearby Alerts</Text>
          <Text style={[styles.bannerSub, { color: colors.textMuted }]}>
            Tap to see scam reports near you
          </Text>
        </View>
        <View style={[styles.enableBtn, { backgroundColor: "#FF3B3B" }]}>
          <Text style={styles.enableBtnText}>Enable</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (status === "requesting" || status === "loading") {
    return (
      <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator color="#FF3B3B" size="small" />
        <Text style={[styles.bannerTitle, { color: colors.text }]}>
          {status === "requesting" ? "Requesting location..." : "Finding nearby alerts..."}
        </Text>
      </View>
    );
  }

  if (status === "denied") {
    return (
      <View style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="map-pin" size={20} color={colors.textMuted} />
        <Text style={[styles.bannerSub, { color: colors.textMuted, flex: 1 }]}>
          Location access denied. Enable it in Settings to see nearby alerts.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Feather name="map-pin" size={15} color="#FF3B3B" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Nearby Alerts
          </Text>
          {cityName ? (
            <View style={[styles.cityPill, { backgroundColor: "#FF3B3B20" }]}>
              <Text style={styles.cityText}>{cityName}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.countLabel, { color: colors.textMuted }]}>
          {posts.length > 0 ? `${posts.length} found` : "None nearby"}
        </Text>
      </View>

      {posts.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 28 }}>🗺️</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No geotagged scam reports found within 200 km of you yet.
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={posts}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.nearbyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/post/${item.id}` as never)}
              activeOpacity={0.8}
            >
              <Feather name="alert-triangle" size={18} color="#FF3B3B" />
              <Text style={[styles.nearbyTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.distance !== undefined && (
                <Text style={[styles.nearbyDist, { color: colors.textMuted }]}>
                  📍 {item.distance < 1 ? "<1 km" : `${Math.round(item.distance)} km away`}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  bannerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  bannerSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  enableBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  enableBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  cityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cityText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#FF3B3B" },
  countLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  emptyCard: {
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  listRow: { paddingHorizontal: 16, gap: 10 },
  nearbyCard: {
    width: 160,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  nearbyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 18 },
  nearbyDist: { fontFamily: "Inter_400Regular", fontSize: 11 },
});
