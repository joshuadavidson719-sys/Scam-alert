import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  PanResponder, ScrollView, ActivityIndicator, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, query, where, orderBy, limit,
  getDocs, serverTimestamp,
} from "firebase/firestore";
import { UserAvatar } from "@/components/UserAvatar";

import { Feather } from "@expo/vector-icons";

const { width: SW } = Dimensions.get("window");

// ── Game constants ─────────────────────────────────────────────────────────
const LANES        = 3;
const GAME_W       = SW;
const GAME_H       = 420;
const LANE_W       = GAME_W / LANES;
const PLAYER_SIZE  = 52;
const OBS_SIZE     = 48;
const PLAYER_Y     = GAME_H - PLAYER_SIZE - 24;
const HIT_PAD      = 12;
const TICK_MS      = 33;          // ~30 fps
const BASE_SPEED   = 5;
const SPEED_STEP   = 500;         // ticks per level
const SPAWN_START  = 48;
const SPAWN_MIN    = 16;

// ── Scam obstacles ─────────────────────────────────────────────────────────
const SCAMS = [
  { id: "phishing", emoji: "📧", label: "Phishing",   color: "#EF4444", spd: 1.0 },
  { id: "fakecall", emoji: "📞", label: "Fake Call",  color: "#F97316", spd: 1.2 },
  { id: "link",     emoji: "🔗", label: "Bad Link",   color: "#DC2626", spd: 1.4 },
  { id: "crypto",   emoji: "₿",  label: "Crypto",     color: "#7C3AED", spd: 1.6 },
  { id: "sms",      emoji: "💬", label: "Scam SMS",   color: "#B91C1C", spd: 1.1 },
] as const;

// ── Power-ups ──────────────────────────────────────────────────────────────
const POWERUPS = [
  { id: "shield", emoji: "🛡️", label: "Shield",      color: "#3B82F6", pts: 50 },
  { id: "report", emoji: "🚨", label: "Report Badge", color: "#FF3B3B", pts: 30 },
  { id: "badge",  emoji: "⭐", label: "Gold Badge",   color: "#F59E0B", pts: 25 },
] as const;

// ── Types ──────────────────────────────────────────────────────────────────
type Obs = { id: string; lane: number; y: number; type: typeof SCAMS[number] };
type PUp = { id: string; lane: number; y: number; type: typeof POWERUPS[number] };
type Screen = "menu" | "playing" | "gameover";
type Leader = { userId: string; username: string; profilePhoto?: string; score: number };

type GS = {
  obs: Obs[]; pups: PUp[];
  lane: number; lives: number; score: number;
  level: number; tick: number; nextId: number;
  shielded: boolean; shieldTicks: number; spawnIn: number;
};

function makeGS(): GS {
  return {
    obs: [], pups: [], lane: 1, lives: 3, score: 0,
    level: 1, tick: 0, nextId: 0, shielded: false, shieldTicks: 0,
    spawnIn: SPAWN_START,
  };
}

function laneX(lane: number) { return LANE_W * lane + (LANE_W - OBS_SIZE) / 2; }
function playerLaneX(lane: number) { return LANE_W * lane + (LANE_W - PLAYER_SIZE) / 2; }

const MEDALS = ["🥇", "🥈", "🥉"];

// ── Component ──────────────────────────────────────────────────────────────
export default function ScamGame() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [screen,      setScreen]      = useState<Screen>("menu");
  const [renderTick,  setRenderTick]  = useState(0);
  const [finalScore,  setFinalScore]  = useState(0);
  const [newBest,     setNewBest]     = useState(false);
  const [personalBest,setPersonalBest]= useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const [leaders,     setLeaders]     = useState<Leader[]>([]);
  const [ldrTab,      setLdrTab]      = useState<"friends" | "global">("friends");
  const [ldrLoading,  setLdrLoading]  = useState(false);

  const gs        = useRef<GS>(makeGS());
  const loopRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickFnRef = useRef<() => void>(() => {});
  const bgAnim    = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bgLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // ── Background scroll animation ──────────────────────────────────────────
  useEffect(() => {
    if (screen === "playing") {
      bgLoopRef.current = Animated.loop(
        Animated.timing(bgAnim, { toValue: 1, duration: 700, useNativeDriver: true })
      );
      bgLoopRef.current.start();
    } else {
      bgLoopRef.current?.stop();
      bgAnim.setValue(0);
    }
  }, [screen, bgAnim]);

  // ── Load personal best ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    getDocs(
      query(collection(db, "gameScores"),
        where("userId", "==", user.uid),
        orderBy("score", "desc"),
        limit(1))
    ).then((snap) => {
      if (!snap.empty) setPersonalBest(snap.docs[0].data().score as number);
    }).catch(() => {});
  }, [user]);

  // ── Load leaderboard ──────────────────────────────────────────────────────
  const loadLeaders = useCallback(async () => {
    if (!user || !profile) return;
    setLdrLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "gameScores"), orderBy("score", "desc"), limit(300))
      );
      const friendIds = new Set([user.uid, ...(profile.following ?? [])]);
      const seen = new Set<string>();
      const all: Leader[] = [];
      const friends: Leader[] = [];

      snap.docs.forEach((d) => {
        const data = d.data();
        const entry: Leader = {
          userId: data.userId, username: data.username,
          profilePhoto: data.profilePhoto ?? undefined, score: data.score,
        };
        if (!seen.has(data.userId)) {
          seen.add(data.userId);
          all.push(entry);
          if (friendIds.has(data.userId)) friends.push(entry);
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
      await addDoc(collection(db, "gameScores"), {
        userId: user.uid,
        username: profile.username,
        profilePhoto: profile.profilePhoto ?? null,
        score,
        createdAt: serverTimestamp(),
      });
      if (score > personalBest) { setPersonalBest(score); setNewBest(true); }
    } catch {}
    setSubmitting(false);
    loadLeaders();
  }, [user, profile, personalBest, loadLeaders]);

  // ── Shake helper ──────────────────────────────────────────────────────────
  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 45, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // ── Tick function (stored in ref to avoid stale closures) ─────────────────
  useEffect(() => {
    tickFnRef.current = () => {
      const g = gs.current;
      g.tick++;

      // Level up
      if (g.tick % SPEED_STEP === 0) g.level = Math.min(g.level + 1, 9);

      const speed       = BASE_SPEED + (g.level - 1) * 0.9;
      const spawnGap    = Math.max(SPAWN_MIN, SPAWN_START - g.level * 3);
      const scamPool    = SCAMS.slice(0, Math.min(2 + g.level, SCAMS.length));

      // Move items
      g.obs.forEach((o)  => { o.y += speed * o.type.spd; });
      g.pups.forEach((p) => { p.y += speed * 0.65; });
      g.obs  = g.obs.filter((o)  => o.y < GAME_H + 60);
      g.pups = g.pups.filter((p) => p.y < GAME_H + 60);

      // Spawn
      g.spawnIn--;
      if (g.spawnIn <= 0) {
        g.spawnIn = spawnGap + Math.floor(Math.random() * 12);
        const lane = Math.floor(Math.random() * LANES);
        if (Math.random() < 0.22) {
          g.pups.push({ id: String(g.nextId++), lane, y: -OBS_SIZE,
            type: POWERUPS[Math.floor(Math.random() * POWERUPS.length)] });
        } else {
          g.obs.push({ id: String(g.nextId++), lane, y: -OBS_SIZE,
            type: scamPool[Math.floor(Math.random() * scamPool.length)] });
        }
      }

      // Hitbox
      const px = playerLaneX(g.lane);
      const py = PLAYER_Y;
      const hL = px + HIT_PAD; const hR = px + PLAYER_SIZE - HIT_PAD;
      const hT = py + HIT_PAD; const hB = py + PLAYER_SIZE - HIT_PAD;

      // Obstacle collision
      const hitI = g.obs.findIndex((o) => {
        const ox = laneX(o.lane);
        return ox + OBS_SIZE > hL && ox < hR && o.y + OBS_SIZE > hT && o.y < hB;
      });
      if (hitI >= 0) {
        g.obs.splice(hitI, 1);
        if (!g.shielded) { g.lives--; shake(); }
      }

      // Power-up collection
      const pupI = g.pups.findIndex((p) => {
        const ox = laneX(p.lane);
        return ox + OBS_SIZE > hL && ox < hR && p.y + OBS_SIZE > hT && p.y < hB;
      });
      if (pupI >= 0) {
        const pu = g.pups[pupI];
        g.score += pu.type.pts;
        if (pu.type.id === "shield") { g.shielded = true; g.shieldTicks = 90; }
        g.pups.splice(pupI, 1);
      }

      // Shield countdown
      if (g.shielded) { g.shieldTicks--; if (g.shieldTicks <= 0) g.shielded = false; }

      // Passive score
      g.score += 1;

      // Game over
      if (g.lives <= 0) {
        if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
        const sc = g.score;
        setFinalScore(sc);
        setScreen("gameover");
        submitScore(sc);
        return;
      }

      setRenderTick((t) => t + 1);
    };
  });

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "playing") return;
    loopRef.current = setInterval(() => tickFnRef.current(), TICK_MS);
    return () => { if (loopRef.current) clearInterval(loopRef.current); };
  }, [screen]);

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = () => {
    gs.current = makeGS();
    setNewBest(false);
    setRenderTick(0);
    setScreen("playing");
  };

  // ── PanResponder for swipe / tap ──────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (e, state) => {
        const g = gs.current;
        if (Math.abs(state.dx) > 20) {
          if (state.dx < 0) g.lane = Math.max(0, g.lane - 1);
          else               g.lane = Math.min(LANES - 1, g.lane + 1);
        } else {
          if (e.nativeEvent.pageX < GAME_W / 2) g.lane = Math.max(0, g.lane - 1);
          else                                    g.lane = Math.min(LANES - 1, g.lane + 1);
        }
      },
    })
  ).current;

  // ── Derived values for render ─────────────────────────────────────────────
  const g     = gs.current;
  const speed = (BASE_SPEED + (g.level - 1) * 0.9).toFixed(1);
  const bgY   = bgAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 48] });

  // ══════════════════════════════════════════════════════════════════════════
  // MENU SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === "menu") {
    return (
      <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={S.navBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[S.navTitle, { color: colors.text }]}>Scam Surfer</Text>
          <View style={{ width: 22 }} />
        </View>

        {/* Hero card */}
        <View style={[S.heroCard, { backgroundColor: "#FF3B3B0D", borderColor: "#FF3B3B30" }]}>
          <Text style={S.heroEmoji}>🏃‍♂️💨</Text>
          <Text style={[S.heroTitle, { color: colors.text }]}>Dodge the Scams!</Text>
          <Text style={[S.heroSub, { color: colors.textMuted }]}>
            Swipe or tap to switch lanes. Dodge phishing emails, fake calls and crypto scams.
            Grab shields for protection and rack up the highest score!
          </Text>

          {/* Scam types preview */}
          <View style={S.scamRow}>
            {SCAMS.map((s) => (
              <View key={s.id} style={[S.scamChip, { backgroundColor: s.color + "18", borderColor: s.color + "40" }]}>
                <Text style={S.scamChipEmoji}>{s.emoji}</Text>
                <Text style={[S.scamChipLabel, { color: s.color }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {personalBest > 0 && (
            <View style={[S.bestRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={S.bestEmoji}>🏆</Text>
              <Text style={[S.bestLabel, { color: colors.textMuted }]}>Your Best</Text>
              <Text style={[S.bestScore, { color: colors.primary }]}>{personalBest.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* Play button */}
        <TouchableOpacity style={[S.playBtn, { backgroundColor: colors.primary }]} onPress={startGame} activeOpacity={0.85}>
          <Text style={S.playBtnEmoji}>🎮</Text>
          <Text style={S.playBtnLabel}>Play Now</Text>
        </TouchableOpacity>

        {/* Leaderboard */}
        <View style={[S.ldrHeader, { borderBottomColor: colors.border }]}>
          {(["friends", "global"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[S.ldrTab, ldrTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setLdrTab(tab)}
            >
              <Text style={[S.ldrTabLabel, { color: ldrTab === tab ? colors.primary : colors.textMuted }]}>
                {tab === "friends" ? "👥 Friends" : "🌍 Global"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
          {ldrLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : leaders.length === 0 ? (
            <View style={S.emptyState}>
              <Text style={{ fontSize: 36 }}>🎯</Text>
              <Text style={[S.emptyText, { color: colors.textMuted }]}>
                {ldrTab === "friends" ? "No scores yet — challenge your friends!" : "No scores yet. Be the first!"}
              </Text>
            </View>
          ) : (
            leaders.map((e, i) => (
              <View
                key={e.userId + i}
                style={[S.ldrRow, {
                  backgroundColor: e.userId === user?.uid ? colors.primary + "12" : colors.card,
                  borderColor:     e.userId === user?.uid ? colors.primary + "50" : colors.border,
                }]}
              >
                <Text style={S.ldrMedal}>{i < 3 ? MEDALS[i] : `#${i + 1}`}</Text>
                <UserAvatar uri={e.profilePhoto} name={e.username} size={36} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[S.ldrName, { color: colors.text }]} numberOfLines={1}>{e.username}</Text>
                  {e.userId === user?.uid && <Text style={[S.ldrYou, { color: colors.primary }]}>You</Text>}
                </View>
                <Text style={[S.ldrScore, { color: colors.primary }]}>{e.score.toLocaleString()}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GAME OVER SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (screen === "gameover") {
    const myRank = leaders.findIndex((l) => l.userId === user?.uid);
    return (
      <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top, justifyContent: "center" }]}>
        <View style={S.goWrap}>
          <Text style={S.goEmoji}>{newBest ? "🏆" : finalScore > 500 ? "😤" : "💀"}</Text>
          <Text style={[S.goTitle, { color: colors.text }]}>
            {newBest ? "New Record!" : "Scammed!"}
          </Text>
          <Text style={[S.goSub, { color: colors.textMuted }]}>
            {newBest ? "You crushed your previous best!" : "The scammers got you this time."}
          </Text>

          {/* Score card */}
          <View style={[S.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={S.scoreRow}>
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: colors.primary }]}>{finalScore.toLocaleString()}</Text>
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
              <View style={[S.rankBanner, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[S.rankBannerText, { color: colors.primary }]}>
                  {myRank < 3 ? MEDALS[myRank] : `#${myRank + 1}`} on friends leaderboard
                </Text>
              </View>
            )}
          </View>

          {submitting && (
            <View style={S.submittingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[S.submittingText, { color: colors.textMuted }]}>Saving score…</Text>
            </View>
          )}

          <TouchableOpacity style={[S.playBtn, { backgroundColor: colors.primary, marginTop: 24 }]} onPress={startGame} activeOpacity={0.85}>
            <Text style={S.playBtnEmoji}>🔄</Text>
            <Text style={S.playBtnLabel}>Play Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[S.outlineBtn, { borderColor: colors.border }]}
            onPress={() => { setScreen("menu"); loadLeaders(); }}
          >
            <Text style={[S.outlineBtnLabel, { color: colors.text }]}>🏠  Back to Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PLAYING SCREEN
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={[S.screen, { backgroundColor: "#0A0A0F", paddingTop: insets.top }]}>

      {/* HUD */}
      <View style={S.hud}>
        <TouchableOpacity
          onPress={() => { if (loopRef.current) clearInterval(loopRef.current); setScreen("menu"); }}
          style={S.hudBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ fontSize: 18, color: "#fff", fontWeight: "bold" }}>✕</Text>
        </TouchableOpacity>

        <View style={S.hudCenter}>
          <Text style={S.hudScore}>{g.score.toLocaleString()}</Text>
          <Text style={S.hudScoreLbl}>SCORE</Text>
        </View>

        <View style={S.hudRight}>
          <View style={[S.levelBadge, { backgroundColor: colors.primary }]}>
            <Text style={S.levelBadgeTxt}>LV {g.level}</Text>
          </View>
          <View style={S.heartsRow}>
            {[0, 1, 2].map((i) => (
              <Text key={i} style={{ fontSize: 14, opacity: i < g.lives ? 1 : 0.2 }}>❤️</Text>
            ))}
          </View>
        </View>
      </View>

      {/* Game canvas */}
      <Animated.View
        style={[S.canvas, { transform: [{ translateX: shakeAnim }] }]}
        {...panResponder.panHandlers}
      >
        {/* Scrolling background */}
        <Animated.View style={[S.bgStripes, { transform: [{ translateY: bgY }] }]}>
          {Array.from({ length: 20 }).map((_, i) => (
            <View key={i} style={[S.bgStripe, { opacity: i % 2 === 0 ? 0.06 : 0 }]} />
          ))}
        </Animated.View>

        {/* Lane lines */}
        <View style={[S.laneLine, { left: LANE_W - 1 }]} />
        <View style={[S.laneLine, { left: LANE_W * 2 - 1 }]} />

        {/* Danger zone */}
        <View style={[S.dangerZone, { top: PLAYER_Y - 6 }]} />

        {/* Obstacles */}
        {g.obs.map((o) => (
          <View
            key={o.id}
            style={[S.obs, {
              left: laneX(o.lane), top: o.y,
              backgroundColor: o.type.color + "20",
              borderColor: o.type.color,
            }]}
          >
            <Text style={S.obsEmoji}>{o.type.emoji}</Text>
            <Text style={[S.obsLabel, { color: o.type.color }]}>{o.type.label}</Text>
          </View>
        ))}

        {/* Power-ups */}
        {g.pups.map((p) => (
          <View
            key={p.id}
            style={[S.powerup, {
              left: laneX(p.lane), top: p.y,
              backgroundColor: p.type.color + "25",
              borderColor: p.type.color,
            }]}
          >
            <Text style={S.obsEmoji}>{p.type.emoji}</Text>
            <Text style={[S.obsLabel, { color: p.type.color }]}>+{p.type.pts}</Text>
          </View>
        ))}

        {/* Player */}
        <View
          style={[S.player, {
            left: playerLaneX(g.lane), top: PLAYER_Y,
            backgroundColor: g.shielded ? "#3B82F625" : "#FF3B3B20",
            borderColor:     g.shielded ? "#3B82F6"   : "#FF3B3B",
            shadowColor:     g.shielded ? "#3B82F6"   : "#FF3B3B",
          }]}
        >
          <Text style={S.playerEmoji}>{g.shielded ? "🛡️" : "🏃‍♂️"}</Text>
        </View>

        {/* Shield glow ring */}
        {g.shielded && (
          <View style={[S.shieldRing, {
            left: playerLaneX(g.lane) - 10,
            top: PLAYER_Y - 10,
          }]} />
        )}

        {/* Tap hints (first 3 seconds) */}
        {g.tick < 90 && (
          <View style={S.tapHints} pointerEvents="none">
            <View style={S.tapHintLeft}>
              <Text style={S.tapHintTxt}>← tap</Text>
            </View>
            <View style={S.tapHintRight}>
              <Text style={S.tapHintTxt}>tap →</Text>
            </View>
          </View>
        )}
      </Animated.View>

      {/* Status bar */}
      <View style={S.statusBar}>
        <View style={S.statusLeft}>
          <Text style={S.statusSpd}>⚡ {speed}x speed</Text>
          {g.shielded && (
            <View style={S.shieldPill}>
              <Text style={S.shieldPillTxt}>🛡️ {Math.ceil(g.shieldTicks / 30)}s</Text>
            </View>
          )}
        </View>
        <Text style={S.statusTip}>Swipe or tap sides</Text>
      </View>

      {/* Power-up legend */}
      <View style={[S.legend, { backgroundColor: "#111420" }]}>
        {POWERUPS.map((p) => (
          <View key={p.id} style={S.legendItem}>
            <Text style={S.legendEmoji}>{p.emoji}</Text>
            <Text style={[S.legendLabel, { color: p.color }]}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  screen:       { flex: 1 },

  // Nav
  navBar:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:     { fontFamily: "Inter_700Bold", fontSize: 18 },

  // Hero card
  heroCard:     { margin: 16, borderRadius: 20, borderWidth: 1, padding: 16, alignItems: "center", gap: 8 },
  heroEmoji:    { fontSize: 44 },
  heroTitle:    { fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center" },
  heroSub:      { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 20 },
  scamRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 4 },
  scamChip:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  scamChipEmoji:{ fontSize: 12 },
  scamChipLabel:{ fontFamily: "Inter_600SemiBold", fontSize: 10 },
  bestRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  bestEmoji:    { fontSize: 18 },
  bestLabel:    { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 },
  bestScore:    { fontFamily: "Inter_700Bold", fontSize: 18 },

  // Buttons
  playBtn:      { marginHorizontal: 16, marginBottom: 4, borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  playBtnEmoji: { fontSize: 22 },
  playBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  outlineBtn:   { marginHorizontal: 16, marginTop: 12, borderRadius: 16, paddingVertical: 14, borderWidth: 1, alignItems: "center" },
  outlineBtnLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15 },

  // Leaderboard
  ldrHeader:    { flexDirection: "row", borderBottomWidth: 1, marginTop: 8 },
  ldrTab:       { flex: 1, alignItems: "center", paddingVertical: 10 },
  ldrTabLabel:  { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  emptyState:   { alignItems: "center", paddingTop: 40, gap: 12 },
  emptyText:    { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingHorizontal: 32 },
  ldrRow:       { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 14, borderWidth: 1 },
  ldrMedal:     { fontSize: 20, width: 32, textAlign: "center" },
  ldrName:      { fontFamily: "Inter_700Bold", fontSize: 14 },
  ldrYou:       { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  ldrScore:     { fontFamily: "Inter_700Bold", fontSize: 17 },

  // Game over
  goWrap:       { alignItems: "center", paddingHorizontal: 24, gap: 8 },
  goEmoji:      { fontSize: 64 },
  goTitle:      { fontFamily: "Inter_700Bold", fontSize: 28 },
  goSub:        { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" },
  scoreCard:    { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, marginTop: 16 },
  scoreRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  scoreItem:    { alignItems: "center", gap: 4 },
  scoreVal:     { fontFamily: "Inter_700Bold", fontSize: 22 },
  scoreLabel:   { fontFamily: "Inter_400Regular", fontSize: 12 },
  scoreDivider: { width: 1, height: 36 },
  rankBanner:   { marginTop: 14, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: "center" },
  rankBannerText:{ fontFamily: "Inter_700Bold", fontSize: 13 },
  submittingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  submittingText:{ fontFamily: "Inter_400Regular", fontSize: 13 },

  // HUD
  hud:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  hudBack:      { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  hudCenter:    { flex: 1, alignItems: "center" },
  hudScore:     { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  hudScoreLbl:  { fontFamily: "Inter_400Regular", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1.5 },
  hudRight:     { alignItems: "flex-end", gap: 4 },
  levelBadge:   { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  levelBadgeTxt:{ fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
  heartsRow:    { flexDirection: "row", gap: 2 },

  // Canvas
  canvas:       { width: GAME_W, height: GAME_H, overflow: "hidden", position: "relative", backgroundColor: "#0D0D18" },
  bgStripes:    { position: "absolute", top: -48, left: 0, right: 0, bottom: 0 },
  bgStripe:     { height: 48, backgroundColor: "#ffffff" },
  laneLine:     { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  dangerZone:   { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: "rgba(255,59,59,0.25)" },

  // Obstacles
  obs:    { position: "absolute", width: OBS_SIZE, height: OBS_SIZE, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 2 },
  powerup:{ position: "absolute", width: OBS_SIZE, height: OBS_SIZE, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: 2 },
  obsEmoji:   { fontSize: 20 },
  obsLabel:   { fontFamily: "Inter_700Bold", fontSize: 8 },

  // Player
  player:   { position: "absolute", width: PLAYER_SIZE, height: PLAYER_SIZE, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center", shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
  playerEmoji:{ fontSize: 28 },
  shieldRing: { position: "absolute", width: PLAYER_SIZE + 20, height: PLAYER_SIZE + 20, borderRadius: 36, borderWidth: 2, borderColor: "#3B82F6", opacity: 0.5 },

  // Tap hints
  tapHints:   { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row" },
  tapHintLeft:{ flex: 1, alignItems: "flex-start", justifyContent: "center", paddingLeft: 16 },
  tapHintRight:{ flex: 1, alignItems: "flex-end", justifyContent: "center", paddingRight: 16 },
  tapHintTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: "rgba(255,255,255,0.35)" },

  // Status + legend
  statusBar:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#111118" },
  statusLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statusSpd:  { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#F59E0B" },
  statusTip:  { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.3)" },
  shieldPill: { backgroundColor: "#3B82F620", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  shieldPillTxt:{ fontFamily: "Inter_700Bold", fontSize: 12, color: "#3B82F6" },
  legend:     { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, paddingHorizontal: 12 },
  legendItem: { alignItems: "center", gap: 2 },
  legendEmoji:{ fontSize: 16 },
  legendLabel:{ fontFamily: "Inter_600SemiBold", fontSize: 9 },
});
