import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, PanResponder, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, query, orderBy,
  limit, getDocs, serverTimestamp,
} from "firebase/firestore";
import * as Haptics from "expo-haptics";

const APP_ICON = require("@/assets/images/icon.png");
const { width: SW } = Dimensions.get("window");

// ── Grid ──────────────────────────────────────────────────────────────────────
const COLS      = 20;
const ROWS      = 20;
const HUD_H     = 80;
const CTRL_H    = 130;
const PADDING   = 16;
const GRID_SIZE = Math.floor((SW - PADDING * 2) / COLS);
const GRID_W    = GRID_SIZE * COLS;
const GRID_H    = GRID_SIZE * ROWS;

// ── Speed levels ─────────────────────────────────────────────────────────────
function tickMs(len: number): number {
  if (len < 5)  return 220;
  if (len < 10) return 180;
  if (len < 15) return 150;
  if (len < 20) return 120;
  if (len < 30) return 100;
  return 85;
}

// ── Neon palette ──────────────────────────────────────────────────────────────
const FOOD_COLORS   = ["#FF3B3B","#00FFB0","#FF00FF","#FFD700","#00BFFF","#FF6B00"];
const SNAKE_HEAD    = "#00FFB0";
const SNAKE_BODY    = "#00CC88";
const SNAKE_GLOW    = "#00FFB040";

type Dir    = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Pt     = { x: number; y: number };
type Screen = "menu" | "playing" | "gameover";
type Leader = { username: string; score: number };

function rndFood(snake: Pt[]): Pt {
  let pt: Pt;
  do { pt = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }; }
  while (snake.some(s => s.x === pt.x && s.y === pt.y));
  return pt;
}

function rndFoodColor() { return FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)]; }

export default function NeonSnake() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [screen, setScreen]     = useState<Screen>("menu");
  const [snake,  setSnake]      = useState<Pt[]>([]);
  const [food,   setFood]       = useState<Pt>({ x: 10, y: 10 });
  const [foodColor, setFoodColor] = useState(rndFoodColor());
  const [score,  setScore]      = useState(0);
  const [hiScore, setHiScore]   = useState(0);
  const [leaders, setLeaders]   = useState<Leader[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [speedLabel, setSpeedLabel] = useState("SLOW");

  const dirRef   = useRef<Dir>("RIGHT");
  const nextDir  = useRef<Dir>("RIGHT");
  const snakeRef = useRef<Pt[]>([]);
  const foodRef  = useRef<Pt>({ x: 10, y: 10 });
  const scoreRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenRef = useRef<Screen>("menu");

  // Speed label
  const getSpeedLabel = (len: number) => {
    if (len < 5)  return "SLOW";
    if (len < 10) return "NORMAL";
    if (len < 20) return "FAST";
    return "BLAZING";
  };

  const fetchLeaders = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "snakeScores"), orderBy("score", "desc"), limit(5)));
      setLeaders(snap.docs.map(d => d.data() as Leader));
    } catch {}
  }, []);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);

  const endGame = useCallback(async (finalScore: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    screenRef.current = "gameover";
    setScreen("gameover");
    setHiScore(h => Math.max(h, finalScore));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (!user || finalScore === 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "snakeScores"), {
        userId: user.uid, username: profile?.username ?? "Player",
        score: finalScore, createdAt: serverTimestamp(),
      });
      await fetchLeaders();
    } catch {}
    setSubmitting(false);
  }, [user, profile, fetchLeaders]);

  const gameTick = useCallback(() => {
    if (screenRef.current !== "playing") return;
    const s = snakeRef.current;
    dirRef.current = nextDir.current;
    const head = s[0];
    let nx = head.x, ny = head.y;
    if (dirRef.current === "UP")    ny--;
    if (dirRef.current === "DOWN")  ny++;
    if (dirRef.current === "LEFT")  nx--;
    if (dirRef.current === "RIGHT") nx++;

    // Wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { endGame(scoreRef.current); return; }
    // Self collision
    if (s.some(p => p.x === nx && p.y === ny)) { endGame(scoreRef.current); return; }

    const newHead = { x: nx, y: ny };
    const ate = foodRef.current.x === nx && foodRef.current.y === ny;
    const newSnake = ate ? [newHead, ...s] : [newHead, ...s.slice(0, -1)];

    if (ate) {
      const newScore = scoreRef.current + 10 + Math.floor(newSnake.length / 5) * 5;
      scoreRef.current = newScore;
      const newFood = rndFood(newSnake);
      foodRef.current = newFood;
      setFood(newFood);
      setFoodColor(rndFoodColor());
      setScore(newScore);
      setSpeedLabel(getSpeedLabel(newSnake.length));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    snakeRef.current = newSnake;
    setSnake([...newSnake]);

    timerRef.current = setTimeout(gameTick, tickMs(newSnake.length));
  }, [endGame]);

  const startGame = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const initSnake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
    const initFood  = rndFood(initSnake);
    dirRef.current  = "RIGHT";
    nextDir.current = "RIGHT";
    snakeRef.current = initSnake;
    foodRef.current  = initFood;
    scoreRef.current = 0;
    setSnake(initSnake);
    setFood(initFood);
    setFoodColor(rndFoodColor());
    setScore(0);
    setSpeedLabel("SLOW");
    screenRef.current = "playing";
    setScreen("playing");
    timerRef.current = setTimeout(gameTick, tickMs(3));
  }, [gameTick]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Swipe gesture
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        swipeStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      },
      onPanResponderRelease: (e) => {
        if (!swipeStart.current) return;
        const dx = e.nativeEvent.pageX - swipeStart.current.x;
        const dy = e.nativeEvent.pageY - swipeStart.current.y;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        const cur = dirRef.current;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0 && cur !== "LEFT")  nextDir.current = "RIGHT";
          if (dx < 0 && cur !== "RIGHT") nextDir.current = "LEFT";
        } else {
          if (dy > 0 && cur !== "UP")   nextDir.current = "DOWN";
          if (dy < 0 && cur !== "DOWN") nextDir.current = "UP";
        }
        swipeStart.current = null;
      },
    })
  ).current;

  const setDir = (d: Dir) => {
    const c = dirRef.current;
    if (d === "UP"    && c !== "DOWN")  { nextDir.current = "UP";    Haptics.selectionAsync(); }
    if (d === "DOWN"  && c !== "UP")    { nextDir.current = "DOWN";  Haptics.selectionAsync(); }
    if (d === "LEFT"  && c !== "RIGHT") { nextDir.current = "LEFT";  Haptics.selectionAsync(); }
    if (d === "RIGHT" && c !== "LEFT")  { nextDir.current = "RIGHT"; Haptics.selectionAsync(); }
  };

  // ── Menu ─────────────────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <View style={[N.screen, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={N.back}>
          <Image source={APP_ICON} style={N.backIcon} resizeMode="cover" />
        </TouchableOpacity>
        <View style={N.menuCenter}>
          {/* Animated snake preview */}
          <View style={N.previewBox}>
            {[0,1,2,3,4,5].map(i => (
              <View key={i} style={[N.previewCell, { backgroundColor: i === 0 ? SNAKE_HEAD : SNAKE_BODY, opacity: 1 - i * 0.12 }]} />
            ))}
            <View style={[N.previewCell, { backgroundColor: "#FF3B3B", marginLeft: 10, shadowColor: "#FF3B3B", shadowRadius: 8, shadowOpacity: 1 }]} />
          </View>
          <Text style={N.menuTitle}>Neon Snake</Text>
          <Text style={N.menuSub}>Eat the glowing dots · Grow your snake · Don't hit yourself!</Text>
          <View style={N.tipsRow}>
            {[["🍎","Eat food", "+10 pts"],["⚡","Grow longer","Speed up!"],["💡","Swipe or","tap arrows"]].map(([e,l,s]) => (
              <View key={l} style={N.tipBox}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
                <Text style={N.tipLbl}>{l}</Text>
                <Text style={N.tipSub}>{s}</Text>
              </View>
            ))}
          </View>
          {hiScore > 0 && <Text style={N.hiScore}>Personal Best: {hiScore}</Text>}
          <TouchableOpacity style={N.startBtn} onPress={startGame}>
            <Text style={N.startBtnTxt}>PLAY</Text>
          </TouchableOpacity>
        </View>
        {leaders.length > 0 && (
          <View style={N.leaderBox}>
            <Text style={N.leaderTitle}>🏆 High Scores</Text>
            {leaders.map((l, i) => (
              <View key={i} style={N.leaderRow}>
                <Text style={{ fontSize: 18, width: 28 }}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={N.leaderName}>{l.username}</Text>
                <Text style={[N.leaderScore, { color: SNAKE_HEAD }]}>{l.score.toLocaleString()}</Text>
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
      <View style={[N.screen, { alignItems: "center", justifyContent: "center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 64 }}>💀</Text>
        <Text style={N.menuTitle}>Game Over</Text>
        <Text style={[N.menuSub, { marginBottom: 8 }]}>Snake length: {snake.length}</Text>
        <Text style={N.bigScore}>{score}</Text>
        <Text style={{ color: "#555", fontSize: 13, marginTop: 4 }}>points</Text>
        {score >= hiScore && score > 0 && (
          <Text style={[N.hiScore, { color: "#FFD700", marginTop: 8 }]}>🎉 New Personal Best!</Text>
        )}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
          <TouchableOpacity style={N.startBtn} onPress={startGame}>
            <Text style={N.startBtnTxt}>RETRY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[N.startBtn, { backgroundColor: "#1A1A2E" }]} onPress={() => setScreen("menu")}>
            <Text style={N.startBtnTxt}>MENU</Text>
          </TouchableOpacity>
        </View>
        {submitting && <Text style={{ color: "#555", marginTop: 12, fontSize: 12 }}>Saving score…</Text>}
        {leaders.length > 0 && (
          <View style={[N.leaderBox, { width: "90%" }]}>
            <Text style={N.leaderTitle}>🏆 Leaderboard</Text>
            {leaders.map((l, i) => (
              <View key={i} style={N.leaderRow}>
                <Text style={{ fontSize: 18, width: 28 }}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={N.leaderName}>{l.username}</Text>
                <Text style={[N.leaderScore, { color: SNAKE_HEAD }]}>{l.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <View style={[N.screen, { paddingTop: insets.top }]}>
      {/* HUD */}
      <View style={N.hud}>
        <TouchableOpacity onPress={() => endGame(scoreRef.current)}>
          <Text style={{ color: "#444", fontSize: 13 }}>✕ Quit</Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={N.hudScore}>{score}</Text>
          <Text style={N.hudLen}>Length: {snake.length}</Text>
        </View>
        <View style={[N.speedBadge, {
          backgroundColor: speedLabel === "BLAZING" ? "#FF3B3B22" :
                           speedLabel === "FAST"    ? "#FF6B0022" :
                           speedLabel === "NORMAL"  ? "#FFD70022" : "#00FFB022",
          borderColor: speedLabel === "BLAZING" ? "#FF3B3B" :
                       speedLabel === "FAST"    ? "#FF6B00" :
                       speedLabel === "NORMAL"  ? "#FFD700" : SNAKE_HEAD,
        }]}>
          <Text style={[N.speedTxt, {
            color: speedLabel === "BLAZING" ? "#FF3B3B" :
                   speedLabel === "FAST"    ? "#FF6B00" :
                   speedLabel === "NORMAL"  ? "#FFD700" : SNAKE_HEAD,
          }]}>{speedLabel}</Text>
        </View>
      </View>

      {/* Grid */}
      <View style={N.gridWrapper} {...panResponder.panHandlers}>
        <View style={[N.grid, { width: GRID_W, height: GRID_H }]}>
          {/* Grid dots */}
          {Array.from({ length: ROWS }).map((_, r) =>
            Array.from({ length: COLS }).map((_, c) => (
              <View key={`${r}_${c}`} style={[N.dot, { left: c * GRID_SIZE + GRID_SIZE / 2 - 1, top: r * GRID_SIZE + GRID_SIZE / 2 - 1 }]} />
            ))
          )}

          {/* Snake body */}
          {snake.slice(1).map((p, i) => (
            <View
              key={`b${i}`}
              style={[N.snakeCell, {
                left: p.x * GRID_SIZE + 1,
                top:  p.y * GRID_SIZE + 1,
                width:  GRID_SIZE - 2,
                height: GRID_SIZE - 2,
                backgroundColor: SNAKE_BODY,
                opacity: Math.max(0.4, 1 - i * 0.015),
                borderRadius: 4,
              }]}
            />
          ))}

          {/* Snake head */}
          {snake.length > 0 && (
            <View style={[N.snakeCell, {
              left:  snake[0].x * GRID_SIZE + 1,
              top:   snake[0].y * GRID_SIZE + 1,
              width: GRID_SIZE - 2, height: GRID_SIZE - 2,
              backgroundColor: SNAKE_HEAD,
              borderRadius: 5,
              shadowColor: SNAKE_HEAD, shadowRadius: 8, shadowOpacity: 0.9, elevation: 6,
            }]} />
          )}

          {/* Food */}
          <View style={[N.foodCell, {
            left:  food.x * GRID_SIZE + 1,
            top:   food.y * GRID_SIZE + 1,
            width: GRID_SIZE - 2, height: GRID_SIZE - 2,
            backgroundColor: foodColor,
            borderRadius: (GRID_SIZE - 2) / 2,
            shadowColor: foodColor, shadowRadius: 10, shadowOpacity: 1,
          }]} />
        </View>
      </View>

      {/* D-Pad controls */}
      <View style={N.dpad}>
        <TouchableOpacity style={N.dpadBtn} onPress={() => setDir("UP")} activeOpacity={0.6}>
          <Text style={N.dpadTxt}>▲</Text>
        </TouchableOpacity>
        <View style={N.dpadRow}>
          <TouchableOpacity style={N.dpadBtn} onPress={() => setDir("LEFT")} activeOpacity={0.6}>
            <Text style={N.dpadTxt}>◀</Text>
          </TouchableOpacity>
          <View style={[N.dpadBtn, { backgroundColor: "transparent", borderColor: "transparent" }]} />
          <TouchableOpacity style={N.dpadBtn} onPress={() => setDir("RIGHT")} activeOpacity={0.6}>
            <Text style={N.dpadTxt}>▶</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={N.dpadBtn} onPress={() => setDir("DOWN")} activeOpacity={0.6}>
          <Text style={N.dpadTxt}>▼</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const N = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#050510" },
  back:         { position: "absolute", top: 50, left: 16, zIndex: 10 },
  backIcon:     { width: 26, height: 26, borderRadius: 7 },

  menuCenter:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 28 },
  previewBox:   { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  previewCell:  { width: 22, height: 22, borderRadius: 5, shadowRadius: 6, shadowOpacity: 0.8 },
  menuTitle:    { fontFamily: "Inter_700Bold", fontSize: 36, color: "#00FFB0", letterSpacing: -1,
                  textShadowColor: "#00FFB080", textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
  menuSub:      { fontFamily: "Inter_400Regular", fontSize: 14, color: "#555", textAlign: "center", lineHeight: 22 },
  tipsRow:      { flexDirection: "row", gap: 16, marginVertical: 4 },
  tipBox:       { alignItems: "center", gap: 3, width: 88 },
  tipLbl:       { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#888" },
  tipSub:       { fontFamily: "Inter_400Regular", fontSize: 10, color: "#444" },
  hiScore:      { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#00FFB0" },
  startBtn:     { backgroundColor: "#00FFB0", paddingHorizontal: 48, paddingVertical: 16, borderRadius: 16 },
  startBtnTxt:  { fontFamily: "Inter_700Bold", fontSize: 18, color: "#050510", letterSpacing: 2 },
  bigScore:     { fontFamily: "Inter_700Bold", fontSize: 64, color: "#00FFB0",
                  textShadowColor: "#00FFB060", textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } },
  leaderBox:    { padding: 20, gap: 8 },
  leaderTitle:  { fontFamily: "Inter_700Bold", fontSize: 13, color: "#333", letterSpacing: 1 },
  leaderRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  leaderName:   { fontFamily: "Inter_500Medium", fontSize: 14, color: "#666", flex: 1 },
  leaderScore:  { fontFamily: "Inter_700Bold", fontSize: 15 },

  hud:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, height: HUD_H, backgroundColor: "#050510" },
  hudScore:     { fontFamily: "Inter_700Bold", fontSize: 28, color: "#00FFB0",
                  textShadowColor: "#00FFB040", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  hudLen:       { fontFamily: "Inter_400Regular", fontSize: 11, color: "#333" },
  speedBadge:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  speedTxt:     { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1 },

  gridWrapper:  { alignItems: "center", justifyContent: "center" },
  grid:         { backgroundColor: "#080818", borderWidth: 1, borderColor: "#0F0F20", position: "relative" },
  dot:          { position: "absolute", width: 2, height: 2, backgroundColor: "#0F0F28", borderRadius: 1 },
  snakeCell:    { position: "absolute" },
  foodCell:     { position: "absolute", elevation: 6 },

  dpad:         { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  dpadRow:      { flexDirection: "row", gap: 4 },
  dpadBtn:      { width: 52, height: 52, backgroundColor: "#0F0F20", borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1A1A35" },
  dpadTxt:      { fontSize: 22, color: "#00FFB0" },
});
