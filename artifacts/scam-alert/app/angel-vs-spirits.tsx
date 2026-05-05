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
import { playSound, startMusic, stopMusic } from "@/lib/soundEngine";

const APP_ICON = require("@/assets/images/icon.png");
const { width: SW, height: SH } = Dimensions.get("window");

// ── Playable Heroes ───────────────────────────────────────────────────────────
const HEROES = [
  {
    id: "michael",   name: "ARCHANGEL",       sub: "Michael — Balanced Warrior",
    emoji: "😇",    color: "#FFD700",         glow: "#FFD70080",
    maxHp: 200,      atk: [14,22] as [number,number],
    heavy: [28,40] as [number,number],         special: [55,75] as [number,number],
    lightCd: 480,    heavyCd: 880,             specialFill: 18,
    blockPct: 0.85,  critChance: 0.12,         comboBonus: 4,
    specialName: "DIVINE BLAST",
    trait: "Balanced — perfect all-rounder",
    hp: 65, atkBar: 65, spd: 65,
  },
  {
    id: "seraph",    name: "SERAPHIM",         sub: "Seraphia — Glass Cannon",
    emoji: "🌟",    color: "#FF8C00",         glow: "#FF8C0080",
    maxHp: 155,      atk: [20,30] as [number,number],
    heavy: [38,54] as [number,number],         special: [72,92] as [number,number],
    lightCd: 520,    heavyCd: 1000,            specialFill: 22,
    blockPct: 0.70,  critChance: 0.20,         comboBonus: 5,
    specialName: "HEAVEN'S FURY",
    trait: "High damage, fragile — glass cannon",
    hp: 40, atkBar: 96, spd: 50,
  },
  {
    id: "guardian",  name: "GUARDIAN",         sub: "Azrael — Iron Shield",
    emoji: "🛡️",   color: "#3B82F6",         glow: "#3B82F680",
    maxHp: 285,      atk: [8,14] as [number,number],
    heavy: [18,28] as [number,number],         special: [40,60] as [number,number],
    lightCd: 440,    heavyCd: 780,             specialFill: 14,
    blockPct: 0.96,  critChance: 0.08,         comboBonus: 3,
    specialName: "HOLY SHIELD",
    trait: "Tank — blocks 96% of incoming damage",
    hp: 96, atkBar: 32, spd: 72,
  },
  {
    id: "cherub",    name: "CHERUB",           sub: "Amael — Speed Demon",
    emoji: "⚡",    color: "#00FFFF",         glow: "#00FFFF80",
    maxHp: 160,      atk: [10,16] as [number,number],
    heavy: [20,30] as [number,number],         special: [45,65] as [number,number],
    lightCd: 300,    heavyCd: 580,             specialFill: 20,
    blockPct: 0.75,  critChance: 0.16,         comboBonus: 8,
    specialName: "SWIFT STRIKE",
    trait: "Speed — fastest attacks, combo master",
    hp: 45, atkBar: 48, spd: 99,
  },
  {
    id: "warrior",   name: "HOLY WARRIOR",     sub: "Rafael — Battle Healer",
    emoji: "⚔️",   color: "#10B981",         glow: "#10B98180",
    maxHp: 225,      atk: [14,22] as [number,number],
    heavy: [24,36] as [number,number],         special: [50,70] as [number,number],
    lightCd: 480,    heavyCd: 860,             specialFill: 16,
    blockPct: 0.82,  critChance: 0.12,         comboBonus: 4,
    specialName: "HOLY JUDGEMENT",
    trait: "Healer — Divine Blast restores +30 HP",
    hp: 76, atkBar: 56, spd: 56,
  },
  {
    id: "knight",    name: "CELESTIAL KNIGHT", sub: "Malachai — Crit Master",
    emoji: "🔱",   color: "#A855F7",         glow: "#A855F780",
    maxHp: 200,      atk: [16,24] as [number,number],
    heavy: [30,44] as [number,number],         special: [65,85] as [number,number],
    lightCd: 550,    heavyCd: 960,             specialFill: 20,
    blockPct: 0.80,  critChance: 0.28,         comboBonus: 4,
    specialName: "CELESTIAL SMASH",
    trait: "Critical master — 28% crit chance",
    hp: 60, atkBar: 76, spd: 44,
  },
];

// ── 14 Enemy Roster ───────────────────────────────────────────────────────────
const ENEMIES = [
  { id:"wraith",   name:"SHADOW WRAITH",    emoji:"👿", hp:90,  atk:[8,14]  as [number,number], special:[20,28]  as [number,number], color:"#8B0000", glow:"#FF000060", title:"Spirit of Darkness",      taunt:"Your light ends here, Angel…" },
  { id:"plague",   name:"PLAGUE SPECTER",   emoji:"🦠", hp:112, atk:[10,16] as [number,number], special:[24,34]  as [number,number], color:"#3A5C00", glow:"#88FF0040", title:"Bringer of Pestilence",   taunt:"I shall infect your very soul!" },
  { id:"specter",  name:"DARK SPECTER",     emoji:"🔮", hp:135, atk:[12,18] as [number,number], special:[28,38]  as [number,number], color:"#4B0082", glow:"#9400D360", title:"Sorcerer of the Void",    taunt:"No prayer can save you now!" },
  { id:"shade",    name:"BLOOD SHADE",      emoji:"🩸", hp:158, atk:[14,22] as [number,number], special:[32,44]  as [number,number], color:"#7F0000", glow:"#CC000060", title:"Crimson Hunter",          taunt:"I taste your fear, Angel!" },
  { id:"fallen",   name:"FALLEN KNIGHT",    emoji:"🗡️", hp:180, atk:[16,24] as [number,number], special:[34,46]  as [number,number], color:"#2A1A00", glow:"#FF450060", title:"Corrupted Warrior",       taunt:"I was once like you… now kneel!" },
  { id:"walker",   name:"VOID WALKER",      emoji:"🌀", hp:205, atk:[18,26] as [number,number], special:[38,52]  as [number,number], color:"#001A40", glow:"#0066FF60", title:"Phantom of the Abyss",    taunt:"You cannot outrun the void!" },
  { id:"devourer", name:"SOUL DEVOURER",    emoji:"💀", hp:232, atk:[20,30] as [number,number], special:[42,58]  as [number,number], color:"#1A1A1A", glow:"#FFFFFF40", title:"Harvester of Souls",      taunt:"Your soul will feed my hunger!" },
  { id:"bone",     name:"BONE CRUSHER",     emoji:"💣", hp:260, atk:[22,32] as [number,number], special:[46,62]  as [number,number], color:"#3D2000", glow:"#FF880060", title:"Destroyer of Flesh",      taunt:"I will grind your bones to dust!" },
  { id:"chaos",    name:"CHAOS DEMON",      emoji:"🔥", hp:290, atk:[24,36] as [number,number], special:[52,68]  as [number,number], color:"#3D0000", glow:"#FF600060", title:"Herald of Destruction",   taunt:"Chaos is eternal. You are not." },
  { id:"terror",   name:"NIGHT TERROR",     emoji:"🦇", hp:325, atk:[26,38] as [number,number], special:[56,74]  as [number,number], color:"#0D0020", glow:"#6600CC60", title:"Nightmare Incarnate",     taunt:"Your nightmares are my playground!" },
  { id:"oracle",   name:"DARK ORACLE",      emoji:"🔯", hp:362, atk:[28,42] as [number,number], special:[60,80]  as [number,number], color:"#002020", glow:"#00CCCC60", title:"Prophet of Doom",         taunt:"I foresaw your death long ago!" },
  { id:"lord",     name:"NIGHTMARE LORD",   emoji:"👑", hp:400, atk:[30,46] as [number,number], special:[65,85]  as [number,number], color:"#1A1400", glow:"#CCCC0060", title:"Ruler of Dreams",         taunt:"Bow before the darkness, child!" },
  { id:"abaddon",  name:"ABADDON",          emoji:"😈", hp:480, atk:[34,50] as [number,number], special:[72,92]  as [number,number], color:"#200040", glow:"#CC00FF80", title:"⚠️ BOSS — Lord of the Abyss",       taunt:"Even God cannot stop me now!" },
  { id:"void",     name:"THE VOID KING",    emoji:"🌑", hp:620, atk:[42,62] as [number,number], special:[85,110] as [number,number], color:"#050505", glow:"#FFFFFF60", title:"⚠️ FINAL BOSS — Ruler of Darkness", taunt:"This universe belongs to the dark…" },
];

type Screen   = "intro" | "charSelect" | "fight" | "roundwin" | "gameover" | "cleared";
type Leader   = { username: string; score: number };
type Particle = { id: number; x: number; y: number; vx: number; vy: number; op: number; color: string; size: number };

const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

// ── Component ─────────────────────────────────────────────────────────────────
export default function AngelVsSpirits() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [screen,         setScreen]         = useState<Screen>("intro");
  const [selectedHeroIdx,setSelectedHeroIdx]= useState(0);
  const [round,          setRound]          = useState(0);
  const [playerHp,       setPlayerHp]       = useState(200);
  const [enemyHp,        setEnemyHp]        = useState(0);
  const [specialMeter,   setSpecialMeter]   = useState(0);
  const [combo,          setCombo]          = useState(0);
  const [maxCombo,       setMaxCombo]       = useState(0);
  const [killStreak,     setKillStreak]     = useState(0);
  const [rageMode,       setRageMode]       = useState(false);
  const [blocking,       setBlocking]       = useState(false);
  const [cooldown,       setCooldown]       = useState(false);
  const [totalScore,     setTotalScore]     = useState(0);
  const [leaders,        setLeaders]        = useState<Leader[]>([]);
  const [particles,      setParticles]      = useState<Particle[]>([]);
  const [flashColor,     setFlashColor]     = useState("transparent");
  const [hitLabel,       setHitLabel]       = useState("");
  const [enemyTaunt,     setEnemyTaunt]     = useState("");
  const [roundMsg,       setRoundMsg]       = useState("");
  const [submitting,     setSubmitting]     = useState(false);

  // ── Animated ─────────────────────────────────────────────────────────────
  const angelX       = useRef(new Animated.Value(0)).current;
  const demonX       = useRef(new Animated.Value(0)).current;
  const angelShake   = useRef(new Animated.Value(0)).current;
  const demonShake   = useRef(new Animated.Value(0)).current;
  const screenShake  = useRef(new Animated.Value(0)).current;
  const playerHpW    = useRef(new Animated.Value(1)).current;
  const enemyHpW     = useRef(new Animated.Value(1)).current;
  const specialW     = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const hitLabelOp   = useRef(new Animated.Value(0)).current;
  const hitLabelY    = useRef(new Animated.Value(0)).current;
  const angelScale   = useRef(new Animated.Value(1)).current;
  const demonScale   = useRef(new Animated.Value(1)).current;
  const tauntOp      = useRef(new Animated.Value(0)).current;
  const ragePulse    = useRef(new Animated.Value(0)).current;
  const swWave       = useRef(new Animated.Value(0)).current;
  const swOp         = useRef(new Animated.Value(0)).current;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const playerHpRef    = useRef(200);
  const enemyHpRef     = useRef(0);
  const enemyMaxHpRef  = useRef(0);
  const specialRef     = useRef(0);
  const blockingRef    = useRef(false);
  const cooldownRef    = useRef(false);
  const comboRef       = useRef(0);
  const maxComboRef    = useRef(0);
  const scoreRef       = useRef(0);
  const particleIdRef  = useRef(0);
  const enemyTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const killStreakRef   = useRef(0);
  const rageModeRef    = useRef(false);
  const heroRef        = useRef(HEROES[0]);

  const curEnemy = ENEMIES[round] ?? ENEMIES[ENEMIES.length - 1];

  useEffect(() => { heroRef.current = HEROES[selectedHeroIdx]; }, [selectedHeroIdx]);
  useEffect(() => { return () => { stopMusic(); if (enemyTimerRef.current) clearInterval(enemyTimerRef.current); }; }, []);

  // ── Rage pulse animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (rageMode) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ragePulse, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(ragePulse, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      ragePulse.setValue(0);
    }
  }, [rageMode]);

  // ── Rage detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "fight") return;
    const hero = HEROES[selectedHeroIdx];
    const isRage = playerHp > 0 && playerHp / hero.maxHp < 0.3;
    if (isRage && !rageModeRef.current) {
      rageModeRef.current = true; setRageMode(true);
      playSound("rage"); showHitLabel("🔥 RAGE MODE!");
      triggerFlash("#FF000040");
    } else if (!isRage && rageModeRef.current) {
      rageModeRef.current = false; setRageMode(false);
    }
  }, [playerHp, screen, selectedHeroIdx]);

  // ── Fetch leaders ─────────────────────────────────────────────────────────
  const fetchLeaders = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "angelScores"), orderBy("score", "desc"), limit(5)));
      setLeaders(snap.docs.map(d => d.data() as Leader));
    } catch {}
  }, []);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);

  // ── Particles ─────────────────────────────────────────────────────────────
  const spawnParticles = (x: number, y: number, color: string, count = 10) => {
    const newP: Particle[] = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const spd   = 3 + Math.random() * 6;
      return { id: particleIdRef.current++, x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd, op: 1, color, size: 4 + Math.random() * 7 };
    });
    setParticles(prev => [...prev.slice(-50), ...newP]);
    const tick = setInterval(() => {
      setParticles(prev => {
        const upd = prev.map(p => ({ ...p, x: p.x+p.vx, y: p.y+p.vy, vy: p.vy+0.32, op: p.op-0.055 })).filter(p => p.op > 0);
        if (upd.length === 0) clearInterval(tick);
        return upd;
      });
    }, 28);
  };

  // ── Visual effects ────────────────────────────────────────────────────────
  const triggerFlash = (color: string) => {
    setFlashColor(color);
    flashOpacity.setValue(0.7);
    Animated.timing(flashOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start();
  };

  const showHitLabel = (text: string) => {
    setHitLabel(text);
    hitLabelOp.setValue(1); hitLabelY.setValue(0);
    Animated.parallel([
      Animated.timing(hitLabelOp, { toValue: 0, duration: 1000, useNativeDriver: true }),
      Animated.timing(hitLabelY,  { toValue: -70, duration: 1000, useNativeDriver: true }),
    ]).start();
  };

  const triggerScreenShake = () => {
    Animated.sequence([
      Animated.timing(screenShake, { toValue: 12,  duration: 50, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 7,   duration: 50, useNativeDriver: true }),
      Animated.timing(screenShake, { toValue: 0,   duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const triggerShockwave = () => {
    swWave.setValue(0); swOp.setValue(0.8);
    Animated.parallel([
      Animated.timing(swWave, { toValue: 120, duration: 500, useNativeDriver: true }),
      Animated.timing(swOp,   { toValue: 0,   duration: 500, useNativeDriver: true }),
    ]).start();
  };

  const animateHpBar = (anim: Animated.Value, pct: number) =>
    Animated.timing(anim, { toValue: Math.max(0, pct), duration: 300, useNativeDriver: false }).start();

  const lunge = (anim: Animated.Value, toward: number) =>
    Animated.sequence([
      Animated.timing(anim, { toValue: toward, duration: 130, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0,      duration: 200, useNativeDriver: true }),
    ]).start();

  const punchScale = (anim: Animated.Value) =>
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.2,  duration: 100, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1,    duration: 160, useNativeDriver: true }),
    ]).start();

  const hitShake = (anim: Animated.Value) =>
    Animated.sequence([
      Animated.timing(anim, { toValue: 16,  duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -16, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 9,   duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();

  const showTaunt = (text: string) => {
    setEnemyTaunt(text); tauntOp.setValue(1);
    Animated.sequence([
      Animated.delay(1600),
      Animated.timing(tauntOp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  // ── Start round ───────────────────────────────────────────────────────────
  const startRound = useCallback((r: number) => {
    if (enemyTimerRef.current) clearInterval(enemyTimerRef.current);
    const enemy = ENEMIES[r];
    if (!enemy) { stopMusic(); setScreen("cleared"); return; }
    const hero = heroRef.current;
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
    setRageMode(false); rageModeRef.current = false;
    enemyHpW.setValue(1);
    specialW.setValue(0);
    animateHpBar(playerHpW, playerHpRef.current / hero.maxHp);
    setScreen("fight");
    setRound(r);
    setParticles([]);
    setRoundMsg(`ROUND ${r + 1}`);
    startMusic("battle");
    setTimeout(() => setRoundMsg(""), 1900);
    setTimeout(() => showTaunt(enemy.taunt), 2100);

    const aiDelay = Math.max(900, 2200 - r * 110);
    enemyTimerRef.current = setInterval(() => {
      if (cooldownRef.current) return;
      if (playerHpRef.current <= 0 || enemyHpRef.current <= 0) return;
      const useSpec = Math.random() < 0.28;
      const [minA, maxA] = useSpec ? enemy.special : enemy.atk;
      const rawDmg = rand(minA, maxA);
      const dmg = blockingRef.current ? Math.max(1, Math.floor(rawDmg * (1 - hero.blockPct))) : rawDmg;

      lunge(demonX, -42);
      punchScale(demonScale);
      setTimeout(() => {
        hitShake(angelShake);
        if (useSpec) { triggerFlash("#8B000050"); triggerScreenShake(); playSound("smash"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }
        else { playSound("enemyHit"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
        spawnParticles(75, SH * 0.43, blockingRef.current ? "#3B82F6" : "#EF4444", blockingRef.current ? 5 : 14);
        const newHp = Math.max(0, playerHpRef.current - dmg);
        playerHpRef.current = newHp;
        setPlayerHp(newHp);
        animateHpBar(playerHpW, newHp / hero.maxHp);
        if (blockingRef.current) {
          playSound("block");
          showHitLabel("🛡️ BLOCKED!");
          setBlocking(false); blockingRef.current = false;
        } else {
          showHitLabel(useSpec ? `💥 -${dmg} DARK STRIKE!` : `-${dmg}`);
          comboRef.current = 0; setCombo(0);
        }
        if (newHp <= 0) {
          if (enemyTimerRef.current) clearInterval(enemyTimerRef.current);
          stopMusic(); playSound("defeat");
          setTimeout(saveAndEnd, 500);
        }
      }, 200);
    }, aiDelay);
  }, []);

  // ── Player attack ─────────────────────────────────────────────────────────
  const doAttack = useCallback((type: "light" | "heavy" | "divine") => {
    if (cooldownRef.current || enemyHpRef.current <= 0 || playerHpRef.current <= 0) return;
    const hero = heroRef.current;
    if (type === "divine" && specialRef.current < 100) return;

    cooldownRef.current = true; setCooldown(true);
    const cd = type === "light" ? hero.lightCd : type === "heavy" ? hero.heavyCd : 700;

    lunge(angelX, 42);
    punchScale(angelScale);

    let baseDmg: number, specialGain: number, label: string, flashC: string;
    if (type === "light")       { baseDmg = rand(...hero.atk);    specialGain = hero.specialFill;      label = "HOLY STRIKE"; flashC = "#FFD70030"; }
    else if (type === "heavy")  { baseDmg = rand(...hero.heavy);   specialGain = hero.specialFill + 12; label = "SMITE!";      flashC = "#FFD70055"; }
    else                        { baseDmg = rand(...hero.special); specialGain = 0;                    label = hero.specialName; flashC = "#FFFFFF80"; }

    const isCrit      = Math.random() < hero.critChance;
    const rageBonus   = rageModeRef.current ? 1.5 : 1;
    comboRef.current++;
    if (comboRef.current > maxComboRef.current) { maxComboRef.current = comboRef.current; setMaxCombo(comboRef.current); }
    const comboBonus  = Math.floor((comboRef.current - 1) * hero.comboBonus);
    const finalDmg    = Math.floor((baseDmg + comboBonus) * rageBonus * (isCrit ? 2.0 : 1));

    setTimeout(() => {
      hitShake(demonShake);
      if (type === "divine") {
        triggerFlash("#FFFFFF90"); triggerScreenShake(); triggerShockwave();
        playSound("blast"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === "heavy") {
        triggerFlash(isCrit ? "#FFFFFF70" : flashC); triggerScreenShake(); triggerShockwave();
        playSound("smash"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else {
        triggerFlash(isCrit ? "#FFFFFF50" : flashC);
        playSound("punch"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      spawnParticles(SW - 75, SH * 0.43,
        isCrit ? "#FFFFFF" : type === "divine" ? "#FFD700" : "#AAAAFF",
        type === "divine" ? 24 : type === "heavy" ? 16 : isCrit ? 14 : 9,
      );

      const newEnemyHp = Math.max(0, enemyHpRef.current - finalDmg);
      enemyHpRef.current = newEnemyHp;
      setEnemyHp(newEnemyHp);
      animateHpBar(enemyHpW, newEnemyHp / enemyMaxHpRef.current);

      const newSpecial = type === "divine" ? 0 : Math.min(100, specialRef.current + specialGain);
      specialRef.current = newSpecial;
      setSpecialMeter(newSpecial);
      Animated.timing(specialW, { toValue: newSpecial / 100, duration: 300, useNativeDriver: false }).start();

      // Warrior heal on divine
      if (type === "divine" && hero.id === "warrior") {
        const healed = Math.min(hero.maxHp, playerHpRef.current + 30);
        playerHpRef.current = healed;
        setPlayerHp(healed);
        animateHpBar(playerHpW, healed / hero.maxHp);
        showHitLabel(`${hero.specialName} -${finalDmg} ❤️+30`);
      } else if (isCrit) {
        playSound("combo");
        showHitLabel(`⚡ CRITICAL! -${finalDmg}!`);
      } else {
        const comboTxt = comboRef.current >= 3 ? ` ×${comboRef.current}!` : "";
        showHitLabel(`${label} -${finalDmg}${comboTxt}`);
      }
      if (comboRef.current >= 3) playSound("combo");

      scoreRef.current += Math.floor(finalDmg * (1 + comboRef.current * 0.5) * (isCrit ? 1.5 : 1));
      setTotalScore(scoreRef.current);
      setCombo(comboRef.current);

      if (newEnemyHp <= 0) {
        if (enemyTimerRef.current) clearInterval(enemyTimerRef.current);
        comboRef.current = 0; setCombo(0);
        // Kill streak
        killStreakRef.current++;
        const ks = killStreakRef.current;
        setKillStreak(ks);
        playSound("victory");
        if      (ks >= 10) setTimeout(() => showHitLabel("🌟 GODLIKE!"),       300);
        else if (ks >=  8) setTimeout(() => showHitLabel("✨ DIVINE FURY!"),    300);
        else if (ks >=  5) setTimeout(() => showHitLabel("⚡ UNSTOPPABLE!"),    300);
        else if (ks >=  3) setTimeout(() => showHitLabel("🔥 ON FIRE!"),        300);

        const nextRound = round + 1;
        if (nextRound >= ENEMIES.length) {
          stopMusic();
          setTimeout(() => setScreen("cleared"), 700);
        } else {
          stopMusic();
          setTimeout(() => setScreen("roundwin"), 700);
        }
      }
    }, 200);

    setTimeout(() => { cooldownRef.current = false; setCooldown(false); }, cd);
  }, [round]);

  const doBlock = useCallback(() => {
    if (cooldownRef.current) return;
    playSound("block"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBlocking(true); blockingRef.current = true;
    showHitLabel("🛡️ GUARD UP");
    setTimeout(() => { if (blockingRef.current) { setBlocking(false); blockingRef.current = false; } }, 2500);
  }, []);

  const nextRound = useCallback(() => {
    const hero = heroRef.current;
    const heal = Math.min(hero.maxHp, playerHpRef.current + 65);
    playerHpRef.current = heal;
    startRound(round + 1);
  }, [round, startRound]);

  const saveAndEnd = async () => {
    setScreen("gameover");
    const final = scoreRef.current;
    if (!user || final === 0) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "angelScores"), { userId: user.uid, username: profile?.username ?? "Angel", score: final, createdAt: serverTimestamp() });
      await fetchLeaders();
    } catch {}
    setSubmitting(false);
  };

  const saveClearedScore = async () => {
    const final = scoreRef.current + 5000;
    setTotalScore(final);
    if (!user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "angelScores"), { userId: user.uid, username: profile?.username ?? "Angel", score: final, createdAt: serverTimestamp() });
      await fetchLeaders();
    } catch {}
    setSubmitting(false);
  };

  useEffect(() => { if (screen === "cleared") saveClearedScore(); }, [screen]);

  const resetGame = () => {
    const hero = HEROES[selectedHeroIdx];
    playerHpRef.current = hero.maxHp;
    scoreRef.current = 0; maxComboRef.current = 0;
    killStreakRef.current = 0;
    setTotalScore(0); setMaxCombo(0); setKillStreak(0);
    startRound(0);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // INTRO SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "intro") {
    return (
      <LinearGradient colors={["#000000","#100020","#000000"]} style={[F.screen, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={F.back}>
          <Image source={APP_ICON} style={F.backIcon} resizeMode="cover" />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ gap: 0 }} showsVerticalScrollIndicator={false}>
          <View style={F.introTitle}>
            <Text style={F.titleSmall}>⚔️  DIVINE BATTLE  ⚔️</Text>
            <Text style={F.titleMain}>ANGEL</Text>
            <Text style={F.titleVS}>VS</Text>
            <Text style={[F.titleMain, { color: "#8B0000", textShadowColor: "#FF000080" }]}>SPIRITS</Text>
            <Text style={F.titleSub}>THE ETERNAL CONFLICT • 14 ENEMIES • 6 CHAMPIONS</Text>
          </View>
          <View style={F.introRow}>
            {[
              { e:"😇", l:"6 Champions", s:"Choose your fighter" },
              { e:"👿", l:"14 Enemies",  s:"Increasing difficulty" },
              { e:"🔥", l:"Rage Mode",   s:"Low HP power surge" },
              { e:"⚡", l:"Crits",       s:"Up to 28% chance" },
            ].map(x => (
              <View key={x.l} style={F.introFeature}>
                <Text style={{ fontSize: 22 }}>{x.e}</Text>
                <Text style={F.introFeatureTitle}>{x.l}</Text>
                <Text style={F.introFeatureSub}>{x.s}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={F.startBtn} onPress={() => setScreen("charSelect")}>
            <LinearGradient colors={["#FFD700","#FF8C00"]} style={F.startBtnGrad}>
              <Text style={F.startBtnTxt}>SELECT CHAMPION</Text>
            </LinearGradient>
          </TouchableOpacity>
          {leaders.length > 0 && (
            <View style={F.leaderBox}>
              <Text style={F.leaderTitle}>🏆  HALL OF CHAMPIONS</Text>
              {leaders.map((l, i) => (
                <View key={i} style={F.leaderRow}>
                  <Text style={{ fontSize: 16, width: 26 }}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                  <Text style={F.leaderName}>{l.username}</Text>
                  <Text style={F.leaderScore}>{l.score.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      </LinearGradient>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHARACTER SELECT
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "charSelect") {
    const hero = HEROES[selectedHeroIdx];
    return (
      <LinearGradient colors={["#000000","#080018","#000000"]} style={[F.screen, { paddingTop: insets.top }]}>
        <View style={F.csHeader}>
          <TouchableOpacity onPress={() => setScreen("intro")}>
            <Text style={{ color: "#555", fontSize: 14 }}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={F.csTitle}>SELECT CHAMPION</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={F.csGrid} showsVerticalScrollIndicator={false}>
          {HEROES.map((h, i) => (
            <TouchableOpacity
              key={h.id}
              style={[F.csCard, selectedHeroIdx === i && { borderColor: h.color, borderWidth: 2 }]}
              onPress={() => { setSelectedHeroIdx(i); heroRef.current = HEROES[i]; playSound("click"); }}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[h.color + "18", "#00000000"]} style={F.csCardGrad}>
                {selectedHeroIdx === i && (
                  <View style={[F.csSelected, { backgroundColor: h.color }]}>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 9, color: "#000", letterSpacing: 1 }}>SELECTED</Text>
                  </View>
                )}
                <Text style={[F.csEmoji, { textShadowColor: h.glow, textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 } }]}>{h.emoji}</Text>
                <Text style={[F.csName, { color: h.color }]}>{h.name}</Text>
                <Text style={F.csSub}>{h.sub}</Text>
                {[["HP",h.hp,"#10B981"],["ATK",h.atkBar,"#EF4444"],["SPD",h.spd,"#3B82F6"]].map(([lbl, val, col]) => (
                  <View key={lbl as string} style={F.csBarRow}>
                    <Text style={F.csBarLbl}>{lbl as string}</Text>
                    <View style={F.csBarTrack}>
                      <View style={[F.csBarFill, { width: `${val}%` as any, backgroundColor: col as string, shadowColor: col as string }]} />
                    </View>
                  </View>
                ))}
                <View style={[F.csSpecialBadge, { borderColor: h.color + "60", backgroundColor: h.color + "15" }]}>
                  <Text style={[F.csSpecialTxt, { color: h.color }]}>✨ {h.specialName}</Text>
                </View>
                <Text style={F.csTrait}>{h.trait}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={[F.csBattle, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity style={F.startBtn} onPress={() => {
            playerHpRef.current = hero.maxHp;
            scoreRef.current = 0; maxComboRef.current = 0; killStreakRef.current = 0;
            setTotalScore(0); setMaxCombo(0); setKillStreak(0);
            startRound(0);
          }}>
            <LinearGradient colors={[hero.color, hero.color + "AA"]} style={F.startBtnGrad}>
              <Text style={F.startBtnTxt}>{hero.emoji}  ENTER BATTLE  {hero.emoji}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ROUND WIN
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "roundwin") {
    const enemy = ENEMIES[round];
    const hero  = HEROES[selectedHeroIdx];
    return (
      <LinearGradient colors={["#000000","#001800","#000000"]} style={[F.screen, { alignItems:"center", justifyContent:"center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 80 }}>{hero.emoji}</Text>
        <Text style={F.winTitle}>VICTORY!</Text>
        <Text style={[F.winSub, { color: "#777" }]}>{enemy.name} has been banished</Text>
        <View style={F.winStats}>
          <View style={F.winStatItem}><Text style={F.winStatVal}>{playerHpRef.current}</Text><Text style={F.winStatLbl}>HP Left</Text></View>
          <View style={F.winStatItem}><Text style={[F.winStatVal, { color:"#FFD700" }]}>{totalScore.toLocaleString()}</Text><Text style={F.winStatLbl}>Score</Text></View>
          <View style={F.winStatItem}><Text style={[F.winStatVal, { color:"#00FFFF" }]}>{maxCombo}×</Text><Text style={F.winStatLbl}>Combo</Text></View>
          <View style={F.winStatItem}><Text style={[F.winStatVal, { color:"#FF8C00" }]}>{killStreak}</Text><Text style={F.winStatLbl}>Streak</Text></View>
        </View>
        {round + 1 < ENEMIES.length && (
          <View style={F.nextEnemyBox}>
            <Text style={F.nextEnemyLbl}>NEXT OPPONENT</Text>
            <Text style={[F.nextEnemyName, { color: ENEMIES[round+1].color === "#050505" ? "#aaa" : ENEMIES[round+1].color }]}>
              {ENEMIES[round+1].emoji}  {ENEMIES[round+1].name}
            </Text>
            <Text style={F.nextEnemyTitle}>{ENEMIES[round+1].title}</Text>
          </View>
        )}
        <TouchableOpacity style={[F.startBtn, { marginTop: 20 }]} onPress={nextRound}>
          <LinearGradient colors={["#FFD700","#FF8C00"]} style={F.startBtnGrad}>
            <Text style={F.startBtnTxt}>{round+1 >= ENEMIES.length ? "FINAL BATTLE ⚔️" : "FIGHT ON  ⚔️"}</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={{ color:"#444", fontSize:11, marginTop:10 }}>+65 HP healed before next fight</Text>
      </LinearGradient>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GAME OVER
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "gameover") {
    const hero = HEROES[selectedHeroIdx];
    return (
      <LinearGradient colors={["#000000","#1A0000","#000000"]} style={[F.screen, { alignItems:"center", justifyContent:"center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 80 }}>{hero.emoji}</Text>
        <Text style={[F.winTitle, { color:"#EF4444" }]}>DEFEATED</Text>
        <Text style={[F.winSub, { color:"#555" }]}>Fell on Round {round+1} vs {curEnemy.name}</Text>
        <View style={F.winStats}>
          <View style={F.winStatItem}><Text style={[F.winStatVal, { color:"#FFD700" }]}>{totalScore.toLocaleString()}</Text><Text style={F.winStatLbl}>Score</Text></View>
          <View style={F.winStatItem}><Text style={[F.winStatVal, { color:"#00FFFF" }]}>{maxCombo}×</Text><Text style={F.winStatLbl}>Best Combo</Text></View>
          <View style={F.winStatItem}><Text style={[F.winStatVal, { color:"#FF8C00" }]}>{killStreak}</Text><Text style={F.winStatLbl}>Streak</Text></View>
        </View>
        {submitting && <Text style={{ color:"#555", fontSize:12, marginTop:8 }}>Saving score…</Text>}
        <View style={{ flexDirection:"row", gap:12, marginTop:28 }}>
          <TouchableOpacity style={F.startBtn} onPress={resetGame}>
            <LinearGradient colors={["#FFD700","#FF8C00"]} style={F.startBtnGrad}>
              <Text style={F.startBtnTxt}>RETRY</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={F.startBtn} onPress={() => setScreen("charSelect")}>
            <LinearGradient colors={["#222","#111"]} style={F.startBtnGrad}>
              <Text style={F.startBtnTxt}>CHARACTERS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {leaders.length > 0 && (
          <View style={[F.leaderBox, { marginTop:24 }]}>
            <Text style={F.leaderTitle}>🏆  HALL OF CHAMPIONS</Text>
            {leaders.map((l, i) => (
              <View key={i} style={F.leaderRow}>
                <Text style={{ fontSize:16, width:26 }}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={F.leaderName}>{l.username}</Text>
                <Text style={F.leaderScore}>{l.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CLEARED
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === "cleared") {
    const hero = HEROES[selectedHeroIdx];
    return (
      <LinearGradient colors={["#000000","#1A1200","#000000"]} style={[F.screen, { alignItems:"center", justifyContent:"center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 90 }}>👼</Text>
        <Text style={[F.winTitle, { color:"#FFD700" }]}>LIGHT TRIUMPHS!</Text>
        <Text style={[F.winSub, { color:"#FFD70099", textAlign:"center" }]}>All 14 spirits vanquished.{"\n"}You have saved the realm.</Text>
        <Text style={[F.bigScore, { marginTop:20 }]}>{totalScore.toLocaleString()}</Text>
        <Text style={{ color:"#888", fontSize:12 }}>+5000 Completion Bonus included</Text>
        <View style={{ flexDirection:"row", gap:12, marginTop:28 }}>
          <TouchableOpacity style={F.startBtn} onPress={() => setScreen("charSelect")}>
            <LinearGradient colors={["#FFD700","#FF8C00"]} style={F.startBtnGrad}>
              <Text style={F.startBtnTxt}>PLAY AGAIN</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={F.startBtn} onPress={() => setScreen("intro")}>
            <LinearGradient colors={["#222","#111"]} style={F.startBtnGrad}>
              <Text style={F.startBtnTxt}>MENU</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FIGHT SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  const enemy    = ENEMIES[round];
  const hero     = HEROES[selectedHeroIdx];
  const pHpPct   = playerHp / hero.maxHp;
  const eHpPct   = enemyHp / (enemyMaxHpRef.current || 1);

  return (
    <Animated.View style={[F.screen, { transform:[{ translateX: screenShake }] }]}>
      <LinearGradient colors={["#050008","#0A0015","#14001C","#050008"]} style={StyleSheet.absoluteFill} />
      {/* Flash */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: flashColor, opacity: flashOpacity, zIndex:50 }]} />
      {/* Rage tint */}
      {rageMode && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor:"#FF000015", opacity: ragePulse, zIndex:51 }]} />
      )}

      {/* ── HUD ─────────────────────────────────────────────────────────── */}
      <View style={[F.hud, { paddingTop: insets.top + 4 }]}>
        <View style={F.hudSide}>
          <Text style={[F.hudName, { color: hero.color }]}>{hero.name}</Text>
          <View style={F.hpTrack}>
            <Animated.View style={[F.hpFill, {
              width: playerHpW.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }),
              backgroundColor: pHpPct > 0.5 ? "#00FF88" : pHpPct > 0.25 ? "#FFD700" : "#EF4444",
              shadowColor: rageMode ? "#FF0000" : "#00FF88",
            }]} />
          </View>
          <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
            <Text style={F.hudHpNum}>{playerHp}/{hero.maxHp}</Text>
            {rageMode && <Text style={{ fontFamily:"Inter_700Bold", fontSize:9, color:"#FF4444", letterSpacing:1 }}>RAGE</Text>}
          </View>
        </View>

        <View style={F.roundBadge}>
          <Text style={F.roundNum}>{round+1}</Text>
          <Text style={F.roundLbl}>/{ENEMIES.length}</Text>
        </View>

        <View style={[F.hudSide, { alignItems:"flex-end" }]}>
          <Text style={[F.hudName, { color: enemy.color === "#050505" ? "#aaa" : enemy.color, textAlign:"right" }]}>{enemy.name}</Text>
          <View style={[F.hpTrack, { transform:[{ scaleX:-1 }] }]}>
            <Animated.View style={[F.hpFill, {
              width: enemyHpW.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }),
              backgroundColor: eHpPct > 0.5 ? "#EF4444" : eHpPct > 0.25 ? "#F97316" : "#FFD700",
              shadowColor:"#EF4444",
            }]} />
          </View>
          <Text style={[F.hudHpNum, { textAlign:"right" }]}>{enemyHp}</Text>
        </View>
      </View>

      {/* Special meter */}
      <View style={F.specialRow}>
        <Text style={F.specialLbl}>✨ {hero.specialName}</Text>
        <View style={F.specialTrack}>
          <Animated.View style={[F.specialFill, { width: specialW.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} />
          {specialMeter >= 100 && <Text style={F.specialReady}>READY!</Text>}
        </View>
        <Text style={F.specialPct}>{specialMeter}%</Text>
      </View>

      {/* ── ARENA ───────────────────────────────────────────────────────── */}
      <View style={F.arena}>
        {/* Ambient stars */}
        {[...Array(25)].map((_,i) => (
          <View key={i} style={[F.star, { left:(i*43+7)%SW, top:(i*67+11)%(ARENA_H-4), opacity:(i%4)*0.07+0.04 }]} />
        ))}
        <View style={[F.arenaGlowL, { shadowColor: hero.glow }]} />
        <View style={[F.arenaGlowR, { shadowColor: enemy.glow }]} />
        <View style={F.floorLine} />

        {/* Shockwave */}
        <Animated.View pointerEvents="none" style={[F.shockwave, {
          opacity: swOp,
          transform:[{ scale: swWave.interpolate({ inputRange:[0,120], outputRange:[0,3] }) }],
        }]} />

        {/* ANGEL */}
        <Animated.View style={[F.fighter, F.fighterL, {
          transform:[{ translateX: Animated.add(angelX, angelShake) }, { scale: angelScale }],
        }]}>
          <Animated.View style={[F.auraRing, { borderColor: hero.color + "50", shadowColor: hero.color,
            opacity: rageMode ? ragePulse.interpolate({ inputRange:[0,1], outputRange:[0.5,1] }) : 0.6,
          }]} />
          <Text style={[F.fighterEmoji, { textShadowColor: hero.glow, textShadowRadius: 20, textShadowOffset:{width:0,height:0} }]}>{hero.emoji}</Text>
          {blocking && <Text style={F.blockShield}>🛡️</Text>}
          <Text style={[F.fighterLabel, { color: hero.color }]}>{hero.name.split(" ")[0]}</Text>
        </Animated.View>

        {/* DEMON */}
        <Animated.View style={[F.fighter, F.fighterR, {
          transform:[{ translateX: Animated.add(demonX, demonShake) }, { scale: demonScale }],
        }]}>
          <View style={[F.auraRing, { borderColor: enemy.glow, shadowColor: enemy.glow }]} />
          <Text style={[F.fighterEmoji, { textShadowColor: enemy.glow, textShadowRadius: 20, textShadowOffset:{width:0,height:0} }]}>{enemy.emoji}</Text>
          <Text style={[F.fighterLabel, { color:"#FF6666" }]}>{enemy.name.split(" ")[0]}</Text>
        </Animated.View>

        {/* Particles */}
        {particles.map(p => (
          <Animated.View key={p.id} style={[F.particle, { left:p.x, top:p.y, width:p.size, height:p.size, borderRadius:p.size/2, backgroundColor:p.color, opacity:p.op }]} />
        ))}

        {/* Round announce */}
        {roundMsg !== "" && (
          <View style={F.roundAnnounce}>
            <Text style={F.roundAnnounceText}>{roundMsg}</Text>
            <Text style={F.roundAnnounceFight}>FIGHT!</Text>
          </View>
        )}

        {/* Taunt */}
        <Animated.View style={[F.tauntBubble, { opacity: tauntOp }]}>
          <Text style={F.tauntText}>"{enemyTaunt}"</Text>
        </Animated.View>

        {/* Hit label */}
        <Animated.View style={[F.hitLabelWrap, { opacity: hitLabelOp, transform:[{ translateY: hitLabelY }] }]}>
          <Text style={F.hitLabelText}>{hitLabel}</Text>
        </Animated.View>

        {/* Combo */}
        {combo >= 2 && (
          <View style={[F.comboBadge, { backgroundColor: combo >= 8 ? "#FFD700" : combo >= 5 ? "#FF6B00" : "#7C3AED" }]}>
            <Text style={F.comboText}>{combo}× COMBO{rageMode ? " 🔥" : ""}</Text>
          </View>
        )}

        {/* Kill streak */}
        {killStreak >= 3 && (
          <View style={F.streakBadge}>
            <Text style={F.streakText}>
              {killStreak >= 10 ? "🌟" : killStreak >= 8 ? "✨" : killStreak >= 5 ? "⚡" : "🔥"} ×{killStreak} STREAK
            </Text>
          </View>
        )}

        {/* Score */}
        <View style={F.scoreDisplay}><Text style={F.scoreNum}>{totalScore.toLocaleString()}</Text></View>
      </View>

      {/* ── CONTROLS ────────────────────────────────────────────────────── */}
      <View style={F.controls}>
        <TouchableOpacity style={[F.atkBtn, F.atkBtnL, cooldown && F.btnOff]} onPress={() => doAttack("light")} activeOpacity={0.7} disabled={cooldown}>
          <LinearGradient colors={["#FFD700","#CC9900"]} style={F.btnGrad}>
            <Text style={F.btnEmoji}>⚡</Text>
            <Text style={F.btnLabel}>HOLY STRIKE</Text>
            <Text style={F.btnSub}>Fast · +{hero.specialFill} power</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={[F.atkBtn, F.atkBtnH, cooldown && F.btnOff]} onPress={() => doAttack("heavy")} activeOpacity={0.7} disabled={cooldown}>
          <LinearGradient colors={["#FF8C00","#CC4400"]} style={F.btnGrad}>
            <Text style={F.btnEmoji}>🔨</Text>
            <Text style={F.btnLabel}>SMITE</Text>
            <Text style={F.btnSub}>Heavy · shake</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[F.atkBtn, F.atkBtnD, (specialMeter < 100 || cooldown) && F.btnOff]}
          onPress={() => doAttack("divine")} activeOpacity={0.7} disabled={specialMeter < 100 || cooldown}
        >
          <LinearGradient colors={specialMeter >= 100 ? ["#00FFFF","#0055FF"] : ["#111","#0A0A0A"]} style={F.btnGrad}>
            <Text style={F.btnEmoji}>✨</Text>
            <Text style={[F.btnLabel, { color: specialMeter >= 100 ? "#fff" : "#333" }]}>{hero.specialName.split(" ")[0]}</Text>
            <Text style={[F.btnSub, { color: specialMeter >= 100 ? "#BBF" : "#222" }]}>{specialMeter >= 100 ? "UNLEASH!" : `${specialMeter}%`}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={[F.atkBtn, F.atkBtnB, blocking && F.btnActive]} onPress={doBlock} activeOpacity={0.7}>
          <LinearGradient colors={blocking ? ["#3B82F6","#1D4ED8"] : ["#1A2040","#111828"]} style={F.btnGrad}>
            <Text style={F.btnEmoji}>🛡️</Text>
            <Text style={[F.btnLabel, { color: blocking ? "#fff" : "#555" }]}>GUARD</Text>
            <Text style={[F.btnSub, { color: blocking ? "#AAF" : "#333" }]}>{blocking ? "ACTIVE!" : `${Math.round(hero.blockPct*100)}% block`}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <View style={{ height: insets.bottom + 4, backgroundColor:"#050008" }} />
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ARENA_H = SH * 0.36;

const F = StyleSheet.create({
  screen:     { flex:1, backgroundColor:"#050008" },
  back:       { position:"absolute", top:50, left:16, zIndex:20 },
  backIcon:   { width:26, height:26, borderRadius:7 },

  // ── Intro ──────────────────────────────────────────────────────────────────
  introTitle: { alignItems:"center", paddingTop:60, paddingBottom:20, gap:4 },
  titleSmall: { fontFamily:"Inter_600SemiBold", fontSize:10, color:"#555", letterSpacing:4 },
  titleMain:  { fontFamily:"Inter_700Bold", fontSize:50, color:"#FFD700", letterSpacing:-2,
                textShadowColor:"#FFD70080", textShadowRadius:24, textShadowOffset:{width:0,height:0} },
  titleVS:    { fontFamily:"Inter_700Bold", fontSize:20, color:"#555", letterSpacing:8 },
  titleSub:   { fontFamily:"Inter_400Regular", fontSize:9, color:"#444", letterSpacing:3, marginTop:6, textAlign:"center" },
  introRow:   { flexDirection:"row", justifyContent:"space-around", paddingHorizontal:16, marginBottom:20 },
  introFeature:     { alignItems:"center", gap:3 },
  introFeatureTitle:{ fontFamily:"Inter_700Bold", fontSize:11, color:"#FFD700", letterSpacing:0.5 },
  introFeatureSub:  { fontFamily:"Inter_400Regular", fontSize:9, color:"#555", textAlign:"center" },

  // ── Char select ────────────────────────────────────────────────────────────
  csHeader:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:12 },
  csTitle:     { fontFamily:"Inter_700Bold", fontSize:15, color:"#FFD700", letterSpacing:2 },
  csGrid:      { flexDirection:"row", flexWrap:"wrap", paddingHorizontal:10, gap:10, paddingBottom:100 },
  csCard:      { width:(SW-30)/2, borderRadius:18, overflow:"hidden", borderWidth:1, borderColor:"#2A2A2A", position:"relative" },
  csCardGrad:  { padding:14, gap:6, alignItems:"center" },
  csSelected:  { position:"absolute", top:10, right:10, paddingHorizontal:6, paddingVertical:3, borderRadius:8 },
  csEmoji:     { fontSize:52 },
  csName:      { fontFamily:"Inter_700Bold", fontSize:13, letterSpacing:1, textAlign:"center" },
  csSub:       { fontFamily:"Inter_400Regular", fontSize:9, color:"#666", textAlign:"center" },
  csBarRow:    { flexDirection:"row", alignItems:"center", gap:6, width:"100%" },
  csBarLbl:    { fontFamily:"Inter_700Bold", fontSize:9, color:"#555", width:24 },
  csBarTrack:  { flex:1, height:6, backgroundColor:"#1A1A2E", borderRadius:3, overflow:"hidden" },
  csBarFill:   { position:"absolute", left:0, top:0, bottom:0, borderRadius:3, shadowRadius:4, shadowOpacity:0.8 },
  csSpecialBadge:{ alignSelf:"stretch", padding:6, borderRadius:10, borderWidth:1, alignItems:"center", marginTop:2 },
  csSpecialTxt:  { fontFamily:"Inter_700Bold", fontSize:9, letterSpacing:1 },
  csTrait:     { fontFamily:"Inter_400Regular", fontSize:9, color:"#555", textAlign:"center", fontStyle:"italic" },
  csBattle:    { position:"absolute", bottom:0, left:0, right:0, padding:16, backgroundColor:"#050008EE" },

  // ── Shared buttons ─────────────────────────────────────────────────────────
  startBtn:    { marginHorizontal:24, borderRadius:16, overflow:"hidden" },
  startBtnGrad:{ paddingVertical:16, alignItems:"center" },
  startBtnTxt: { fontFamily:"Inter_700Bold", fontSize:17, color:"#000", letterSpacing:2 },

  leaderBox:   { paddingHorizontal:20, paddingTop:14, gap:8 },
  leaderTitle: { fontFamily:"Inter_700Bold", fontSize:10, color:"#444", letterSpacing:3 },
  leaderRow:   { flexDirection:"row", alignItems:"center", gap:10 },
  leaderName:  { fontFamily:"Inter_500Medium", fontSize:13, color:"#666", flex:1 },
  leaderScore: { fontFamily:"Inter_700Bold", fontSize:14, color:"#FFD700" },

  // ── HUD ────────────────────────────────────────────────────────────────────
  hud:         { flexDirection:"row", paddingHorizontal:10, paddingBottom:4, gap:6, alignItems:"center", backgroundColor:"#050008" },
  hudSide:     { flex:1, gap:2 },
  hudName:     { fontFamily:"Inter_700Bold", fontSize:8, letterSpacing:1.5 },
  hpTrack:     { height:10, backgroundColor:"#1A0008", borderRadius:5, overflow:"hidden", borderWidth:1, borderColor:"#330015" },
  hpFill:      { position:"absolute", left:0, top:0, bottom:0, borderRadius:5, shadowRadius:5, shadowOpacity:1 },
  hudHpNum:    { fontFamily:"Inter_700Bold", fontSize:9, color:"#666" },
  roundBadge:  { width:40, alignItems:"center" },
  roundNum:    { fontFamily:"Inter_700Bold", fontSize:20, color:"#FFD700" },
  roundLbl:    { fontFamily:"Inter_400Regular", fontSize:8, color:"#444" },

  specialRow:  { flexDirection:"row", alignItems:"center", paddingHorizontal:10, gap:6, marginBottom:2, backgroundColor:"#050008" },
  specialLbl:  { fontFamily:"Inter_600SemiBold", fontSize:8, color:"#00BBCC", letterSpacing:0.5, width:96 },
  specialTrack:{ flex:1, height:7, backgroundColor:"#001822", borderRadius:4, overflow:"hidden", borderWidth:1, borderColor:"#003344", position:"relative" },
  specialFill: { position:"absolute", left:0, top:0, bottom:0, borderRadius:4, backgroundColor:"#00FFFF", shadowColor:"#00FFFF", shadowRadius:6, shadowOpacity:1 },
  specialReady:{ position:"absolute", right:3, top:-2, fontFamily:"Inter_700Bold", fontSize:7, color:"#00FFFF", letterSpacing:1 },
  specialPct:  { fontFamily:"Inter_700Bold", fontSize:9, color:"#00FFFF", width:28, textAlign:"right" },

  // ── Arena ──────────────────────────────────────────────────────────────────
  arena:       { height:ARENA_H, backgroundColor:"#08000F", position:"relative", overflow:"hidden", borderTopWidth:1, borderBottomWidth:1, borderColor:"#1A0030" },
  star:        { position:"absolute", width:2, height:2, backgroundColor:"#fff", borderRadius:1 },
  arenaGlowL:  { position:"absolute", left:-50, top:"15%", width:160, height:160, borderRadius:80, backgroundColor:"transparent", shadowRadius:50, shadowOpacity:0.22, elevation:0 },
  arenaGlowR:  { position:"absolute", right:-50, top:"15%", width:160, height:160, borderRadius:80, backgroundColor:"transparent", shadowRadius:50, shadowOpacity:0.28, elevation:0 },
  floorLine:   { position:"absolute", bottom:28, left:0, right:0, height:2, backgroundColor:"#1A0030" },
  shockwave:   { position:"absolute", left:SW*0.55-60, top:ARENA_H*0.5-60, width:120, height:120, borderRadius:60, borderWidth:3, borderColor:"#FFD700", backgroundColor:"transparent" },

  fighter:     { position:"absolute", bottom:28, alignItems:"center" },
  fighterL:    { left:14 },
  fighterR:    { right:14 },
  auraRing:    { position:"absolute", bottom:-6, width:80, height:24, borderRadius:40, borderWidth:2, shadowRadius:18, shadowOpacity:0.9, borderColor:"#FFD70040" },
  fighterEmoji:{ fontSize:68 },
  fighterLabel:{ fontFamily:"Inter_700Bold", fontSize:8, letterSpacing:2, marginTop:1, color:"#FFD700" },
  blockShield: { position:"absolute", fontSize:28, top:-8, right:-16 },
  particle:    { position:"absolute" },

  roundAnnounce:     { position:"absolute", top:0, left:0, right:0, bottom:0, alignItems:"center", justifyContent:"center", zIndex:30 },
  roundAnnounceText: { fontFamily:"Inter_700Bold", fontSize:36, color:"#FFD700", letterSpacing:8, textShadowColor:"#FFD700", textShadowRadius:24, textShadowOffset:{width:0,height:0} },
  roundAnnounceFight:{ fontFamily:"Inter_700Bold", fontSize:52, color:"#FFFFFF", letterSpacing:4, textShadowColor:"#fff", textShadowRadius:32, textShadowOffset:{width:0,height:0} },

  tauntBubble:{ position:"absolute", bottom:62, left:0, right:0, alignItems:"center" },
  tauntText:  { fontFamily:"Inter_400Regular", fontStyle:"italic", fontSize:11, color:"#FF6666", backgroundColor:"#1A0008EE", paddingHorizontal:12, paddingVertical:5, borderRadius:10, borderWidth:1, borderColor:"#8B0000" },

  hitLabelWrap:{ position:"absolute", top:ARENA_H*0.3, left:0, right:0, alignItems:"center" },
  hitLabelText:{ fontFamily:"Inter_700Bold", fontSize:20, color:"#FFD700", letterSpacing:1, textShadowColor:"#FFD700", textShadowRadius:10, textShadowOffset:{width:0,height:0} },

  comboBadge: { position:"absolute", bottom:8, left:10, paddingHorizontal:10, paddingVertical:4, borderRadius:20 },
  comboText:  { fontFamily:"Inter_700Bold", fontSize:10, color:"#fff", letterSpacing:1 },
  streakBadge:{ position:"absolute", top:8, left:10, paddingHorizontal:8, paddingVertical:3, borderRadius:12, backgroundColor:"#FF8C0022", borderWidth:1, borderColor:"#FF8C0060" },
  streakText: { fontFamily:"Inter_700Bold", fontSize:9, color:"#FF8C00", letterSpacing:1 },
  scoreDisplay:{ position:"absolute", top:8, right:10 },
  scoreNum:   { fontFamily:"Inter_700Bold", fontSize:16, color:"#FFD700" },

  // ── Controls ───────────────────────────────────────────────────────────────
  controls:   { flex:1, flexDirection:"row", gap:3, paddingHorizontal:6, paddingTop:6, backgroundColor:"#050008" },
  atkBtn:     { flex:1, borderRadius:14, overflow:"hidden", borderWidth:1 },
  atkBtnL:    { borderColor:"#FFD70050" },
  atkBtnH:    { borderColor:"#FF8C0050" },
  atkBtnD:    { borderColor:"#00FFFF50" },
  atkBtnB:    { borderColor:"#3B82F630" },
  btnGrad:    { flex:1, alignItems:"center", justifyContent:"center", paddingVertical:10, gap:1 },
  btnEmoji:   { fontSize:20 },
  btnLabel:   { fontFamily:"Inter_700Bold", fontSize:9, color:"#fff", letterSpacing:0.5, textAlign:"center" },
  btnSub:     { fontFamily:"Inter_400Regular", fontSize:7, color:"#aaa", textAlign:"center" },
  btnOff:     { opacity:0.35 },
  btnActive:  { borderColor:"#3B82F6" },

  // ── Round win / Gameover / Cleared ─────────────────────────────────────────
  winTitle:    { fontFamily:"Inter_700Bold", fontSize:36, color:"#00FF88", letterSpacing:3, textShadowColor:"#00FF8880", textShadowRadius:20, textShadowOffset:{width:0,height:0} },
  winSub:      { fontFamily:"Inter_400Regular", fontSize:14, color:"#888", marginTop:6 },
  winStats:    { flexDirection:"row", gap:22, marginTop:20, marginBottom:8 },
  winStatItem: { alignItems:"center" },
  winStatVal:  { fontFamily:"Inter_700Bold", fontSize:26, color:"#fff" },
  winStatLbl:  { fontFamily:"Inter_400Regular", fontSize:10, color:"#555", marginTop:2 },
  nextEnemyBox:{ marginTop:12, padding:14, borderRadius:14, borderWidth:1, borderColor:"#2A2A2A", backgroundColor:"#0A0A14", alignItems:"center", width:"80%" },
  nextEnemyLbl:{ fontFamily:"Inter_700Bold", fontSize:9, color:"#444", letterSpacing:2 },
  nextEnemyName:{ fontFamily:"Inter_700Bold", fontSize:18, marginTop:4 },
  nextEnemyTitle:{ fontFamily:"Inter_400Regular", fontSize:10, color:"#666", marginTop:2 },
  bigScore:    { fontFamily:"Inter_700Bold", fontSize:52, color:"#FFD700", textShadowColor:"#FFD70060", textShadowRadius:20, textShadowOffset:{width:0,height:0} },
});
