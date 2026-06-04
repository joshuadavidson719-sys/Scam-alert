import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit } from "firebase/firestore";

import { Feather } from "@expo/vector-icons";

const { width: SW } = Dimensions.get("window");
const COLS = 4;
const CELL = (SW - 40 - 12) / COLS;

const PAIRS = [
  { id: "phish",   emoji: "📧", label: "Phishing",        color: "#EF4444", fact: "Never click suspicious email links" },
  { id: "vish",    emoji: "📞", label: "Vishing",          color: "#F97316", fact: "Real banks never ask for your PIN by phone" },
  { id: "smish",   emoji: "💬", label: "Smishing",         color: "#D97706", fact: "Don't click links in unexpected text messages" },
  { id: "crypto",  emoji: "₿",  label: "Crypto Scam",      color: "#7C3AED", fact: "No legitimate investment promises guaranteed returns" },
  { id: "bank",    emoji: "🏦", label: "Bank Fraud",       color: "#0369A1", fact: "Always call the number on your card, not one given to you" },
  { id: "prize",   emoji: "🎰", label: "Lottery Scam",     color: "#B91C1C", fact: "You can't win a lottery you never entered" },
  { id: "malware", emoji: "🦠", label: "Malware",          color: "#9333EA", fact: "Keep your software updated to block exploits" },
  { id: "id",      emoji: "🎭", label: "Identity Theft",   color: "#0F766E", fact: "Shred documents with personal information" },
];

type Tile = { uid: string; pairId: string; emoji: string; label: string; color: string; fact: string; flipped: boolean; matched: boolean };
type Screen = "menu" | "playing" | "gameover";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeTiles(): Tile[] {
  const tiles: Tile[] = [];
  PAIRS.forEach(p => {
    tiles.push({ uid: p.id + "_a", pairId: p.id, emoji: p.emoji, label: p.label, color: p.color, fact: p.fact, flipped: false, matched: false });
    tiles.push({ uid: p.id + "_b", pairId: p.id, emoji: p.emoji, label: p.label, color: p.color, fact: p.fact, flipped: false, matched: false });
  });
  return shuffle(tiles);
}

function TileCard({ tile, onPress, disabled }: { tile: Tile; onPress: () => void; disabled: boolean }) {
  const colors   = useColors();
  const flipAnim = useRef(new Animated.Value(tile.flipped || tile.matched ? 1 : 0)).current;
  const prevFlipped = useRef(tile.flipped || tile.matched);

  useEffect(() => {
    const next = tile.flipped || tile.matched;
    if (next !== prevFlipped.current) {
      prevFlipped.current = next;
      Animated.timing(flipAnim, { toValue: next ? 1 : 0, duration: 250, useNativeDriver: true }).start();
    }
  }, [tile.flipped, tile.matched]);

  const frontRotate = flipAnim.interpolate({ inputRange: [0,1], outputRange: ["0deg","180deg"] });
  const backRotate  = flipAnim.interpolate({ inputRange: [0,1], outputRange: ["180deg","360deg"] });

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || tile.matched} activeOpacity={0.8}
      style={{ width: CELL, height: CELL * 1.25, margin: 3 }}>
      <Animated.View style={[TC.face, TC.back, { backgroundColor: colors.muted, borderColor: colors.border, transform: [{ rotateY: frontRotate }] }]}>
        <Text style={{ fontSize: 22 }}>🎴</Text>
        <Text style={[TC.back_label, { color: colors.textMuted }]}>Tap</Text>
      </Animated.View>
      <Animated.View style={[TC.face, TC.front, {
        backgroundColor: tile.matched ? tile.color + "25" : tile.color + "18",
        borderColor: tile.matched ? tile.color : tile.color + "60",
        transform: [{ rotateY: backRotate }],
      }]}>
        <Text style={{ fontSize: CELL * 0.38 }}>{tile.emoji}</Text>
        <Text style={[TC.front_label, { color: tile.color }]} numberOfLines={2}>{tile.label}</Text>
        {tile.matched && <Text style={TC.check}>✓</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

const TC = StyleSheet.create({
  face:        { position: "absolute", width: "100%", height: "100%", borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center", gap: 4, backfaceVisibility: "hidden" },
  back:        {},
  front:       {},
  back_label:  { fontFamily: "Inter_400Regular", fontSize: 10 },
  front_label: { fontFamily: "Inter_700Bold", fontSize: 10, textAlign: "center", paddingHorizontal: 4 },
  check:       { fontSize: 16, position: "absolute", top: 4, right: 4 },
});

export default function FraudFlip() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [screen,   setScreen]   = useState<Screen>("menu");
  const [tiles,    setTiles]    = useState<Tile[]>([]);
  const [first,    setFirst]    = useState<string|null>(null);
  const [locked,   setLocked]   = useState(false);
  const [matches,  setMatches]  = useState(0);
  const [flips,    setFlips]    = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [lastFact, setLastFact] = useState<string|null>(null);
  const [best,     setBest]     = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db,"flipScores"), where("userId","==",user.uid), orderBy("score","desc"), limit(1)))
      .then(s => { if (!s.empty) setBest(s.docs[0].data().score as number); })
      .catch(() => {});
  }, [user]);

  const startGame = () => {
    setTiles(makeTiles());
    setFirst(null);
    setLocked(false);
    setMatches(0);
    setFlips(0);
    setElapsed(0);
    setLastFact(null);
    setScreen("playing");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const endGame = async (totalFlips: number, totalMatches: number, time: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const score = Math.max(0, 1000 + totalMatches * 200 - totalFlips * 10 - time * 2);
    if (score > best) setBest(score);
    setScreen("gameover");
    if (user) {
      try {
        await addDoc(collection(db,"flipScores"), { userId: user.uid, score, createdAt: serverTimestamp() });
      } catch {}
    }
  };

  const handleTile = (uid: string) => {
    if (locked) return;
    const tile = tiles.find(t => t.uid === uid);
    if (!tile || tile.flipped || tile.matched) return;

    const newFlips = flips + 1;
    setFlips(newFlips);

    const updated = tiles.map(t => t.uid === uid ? { ...t, flipped: true } : t);
    setTiles(updated);

    if (!first) {
      setFirst(uid);
      return;
    }

    const firstTile = updated.find(t => t.uid === first)!;
    const secondTile = updated.find(t => t.uid === uid)!;

    if (firstTile.pairId === secondTile.pairId) {
      const matched = updated.map(t =>
        t.uid === first || t.uid === uid ? { ...t, matched: true, flipped: true } : t
      );
      const newMatches = matches + 1;
      setTiles(matched);
      setMatches(newMatches);
      setFirst(null);
      setLastFact(secondTile.fact);
      if (newMatches === PAIRS.length) {
        setTimeout(() => endGame(newFlips, newMatches, elapsed), 600);
      }
    } else {
      setLocked(true);
      setTimeout(() => {
        setTiles(prev => prev.map(t => t.uid === first || t.uid === uid ? { ...t, flipped: false } : t));
        setFirst(null);
        setLocked(false);
      }, 900);
    }
  };

  const score = Math.max(0, 1000 + matches * 200 - flips * 10 - elapsed * 2);

  if (screen === "menu") return (
    <View style={[G.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={G.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[G.navTitle, { color: colors.text }]}>Fraud Flip</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center", gap: 20 }}>
        <Text style={{ fontSize: 72 }}>🎴</Text>
        <Text style={[G.title, { color: colors.text }]}>Fraud Flip</Text>
        <Text style={[G.sub, { color: colors.textMuted }]}>
          Flip the cards to find matching scam type pairs!{"\n"}Learn a scam fact with every match.
        </Text>
        {best > 0 && (
          <View style={[G.badge, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED40" }]}>
            <Text style={{ fontSize: 16 }}>🏆</Text>
            <Text style={[G.badgeTxt, { color: "#7C3AED" }]}>Best: {best.toLocaleString()}</Text>
          </View>
        )}
        <TouchableOpacity style={[G.playBtn, { backgroundColor: "#7C3AED" }]} onPress={startGame}>
          <Text style={{ fontSize: 18, color: "#fff" }}>▶</Text>
          <Text style={G.playBtnTxt}>Play Now</Text>
        </TouchableOpacity>
        <View style={[G.howCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[G.howTitle, { color: colors.text }]}>How to Play</Text>
          {["Tap any card to flip it face-up","Tap a second card to try matching","Matching pairs of the same scam type stay revealed","Wrong pairs flip back — remember where they were!","Match all 8 pairs as fast as possible to top the leaderboard"].map((t,i) => (
            <View key={i} style={G.howRow}>
              <View style={[G.dot, { backgroundColor: "#7C3AED" }]} />
              <Text style={[G.howTxt, { color: colors.textMuted }]}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  if (screen === "gameover") return (
    <View style={[G.screen, { backgroundColor: colors.background, paddingTop: insets.top, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 24 }]}>
      <Text style={{ fontSize: 64 }}>🎉</Text>
      <Text style={[G.title, { color: colors.text }]}>All Pairs Found!</Text>
      <View style={[G.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[G.scoreBig, { color: "#7C3AED" }]}>{score.toLocaleString()}</Text>
        <Text style={[G.scoreLabel, { color: colors.textMuted }]}>Score</Text>
        <View style={G.statsRow}>
          <View style={G.stat}>
            <Text style={[G.statNum, { color: colors.text }]}>{flips}</Text>
            <Text style={[G.statLabel, { color: colors.textMuted }]}>Flips</Text>
          </View>
          <View style={G.stat}>
            <Text style={[G.statNum, { color: colors.text }]}>{elapsed}s</Text>
            <Text style={[G.statLabel, { color: colors.textMuted }]}>Time</Text>
          </View>
          <View style={G.stat}>
            <Text style={[G.statNum, { color: colors.text }]}>{PAIRS.length}</Text>
            <Text style={[G.statLabel, { color: colors.textMuted }]}>Pairs</Text>
          </View>
        </View>
        {score >= best && <Text style={[G.newBest, { color: "#F59E0B" }]}>🎉 New Personal Best!</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TouchableOpacity style={[G.goBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: colors.text }}>🏠</Text>
          <Text style={[G.goBtnTxt, { color: colors.text }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[G.goBtn, { backgroundColor: "#7C3AED", borderColor: "#7C3AED" }]} onPress={startGame}>
          <Text style={{ fontSize: 16, color: "#fff" }}>🔄</Text>
          <Text style={[G.goBtnTxt, { color: "#fff" }]}>Play Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[G.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={G.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[G.navTitle, { color: colors.text }]}>Fraud Flip</Text>
        <View style={[G.badge, { backgroundColor: "#7C3AED18", borderColor: "#7C3AED40" }]}>
          <Text style={[G.badgeTxt, { color: "#7C3AED" }]}>{matches}/{PAIRS.length} 🎴</Text>
        </View>
      </View>

      <View style={[G.hud, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={G.hudItem}>
          <Text style={[G.hudVal, { color: colors.text }]}>{flips}</Text>
          <Text style={[G.hudLabel, { color: colors.textMuted }]}>Flips</Text>
        </View>
        <View style={G.hudItem}>
          <Text style={[G.hudVal, { color: "#7C3AED" }]}>{score.toLocaleString()}</Text>
          <Text style={[G.hudLabel, { color: colors.textMuted }]}>Score</Text>
        </View>
        <View style={G.hudItem}>
          <Text style={[G.hudVal, { color: colors.text }]}>{elapsed}s</Text>
          <Text style={[G.hudLabel, { color: colors.textMuted }]}>Time</Text>
        </View>
      </View>

      {lastFact && (
        <View style={[G.factBanner, { backgroundColor: "#10B98118", borderColor: "#10B98130" }]}>
          <Text style={{ fontSize: 14 }}>💡</Text>
          <Text style={[G.factTxt, { color: "#10B981" }]}>{lastFact}</Text>
        </View>
      )}

      <View style={G.grid}>
        {tiles.map(tile => (
          <TileCard key={tile.uid} tile={tile} onPress={() => handleTile(tile.uid)} disabled={locked || !!first && tile.uid === first} />
        ))}
      </View>
    </View>
  );
}

const G = StyleSheet.create({
  screen:     { flex: 1 },
  nav:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:   { fontFamily: "Inter_700Bold", fontSize: 16 },
  hud:        { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 10 },
  hudItem:    { flex: 1, alignItems: "center" },
  hudVal:     { fontFamily: "Inter_700Bold", fontSize: 18 },
  hudLabel:   { fontFamily: "Inter_400Regular", fontSize: 11 },
  factBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 12, borderWidth: 1 },
  factTxt:    { fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 },
  grid:       { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", paddingTop: 12, paddingHorizontal: 16 },
  title:      { fontFamily: "Inter_700Bold", fontSize: 26, textAlign: "center" },
  sub:        { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },
  badge:      { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:   { fontFamily: "Inter_700Bold", fontSize: 13 },
  playBtn:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  playBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  howCard:    { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, gap: 10 },
  howTitle:   { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 2 },
  howRow:     { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot:        { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  howTxt:     { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, flex: 1 },
  scoreCard:  { width: "100%", borderWidth: 1, borderRadius: 20, padding: 24, alignItems: "center", gap: 8 },
  scoreBig:   { fontFamily: "Inter_700Bold", fontSize: 48 },
  scoreLabel: { fontFamily: "Inter_400Regular", fontSize: 14 },
  statsRow:   { flexDirection: "row", gap: 24, marginTop: 8 },
  stat:       { alignItems: "center" },
  statNum:    { fontFamily: "Inter_700Bold", fontSize: 22 },
  statLabel:  { fontFamily: "Inter_400Regular", fontSize: 12 },
  newBest:    { fontFamily: "Inter_700Bold", fontSize: 14 },
  goBtn:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  goBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 14 },
});
