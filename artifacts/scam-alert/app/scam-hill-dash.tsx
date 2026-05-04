import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit } from "firebase/firestore";

const APP_ICON = require("@/assets/images/icon.png");

const { width: SW, height: SH } = Dimensions.get("window");

const SEG_W   = 18;                           // px per terrain column
const SEGS    = Math.ceil(SW / SEG_W) + 3;   // visible terrain columns
const TOTAL   = 600;                          // total terrain length
const CAR_X   = Math.floor(SEGS * 0.25);     // car fixed at 25% from left
const GND_BTM = 0.62;                         // ground base y (fraction of road area height)
const AMP1    = 0.11; const AMP2 = 0.07;
const ROAD_H  = SH * 0.5;
const HUD_H   = 56;
const CTRL_H  = 110;

function terrainY(i: number): number {
  return Math.round(ROAD_H * (GND_BTM + AMP1 * Math.sin(i * 0.09) + AMP2 * Math.sin(i * 0.22) + 0.04 * Math.sin(i * 0.41)));
}

const TERRAIN: number[] = Array.from({ length: TOTAL }, (_, i) => terrainY(i));

type Pickup = { seg: number; type: "fuel" | "shield" | "coin"; collected: boolean };
type Hazard = { seg: number; type: "bomb" | "virus"; hit: boolean };
type Screen = "menu" | "playing" | "gameover";

const SCAM_EMOJIS: Record<string, string> = { bomb: "💣", virus: "🦠" };
const PICKUP_EMOJIS: Record<string, string> = { fuel: "⛽", shield: "🛡️", coin: "💰" };

function generatePickups(): Pickup[] {
  const p: Pickup[] = [];
  for (let i = 30; i < TOTAL - 20; i += 15 + Math.floor(Math.random() * 12)) {
    const types: Pickup["type"][] = ["fuel","fuel","coin","coin","shield"];
    p.push({ seg: i, type: types[Math.floor(Math.random() * types.length)], collected: false });
  }
  return p;
}

function generateHazards(): Hazard[] {
  const h: Hazard[] = [];
  for (let i = 40; i < TOTAL - 20; i += 20 + Math.floor(Math.random() * 15)) {
    h.push({ seg: i, type: Math.random() > 0.5 ? "bomb" : "virus", hit: false });
  }
  return h;
}

type GS = {
  camSeg: number;       // which terrain segment is at left edge of screen
  speed: number;        // segments per tick
  fuel: number;         // 0–100
  score: number;        // = distance in segments
  lives: number;
  shielded: boolean;
  shieldTicks: number;
  gasHeld: boolean;
  brakeHeld: boolean;
  pickups: Pickup[];
  hazards: Hazard[];
  carVertOff: number;   // smooth vertical offset for car bob
  tick: number;
};

const TICK_MS    = 30;
const MAX_SPEED  = 4.2;
const GAS_ACC    = 0.08;
const BRAKE_DEC  = 0.18;
const IDLE_DEC   = 0.04;
const HILL_FORCE = 0.12; // speed effect of slope
const FUEL_DRAIN = 0.04;
const FUEL_GAIN  = 22;
const SHIELD_T   = 120;

export default function ScamHillDash() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [screen, setScreen]   = useState<Screen>("menu");
  const [render, setRender]   = useState(0);
  const [best,   setBest]     = useState(0);
  const gsRef  = useRef<GS | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db,"hillScores"), where("userId","==",user.uid), orderBy("score","desc"), limit(1)))
      .then(s => { if (!s.empty) setBest(s.docs[0].data().score as number); })
      .catch(() => {});
  }, [user]);

  const startGame = () => {
    gsRef.current = {
      camSeg: 0, speed: 1.2, fuel: 80, score: 0, lives: 3,
      shielded: false, shieldTicks: 0, gasHeld: false, brakeHeld: false,
      pickups: generatePickups(), hazards: generateHazards(),
      carVertOff: 0, tick: 0,
    };
    setRender(r => r + 1);
    setScreen("playing");
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = setInterval(tick, TICK_MS);
  };

  const tick = useCallback(() => {
    const gs = gsRef.current;
    if (!gs) return;

    gs.tick++;
    const carSeg = Math.round(gs.camSeg + CAR_X);

    // Gas / brake / idle
    if (gs.gasHeld)        gs.speed = Math.min(MAX_SPEED, gs.speed + GAS_ACC);
    else if (gs.brakeHeld) gs.speed = Math.max(0.1, gs.speed - BRAKE_DEC);
    else                   gs.speed = Math.max(0.3, gs.speed - IDLE_DEC);

    // Hill slope effect
    if (carSeg + 1 < TOTAL && carSeg > 0) {
      const slope = TERRAIN[Math.min(carSeg+1, TOTAL-1)] - TERRAIN[carSeg];
      const slopeNorm = slope / (ROAD_H * 0.15);
      gs.speed = Math.max(0.1, Math.min(MAX_SPEED, gs.speed - slopeNorm * HILL_FORCE));
    }

    // Move camera
    gs.camSeg += gs.speed;
    gs.score = Math.round(gs.camSeg);

    // Car bob
    gs.carVertOff = Math.sin(gs.tick * 0.35) * 1.5;

    // Fuel drain
    gs.fuel = Math.max(0, gs.fuel - FUEL_DRAIN);

    // Shield countdown
    if (gs.shielded) {
      gs.shieldTicks--;
      if (gs.shieldTicks <= 0) gs.shielded = false;
    }

    // Pickup collection
    gs.pickups.forEach(p => {
      if (p.collected) return;
      if (Math.abs(p.seg - carSeg) < 2) {
        p.collected = true;
        if (p.type === "fuel")   gs.fuel = Math.min(100, gs.fuel + FUEL_GAIN);
        if (p.type === "coin")   gs.score += 50;
        if (p.type === "shield") { gs.shielded = true; gs.shieldTicks = SHIELD_T; }
      }
    });

    // Hazard collision
    gs.hazards.forEach(h => {
      if (h.hit) return;
      if (Math.abs(h.seg - carSeg) < 2) {
        h.hit = true;
        if (!gs.shielded) {
          gs.lives--;
          gs.speed = Math.max(0.2, gs.speed * 0.5);
        }
      }
    });

    // Game over conditions
    if (gs.fuel <= 0 || gs.lives <= 0 || gs.camSeg >= TOTAL - SEGS) {
      clearInterval(loopRef.current!);
      handleGameOver(gs.score);
      return;
    }

    setRender(r => r + 1);
  }, []);

  const handleGameOver = async (score: number) => {
    if (score > best) setBest(score);
    setScreen("gameover");
    if (user) {
      try { await addDoc(collection(db,"hillScores"), { userId: user.uid, score, createdAt: serverTimestamp() }); }
      catch {}
    }
  };

  const setGas   = (held: boolean) => { if (gsRef.current) gsRef.current.gasHeld   = held; };
  const setBrake = (held: boolean) => { if (gsRef.current) gsRef.current.brakeHeld = held; };

  if (screen === "menu") return (
    <View style={[H.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={H.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Image source={APP_ICON} style={{ width: 22, height: 22, borderRadius: 6 }} />
        </TouchableOpacity>
        <Text style={[H.navTitle, { color: colors.text }]}>Scam Hill Dash</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center", gap: 20 }}>
        <Text style={{ fontSize: 72 }}>🚗</Text>
        <Text style={[H.title, { color: colors.text }]}>Scam Hill Dash</Text>
        <Text style={[H.sub, { color: colors.textMuted }]}>
          Drive over treacherous scam-infested hills!{"\n"}Collect fuel and shields, dodge fraud bombs to stay alive.
        </Text>
        {best > 0 && (
          <View style={[H.badge, { backgroundColor: "#10B98118", borderColor: "#10B98140" }]}>
            <Text style={{ fontSize: 16 }}>🏆</Text>
            <Text style={[H.badgeTxt, { color: "#10B981" }]}>Best: {best.toLocaleString()}m</Text>
          </View>
        )}
        <TouchableOpacity style={[H.playBtn, { backgroundColor: "#10B981" }]} onPress={startGame}>
          <Text style={{ fontSize: 18, color: "#fff" }}>▶</Text>
          <Text style={H.playBtnTxt}>Drive!</Text>
        </TouchableOpacity>
        <View style={[H.howCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[H.howTitle, { color: colors.text }]}>How to Drive</Text>
          {[
            "Hold GAS to accelerate up hills",
            "Hold BRAKE to slow down steep descents",
            "⛽ Collect fuel cans to keep going",
            "🛡️ Shields protect from one scam bomb",
            "💣 Fraud bombs and 🦠 viruses cost you a life",
            "Reach the furthest distance to top the board",
          ].map((t,i) => (
            <View key={i} style={H.howRow}>
              <View style={[H.dot, { backgroundColor: "#10B981" }]} />
              <Text style={[H.howTxt, { color: colors.textMuted }]}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const gs = gsRef.current!;

  if (screen === "gameover") return (
    <View style={[H.screen, { backgroundColor: colors.background, paddingTop: insets.top, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 24 }]}>
      <Text style={{ fontSize: 64 }}>{gs.fuel <= 0 ? "⛽" : gs.lives <= 0 ? "💥" : "🏁"}</Text>
      <Text style={[H.title, { color: colors.text }]}>{gs.fuel <= 0 ? "Out of Fuel!" : gs.lives <= 0 ? "Crashed!" : "Finished!"}</Text>
      <View style={[H.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[H.scoreBig, { color: "#10B981" }]}>{gs.score.toLocaleString()}m</Text>
        <Text style={[H.scoreLabel, { color: colors.textMuted }]}>Distance</Text>
        {gs.score >= best && gs.score > 0 && <Text style={[H.newBest, { color: "#F59E0B" }]}>🎉 New Personal Best!</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TouchableOpacity style={[H.goBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: colors.text }}>🏠</Text>
          <Text style={[H.goBtnTxt, { color: colors.text }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[H.goBtn, { backgroundColor: "#10B981", borderColor: "#10B981" }]} onPress={startGame}>
          <Text style={{ fontSize: 16, color: "#fff" }}>🔄</Text>
          <Text style={[H.goBtnTxt, { color: "#fff" }]}>Drive Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Playing screen ──────────────────────────────────────────────────────
  const camSeg = gs.camSeg;
  const carSeg = Math.round(camSeg + CAR_X);
  const carTerrainY = carSeg < TOTAL ? TERRAIN[carSeg] : TERRAIN[TOTAL-1];
  const carY = ROAD_H - carTerrainY + gs.carVertOff;

  // Slope angle for car tilt
  const prevTerrainY = carSeg > 0 ? TERRAIN[carSeg - 1] : carTerrainY;
  const nextTerrainY = carSeg + 1 < TOTAL ? TERRAIN[carSeg + 1] : carTerrainY;
  const slopeAngle   = Math.atan2(nextTerrainY - prevTerrainY, SEG_W * 2) * (180 / Math.PI);

  return (
    <View style={[H.screen, { backgroundColor: "#0A0A1A" }]}>
      {/* HUD */}
      <View style={[H.hud, { paddingTop: insets.top + 4, backgroundColor: "rgba(0,0,0,0.6)" }]}>
        <View style={H.hudItem}>
          <Text style={H.hudEmoji}>📍</Text>
          <Text style={H.hudVal}>{gs.score}m</Text>
        </View>
        <View style={H.hudItem}>
          <Text style={H.hudEmoji}>❤️</Text>
          <Text style={H.hudVal}>{gs.lives}</Text>
        </View>
        {gs.shielded && <View style={H.shieldBadge}><Text style={{ fontSize: 14 }}>🛡️ Shield</Text></View>}
        <TouchableOpacity onPress={() => { clearInterval(loopRef.current!); setScreen("gameover"); }} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Text style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", fontWeight: "bold" }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Fuel bar */}
      <View style={H.fuelBarWrap}>
        <Text style={H.fuelLabel}>⛽ {Math.round(gs.fuel)}%</Text>
        <View style={[H.fuelTrack, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <View style={[H.fuelFill, { width: `${gs.fuel}%` as any, backgroundColor: gs.fuel < 25 ? "#EF4444" : gs.fuel < 50 ? "#F97316" : "#10B981" }]} />
        </View>
      </View>

      {/* Sky gradient */}
      <LinearGradient colors={["#0A0A1A","#1a1035","#1a1035"]} style={H.sky} />

      {/* Road area */}
      <View style={[H.road, { height: ROAD_H }]}>
        {/* Terrain segments */}
        {Array.from({ length: SEGS }, (_, si) => {
          const segIdx = Math.floor(camSeg) + si;
          if (segIdx < 0 || segIdx >= TOTAL) return null;
          const h = TERRAIN[segIdx];
          const xPos = si * SEG_W - ((camSeg % 1) * SEG_W);
          return (
            <View key={si} style={[H.seg, { left: xPos, width: SEG_W + 1, height: h, bottom: 0, backgroundColor: "#1B4332" }]}>
              <View style={{ width: "100%", height: 6, backgroundColor: "#2D6A4F", position: "absolute", top: 0 }} />
            </View>
          );
        })}

        {/* Pickups */}
        {gs.pickups.map(p => {
          if (p.collected) return null;
          const si = p.seg - Math.floor(camSeg);
          if (si < 0 || si > SEGS) return null;
          const xPos = si * SEG_W - ((camSeg % 1) * SEG_W);
          const terrH = TERRAIN[p.seg] ?? 0;
          return (
            <Text key={p.seg} style={[H.item, { left: xPos + 1, bottom: terrH + 4, fontSize: 18 }]}>
              {PICKUP_EMOJIS[p.type]}
            </Text>
          );
        })}

        {/* Hazards */}
        {gs.hazards.map(h => {
          if (h.hit) return null;
          const si = h.seg - Math.floor(camSeg);
          if (si < 0 || si > SEGS) return null;
          const xPos = si * SEG_W - ((camSeg % 1) * SEG_W);
          const terrH = TERRAIN[h.seg] ?? 0;
          return (
            <Text key={h.seg} style={[H.item, { left: xPos + 1, bottom: terrH + 2, fontSize: 20 }]}>
              {SCAM_EMOJIS[h.type]}
            </Text>
          );
        })}

        {/* Car */}
        <View style={[H.car, {
          left: CAR_X * SEG_W - 14,
          bottom: carTerrainY + gs.carVertOff,
          transform: [{ rotate: `${-slopeAngle * 0.6}deg` }],
          opacity: gs.shielded ? 0.75 : 1,
        }]}>
          <Text style={{ fontSize: 28, transform: [{ scaleX: -1 }] }}>🚗</Text>
          {gs.shielded && <Text style={H.shieldGlow}>🛡️</Text>}
        </View>
      </View>

      {/* Speed indicator */}
      <View style={[H.speedRow, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <Text style={H.speedTxt}>Speed: {gs.speed.toFixed(1)}×</Text>
        <View style={H.speedBarTrack}>
          <View style={[H.speedBarFill, { width: `${(gs.speed / MAX_SPEED) * 100}%` as any, backgroundColor: gs.speed > 3.5 ? "#EF4444" : "#F97316" }]} />
        </View>
      </View>

      {/* Controls */}
      <View style={[H.controls, { paddingBottom: insets.bottom + 8, backgroundColor: "rgba(0,0,0,0.7)" }]}>
        <TouchableOpacity
          style={[H.ctrlBtn, { backgroundColor: "#EF4444CC", borderColor: "#EF444460" }]}
          onPressIn={() => setBrake(true)}
          onPressOut={() => setBrake(false)}
        >
          <Text style={H.ctrlIcon}>🛑</Text>
          <Text style={H.ctrlLabel}>BRAKE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[H.ctrlBtn, { backgroundColor: "#10B981CC", borderColor: "#10B98160" }]}
          onPressIn={() => setGas(true)}
          onPressOut={() => setGas(false)}
        >
          <Text style={H.ctrlIcon}>⚡</Text>
          <Text style={H.ctrlLabel}>GAS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const H = StyleSheet.create({
  screen:       { flex: 1 },
  nav:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:     { fontFamily: "Inter_700Bold", fontSize: 16 },
  hud:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 16 },
  hudItem:      { flexDirection: "row", alignItems: "center", gap: 4 },
  hudEmoji:     { fontSize: 14 },
  hudVal:       { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  shieldBadge:  { backgroundColor: "#3B82F640", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  fuelBarWrap:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  fuelLabel:    { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff", minWidth: 60 },
  fuelTrack:    { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  fuelFill:     { height: "100%", borderRadius: 4 },
  sky:          { height: 40 },
  road:         { overflow: "hidden", backgroundColor: "#050505" },
  seg:          { position: "absolute" },
  item:         { position: "absolute" },
  car:          { position: "absolute", zIndex: 10 },
  shieldGlow:   { position: "absolute", fontSize: 12, bottom: -4, right: -4 },
  speedRow:     { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 6 },
  speedTxt:     { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff", minWidth: 90 },
  speedBarTrack:{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  speedBarFill: { height: "100%", borderRadius: 3 },
  controls:     { flexDirection: "row", gap: 16, paddingHorizontal: 20, paddingTop: 10 },
  ctrlBtn:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 16, borderRadius: 18, borderWidth: 1 },
  ctrlIcon:     { fontSize: 28 },
  ctrlLabel:    { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  title:        { fontFamily: "Inter_700Bold", fontSize: 26, textAlign: "center" },
  sub:          { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },
  badge:        { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  badgeTxt:     { fontFamily: "Inter_700Bold", fontSize: 15 },
  playBtn:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  playBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  howCard:      { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, gap: 10 },
  howTitle:     { fontFamily: "Inter_700Bold", fontSize: 16 },
  howRow:       { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot:          { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  howTxt:       { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, flex: 1 },
  scoreCard:    { width: "100%", borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  scoreBig:     { fontFamily: "Inter_700Bold", fontSize: 48 },
  scoreLabel:   { fontFamily: "Inter_400Regular", fontSize: 14 },
  newBest:      { fontFamily: "Inter_700Bold", fontSize: 14 },
  goBtn:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  goBtnTxt:     { fontFamily: "Inter_700Bold", fontSize: 14 },
});
