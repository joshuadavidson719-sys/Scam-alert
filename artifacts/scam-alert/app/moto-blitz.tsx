import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, query, where, orderBy,
  limit, getDocs, serverTimestamp,
} from "firebase/firestore";
import { playSound, startMusic, stopMusic } from "@/lib/soundEngine";

import { Feather } from "@expo/vector-icons";
const { width: SW, height: SH } = Dimensions.get("window");

const LANES      = 3;
const LANE_W     = SW / LANES;
const TICK_MS    = 30;
const HUD_H      = 72;
const CTRL_H     = 110;
const ROAD_H     = SH - HUD_H - CTRL_H - 60;
const BASE_SPD   = 5;
const SPD_INC    = 0.5;
const LVL_TICKS  = 400;
const PLAYER_BOT = 30;
const BIKE_W     = 42; const BIKE_H = 70;
const OBS_W      = 40; const OBS_H  = 68;
const COIN_SIZE  = 28;
const HIT_PAD    = 10;

const VEHICLES = [
  { emoji: "🚗", color: "#EF4444", pts: 0 },
  { emoji: "🚕", color: "#F97316", pts: 0 },
  { emoji: "🚙", color: "#3B82F6", pts: 0 },
  { emoji: "🚌", color: "#8B5CF6", pts: 0 },
  { emoji: "🚛", color: "#6B7280", pts: 0 },
  { emoji: "🚓", color: "#1D4ED8", pts: 0 },
];

type Screen = "menu" | "playing" | "gameover";
type Vehicle = { id: string; lane: number; y: number; emoji: string; color: string; spd: number };
type Coin    = { id: string; lane: number; y: number };
type Flash   = { id: string; text: string; x: number; y: number; op: number };
type Leader  = { username: string; score: number };

type GS = {
  lane: number; lives: number; score: number; tick: number;
  level: number; nextId: number; shielded: boolean; shieldTicks: number;
  vehicles: Vehicle[]; coins: Coin[]; flashes: Flash[];
  spawnCooldown: number;
};

function initGS(): GS {
  return { lane: 1, lives: 3, score: 0, tick: 0, level: 1, nextId: 0,
    shielded: false, shieldTicks: 0, vehicles: [], coins: [], flashes: [],
    spawnCooldown: 30 };
}

function laneX(lane: number) { return lane * LANE_W + LANE_W / 2; }

export default function MotoBlitz() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [screen, setScreen] = useState<Screen>("menu");
  const [display, setDisplay] = useState({ score: 0, lives: 3, level: 1, shielded: false });
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const gs = useRef<GS>(initGS());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerX = useRef(new Animated.Value(laneX(1))).current;
  // Road scroll
  const roadY1 = useRef(new Animated.Value(0)).current;
  const roadY2 = useRef(new Animated.Value(-ROAD_H)).current;

  const fetchLeaders = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "motoScores"), orderBy("score", "desc"), limit(5)));
      setLeaders(snap.docs.map(d => d.data() as Leader));
    } catch {}
  }, []);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);

  // Animate road scroll
  const roadLoop = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (screen !== "playing") { roadLoop.current?.stop(); return; }
    const dur = 800;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(roadY1, { toValue: ROAD_H, duration: dur, useNativeDriver: true }),
          Animated.timing(roadY1, { toValue: -ROAD_H, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(roadY2, { toValue: ROAD_H, duration: dur, useNativeDriver: true }),
          Animated.timing(roadY2, { toValue: -ROAD_H, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    roadLoop.current = loop;
    loop.start();
    return () => loop.stop();
  }, [screen]);

  const endGame = useCallback(async (finalScore: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopMusic(); playSound("defeat");
    setScreen("gameover");
    if (!user || finalScore === 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "motoScores"), {
        userId: user.uid, username: profile?.username ?? "Rider",
        score: finalScore, createdAt: serverTimestamp(),
      });
      await fetchLeaders();
    } catch {}
    setSubmitting(false);
  }, [user, profile, fetchLeaders]);

  const tick = useCallback(() => {
    const s = gs.current;
    s.tick++;
    const spd = BASE_SPD + (s.level - 1) * SPD_INC;
    if (s.tick % LVL_TICKS === 0) { s.level++; playSound("levelUp"); }

    // Move vehicles down
    s.vehicles = s.vehicles
      .map(v => ({ ...v, y: v.y + spd * v.spd }))
      .filter(v => v.y < ROAD_H + OBS_H);

    // Move coins down
    s.coins = s.coins
      .map(c => ({ ...c, y: c.y + spd * 0.8 }))
      .filter(c => c.y < ROAD_H + COIN_SIZE);

    // Animate flashes
    s.flashes = s.flashes.map(f => ({ ...f, y: f.y - 2, op: f.op - 0.05 })).filter(f => f.op > 0);

    // Spawn vehicles
    s.spawnCooldown--;
    const minSpawn = Math.max(12, 40 - s.level * 2);
    if (s.spawnCooldown <= 0) {
      const lane = Math.floor(Math.random() * LANES);
      const veh = VEHICLES[Math.floor(Math.random() * VEHICLES.length)];
      s.vehicles.push({ id: `v${s.nextId++}`, lane, y: -OBS_H, emoji: veh.emoji, color: veh.color, spd: 0.9 + Math.random() * 0.4 });
      s.spawnCooldown = minSpawn + Math.floor(Math.random() * 20);
    }

    // Spawn coins occasionally
    if (s.tick % 80 === 0) {
      const lane = Math.floor(Math.random() * LANES);
      s.coins.push({ id: `c${s.nextId++}`, lane, y: -COIN_SIZE });
    }

    // Shield tick
    if (s.shielded) { s.shieldTicks--; if (s.shieldTicks <= 0) s.shielded = false; }

    // Collision — vehicles
    const px = laneX(s.lane);
    const py = ROAD_H - PLAYER_BOT - BIKE_H;
    let died = false;
    s.vehicles = s.vehicles.filter(v => {
      const vx = laneX(v.lane);
      const vy = v.y;
      const hit = Math.abs(px - vx) < (BIKE_W / 2 + OBS_W / 2 - HIT_PAD) &&
                  Math.abs(py - vy) < (BIKE_H / 2 + OBS_H / 2 - HIT_PAD);
      if (hit) {
        if (s.shielded) {
          s.shielded = false; s.shieldTicks = 0;
          s.flashes.push({ id: `f${s.nextId++}`, text: "SHIELD!", x: px, y: py - 20, op: 1 });
        } else {
          s.lives--;
          playSound("crash");
          s.flashes.push({ id: `f${s.nextId++}`, text: "💥 CRASH!", x: px, y: py - 20, op: 1 });
          died = true;
        }
      }
      return !hit;
    });

    // Collision — coins
    s.coins = s.coins.filter(c => {
      const cx = laneX(c.lane);
      const cy = c.y;
      const hit = Math.abs(px - cx) < (BIKE_W / 2 + COIN_SIZE / 2) &&
                  Math.abs(py - cy) < (BIKE_H / 2 + COIN_SIZE / 2);
      if (hit) {
        s.score += 50;
        playSound("coin");
        s.flashes.push({ id: `f${s.nextId++}`, text: "+50 🪙", x: cx, y: cy - 10, op: 1 });
      }
      return !hit;
    });

    s.score += 1;
    setDisplay({ score: s.score, lives: s.lives, level: s.level, shielded: s.shielded });
    if (s.lives <= 0) { endGame(s.score); }
  }, [endGame]);

  const startGame = useCallback(() => {
    gs.current = initGS();
    Animated.timing(playerX, { toValue: laneX(1), duration: 0, useNativeDriver: true }).start();
    setDisplay({ score: 0, lives: 3, level: 1, shielded: false });
    setScreen("playing");
    startMusic("racing");
    timerRef.current = setInterval(tick, TICK_MS);
  }, [tick, playerX]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const moveLeft = () => {
    const s = gs.current;
    if (s.lane > 0) {
      s.lane--;
      Animated.timing(playerX, { toValue: laneX(s.lane), duration: 140, useNativeDriver: true }).start();
    }
  };
  const moveRight = () => {
    const s = gs.current;
    if (s.lane < LANES - 1) {
      s.lane++;
      Animated.timing(playerX, { toValue: laneX(s.lane), duration: 140, useNativeDriver: true }).start();
    }
  };

  // ── Menu ──────────────────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <View style={[G.screen, { backgroundColor: "#0D0D1A", paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={G.back}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={G.menuCenter}>
          <Text style={{ fontSize: 72 }}>🏍️</Text>
          <Text style={G.menuTitle}>Moto Blitz</Text>
          <Text style={G.menuSub}>Dodge traffic · Collect coins · Survive!</Text>
          <View style={G.statsRow}>
            <View style={G.statBox}><Text style={G.statVal}>3</Text><Text style={G.statLbl}>Lives</Text></View>
            <View style={G.statBox}><Text style={[G.statVal, { color: "#FBBF24" }]}>🪙</Text><Text style={G.statLbl}>Collect coins</Text></View>
            <View style={G.statBox}><Text style={G.statVal}>∞</Text><Text style={G.statLbl}>Endless</Text></View>
          </View>
          <TouchableOpacity style={G.startBtn} onPress={startGame}>
            <Text style={G.startBtnTxt}>START RACE</Text>
          </TouchableOpacity>
        </View>
        {leaders.length > 0 && (
          <View style={G.leaderBox}>
            <Text style={G.leaderTitle}>🏆 Top Riders</Text>
            {leaders.map((l, i) => (
              <View key={i} style={G.leaderRow}>
                <Text style={G.leaderRank}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={G.leaderName}>{l.username}</Text>
                <Text style={[G.leaderScore, { color: "#FBBF24" }]}>{l.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── Game Over ─────────────────────────────────────────────────────────────
  if (screen === "gameover") {
    return (
      <View style={[G.screen, { backgroundColor: "#0D0D1A", paddingTop: insets.top, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ fontSize: 64 }}>💥</Text>
        <Text style={G.menuTitle}>Game Over!</Text>
        <Text style={[G.menuSub, { marginBottom: 24 }]}>Final Score</Text>
        <Text style={G.bigScore}>{display.score.toLocaleString()}</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 32 }}>
          <TouchableOpacity style={G.startBtn} onPress={startGame}>
            <Text style={G.startBtnTxt}>RETRY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[G.startBtn, { backgroundColor: "#333" }]} onPress={() => setScreen("menu")}>
            <Text style={G.startBtnTxt}>MENU</Text>
          </TouchableOpacity>
        </View>
        {submitting && <Text style={{ color: "#888", marginTop: 16 }}>Saving score…</Text>}
      </View>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  const s = gs.current;
  return (
    <View style={[G.screen, { backgroundColor: "#0D0D1A" }]}>
      {/* HUD */}
      <View style={[G.hud, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => endGame(s.score)}><Text style={{ color: "#888", fontSize: 13 }}>✕ Quit</Text></TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={G.hudScore}>{display.score.toLocaleString()}</Text>
          <Text style={G.hudLvl}>LVL {display.level}</Text>
        </View>
        <Text style={G.hudLives}>{"❤️".repeat(display.lives)}</Text>
      </View>

      {/* Road */}
      <View style={[G.road, { height: ROAD_H }]}>
        {/* Lane dividers scroll */}
        <Animated.View style={[G.laneScroll, { transform: [{ translateY: roadY1 }] }]}>
          {[1, 2].map(l => (
            <View key={l} style={[G.laneDash, { left: l * LANE_W - 2 }]} />
          ))}
        </Animated.View>
        <Animated.View style={[G.laneScroll, { transform: [{ translateY: roadY2 }] }]}>
          {[1, 2].map(l => (
            <View key={l} style={[G.laneDash, { left: l * LANE_W - 2 }]} />
          ))}
        </Animated.View>

        {/* Vehicles */}
        {s.vehicles.map(v => (
          <View key={v.id} style={[G.obstacle, { left: laneX(v.lane) - OBS_W / 2, top: v.y }]}>
            <Text style={{ fontSize: 34 }}>{v.emoji}</Text>
          </View>
        ))}

        {/* Coins */}
        {s.coins.map(c => (
          <View key={c.id} style={[G.coin, { left: laneX(c.lane) - COIN_SIZE / 2, top: c.y }]}>
            <Text style={{ fontSize: 20 }}>🪙</Text>
          </View>
        ))}

        {/* Player bike */}
        <Animated.View style={[
          G.player,
          { bottom: PLAYER_BOT, transform: [{ translateX: Animated.subtract(playerX, new Animated.Value(BIKE_W / 2)) }] },
          display.shielded && G.shieldGlow,
        ]}>
          <Text style={{ fontSize: 36 }}>🏍️</Text>
          {display.shielded && <Text style={G.shieldRing}>🔵</Text>}
        </Animated.View>

        {/* Flash texts */}
        {s.flashes.map(f => (
          <Animated.Text key={f.id} style={[G.flash, { left: f.x - 40, top: f.y, opacity: f.op }]}>{f.text}</Animated.Text>
        ))}
      </View>

      {/* Controls */}
      <View style={G.controls}>
        <TouchableOpacity style={G.ctrlBtn} onPress={moveLeft} activeOpacity={0.6}>
          <Text style={G.ctrlTxt}>◀ LEFT</Text>
        </TouchableOpacity>
        <View style={G.ctrlCenter}>
          <Text style={{ fontSize: 28 }}>🏍️</Text>
          <Text style={{ color: "#666", fontSize: 11 }}>TILT</Text>
        </View>
        <TouchableOpacity style={G.ctrlBtn} onPress={moveRight} activeOpacity={0.6}>
          <Text style={G.ctrlTxt}>RIGHT ▶</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const G = StyleSheet.create({
  screen:       { flex: 1 },
  back:         { position: "absolute", top: 50, left: 16, zIndex: 10 },
  backIcon:     { width: 26, height: 26, borderRadius: 7 },
  menuCenter:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  menuTitle:    { fontFamily: "Inter_700Bold", fontSize: 34, color: "#fff", letterSpacing: -0.5 },
  menuSub:      { fontFamily: "Inter_400Regular", fontSize: 15, color: "#888", textAlign: "center" },
  statsRow:     { flexDirection: "row", gap: 20, marginVertical: 12 },
  statBox:      { alignItems: "center", gap: 2 },
  statVal:      { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  statLbl:      { fontFamily: "Inter_400Regular", fontSize: 10, color: "#666" },
  startBtn:     { backgroundColor: "#F97316", paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16 },
  startBtnTxt:  { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", letterSpacing: 1 },
  bigScore:     { fontFamily: "Inter_700Bold", fontSize: 56, color: "#FBBF24" },
  leaderBox:    { padding: 20, gap: 8 },
  leaderTitle:  { fontFamily: "Inter_700Bold", fontSize: 14, color: "#888" },
  leaderRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  leaderRank:   { fontSize: 16, width: 28 },
  leaderName:   { fontFamily: "Inter_500Medium", fontSize: 14, color: "#ccc", flex: 1 },
  leaderScore:  { fontFamily: "Inter_700Bold", fontSize: 15 },

  hud:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, height: HUD_H, backgroundColor: "#0D0D1A" },
  hudScore:     { fontFamily: "Inter_700Bold", fontSize: 26, color: "#FBBF24" },
  hudLvl:       { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#666", letterSpacing: 1 },
  hudLives:     { fontSize: 18 },

  road:         { backgroundColor: "#1A1A2E", overflow: "hidden", position: "relative" },
  laneScroll:   { position: "absolute", top: 0, left: 0, right: 0, height: ROAD_H * 2 },
  laneDash:     { position: "absolute", top: 0, bottom: 0, width: 3, backgroundColor: "#FFFFFF20" },
  obstacle:     { position: "absolute", width: OBS_W, height: OBS_H, alignItems: "center", justifyContent: "center" },
  coin:         { position: "absolute", width: COIN_SIZE, height: COIN_SIZE, alignItems: "center", justifyContent: "center" },
  player:       { position: "absolute", width: BIKE_W, height: BIKE_H, alignItems: "center", justifyContent: "center" },
  shieldGlow:   { shadowColor: "#3B82F6", shadowRadius: 18, shadowOpacity: 1, elevation: 10 },
  shieldRing:   { position: "absolute", fontSize: 44, opacity: 0.6 },
  flash:        { position: "absolute", fontFamily: "Inter_700Bold", fontSize: 14, color: "#FBBF24", width: 80, textAlign: "center" },

  controls:     { flexDirection: "row", alignItems: "center", backgroundColor: "#111", height: CTRL_H, borderTopWidth: 1, borderTopColor: "#222" },
  ctrlBtn:      { flex: 1, height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#1A1A2E" },
  ctrlTxt:      { fontFamily: "Inter_700Bold", fontSize: 18, color: "#F97316" },
  ctrlCenter:   { width: 60, alignItems: "center" },
});
