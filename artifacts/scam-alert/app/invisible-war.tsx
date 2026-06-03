import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, ScrollView, Image, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";

const APP_ICON = require("@/assets/images/icon.png");
const { width: SW, height: SH } = Dimensions.get("window");

// ── Fighters ──────────────────────────────────────────────────────────────────
type Fighter = {
  id: string; name: string; emoji: string; color: string; accent: string;
  title: string; tagline: string; aura: string;
  light: number; heavy: number; kick: number; grab: number; ultimate: number;
  ultimateName: string; ultimateEmoji: string;
};

const FIGHTERS: Fighter[] = [
  { id:"shadow",  name:"Shadow",   emoji:"🥷",  color:"#0a0014", accent:"#9B5DE5", aura:"#9B5DE588", title:"Assassin",        tagline:"Unseen. Unstoppable.",         light:9,  heavy:17, kick:13, grab:12, ultimate:52, ultimateName:"Shadow Annihilation", ultimateEmoji:"🌑" },
  { id:"cyber",   name:"Cypher",   emoji:"🤖",  color:"#001428", accent:"#00C3FF", aura:"#00C3FF88", title:"Cyber Soldier",   tagline:"Precision-engineered to destroy.", light:11, heavy:19, kick:14, grab:10, ultimate:48, ultimateName:"Neural Override",     ultimateEmoji:"⚡" },
  { id:"ghost",   name:"Spectra",  emoji:"👻",  color:"#12002a", accent:"#CC44FF", aura:"#CC44FF88", title:"Ghost Warrior",   tagline:"Can't fight what you can't see.", light:8,  heavy:15, kick:12, grab:11, ultimate:55, ultimateName:"Phase Obliteration",  ultimateEmoji:"🌀" },
  { id:"monk",    name:"Ember",    emoji:"🔥",  color:"#1a0500", accent:"#FF6B00", aura:"#FF6B0088", title:"Fire Monk",       tagline:"Forged in sacred flame.",       light:12, heavy:21, kick:16, grab:9,  ultimate:46, ultimateName:"Inferno Judgement",   ultimateEmoji:"💥" },
  { id:"boxer",   name:"Volt",     emoji:"⚡",  color:"#1a1600", accent:"#FFD700", aura:"#FFD70088", title:"Electric Boxer",  tagline:"10,000 volts of pure fury.",    light:14, heavy:16, kick:13, grab:10, ultimate:44, ultimateName:"Thunder Barrage",     ultimateEmoji:"⚡" },
  { id:"samurai", name:"Kage",     emoji:"⚔️", color:"#0a0a0a", accent:"#E8E8E8", aura:"#E8E8E888", title:"Dark Samurai",    tagline:"Honor died. He didn't.",        light:10, heavy:22, kick:15, grab:11, ultimate:50, ultimateName:"Void Execution",      ultimateEmoji:"🌫️" },
  { id:"alien",   name:"Xeron",    emoji:"👾",  color:"#001a0f", accent:"#00FF88", aura:"#00FF8888", title:"Alien Gladiator", tagline:"From a dimension of pure war.", light:11, heavy:18, kick:14, grab:13, ultimate:49, ultimateName:"Gravity Collapse",    ultimateEmoji:"🌌" },
  { id:"king",    name:"The King", emoji:"👑",  color:"#1a0030", accent:"#FF00CC", aura:"#FF00CC88", title:"Invisible King",  tagline:"He rules from the shadows.",    light:13, heavy:20, kick:15, grab:12, ultimate:60, ultimateName:"OBLIVION",            ultimateEmoji:"☠️" },
];

// ── Arenas ────────────────────────────────────────────────────────────────────
type Arena = { name: string; emoji: string; colors: [string, string, string]; floor: string; accent: string };
const ARENAS: Arena[] = [
  { name:"Neon City Rooftop",      emoji:"🏙️", colors:["#060020","#0d0035","#060020"], floor:"#9B5DE530", accent:"#9B5DE5" },
  { name:"Underground Fight Club", emoji:"🥊",  colors:["#1a0000","#2d0000","#1a0000"], floor:"#FF3B3B30", accent:"#FF3B3B" },
  { name:"Burning Temple",         emoji:"🔥",  colors:["#1a0800","#2d1000","#1a0800"], floor:"#FF6B0030", accent:"#FF6B00" },
  { name:"Rainy Alleyway",         emoji:"🌧️", colors:["#000d1a","#001828","#000d1a"], floor:"#00C3FF30", accent:"#00C3FF" },
  { name:"Military Lab",           emoji:"🔬",  colors:["#001a0a","#002d14","#001a0a"], floor:"#00FF8830", accent:"#00FF88" },
  { name:"Dimension Rift",         emoji:"🌌",  colors:["#0a0020","#180040","#0a0020"], floor:"#CC44FF30", accent:"#CC44FF" },
];

type Screen = "intro" | "menu" | "select" | "arenaSelect" | "countdown" | "fight" | "ko" | "roundEnd" | "over";
type FState = { hp: number; power: number; blocking: boolean; dodging: boolean; wins: number };
type FloatDmg = { id: number; value: number; x: number; anim: Animated.Value };

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InvisibleWar() {
  const insets = useSafeAreaInsets();
  const [screen, setScreen]         = useState<Screen>("menu");
  const [playerF, setPlayerF]       = useState<Fighter>(FIGHTERS[0]);
  const [enemyF,  setEnemyF]        = useState<Fighter>(FIGHTERS[7]);
  const [arena,   setArena]         = useState<Arena>(ARENAS[0]);
  const [round,   setRound]         = useState(1);
  const [roundWinner, setRWinner]   = useState<"player"|"enemy"|null>(null);
  const [matchWinner, setMWinner]   = useState<"player"|"enemy"|null>(null);
  const [combo,   setCombo]         = useState(0);
  const [hitMsg,  setHitMsg]        = useState("");
  const [floats,  setFloats]        = useState<FloatDmg[]>([]);
  const [cdNum,   setCdNum]         = useState(3);
  const [koText,  setKoText]        = useState("");

  const player = useRef<FState>({ hp:100, power:0, blocking:false, dodging:false, wins:0 });
  const enemy  = useRef<FState>({ hp:100, power:0, blocking:false, dodging:false, wins:0 });
  const aiTimer  = useRef<ReturnType<typeof setTimeout>|null>(null);
  const busy     = useRef(false);
  const lastHit  = useRef(0); // timestamp of last time player was hit (for counter window)
  const floatId  = useRef(0);

  // Animated
  const playerShake  = useRef(new Animated.Value(0)).current;
  const enemyShake   = useRef(new Animated.Value(0)).current;
  const playerFlash  = useRef(new Animated.Value(0)).current;
  const enemyFlash   = useRef(new Animated.Value(0)).current;
  const screenFlash  = useRef(new Animated.Value(0)).current;
  const hitMsgAnim   = useRef(new Animated.Value(0)).current;
  const comboScale   = useRef(new Animated.Value(1)).current;
  const koAnim       = useRef(new Animated.Value(0)).current;
  const playerAura   = useRef(new Animated.Value(0)).current;
  const enemyAura    = useRef(new Animated.Value(0)).current;

  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick(t => t + 1), []);

  // ── Aura pulse ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = (a: Animated.Value) => Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue:1, duration:1200, useNativeDriver:true }),
      Animated.timing(a, { toValue:0.3, duration:1200, useNativeDriver:true }),
    ])).start();
    loop(playerAura); loop(enemyAura);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const doShake = (a: Animated.Value) => Animated.sequence([
    Animated.timing(a, { toValue:12,  duration:35, useNativeDriver:true }),
    Animated.timing(a, { toValue:-12, duration:35, useNativeDriver:true }),
    Animated.timing(a, { toValue:7,   duration:25, useNativeDriver:true }),
    Animated.timing(a, { toValue:0,   duration:25, useNativeDriver:true }),
  ]).start();

  const doFlash = (a: Animated.Value) => Animated.sequence([
    Animated.timing(a, { toValue:1, duration:60, useNativeDriver:true }),
    Animated.timing(a, { toValue:0, duration:250, useNativeDriver:true }),
  ]).start();

  const doScreenFlash = (color?: string) => {
    screenFlash.setValue(1);
    Animated.timing(screenFlash, { toValue:0, duration:500, useNativeDriver:true }).start();
  };

  const spawnFloat = (dmg: number, right: boolean) => {
    const id = floatId.current++;
    const anim = new Animated.Value(0);
    setFloats(prev => [...prev.slice(-6), { id, value:dmg, x: right ? SW*0.6 : SW*0.1, anim }]);
    Animated.timing(anim, { toValue:1, duration:900, useNativeDriver:true }).start(() => {
      setFloats(prev => prev.filter(f => f.id !== id));
    });
  };

  const showHit = (msg: string) => {
    setHitMsg(msg);
    hitMsgAnim.setValue(0);
    Animated.timing(hitMsgAnim, { toValue:1, duration:700, useNativeDriver:true }).start();
  };

  const burstCombo = () => {
    comboScale.setValue(1.8);
    Animated.spring(comboScale, { toValue:1, useNativeDriver:true, friction:4 }).start();
  };

  const comboMult = (c: number) => c <= 1 ? 1 : c <= 3 ? 1.15 : c <= 5 ? 1.3 : 1.5;

  const applyDamage = (
    target: React.MutableRefObject<FState>, raw: number,
    tShake: Animated.Value, tFlash: Animated.Value, isRight: boolean,
  ) => {
    let dmg = raw;
    if (target.current.dodging) dmg = 0;
    else if (target.current.blocking) dmg = Math.max(1, Math.round(raw * 0.12));
    target.current.hp = Math.max(0, target.current.hp - dmg);
    if (dmg > 0) { doShake(tShake); doFlash(tFlash); spawnFloat(dmg, isRight); }
    bump();
    return dmg;
  };

  const endRound = useCallback((winner: "player"|"enemy") => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    setKoText(winner === "player" ? "K.O.!" : "K.O.!");
    koAnim.setValue(0);
    Animated.spring(koAnim, { toValue:1, useNativeDriver:true, friction:5 }).start();
    setScreen("ko");
    setTimeout(() => {
      if (winner === "player") player.current.wins++;
      else enemy.current.wins++;
      const needed = 2;
      if (player.current.wins >= needed || enemy.current.wins >= needed) {
        setMWinner(player.current.wins >= needed ? "player" : "enemy");
        setScreen("over");
      } else {
        setRWinner(winner);
        setScreen("roundEnd");
      }
    }, 2200);
  }, []);

  const checkEnd = useCallback(() => {
    if (player.current.hp <= 0) endRound("enemy");
    else if (enemy.current.hp <= 0) endRound("player");
  }, [endRound]);

  // ── Player Attacks ──────────────────────────────────────────────────────────
  const attack = useCallback((type: "light"|"heavy"|"kick"|"grab"|"ultimate") => {
    if (screen !== "fight" || busy.current) return;
    if (type === "ultimate" && player.current.power < 100) return;
    busy.current = true;

    const f = playerF;
    let raw = 0; let msg = ""; let powerGain = 0;
    if      (type === "light")    { raw = f.light + Math.floor(Math.random()*4);   msg = "LIGHT HIT!";  powerGain = 8; }
    else if (type === "heavy")    { raw = f.heavy + Math.floor(Math.random()*5);   msg = "HEAVY HIT!";  powerGain = 16; }
    else if (type === "kick")     { raw = f.kick  + Math.floor(Math.random()*4);   msg = "KICK!";       powerGain = 12; }
    else if (type === "grab")     { enemy.current.blocking = false; raw = f.grab + Math.floor(Math.random()*5); msg = "GRAB!"; powerGain = 10; }
    else                          { raw = f.ultimate; msg = `${f.ultimateName}!`;  powerGain = 0; player.current.power = 0; doScreenFlash(); }

    const newCombo = type === "ultimate" ? combo : combo + 1;
    const mult = type === "ultimate" ? 1 : comboMult(newCombo);
    const final = Math.round(raw * mult);
    const dmg = applyDamage(enemy, final, enemyShake, enemyFlash, true);

    if (type !== "ultimate") player.current.power = Math.min(100, player.current.power + powerGain);
    setCombo(newCombo);
    if (newCombo > 1) burstCombo();
    showHit(newCombo >= 3 ? `${newCombo}× COMBO — ${dmg} DMG!` : `${msg} ${dmg} DMG`);
    bump();

    setTimeout(() => { busy.current = false; checkEnd(); }, 280);
  }, [screen, playerF, combo, checkEnd]);

  const doBlock = useCallback(() => {
    if (screen !== "fight") return;
    player.current.blocking = true;
    setCombo(0);
    showHit("BLOCKING ✦");
    bump();
    setTimeout(() => { player.current.blocking = false; bump(); }, 800);
  }, [screen]);

  const doDodge = useCallback(() => {
    if (screen !== "fight" || busy.current) return;
    player.current.dodging = true;
    showHit("DODGE! ✓");
    player.current.power = Math.min(100, player.current.power + 6);
    bump();
    setTimeout(() => { player.current.dodging = false; bump(); }, 600);
  }, [screen]);

  // Counter: if within 500ms of last player hit, strike back for 1.5x
  const doCounter = useCallback(() => {
    if (screen !== "fight" || busy.current) return;
    const timeSince = Date.now() - lastHit.current;
    if (timeSince < 600) {
      busy.current = true;
      const raw = Math.round(playerF.heavy * 1.5);
      const dmg = applyDamage(enemy, raw, enemyShake, enemyFlash, true);
      doScreenFlash();
      showHit(`COUNTER! ${dmg} DMG!`);
      player.current.power = Math.min(100, player.current.power + 20);
      bump();
      setTimeout(() => { busy.current = false; checkEnd(); }, 280);
    } else {
      showHit("TOO SLOW!");
    }
  }, [screen, playerF, checkEnd]);

  // ── AI ──────────────────────────────────────────────────────────────────────
  const scheduleAI = useCallback(() => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    const delay = 900 + Math.random() * 900;
    aiTimer.current = setTimeout(() => {
      if (screen !== "fight") return;
      enemy.current.blocking = false;
      enemy.current.dodging = false;

      const eHp = enemy.current.hp;
      const pHp = player.current.hp;
      const power = enemy.current.power;
      const roll = Math.random();

      if (power >= 100 && roll < 0.15) {
        // Ultimate
        const raw = enemyF.ultimate;
        applyDamage(player, raw, playerShake, playerFlash, false);
        lastHit.current = Date.now();
        setCombo(0);
        doScreenFlash();
        showHit(`ENEMY: ${enemyF.ultimateName}!`);
        enemy.current.power = 0; bump();
        checkEnd();
      } else if (eHp < 30 && roll < 0.3) {
        // Low HP: dodge or block
        if (roll < 0.15) { enemy.current.dodging = true; bump(); setTimeout(() => { enemy.current.dodging = false; bump(); }, 600); }
        else { enemy.current.blocking = true; bump(); setTimeout(() => { enemy.current.blocking = false; bump(); }, 800); }
      } else if (roll < 0.4) {
        const raw = enemyF.light + Math.floor(Math.random()*4);
        const dmg = applyDamage(player, raw, playerShake, playerFlash, false);
        lastHit.current = Date.now();
        setCombo(0);
        if (dmg > 0) showHit(`ENEMY PUNCH! ${dmg}`);
        enemy.current.power = Math.min(100, enemy.current.power + 8); bump(); checkEnd();
      } else if (roll < 0.65) {
        const raw = enemyF.heavy + Math.floor(Math.random()*5);
        const dmg = applyDamage(player, raw, playerShake, playerFlash, false);
        lastHit.current = Date.now();
        setCombo(0);
        if (dmg > 0) showHit(`ENEMY STRIKE! ${dmg}`);
        enemy.current.power = Math.min(100, enemy.current.power + 16); bump(); checkEnd();
      } else if (roll < 0.80) {
        const raw = enemyF.kick + Math.floor(Math.random()*4);
        const dmg = applyDamage(player, raw, playerShake, playerFlash, false);
        lastHit.current = Date.now();
        setCombo(0);
        if (dmg > 0) showHit(`ENEMY KICK! ${dmg}`);
        enemy.current.power = Math.min(100, enemy.current.power + 12); bump(); checkEnd();
      } else {
        enemy.current.blocking = true; bump();
        setTimeout(() => { enemy.current.blocking = false; bump(); }, 800);
      }
      scheduleAI();
    }, delay);
  }, [screen, enemyF, checkEnd]);

  useEffect(() => {
    if (screen === "fight") scheduleAI();
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current); };
  }, [screen, scheduleAI]);

  // ── Countdown ──────────────────────────────────────────────────────────────
  const startCountdown = () => {
    setScreen("countdown");
    let n = 3; setCdNum(3);
    const t = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(t); beginFight(); }
      else setCdNum(n);
    }, 900);
  };

  const beginFight = () => {
    player.current = { hp:100, power:0, blocking:false, dodging:false, wins:player.current.wins };
    enemy.current  = { hp:100, power:0, blocking:false, dodging:false, wins:enemy.current.wins  };
    setCombo(0); setHitMsg(""); busy.current = false;
    setScreen("fight"); bump();
  };

  const nextRound = () => {
    setRound(r => r + 1); setRWinner(null); startCountdown();
  };

  const resetGame = () => {
    player.current = { hp:100, power:0, blocking:false, dodging:false, wins:0 };
    enemy.current  = { hp:100, power:0, blocking:false, dodging:false, wins:0 };
    setRound(1); setCombo(0); setMWinner(null); setRWinner(null);
    setScreen("menu"); bump();
  };

  // ── HP bar color ────────────────────────────────────────────────────────────
  const hpColor = (hp: number) => hp > 55 ? "#00FF77" : hp > 28 ? "#FFD700" : "#FF3B3B";
  const pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`;

  // ── Countdown Screen ────────────────────────────────────────────────────────
  if (screen === "countdown") return (
    <LinearGradient colors={arena.colors} style={[S.fill, { alignItems:"center", justifyContent:"center", paddingTop: insets.top }]}>
      <Text style={S.cdFighters}>{playerF.emoji}  VS  {enemyF.emoji}</Text>
      <Text style={S.cdRound}>ROUND {round}</Text>
      <Text style={[S.cdNum, { color: arena.accent }]}>{cdNum}</Text>
    </LinearGradient>
  );

  // ── KO Screen ──────────────────────────────────────────────────────────────
  if (screen === "ko") return (
    <LinearGradient colors={arena.colors} style={[S.fill, { alignItems:"center", justifyContent:"center", paddingTop: insets.top }]}>
      <Animated.Text style={[S.koText, { transform:[{ scale: koAnim }] }]}>K.O.!</Animated.Text>
    </LinearGradient>
  );

  // ── Round End ───────────────────────────────────────────────────────────────
  if (screen === "roundEnd") return (
    <LinearGradient colors={["#000","#0a001a"]} style={[S.fill, { alignItems:"center", justifyContent:"center", gap:16, paddingHorizontal:28, paddingTop:insets.top, paddingBottom:insets.bottom }]}>
      <Text style={S.reRound}>ROUND {round} COMPLETE</Text>
      <Text style={[S.reResult, { color: roundWinner === "player" ? "#00FF77" : "#FF3B3B" }]}>
        {roundWinner === "player" ? "ROUND WIN!" : "ROUND LOST"}
      </Text>
      <View style={S.reWins}>
        <View style={S.reWinSide}>
          <Text style={S.reWinName}>{playerF.emoji} You</Text>
          {[...Array(player.current.wins)].map((_,i) => <View key={i} style={[S.winDot,{backgroundColor:"#00FF77"}]} />)}
        </View>
        <Text style={S.reDivider}>—</Text>
        <View style={S.reWinSide}>
          <Text style={S.reWinName}>{enemyF.emoji} Enemy</Text>
          {[...Array(enemy.current.wins)].map((_,i) => <View key={i} style={[S.winDot,{backgroundColor:"#FF3B3B"}]} />)}
        </View>
      </View>
      <TouchableOpacity style={[S.bigBtn,{backgroundColor:"#6C63FF"}]} onPress={nextRound}>
        <Text style={S.bigBtnTxt}>ROUND {round + 1} — FIGHT →</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  // ── Game Over ───────────────────────────────────────────────────────────────
  if (screen === "over") return (
    <LinearGradient colors={["#000","#0a001a"]} style={[S.fill, { alignItems:"center", justifyContent:"center", gap:14, paddingHorizontal:24, paddingTop:insets.top, paddingBottom:insets.bottom }]}>
      <Text style={[S.goTitle, { color: matchWinner === "player" ? "#FFD700" : "#FF3B3B" }]}>
        {matchWinner === "player" ? "VICTORY!" : "DEFEATED!"}
      </Text>
      <Text style={{ fontSize:70 }}>{matchWinner === "player" ? playerF.emoji : enemyF.emoji}</Text>
      <Text style={[S.goName, { color: matchWinner === "player" ? playerF.accent : enemyF.accent }]}>
        {matchWinner === "player" ? playerF.name : enemyF.name}
      </Text>
      <Text style={S.goSub}>
        {matchWinner === "player" ? "You claimed the Invisible War throne!\nThe shadows bow before you." : "You were not strong enough.\nTrain and return, warrior."}
      </Text>
      <TouchableOpacity style={[S.bigBtn,{backgroundColor:"#6C63FF", marginTop:8}]} onPress={resetGame}>
        <Text style={S.bigBtnTxt}>REMATCH</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[S.bigBtn,{backgroundColor:"#222"}]} onPress={() => router.back()}>
        <Text style={S.bigBtnTxt}>EXIT</Text>
      </TouchableOpacity>
    </LinearGradient>
  );

  // ── Menu Screen ──────────────────────────────────────────────────────────────
  if (screen === "menu") return <MenuScreen insets={insets} onPlay={() => setScreen("select")} onBack={() => router.back()} />;

  // ── Arena Select ─────────────────────────────────────────────────────────────
  if (screen === "arenaSelect") return (
    <LinearGradient colors={["#000","#0a001a"]} style={[S.fill, { paddingTop:insets.top, paddingBottom:insets.bottom }]}>
      <View style={S.navRow}>
        <TouchableOpacity onPress={() => setScreen("select")}><Text style={S.navBack}>← Back</Text></TouchableOpacity>
        <Text style={S.navTitle}>SELECT ARENA</Text>
        <View style={{width:50}} />
      </View>
      <ScrollView contentContainerStyle={{ padding:16, gap:12 }} showsVerticalScrollIndicator={false}>
        {ARENAS.map(a => (
          <TouchableOpacity key={a.name} onPress={() => { setArena(a); startCountdown(); }} activeOpacity={0.85}>
            <LinearGradient colors={a.colors} style={[S.arenaCard, { borderColor: arena.name === a.name ? a.accent : "#333" }]}>
              <Text style={{fontSize:34}}>{a.emoji}</Text>
              <View style={{flex:1}}>
                <Text style={[S.arenaName,{color:a.accent}]}>{a.name}</Text>
                <View style={[S.arenaAccentBar,{backgroundColor:a.accent}]} />
              </View>
              {arena.name === a.name && <Text style={{color:a.accent, fontFamily:"Inter_700Bold", fontSize:11}}>SELECTED ✓</Text>}
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </LinearGradient>
  );

  // ── Select Screen ─────────────────────────────────────────────────────────────
  if (screen === "select") return (
    <SelectScreen
      insets={insets}
      selected={playerF}
      onSelect={f => {
        setPlayerF(f);
        const foes = FIGHTERS.filter(x => x.id !== f.id);
        setEnemyF(foes[Math.floor(Math.random() * foes.length)]);
      }}
      onNext={() => setScreen("arenaSelect")}
      onBack={() => setScreen("menu")}
    />
  );

  // ── Fight Screen ──────────────────────────────────────────────────────────────
  return (
    <View style={[S.fill, { paddingTop:insets.top, paddingBottom:insets.bottom }]}>
      {/* Screen flash */}
      <Animated.View pointerEvents="none" style={[S.overlay, { opacity: screenFlash, backgroundColor:"#9B5DE5" }]} />

      {/* HUD */}
      <View style={S.hud}>
        {/* Player */}
        <View style={S.hudSide}>
          <View style={S.hudPortrait}>
            <Animated.Text style={[S.hudEmoji, { opacity: playerAura }]}>{playerF.emoji}</Animated.Text>
          </View>
          <View style={{flex:1, gap:3}}>
            <Text style={S.hudName}>{playerF.name}</Text>
            <View style={S.barBg}>
              <View style={[S.barFill, { width: pct(player.current.hp), backgroundColor: hpColor(player.current.hp) }]} />
            </View>
            <View style={S.powerBg}>
              <View style={[S.powerFill, { width: pct(player.current.power) }]} />
            </View>
          </View>
        </View>

        {/* Center */}
        <View style={S.hudCenter}>
          <View style={{flexDirection:"row", gap:4}}>
            {[...Array(player.current.wins)].map((_,i) => <View key={i} style={[S.winPip,{backgroundColor:"#00FF77"}]} />)}
          </View>
          <Text style={S.hudRound}>R{round}</Text>
          <View style={{flexDirection:"row", gap:4}}>
            {[...Array(enemy.current.wins)].map((_,i) => <View key={i} style={[S.winPip,{backgroundColor:"#FF3B3B"}]} />)}
          </View>
        </View>

        {/* Enemy */}
        <View style={[S.hudSide,{alignItems:"flex-end"}]}>
          <View style={{flex:1, gap:3, alignItems:"flex-end"}}>
            <Text style={S.hudName}>{enemyF.name}</Text>
            <View style={S.barBg}>
              <View style={[S.barFill, { width: pct(enemy.current.hp), backgroundColor: hpColor(enemy.current.hp), alignSelf:"flex-end" }]} />
            </View>
            <View style={S.powerBg}>
              <View style={[S.powerFill, { width: pct(enemy.current.power), alignSelf:"flex-end" }]} />
            </View>
          </View>
          <View style={S.hudPortrait}>
            <Animated.Text style={[S.hudEmoji, { opacity: enemyAura }]}>{enemyF.emoji}</Animated.Text>
          </View>
        </View>
      </View>

      {/* Arena */}
      <LinearGradient colors={arena.colors} style={S.arena}>
        {/* Floor line */}
        <View style={[S.floorLine, { backgroundColor: arena.floor }]} />

        {/* Floating damage numbers */}
        {floats.map(f => (
          <Animated.Text key={f.id} style={[S.floatDmg, {
            left: f.x,
            opacity: f.anim.interpolate({ inputRange:[0,0.2,1], outputRange:[0,1,0] }),
            transform:[{ translateY: f.anim.interpolate({ inputRange:[0,1], outputRange:[0,-70] }) }],
          }]}>
            -{f.value}
          </Animated.Text>
        ))}

        {/* Hit message */}
        <Animated.Text style={[S.hitMsg, { opacity: hitMsgAnim, color: arena.accent }]}>{hitMsg}</Animated.Text>

        {/* Combo */}
        {combo > 1 && (
          <Animated.Text style={[S.comboTxt, { transform:[{scale:comboScale}] }]}>
            {combo}× COMBO
          </Animated.Text>
        )}

        {/* Fighters */}
        <View style={S.fightRow}>
          <Animated.View style={[S.fighterBox, {
            transform:[{translateX:playerShake}],
            borderColor: player.current.blocking ? "#00FF77" : player.current.dodging ? "#FFD700" : playerF.accent,
            backgroundColor: playerF.aura + "18",
          }]}>
            <Animated.View style={{ opacity: Animated.subtract(1, Animated.multiply(playerFlash, 0.85)) }}>
              <Text style={S.fighterEmoji}>{playerF.emoji}</Text>
            </Animated.View>
            <Text style={[S.fighterHp, { color: hpColor(player.current.hp) }]}>{player.current.hp} HP</Text>
            {player.current.blocking && <Text style={[S.statusTag,{backgroundColor:"#00FF7722",color:"#00FF77"}]}>BLOCK</Text>}
            {player.current.dodging  && <Text style={[S.statusTag,{backgroundColor:"#FFD70022",color:"#FFD700"}]}>DODGE</Text>}
            {player.current.power >= 100 && <Text style={[S.statusTag,{backgroundColor:"#FF00CC22",color:"#FF00CC"}]}>ULTIMATE!</Text>}
          </Animated.View>

          <View style={S.vsSpacer}><Text style={S.vsText}>VS</Text></View>

          <Animated.View style={[S.fighterBox, {
            transform:[{translateX:enemyShake}],
            borderColor: enemy.current.blocking ? "#00FF77" : enemy.current.dodging ? "#FFD700" : enemyF.accent,
            backgroundColor: enemyF.aura + "18",
          }]}>
            <Animated.View style={{ opacity: Animated.subtract(1, Animated.multiply(enemyFlash, 0.85)) }}>
              <Text style={S.fighterEmoji}>{enemyF.emoji}</Text>
            </Animated.View>
            <Text style={[S.fighterHp, { color: hpColor(enemy.current.hp) }]}>{enemy.current.hp} HP</Text>
            {enemy.current.blocking && <Text style={[S.statusTag,{backgroundColor:"#00FF7722",color:"#00FF77"}]}>BLOCK</Text>}
          </Animated.View>
        </View>
      </LinearGradient>

      {/* Controls */}
      <View style={S.controls}>
        {/* Row 1 — attacks */}
        <View style={S.btnRow}>
          <TouchableOpacity style={[S.btn,{borderColor:"#6C63FF"}]} onPress={() => attack("light")}>
            <Text style={S.bE}>👊</Text><Text style={S.bL}>LIGHT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btn,{borderColor:"#FF6B00"}]} onPress={() => attack("heavy")}>
            <Text style={S.bE}>🤜</Text><Text style={S.bL}>HEAVY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btn,{borderColor:"#FF3B3B"}]} onPress={() => attack("kick")}>
            <Text style={S.bE}>🦵</Text><Text style={S.bL}>KICK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btn,{borderColor:"#00C3FF"}]} onPress={() => attack("grab")}>
            <Text style={S.bE}>✊</Text><Text style={S.bL}>GRAB</Text>
          </TouchableOpacity>
        </View>
        {/* Row 2 — defense + ultimate */}
        <View style={S.btnRow}>
          <TouchableOpacity style={[S.btn,{borderColor:"#00FF77"}]} onPress={doBlock}>
            <Text style={S.bE}>🛡️</Text><Text style={S.bL}>BLOCK</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btn,{borderColor:"#FFD700"}]} onPress={doDodge}>
            <Text style={S.bE}>💨</Text><Text style={S.bL}>DODGE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.btn,{borderColor:"#CC00AA"}]} onPress={doCounter}>
            <Text style={S.bE}>⚡</Text><Text style={S.bL}>COUNTER</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.btn, S.ultBtn, player.current.power < 100 && S.btnDim]}
            onPress={() => attack("ultimate")}
            disabled={player.current.power < 100}
          >
            <Text style={S.bE}>{playerF.ultimateEmoji}</Text>
            <Text style={[S.bL,{color:"#FF00CC"}]}>ULTIMATE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Menu ──────────────────────────────────────────────────────────────────────
function MenuScreen({ insets, onPlay, onBack }: { insets:any; onPlay:()=>void; onBack:()=>void }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue:1, duration:1600, useNativeDriver:true }),
      Animated.timing(glow, { toValue:0.3, duration:1600, useNativeDriver:true }),
    ])).start();
  }, []);
  return (
    <LinearGradient colors={["#000","#08001a","#000"]} style={[M.root, { paddingTop:insets.top, paddingBottom:insets.bottom }]}>
      <TouchableOpacity style={M.back} onPress={onBack}><Text style={M.backTxt}>← Back</Text></TouchableOpacity>
      <View style={M.center}>
        <Text style={M.eyebrow}>⚔️  UNDERGROUND TOURNAMENT  ⚔️</Text>
        <Animated.Text style={[M.title, { opacity: glow }]}>INVISIBLE{"\n"}WAR</Animated.Text>
        <Text style={M.tagline}>
          "The world is secretly controlled{"\n"}by invisible shadow warriors.{"\n"}Enter the tournament. Claim the throne."
        </Text>
        <View style={M.previewRow}>
          {FIGHTERS.map(f => (
            <View key={f.id} style={[M.charBadge, { borderColor: f.accent }]}>
              <Text style={{fontSize:Platform.OS==="web"?22:18}}>{f.emoji}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={M.playBtn} onPress={onPlay} activeOpacity={0.85}>
          <LinearGradient colors={["#6C63FF","#FF00CC"]} style={M.playGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
            <Text style={M.playTxt}>ENTER THE TOURNAMENT</Text>
          </LinearGradient>
        </TouchableOpacity>
        <Text style={M.meta}>8 Fighters · 6 Arenas · 7 Moves · AI Opponent · Best of 3</Text>
      </View>
    </LinearGradient>
  );
}

// ── Select Screen ──────────────────────────────────────────────────────────────
function SelectScreen({ insets, selected, onSelect, onNext, onBack }: { insets:any; selected:Fighter; onSelect:(f:Fighter)=>void; onNext:()=>void; onBack:()=>void }) {
  return (
    <LinearGradient colors={["#000","#0a001a"]} style={[SS.root, { paddingTop:insets.top, paddingBottom:insets.bottom }]}>
      <View style={SS.nav}>
        <TouchableOpacity onPress={onBack}><Text style={SS.navBack}>← Back</Text></TouchableOpacity>
        <Text style={SS.navTitle}>SELECT FIGHTER</Text>
        <View style={{width:50}} />
      </View>
      {/* Selected card */}
      <View style={[SS.card, { borderColor: selected.accent }]}>
        <Text style={{ fontSize: Platform.OS==="web"?60:52 }}>{selected.emoji}</Text>
        <View style={{flex:1, gap:3}}>
          <Text style={[SS.selName,{color:selected.accent}]}>{selected.name}</Text>
          <Text style={SS.selTitle}>{selected.title}</Text>
          <Text style={SS.selTagline}>"{selected.tagline}"</Text>
          <Text style={[SS.selUlt,{color:"#FF00CC"}]}>💥 {selected.ultimateName}</Text>
          <View style={{flexDirection:"row",gap:10,marginTop:2}}>
            <Text style={SS.stat}>👊 {selected.light}</Text>
            <Text style={SS.stat}>🤜 {selected.heavy}</Text>
            <Text style={SS.stat}>🦵 {selected.kick}</Text>
            <Text style={[SS.stat,{color:selected.accent}]}>⚡ {selected.ultimate}</Text>
          </View>
        </View>
      </View>
      {/* Grid */}
      <ScrollView contentContainerStyle={SS.grid} showsVerticalScrollIndicator={false}>
        {FIGHTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[SS.gridCard, { borderColor: selected.id===f.id ? f.accent : "#2a2a2a", backgroundColor: selected.id===f.id ? f.accent+"22" : "#0d0d0d" }]}
            onPress={() => onSelect(f)}
            activeOpacity={0.8}
          >
            <Text style={{fontSize:Platform.OS==="web"?28:24}}>{f.emoji}</Text>
            <Text style={[SS.gridName,{color:selected.id===f.id?f.accent:"#ccc"}]}>{f.name}</Text>
            <Text style={SS.gridTitle}>{f.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={SS.fightBtn} onPress={onNext} activeOpacity={0.85}>
        <LinearGradient colors={["#FF3B3B","#6C63FF"]} style={SS.fightGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
          <Text style={SS.fightTxt}>SELECT ARENA →</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  fill:        { flex:1, backgroundColor:"#000" },
  overlay:     { ...StyleSheet.absoluteFillObject, zIndex:99 },
  hud:         { flexDirection:"row", alignItems:"center", paddingHorizontal:10, paddingVertical:8, backgroundColor:"#070010", gap:8 },
  hudSide:     { flex:1, flexDirection:"row", alignItems:"center", gap:7 },
  hudPortrait: { width:36, height:36, borderRadius:10, backgroundColor:"#111", alignItems:"center", justifyContent:"center" },
  hudEmoji:    { fontSize:22 },
  hudName:     { fontFamily:"Inter_700Bold", fontSize:10, color:"#fff" },
  barBg:       { height:9, backgroundColor:"#1a1a1a", borderRadius:5, overflow:"hidden" },
  barFill:     { height:"100%", borderRadius:5 },
  powerBg:     { height:5, backgroundColor:"#1a1a1a", borderRadius:3, overflow:"hidden" },
  powerFill:   { height:"100%", backgroundColor:"#FF00CC", borderRadius:3 },
  hudCenter:   { alignItems:"center", gap:3 },
  hudRound:    { fontFamily:"Inter_700Bold", fontSize:13, color:"#fff" },
  winPip:      { width:7, height:7, borderRadius:4 },
  arena:       { flex:1, justifyContent:"center", alignItems:"center", overflow:"hidden" },
  floorLine:   { position:"absolute", bottom:"15%", left:0, right:0, height:2 },
  floatDmg:    { position:"absolute", fontFamily:"Inter_700Bold", fontSize:22, color:"#FF3B3B", textShadowColor:"#FF3B3B", textShadowRadius:8 },
  hitMsg:      { fontFamily:"Inter_700Bold", fontSize:18, textAlign:"center", marginBottom:6, textShadowRadius:10 },
  comboTxt:    { fontFamily:"Inter_700Bold", fontSize:20, color:"#FFD700", textAlign:"center", textShadowColor:"#FFD700", textShadowRadius:12 },
  fightRow:    { flexDirection:"row", alignItems:"center", gap:12, paddingHorizontal:12 },
  fighterBox:  { alignItems:"center", justifyContent:"center", width:(SW-60)/2, aspectRatio:0.85, borderRadius:20, borderWidth:2, gap:5 },
  fighterEmoji:{ fontSize:Platform.OS==="web"?68:58 },
  fighterHp:   { fontFamily:"Inter_700Bold", fontSize:13 },
  statusTag:   { fontFamily:"Inter_700Bold", fontSize:9, paddingHorizontal:7, paddingVertical:2, borderRadius:6 },
  vsSpacer:    { alignItems:"center" },
  vsText:      { fontFamily:"Inter_700Bold", fontSize:16, color:"#333" },
  controls:    { backgroundColor:"#050010", paddingHorizontal:10, paddingVertical:8, gap:7 },
  btnRow:      { flexDirection:"row", gap:6 },
  btn:         { flex:1, alignItems:"center", justifyContent:"center", paddingVertical:10, borderRadius:12, borderWidth:1.5, backgroundColor:"#0d0020", gap:2 },
  ultBtn:      { borderColor:"#FF00CC", backgroundColor:"#1a0030" },
  btnDim:      { opacity:0.3 },
  bE:          { fontSize:18 },
  bL:          { fontFamily:"Inter_700Bold", fontSize:8, color:"#ddd", letterSpacing:0.4 },
  // countdown
  cdFighters:  { fontFamily:"Inter_700Bold", fontSize:32, color:"#fff", marginBottom:12 },
  cdRound:     { fontFamily:"Inter_600SemiBold", fontSize:14, color:"#888", letterSpacing:4, marginBottom:16 },
  cdNum:       { fontFamily:"Inter_700Bold", fontSize:96, textShadowRadius:30 },
  // ko
  koText:      { fontFamily:"Inter_700Bold", fontSize:72, color:"#FFD700", textShadowColor:"#FFD700", textShadowRadius:24 },
  // round end
  reRound:     { fontFamily:"Inter_600SemiBold", fontSize:12, color:"#666", letterSpacing:3 },
  reResult:    { fontFamily:"Inter_700Bold", fontSize:42 },
  reWins:      { flexDirection:"row", alignItems:"center", gap:20, marginTop:8 },
  reWinSide:   { alignItems:"center", gap:6 },
  reWinName:   { fontFamily:"Inter_600SemiBold", fontSize:16, color:"#fff" },
  winDot:      { width:10, height:10, borderRadius:5 },
  reDivider:   { color:"#444", fontSize:20 },
  bigBtn:      { width:"100%", paddingVertical:14, borderRadius:16, alignItems:"center" },
  bigBtnTxt:   { fontFamily:"Inter_700Bold", fontSize:16, color:"#fff", letterSpacing:1 },
  // game over
  goTitle:     { fontFamily:"Inter_700Bold", fontSize:52, textShadowRadius:20 },
  goName:      { fontFamily:"Inter_700Bold", fontSize:28 },
  goSub:       { fontFamily:"Inter_400Regular", fontSize:14, color:"#888", textAlign:"center", lineHeight:22 },
  // arena select
  arenaCard:   { flexDirection:"row", alignItems:"center", borderRadius:16, borderWidth:1.5, padding:16, gap:14 },
  arenaName:   { fontFamily:"Inter_700Bold", fontSize:15 },
  arenaAccentBar: { height:2, width:60, borderRadius:2, marginTop:6 },
  // nav
  navRow:      { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:12 },
  navBack:     { fontFamily:"Inter_600SemiBold", fontSize:14, color:"#888" },
  navTitle:    { fontFamily:"Inter_700Bold", fontSize:16, color:"#fff" },
});

const M = StyleSheet.create({
  root:       { flex:1 },
  back:       { padding:16 },
  backTxt:    { fontFamily:"Inter_600SemiBold", fontSize:14, color:"#888" },
  center:     { flex:1, alignItems:"center", justifyContent:"center", paddingHorizontal:24, gap:16 },
  eyebrow:    { fontFamily:"Inter_600SemiBold", fontSize:11, color:"#6C63FF", letterSpacing:2, textAlign:"center" },
  title:      { fontFamily:"Inter_700Bold", fontSize:58, color:"#fff", textAlign:"center", lineHeight:62, textShadowColor:"#6C63FF", textShadowRadius:30 },
  tagline:    { fontFamily:"Inter_400Regular", fontSize:13, color:"#777", textAlign:"center", lineHeight:22, fontStyle:"italic" },
  previewRow: { flexDirection:"row", gap:8, flexWrap:"wrap", justifyContent:"center" },
  charBadge:  { width:46, height:46, borderRadius:14, borderWidth:1.5, alignItems:"center", justifyContent:"center", backgroundColor:"#111" },
  playBtn:    { width:"100%", borderRadius:16, overflow:"hidden" },
  playGrad:   { paddingVertical:16, alignItems:"center" },
  playTxt:    { fontFamily:"Inter_700Bold", fontSize:15, color:"#fff", letterSpacing:1.5 },
  meta:       { fontFamily:"Inter_400Regular", fontSize:10, color:"#444", textAlign:"center" },
});

const SS = StyleSheet.create({
  root:       { flex:1 },
  nav:        { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:12 },
  navBack:    { fontFamily:"Inter_600SemiBold", fontSize:14, color:"#888" },
  navTitle:   { fontFamily:"Inter_700Bold", fontSize:16, color:"#fff" },
  card:       { flexDirection:"row", alignItems:"center", marginHorizontal:16, marginBottom:10, backgroundColor:"#0d0d0d", borderRadius:16, padding:14, borderWidth:1.5, gap:14 },
  selName:    { fontFamily:"Inter_700Bold", fontSize:20 },
  selTitle:   { fontFamily:"Inter_500Medium", fontSize:11, color:"#888" },
  selTagline: { fontFamily:"Inter_400Regular", fontSize:11, color:"#666", fontStyle:"italic" },
  selUlt:     { fontFamily:"Inter_600SemiBold", fontSize:11 },
  stat:       { fontFamily:"Inter_600SemiBold", fontSize:12, color:"#ccc" },
  grid:       { flexDirection:"row", flexWrap:"wrap", paddingHorizontal:16, gap:8, paddingBottom:12 },
  gridCard:   { width:(SW-48)/4, alignItems:"center", padding:10, borderRadius:14, borderWidth:1.5, gap:3 },
  gridName:   { fontFamily:"Inter_700Bold", fontSize:9 },
  gridTitle:  { fontFamily:"Inter_400Regular", fontSize:7, color:"#666" },
  fightBtn:   { marginHorizontal:16, marginTop:4, marginBottom:4, borderRadius:16, overflow:"hidden" },
  fightGrad:  { paddingVertical:15, alignItems:"center" },
  fightTxt:   { fontFamily:"Inter_700Bold", fontSize:18, color:"#fff", letterSpacing:2 },
});
