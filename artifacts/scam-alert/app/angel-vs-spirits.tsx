import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, Image, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
const { width: SW, height: SH } = Dimensions.get("window");

// ── Enemy roster ──────────────────────────────────────────────────────────────
const ENEMIES = [
  {
    id: "wraith",     name: "SHADOW WRAITH",  emoji: "👿",
    hp: 90,           atk: [8, 14],           special: [22, 30],
    color: "#8B0000", glow: "#FF000060",       title: "Spirit of Darkness",
    taunt: "Your light ends here, Angel…",
  },
  {
    id: "specter",    name: "DARK SPECTER",   emoji: "🔮",
    hp: 120,          atk: [10, 18],          special: [28, 38],
    color: "#4B0082", glow: "#9400D360",       title: "Sorcerer of the Void",
    taunt: "No prayer can save you now!",
  },
  {
    id: "fallen",     name: "FALLEN KNIGHT",  emoji: "🗡️",
    hp: 150,          atk: [14, 22],          special: [32, 44],
    color: "#1A0A00", glow: "#FF450060",       title: "Corrupted Warrior",
    taunt: "I was once like you… now kneel!",
  },
  {
    id: "devourer",   name: "SOUL DEVOURER",  emoji: "💀",
    hp: 180,          atk: [16, 26],          special: [36, 50],
    color: "#0D0D0D", glow: "#B0B0B060",       title: "Harvester of Souls",
    taunt: "Your soul will feed my hunger!",
  },
  {
    id: "chaos",      name: "CHAOS DEMON",    emoji: "🔥",
    hp: 210,          atk: [18, 30],          special: [42, 58],
    color: "#3D0000", glow: "#FF600060",       title: "Herald of Destruction",
    taunt: "Chaos is eternal. You are not.",
  },
  {
    id: "abaddon",    name: "ABADDON",        emoji: "😈",
    hp: 280,          atk: [22, 36],          special: [50, 70],
    color: "#200040", glow: "#CC00FF80",       title: "⚠️ BOSS — Lord of the Abyss",
    taunt: "Even God cannot stop me now!",
  },
  {
    id: "void",       name: "THE VOID KING",  emoji: "🌑",
    hp: 360,          atk: [28, 44],          special: [60, 80],
    color: "#000000", glow: "#FFFFFF40",       title: "⚠️ FINAL BOSS — Ruler of Darkness",
    taunt: "This universe belongs to the dark…",
  },
];

type Screen  = "intro" | "fight" | "roundwin" | "gameover" | "cleared";
type Leader  = { username: string; score: number };
type Particle= { id: number; x: number; y: number; vx: number; vy: number; op: number; color: string; size: number };

// ── Helpers ───────────────────────────────────────────────────────────────────
const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

// ── Component ─────────────────────────────────────────────────────────────────
export default function AngelVsSpirits() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [screen,       setScreen]       = useState<Screen>("intro");
  const [round,        setRound]        = useState(0);
  const [playerHp,     setPlayerHp]     = useState(200);
  const [enemyHp,      setEnemyHp]      = useState(0);
  const [specialMeter, setSpecialMeter] = useState(0);
  const [combo,        setCombo]        = useState(0);
  const [maxCombo,     setMaxCombo]     = useState(0);
  const [blocking,     setBlocking]     = useState(false);
  const [cooldown,     setCooldown]     = useState(false);
  const [totalScore,   setTotalScore]   = useState(0);
  const [leaders,      setLeaders]      = useState<Leader[]>([]);
  const [particles,    setParticles]    = useState<Particle[]>([]);
  const [flashColor,   setFlashColor]   = useState("transparent");
  const [hitLabel,     setHitLabel]     = useState("");
  const [enemyTaunt,   setEnemyTaunt]   = useState("");
  const [roundMsg,     setRoundMsg]     = useState("");
  const [submitting,   setSubmitting]   = useState(false);

  // ── Animated values ────────────────────────────────────────────────────────
  const angelX      = useRef(new Animated.Value(0)).current;
  const demonX      = useRef(new Animated.Value(0)).current;
  const angelShake  = useRef(new Animated.Value(0)).current;
  const demonShake  = useRef(new Animated.Value(0)).current;
  const screenShake = useRef(new Animated.Value(0)).current;
  const playerHpW   = useRef(new Animated.Value(1)).current;
  const enemyHpW    = useRef(new Animated.Value(1)).current;
  const specialW    = useRef(new Animated.Value(0)).current;
  const flashOpacity= useRef(new Animated.Value(0)).current;
  const hitLabelOp  = useRef(new Animated.Value(0)).current;
  const hitLabelY   = useRef(new Animated.Value(0)).current;
  const angelScale  = useRef(new Animated.Value(1)).current;
  const demonScale  = useRef(new Animated.Value(1)).current;
  const tauntOp     = useRef(new Animated.Value(0)).current;

  const playerHpRef     = useRef(200);
  const enemyHpRef      = useRef(0);
  const enemyMaxHpRef   = useRef(0);
  const specialRef      = useRef(0);
  const blockingRef     = useRef(false);
  const cooldownRef     = useRef(false);
  const comboRef        = useRef(0);
  const maxComboRef     = useRef(0);
  const scoreRef        = useRef(0);
  const particleIdRef   = useRef(0);
  const enemyTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const curEnemy = ENEMIES[round] ?? ENEMIES[ENEMIES.length - 1];

  // ── Fetch leaderboard ──────────────────────────────────────────────────────
  const fetchLeaders = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "angelScores"), orderBy("score", "desc"), limit(5)));
      setLeaders(snap.docs.map(d => d.data() as Leader));
    } catch {}
  }, []);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);
  useEffect(() => () => { if (enemyTimerRef.current) clearInterval(enemyTimerRef.current); }, []);

  // ── Particle burst ─────────────────────────────────────────────────────────
  const spawnParticles = (x: number, y: number, color: string, count = 10) => {
    const newP: Particle[] = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const spd = 3 + Math.random() * 5;
      return {
        id: particleIdRef.current++, x, y,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        op: 1, color, size: 4 + Math.random() * 6,
      };
    });
    setParticles(prev => [...prev.slice(-40), ...newP]);
    const tick = setInterval(() => {
      setParticles(prev => {
        const updated = prev.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, op: p.op - 0.06 })).filter(p => p.op > 0);
        if (updated.length === 0) clearInterval(tick);
        return updated;
      });
    }, 30);
  };

  // ── Screen flash ───────────────────────────────────────────────────────────
  const triggerFlash = (color: string) => {
    setFlashColor(color);
    flashOpacity.setValue(0.6);
    Animated.timing(flashOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  };

  // ── Hit label popup ────────────────────────────────────────────────────────
  const showHitLabel = (text: string) => {
    setHitLabel(text);
    hitLabelOp.setValue(1); hitLabelY.setValue(0);
    Animated.parallel([
      Animated.timing(hitLabelOp, { toValue: 0, duration: 900, useNativeDriver: true }),
      Animated.timing(hitLabelY,  { toValue: -60, duration: 900, useNativeDriver: true }),
    ]).start();
  };

  // ── Shake screen ──────────────────────────────────────────────────────────
  const triggerScreenShake = () => {
    Animated.sequence([
      Animated.timing(screenShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── HP bar animation ───────────────────────────────────────────────────────
  const animateHpBar = (anim: Animated.Value, newPct: number) => {
    Animated.timing(anim, { toValue: Math.max(0, newPct), duration: 300, useNativeDriver: false }).start();
  };

  // ── Angel attack lunge ─────────────────────────────────────────────────────
  const lunge = (anim: Animated.Value, toward: number) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: toward, duration: 130, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  // ── Character scale pulse ──────────────────────────────────────────────────
  const punchScale = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.18, duration: 100, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1,    duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const hitShake = (anim: Animated.Value) => {
    Animated.sequence([
      Animated.timing(anim, { toValue: 14,  duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -14, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // ── Taunt display ──────────────────────────────────────────────────────────
  const showTaunt = (text: string) => {
    setEnemyTaunt(text);
    tauntOp.setValue(1);
    Animated.sequence([
      Animated.delay(1600),
      Animated.timing(tauntOp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  // ── Start round ───────────────────────────────────────────────────────────
  const startRound = useCallback((r: number) => {
    if (enemyTimerRef.current) clearInterval(enemyTimerRef.current);
    const enemy = ENEMIES[r];
    if (!enemy) { setScreen("cleared"); return; }
    enemyMaxHpRef.current = enemy.hp;
    enemyHpRef.current    = enemy.hp;
    specialRef.current    = 0;
    blockingRef.current   = false;
    cooldownRef.current   = false;
    comboRef.current      = 0;
    setPlayerHp(playerHpRef.current);
    setEnemyHp(enemy.hp);
    setSpecialMeter(0);
    setCombo(0);
    setBlocking(false);
    setCooldown(false);
    enemyHpW.setValue(1);
    specialW.setValue(0);
    animateHpBar(playerHpW, playerHpRef.current / 200);
    setScreen("fight");
    setRound(r);
    setParticles([]);
    setRoundMsg(`ROUND ${r + 1}`);
    setTimeout(() => setRoundMsg(""), 1800);
    setTimeout(() => showTaunt(enemy.taunt), 2000);

    // Enemy AI loop
    const delay = 2200 + r * 200;
    enemyTimerRef.current = setInterval(() => {
      if (cooldownRef.current || blockingRef.current) return;
      if (playerHpRef.current <= 0 || enemyHpRef.current <= 0) return;

      const enemy = ENEMIES[r];
      const useSpecial = Math.random() < 0.25;
      const [minA, maxA] = useSpecial ? enemy.special : enemy.atk;
      const rawDmg = rand(minA, maxA);
      const dmg = blockingRef.current ? Math.max(1, Math.floor(rawDmg * 0.15)) : rawDmg;

      // Lunge toward angel
      Animated.sequence([
        Animated.timing(demonX, { toValue: -40, duration: 140, useNativeDriver: true }),
        Animated.timing(demonX, { toValue: 0,   duration: 200, useNativeDriver: true }),
      ]).start();
      punchScale(demonScale);

      setTimeout(() => {
        hitShake(angelShake);
        if (useSpecial) { triggerFlash("#8B000040"); triggerScreenShake(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }
        else { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
        spawnParticles(80, SH * 0.42, blockingRef.current ? "#3B82F6" : "#EF4444", blockingRef.current ? 5 : 12);

        const newHp = Math.max(0, playerHpRef.current - dmg);
        playerHpRef.current = newHp;
        setPlayerHp(newHp);
        animateHpBar(playerHpW, newHp / 200);

        if (blockingRef.current) {
          showHitLabel("🛡️ BLOCKED");
          setBlocking(false); blockingRef.current = false;
        } else {
          showHitLabel(useSpecial ? `💥 -${dmg} DARK STRIKE!` : `-${dmg}`);
          // Break combo
          comboRef.current = 0; setCombo(0);
        }

        if (newHp <= 0) {
          if (enemyTimerRef.current) clearInterval(enemyTimerRef.current);
          setTimeout(() => saveAndEnd(), 400);
        }
      }, 200);
    }, delay - r * 80);
  }, []);

  // ── Player attacks ─────────────────────────────────────────────────────────
  const doAttack = useCallback((type: "light" | "heavy" | "divine") => {
    if (cooldownRef.current || enemyHpRef.current <= 0 || playerHpRef.current <= 0) return;
    if (type === "divine" && specialRef.current < 100) return;

    cooldownRef.current = true; setCooldown(true);
    const cd = type === "light" ? 500 : type === "heavy" ? 900 : 700;

    // Lunge forward
    lunge(angelX, 40);
    punchScale(angelScale);

    let dmg: number, specialGain: number, label: string, flashC: string;
    if (type === "light") {
      dmg = rand(12, 20); specialGain = 18; label = "HOLY STRIKE"; flashC = "#FFD70030";
    } else if (type === "heavy") {
      dmg = rand(24, 38); specialGain = 30; label = "SMITE!"; flashC = "#FFD70050";
    } else {
      dmg = rand(55, 75); specialGain = 0; label = "✨ DIVINE BLAST!"; flashC = "#FFFFFF70";
    }

    // Combo
    comboRef.current++;
    if (comboRef.current > maxComboRef.current) { maxComboRef.current = comboRef.current; setMaxCombo(comboRef.current); }
    const comboBonus = Math.floor((comboRef.current - 1) * 4);
    const finalDmg = dmg + comboBonus;

    setTimeout(() => {
      hitShake(demonShake);
      triggerFlash(flashC);
      if (type === "divine") { triggerScreenShake(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      else if (type === "heavy") { triggerScreenShake(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }
      else { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }

      spawnParticles(SW - 80, SH * 0.42, type === "divine" ? "#FFD700" : "#FFFFFF", type === "divine" ? 20 : type === "heavy" ? 14 : 8);

      const newEnemyHp = Math.max(0, enemyHpRef.current - finalDmg);
      enemyHpRef.current = newEnemyHp;
      setEnemyHp(newEnemyHp);
      animateHpBar(enemyHpW, newEnemyHp / enemyMaxHpRef.current);

      const newSpecial = type === "divine" ? 0 : Math.min(100, specialRef.current + specialGain);
      specialRef.current = newSpecial;
      setSpecialMeter(newSpecial);
      Animated.timing(specialW, { toValue: newSpecial / 100, duration: 300, useNativeDriver: false }).start();

      const comboTxt = comboRef.current >= 3 ? ` (×${comboRef.current} COMBO!)` : "";
      showHitLabel(`${label} -${finalDmg}${comboTxt}`);
      const pts = finalDmg * (1 + comboRef.current * 0.5);
      scoreRef.current += Math.floor(pts);
      setTotalScore(scoreRef.current);
      setCombo(comboRef.current);

      if (newEnemyHp <= 0) {
        if (enemyTimerRef.current) clearInterval(enemyTimerRef.current);
        comboRef.current = 0; setCombo(0);
        const nextRound = round + 1;
        if (nextRound >= ENEMIES.length) {
          setTimeout(() => { setScreen("cleared"); }, 600);
        } else {
          setTimeout(() => { setScreen("roundwin"); }, 600);
        }
      }
    }, 200);

    setTimeout(() => { cooldownRef.current = false; setCooldown(false); }, cd);
  }, [round]);

  const doBlock = useCallback(() => {
    if (cooldownRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBlocking(true); blockingRef.current = true;
    showHitLabel("🛡️ GUARD UP");
    setTimeout(() => { if (blockingRef.current) { setBlocking(false); blockingRef.current = false; } }, 2500);
  }, []);

  // ── Heal between rounds ────────────────────────────────────────────────────
  const nextRound = useCallback(() => {
    const heal = Math.min(200, playerHpRef.current + 60);
    playerHpRef.current = heal;
    startRound(round + 1);
  }, [round, startRound]);

  // ── Save & end ─────────────────────────────────────────────────────────────
  const saveAndEnd = async () => {
    setScreen("gameover");
    const final = scoreRef.current;
    if (!user || final === 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "angelScores"), {
        userId: user.uid, username: profile?.username ?? "Angel",
        score: final, createdAt: serverTimestamp(),
      });
      await fetchLeaders();
    } catch {}
    setSubmitting(false);
  };

  const saveClearedScore = async () => {
    const final = scoreRef.current + 5000; // Completion bonus
    if (!user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "angelScores"), {
        userId: user.uid, username: profile?.username ?? "Angel",
        score: final, createdAt: serverTimestamp(),
      });
      await fetchLeaders();
    } catch {}
    setSubmitting(false);
  };

  useEffect(() => {
    if (screen === "cleared") saveClearedScore();
  }, [screen]);

  // ── INTRO SCREEN ──────────────────────────────────────────────────────────
  if (screen === "intro") {
    return (
      <LinearGradient colors={["#000000", "#100020", "#000000"]} style={[A.screen, { paddingTop: insets.top }]}>
        {/* Scanlines */}
        <View style={A.scanlines} pointerEvents="none" />

        <TouchableOpacity onPress={() => router.back()} style={A.back}>
          <Image source={APP_ICON} style={A.backIcon} resizeMode="cover" />
        </TouchableOpacity>

        {/* Title block */}
        <View style={A.introTitle}>
          <Text style={A.titleSmall}>⚔️  DIVINE BATTLE  ⚔️</Text>
          <Text style={A.titleMain}>ANGEL</Text>
          <View style={A.titleDivider}><Text style={A.titleVS}>VS</Text></View>
          <Text style={[A.titleMain, { color: "#8B0000", textShadowColor: "#FF000080" }]}>SPIRITS</Text>
          <Text style={A.titleSub}>THE ETERNAL CONFLICT</Text>
        </View>

        {/* Character showcase */}
        <View style={A.charShowcase}>
          <View style={A.charCard}>
            <LinearGradient colors={["#FFD70022","#00000000"]} style={A.charCardGrad}>
              <Text style={A.charEmoji}>😇</Text>
              <Text style={[A.charName, { color: "#FFD700" }]}>ARCHANGEL</Text>
              <Text style={A.charRole}>Champion of Light</Text>
              <View style={A.charStats}>
                <Text style={A.statLine}>❤️ HP     200</Text>
                <Text style={A.statLine}>⚡ POWER   MAX</Text>
                <Text style={A.statLine}>✨ DIVINE  100</Text>
              </View>
            </LinearGradient>
          </View>
          <View style={A.charCard}>
            <LinearGradient colors={["#8B000022","#00000000"]} style={A.charCardGrad}>
              <Text style={A.charEmoji}>😈</Text>
              <Text style={[A.charName, { color: "#FF4444" }]}>DARK LEGION</Text>
              <Text style={A.charRole}>7 Waves of Evil</Text>
              <View style={A.charStats}>
                <Text style={A.statLine}>💀 Waves  ×7</Text>
                <Text style={A.statLine}>⚔️ Boss    ×2</Text>
                <Text style={A.statLine}>🔥 Danger MAX</Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Move legend */}
        <View style={A.moveLegend}>
          {[
            { icon: "⚡", name: "HOLY STRIKE", desc: "Fast, fills Divine Meter", color: "#FFD700" },
            { icon: "🔨", name: "SMITE",       desc: "Heavy damage + screen quake", color: "#FF8C00" },
            { icon: "✨", name: "DIVINE BLAST",desc: "Requires full meter — MASSIVE", color: "#00FFFF" },
            { icon: "🛡️", name: "GUARD",       desc: "Block next enemy attack 85%", color: "#3B82F6" },
          ].map(m => (
            <View key={m.name} style={A.moveRow}>
              <Text style={{ fontSize: 18, width: 28 }}>{m.icon}</Text>
              <Text style={[A.moveName, { color: m.color }]}>{m.name}</Text>
              <Text style={A.moveDesc}>{m.desc}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={A.startBtn} onPress={() => {
          playerHpRef.current = 200;
          scoreRef.current = 0;
          maxComboRef.current = 0;
          setTotalScore(0);
          startRound(0);
        }}>
          <LinearGradient colors={["#FFD700","#FF8C00"]} style={A.startBtnGrad}>
            <Text style={A.startBtnTxt}>BEGIN THE BATTLE</Text>
          </LinearGradient>
        </TouchableOpacity>

        {leaders.length > 0 && (
          <View style={A.leaderBox}>
            <Text style={A.leaderTitle}>🏆  HALL OF CHAMPIONS</Text>
            {leaders.map((l, i) => (
              <View key={i} style={A.leaderRow}>
                <Text style={{ fontSize: 16, width: 26 }}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={A.leaderName}>{l.username}</Text>
                <Text style={A.leaderScore}>{l.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: insets.bottom + 16 }} />
      </LinearGradient>
    );
  }

  // ── ROUND WIN ─────────────────────────────────────────────────────────────
  if (screen === "roundwin") {
    const enemy = ENEMIES[round];
    return (
      <LinearGradient colors={["#000000","#001A00","#000000"]} style={[A.screen, { alignItems: "center", justifyContent: "center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 80, marginBottom: 8 }}>😇</Text>
        <Text style={A.winTitle}>VICTORY!</Text>
        <Text style={[A.winSub, { color: "#888" }]}>{enemy.name} has been defeated</Text>
        <View style={A.winStats}>
          <View style={A.winStatItem}>
            <Text style={A.winStatVal}>{playerHpRef.current}</Text>
            <Text style={A.winStatLbl}>HP Remaining</Text>
          </View>
          <View style={A.winStatItem}>
            <Text style={[A.winStatVal, { color: "#FFD700" }]}>{totalScore.toLocaleString()}</Text>
            <Text style={A.winStatLbl}>Score</Text>
          </View>
          <View style={A.winStatItem}>
            <Text style={[A.winStatVal, { color: "#00FFFF" }]}>{maxCombo}×</Text>
            <Text style={A.winStatLbl}>Best Combo</Text>
          </View>
        </View>
        {round + 1 < ENEMIES.length && (
          <Text style={A.nextEnemy}>
            NEXT: {ENEMIES[round + 1].name}  {ENEMIES[round + 1].emoji}
          </Text>
        )}
        <TouchableOpacity style={A.startBtn} onPress={nextRound}>
          <LinearGradient colors={["#FFD700","#FF8C00"]} style={A.startBtnGrad}>
            <Text style={A.startBtnTxt}>
              {round + 1 >= ENEMIES.length ? "FINAL BATTLE" : `FIGHT ON  ⚔️`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={{ color: "#555", fontSize: 12, marginTop: 10 }}>+60 HP healed for next round</Text>
      </LinearGradient>
    );
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  if (screen === "gameover") {
    return (
      <LinearGradient colors={["#000000","#200000","#000000"]} style={[A.screen, { alignItems: "center", justifyContent: "center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 80, marginBottom: 8 }}>😇</Text>
        <Text style={[A.winTitle, { color: "#EF4444" }]}>DEFEATED</Text>
        <Text style={[A.winSub, { color: "#555" }]}>Fell on Round {round + 1} — {curEnemy.name}</Text>
        <View style={A.winStats}>
          <View style={A.winStatItem}><Text style={[A.winStatVal, { color: "#FFD700" }]}>{totalScore.toLocaleString()}</Text><Text style={A.winStatLbl}>Score</Text></View>
          <View style={A.winStatItem}><Text style={[A.winStatVal, { color: "#00FFFF" }]}>{maxCombo}×</Text><Text style={A.winStatLbl}>Best Combo</Text></View>
        </View>
        {submitting && <Text style={{ color: "#555", fontSize: 12, marginTop: 8 }}>Saving score…</Text>}
        <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
          <TouchableOpacity style={A.startBtn} onPress={() => {
            playerHpRef.current = 200;
            scoreRef.current = 0;
            maxComboRef.current = 0;
            setTotalScore(0);
            startRound(0);
          }}>
            <LinearGradient colors={["#FFD700","#FF8C00"]} style={A.startBtnGrad}>
              <Text style={A.startBtnTxt}>RETRY</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={[A.startBtn, { opacity: 0.8 }]} onPress={() => setScreen("intro")}>
            <LinearGradient colors={["#222","#111"]} style={A.startBtnGrad}>
              <Text style={A.startBtnTxt}>MENU</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {leaders.length > 0 && (
          <View style={[A.leaderBox, { marginTop: 24 }]}>
            <Text style={A.leaderTitle}>🏆  HALL OF CHAMPIONS</Text>
            {leaders.map((l, i) => (
              <View key={i} style={A.leaderRow}>
                <Text style={{ fontSize: 16, width: 26 }}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={A.leaderName}>{l.username}</Text>
                <Text style={A.leaderScore}>{l.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    );
  }

  // ── CLEARED ───────────────────────────────────────────────────────────────
  if (screen === "cleared") {
    return (
      <LinearGradient colors={["#000000","#1A1400","#000000"]} style={[A.screen, { alignItems: "center", justifyContent: "center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 90 }}>👼</Text>
        <Text style={[A.winTitle, { color: "#FFD700", fontSize: 30 }]}>LIGHT TRIUMPHS!</Text>
        <Text style={[A.winSub, { color: "#FFD70099", textAlign: "center" }]}>All 7 spirits have been vanquished.{"\n"}Darkness has been defeated.</Text>
        <Text style={[A.bigScore, { marginTop: 20 }]}>{(totalScore + 5000).toLocaleString()}</Text>
        <Text style={{ color: "#888", fontSize: 12 }}>+5000 Completion Bonus</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
          <TouchableOpacity style={A.startBtn} onPress={() => {
            playerHpRef.current = 200;
            scoreRef.current = 0;
            maxComboRef.current = 0;
            setTotalScore(0);
            startRound(0);
          }}>
            <LinearGradient colors={["#FFD700","#FF8C00"]} style={A.startBtnGrad}>
              <Text style={A.startBtnTxt}>PLAY AGAIN</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={A.startBtn} onPress={() => setScreen("intro")}>
            <LinearGradient colors={["#222","#111"]} style={A.startBtnGrad}>
              <Text style={A.startBtnTxt}>MENU</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ── FIGHT SCREEN ──────────────────────────────────────────────────────────
  const enemy = ENEMIES[round];
  const playerHpPct = playerHp / 200;
  const enemyHpPct  = enemyHp / (enemyMaxHpRef.current || 1);

  return (
    <Animated.View style={[A.screen, { transform: [{ translateX: screenShake }] }]}>
      <LinearGradient
        colors={["#050008", "#0A0015", "#15001A", "#050008"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Scanlines overlay */}
      <View style={A.scanlines} pointerEvents="none" />

      {/* Screen flash */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, opacity: flashOpacity, zIndex: 50 }]}
      />

      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      <View style={[A.hud, { paddingTop: insets.top + 4 }]}>
        {/* Player HP bar (left) */}
        <View style={A.hudSide}>
          <Text style={A.hudName}>ARCHANGEL</Text>
          <View style={A.hpTrack}>
            <Animated.View style={[A.hpFill, {
              width: playerHpW.interpolate({ inputRange: [0,1], outputRange: ["0%","100%"] }),
              backgroundColor: playerHpPct > 0.5 ? "#00FF88" : playerHpPct > 0.25 ? "#FFD700" : "#EF4444",
              shadowColor: playerHpPct > 0.5 ? "#00FF88" : "#EF4444",
            }]} />
          </View>
          <Text style={A.hudHpNum}>{playerHp}</Text>
        </View>

        {/* Round badge */}
        <View style={A.roundBadge}>
          <Text style={A.roundNum}>{round + 1}</Text>
          <Text style={A.roundLbl}>ROUND</Text>
        </View>

        {/* Enemy HP bar (right) */}
        <View style={[A.hudSide, { alignItems: "flex-end" }]}>
          <Text style={[A.hudName, { color: enemy.color === "#0D0D0D" ? "#aaa" : enemy.color, textAlign: "right" }]}>{enemy.name}</Text>
          <View style={[A.hpTrack, { transform: [{ scaleX: -1 }] }]}>
            <Animated.View style={[A.hpFill, {
              width: enemyHpW.interpolate({ inputRange: [0,1], outputRange: ["0%","100%"] }),
              backgroundColor: enemyHpPct > 0.5 ? "#EF4444" : enemyHpPct > 0.25 ? "#F97316" : "#FFD700",
              shadowColor: "#EF4444",
            }]} />
          </View>
          <Text style={[A.hudHpNum, { textAlign: "right" }]}>{enemyHp}</Text>
        </View>
      </View>

      {/* Special meter */}
      <View style={A.specialRow}>
        <Text style={A.specialLbl}>✨ DIVINE POWER</Text>
        <View style={A.specialTrack}>
          <Animated.View style={[A.specialFill, {
            width: specialW.interpolate({ inputRange: [0,1], outputRange: ["0%","100%"] }),
          }]} />
          {specialMeter >= 100 && <Text style={A.specialReady}>READY!</Text>}
        </View>
        <Text style={A.specialPct}>{specialMeter}%</Text>
      </View>

      {/* ── ARENA ───────────────────────────────────────────────────────── */}
      <View style={A.arena}>
        {/* Background cathedral glow */}
        <View style={[A.arenaGlowLeft]}  />
        <View style={[A.arenaGlowRight, { shadowColor: enemy.glow }]} />

        {/* Floor line */}
        <View style={A.floorLine} />

        {/* ANGEL (left) */}
        <Animated.View style={[A.fighter, A.fighterLeft, {
          transform: [
            { translateX: Animated.add(angelX, angelShake) },
            { scale: angelScale },
          ],
        }]}>
          {/* Aura rings */}
          <View style={A.auraRing} />
          <Text style={A.fighterEmoji}>😇</Text>
          {blocking && <Text style={A.blockShield}>🛡️</Text>}
          <Text style={A.fighterLabel}>ANGEL</Text>
        </Animated.View>

        {/* DEMON (right) */}
        <Animated.View style={[A.fighter, A.fighterRight, {
          transform: [
            { translateX: Animated.add(demonX, demonShake) },
            { scale: demonScale },
          ],
        }]}>
          <View style={[A.auraRing, { borderColor: enemy.glow, shadowColor: enemy.glow }]} />
          <Text style={A.fighterEmoji}>{enemy.emoji}</Text>
          <Text style={[A.fighterLabel, { color: "#FF6666" }]}>{enemy.name.split(" ")[0]}</Text>
        </Animated.View>

        {/* Hit particles */}
        {particles.map(p => (
          <Animated.View
            key={p.id}
            style={[A.particle, {
              left: p.x, top: p.y,
              width: p.size, height: p.size, borderRadius: p.size / 2,
              backgroundColor: p.color, opacity: p.op,
            }]}
          />
        ))}

        {/* Round announce */}
        {roundMsg !== "" && (
          <View style={A.roundAnnounce}>
            <Text style={A.roundAnnounceText}>{roundMsg}</Text>
            <Text style={A.roundAnnounceFight}>FIGHT!</Text>
          </View>
        )}

        {/* Enemy taunt */}
        <Animated.View style={[A.tauntBubble, { opacity: tauntOp }]}>
          <Text style={A.tauntText}>"{enemyTaunt}"</Text>
        </Animated.View>

        {/* Hit label */}
        <Animated.View style={[A.hitLabelWrap, { opacity: hitLabelOp, transform: [{ translateY: hitLabelY }] }]}>
          <Text style={A.hitLabelText}>{hitLabel}</Text>
        </Animated.View>

        {/* Combo badge */}
        {combo >= 2 && (
          <View style={[A.comboBadge, { backgroundColor: combo >= 5 ? "#FF6B00" : "#7C3AED" }]}>
            <Text style={A.comboText}>{combo}× COMBO</Text>
          </View>
        )}

        {/* Score display */}
        <View style={A.scoreDisplay}>
          <Text style={A.scoreNum}>{totalScore.toLocaleString()}</Text>
        </View>
      </View>

      {/* ── CONTROLS ────────────────────────────────────────────────────── */}
      <View style={A.controls}>
        <TouchableOpacity
          style={[A.atkBtn, A.atkBtnLight, cooldown && A.btnDisabled]}
          onPress={() => doAttack("light")}
          activeOpacity={0.7}
          disabled={cooldown}
        >
          <LinearGradient colors={["#FFD700","#CC9900"]} style={A.btnGrad}>
            <Text style={A.btnEmoji}>⚡</Text>
            <Text style={A.btnLabel}>HOLY STRIKE</Text>
            <Text style={A.btnSub}>Fast · +18 power</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[A.atkBtn, A.atkBtnHeavy, cooldown && A.btnDisabled]}
          onPress={() => doAttack("heavy")}
          activeOpacity={0.7}
          disabled={cooldown}
        >
          <LinearGradient colors={["#FF8C00","#CC4400"]} style={A.btnGrad}>
            <Text style={A.btnEmoji}>🔨</Text>
            <Text style={A.btnLabel}>SMITE</Text>
            <Text style={A.btnSub}>Heavy · +30 power</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[A.atkBtn, A.atkBtnDivine, (specialMeter < 100 || cooldown) && A.btnDisabled]}
          onPress={() => doAttack("divine")}
          activeOpacity={0.7}
          disabled={specialMeter < 100 || cooldown}
        >
          <LinearGradient
            colors={specialMeter >= 100 ? ["#00FFFF","#0066FF"] : ["#111","#0A0A0A"]}
            style={A.btnGrad}
          >
            <Text style={A.btnEmoji}>✨</Text>
            <Text style={[A.btnLabel, { color: specialMeter >= 100 ? "#fff" : "#444" }]}>DIVINE BLAST</Text>
            <Text style={[A.btnSub, { color: specialMeter >= 100 ? "#BBF" : "#333" }]}>{specialMeter >= 100 ? "UNLEASH!" : `${specialMeter}% charged`}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[A.atkBtn, A.atkBtnBlock, blocking && A.btnActive]}
          onPress={doBlock}
          activeOpacity={0.7}
        >
          <LinearGradient colors={blocking ? ["#3B82F6","#1D4ED8"] : ["#1A2040","#111828"]} style={A.btnGrad}>
            <Text style={A.btnEmoji}>🛡️</Text>
            <Text style={[A.btnLabel, { color: blocking ? "#fff" : "#555" }]}>GUARD</Text>
            <Text style={[A.btnSub, { color: blocking ? "#AAF" : "#333" }]}>{blocking ? "ACTIVE!" : "Block 85%"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={{ height: insets.bottom + 4, backgroundColor: "#050008" }} />
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ARENA_H = SH * 0.38;
const A = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: "#050008" },

  scanlines: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.04,
    backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 3px)" as any,
    zIndex: 1,
  } as any,

  back:          { position: "absolute", top: 50, left: 16, zIndex: 20 },
  backIcon:      { width: 26, height: 26, borderRadius: 7 },

  // ── Intro ──────────────────────────────────────────────────────────────────
  introTitle:    { alignItems: "center", paddingTop: 60, gap: 4 },
  titleSmall:    { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#555", letterSpacing: 4 },
  titleMain:     { fontFamily: "Inter_700Bold", fontSize: 48, color: "#FFD700", letterSpacing: -2,
                   textShadowColor: "#FFD70080", textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
  titleDivider:  { width: 120, height: 2, backgroundColor: "#333", alignItems: "center", justifyContent: "center" },
  titleVS:       { fontFamily: "Inter_700Bold", fontSize: 18, color: "#888", letterSpacing: 6, marginTop: -14 },
  titleSub:      { fontFamily: "Inter_400Regular", fontSize: 10, color: "#444", letterSpacing: 5, marginTop: 8 },

  charShowcase:  { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 20 },
  charCard:      { flex: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#2A2A2A" },
  charCardGrad:  { padding: 14, alignItems: "center", gap: 4 },
  charEmoji:     { fontSize: 48 },
  charName:      { fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 1 },
  charRole:      { fontFamily: "Inter_400Regular", fontSize: 10, color: "#666" },
  charStats:     { marginTop: 6, gap: 2, width: "100%" },
  statLine:      { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#555", letterSpacing: 0.5 },

  moveLegend:    { paddingHorizontal: 20, marginTop: 14, gap: 8 },
  moveRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  moveName:      { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1, width: 110 },
  moveDesc:      { fontFamily: "Inter_400Regular", fontSize: 11, color: "#555", flex: 1 },

  startBtn:      { marginHorizontal: 24, marginTop: 20, borderRadius: 16, overflow: "hidden" },
  startBtnGrad:  { paddingVertical: 16, alignItems: "center" },
  startBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 17, color: "#000", letterSpacing: 2 },

  leaderBox:     { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  leaderTitle:   { fontFamily: "Inter_700Bold", fontSize: 11, color: "#444", letterSpacing: 3 },
  leaderRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  leaderName:    { fontFamily: "Inter_500Medium", fontSize: 13, color: "#666", flex: 1 },
  leaderScore:   { fontFamily: "Inter_700Bold", fontSize: 14, color: "#FFD700" },

  // ── HUD ───────────────────────────────────────────────────────────────────
  hud:           { flexDirection: "row", paddingHorizontal: 10, paddingBottom: 4, gap: 6, alignItems: "center" },
  hudSide:       { flex: 1, gap: 3 },
  hudName:       { fontFamily: "Inter_700Bold", fontSize: 9, color: "#FFD700", letterSpacing: 2 },
  hpTrack:       { height: 12, backgroundColor: "#1A0008", borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: "#330015" },
  hpFill:        { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6, shadowRadius: 6, shadowOpacity: 1 },
  hudHpNum:      { fontFamily: "Inter_700Bold", fontSize: 10, color: "#888" },
  roundBadge:    { width: 44, alignItems: "center" },
  roundNum:      { fontFamily: "Inter_700Bold", fontSize: 20, color: "#FFD700" },
  roundLbl:      { fontFamily: "Inter_400Regular", fontSize: 8, color: "#444", letterSpacing: 2 },

  specialRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 8, marginBottom: 4 },
  specialLbl:    { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#00BBCC", letterSpacing: 1, width: 100 },
  specialTrack:  { flex: 1, height: 8, backgroundColor: "#001822", borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: "#003344", position: "relative" },
  specialFill:   { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4,
                   backgroundColor: "#00FFFF", shadowColor: "#00FFFF", shadowRadius: 6, shadowOpacity: 1 },
  specialReady:  { position: "absolute", right: 4, top: -2, fontFamily: "Inter_700Bold", fontSize: 7, color: "#00FFFF", letterSpacing: 1 },
  specialPct:    { fontFamily: "Inter_700Bold", fontSize: 9, color: "#00FFFF", width: 30, textAlign: "right" },

  // ── Arena ─────────────────────────────────────────────────────────────────
  arena:         { height: ARENA_H, backgroundColor: "#08000F", position: "relative", overflow: "hidden",
                   borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#1A0030" },
  arenaGlowLeft: { position: "absolute", left: -60, top: "20%", width: 180, height: 180, borderRadius: 90,
                   backgroundColor: "transparent", shadowColor: "#FFD700", shadowRadius: 60, shadowOpacity: 0.25, elevation: 0 },
  arenaGlowRight:{ position: "absolute", right: -60, top: "20%", width: 180, height: 180, borderRadius: 90,
                   backgroundColor: "transparent", shadowRadius: 60, shadowOpacity: 0.3, elevation: 0 },
  floorLine:     { position: "absolute", bottom: 28, left: 0, right: 0, height: 2, backgroundColor: "#1A0030" },

  fighter:       { position: "absolute", bottom: 30, alignItems: "center" },
  fighterLeft:   { left: 20 },
  fighterRight:  { right: 20 },
  auraRing:      { position: "absolute", bottom: -8, width: 90, height: 30, borderRadius: 45,
                   borderWidth: 2, borderColor: "#FFD70040",
                   shadowColor: "#FFD700", shadowRadius: 20, shadowOpacity: 0.8 },
  fighterEmoji:  { fontSize: 72,
                   textShadowColor: "#FFD70060", textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 } },
  fighterLabel:  { fontFamily: "Inter_700Bold", fontSize: 9, color: "#FFD700", letterSpacing: 2, marginTop: 2 },
  blockShield:   { position: "absolute", fontSize: 32, top: -10, right: -20 },

  particle:      { position: "absolute", shadowRadius: 4, shadowOpacity: 1 },

  roundAnnounce: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 30 },
  roundAnnounceText:{ fontFamily: "Inter_700Bold", fontSize: 38, color: "#FFD700", letterSpacing: 8,
                   textShadowColor: "#FFD700", textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
  roundAnnounceFight:{ fontFamily: "Inter_700Bold", fontSize: 52, color: "#FFFFFF", letterSpacing: 4,
                   textShadowColor: "#fff", textShadowRadius: 30, textShadowOffset: { width: 0, height: 0 } },

  tauntBubble:   { position: "absolute", bottom: 70, left: 0, right: 0, alignItems: "center" },
  tauntText:     { fontFamily: "Inter_400Regular", fontStyle: "italic", fontSize: 12, color: "#FF6666",
                   backgroundColor: "#1A0008EE", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10,
                   borderWidth: 1, borderColor: "#8B0000" },

  hitLabelWrap:  { position: "absolute", top: ARENA_H * 0.3, left: 0, right: 0, alignItems: "center" },
  hitLabelText:  { fontFamily: "Inter_700Bold", fontSize: 22, color: "#FFD700", letterSpacing: 1,
                   textShadowColor: "#FFD700", textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },

  comboBadge:    { position: "absolute", top: 8, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  comboText:     { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff", letterSpacing: 1 },

  scoreDisplay:  { position: "absolute", top: 8, right: 12 },
  scoreNum:      { fontFamily: "Inter_700Bold", fontSize: 18, color: "#FFD700" },

  // ── Controls ──────────────────────────────────────────────────────────────
  controls:      { flex: 1, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingTop: 8, backgroundColor: "#050008" },
  atkBtn:        { flex: 1, borderRadius: 14, overflow: "hidden", borderWidth: 1 },
  atkBtnLight:   { borderColor: "#FFD70050" },
  atkBtnHeavy:   { borderColor: "#FF8C0050" },
  atkBtnDivine:  { borderColor: "#00FFFF50" },
  atkBtnBlock:   { borderColor: "#3B82F630" },
  btnGrad:       { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 2 },
  btnEmoji:      { fontSize: 22 },
  btnLabel:      { fontFamily: "Inter_700Bold", fontSize: 10, color: "#fff", letterSpacing: 1, textAlign: "center" },
  btnSub:        { fontFamily: "Inter_400Regular", fontSize: 8, color: "#aaa", textAlign: "center" },
  btnDisabled:   { opacity: 0.35 },
  btnActive:     { borderColor: "#3B82F6" },

  // ── Round win / Game over shared ──────────────────────────────────────────
  winTitle:      { fontFamily: "Inter_700Bold", fontSize: 36, color: "#00FF88", letterSpacing: 3,
                   textShadowColor: "#00FF8880", textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
  winSub:        { fontFamily: "Inter_400Regular", fontSize: 14, color: "#888", marginTop: 6 },
  winStats:      { flexDirection: "row", gap: 28, marginTop: 20, marginBottom: 8 },
  winStatItem:   { alignItems: "center" },
  winStatVal:    { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff" },
  winStatLbl:    { fontFamily: "Inter_400Regular", fontSize: 10, color: "#555", marginTop: 3 },
  nextEnemy:     { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#EF4444", marginBottom: 12, letterSpacing: 1 },
  bigScore:      { fontFamily: "Inter_700Bold", fontSize: 56, color: "#FFD700",
                   textShadowColor: "#FFD70060", textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } },
});
