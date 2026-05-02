import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from "react-native-reanimated";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

function AnimatedNumber({ value }: { value: number }) {
  const colors = useColors();
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    const start = prev.current;
    const end = value;
    prev.current = value;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) });

    let frame: ReturnType<typeof setInterval>;
    const startTime = Date.now();
    frame = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / 1000);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(start + (end - start) * eased));
      if (t >= 1) clearInterval(frame);
    }, 16);
    return () => clearInterval(frame);
  }, [value]);

  return (
    <Text style={[styles.counterNum, { color: "#FF3B3B" }]}>{display.toLocaleString()}</Text>
  );
}

export function LiveScamCounter() {
  const colors = useColors();
  const [todayCount, setTodayCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "posts"), where("createdAt", ">=", startOfToday())),
      (snap) => setTodayCount(snap.size),
      () => {}
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "posts"),
      (snap) => setTotalCount(snap.size),
      () => {}
    );
    return unsub;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      pulse.value = withTiming(1.12, { duration: 300 }, () => {
        pulse.value = withTiming(1, { duration: 300 });
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={[styles.card, { backgroundColor: "#FF3B3B08", borderColor: "#FF3B3B30" }]}>
      <View style={styles.liveRow}>
        <Animated.View style={[styles.liveDot, dotStyle]} />
        <Text style={[styles.liveLabel, { color: "#FF3B3B" }]}>LIVE</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>Scam reports today</Text>
      </View>

      <View style={styles.counters}>
        <View style={styles.counterBlock}>
          <AnimatedNumber value={todayCount} />
          <Text style={[styles.counterLabel, { color: colors.textMuted }]}>Today</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: "#FF3B3B30" }]} />
        <View style={styles.counterBlock}>
          <AnimatedNumber value={totalCount} />
          <Text style={[styles.counterLabel, { color: colors.textMuted }]}>All Time</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: "#FF3B3B30" }]} />
        <View style={styles.counterBlock}>
          <Text style={[styles.counterNum, { color: "#FF3B3B" }]}>
            {todayCount > 0 ? "🔴" : "🟢"}
          </Text>
          <Text style={[styles.counterLabel, { color: colors.textMuted }]}>
            {todayCount > 10 ? "High Alert" : todayCount > 3 ? "Active" : "Quiet"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B3B",
  },
  liveLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13 },
  counters: {
    flexDirection: "row",
    alignItems: "center",
  },
  counterBlock: { flex: 1, alignItems: "center", gap: 3 },
  counterNum: { fontFamily: "Inter_700Bold", fontSize: 28 },
  counterLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  divider: { width: 1, height: 40 },
});
