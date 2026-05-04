import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toDateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

type DayActivity = { posts: number; reels: number };

type Props = {
  userId: string;
  joinedAt?: number | null;
};

export function UserActivityCalendar({ userId, joinedAt }: Props) {
  const colors = useColors();
  const today = new Date();

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [activity, setActivity]   = useState<Record<string, DayActivity>>({});
  const [loading, setLoading]     = useState(true);
  const [totalPosts, setTotalPosts]  = useState(0);
  const [totalReels, setTotalReels]  = useState(0);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const map: Record<string, DayActivity> = {};
    let postsCount = 0;
    let reelsCount = 0;

    const processTs = (ts: any, field: "posts" | "reels") => {
      let ms: number | null = null;
      if (typeof ts === "number") ms = ts;
      else if (ts?.seconds) ms = ts.seconds * 1000;
      else if (ts?.toMillis) ms = ts.toMillis();
      if (!ms) return;
      const key = toDateKey(ms);
      if (!map[key]) map[key] = { posts: 0, reels: 0 };
      map[key][field]++;
    };

    Promise.all([
      getDocs(query(collection(db, "posts"), where("authorId", "==", userId))),
      getDocs(query(collection(db, "reels"), where("userId",   "==", userId))),
    ]).then(([postsSnap, reelsSnap]) => {
      postsSnap.docs.forEach((d) => { processTs(d.data().createdAt, "posts"); postsCount++; });
      reelsSnap.docs.forEach((d) => { processTs(d.data().createdAt, "reels"); reelsCount++; });
      setActivity(map);
      setTotalPosts(postsCount);
      setTotalReels(reelsCount);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [userId]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build the grid
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const getActivity = (day: number): DayActivity | null => {
    const key = `${viewYear}-${viewMonth}-${day}`;
    return activity[key] ?? null;
  };

  const joinedDate = joinedAt ? new Date(joinedAt) : null;

  return (
    <View style={[S.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={S.cardHeader}>
        <Text style={[S.cardTitle, { color: colors.text }]}>📅 Activity Calendar</Text>
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {/* Summary row */}
      <View style={[S.summaryRow, { borderColor: colors.border }]}>
        <View style={S.summaryItem}>
          <Text style={[S.summaryNum, { color: colors.primary }]}>{totalPosts}</Text>
          <Text style={[S.summaryLabel, { color: colors.textMuted }]}>Posts</Text>
        </View>
        <View style={[S.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={S.summaryItem}>
          <Text style={[S.summaryNum, { color: "#EC4899" }]}>{totalReels}</Text>
          <Text style={[S.summaryLabel, { color: colors.textMuted }]}>Reels</Text>
        </View>
        <View style={[S.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={S.summaryItem}>
          <Text style={[S.summaryNum, { color: colors.text }]}>{Object.keys(activity).length}</Text>
          <Text style={[S.summaryLabel, { color: colors.textMuted }]}>Active Days</Text>
        </View>
        {joinedDate && (
          <>
            <View style={[S.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={S.summaryItem}>
              <Text style={[S.summaryNum, { color: colors.text, fontSize: 11 }]}>
                {joinedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
              </Text>
              <Text style={[S.summaryLabel, { color: colors.textMuted }]}>Joined</Text>
            </View>
          </>
        )}
      </View>

      {/* Month nav */}
      <View style={S.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={S.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[S.navArrow, { color: colors.textSecondary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[S.monthLabel, { color: colors.text }]}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={S.navBtn}
          disabled={viewYear === today.getFullYear() && viewMonth === today.getMonth()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[S.navArrow, {
            color: viewYear === today.getFullYear() && viewMonth === today.getMonth()
              ? colors.border : colors.textSecondary,
          }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={S.weekRow}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={[S.weekLabel, { color: colors.textMuted }]}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={S.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={S.cell} />;
          const act = getActivity(day);
          const active = !!act;
          const isT = isToday(day);
          const total = (act?.posts ?? 0) + (act?.reels ?? 0);
          return (
            <View key={`d-${day}`} style={S.cell}>
              <View style={[
                S.dayCircle,
                isT && { borderWidth: 2, borderColor: colors.primary },
                active && { backgroundColor: colors.primary + "22" },
              ]}>
                <Text style={[
                  S.dayNum,
                  { color: active ? colors.primary : isT ? colors.primary : colors.text },
                  active && { fontFamily: "Inter_700Bold" },
                ]}>
                  {day}
                </Text>
                {active && (
                  <View style={[S.dotRow]}>
                    {act!.posts > 0 && <View style={[S.dot, { backgroundColor: colors.primary }]} />}
                    {act!.reels > 0 && <View style={[S.dot, { backgroundColor: "#EC4899" }]} />}
                  </View>
                )}
                {active && total > 1 && (
                  <Text style={[S.actCount, { color: colors.primary }]}>{total}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={S.legend}>
        <View style={S.legendItem}>
          <View style={[S.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[S.legendTxt, { color: colors.textMuted }]}>Post</Text>
        </View>
        <View style={S.legendItem}>
          <View style={[S.legendDot, { backgroundColor: "#EC4899" }]} />
          <Text style={[S.legendTxt, { color: colors.textMuted }]}>Reel</Text>
        </View>
        <View style={S.legendItem}>
          <View style={[S.legendDot, { backgroundColor: colors.primary, opacity: 0 }, { borderWidth: 2, borderColor: colors.primary }]} />
          <Text style={[S.legendTxt, { color: colors.textMuted }]}>Today</Text>
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  card:         { borderRadius: 18, borderWidth: 1, margin: 16, padding: 16 },
  cardHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardTitle:    { fontFamily: "Inter_700Bold", fontSize: 15 },

  summaryRow:   { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 10, marginBottom: 14 },
  summaryItem:  { flex: 1, alignItems: "center", gap: 2 },
  summaryNum:   { fontFamily: "Inter_700Bold", fontSize: 15 },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 10 },
  summaryDivider: { width: 1, height: 28 },

  monthNav:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn:       { padding: 4 },
  navArrow:     { fontFamily: "Inter_700Bold", fontSize: 24, lineHeight: 28 },
  monthLabel:   { fontFamily: "Inter_700Bold", fontSize: 15 },

  weekRow:      { flexDirection: "row", marginBottom: 4 },
  weekLabel:    { flex: 1, textAlign: "center", fontFamily: "Inter_500Medium", fontSize: 10 },

  grid:         { flexDirection: "row", flexWrap: "wrap" },
  cell:         { width: "14.28%", alignItems: "center", paddingVertical: 3 },
  dayCircle:    { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", position: "relative" },
  dayNum:       { fontFamily: "Inter_500Medium", fontSize: 12 },
  dotRow:       { flexDirection: "row", gap: 2, position: "absolute", bottom: 2 },
  dot:          { width: 4, height: 4, borderRadius: 2 },
  actCount:     { position: "absolute", top: 1, right: 2, fontFamily: "Inter_700Bold", fontSize: 8 },

  legend:       { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 10 },
  legendItem:   { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendTxt:    { fontFamily: "Inter_400Regular", fontSize: 11 },
});
