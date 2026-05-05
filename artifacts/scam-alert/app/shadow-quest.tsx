import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Image,
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

// ── Data ──────────────────────────────────────────────────────────────────────
const MONSTERS = [
  { name: "Goblin",     emoji: "👺", hp: 30,  atk: [4,8],  def: 1, xp: 20, gold: 10, color: "#10B981" },
  { name: "Skeleton",   emoji: "💀", hp: 40,  atk: [5,10], def: 2, xp: 30, gold: 15, color: "#9CA3AF" },
  { name: "Dark Witch", emoji: "🧙", hp: 50,  atk: [8,14], def: 3, xp: 45, gold: 20, color: "#8B5CF6" },
  { name: "Troll",      emoji: "👹", hp: 70,  atk: [9,16], def: 5, xp: 60, gold: 28, color: "#DC2626" },
  { name: "Dragon",     emoji: "🐉", hp: 120, atk: [14,22],def: 8, xp: 120,gold: 60, color: "#F97316" },
];

const BOSSES = [
  { name: "Shadow Lord",  emoji: "😈", hp: 160, atk: [16,26], def: 10, xp: 300, gold: 150, color: "#7C3AED" },
  { name: "Demon King",   emoji: "👿", hp: 220, atk: [20,32], def: 14, xp: 500, gold: 250, color: "#991B1B" },
];

const ITEMS = [
  { id: "potion",   name: "Health Potion", emoji: "🧪", desc: "Restore 40 HP",          color: "#10B981" },
  { id: "elixir",   name: "Elixir",        emoji: "💜", desc: "Restore 80 HP",          color: "#8B5CF6" },
  { id: "bomb",     name: "Fire Bomb",     emoji: "💣", desc: "Deal 50 damage",         color: "#EF4444" },
  { id: "shield",   name: "Iron Shield",   emoji: "🛡️", desc: "+5 DEF for this fight",  color: "#3B82F6" },
  { id: "sword",    name: "Flame Sword",   emoji: "⚔️", desc: "+10 ATK for this fight", color: "#F59E0B" },
];

// ── Map tiles ─────────────────────────────────────────────────────────────────
type TileType = "floor" | "wall" | "monster" | "chest" | "boss" | "stairs" | "player" | "visited";

const MAP_SIZE = 7;

function generateMap(floor: number): TileType[][] {
  const m: TileType[][] = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill("floor"));
  // Walls around edge
  for (let r = 0; r < MAP_SIZE; r++)
    for (let c = 0; c < MAP_SIZE; c++)
      if (r === 0 || c === 0 || r === MAP_SIZE - 1 || c === MAP_SIZE - 1) m[r][c] = "wall";
  // Random obstacles
  for (let i = 0; i < 4; i++) {
    const r = 1 + Math.floor(Math.random() * (MAP_SIZE - 2));
    const c = 1 + Math.floor(Math.random() * (MAP_SIZE - 2));
    if (r !== 1 || c !== 1) m[r][c] = "wall";
  }
  // Place monsters
  for (let i = 0; i < 3 + floor; i++) {
    let r, c, tries = 0;
    do { r = 1 + Math.floor(Math.random() * (MAP_SIZE - 2)); c = 1 + Math.floor(Math.random() * (MAP_SIZE - 2)); tries++; }
    while ((m[r][c] !== "floor" || (r === 1 && c === 1)) && tries < 20);
    if (m[r][c] === "floor") m[r][c] = "monster";
  }
  // Chest
  let r, c, tries = 0;
  do { r = 1 + Math.floor(Math.random() * (MAP_SIZE - 2)); c = 1 + Math.floor(Math.random() * (MAP_SIZE - 2)); tries++; }
  while (m[r][c] !== "floor" && tries < 20);
  if (m[r][c] === "floor") m[r][c] = "chest";
  // Boss (floor 3+) or stairs
  m[MAP_SIZE - 2][MAP_SIZE - 2] = floor % 3 === 0 ? "boss" : "stairs";
  // Player start
  m[1][1] = "player";
  return m;
}

const TILE_EMOJIS: Record<TileType, string> = {
  floor: "⬜", wall: "🧱", monster: "👾", chest: "🎁",
  boss: "💀", stairs: "🪜", player: "🧙", visited: "·",
};
const TILE_BG: Record<TileType, string> = {
  floor: "#1A1A2E", wall: "#0D0D1A", monster: "#2A1A0A",
  chest: "#1A2A0A", boss: "#2A0A0A", stairs: "#0A1A2A",
  player: "#0A2A1A", visited: "#111118",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen = "menu" | "map" | "combat" | "shop" | "gameover" | "win";
type Monster = typeof MONSTERS[0] | typeof BOSSES[0];
type Item = typeof ITEMS[0];

interface PlayerState {
  hp: number; maxHp: number; atk: number; def: number;
  xp: number; level: number; gold: number; floor: number;
  inventory: Item[]; row: number; col: number;
}

type CombatLog = { text: string; color: string };

function initPlayer(): PlayerState {
  return { hp: 100, maxHp: 100, atk: 12, def: 3, xp: 0, level: 1, gold: 50, floor: 1, inventory: [], row: 1, col: 1 };
}

type Leader = { username: string; score: number };

export default function ShadowQuest() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [screen, setScreen] = useState<Screen>("menu");
  const [player, setPlayer] = useState<PlayerState>(initPlayer());
  const [map, setMap] = useState<TileType[][]>([]);
  const [monster, setMonster] = useState<Monster & { currentHp: number; tempDef: number } | null>(null);
  const [combatLog, setCombatLog] = useState<CombatLog[]>([]);
  const [tempAtk, setTempAtk] = useState(0);
  const [tempDef, setTempDef] = useState(0);
  const [combatTurn, setCombatTurn] = useState<"player" | "enemy" | "over">("player");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const fetchLeaders = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "questScores"), orderBy("score", "desc"), limit(5)));
      setLeaders(snap.docs.map(d => d.data() as Leader));
    } catch {}
  }, []);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);

  const shake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const startGame = () => {
    const p = initPlayer();
    setPlayer(p);
    setMap(generateMap(1));
    setCombatLog([]);
    setScreen("map");
  };

  const addLog = (text: string, color = "#ccc") => {
    setCombatLog(prev => [{ text, color }, ...prev.slice(0, 7)]);
  };

  const levelUp = (p: PlayerState, xpGain: number): PlayerState => {
    let { xp, level, maxHp, hp, atk, def } = p;
    xp += xpGain;
    const needed = level * 80;
    if (xp >= needed) {
      xp -= needed; level++;
      maxHp += 20; hp = Math.min(hp + 20, maxHp); atk += 3; def += 1;
      addLog(`⬆️ Level Up! Now Level ${level}!`, "#FFD700");
    }
    return { ...p, xp, level, maxHp, hp, atk, def };
  };

  const movePlayer = (dr: number, dc: number) => {
    const nr = player.row + dr; const nc = player.col + dc;
    if (nr < 0 || nr >= MAP_SIZE || nc < 0 || nc >= MAP_SIZE) return;
    const tile = map[nr][nc];
    if (tile === "wall") return;
    Haptics.selectionAsync();

    const newMap = map.map(r => [...r]);
    newMap[player.row][player.col] = "visited";
    newMap[nr][nc] = "player";

    if (tile === "monster") {
      const m = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
      setMonster({ ...m, currentHp: m.hp, tempDef: 0 });
      setTempAtk(0); setTempDef(0);
      setCombatTurn("player");
      setCombatLog([{ text: `⚔️ A ${m.name} ${m.emoji} appears!`, color: m.color }]);
      setMap(newMap); setPlayer(p => ({ ...p, row: nr, col: nc }));
      setScreen("combat");
    } else if (tile === "boss") {
      const b = player.floor % 2 === 0 ? BOSSES[1] : BOSSES[0];
      setMonster({ ...b, currentHp: b.hp, tempDef: 0 });
      setTempAtk(0); setTempDef(0);
      setCombatTurn("player");
      setCombatLog([{ text: `👿 BOSS: ${b.name}!`, color: "#EF4444" }]);
      setMap(newMap); setPlayer(p => ({ ...p, row: nr, col: nc }));
      setScreen("combat");
    } else if (tile === "chest") {
      const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      const goldBonus = 10 + Math.floor(Math.random() * 20);
      setPlayer(p => ({ ...p, row: nr, col: nc, gold: p.gold + goldBonus, inventory: [...p.inventory, item] }));
      setMap(newMap);
      addLog(`🎁 Found ${item.emoji} ${item.name} + ${goldBonus} gold!`, item.color);
    } else if (tile === "stairs") {
      const nextFloor = player.floor + 1;
      setPlayer(p => ({ ...p, floor: nextFloor, row: 1, col: 1 }));
      const nextMap = generateMap(nextFloor);
      setMap(nextMap);
      addLog(`🪜 Descended to Floor ${nextFloor}!`, "#3B82F6");
    } else {
      setPlayer(p => ({ ...p, row: nr, col: nc }));
      setMap(newMap);
    }
  };

  // ── Combat ────────────────────────────────────────────────────────────────
  const combatAttack = useCallback(() => {
    if (!monster || combatTurn !== "player") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const playerAtk = player.atk + tempAtk;
    const dmgToEnemy = Math.max(1, playerAtk - monster.tempDef + Math.floor(Math.random() * 6));
    const newEnemyHp = monster.currentHp - dmgToEnemy;
    addLog(`⚔️ You hit ${monster.name} for ${dmgToEnemy} dmg!`, "#10B981");

    if (newEnemyHp <= 0) {
      addLog(`🏆 ${monster.name} defeated! +${monster.xp} XP, +${monster.gold} gold`, "#FFD700");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const updated = levelUp({ ...player, gold: player.gold + monster.gold }, monster.xp);
      setPlayer(updated); setMonster(null); setTempAtk(0); setTempDef(0);
      setCombatTurn("over"); setScreen("map");
    } else {
      setMonster(m => m ? { ...m, currentHp: newEnemyHp } : null);
      setCombatTurn("enemy");
      setTimeout(enemyTurn, 600);
    }
  }, [monster, combatTurn, player, tempAtk]);

  const enemyTurn = useCallback(() => {
    if (!monster) return;
    const m = monster;
    const [minA, maxA] = m.atk;
    const atkVal = minA + Math.floor(Math.random() * (maxA - minA + 1));
    const dmgToPlayer = Math.max(1, atkVal - player.def - tempDef);
    shake();
    addLog(`👾 ${m.name} hits you for ${dmgToPlayer} dmg!`, m.color);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const newHp = player.hp - dmgToPlayer;
    if (newHp <= 0) {
      addLog(`💀 You were defeated on Floor ${player.floor}...`, "#EF4444");
      setPlayer(p => ({ ...p, hp: 0 }));
      setCombatTurn("over");
      setTimeout(() => {
        saveScore(player.floor * 100 + player.gold);
        setScreen("gameover");
      }, 800);
    } else {
      setPlayer(p => ({ ...p, hp: newHp }));
      setCombatTurn("player");
    }
  }, [monster, player, tempDef]);

  const combatFlee = useCallback(() => {
    if (combatTurn !== "player") return;
    Haptics.selectionAsync();
    if (Math.random() < 0.5) {
      addLog("🏃 Escaped!", "#F59E0B");
      setMonster(null); setTempAtk(0); setTempDef(0); setCombatTurn("player"); setScreen("map");
    } else {
      addLog("❌ Couldn't escape!", "#EF4444");
      setCombatTurn("enemy");
      setTimeout(enemyTurn, 600);
    }
  }, [combatTurn, enemyTurn]);

  const useItem = useCallback((item: Item, idx: number) => {
    if (combatTurn !== "player") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newInv = player.inventory.filter((_, i) => i !== idx);
    if (item.id === "potion") {
      setPlayer(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + 40), inventory: newInv }));
      addLog("🧪 Restored 40 HP!", "#10B981");
      setCombatTurn("enemy"); setTimeout(enemyTurn, 600);
    } else if (item.id === "elixir") {
      setPlayer(p => ({ ...p, hp: Math.min(p.maxHp, p.hp + 80), inventory: newInv }));
      addLog("💜 Restored 80 HP!", "#8B5CF6");
      setCombatTurn("enemy"); setTimeout(enemyTurn, 600);
    } else if (item.id === "bomb") {
      if (!monster) return;
      const newHp = monster.currentHp - 50;
      addLog("💣 Fire Bomb! -50 enemy HP!", "#EF4444");
      setPlayer(p => ({ ...p, inventory: newInv }));
      if (newHp <= 0) {
        addLog(`🏆 ${monster.name} defeated! +${monster.xp} XP`, "#FFD700");
        const updated = levelUp({ ...player, gold: player.gold + monster.gold, inventory: newInv }, monster.xp);
        setPlayer(updated); setMonster(null); setCombatTurn("over"); setScreen("map");
      } else {
        setMonster(m => m ? { ...m, currentHp: newHp } : null);
        setCombatTurn("enemy"); setTimeout(enemyTurn, 600);
      }
    } else if (item.id === "shield") {
      setTempDef(5); setPlayer(p => ({ ...p, inventory: newInv }));
      addLog("🛡️ +5 DEF this fight!", "#3B82F6");
      setCombatTurn("enemy"); setTimeout(enemyTurn, 600);
    } else if (item.id === "sword") {
      setTempAtk(10); setPlayer(p => ({ ...p, inventory: newInv }));
      addLog("⚔️ +10 ATK this fight!", "#F59E0B");
      setCombatTurn("enemy"); setTimeout(enemyTurn, 600);
    }
  }, [combatTurn, player, monster, enemyTurn]);

  const saveScore = async (score: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "questScores"), {
        userId: user.uid, username: profile?.username ?? "Hero",
        score, createdAt: serverTimestamp(),
      });
      await fetchLeaders();
    } catch {}
  };

  // ── Render: Menu ──────────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <View style={[Q.screen, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={Q.back}>
          <Image source={APP_ICON} style={Q.backIcon} resizeMode="cover" />
        </TouchableOpacity>
        <View style={Q.menuCenter}>
          <Text style={{ fontSize: 72 }}>🧙</Text>
          <Text style={Q.title}>Shadow Quest</Text>
          <Text style={Q.subtitle}>Dungeon RPG — Fight · Loot · Level Up</Text>
          <View style={Q.featureRow}>
            {[["⚔️","Combat"],["🎁","Loot"],["⬆️","Level Up"],["🐉","Bosses"]].map(([e,l]) => (
              <View key={l} style={Q.featureBox}><Text style={{ fontSize: 22 }}>{e}</Text><Text style={Q.featureLbl}>{l}</Text></View>
            ))}
          </View>
          <TouchableOpacity style={Q.startBtn} onPress={startGame}>
            <Text style={Q.startBtnTxt}>⚔️ BEGIN QUEST</Text>
          </TouchableOpacity>
        </View>
        {leaders.length > 0 && (
          <View style={Q.leaderBox}>
            <Text style={Q.leaderTitle}>🏆 Legendary Heroes</Text>
            {leaders.map((l, i) => (
              <View key={i} style={Q.leaderRow}>
                <Text style={{ fontSize: 18 }}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={Q.leaderName}>{l.username}</Text>
                <Text style={[Q.leaderScore, { color: "#A855F7" }]}>{l.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── Render: Game Over / Win ───────────────────────────────────────────────
  if (screen === "gameover" || screen === "win") {
    return (
      <View style={[Q.screen, { alignItems: "center", justifyContent: "center", paddingTop: insets.top }]}>
        <Text style={{ fontSize: 64 }}>{screen === "win" ? "🏆" : "💀"}</Text>
        <Text style={Q.title}>{screen === "win" ? "Quest Complete!" : "Defeated!"}</Text>
        <Text style={[Q.subtitle, { marginBottom: 24 }]}>Floor {player.floor} · Level {player.level}</Text>
        <Text style={Q.bigScore}>{(player.floor * 100 + player.gold).toLocaleString()}</Text>
        <Text style={{ color: "#888", marginTop: 8 }}>score</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 32 }}>
          <TouchableOpacity style={Q.startBtn} onPress={startGame}><Text style={Q.startBtnTxt}>PLAY AGAIN</Text></TouchableOpacity>
          <TouchableOpacity style={[Q.startBtn, { backgroundColor: "#333" }]} onPress={() => setScreen("menu")}><Text style={Q.startBtnTxt}>MENU</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: Map ───────────────────────────────────────────────────────────
  if (screen === "map") {
    const hpPct = player.hp / player.maxHp;
    const xpPct = player.xp / (player.level * 80);
    return (
      <View style={[Q.screen, { paddingTop: insets.top }]}>
        {/* HUD */}
        <View style={Q.hud}>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ color: "#888", fontSize: 12 }}>✕</Text></TouchableOpacity>
          <View style={{ flex: 1, paddingHorizontal: 10, gap: 4 }}>
            <View style={Q.barTrack}>
              <View style={[Q.barFill, { width: `${hpPct * 100}%` as any, backgroundColor: hpPct > 0.5 ? "#10B981" : hpPct > 0.25 ? "#F59E0B" : "#EF4444" }]} />
              <Text style={Q.barLbl}>❤️ {player.hp}/{player.maxHp}</Text>
            </View>
            <View style={Q.barTrack}>
              <View style={[Q.barFill, { width: `${xpPct * 100}%` as any, backgroundColor: "#A855F7" }]} />
              <Text style={Q.barLbl}>⬆️ Lv{player.level}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={{ color: "#FBBF24", fontFamily: "Inter_700Bold", fontSize: 13 }}>🪙 {player.gold}</Text>
            <Text style={{ color: "#888", fontSize: 11 }}>Floor {player.floor}</Text>
          </View>
        </View>

        {/* Map grid */}
        <View style={Q.mapArea}>
          {map.map((row, r) => (
            <View key={r} style={Q.mapRow}>
              {row.map((tile, c) => (
                <View key={c} style={[Q.mapTile, { backgroundColor: TILE_BG[tile] }]}>
                  <Text style={Q.tileEmoji}>{tile === "visited" ? "  " : TILE_EMOJIS[tile]}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Log */}
        {combatLog.length > 0 && (
          <View style={Q.logBox}>
            {combatLog.slice(0, 2).map((l, i) => (
              <Text key={i} style={[Q.logTxt, { color: l.color }]}>{l.text}</Text>
            ))}
          </View>
        )}

        {/* D-pad */}
        <View style={Q.dpad}>
          <TouchableOpacity style={Q.dpadBtn} onPress={() => movePlayer(-1, 0)}><Text style={Q.dpadTxt}>▲</Text></TouchableOpacity>
          <View style={Q.dpadRow}>
            <TouchableOpacity style={Q.dpadBtn} onPress={() => movePlayer(0, -1)}><Text style={Q.dpadTxt}>◀</Text></TouchableOpacity>
            <View style={[Q.dpadBtn, { backgroundColor: "transparent" }]} />
            <TouchableOpacity style={Q.dpadBtn} onPress={() => movePlayer(0, 1)}><Text style={Q.dpadTxt}>▶</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={Q.dpadBtn} onPress={() => movePlayer(1, 0)}><Text style={Q.dpadTxt}>▼</Text></TouchableOpacity>
        </View>

        {/* Inventory quick bar */}
        {player.inventory.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={Q.invBar} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {player.inventory.slice(0, 6).map((item, i) => (
              <View key={i} style={[Q.invChip, { borderColor: item.color + "60" }]}>
                <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Render: Combat ────────────────────────────────────────────────────────
  if (screen === "combat" && monster) {
    const mHpPct = monster.currentHp / monster.hp;
    const pHpPct = player.hp / player.maxHp;
    return (
      <View style={[Q.screen, { paddingTop: insets.top }]}>
        <View style={Q.combatHeader}>
          <Text style={Q.combatTitle}>⚔️ BATTLE</Text>
          <Text style={{ color: "#888", fontSize: 12 }}>Floor {player.floor}</Text>
        </View>

        <Animated.View style={[Q.arena, { transform: [{ translateX: shakeAnim }] }]}>
          {/* Enemy */}
          <View style={Q.combatant}>
            <Text style={{ fontSize: 64 }}>{monster.emoji}</Text>
            <Text style={[Q.combatantName, { color: monster.color }]}>{monster.name}</Text>
            <View style={Q.barTrack}>
              <View style={[Q.barFill, { width: `${mHpPct * 100}%` as any, backgroundColor: monster.color }]} />
              <Text style={Q.barLbl}>{monster.currentHp}/{monster.hp}</Text>
            </View>
          </View>

          {/* VS */}
          <Text style={Q.vs}>VS</Text>

          {/* Player */}
          <View style={Q.combatant}>
            <Text style={{ fontSize: 64 }}>🧙</Text>
            <Text style={[Q.combatantName, { color: "#A855F7" }]}>You (Lv{player.level})</Text>
            <View style={Q.barTrack}>
              <View style={[Q.barFill, { width: `${pHpPct * 100}%` as any, backgroundColor: pHpPct > 0.5 ? "#10B981" : "#EF4444" }]} />
              <Text style={Q.barLbl}>{player.hp}/{player.maxHp}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Combat log */}
        <View style={Q.combatLog}>
          {combatLog.slice(0, 4).map((l, i) => (
            <Text key={i} style={[Q.logTxt, { color: l.color, fontSize: 12 }]}>{l.text}</Text>
          ))}
        </View>

        {/* Actions */}
        {combatTurn === "player" && (
          <View style={Q.combatActions}>
            <TouchableOpacity style={[Q.combatBtn, { backgroundColor: "#10B981" }]} onPress={combatAttack}>
              <Text style={Q.combatBtnTxt}>⚔️ Attack</Text>
              <Text style={Q.combatBtnSub}>{player.atk + tempAtk - monster.def} dmg</Text>
            </TouchableOpacity>
            {player.inventory.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 60 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {player.inventory.map((item, i) => (
                  <TouchableOpacity key={i} style={[Q.itemBtn, { borderColor: item.color + "60" }]} onPress={() => useItem(item, i)}>
                    <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                    <Text style={[Q.itemBtnLbl, { color: item.color }]}>{item.name.split(" ")[0]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={[Q.combatBtn, { backgroundColor: "#374151" }]} onPress={combatFlee}>
              <Text style={Q.combatBtnTxt}>🏃 Flee</Text>
              <Text style={Q.combatBtnSub}>50% chance</Text>
            </TouchableOpacity>
          </View>
        )}
        {combatTurn === "enemy" && (
          <View style={[Q.combatActions, { alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: "#888", fontSize: 15 }}>Enemy is attacking…</Text>
          </View>
        )}
      </View>
    );
  }

  return null;
}

const TILE_SIZE = Math.floor((Math.min(360, require("react-native").Dimensions.get("window").width) - 32) / MAP_SIZE);

const Q = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: "#0A0A1A" },
  back:           { position: "absolute", top: 50, left: 16, zIndex: 10 },
  backIcon:       { width: 26, height: 26, borderRadius: 7 },
  menuCenter:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
  title:          { fontFamily: "Inter_700Bold", fontSize: 30, color: "#fff", letterSpacing: -0.5 },
  subtitle:       { fontFamily: "Inter_400Regular", fontSize: 14, color: "#888", textAlign: "center" },
  featureRow:     { flexDirection: "row", gap: 16, marginVertical: 8 },
  featureBox:     { alignItems: "center", gap: 4 },
  featureLbl:     { fontFamily: "Inter_400Regular", fontSize: 10, color: "#666" },
  startBtn:       { backgroundColor: "#7C3AED", paddingHorizontal: 36, paddingVertical: 16, borderRadius: 16 },
  startBtnTxt:    { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff", letterSpacing: 0.5 },
  bigScore:       { fontFamily: "Inter_700Bold", fontSize: 52, color: "#A855F7" },
  leaderBox:      { padding: 20, gap: 8 },
  leaderTitle:    { fontFamily: "Inter_700Bold", fontSize: 14, color: "#888" },
  leaderRow:      { flexDirection: "row", alignItems: "center", gap: 10 },
  leaderName:     { fontFamily: "Inter_500Medium", fontSize: 14, color: "#ccc", flex: 1 },
  leaderScore:    { fontFamily: "Inter_700Bold", fontSize: 15 },

  hud:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4, backgroundColor: "#0A0A1A", gap: 4 },
  barTrack:       { height: 16, backgroundColor: "#1A1A2E", borderRadius: 8, overflow: "hidden", position: "relative", justifyContent: "center" },
  barFill:        { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 8 },
  barLbl:         { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#fff", paddingLeft: 6, zIndex: 1 },

  mapArea:        { alignItems: "center", paddingVertical: 8 },
  mapRow:         { flexDirection: "row" },
  mapTile:        { width: TILE_SIZE, height: TILE_SIZE, alignItems: "center", justifyContent: "center", borderRadius: 2 },
  tileEmoji:      { fontSize: TILE_SIZE * 0.55 },

  logBox:         { marginHorizontal: 16, padding: 10, backgroundColor: "#111", borderRadius: 10, gap: 2, marginBottom: 4 },
  logTxt:         { fontFamily: "Inter_400Regular", fontSize: 12 },

  dpad:           { alignItems: "center", gap: 4, paddingBottom: 8 },
  dpadRow:        { flexDirection: "row", gap: 4 },
  dpadBtn:        { width: 52, height: 52, backgroundColor: "#1A1A2E", borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2A2A3E" },
  dpadTxt:        { fontSize: 22, color: "#A855F7" },

  invBar:         { maxHeight: 52, marginBottom: 8 },
  invChip:        { width: 44, height: 44, borderRadius: 12, backgroundColor: "#1A1A2E", borderWidth: 1, alignItems: "center", justifyContent: "center" },

  combatHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  combatTitle:    { fontFamily: "Inter_700Bold", fontSize: 18, color: "#EF4444" },
  arena:          { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 16, paddingVertical: 16, backgroundColor: "#0F0F1E", marginHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: "#2A2A3E" },
  combatant:      { alignItems: "center", gap: 6, width: 120 },
  combatantName:  { fontFamily: "Inter_700Bold", fontSize: 13, textAlign: "center" },
  vs:             { fontFamily: "Inter_700Bold", fontSize: 22, color: "#EF4444" },
  combatLog:      { marginHorizontal: 16, marginTop: 8, padding: 10, backgroundColor: "#111", borderRadius: 10, gap: 2, minHeight: 60 },
  combatActions:  { flex: 1, padding: 12, gap: 8 },
  combatBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14 },
  combatBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  combatBtnSub:   { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)" },
  itemBtn:        { width: 64, height: 56, borderRadius: 12, backgroundColor: "#1A1A2E", borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  itemBtnLbl:     { fontFamily: "Inter_600SemiBold", fontSize: 9 },
});
