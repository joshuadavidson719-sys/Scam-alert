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

const TICK_MS      = 28;
const HUD_H        = 72;
const CTRL_H       = 120;
const GAME_H       = SH - HUD_H - CTRL_H - 80;
const SHIP_W       = 44; const SHIP_H = 50;
const ENEMY_W      = 36; const ENEMY_H = 36;
const BULLET_W     = 8;  const BULLET_H = 20;
const EBULLET_W    = 6;  const EBULLET_H = 14;
const SHIP_STEP    = 32;
const BULLET_SPD   = 12;
const ENEMY_SPD    = 1.2;
const ENEMY_DROP   = 22;
const E_ROWS       = 3;  const E_COLS = 6;
const E_PADX       = 12; const E_PADY = 50;
const E_GAPX       = (SW - E_PADX * 2 - ENEMY_W * E_COLS) / (E_COLS - 1);
const E_GAPY       = 14;

const ENEMY_EMOJIS = ["👾","🛸","👽","🤖","🔴","🟣"];

type Screen  = "menu" | "playing" | "gameover";
type Bullet  = { id: string; x: number; y: number };
type EBullet = { id: string; x: number; y: number };
type Enemy   = { id: string; row: number; col: number; x: number; y: number; alive: boolean; emoji: string; pts: number };
type Particle= { id: string; x: number; y: number; vx: number; vy: number; op: number };
type Leader  = { username: string; score: number };

type GS = {
  shipX: number; lives: number; score: number; tick: number;
  wave: number; nextId: number; dir: 1 | -1;
  bullets: Bullet[]; ebullets: EBullet[];
  enemies: Enemy[]; particles: Particle[];
  fireCooldown: number; eFireCooldown: number;
  shielded: boolean; shieldTicks: number;
};

function makeEnemies(): Enemy[] {
  const out: Enemy[] = [];
  for (let r = 0; r < E_ROWS; r++) {
    for (let c = 0; c < E_COLS; c++) {
      out.push({
        id: `e${r}_${c}`, row: r, col: c,
        x: E_PADX + c * (ENEMY_W + E_GAPX),
        y: E_PADY + r * (ENEMY_H + E_GAPY),
        alive: true,
        emoji: ENEMY_EMOJIS[r % ENEMY_EMOJIS.length],
        pts: (E_ROWS - r) * 50,
      });
    }
  }
  return out;
}

function initGS(): GS {
  return {
    shipX: SW / 2 - SHIP_W / 2, lives: 3, score: 0, tick: 0,
    wave: 1, nextId: 0, dir: 1,
    bullets: [], ebullets: [], enemies: makeEnemies(), particles: [],
    fireCooldown: 0, eFireCooldown: 60, shielded: false, shieldTicks: 0,
  };
}

export default function GalaxyStrike() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [screen, setScreen] = useState<Screen>("menu");
  const [display, setDisplay] = useState({ score: 0, lives: 3, wave: 1, shielded: false });
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const gs = useRef<GS>(initGS());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shipAnim = useRef(new Animated.Value(SW / 2 - SHIP_W / 2)).current;

  const fetchLeaders = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "galaxyScores"), orderBy("score", "desc"), limit(5)));
      setLeaders(snap.docs.map(d => d.data() as Leader));
    } catch {}
  }, []);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);

  const endGame = useCallback(async (finalScore: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopMusic(); playSound("defeat");
    setScreen("gameover");
    if (!user || finalScore === 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "galaxyScores"), {
        userId: user.uid, username: profile?.username ?? "Pilot",
        score: finalScore, createdAt: serverTimestamp(),
      });
      await fetchLeaders();
    } catch {}
    setSubmitting(false);
  }, [user, profile, fetchLeaders]);

  const tick = useCallback(() => {
    const s = gs.current;
    s.tick++;

    const alive = s.enemies.filter(e => e.alive);

    // Check win wave
    if (alive.length === 0) {
      s.wave++;
      s.enemies = makeEnemies().map(e => ({
        ...e, y: e.y + (s.wave - 1) * 10, pts: e.pts + s.wave * 10,
      }));
      s.score += 500;
      playSound("levelUp");
    }

    // Move enemies left/right
    const speed = ENEMY_SPD + s.wave * 0.2;
    s.enemies.forEach(e => { if (e.alive) e.x += speed * s.dir; });
    const xs = s.enemies.filter(e => e.alive).map(e => e.x);
    if (xs.length > 0) {
      const maxX = Math.max(...xs); const minX = Math.min(...xs);
      if ((s.dir === 1 && maxX + ENEMY_W > SW - 8) || (s.dir === -1 && minX < 8)) {
        s.dir = s.dir === 1 ? -1 : 1;
        s.enemies.forEach(e => { if (e.alive) e.y += ENEMY_DROP; });
      }
    }

    // Move bullets up
    s.bullets = s.bullets.map(b => ({ ...b, y: b.y - BULLET_SPD })).filter(b => b.y > -BULLET_H);

    // Move enemy bullets down
    s.ebullets = s.ebullets.map(b => ({ ...b, y: b.y + 7 })).filter(b => b.y < GAME_H + EBULLET_H);

    // Enemy fires randomly
    s.eFireCooldown--;
    if (s.eFireCooldown <= 0 && alive.length > 0) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      s.ebullets.push({ id: `eb${s.nextId++}`, x: shooter.x + ENEMY_W / 2 - EBULLET_W / 2, y: shooter.y + ENEMY_H });
      s.eFireCooldown = 40 - Math.min(30, s.wave * 3);
    }

    // Player fire cooldown
    if (s.fireCooldown > 0) s.fireCooldown--;

    // Particles
    s.particles = s.particles.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, op: p.op - 0.04 })).filter(p => p.op > 0);

    // Shield
    if (s.shielded) { s.shieldTicks--; if (s.shieldTicks <= 0) s.shielded = false; }

    // Bullet–enemy collision
    const nextBullets: Bullet[] = [];
    for (const b of s.bullets) {
      let hit = false;
      for (const e of s.enemies) {
        if (!e.alive) continue;
        if (b.x < e.x + ENEMY_W && b.x + BULLET_W > e.x &&
            b.y < e.y + ENEMY_H && b.y + BULLET_H > e.y) {
          e.alive = false;
          playSound("explode");
          s.score += e.pts;
          for (let p = 0; p < 6; p++) {
            const angle = (Math.PI * 2 * p) / 6;
            s.particles.push({ id: `p${s.nextId++}`, x: e.x + ENEMY_W / 2, y: e.y + ENEMY_H / 2, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, op: 1 });
          }
          hit = true; break;
        }
      }
      if (!hit) nextBullets.push(b);
    }
    s.bullets = nextBullets;

    // Enemy bullet–player collision
    const shipLeft = s.shipX; const shipRight = s.shipX + SHIP_W;
    const shipTop = GAME_H - SHIP_H - 10; const shipBot = GAME_H - 10;
    s.ebullets = s.ebullets.filter(b => {
      const hit = b.x + EBULLET_W > shipLeft && b.x < shipRight &&
                  b.y + EBULLET_H > shipTop && b.y < shipBot;
      if (hit) {
        if (s.shielded) { s.shielded = false; s.shieldTicks = 0; }
        else { s.lives--; playSound("enemyHit"); }
      }
      return !hit;
    });

    // Enemy reaches bottom
    if (s.enemies.some(e => e.alive && e.y + ENEMY_H >= shipTop)) {
      s.lives = 0;
    }

    setDisplay({ score: s.score, lives: s.lives, wave: s.wave, shielded: s.shielded });
    if (s.lives <= 0) endGame(s.score);
  }, [endGame]);

  const firePlayer = useCallback(() => {
    const s = gs.current;
    if (s.fireCooldown > 0) return;
    s.bullets.push({ id: `b${s.nextId++}`, x: s.shipX + SHIP_W / 2 - BULLET_W / 2, y: GAME_H - SHIP_H - 20 });
    playSound("shoot");
    s.fireCooldown = 12;
    // Double shot bonus
    if (s.score > 1000) {
      s.bullets.push({ id: `b${s.nextId++}`, x: s.shipX + SHIP_W / 2 - BULLET_W / 2 - 16, y: GAME_H - SHIP_H - 20 });
    }
  }, []);

  const moveShip = useCallback((dir: -1 | 1) => {
    const s = gs.current;
    const next = Math.max(0, Math.min(SW - SHIP_W, s.shipX + dir * SHIP_STEP));
    s.shipX = next;
    Animated.timing(shipAnim, { toValue: next, duration: 80, useNativeDriver: true }).start();
  }, [shipAnim]);

  const startGame = useCallback(() => {
    gs.current = initGS();
    shipAnim.setValue(SW / 2 - SHIP_W / 2);
    setDisplay({ score: 0, lives: 3, wave: 1, shielded: false });
    setScreen("playing");
    startMusic("space");
    timerRef.current = setInterval(tick, TICK_MS);
  }, [tick, shipAnim]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  if (screen === "menu") {
    return (
      <View style={[P.screen, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={P.back}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={P.menuCenter}>
          <Text style={{ fontSize: 72 }}>🚀</Text>
          <Text style={P.menuTitle}>Galaxy Strike</Text>
          <Text style={P.menuSub}>Destroy alien invaders before they reach Earth!</Text>
          <View style={P.statsRow}>
            <View style={P.statBox}><Text style={P.statVal}>3</Text><Text style={P.statLbl}>Lives</Text></View>
            <View style={P.statBox}><Text style={[P.statVal, { color: "#A855F7" }]}>👾</Text><Text style={P.statLbl}>18 Enemies</Text></View>
            <View style={P.statBox}><Text style={[P.statVal, { color: "#3B82F6" }]}>∞</Text><Text style={P.statLbl}>Waves</Text></View>
          </View>
          <TouchableOpacity style={[P.startBtn, { backgroundColor: "#7C3AED" }]} onPress={startGame}>
            <Text style={P.startBtnTxt}>LAUNCH 🚀</Text>
          </TouchableOpacity>
        </View>
        {leaders.length > 0 && (
          <View style={P.leaderBox}>
            <Text style={P.leaderTitle}>🏆 Top Pilots</Text>
            {leaders.map((l, i) => (
              <View key={i} style={P.leaderRow}>
                <Text style={P.leaderRank}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={P.leaderName}>{l.username}</Text>
                <Text style={[P.leaderScore, { color: "#A855F7" }]}>{l.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  if (screen === "gameover") {
    return (
      <View style={[P.screen, { alignItems: "center", justifyContent: "center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 64 }}>💥</Text>
        <Text style={P.menuTitle}>Game Over!</Text>
        <Text style={[P.menuSub, { marginBottom: 24 }]}>You reached Wave {display.wave}</Text>
        <Text style={P.bigScore}>{display.score.toLocaleString()}</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 32 }}>
          <TouchableOpacity style={[P.startBtn, { backgroundColor: "#7C3AED" }]} onPress={startGame}>
            <Text style={P.startBtnTxt}>RETRY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[P.startBtn, { backgroundColor: "#333" }]} onPress={() => setScreen("menu")}>
            <Text style={P.startBtnTxt}>MENU</Text>
          </TouchableOpacity>
        </View>
        {submitting && <Text style={{ color: "#888", marginTop: 16 }}>Saving score…</Text>}
      </View>
    );
  }

  const s = gs.current;
  return (
    <View style={P.screen}>
      {/* HUD */}
      <View style={[P.hud, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => endGame(s.score)}><Text style={{ color: "#888", fontSize: 13 }}>✕ Quit</Text></TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={P.hudScore}>{display.score.toLocaleString()}</Text>
          <Text style={P.hudWave}>WAVE {display.wave}</Text>
        </View>
        <Text style={P.hudLives}>{"❤️".repeat(display.lives)}</Text>
      </View>

      {/* Game area */}
      <View style={[P.gameArea, { height: GAME_H }]}>
        {/* Stars bg */}
        {[...Array(30)].map((_, i) => (
          <View key={i} style={[P.star, { left: (i * 37) % SW, top: (i * 71) % GAME_H, opacity: (i % 3 + 1) * 0.25 }]} />
        ))}

        {/* Enemies */}
        {s.enemies.filter(e => e.alive).map(e => (
          <View key={e.id} style={[P.enemy, { left: e.x, top: e.y }]}>
            <Text style={{ fontSize: 24 }}>{e.emoji}</Text>
          </View>
        ))}

        {/* Player bullets */}
        {s.bullets.map(b => (
          <View key={b.id} style={[P.bullet, { left: b.x, top: b.y }]} />
        ))}

        {/* Enemy bullets */}
        {s.ebullets.map(b => (
          <View key={b.id} style={[P.ebullet, { left: b.x, top: b.y }]} />
        ))}

        {/* Explosion particles */}
        {s.particles.map(p => (
          <Animated.View key={p.id} style={[P.particle, { left: p.x, top: p.y, opacity: p.op }]} />
        ))}

        {/* Player ship */}
        <Animated.View style={[P.ship, { bottom: 10, transform: [{ translateX: shipAnim }] }]}>
          <Text style={{ fontSize: 38 }}>🚀</Text>
          {display.shielded && <Text style={P.shieldRing}>🔵</Text>}
        </Animated.View>
      </View>

      {/* Controls */}
      <View style={P.controls}>
        <TouchableOpacity style={P.ctrlBtn} onPress={() => moveShip(-1)} activeOpacity={0.6}>
          <Text style={P.ctrlTxt}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[P.ctrlBtn, P.fireBtn]} onPress={firePlayer} activeOpacity={0.6}>
          <Text style={[P.ctrlTxt, { fontSize: 22, color: "#A855F7" }]}>🔫 FIRE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={P.ctrlBtn} onPress={() => moveShip(1)} activeOpacity={0.6}>
          <Text style={P.ctrlTxt}>▶</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const P = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: "#050510" },
  back:       { position: "absolute", top: 50, left: 16, zIndex: 10 },
  backIcon:   { width: 26, height: 26, borderRadius: 7 },
  menuCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  menuTitle:  { fontFamily: "Inter_700Bold", fontSize: 34, color: "#fff", letterSpacing: -0.5 },
  menuSub:    { fontFamily: "Inter_400Regular", fontSize: 15, color: "#888", textAlign: "center" },
  statsRow:   { flexDirection: "row", gap: 20, marginVertical: 12 },
  statBox:    { alignItems: "center", gap: 2 },
  statVal:    { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  statLbl:    { fontFamily: "Inter_400Regular", fontSize: 10, color: "#666" },
  startBtn:   { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16 },
  startBtnTxt:{ fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", letterSpacing: 1 },
  bigScore:   { fontFamily: "Inter_700Bold", fontSize: 56, color: "#A855F7" },
  leaderBox:  { padding: 20, gap: 8 },
  leaderTitle:{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#888" },
  leaderRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  leaderRank: { fontSize: 16, width: 28 },
  leaderName: { fontFamily: "Inter_500Medium", fontSize: 14, color: "#ccc", flex: 1 },
  leaderScore:{ fontFamily: "Inter_700Bold", fontSize: 15 },

  hud:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, height: HUD_H, backgroundColor: "#050510" },
  hudScore:   { fontFamily: "Inter_700Bold", fontSize: 26, color: "#A855F7" },
  hudWave:    { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#666", letterSpacing: 1 },
  hudLives:   { fontSize: 18 },

  gameArea:   { backgroundColor: "#050510", overflow: "hidden", position: "relative" },
  star:       { position: "absolute", width: 2, height: 2, backgroundColor: "#fff", borderRadius: 1 },
  enemy:      { position: "absolute", width: ENEMY_W, height: ENEMY_H, alignItems: "center", justifyContent: "center" },
  bullet:     { position: "absolute", width: BULLET_W, height: BULLET_H, backgroundColor: "#00FF88", borderRadius: 4 },
  ebullet:    { position: "absolute", width: EBULLET_W, height: EBULLET_H, backgroundColor: "#EF4444", borderRadius: 3 },
  particle:   { position: "absolute", width: 8, height: 8, backgroundColor: "#F97316", borderRadius: 4 },
  ship:       { position: "absolute", width: SHIP_W, height: SHIP_H, alignItems: "center", justifyContent: "center" },
  shieldRing: { position: "absolute", fontSize: 50, opacity: 0.5 },

  controls:   { flexDirection: "row", height: CTRL_H, backgroundColor: "#0A0A1A", borderTopWidth: 1, borderTopColor: "#1A1A2E" },
  ctrlBtn:    { flex: 1, alignItems: "center", justifyContent: "center" },
  ctrlTxt:    { fontFamily: "Inter_700Bold", fontSize: 26, color: "#7C3AED" },
  fireBtn:    { flex: 1.6, backgroundColor: "#7C3AED15", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#7C3AED30" },
});
