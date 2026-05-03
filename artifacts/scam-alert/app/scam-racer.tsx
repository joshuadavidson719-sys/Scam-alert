import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, ScrollView, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, query, where, orderBy, limit,
  getDocs, serverTimestamp,
} from "firebase/firestore";
import { UserAvatar } from "@/components/UserAvatar";

const { width: SW, height: SH } = Dimensions.get("window");

// ── Constants ──────────────────────────────────────────────────────────────
const LANES        = 4;
const LANE_W       = SW / LANES;
const PW           = 40;   // player width
const PH           = 76;   // player height
const EW           = 38;   // enemy width
const EH           = 70;   // enemy height
const IW           = 36;   // item width
const IH           = 36;   // item height
const HUD_H        = 68;
const CTRL_H       = 112;
const HIT_PAD      = 11;
const DASH_H       = 32;
const DASH_GAP     = 26;
const DASH_CYCLE   = DASH_H + DASH_GAP;
const TICK_MS      = 28;
const BASE_SPEED   = 5.8;
const SPD_INC      = 0.65;
const TICKS_PER_LVL= 460;
const BASE_SPAWN   = 54;
const MIN_SPAWN    = 17;
const NITRO_MAX    = 100;
const NITRO_DRAIN  = 1.6;
const NITRO_FILL   = 0.32;
const NITRO_MULT   = 1.8;
const PLAYER_BOTTOM= 22;   // offset from bottom of road area

// ── Data ──────────────────────────────────────────────────────────────────
const ENEMIES = [
  { id: "phish",  label: "Phishing",   symbol: "📧", color: "#DC2626", spd: 1.0  },
  { id: "call",   label: "Fake Call",  symbol: "📞", color: "#EA580C", spd: 1.15 },
  { id: "crypto", label: "Crypto",     symbol: "₿",  color: "#7C3AED", spd: 1.3  },
  { id: "sms",    label: "Scam SMS",   symbol: "💬", color: "#B91C1C", spd: 1.05 },
  { id: "prize",  label: "Fake Prize", symbol: "🎰", color: "#D97706", spd: 0.9  },
  { id: "hack",   label: "Hacker",     symbol: "💻", color: "#1E40AF", spd: 1.2  },
  { id: "virus",  label: "Malware",    symbol: "🦠", color: "#9333EA", spd: 1.1  },
  { id: "bank",   label: "Bank Scam",  symbol: "🏦", color: "#0F766E", spd: 0.95 },
] as const;

const POWERUPS = [
  { id: "shield", label: "Shield",   symbol: "🛡️", color: "#3B82F6", effect: "shield" as const },
  { id: "nitro",  label: "Nitro",    symbol: "⚡", color: "#FBBF24", effect: "nitro"  as const },
  { id: "bonus",  label: "+200",     symbol: "💰", color: "#10B981", effect: "bonus"  as const },
  { id: "badge",  label: "+100",     symbol: "🚨", color: "#FF3B3B", effect: "badge"  as const },
] as const;

type EnemyDef   = typeof ENEMIES[number];
type PowerupDef = typeof POWERUPS[number];
type Screen     = "menu" | "playing" | "gameover";
type Leader     = { userId: string; username: string; profilePhoto?: string; score: number };
type Car        = { id: string; lane: number; y: number; type: EnemyDef };
type Item       = { id: string; lane: number; y: number; type: PowerupDef };
type Flash      = { id: string; text: string; color: string; x: number; y: number; op: number };

type GS = {
  cars: Car[]; items: Item[]; flashes: Flash[];
  lane: number; lives: number; score: number;
  level: number; tick: number; nextId: number;
  shielded: boolean; shieldTicks: number;
  nitro: number; nitroActive: boolean; spawnIn: number;
  roadOff: number;
};

function mkGS(): GS {
  return {
    cars: [], items: [], flashes: [],
    lane: 1, lives: 3, score: 0,
    level: 1, tick: 0, nextId: 0,
    shielded: false, shieldTicks: 0,
    nitro: NITRO_MAX, nitroActive: false,
    spawnIn: BASE_SPAWN, roadOff: 0,
  };
}

function pLeft(lane: number) { return lane * LANE_W + (LANE_W - PW) / 2; }
function eLeft(lane: number) { return lane * LANE_W + (LANE_W - EW) / 2; }
function iLeft(lane: number) { return lane * LANE_W + (LANE_W - IW) / 2; }
const MEDALS = ["🥇", "🥈", "🥉"];

// ── Sub-components ─────────────────────────────────────────────────────────
function PlayerCar({ shielded, nitroActive }: { shielded: boolean; nitroActive: boolean }) {
  return (
    <View style={{ width: PW + 14, height: PH + 22, alignItems: "center", justifyContent: "center" }}>
      {/* Nitro flame */}
      {nitroActive && (
        <View style={{ position: "absolute", bottom: 0, alignItems: "center" }}>
          <View style={{ width: 14, height: 26, backgroundColor: "#FF6B00", borderRadius: 7, opacity: 0.92 }} />
          <View style={{ position: "absolute", bottom: 4, width: 8, height: 18, backgroundColor: "#FCD34D", borderRadius: 4 }} />
          <View style={{ position: "absolute", bottom: 7, width: 4, height: 12, backgroundColor: "#FEF9C3", borderRadius: 2 }} />
        </View>
      )}
      {/* Exhaust puffs */}
      <View style={{ position: "absolute", bottom: 24, left: 9, width: 8, height: 8, backgroundColor: "rgba(200,200,200,0.25)", borderRadius: 4 }} />
      <View style={{ position: "absolute", bottom: 24, right: 9, width: 8, height: 8, backgroundColor: "rgba(200,200,200,0.25)", borderRadius: 4 }} />

      {/* Shield aura */}
      {shielded && (
        <View style={{
          position: "absolute", top: 8, left: -1, right: -1, bottom: 14,
          borderRadius: 22, borderWidth: 2.5, borderColor: "#60A5FA",
          backgroundColor: "rgba(59,130,246,0.1)",
        }} />
      )}

      {/* Body */}
      <View style={{
        width: PW, height: PH, borderRadius: 11,
        backgroundColor: "#1D4ED8",
        shadowColor: "#60A5FA", shadowOpacity: 0.7, shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 }, elevation: 10,
      }}>
        {/* Top highlight */}
        <View style={{ position: "absolute", top: 0, left: 5, right: 5, height: 3, backgroundColor: "#3B82F6", borderTopLeftRadius: 11, borderTopRightRadius: 11 }} />
        {/* Side stripes */}
        <View style={{ position: "absolute", top: 14, left: 0, width: 3, height: 50, backgroundColor: "#93C5FD", borderRadius: 1.5 }} />
        <View style={{ position: "absolute", top: 14, right: 0, width: 3, height: 50, backgroundColor: "#93C5FD", borderRadius: 1.5 }} />

        {/* Cabin */}
        <View style={{ position: "absolute", top: 15, left: 5, right: 5, height: 30, backgroundColor: "#1E3A8A", borderRadius: 7 }}>
          {/* Windshield */}
          <View style={{ position: "absolute", top: 2, left: 3, right: 3, height: 12, backgroundColor: "rgba(147,197,253,0.55)", borderRadius: 4 }}>
            <View style={{ position: "absolute", top: 2, left: 3, width: 7, height: 5, backgroundColor: "rgba(255,255,255,0.4)", borderRadius: 2 }} />
          </View>
          {/* Rear window */}
          <View style={{ position: "absolute", bottom: 2, left: 3, right: 3, height: 10, backgroundColor: "rgba(147,197,253,0.4)", borderRadius: 4 }} />
        </View>

        {/* Headlights */}
        <View style={{ position: "absolute", top: 4, left: 4, width: 12, height: 6, backgroundColor: "#FEF3C7", borderRadius: 3, shadowColor: "#FDE68A", shadowOpacity: 1, shadowRadius: 5, elevation: 5 }} />
        <View style={{ position: "absolute", top: 4, right: 4, width: 12, height: 6, backgroundColor: "#FEF3C7", borderRadius: 3, shadowColor: "#FDE68A", shadowOpacity: 1, shadowRadius: 5, elevation: 5 }} />
        {/* Brake lights */}
        <View style={{ position: "absolute", bottom: 4, left: 4, width: 12, height: 6, backgroundColor: "#EF4444", borderRadius: 3, shadowColor: "#EF4444", shadowOpacity: 0.9, shadowRadius: 5, elevation: 5 }} />
        <View style={{ position: "absolute", bottom: 4, right: 4, width: 12, height: 6, backgroundColor: "#EF4444", borderRadius: 3, shadowColor: "#EF4444", shadowOpacity: 0.9, shadowRadius: 5, elevation: 5 }} />
        {/* Alert badge */}
        <Text style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 12 }}>🚨</Text>
      </View>

      {/* Wheels */}
      <View style={{ position: "absolute", top: 15, left: 0, width: 10, height: 20, backgroundColor: "#0F172A", borderRadius: 4, borderWidth: 1.5, borderColor: "#475569" }} />
      <View style={{ position: "absolute", top: 15, right: 0, width: 10, height: 20, backgroundColor: "#0F172A", borderRadius: 4, borderWidth: 1.5, borderColor: "#475569" }} />
      <View style={{ position: "absolute", bottom: 20, left: 0, width: 10, height: 20, backgroundColor: "#0F172A", borderRadius: 4, borderWidth: 1.5, borderColor: "#475569" }} />
      <View style={{ position: "absolute", bottom: 20, right: 0, width: 10, height: 20, backgroundColor: "#0F172A", borderRadius: 4, borderWidth: 1.5, borderColor: "#475569" }} />
    </View>
  );
}

function EnemyCar({ type }: { type: EnemyDef }) {
  return (
    <View style={{ width: EW + 12, height: EH + 12, alignItems: "center", justifyContent: "center" }}>
      <View style={{
        width: EW, height: EH, borderRadius: 10,
        backgroundColor: type.color,
        shadowColor: type.color, shadowOpacity: 0.55, shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 }, elevation: 8,
      }}>
        {/* Highlight */}
        <View style={{ position: "absolute", top: 0, left: 5, right: 5, height: 3, backgroundColor: "rgba(255,255,255,0.22)", borderTopLeftRadius: 10, borderTopRightRadius: 10 }} />
        {/* Dark side shading */}
        <View style={{ position: "absolute", top: 0, left: 0, width: 5, bottom: 0, backgroundColor: "rgba(0,0,0,0.18)", borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }} />
        <View style={{ position: "absolute", top: 0, right: 0, width: 5, bottom: 0, backgroundColor: "rgba(0,0,0,0.18)", borderTopRightRadius: 10, borderBottomRightRadius: 10 }} />

        {/* Cabin */}
        <View style={{ position: "absolute", top: 14, left: 4, right: 4, height: 26, backgroundColor: "rgba(0,0,0,0.42)", borderRadius: 6 }}>
          <View style={{ position: "absolute", top: 2, left: 3, right: 3, height: 11, backgroundColor: "rgba(80,80,110,0.55)", borderRadius: 3 }} />
          <View style={{ position: "absolute", bottom: 2, left: 3, right: 3, height: 9, backgroundColor: "rgba(70,70,100,0.45)", borderRadius: 3 }} />
        </View>

        {/* Headlights (facing player = bottom of enemy) */}
        <View style={{ position: "absolute", bottom: 4, left: 3, width: 11, height: 6, backgroundColor: "#FCD34D", borderRadius: 3, shadowColor: "#FBBF24", shadowOpacity: 1, shadowRadius: 5, elevation: 5 }} />
        <View style={{ position: "absolute", bottom: 4, right: 3, width: 11, height: 6, backgroundColor: "#FCD34D", borderRadius: 3, shadowColor: "#FBBF24", shadowOpacity: 1, shadowRadius: 5, elevation: 5 }} />
        {/* Tail lights */}
        <View style={{ position: "absolute", top: 4, left: 3, width: 11, height: 5, backgroundColor: "rgba(120,120,120,0.5)", borderRadius: 2.5 }} />
        <View style={{ position: "absolute", top: 4, right: 3, width: 11, height: 5, backgroundColor: "rgba(120,120,120,0.5)", borderRadius: 2.5 }} />

        {/* Scam symbol */}
        <Text style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 14 }}>{type.symbol}</Text>
        <Text style={{ position: "absolute", top: 48, left: 0, right: 0, textAlign: "center", fontSize: 5, color: "rgba(255,255,255,0.6)", fontWeight: "bold", letterSpacing: 0.5 }}>
          {type.label.toUpperCase()}
        </Text>
      </View>

      {/* Wheels */}
      <View style={{ position: "absolute", top: 12, left: 0, width: 9, height: 18, backgroundColor: "#0F172A", borderRadius: 3.5, borderWidth: 1.5, borderColor: "#374151" }} />
      <View style={{ position: "absolute", top: 12, right: 0, width: 9, height: 18, backgroundColor: "#0F172A", borderRadius: 3.5, borderWidth: 1.5, borderColor: "#374151" }} />
      <View style={{ position: "absolute", bottom: 12, left: 0, width: 9, height: 18, backgroundColor: "#0F172A", borderRadius: 3.5, borderWidth: 1.5, borderColor: "#374151" }} />
      <View style={{ position: "absolute", bottom: 12, right: 0, width: 9, height: 18, backgroundColor: "#0F172A", borderRadius: 3.5, borderWidth: 1.5, borderColor: "#374151" }} />
    </View>
  );
}

function PowerupItem({ type }: { type: PowerupDef }) {
  return (
    <View style={{
      width: IW, height: IH, borderRadius: IW / 2,
      backgroundColor: type.color + "30", borderWidth: 2, borderColor: type.color,
      alignItems: "center", justifyContent: "center",
      shadowColor: type.color, shadowOpacity: 0.8, shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 }, elevation: 8,
    }}>
      <Text style={{ fontSize: 16 }}>{type.symbol}</Text>
    </View>
  );
}

function Road({ roadOff, roadH }: { roadOff: number; roadH: number }) {
  const numDashes = Math.ceil(roadH / DASH_CYCLE) + 2;
  const phase     = roadOff % DASH_CYCLE;

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      {/* Asphalt */}
      <LinearGradient
        colors={["#0D1117", "#161B22", "#1A1F2E"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      />
      {/* Horizon haze */}
      <LinearGradient
        colors={["rgba(13,17,23,0.92)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80 }}
      />

      {/* Left curb */}
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, overflow: "hidden" }}>
        {Array.from({ length: Math.ceil(roadH / 20) + 2 }).map((_, i) => (
          <View key={i} style={{
            position: "absolute", left: 0, width: 6, height: 20,
            backgroundColor: i % 2 === 0 ? "#EF4444" : "#E5E7EB",
            top: i * 20 - (phase % 20),
          }} />
        ))}
      </View>
      {/* Right curb */}
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, overflow: "hidden" }}>
        {Array.from({ length: Math.ceil(roadH / 20) + 2 }).map((_, i) => (
          <View key={i} style={{
            position: "absolute", right: 0, width: 6, height: 20,
            backgroundColor: i % 2 === 0 ? "#EF4444" : "#E5E7EB",
            top: i * 20 - (phase % 20),
          }} />
        ))}
      </View>

      {/* Inner road edge lines */}
      <View style={{ position: "absolute", left: 6, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
      <View style={{ position: "absolute", right: 6, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />

      {/* Lane dividers */}
      {[1, 2, 3].map((d) => (
        <View key={d} style={{ position: "absolute", left: d * LANE_W - 1.5, top: 0, bottom: 0, width: 3, overflow: "hidden" }}>
          {Array.from({ length: numDashes }).map((_, i) => (
            <View key={i} style={{
              position: "absolute", left: 0, width: 3, height: DASH_H,
              backgroundColor: "rgba(255,255,255,0.68)", borderRadius: 2,
              top: phase - DASH_CYCLE + i * DASH_CYCLE,
            }} />
          ))}
        </View>
      ))}

      {/* Road grain overlay */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={{
          position: "absolute",
          left: 8 + (i * SW * 0.14),
          top: 0, bottom: 0, width: 1,
          backgroundColor: "rgba(255,255,255,0.03)",
        }} />
      ))}
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ScamRacer() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [screen,       setScreen]       = useState<Screen>("menu");
  const [renderTick,   setRenderTick]   = useState(0);
  const [finalScore,   setFinalScore]   = useState(0);
  const [newBest,      setNewBest]      = useState(false);
  const [personalBest, setPersonalBest] = useState(0);
  const [submitting,   setSubmitting]   = useState(false);
  const [leaders,      setLeaders]      = useState<Leader[]>([]);
  const [ldrTab,       setLdrTab]       = useState<"friends" | "global">("friends");
  const [ldrLoading,   setLdrLoading]   = useState(false);
  const [roadH,        setRoadH]        = useState(SH - 80 - HUD_H - CTRL_H);

  const gs         = useRef<GS>(mkGS());
  const loopRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickFnRef  = useRef<() => void>(() => {});
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const roadHRef   = useRef(roadH);

  useEffect(() => { roadHRef.current = roadH; }, [roadH]);

  // ── Personal best ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "racerScores"),
      where("userId", "==", user.uid), orderBy("score", "desc"), limit(1))
    ).then((s) => { if (!s.empty) setPersonalBest(s.docs[0].data().score as number); }).catch(() => {});
  }, [user]);

  // ── Leaderboard ───────────────────────────────────────────────────────────
  const loadLeaders = useCallback(async () => {
    if (!user || !profile) return;
    setLdrLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "racerScores"), orderBy("score", "desc"), limit(300))
      );
      const friendIds = new Set([user.uid, ...(profile.following ?? [])]);
      const seen = new Set<string>();
      const all: Leader[] = [];
      const friends: Leader[] = [];
      snap.docs.forEach((d) => {
        const data = d.data();
        const e: Leader = { userId: data.userId, username: data.username, profilePhoto: data.profilePhoto ?? undefined, score: data.score };
        if (!seen.has(data.userId)) {
          seen.add(data.userId);
          all.push(e);
          if (friendIds.has(data.userId)) friends.push(e);
        }
      });
      setLeaders(ldrTab === "friends" ? friends.slice(0, 15) : all.slice(0, 15));
    } catch {}
    setLdrLoading(false);
  }, [user, profile, ldrTab]);

  useEffect(() => { loadLeaders(); }, [loadLeaders]);

  // ── Submit score ──────────────────────────────────────────────────────────
  const submitScore = useCallback(async (score: number) => {
    if (!user || !profile || score <= 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "racerScores"), {
        userId: user.uid, username: profile.username,
        profilePhoto: profile.profilePhoto ?? null,
        score, createdAt: serverTimestamp(),
      });
      if (score > personalBest) { setPersonalBest(score); setNewBest(true); }
    } catch {}
    setSubmitting(false);
    loadLeaders();
  }, [user, profile, personalBest, loadLeaders]);

  // ── Shake ─────────────────────────────────────────────────────────────────
  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 14,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 35, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Tick ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    tickFnRef.current = () => {
      const g    = gs.current;
      const rH   = roadHRef.current;
      g.tick++;

      if (g.tick % TICKS_PER_LVL === 0) g.level = Math.min(g.level + 1, 10);
      const speed = (BASE_SPEED + (g.level - 1) * SPD_INC) * (g.nitroActive ? NITRO_MULT : 1);

      // Road scroll
      g.roadOff = (g.roadOff + speed) % (DASH_CYCLE * 200);

      // Nitro
      if (g.nitroActive) {
        g.nitro = Math.max(0, g.nitro - NITRO_DRAIN);
        if (g.nitro === 0) g.nitroActive = false;
      } else {
        g.nitro = Math.min(NITRO_MAX, g.nitro + NITRO_FILL);
      }

      // Shield countdown
      if (g.shielded) { g.shieldTicks--; if (g.shieldTicks <= 0) g.shielded = false; }

      // Move cars
      g.cars  = g.cars.map(c => ({ ...c, y: c.y + speed * c.type.spd })).filter(c => c.y < rH + EH + 20);
      g.items = g.items.map(it => ({ ...it, y: it.y + speed * 0.7 })).filter(it => it.y < rH + IH + 20);

      // Score (distance + level bonus)
      g.score += g.level + (g.nitroActive ? g.level : 0);

      // Spawn
      g.spawnIn--;
      if (g.spawnIn <= 0) {
        const gap = Math.max(MIN_SPAWN, BASE_SPAWN - g.level * 3);
        g.spawnIn = gap + Math.floor(Math.random() * 14);
        const lane = Math.floor(Math.random() * LANES);
        const id   = `${g.nextId++}`;
        if (Math.random() < 0.22) {
          const type = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
          g.items.push({ id, lane, y: -IH, type });
        } else {
          const pool = ENEMIES.slice(0, Math.min(2 + g.level, ENEMIES.length));
          const type = pool[Math.floor(Math.random() * pool.length)];
          g.cars.push({ id, lane, y: -EH, type });
        }
      }

      // Player hitbox
      const playerTop    = rH - PLAYER_BOTTOM - PH;
      const playerBottom = rH - PLAYER_BOTTOM;
      const playerLeft   = pLeft(g.lane);
      const playerRight  = playerLeft + PW;

      // Car collisions
      for (let i = 0; i < g.cars.length; i++) {
        const c = g.cars[i];
        const cL = eLeft(c.lane), cR = cL + EW, cT = c.y, cB = c.y + EH;
        if (playerLeft + HIT_PAD < cR && playerRight - HIT_PAD > cL && playerTop + HIT_PAD < cB && playerBottom - HIT_PAD > cT) {
          g.cars.splice(i, 1);
          if (g.shielded) {
            g.shielded = false; g.shieldTicks = 0;
          } else {
            g.lives--;
            shake();
            if (g.lives <= 0) {
              if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
              const sc = g.score;
              setFinalScore(sc); setScreen("gameover"); submitScore(sc);
              return;
            }
          }
          break;
        }
      }

      // Item collection
      for (let i = 0; i < g.items.length; i++) {
        const it = g.items[i];
        const iL = iLeft(it.lane), iR = iL + IW, iT = it.y, iB = it.y + IH;
        if (playerLeft < iR && playerRight > iL && playerTop < iB && playerBottom > iT) {
          g.items.splice(i, 1);
          const fx = iL + IW / 2, fy = playerTop;
          switch (it.type.effect) {
            case "shield":  g.shielded = true; g.shieldTicks = 200;
              g.flashes.push({ id: `f${g.nextId++}`, text: "🛡️ SHIELD!", color: "#60A5FA", x: fx, y: fy, op: 1 }); break;
            case "nitro":   g.nitro = Math.min(NITRO_MAX, g.nitro + 45);
              g.flashes.push({ id: `f${g.nextId++}`, text: "⚡ NITRO!", color: "#FCD34D", x: fx, y: fy, op: 1 }); break;
            case "bonus":   g.score += 200;
              g.flashes.push({ id: `f${g.nextId++}`, text: "+200", color: "#34D399", x: fx, y: fy, op: 1 }); break;
            case "badge":   g.score += 100;
              g.flashes.push({ id: `f${g.nextId++}`, text: "+100 🚨", color: "#FF3B3B", x: fx, y: fy, op: 1 }); break;
          }
          break;
        }
      }

      // Fade flashes
      g.flashes = g.flashes.map(f => ({ ...f, y: f.y - 2, op: f.op - 0.035 })).filter(f => f.op > 0);

      setRenderTick(t => t + 1);
    };
  });

  // ── Loop ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "playing") return;
    loopRef.current = setInterval(() => tickFnRef.current(), TICK_MS);
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, [screen]);

  const startGame = () => {
    gs.current = mkGS();
    setNewBest(false);
    setRenderTick(0);
    setScreen("playing");
  };

  const g     = gs.current;
  const rH    = roadH;
  const pTop  = rH - PLAYER_BOTTOM - PH;
  const speed = (BASE_SPEED + (g.level - 1) * SPD_INC).toFixed(1);

  // ══════════════════════════════════════════════════════════════════════════
  // MENU
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === "menu") {
    return (
      <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={S.nav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[S.navTitle, { color: colors.text }]}>Scam Racer</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Hero */}
        <View style={[S.hero, { backgroundColor: "#FF3B3B0C", borderColor: "#FF3B3B28" }]}>
          <View style={S.heroCarRow}>
            <View style={{ transform: [{ scale: 0.85 }] }}><EnemyCar type={ENEMIES[0]} /></View>
            <View style={{ transform: [{ scale: 1.05 }] }}><PlayerCar shielded={false} nitroActive={true} /></View>
            <View style={{ transform: [{ scale: 0.85 }] }}><EnemyCar type={ENEMIES[2]} /></View>
          </View>
          <Text style={[S.heroTitle, { color: colors.text }]}>Beat the Scammers!</Text>
          <Text style={[S.heroSub, { color: colors.textMuted }]}>
            Race through 4 lanes and dodge scam vehicles. Grab shields, fire nitro boosts and rack up the highest score!
          </Text>

          <View style={S.chipsRow}>
            {ENEMIES.slice(0, 5).map(e => (
              <View key={e.id} style={[S.chip, { backgroundColor: e.color + "18", borderColor: e.color + "45" }]}>
                <Text style={{ fontSize: 11 }}>{e.symbol}</Text>
                <Text style={[S.chipLabel, { color: e.color }]}>{e.label}</Text>
              </View>
            ))}
          </View>

          {personalBest > 0 && (
            <View style={[S.pbRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 18 }}>🏆</Text>
              <Text style={[S.pbLabel, { color: colors.textMuted }]}>Your Best</Text>
              <Text style={[S.pbScore, { color: "#FF3B3B" }]}>{personalBest.toLocaleString()}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={[S.playBtn, { backgroundColor: "#FF3B3B" }]} onPress={startGame} activeOpacity={0.85}>
          <Text style={{ fontSize: 20 }}>🏎️</Text>
          <Text style={S.playBtnLabel}>Race Now</Text>
        </TouchableOpacity>

        {/* Leaderboard tabs */}
        <View style={[S.ldrTabs, { borderBottomColor: colors.border }]}>
          {(["friends", "global"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[S.ldrTab, ldrTab === tab && { borderBottomColor: "#FF3B3B", borderBottomWidth: 2 }]}
              onPress={() => setLdrTab(tab)}
            >
              <Text style={[S.ldrTabTxt, { color: ldrTab === tab ? "#FF3B3B" : colors.textMuted }]}>
                {tab === "friends" ? "👥 Friends" : "🌍 Global"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {ldrLoading
            ? <ActivityIndicator color="#FF3B3B" style={{ marginTop: 32 }} />
            : leaders.length === 0
              ? <View style={S.empty}><Text style={{ fontSize: 34 }}>🏎️</Text><Text style={[S.emptyTxt, { color: colors.textMuted }]}>No scores yet — be the first to race!</Text></View>
              : leaders.map((e, i) => (
                <View key={e.userId + i} style={[S.ldrRow, {
                  backgroundColor: e.userId === user?.uid ? "#FF3B3B12" : colors.card,
                  borderColor: e.userId === user?.uid ? "#FF3B3B50" : colors.border,
                }]}>
                  <Text style={S.ldrMedal}>{i < 3 ? MEDALS[i] : `#${i + 1}`}</Text>
                  <UserAvatar uri={e.profilePhoto} name={e.username} size={36} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[S.ldrName, { color: colors.text }]} numberOfLines={1}>{e.username}</Text>
                    {e.userId === user?.uid && <Text style={{ fontSize: 11, color: "#FF3B3B" }}>You</Text>}
                  </View>
                  <Text style={[S.ldrScore, { color: "#FF3B3B" }]}>{e.score.toLocaleString()}</Text>
                </View>
              ))
          }
        </ScrollView>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GAME OVER
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === "gameover") {
    const myRank = leaders.findIndex(l => l.userId === user?.uid);
    return (
      <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top, justifyContent: "center" }]}>
        <View style={S.goWrap}>
          <Text style={S.goEmoji}>{newBest ? "🏆" : finalScore > 800 ? "😤" : "💀"}</Text>
          <Text style={[S.goTitle, { color: colors.text }]}>{newBest ? "New Record!" : "Wiped Out!"}</Text>
          <Text style={[S.goSub, { color: colors.textMuted }]}>
            {newBest ? "You set a blazing new best!" : "The scam fleet got you this time."}
          </Text>

          <View style={[S.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={S.scoreRow}>
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: "#FF3B3B" }]}>{finalScore.toLocaleString()}</Text>
                <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Score</Text>
              </View>
              <View style={[S.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: "#F59E0B" }]}>{Math.max(finalScore, personalBest).toLocaleString()}</Text>
                <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Best</Text>
              </View>
              <View style={[S.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: "#10B981" }]}>LV {g.level}</Text>
                <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Level</Text>
              </View>
            </View>
            {myRank >= 0 && (
              <View style={[S.rankBanner, { backgroundColor: "#FF3B3B15" }]}>
                <Text style={{ fontSize: 13, color: "#FF3B3B", fontFamily: "Inter_600SemiBold" }}>
                  {myRank < 3 ? MEDALS[myRank] : `#${myRank + 1}`} on leaderboard
                </Text>
              </View>
            )}
          </View>

          {submitting && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <ActivityIndicator size="small" color="#FF3B3B" />
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Saving score…</Text>
            </View>
          )}

          <TouchableOpacity style={[S.playBtn, { backgroundColor: "#FF3B3B", marginTop: 24 }]} onPress={startGame}>
            <Text style={{ fontSize: 20 }}>🔄</Text>
            <Text style={S.playBtnLabel}>Race Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.outlineBtn, { borderColor: colors.border }]} onPress={() => { setScreen("menu"); loadLeaders(); }}>
            <Text style={[S.outlineTxt, { color: colors.text }]}>🏠  Back to Garage</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PLAYING
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={[S.screen, { backgroundColor: "#0D1117", paddingTop: insets.top }]}>
      {/* HUD */}
      <View style={[S.hud, { height: HUD_H }]}>
        <TouchableOpacity
          onPress={() => { if (loopRef.current) clearInterval(loopRef.current); setScreen("menu"); }}
          style={S.hudBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="x" size={18} color="#fff" />
        </TouchableOpacity>

        <View style={S.hudCenter}>
          <Text style={S.hudScore}>{g.score.toLocaleString()}</Text>
          <Text style={S.hudScoreLbl}>SCORE</Text>
        </View>

        <View style={S.hudRight}>
          <View style={[S.lvlBadge, { backgroundColor: "#FF3B3B" }]}>
            <Text style={S.lvlTxt}>LV {g.level}</Text>
          </View>
          <Text style={[S.speedTxt, { color: "#94A3B8" }]}>⚡ {speed}x</Text>
          <View style={S.heartsRow}>
            {[0, 1, 2].map(i => (
              <Text key={i} style={{ fontSize: 13, opacity: i < g.lives ? 1 : 0.2 }}>❤️</Text>
            ))}
          </View>
        </View>
      </View>

      {/* Road area */}
      <Animated.View
        style={{ flex: 1, overflow: "hidden", transform: [{ translateX: shakeAnim }] }}
        onLayout={e => setRoadH(e.nativeEvent.layout.height)}
      >
        <Road roadOff={g.roadOff} roadH={rH} />

        {/* Enemy cars */}
        {g.cars.map(c => (
          <View key={c.id} style={{ position: "absolute", left: eLeft(c.lane) - 6, top: c.y - 6 }}>
            <EnemyCar type={c.type} />
          </View>
        ))}

        {/* Power-up items */}
        {g.items.map(it => (
          <View key={it.id} style={{ position: "absolute", left: iLeft(it.lane), top: it.y }}>
            <PowerupItem type={it.type} />
          </View>
        ))}

        {/* Player */}
        <View style={{ position: "absolute", left: pLeft(g.lane) - 7, top: pTop - 11 }}>
          <PlayerCar shielded={g.shielded} nitroActive={g.nitroActive} />
        </View>

        {/* Score flashes */}
        {g.flashes.map(f => (
          <Text key={f.id} style={[S.flashTxt, { left: f.x - 30, top: f.y, color: f.color, opacity: f.op }]}>
            {f.text}
          </Text>
        ))}

        {/* Nitro bar */}
        <View style={[S.nitroBar, { bottom: 8 }]}>
          <Text style={S.nitroLabel}>NITRO</Text>
          <View style={S.nitroTrack}>
            <View style={[S.nitroFill, {
              width: `${g.nitro}%` as any,
              backgroundColor: g.nitro > 50 ? "#FBBF24" : g.nitro > 20 ? "#F97316" : "#EF4444",
            }]} />
          </View>
        </View>

        {/* Shield indicator */}
        {g.shielded && (
          <View style={S.shieldIndicator}>
            <Text style={{ fontSize: 12 }}>🛡️</Text>
            <Text style={S.shieldTxt}>{Math.ceil(g.shieldTicks / 33)}s</Text>
          </View>
        )}
      </Animated.View>

      {/* Controls */}
      <View style={[S.controls, { height: CTRL_H, paddingBottom: insets.bottom + 6 }]}>
        {/* Left */}
        <TouchableOpacity
          style={S.ctrlBtn}
          onPress={() => { const g = gs.current; g.lane = Math.max(0, g.lane - 1); }}
          activeOpacity={0.7}
        >
          <Feather name="chevron-left" size={36} color="#fff" />
          <Text style={S.ctrlLabel}>LEFT</Text>
        </TouchableOpacity>

        {/* Nitro */}
        <TouchableOpacity
          style={[S.nitroBtn, { opacity: g.nitro > 10 ? 1 : 0.4 }]}
          onPressIn={() => { if (gs.current.nitro > 10) gs.current.nitroActive = true; }}
          onPressOut={() => { gs.current.nitroActive = false; }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 22 }}>⚡</Text>
          <Text style={S.nitroBtnTxt}>NITRO</Text>
          <Text style={S.nitroBtnHold}>HOLD</Text>
        </TouchableOpacity>

        {/* Right */}
        <TouchableOpacity
          style={S.ctrlBtn}
          onPress={() => { const g = gs.current; g.lane = Math.min(LANES - 1, g.lane + 1); }}
          activeOpacity={0.7}
        >
          <Feather name="chevron-right" size={36} color="#fff" />
          <Text style={S.ctrlLabel}>RIGHT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  screen:     { flex: 1 },
  nav:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:   { fontFamily: "Inter_700Bold", fontSize: 20 },

  hero:         { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  heroCarRow:   { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16, paddingVertical: 4 },
  heroTitle:    { fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center" },
  heroSub:      { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, textAlign: "center" },
  chipsRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  chip:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  chipLabel:    { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  pbRow:        { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  pbLabel:      { fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 },
  pbScore:      { fontFamily: "Inter_700Bold", fontSize: 18 },

  playBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 16, marginVertical: 10, borderRadius: 16, paddingVertical: 14 },
  playBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },

  ldrTabs:    { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16, marginTop: 4 },
  ldrTab:     { flex: 1, alignItems: "center", paddingVertical: 10 },
  ldrTabTxt:  { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  ldrRow:     { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 14, borderWidth: 1 },
  ldrMedal:   { fontSize: 18, width: 32, textAlign: "center" },
  ldrName:    { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  ldrScore:   { fontFamily: "Inter_700Bold", fontSize: 16 },
  empty:      { alignItems: "center", gap: 10, marginTop: 40 },
  emptyTxt:   { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },

  goWrap:       { paddingHorizontal: 24, alignItems: "center", gap: 8 },
  goEmoji:      { fontSize: 56 },
  goTitle:      { fontFamily: "Inter_700Bold", fontSize: 26 },
  goSub:        { fontFamily: "Inter_400Regular", fontSize: 14 },
  scoreCard:    { width: "100%", borderRadius: 20, borderWidth: 1, marginTop: 8, overflow: "hidden" },
  scoreRow:     { flexDirection: "row", alignItems: "center" },
  scoreItem:    { flex: 1, alignItems: "center", paddingVertical: 18 },
  scoreVal:     { fontFamily: "Inter_700Bold", fontSize: 22 },
  scoreLabel:   { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  scoreDivider: { width: 1, height: 40 },
  rankBanner:   { paddingVertical: 10, alignItems: "center" },
  outlineBtn:   { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28, marginTop: 10 },
  outlineTxt:   { fontFamily: "Inter_600SemiBold", fontSize: 14 },

  hud:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 },
  hudBack:      { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  hudCenter:    { alignItems: "center" },
  hudScore:     { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  hudScoreLbl:  { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#64748B", letterSpacing: 1.5 },
  hudRight:     { alignItems: "flex-end", gap: 3 },
  lvlBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  lvlTxt:       { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff" },
  speedTxt:     { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  heartsRow:    { flexDirection: "row", gap: 2 },

  nitroBar:     { position: "absolute", left: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  nitroLabel:   { fontFamily: "Inter_700Bold", fontSize: 9, color: "#94A3B8", letterSpacing: 1, width: 38 },
  nitroTrack:   { flex: 1, height: 5, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" },
  nitroFill:    { height: "100%", borderRadius: 3 },

  shieldIndicator: { position: "absolute", top: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(59,130,246,0.25)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#60A5FA" },
  shieldTxt:    { fontFamily: "Inter_700Bold", fontSize: 11, color: "#93C5FD" },

  flashTxt:     { position: "absolute", fontFamily: "Inter_700Bold", fontSize: 14, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  controls:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, backgroundColor: "#0D1117" },
  ctrlBtn:      { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 2 },
  ctrlLabel:    { fontFamily: "Inter_700Bold", fontSize: 9, color: "#475569", letterSpacing: 1 },
  nitroBtn:     { width: 76, height: 76, borderRadius: 38, backgroundColor: "#FBBF2420", borderWidth: 2.5, borderColor: "#FBBF24", alignItems: "center", justifyContent: "center", gap: 1 },
  nitroBtnTxt:  { fontFamily: "Inter_700Bold", fontSize: 11, color: "#FCD34D" },
  nitroBtnHold: { fontFamily: "Inter_400Regular", fontSize: 8, color: "#92400E" },
});
