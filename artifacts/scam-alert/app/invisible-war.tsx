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
const { width: SW } = Dimensions.get("window");

// ── Fighters ───────────────────────────────────────────────────────────────────
type Fighter = {
  id: string; name: string; emoji: string;
  color: string; accent: string; title: string; tagline: string;
  punch: number; kick: number; special: number; specialName: string;
};

const FIGHTERS: Fighter[] = [
  { id: "shadow", name: "Shadow", emoji: "🥷", color: "#0D0D1A", accent: "#6C63FF", title: "Assassin", tagline: "Unseen. Unstoppable.", punch: 11, kick: 18, special: 40, specialName: "Shadow Step" },
  { id: "cyber",  name: "Cypher", emoji: "🤖", color: "#001F3F", accent: "#00BFFF", title: "Cyber Soldier", tagline: "Precision-engineered.", punch: 13, kick: 16, special: 38, specialName: "Neural Blast" },
  { id: "ghost",  name: "Spectra", emoji: "👻", color: "#1A002E", accent: "#BF5FFF", title: "Ghost Warrior", tagline: "Can't fight the invisible.", punch: 10, kick: 15, special: 45, specialName: "Phase Shift" },
  { id: "monk",   name: "Ember",  emoji: "🔥", color: "#1A0000", accent: "#FF4500", title: "Fire Monk", tagline: "Forged in sacred flame.", punch: 14, kick: 20, special: 35, specialName: "Inferno Fist" },
  { id: "boxer",  name: "Volt",   emoji: "⚡", color: "#1A1700", accent: "#FFD700", title: "Electric Boxer", tagline: "10,000 volts of fury.", punch: 16, kick: 13, special: 36, specialName: "Thunder Combo" },
  { id: "samurai",name: "Kage",   emoji: "⚔️", color: "#0A0A0A", accent: "#C0C0C0", title: "Dark Samurai", tagline: "Honor died. He didn't.", punch: 12, kick: 22, special: 42, specialName: "Void Slash" },
  { id: "alien",  name: "Xeron",  emoji: "👾", color: "#001A12", accent: "#00FF99", title: "Alien Gladiator", tagline: "From a war dimension.", punch: 13, kick: 17, special: 38, specialName: "Gravity Crush" },
  { id: "king",   name: "The King",emoji: "👑", color: "#1A0028", accent: "#FF00CC", title: "Invisible King", tagline: "He rules from the shadows.", punch: 15, kick: 19, special: 50, specialName: "Oblivion" },
];

type Screen = "menu" | "select" | "fight" | "roundEnd" | "over";
type FState = { hp: number; power: number; blocking: boolean; wins: number };

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InvisibleWar() {
  const insets = useSafeAreaInsets();
  const colors = useColors();

  const [screen, setScreen]       = useState<Screen>("menu");
  const [playerFighter, setPlayer] = useState<Fighter>(FIGHTERS[0]);
  const [enemyFighter,  setEnemy]  = useState<Fighter>(FIGHTERS[7]);
  const [round, setRound]          = useState(1);
  const [roundWinner, setRWinner]  = useState<"player" | "enemy" | null>(null);
  const [matchWinner, setMWinner]  = useState<"player" | "enemy" | null>(null);
  const [combo, setCombo]          = useState(0);
  const [hitMsg, setHitMsg]        = useState("");

  const player = useRef<FState>({ hp: 100, power: 0, blocking: false, wins: 0 });
  const enemy  = useRef<FState>({ hp: 100, power: 0, blocking: false, wins: 0 });
  const aiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy   = useRef(false);

  // Animated values
  const playerShake  = useRef(new Animated.Value(0)).current;
  const enemyShake   = useRef(new Animated.Value(0)).current;
  const playerFlash  = useRef(new Animated.Value(0)).current;
  const enemyFlash   = useRef(new Animated.Value(0)).current;
  const screenFlash  = useRef(new Animated.Value(0)).current;
  const hitMsgAnim   = useRef(new Animated.Value(0)).current;
  const comboAnim    = useRef(new Animated.Value(1)).current;

  // Force re-render for HP/power display
  const [tick, setTick] = useState(0);
  const bump = () => setTick(t => t + 1);

  const shake = (anim: Animated.Value) =>
    Animated.sequence([
      Animated.timing(anim, { toValue: 10,  duration: 40,  useNativeDriver: true }),
      Animated.timing(anim, { toValue: -10, duration: 40,  useNativeDriver: true }),
      Animated.timing(anim, { toValue: 6,   duration: 30,  useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0,   duration: 30,  useNativeDriver: true }),
    ]).start();

  const flash = (anim: Animated.Value) =>
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

  const showHit = (msg: string) => {
    setHitMsg(msg);
    hitMsgAnim.setValue(0);
    Animated.timing(hitMsgAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  };

  const burstCombo = () => {
    comboAnim.setValue(1.5);
    Animated.spring(comboAnim, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
  };

  const doScreenFlash = () => {
    screenFlash.setValue(1);
    Animated.timing(screenFlash, { toValue: 0, duration: 400, useNativeDriver: true }).start();
  };

  const applyDamage = (
    target: React.MutableRefObject<FState>,
    raw: number,
    targetShake: Animated.Value,
    targetFlash: Animated.Value,
  ) => {
    const dmg = target.current.blocking ? Math.max(1, Math.round(raw * 0.15)) : raw;
    target.current.hp = Math.max(0, target.current.hp - dmg);
    shake(targetShake);
    flash(targetFlash);
    bump();
    return dmg;
  };

  const endRound = useCallback((winner: "player" | "enemy") => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    if (winner === "player") player.current.wins++;
    else enemy.current.wins++;

    const pw = player.current.wins;
    const ew = enemy.current.wins;
    const needed = Math.ceil(3 / 2); // best of 3 → 2 wins

    if (pw >= needed || ew >= needed) {
      setMWinner(pw >= needed ? "player" : "enemy");
      setScreen("over");
    } else {
      setRWinner(winner);
      setScreen("roundEnd");
    }
  }, []);

  const checkEnd = useCallback(() => {
    if (player.current.hp <= 0) endRound("enemy");
    else if (enemy.current.hp <= 0) endRound("player");
  }, [endRound]);

  // ── Player Actions ────────────────────────────────────────────────────────
  const playerAttack = useCallback((type: "punch" | "kick" | "special") => {
    if (screen !== "fight" || busy.current) return;
    if (type === "special" && player.current.power < 100) return;

    busy.current = true;
    enemy.current.blocking = false; // player action, not a block

    let raw = 0;
    let msg = "";
    if (type === "punch")   { raw = playerFighter.punch + Math.floor(Math.random() * 5); msg = "PUNCH!"; player.current.power = Math.min(100, player.current.power + 10); }
    else if (type === "kick") { raw = playerFighter.kick + Math.floor(Math.random() * 5); msg = "KICK!";  player.current.power = Math.min(100, player.current.power + 15); }
    else                      { raw = playerFighter.special; msg = playerFighter.specialName.toUpperCase() + "!"; player.current.power = 0; doScreenFlash(); }

    const newCombo = combo + 1;
    const multiplied = type === "special" ? raw : Math.round(raw * (1 + (newCombo > 2 ? (newCombo - 2) * 0.1 : 0)));
    const dmg = applyDamage(enemy, multiplied, enemyShake, enemyFlash);
    setCombo(newCombo);
    burstCombo();
    showHit(newCombo > 2 ? `${newCombo}× COMBO — ${dmg} DMG!` : `${msg} ${dmg} DMG`);
    bump();

    setTimeout(() => {
      busy.current = false;
      checkEnd();
    }, 300);
  }, [screen, playerFighter, combo, checkEnd]);

  const playerBlock = useCallback(() => {
    if (screen !== "fight") return;
    player.current.blocking = true;
    player.current.power = Math.min(100, player.current.power + 5);
    showHit("BLOCKING...");
    bump();
    setTimeout(() => { player.current.blocking = false; bump(); }, 800);
  }, [screen]);

  const playerDodge = useCallback(() => {
    if (screen !== "fight" || busy.current) return;
    const dodged = Math.random() < 0.55;
    showHit(dodged ? "DODGED! ✓" : "MISS!");
    if (dodged) {
      player.current.blocking = true;
      setTimeout(() => { player.current.blocking = false; bump(); }, 600);
    }
  }, [screen]);

  // ── AI Logic ──────────────────────────────────────────────────────────────
  const scheduleAI = useCallback(() => {
    if (aiTimer.current) clearTimeout(aiTimer.current);
    const delay = 1200 + Math.random() * 800;
    aiTimer.current = setTimeout(() => {
      if (screen !== "fight") return;
      const hp = enemy.current.hp;
      const power = enemy.current.power;
      const low = hp < 30;

      // reset enemy block
      enemy.current.blocking = false;

      const roll = Math.random();
      if (low && roll < 0.35) {
        enemy.current.blocking = true;
        bump();
        setTimeout(() => { enemy.current.blocking = false; bump(); }, 700);
      } else if (power >= 100 && roll < 0.2) {
        const raw = enemyFighter.special;
        applyDamage(player, raw, playerShake, playerFlash);
        setCombo(0);
        doScreenFlash();
        showHit(`ENEMY: ${enemyFighter.specialName.toUpperCase()}!`);
        enemy.current.power = 0;
        bump();
        checkEnd();
      } else if (roll < 0.5) {
        const raw = enemyFighter.punch + Math.floor(Math.random() * 4);
        const dmg = applyDamage(player, raw, playerShake, playerFlash);
        setCombo(0);
        showHit(`ENEMY STRIKES! ${dmg} DMG`);
        enemy.current.power = Math.min(100, enemy.current.power + 10);
        bump();
        checkEnd();
      } else if (roll < 0.8) {
        const raw = enemyFighter.kick + Math.floor(Math.random() * 4);
        const dmg = applyDamage(player, raw, playerShake, playerFlash);
        setCombo(0);
        showHit(`ENEMY KICK! ${dmg} DMG`);
        enemy.current.power = Math.min(100, enemy.current.power + 15);
        bump();
        checkEnd();
      } else {
        enemy.current.blocking = true;
        bump();
        setTimeout(() => { enemy.current.blocking = false; bump(); }, 700);
      }

      scheduleAI();
    }, delay);
  }, [screen, enemyFighter, checkEnd]);

  useEffect(() => {
    if (screen === "fight") scheduleAI();
    return () => { if (aiTimer.current) clearTimeout(aiTimer.current); };
  }, [screen, scheduleAI]);

  // ── Screens ───────────────────────────────────────────────────────────────
  const startFight = () => {
    player.current = { hp: 100, power: 0, blocking: false, wins: player.current.wins };
    enemy.current  = { hp: 100, power: 0, blocking: false, wins: enemy.current.wins  };
    setCombo(0);
    setHitMsg("");
    busy.current = false;
    setScreen("fight");
    bump();
  };

  const nextRound = () => {
    setRound(r => r + 1);
    setRWinner(null);
    startFight();
  };

  const resetGame = () => {
    player.current = { hp: 100, power: 0, blocking: false, wins: 0 };
    enemy.current  = { hp: 100, power: 0, blocking: false, wins: 0 };
    setRound(1);
    setCombo(0);
    setMWinner(null);
    setRWinner(null);
    setScreen("menu");
    bump();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (screen === "menu") return <MenuScreen insets={insets} onPlay={() => setScreen("select")} onBack={() => router.back()} />;

  if (screen === "select") return (
    <SelectScreen
      insets={insets}
      selected={playerFighter}
      onSelect={(f) => {
        setPlayer(f);
        const foes = FIGHTERS.filter(x => x.id !== f.id);
        setEnemy(foes[Math.floor(Math.random() * foes.length)]);
      }}
      onFight={() => { player.current = { hp: 100, power: 0, blocking: false, wins: 0 }; enemy.current = { hp: 100, power: 0, blocking: false, wins: 0 }; setRound(1); startFight(); }}
      onBack={() => setScreen("menu")}
    />
  );

  if (screen === "roundEnd") return (
    <RoundEndScreen insets={insets} winner={roundWinner!} round={round} playerWins={player.current.wins} enemyWins={enemy.current.wins} onNext={nextRound} />
  );

  if (screen === "over") return (
    <GameOverScreen insets={insets} winner={matchWinner!} player={playerFighter} enemy={enemyFighter} onRematch={resetGame} onMenu={resetGame} />
  );

  // ── Fight Screen ───────────────────────────────────────────────────────────
  const pct = (v: number) => `${Math.max(0, v)}%`;
  const hpColor = (hp: number) => hp > 50 ? "#00FF66" : hp > 25 ? "#FFD700" : "#FF3B3B";

  return (
    <View style={[fs.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Screen flash overlay */}
      <Animated.View pointerEvents="none" style={[fs.overlay, { opacity: screenFlash }]} />

      {/* HUD */}
      <View style={fs.hud}>
        {/* Player HP */}
        <View style={fs.hudSide}>
          <Text style={fs.fname} numberOfLines={1}>{playerFighter.name}</Text>
          <View style={fs.barBg}>
            <Animated.View style={[fs.barFill, { width: pct(player.current.hp), backgroundColor: hpColor(player.current.hp) }]} />
          </View>
          <View style={fs.powerBarBg}>
            <View style={[fs.powerFill, { width: pct(player.current.power) }]} />
          </View>
        </View>

        {/* Round info */}
        <View style={fs.hudCenter}>
          <View style={fs.winsRow}>
            {[...Array(player.current.wins)].map((_, i) => <View key={i} style={[fs.winDot, { backgroundColor: "#00FF66" }]} />)}
          </View>
          <Text style={fs.roundTxt}>R{round}</Text>
          <View style={fs.winsRow}>
            {[...Array(enemy.current.wins)].map((_, i) => <View key={i} style={[fs.winDot, { backgroundColor: "#FF3B3B" }]} />)}
          </View>
        </View>

        {/* Enemy HP */}
        <View style={[fs.hudSide, { alignItems: "flex-end" }]}>
          <Text style={fs.fname} numberOfLines={1}>{enemyFighter.name}</Text>
          <View style={fs.barBg}>
            <Animated.View style={[fs.barFill, { width: pct(enemy.current.hp), backgroundColor: hpColor(enemy.current.hp), alignSelf: "flex-end" }]} />
          </View>
          <View style={fs.powerBarBg}>
            <View style={[fs.powerFill, { width: pct(enemy.current.power), alignSelf: "flex-end" }]} />
          </View>
        </View>
      </View>

      {/* Arena */}
      <LinearGradient colors={["#0a0014", "#14001e", "#0a001a"]} style={fs.arena}>
        {/* Hit message */}
        <Animated.Text style={[fs.hitMsg, { opacity: hitMsgAnim }]}>{hitMsg}</Animated.Text>

        {/* Combo */}
        {combo > 1 && (
          <Animated.Text style={[fs.comboTxt, { transform: [{ scale: comboAnim }] }]}>
            {combo}× COMBO!
          </Animated.Text>
        )}

        {/* Fighters */}
        <View style={fs.fightRow}>
          {/* Player */}
          <Animated.View style={[fs.fighterBox, {
            transform: [{ translateX: playerShake }],
            backgroundColor: playerFighter.accent + "22",
            borderColor: player.current.blocking ? "#00FF66" : playerFighter.accent,
          }]}>
            <Animated.View style={{ opacity: Animated.subtract(1, playerFlash) }}>
              <Text style={fs.fighterEmoji}>{playerFighter.emoji}</Text>
            </Animated.View>
            <Text style={[fs.fighterHp, { color: hpColor(player.current.hp) }]}>{player.current.hp} HP</Text>
            {player.current.blocking && <Text style={fs.blockLabel}>BLOCK</Text>}
          </Animated.View>

          <Text style={fs.vsText}>VS</Text>

          {/* Enemy */}
          <Animated.View style={[fs.fighterBox, {
            transform: [{ translateX: enemyShake }],
            backgroundColor: enemyFighter.accent + "22",
            borderColor: enemy.current.blocking ? "#00FF66" : enemyFighter.accent,
          }]}>
            <Animated.View style={{ opacity: Animated.subtract(1, enemyFlash) }}>
              <Text style={fs.fighterEmoji}>{enemyFighter.emoji}</Text>
            </Animated.View>
            <Text style={[fs.fighterHp, { color: hpColor(enemy.current.hp) }]}>{enemy.current.hp} HP</Text>
            {enemy.current.blocking && <Text style={fs.blockLabel}>BLOCK</Text>}
          </Animated.View>
        </View>

        {/* Power labels */}
        <View style={fs.powerLabels}>
          <Text style={[fs.powerLabel, { color: playerFighter.accent }]}>
            ⚡ {player.current.power >= 100 ? "READY!" : `${player.current.power}%`}
          </Text>
          <Text style={[fs.powerLabel, { color: enemyFighter.accent }]}>
            {enemy.current.power >= 100 ? "READY!" : `${enemy.current.power}%`} ⚡
          </Text>
        </View>
      </LinearGradient>

      {/* Controls */}
      <View style={fs.controls}>
        <View style={fs.btnRow}>
          <TouchableOpacity style={[fs.btn, { backgroundColor: "#1a1a3a", borderColor: "#6C63FF" }]} onPress={() => playerAttack("punch")}>
            <Text style={fs.btnEmoji}>👊</Text>
            <Text style={fs.btnLabel}>PUNCH</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[fs.btn, { backgroundColor: "#1a0020", borderColor: "#FF3B3B" }]} onPress={() => playerAttack("kick")}>
            <Text style={fs.btnEmoji}>🦵</Text>
            <Text style={fs.btnLabel}>KICK</Text>
          </TouchableOpacity>
        </View>
        <View style={fs.btnRow}>
          <TouchableOpacity style={[fs.btn, { backgroundColor: "#001a10", borderColor: "#00FF66" }]} onPress={playerBlock}>
            <Text style={fs.btnEmoji}>🛡️</Text>
            <Text style={fs.btnLabel}>BLOCK</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[fs.btn, fs.specialBtn, player.current.power < 100 && fs.btnDisabled]}
            onPress={() => playerAttack("special")}
            disabled={player.current.power < 100}
          >
            <Text style={fs.btnEmoji}>💥</Text>
            <Text style={[fs.btnLabel, { color: "#FF00CC" }]}>SPECIAL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Menu Screen ───────────────────────────────────────────────────────────────
function MenuScreen({ insets, onPlay, onBack }: { insets: any; onPlay: () => void; onBack: () => void }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <LinearGradient colors={["#000000", "#0a001a", "#14002e"]} style={[ms.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={ms.backBtn} onPress={onBack}>
        <Text style={ms.backTxt}>← Back</Text>
      </TouchableOpacity>
      <View style={ms.center}>
        <Text style={ms.subtitle}>⚔️  INVISIBLE WAR  ⚔️</Text>
        <Animated.Text style={[ms.title, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }]}>
          INVISIBLE{"\n"}WAR
        </Animated.Text>
        <Text style={ms.tagline}>The world is controlled by shadows.{"\n"}Will you rise or fall?</Text>

        <View style={ms.charPreview}>
          {FIGHTERS.slice(0, 4).map(f => (
            <View key={f.id} style={[ms.previewBadge, { borderColor: f.accent }]}>
              <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={ms.playBtn} onPress={onPlay} activeOpacity={0.85}>
          <LinearGradient colors={["#6C63FF", "#FF00CC"]} style={ms.playGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={ms.playTxt}>ENTER THE TOURNAMENT</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={ms.modesTxt}>8 Fighters · 3 Rounds · Special Moves · AI Opponent</Text>
      </View>
    </LinearGradient>
  );
}

// ── Select Screen ─────────────────────────────────────────────────────────────
function SelectScreen({ insets, selected, onSelect, onFight, onBack }: { insets: any; selected: Fighter; onSelect: (f: Fighter) => void; onFight: () => void; onBack: () => void }) {
  return (
    <LinearGradient colors={["#000", "#0a001a"]} style={[ss.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={ss.header}>
        <TouchableOpacity onPress={onBack}><Text style={ss.back}>← Back</Text></TouchableOpacity>
        <Text style={ss.title}>SELECT FIGHTER</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Selected fighter details */}
      <View style={[ss.selectedCard, { borderColor: selected.accent }]}>
        <Text style={{ fontSize: 52 }}>{selected.emoji}</Text>
        <View style={ss.selectedInfo}>
          <Text style={[ss.selName, { color: selected.accent }]}>{selected.name}</Text>
          <Text style={ss.selTitle}>{selected.title}</Text>
          <Text style={ss.selTag}>"{selected.tagline}"</Text>
          <Text style={ss.selSpecial}>💥 {selected.specialName}</Text>
          <View style={ss.statsRow}>
            <Text style={ss.stat}>👊 {selected.punch}</Text>
            <Text style={ss.stat}>🦵 {selected.kick}</Text>
            <Text style={[ss.stat, { color: selected.accent }]}>⚡ {selected.special}</Text>
          </View>
        </View>
      </View>

      {/* Grid */}
      <ScrollView contentContainerStyle={ss.grid} showsVerticalScrollIndicator={false}>
        {FIGHTERS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[ss.card, { borderColor: selected.id === f.id ? f.accent : "#333", backgroundColor: selected.id === f.id ? f.accent + "22" : "#111" }]}
            onPress={() => onSelect(f)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 30 }}>{f.emoji}</Text>
            <Text style={[ss.cardName, { color: selected.id === f.id ? f.accent : "#ccc" }]}>{f.name}</Text>
            <Text style={ss.cardTitle}>{f.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={ss.fightBtn} onPress={onFight} activeOpacity={0.85}>
        <LinearGradient colors={["#FF3B3B", "#6C63FF"]} style={ss.fightGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={ss.fightTxt}>FIGHT!</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ── Round End ─────────────────────────────────────────────────────────────────
function RoundEndScreen({ insets, winner, round, playerWins, enemyWins, onNext }: { insets: any; winner: "player" | "enemy"; round: number; playerWins: number; enemyWins: number; onNext: () => void }) {
  return (
    <LinearGradient colors={["#000", "#0a001a"]} style={[rs.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Text style={rs.round}>ROUND {round}</Text>
      <Text style={[rs.result, { color: winner === "player" ? "#00FF66" : "#FF3B3B" }]}>
        {winner === "player" ? "YOU WIN!" : "YOU LOSE!"}
      </Text>
      <View style={rs.winsRow}>
        <Text style={rs.winsLabel}>Your wins: <Text style={{ color: "#00FF66" }}>{playerWins}</Text></Text>
        <Text style={rs.winsLabel}>Enemy wins: <Text style={{ color: "#FF3B3B" }}>{enemyWins}</Text></Text>
      </View>
      <TouchableOpacity style={rs.nextBtn} onPress={onNext}>
        <Text style={rs.nextTxt}>ROUND {round + 1} →</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ── Game Over ─────────────────────────────────────────────────────────────────
function GameOverScreen({ insets, winner, player, enemy, onRematch, onMenu }: { insets: any; winner: "player" | "enemy"; player: Fighter; enemy: Fighter; onRematch: () => void; onMenu: () => void }) {
  return (
    <LinearGradient colors={["#000", "#0a001a"]} style={[go.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Text style={go.title}>{winner === "player" ? "VICTORY!" : "DEFEATED!"}</Text>
      <Text style={{ fontSize: 72, marginVertical: 16 }}>{winner === "player" ? player.emoji : enemy.emoji}</Text>
      <Text style={[go.name, { color: winner === "player" ? player.accent : enemy.accent }]}>
        {winner === "player" ? player.name : enemy.name}
      </Text>
      <Text style={go.sub}>{winner === "player" ? "You claimed the Invisible War throne!" : "The shadows reclaim you..."}</Text>
      <TouchableOpacity style={[go.btn, { backgroundColor: "#6C63FF" }]} onPress={onRematch}>
        <Text style={go.btnTxt}>REMATCH</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[go.btn, { backgroundColor: "#333" }]} onPress={onMenu}>
        <Text style={go.btnTxt}>MAIN MENU</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const fs = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#000" },
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: "#6C63FF", zIndex: 99 },
  hud:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#070010", gap: 8 },
  hudSide:     { flex: 1, gap: 4 },
  hudCenter:   { alignItems: "center", gap: 2 },
  fname:       { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff" },
  barBg:       { height: 10, backgroundColor: "#222", borderRadius: 5, overflow: "hidden" },
  barFill:     { height: "100%", borderRadius: 5 },
  powerBarBg:  { height: 5, backgroundColor: "#1a1a1a", borderRadius: 3, overflow: "hidden" },
  powerFill:   { height: "100%", backgroundColor: "#FF00CC", borderRadius: 3 },
  roundTxt:    { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  winsRow:     { flexDirection: "row", gap: 4, height: 8 },
  winDot:      { width: 8, height: 8, borderRadius: 4 },
  arena:       { flex: 1, justifyContent: "center", alignItems: "center" },
  hitMsg:      { fontFamily: "Inter_700Bold", fontSize: 20, color: "#FFD700", textAlign: "center", marginBottom: 8, textShadowColor: "#FFD700", textShadowRadius: 8 },
  comboTxt:    { fontFamily: "Inter_700Bold", fontSize: 16, color: "#FF00CC", textAlign: "center", marginBottom: 4 },
  fightRow:    { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16 },
  fighterBox:  { alignItems: "center", justifyContent: "center", width: (SW - 80) / 2, aspectRatio: 0.9, borderRadius: 18, borderWidth: 2, gap: 6 },
  fighterEmoji:{ fontSize: Platform.OS === "web" ? 70 : 60 },
  fighterHp:   { fontFamily: "Inter_700Bold", fontSize: 14 },
  blockLabel:  { fontFamily: "Inter_700Bold", fontSize: 10, color: "#00FF66", backgroundColor: "#00FF6622", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  vsText:      { fontFamily: "Inter_700Bold", fontSize: 18, color: "#555" },
  powerLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 12, width: "100%" },
  powerLabel:  { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  controls:    { backgroundColor: "#070010", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  btnRow:      { flexDirection: "row", gap: 8 },
  btn:         { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, gap: 3 },
  specialBtn:  { backgroundColor: "#1a0020", borderColor: "#FF00CC" },
  btnDisabled: { opacity: 0.35 },
  btnEmoji:    { fontSize: 20 },
  btnLabel:    { fontFamily: "Inter_700Bold", fontSize: 10, color: "#fff", letterSpacing: 0.5 },
});

const ms = StyleSheet.create({
  root:         { flex: 1, alignItems: "center" },
  backBtn:      { alignSelf: "flex-start", padding: 16 },
  backTxt:      { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#888" },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  subtitle:     { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#6C63FF", letterSpacing: 3 },
  title:        { fontFamily: "Inter_700Bold", fontSize: 54, color: "#fff", textAlign: "center", lineHeight: 58, textShadowColor: "#6C63FF", textShadowRadius: 20 },
  tagline:      { fontFamily: "Inter_400Regular", fontSize: 14, color: "#888", textAlign: "center", lineHeight: 22 },
  charPreview:  { flexDirection: "row", gap: 12, marginVertical: 8 },
  previewBadge: { width: 52, height: 52, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  playBtn:      { width: "100%", borderRadius: 16, overflow: "hidden" },
  playGrad:     { paddingVertical: 16, alignItems: "center" },
  playTxt:      { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", letterSpacing: 1.5 },
  modesTxt:     { fontFamily: "Inter_400Regular", fontSize: 11, color: "#555", textAlign: "center" },
});

const ss = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  back:         { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#888" },
  title:        { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  selectedCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12, backgroundColor: "#111", borderRadius: 16, padding: 14, borderWidth: 1.5, gap: 14 },
  selectedInfo: { flex: 1, gap: 3 },
  selName:      { fontFamily: "Inter_700Bold", fontSize: 18 },
  selTitle:     { fontFamily: "Inter_500Medium", fontSize: 12, color: "#888" },
  selTag:       { fontFamily: "Inter_400Regular", fontSize: 11, color: "#666", fontStyle: "italic" },
  selSpecial:   { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#FF00CC" },
  statsRow:     { flexDirection: "row", gap: 10, marginTop: 2 },
  stat:         { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#ccc" },
  grid:         { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10, paddingBottom: 16 },
  card:         { width: (SW - 52) / 4, alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 14, borderWidth: 1.5, gap: 4 },
  cardName:     { fontFamily: "Inter_700Bold", fontSize: 10 },
  cardTitle:    { fontFamily: "Inter_400Regular", fontSize: 8, color: "#666" },
  fightBtn:     { marginHorizontal: 16, marginTop: 8, marginBottom: 8, borderRadius: 16, overflow: "hidden" },
  fightGrad:    { paddingVertical: 16, alignItems: "center" },
  fightTxt:     { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff", letterSpacing: 2 },
});

const rs = StyleSheet.create({
  root:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  round:     { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#666", letterSpacing: 3 },
  result:    { fontFamily: "Inter_700Bold", fontSize: 48, textShadowRadius: 20 },
  winsRow:   { gap: 8 },
  winsLabel: { fontFamily: "Inter_500Medium", fontSize: 16, color: "#888" },
  nextBtn:   { backgroundColor: "#6C63FF", paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16, marginTop: 16 },
  nextTxt:   { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", letterSpacing: 1 },
});

const go = StyleSheet.create({
  root:   { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  title:  { fontFamily: "Inter_700Bold", fontSize: 48, color: "#FFD700", textShadowColor: "#FFD700", textShadowRadius: 20 },
  name:   { fontFamily: "Inter_700Bold", fontSize: 28 },
  sub:    { fontFamily: "Inter_400Regular", fontSize: 14, color: "#888", textAlign: "center" },
  btn:    { width: "100%", paddingVertical: 14, borderRadius: 16, alignItems: "center", marginTop: 8 },
  btnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", letterSpacing: 1 },
});
