import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit } from "firebase/firestore";

const { width: SW } = Dimensions.get("window");
const SIZE = 10;
const CELL = Math.floor((SW - 32) / SIZE);

const WORD_LIST = [
  { word: "PHISHING", color: "#EF4444", fact: "Emails pretending to be your bank" },
  { word: "FRAUD",    color: "#F97316", fact: "Deliberate deception for gain" },
  { word: "MALWARE",  color: "#7C3AED", fact: "Software designed to damage systems" },
  { word: "VISHING",  color: "#D97706", fact: "Voice phishing — scam phone calls" },
  { word: "TROJAN",   color: "#0369A1", fact: "Malicious program hidden in software" },
  { word: "SMISHING", color: "#B91C1C", fact: "SMS-based phishing attacks" },
  { word: "RANSOMWARE", color: "#9333EA", fact: "Locks your files and demands payment" },
  { word: "KEYLOGGER", color: "#0F766E", fact: "Records every keystroke you make" },
];

const DIRS: [number,number][] = [[0,1],[1,0],[1,1],[0,-1],[-1,0],[-1,-1],[1,-1],[-1,1]];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type PlacedWord = { word: string; cells: [number,number][] };
type Screen = "menu" | "playing" | "gameover";

function generatePuzzle(): { grid: string[][]; placed: PlacedWord[] } {
  const grid: string[][] = Array(SIZE).fill(null).map(() => Array(SIZE).fill(""));
  const placed: PlacedWord[] = [];

  for (const { word } of WORD_LIST) {
    let success = false;
    for (let attempt = 0; attempt < 200 && !success; attempt++) {
      const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
      const r   = Math.floor(Math.random() * SIZE);
      const c   = Math.floor(Math.random() * SIZE);
      const cells: [number,number][] = [];
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const nr = r + dir[0]*i, nc = c + dir[1]*i;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) { ok = false; break; }
        if (grid[nr][nc] !== "" && grid[nr][nc] !== word[i]) { ok = false; break; }
        cells.push([nr, nc]);
      }
      if (ok) {
        cells.forEach(([nr,nc],i) => { grid[nr][nc] = word[i]; });
        placed.push({ word, cells });
        success = true;
      }
    }
  }

  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === "") grid[r][c] = LETTERS[Math.floor(Math.random() * LETTERS.length)];

  return { grid, placed };
}

function cellsOnLine(r1: number, c1: number, r2: number, c2: number): [number,number][] | null {
  const dr = r2 - r1, dc = c2 - c1;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  if (len === 0) return [[r1,c1]];
  if (Math.abs(dr) !== 0 && Math.abs(dc) !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const stepR = dr === 0 ? 0 : dr / len;
  const stepC = dc === 0 ? 0 : dc / len;
  if (!Number.isInteger(stepR) || !Number.isInteger(stepC)) return null;
  const cells: [number,number][] = [];
  for (let i = 0; i <= len; i++) cells.push([r1 + stepR*i, c1 + stepC*i]);
  return cells;
}

function cellKey(r: number, c: number) { return `${r},${c}`; }

export default function ScamWordHunt() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [screen,   setScreen]   = useState<Screen>("menu");
  const [best,     setBest]     = useState(0);
  const puzzle   = useMemo(() => generatePuzzle(), []);
  const [{ grid, placed }, _]   = useState(puzzle);
  const [found,    setFound]    = useState<string[]>([]);
  const [start,    setStart]    = useState<[number,number]|null>(null);
  const [sel,      setSel]      = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(120);
  const [flashWord,setFlashWord]= useState<string|null>(null);
  const [flashFact,setFlashFact]= useState<string|null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const foundCells = useMemo(() => {
    const s = new Set<string>();
    found.forEach(w => {
      const p = placed.find(p => p.word === w);
      p?.cells.forEach(([r,c]) => s.add(cellKey(r,c)));
    });
    return s;
  }, [found]);

  const foundColors = useMemo(() => {
    const m: Record<string,string> = {};
    found.forEach(w => {
      const meta = WORD_LIST.find(wl => wl.word === w);
      const p    = placed.find(p => p.word === w);
      if (meta && p) p.cells.forEach(([r,c]) => { m[cellKey(r,c)] = meta.color; });
    });
    return m;
  }, [found]);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db,"wordScores"), where("userId","==",user.uid), orderBy("score","desc"), limit(1)))
      .then(s => { if (!s.empty) setBest(s.docs[0].data().score as number); })
      .catch(() => {});
  }, [user]);

  const startGame = () => {
    setFound([]);
    setStart(null);
    setSel(new Set());
    setTimeLeft(120);
    setFlashWord(null);
    setFlashFact(null);
    setScreen("playing");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current!); handleGameOver([]); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleGameOver = async (finalFound: string[]) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const score = finalFound.length * 300 + Math.max(0, timeLeft * 5);
    if (score > best) setBest(score);
    setScreen("gameover");
    if (user) {
      try { await addDoc(collection(db,"wordScores"), { userId: user.uid, score, createdAt: serverTimestamp() }); }
      catch {}
    }
  };

  const handleCellPress = (r: number, c: number) => {
    if (!start) {
      setStart([r, c]);
      setSel(new Set([cellKey(r,c)]));
      return;
    }
    const [r0, c0] = start;
    if (r0 === r && c0 === c) { setStart(null); setSel(new Set()); return; }
    const line = cellsOnLine(r0, c0, r, c);
    if (!line) { setStart([r,c]); setSel(new Set([cellKey(r,c)])); return; }
    const selWord = line.map(([lr,lc]) => grid[lr][lc]).join("");
    const revWord = [...selWord].reverse().join("");
    const match = placed.find(p => !found.includes(p.word) && (p.word === selWord || p.word === revWord));
    if (match) {
      const newFound = [...found, match.word];
      setFound(newFound);
      setStart(null);
      setSel(new Set());
      const meta = WORD_LIST.find(wl => wl.word === match.word)!;
      setFlashWord(match.word);
      setFlashFact(meta.fact);
      if (flashRef.current) clearTimeout(flashRef.current);
      flashRef.current = setTimeout(() => { setFlashWord(null); setFlashFact(null); }, 2000);
      if (newFound.length === placed.length) {
        setTimeout(() => handleGameOver(newFound), 800);
      }
    } else {
      setStart([r,c]);
      setSel(new Set([cellKey(r,c)]));
    }
  };

  const score = found.length * 300 + Math.max(0, timeLeft * 5);
  const timerColor = timeLeft <= 30 ? "#EF4444" : timeLeft <= 60 ? "#F97316" : "#10B981";

  if (screen === "menu") return (
    <View style={[W.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={W.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[W.navTitle, { color: colors.text }]}>Scam Word Hunt</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center", gap: 20 }}>
        <Text style={{ fontSize: 72 }}>🔍</Text>
        <Text style={[W.title, { color: colors.text }]}>Scam Word Hunt</Text>
        <Text style={[W.sub, { color: colors.textMuted }]}>
          Find all 8 scam-related words hidden in the grid!{"\n"}Learn what each scam type means as you play.
        </Text>
        {best > 0 && (
          <View style={[W.badge, { backgroundColor: "#0369A118", borderColor: "#0369A140" }]}>
            <Text style={{ fontSize: 16 }}>🏆</Text>
            <Text style={[W.badgeTxt, { color: "#0369A1" }]}>Best: {best.toLocaleString()}</Text>
          </View>
        )}
        <TouchableOpacity style={[W.playBtn, { backgroundColor: "#0369A1" }]} onPress={startGame}>
          <Feather name="search" size={18} color="#fff" />
          <Text style={W.playBtnTxt}>Start Hunt</Text>
        </TouchableOpacity>
        <View style={[W.howCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[W.howTitle, { color: colors.text }]}>Words to Find</Text>
          <View style={W.wordsGrid}>
            {WORD_LIST.map(({ word, color }) => (
              <View key={word} style={[W.wordChip, { backgroundColor: color + "18", borderColor: color + "50" }]}>
                <Text style={[W.wordChipTxt, { color }]}>{word}</Text>
              </View>
            ))}
          </View>
          <Text style={[W.howTxt, { color: colors.textMuted }]}>
            Tap the first letter of a word, then tap the last letter to select it. Words can go in any direction!
          </Text>
        </View>
      </ScrollView>
    </View>
  );

  if (screen === "gameover") return (
    <View style={[W.screen, { backgroundColor: colors.background, paddingTop: insets.top, alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 24 }]}>
      <Text style={{ fontSize: 64 }}>{found.length === placed.length ? "🏆" : "⏰"}</Text>
      <Text style={[W.title, { color: colors.text }]}>{found.length === placed.length ? "All Words Found!" : "Time's Up!"}</Text>
      <View style={[W.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[W.scoreBig, { color: "#0369A1" }]}>{score.toLocaleString()}</Text>
        <Text style={[W.scoreLabel, { color: colors.textMuted }]}>Score</Text>
        <View style={W.statsRow}>
          <View style={W.stat}><Text style={[W.statNum, { color: colors.text }]}>{found.length}/{placed.length}</Text><Text style={[W.statLabel, { color: colors.textMuted }]}>Found</Text></View>
          <View style={W.stat}><Text style={[W.statNum, { color: colors.text }]}>{120 - timeLeft}s</Text><Text style={[W.statLabel, { color: colors.textMuted }]}>Used</Text></View>
        </View>
        {score >= best && score > 0 && <Text style={[W.newBest, { color: "#F59E0B" }]}>🎉 New Personal Best!</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TouchableOpacity style={[W.goBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Feather name="home" size={16} color={colors.text} />
          <Text style={[W.goBtnTxt, { color: colors.text }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[W.goBtn, { backgroundColor: "#0369A1", borderColor: "#0369A1" }]} onPress={startGame}>
          <Feather name="refresh-cw" size={16} color="#fff" />
          <Text style={[W.goBtnTxt, { color: "#fff" }]}>Play Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[W.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={W.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[W.navTitle, { color: colors.text }]}>Scam Word Hunt</Text>
        <Text style={[W.timer, { color: timerColor }]}>{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,"0")}</Text>
      </View>

      <View style={[W.hud, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[W.hudTxt, { color: "#0369A1" }]}>{found.length}/{placed.length} words</Text>
        <Text style={[W.hudTxt, { color: colors.text }]}>{score.toLocaleString()} pts</Text>
        {start && <Text style={[W.hudTxt, { color: "#F97316" }]}>Tap end letter…</Text>}
      </View>

      {flashWord && (
        <View style={[W.flashBanner, { backgroundColor: "#10B981EE" }]}>
          <Text style={W.flashWord}>✅ {flashWord}</Text>
          {flashFact && <Text style={W.flashFact}>{flashFact}</Text>}
        </View>
      )}

      <View style={[W.gridWrap, { paddingHorizontal: 16, paddingTop: 10 }]}>
        {grid.map((row, r) => (
          <View key={r} style={W.gridRow}>
            {row.map((letter, c) => {
              const key    = cellKey(r, c);
              const isSel  = sel.has(key) || (start?.[0] === r && start?.[1] === c);
              const isFound = foundCells.has(key);
              const fc     = foundColors[key];
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    W.cell,
                    { backgroundColor: isFound ? fc + "30" : isSel ? "#F9731630" : colors.muted, borderColor: isFound ? fc + "80" : isSel ? "#F97316" : colors.border },
                  ]}
                  onPress={() => handleCellPress(r, c)}
                  activeOpacity={0.7}
                >
                  <Text style={[W.cellTxt, { color: isFound ? fc : isSel ? "#F97316" : colors.text, fontFamily: isSel || isFound ? "Inter_700Bold" : "Inter_400Regular" }]}>
                    {letter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={W.wordsList}>
        {WORD_LIST.map(({ word, color }) => {
          const isFound = found.includes(word);
          return (
            <View key={word} style={[W.wordPill, { backgroundColor: isFound ? color + "25" : colors.muted, borderColor: isFound ? color : colors.border }]}>
              <Text style={[W.wordPillTxt, { color: isFound ? color : colors.textMuted, textDecorationLine: isFound ? "line-through" : "none" }]}>
                {isFound ? "✓ " : ""}{word}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const W = StyleSheet.create({
  screen:     { flex: 1 },
  nav:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:   { fontFamily: "Inter_700Bold", fontSize: 16 },
  timer:      { fontFamily: "Inter_700Bold", fontSize: 18 },
  hud:        { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, borderBottomWidth: 1 },
  hudTxt:     { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  flashBanner:{ position: "absolute", top: 80, left: 20, right: 20, borderRadius: 14, padding: 12, zIndex: 20, gap: 4 },
  flashWord:  { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  flashFact:  { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.9)" },
  gridWrap:   { alignSelf: "center" },
  gridRow:    { flexDirection: "row" },
  cell:       { width: CELL, height: CELL, borderWidth: 1, alignItems: "center", justifyContent: "center", margin: 0 },
  cellTxt:    { fontSize: CELL * 0.48 },
  wordsList:  { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  wordPill:   { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  wordPillTxt:{ fontFamily: "Inter_600SemiBold", fontSize: 12 },
  title:      { fontFamily: "Inter_700Bold", fontSize: 26, textAlign: "center" },
  sub:        { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },
  badge:      { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  badgeTxt:   { fontFamily: "Inter_700Bold", fontSize: 14 },
  playBtn:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  playBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  howCard:    { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, gap: 12 },
  howTitle:   { fontFamily: "Inter_700Bold", fontSize: 16 },
  wordsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wordChip:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  wordChipTxt:{ fontFamily: "Inter_700Bold", fontSize: 12 },
  howTxt:     { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },
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
