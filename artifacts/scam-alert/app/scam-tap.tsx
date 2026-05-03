import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, query, where, orderBy,
  limit, getDocs, serverTimestamp,
} from "firebase/firestore";

const { width: SW } = Dimensions.get("window");

// ── Content ────────────────────────────────────────────────────────────────
const SCAMS = [
  { emoji: "📧", label: "Phishing",   color: "#EF4444" },
  { emoji: "📞", label: "Fake Call",  color: "#F97316" },
  { emoji: "🔗", label: "Bad Link",   color: "#DC2626" },
  { emoji: "₿",  label: "Crypto",     color: "#7C3AED" },
  { emoji: "💬", label: "Scam SMS",   color: "#B91C1C" },
  { emoji: "💰", label: "Fake Prize", color: "#F59E0B" },
  { emoji: "🎣", label: "Hook Scam",  color: "#EF4444" },
] as const;

const LEGITS = [
  { emoji: "🔒", label: "Secure",   color: "#10B981" },
  { emoji: "✅", label: "Verified", color: "#10B981" },
  { emoji: "🏦", label: "Real Bank",color: "#3B82F6" },
] as const;

// ── Constants ──────────────────────────────────────────────────────────────
const GRID      = 9;           // 3 × 3
const COLS      = 3;
const ROUND_S   = 45;
const SHOW_MS   = 1500;
const SPAWN_MS  = 750;
const MAX_LIVES = 5;
const CELL_SIZE = (SW - 48) / COLS;

// ── Types ──────────────────────────────────────────────────────────────────
type Cell = { type: "scam" | "legit"; emoji: string; label: string; color: string; born: number } | null;
type Screen = "menu" | "playing" | "gameover";

// ── Component ──────────────────────────────────────────────────────────────
export default function ScamTap() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [screen,      setScreen]      = useState<Screen>("menu");
  const [cells,       setCells]       = useState<Cell[]>(Array(GRID).fill(null));
  const [score,       setScore]       = useState(0);
  const [lives,       setLives]       = useState(MAX_LIVES);
  const [timeLeft,    setTimeLeft]    = useState(ROUND_S);
  const [combo,       setCombo]       = useState(0);
  const [personalBest,setPersonalBest]= useState(0);
  const [finalScore,  setFinalScore]  = useState(0);
  const [newBest,     setNewBest]     = useState(false);
  const [comboFlash,  setComboFlash]  = useState(false);

  const cellsR   = useRef<Cell[]>(Array(GRID).fill(null));
  const livesR   = useRef(MAX_LIVES);
  const scoreR   = useRef(0);
  const comboR   = useRef(0);
  const lastTapR = useRef(0);
  const activeR  = useRef(false);
  const loopR    = useRef<ReturnType<typeof setInterval> | null>(null);
  const anims    = useRef(Array.from({ length: GRID }, () => new Animated.Value(0))).current;
  const shakeAnim= useRef(new Animated.Value(0)).current;

  // Personal best
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "tapScores"),
      where("userId", "==", user.uid), orderBy("score", "desc"), limit(1)))
      .then(s => { if (!s.empty) setPersonalBest(s.docs[0].data().score); })
      .catch(() => {});
  }, [user]);

  // ── Pop a cell in ──────────────────────────────────────────────────────
  const popIn = useCallback((idx: number) => {
    anims[idx].setValue(0);
    Animated.spring(anims[idx], { toValue: 1, useNativeDriver: true, tension: 260, friction: 7 }).start();
  }, [anims]);

  const popOut = useCallback((idx: number, fast?: boolean) => {
    Animated.timing(anims[idx], { toValue: 0, duration: fast ? 100 : 180, useNativeDriver: true }).start();
  }, [anims]);

  // ── Shake (lost a life) ────────────────────────────────────────────────
  const doShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,   duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── End game ───────────────────────────────────────────────────────────
  const endGame = useCallback((sc: number) => {
    activeR.current = false;
    if (loopR.current) { clearInterval(loopR.current); loopR.current = null; }
    cellsR.current = Array(GRID).fill(null);
    setCells(Array(GRID).fill(null));
    anims.forEach(a => a.setValue(0));
    setFinalScore(sc);
    setScreen("gameover");
    if (user && profile && sc > 0) {
      addDoc(collection(db, "tapScores"), {
        userId: user.uid, username: profile.username,
        profilePhoto: profile.profilePhoto ?? null,
        score: sc, createdAt: serverTimestamp(),
      }).then(() => {
        if (sc > personalBest) { setPersonalBest(sc); setNewBest(true); }
      }).catch(() => {});
    }
  }, [user, profile, personalBest, anims]);

  // ── Main game loop ─────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    cellsR.current = Array(GRID).fill(null);
    livesR.current = MAX_LIVES;
    scoreR.current = 0;
    comboR.current = 0;
    lastTapR.current = 0;
    activeR.current = true;

    setCells(Array(GRID).fill(null));
    setScore(0); setLives(MAX_LIVES); setCombo(0);
    setTimeLeft(ROUND_S); setNewBest(false);
    anims.forEach(a => a.setValue(0));
    setScreen("playing");

    let elapsed = 0;
    let lastSpawn = 0;

    loopR.current = setInterval(() => {
      if (!activeR.current) return;
      elapsed += 100;

      // Timer
      const sLeft = ROUND_S - Math.floor(elapsed / 1000);
      setTimeLeft(Math.max(0, sLeft));
      if (sLeft <= 0) { endGame(scoreR.current); return; }

      // Expire cells
      const now = Date.now();
      const next = cellsR.current.map((cell, idx) => {
        if (!cell) return null;
        if (now - cell.born > SHOW_MS) {
          popOut(idx);
          if (cell.type === "scam") {
            livesR.current--;
            setLives(livesR.current);
            comboR.current = 0;
            setCombo(0);
            doShake();
            if (livesR.current <= 0) {
              endGame(scoreR.current);
              return cell;
            }
          }
          return null;
        }
        return cell;
      });
      cellsR.current = next;
      setCells([...next]);

      // Spawn
      if (elapsed - lastSpawn >= SPAWN_MS) {
        lastSpawn = elapsed;
        const empty = next.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
        if (empty.length > 0) {
          const idx = empty[Math.floor(Math.random() * empty.length)];
          const isScam = Math.random() < 0.78;
          const pool = isScam ? SCAMS : LEGITS;
          const pick = pool[Math.floor(Math.random() * pool.length)];
          const cell: Cell = { type: isScam ? "scam" : "legit", emoji: pick.emoji, label: pick.label, color: pick.color, born: Date.now() };
          cellsR.current = [...cellsR.current];
          cellsR.current[idx] = cell;
          setCells([...cellsR.current]);
          popIn(idx);
        }
      }
    }, 100);
  }, [anims, popIn, popOut, doShake, endGame]);

  useEffect(() => () => { if (loopR.current) clearInterval(loopR.current); }, []);

  // ── Tap a cell ─────────────────────────────────────────────────────────
  const handleTap = useCallback((idx: number) => {
    const cell = cellsR.current[idx];
    if (!cell || !activeR.current) return;
    cellsR.current = [...cellsR.current];
    cellsR.current[idx] = null;
    setCells([...cellsR.current]);
    popOut(idx, true);

    if (cell.type === "scam") {
      const now = Date.now();
      const isCombo = now - lastTapR.current < 700;
      lastTapR.current = now;
      comboR.current = isCombo ? comboR.current + 1 : 1;
      setCombo(comboR.current);
      if (comboR.current > 2) { setComboFlash(true); setTimeout(() => setComboFlash(false), 300); }
      const pts = 10 * Math.min(comboR.current, 5);
      scoreR.current += pts;
      setScore(scoreR.current);
    } else {
      // Tapped legit — penalty
      livesR.current--;
      setLives(livesR.current);
      comboR.current = 0; setCombo(0);
      doShake();
      if (livesR.current <= 0) endGame(scoreR.current);
    }
  }, [popOut, doShake, endGame]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const timerPct = timeLeft / ROUND_S;
  const timerColor = timerPct > 0.5 ? "#10B981" : timerPct > 0.25 ? "#F59E0B" : "#EF4444";

  // ══════════════════════════════════════════════════════════════════════
  // MENU
  // ══════════════════════════════════════════════════════════════════════
  if (screen === "menu") {
    return (
      <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={S.nav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[S.navTitle, { color: colors.text }]}>Scam Tap 👆</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={[S.heroCard, { backgroundColor: "#F97316" + "10", borderColor: "#F97316" + "30" }]}>
          <Text style={S.heroEmoji}>🎯</Text>
          <Text style={[S.heroTitle, { color: colors.text }]}>Whack the Scams!</Text>
          <Text style={[S.heroSub, { color: colors.textMuted }]}>
            Scam icons pop up on the grid. Tap them before they escape!
            Don't tap the legitimate ones or you'll lose a life.
          </Text>
          <View style={S.rulesRow}>
            <View style={[S.ruleChip, { backgroundColor: "#EF444418", borderColor: "#EF444440" }]}>
              <Text style={S.ruleEmoji}>☠️</Text>
              <Text style={[S.ruleText, { color: "#EF4444" }]}>Tap Scams</Text>
            </View>
            <View style={[S.ruleChip, { backgroundColor: "#10B98118", borderColor: "#10B98140" }]}>
              <Text style={S.ruleEmoji}>🚫</Text>
              <Text style={[S.ruleText, { color: "#10B981" }]}>Avoid Legit</Text>
            </View>
            <View style={[S.ruleChip, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B40" }]}>
              <Text style={S.ruleEmoji}>⚡</Text>
              <Text style={[S.ruleText, { color: "#F59E0B" }]}>Combo ×5</Text>
            </View>
          </View>
          {personalBest > 0 && (
            <View style={[S.bestRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={S.bestEmoji}>🏆</Text>
              <Text style={[S.bestLabel, { color: colors.textMuted }]}>Your Best</Text>
              <Text style={[S.bestScore, { color: "#F97316" }]}>{personalBest.toLocaleString()}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[S.playBtn, { backgroundColor: "#F97316" }]}
          onPress={startGame} activeOpacity={0.85}
        >
          <Text style={S.playBtnEmoji}>🎯</Text>
          <Text style={S.playBtnLabel}>Play Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.outlineBtn, { borderColor: colors.border }]} onPress={() => router.back()}>
          <Text style={[S.outlineBtnLabel, { color: colors.textMuted }]}>← Back to Games</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // GAME OVER
  // ══════════════════════════════════════════════════════════════════════
  if (screen === "gameover") {
    return (
      <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top, justifyContent: "center" }]}>
        <View style={S.goWrap}>
          <Text style={S.goEmoji}>{newBest ? "🏆" : finalScore > 300 ? "😤" : "💀"}</Text>
          <Text style={[S.goTitle, { color: colors.text }]}>{newBest ? "New Best!" : "Time's Up!"}</Text>
          <Text style={[S.goSub, { color: colors.textMuted }]}>{newBest ? "You smashed your record!" : "The scammers slipped through."}</Text>
          <View style={[S.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={S.scoreRow}>
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: "#F97316" }]}>{finalScore.toLocaleString()}</Text>
                <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Score</Text>
              </View>
              <View style={[S.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: "#F59E0B" }]}>{Math.max(finalScore, personalBest).toLocaleString()}</Text>
                <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Best</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={[S.playBtn, { backgroundColor: "#F97316", marginTop: 24 }]} onPress={startGame}>
            <Text style={S.playBtnEmoji}>🔄</Text>
            <Text style={S.playBtnLabel}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.outlineBtn, { borderColor: colors.border }]} onPress={() => setScreen("menu")}>
            <Text style={[S.outlineBtnLabel, { color: colors.textMuted }]}>🏠 Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PLAYING
  // ══════════════════════════════════════════════════════════════════════
  return (
    <Animated.View style={[S.screen, { backgroundColor: "#0A0A0F", paddingTop: insets.top, transform: [{ translateX: shakeAnim }] }]}>

      {/* HUD */}
      <View style={S.hud}>
        <TouchableOpacity
          onPress={() => { activeR.current = false; if (loopR.current) clearInterval(loopR.current); setScreen("menu"); }}
          style={S.hudBack}
        >
          <Feather name="x" size={16} color="#fff" />
        </TouchableOpacity>
        <View style={S.hudCenter}>
          <Text style={[S.hudScore, comboFlash && { color: "#F59E0B" }]}>{score.toLocaleString()}</Text>
          {combo > 1 && (
            <Text style={S.hudCombo}>⚡ x{Math.min(combo, 5)} COMBO!</Text>
          )}
        </View>
        <View style={S.hudRight}>
          <Text style={S.hudTimer}>{timeLeft}s</Text>
          <View style={S.livesRow}>
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Text key={i} style={{ fontSize: 12, opacity: i < lives ? 1 : 0.18 }}>🛡️</Text>
            ))}
          </View>
        </View>
      </View>

      {/* Timer bar */}
      <View style={S.timerBarBg}>
        <View style={[S.timerBarFill, { width: `${timerPct * 100}%` as any, backgroundColor: timerColor }]} />
      </View>

      {/* Info strip */}
      <View style={S.infoStrip}>
        <View style={[S.infoChip, { backgroundColor: "#EF444415" }]}>
          <Text style={[S.infoChipTxt, { color: "#EF4444" }]}>📧 TAP scams</Text>
        </View>
        <View style={[S.infoChip, { backgroundColor: "#10B98115" }]}>
          <Text style={[S.infoChipTxt, { color: "#10B981" }]}>🔒 AVOID legit</Text>
        </View>
      </View>

      {/* Grid */}
      <View style={S.grid}>
        {cells.map((cell, idx) => (
          <TouchableOpacity
            key={idx}
            style={[S.hole, { backgroundColor: "#1A1A2E", borderColor: "#2A2A40" }]}
            onPress={() => handleTap(idx)}
            activeOpacity={0.85}
          >
            <Animated.View style={[S.mole, {
              transform: [{ scale: anims[idx] }],
              backgroundColor: cell ? cell.color + "22" : "transparent",
              borderColor: cell ? cell.color : "transparent",
              borderWidth: cell ? 2 : 0,
            }]}>
              {cell && (
                <>
                  <Text style={S.moleEmoji}>{cell.emoji}</Text>
                  <Text style={[S.moleLabel, { color: cell.color }]}>{cell.label}</Text>
                  {cell.type === "legit" && (
                    <View style={[S.legitBadge, { backgroundColor: "#10B98122" }]}>
                      <Text style={S.legitBadgeTxt}>SAFE</Text>
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bottom legend */}
      <View style={[S.legend, { backgroundColor: "#111118" }]}>
        <Text style={[S.legendTxt, { color: "rgba(255,255,255,0.4)" }]}>Combo bonus: ×2 / ×3 / ×4 / ×5 max</Text>
      </View>
    </Animated.View>
  );
}

const S = StyleSheet.create({
  screen:       { flex: 1 },
  nav:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:     { fontFamily: "Inter_700Bold", fontSize: 18 },

  heroCard:     { margin: 16, borderRadius: 20, borderWidth: 1, padding: 16, alignItems: "center", gap: 8 },
  heroEmoji:    { fontSize: 48 },
  heroTitle:    { fontFamily: "Inter_700Bold", fontSize: 20 },
  heroSub:      { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 20 },
  rulesRow:     { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 4 },
  ruleChip:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  ruleEmoji:    { fontSize: 12 },
  ruleText:     { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  bestRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  bestEmoji:    { fontSize: 18 },
  bestLabel:    { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 },
  bestScore:    { fontFamily: "Inter_700Bold", fontSize: 18 },

  playBtn:      { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  playBtnEmoji: { fontSize: 22 },
  playBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  outlineBtn:   { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, paddingVertical: 14, borderWidth: 1, alignItems: "center" },
  outlineBtnLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },

  goWrap:       { alignItems: "center", paddingHorizontal: 24, gap: 8 },
  goEmoji:      { fontSize: 64 },
  goTitle:      { fontFamily: "Inter_700Bold", fontSize: 28 },
  goSub:        { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" },
  scoreCard:    { width: "100%", borderRadius: 20, borderWidth: 1, padding: 24, marginTop: 16 },
  scoreRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  scoreItem:    { alignItems: "center", gap: 4 },
  scoreVal:     { fontFamily: "Inter_700Bold", fontSize: 24 },
  scoreLabel:   { fontFamily: "Inter_400Regular", fontSize: 12 },
  scoreDivider: { width: 1, height: 40 },

  hud:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  hudBack:      { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  hudCenter:    { flex: 1, alignItems: "center" },
  hudScore:     { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff" },
  hudCombo:     { fontFamily: "Inter_700Bold", fontSize: 13, color: "#F59E0B" },
  hudRight:     { alignItems: "flex-end", gap: 4 },
  hudTimer:     { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  livesRow:     { flexDirection: "row", gap: 2 },

  timerBarBg:   { height: 5, backgroundColor: "#1A1A2E", marginHorizontal: 12, borderRadius: 3 },
  timerBarFill: { height: 5, borderRadius: 3 },

  infoStrip:    { flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 8 },
  infoChip:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  infoChipTxt:  { fontFamily: "Inter_700Bold", fontSize: 11 },

  grid:         { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12, justifyContent: "center", flex: 1, alignContent: "center" },
  hole:         { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  mole:         { width: CELL_SIZE - 8, height: CELL_SIZE - 8, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 2 },
  moleEmoji:    { fontSize: 26 },
  moleLabel:    { fontFamily: "Inter_700Bold", fontSize: 9 },
  legitBadge:   { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  legitBadgeTxt:{ fontFamily: "Inter_700Bold", fontSize: 7, color: "#10B981" },

  legend:       { paddingVertical: 10, alignItems: "center" },
  legendTxt:    { fontFamily: "Inter_400Regular", fontSize: 11 },
});
