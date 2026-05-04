import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, Alert, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit } from "firebase/firestore";

const APP_ICON = require("@/assets/images/icon.png");

const { width: SW } = Dimensions.get("window");
const GRID = 8;
const GAP  = 2;
const CELL = Math.floor((SW - 32 - GAP * (GRID - 1)) / GRID);

const SCAM_EMOJIS = ["📧","💸","🎭","🔒","☠️","🦠","💣","🚨","🎰","💻","📞","💬","₿","🏦"];
const COLORS = ["#DC2626","#EA580C","#7C3AED","#B91C1C","#0F766E","#9333EA","#1E40AF","#D97706","#0369A1","#7C2D12"];

const SHAPES: [number, number][][] = [
  [[0,0]],
  [[0,0],[0,1]],
  [[0,0],[1,0]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[0,2],[1,0]],
  [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[0,1],[1,1],[1,2]],
  [[0,1],[1,0],[1,1]],
  [[0,0],[0,1],[1,0]],
  [[0,0],[0,1],[0,2],[1,1]],
];

type Cell  = { emoji: string; color: string } | null;
type Grid  = Cell[][];
type Piece = { id: string; shape: [number,number][]; emoji: string; color: string };
type Screen = "menu" | "playing" | "gameover";

function makeGrid(): Grid { return Array(GRID).fill(null).map(() => Array(GRID).fill(null)); }

function randomPiece(): Piece {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const idx   = Math.floor(Math.random() * SCAM_EMOJIS.length);
  return { id: Math.random().toString(36), shape, emoji: SCAM_EMOJIS[idx], color: COLORS[idx % COLORS.length] };
}

function canPlace(grid: Grid, piece: Piece, r: number, c: number): boolean {
  return piece.shape.every(([dr,dc]) => {
    const nr = r+dr, nc = c+dc;
    return nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && grid[nr][nc] === null;
  });
}

function doPlace(grid: Grid, piece: Piece, r: number, c: number): Grid {
  const g = grid.map(row => [...row]);
  piece.shape.forEach(([dr,dc]) => { g[r+dr][c+dc] = { emoji: piece.emoji, color: piece.color }; });
  return g;
}

function clearLines(grid: Grid): { grid: Grid; cleared: number } {
  const g = grid.map(row => [...row]);
  let cleared = 0;
  for (let r = 0; r < GRID; r++) {
    if (g[r].every(c => c !== null)) { g[r] = Array(GRID).fill(null); cleared++; }
  }
  for (let c = 0; c < GRID; c++) {
    if (g.every(row => row[c] !== null)) { for (let r = 0; r < GRID; r++) g[r][c] = null; cleared++; }
  }
  return { grid: g, cleared };
}

function anyFit(grid: Grid, pieces: (Piece|null)[]): boolean {
  return pieces.some(p => {
    if (!p) return false;
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++)
        if (canPlace(grid, p, r, c)) return true;
    return false;
  });
}

function getPieceSize(piece: Piece): { rows: number; cols: number } {
  const maxR = Math.max(...piece.shape.map(([r]) => r));
  const maxC = Math.max(...piece.shape.map(([,c]) => c));
  return { rows: maxR + 1, cols: maxC + 1 };
}

export default function ScamBlockBlast() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const [screen,   setScreen]   = useState<Screen>("menu");
  const [grid,     setGrid]     = useState<Grid>(makeGrid());
  const [pieces,   setPieces]   = useState<(Piece|null)[]>([null,null,null]);
  const [selected, setSelected] = useState<number|null>(null);
  const [score,    setScore]    = useState(0);
  const [best,     setBest]     = useState(0);
  const [flash,    setFlash]    = useState<string|null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const SCAM_NAMES = ["Phishing","Smishing","Vishing","Crypto Scam","Fake Prize","Bank Fraud","Malware","Identity Theft","Ransomware","Romance Scam","Tech Support","Investment Scam"];

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db,"blockScores"), where("userId","==",user.uid), orderBy("score","desc"), limit(1)))
      .then(s => { if (!s.empty) setBest(s.docs[0].data().score as number); })
      .catch(() => {});
  }, [user]);

  const startGame = () => {
    setGrid(makeGrid());
    setPieces([randomPiece(), randomPiece(), randomPiece()]);
    setSelected(null);
    setScore(0);
    setScreen("playing");
  };

  const showFlash = (msg: string) => {
    setFlash(msg);
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlash(null), 1200);
  };

  const handleCellPress = (r: number, c: number) => {
    if (selected === null) return;
    const piece = pieces[selected];
    if (!piece) return;
    if (!canPlace(grid, piece, r, c)) { showFlash("Doesn't fit here!"); return; }
    let newGrid = doPlace(grid, piece, r, c);
    const { grid: cleared, cleared: n } = clearLines(newGrid);
    const bonus = n === 0 ? 0 : n === 1 ? 50 : n === 2 ? 150 : 350;
    const added = piece.shape.length * 10 + bonus;
    const newScore = score + added;
    const newPieces = pieces.map((p, i) => i === selected ? null : p) as (Piece|null)[];
    const allPlaced = newPieces.every(p => p === null);
    const nextPieces = allPlaced ? [randomPiece(), randomPiece(), randomPiece()] : newPieces;
    if (n > 0) showFlash(n === 1 ? `+${bonus} Line Cleared! 🚨` : `+${bonus} ${n} Lines! 🔥`);
    setGrid(n > 0 ? cleared : newGrid);
    setPieces(nextPieces);
    setSelected(null);
    setScore(newScore);
    if (!anyFit(n > 0 ? cleared : newGrid, nextPieces)) {
      handleGameOver(newScore);
    }
  };

  const handleGameOver = async (finalScore: number) => {
    if (finalScore > best) setBest(finalScore);
    setScreen("gameover");
    if (user) {
      try {
        await addDoc(collection(db,"blockScores"), {
          userId: user.uid, score: finalScore, createdAt: serverTimestamp(),
        });
      } catch {}
    }
  };

  if (screen === "menu") return (
    <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={S.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Image source={APP_ICON} style={{ width: 22, height: 22, borderRadius: 6 }} />
        </TouchableOpacity>
        <Text style={[S.navTitle, { color: colors.text }]}>Scam Block Blast</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, alignItems: "center", gap: 20, paddingTop: 20 }}>
        <View style={[S.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 72 }}>🧱</Text>
          <Text style={[S.menuTitle, { color: colors.text }]}>Scam Block Blast</Text>
          <Text style={[S.menuSub, { color: colors.textMuted }]}>
            Fit scam-labeled blocks onto the 8×8 grid.{"\n"}Fill complete rows or columns to blast them away and score points!
          </Text>
          {best > 0 && (
            <View style={[S.bestBadge, { backgroundColor: "#FF3B3B18", borderColor: "#FF3B3B40" }]}>
              <Text style={{ fontSize: 16 }}>🏆</Text>
              <Text style={[S.bestTxt, { color: "#FF3B3B" }]}>Best: {best.toLocaleString()}</Text>
            </View>
          )}
          <TouchableOpacity style={[S.playBtn, { backgroundColor: "#FF3B3B" }]} onPress={startGame}>
            <Text style={{ fontSize: 18, color: "#fff" }}>▶</Text>
            <Text style={S.playBtnTxt}>Play Now</Text>
          </TouchableOpacity>
        </View>
        <View style={[S.howCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[S.howTitle, { color: colors.text }]}>How to Play</Text>
          {["Tap a piece at the bottom to select it","Tap any valid cell on the grid to place it","Fill a full row or column to blast it!","Score more points for multiple clears at once","Game ends when no piece can fit anywhere"].map((t,i) => (
            <View key={i} style={S.howRow}>
              <View style={[S.howDot, { backgroundColor: "#FF3B3B" }]} />
              <Text style={[S.howTxt, { color: colors.textMuted }]}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  if (screen === "gameover") return (
    <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top, alignItems: "center", justifyContent: "center", gap: 20 }]}>
      <Text style={{ fontSize: 64 }}>💥</Text>
      <Text style={[S.menuTitle, { color: colors.text }]}>Board Blocked!</Text>
      <Text style={[S.menuSub, { color: colors.textMuted }]}>No more moves left</Text>
      <View style={[S.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[S.scoreBig, { color: "#FF3B3B" }]}>{score.toLocaleString()}</Text>
        <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Final Score</Text>
        {score >= best && score > 0 && <Text style={[S.newBest, { color: "#F59E0B" }]}>🎉 New Personal Best!</Text>}
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <TouchableOpacity style={[S.goBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: colors.text }}>🏠</Text>
          <Text style={[S.goBtnTxt, { color: colors.text }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.goBtn, { backgroundColor: "#FF3B3B", borderColor: "#FF3B3B" }]} onPress={startGame}>
          <Text style={{ fontSize: 16, color: "#fff" }}>🔄</Text>
          <Text style={[S.goBtnTxt, { color: "#fff" }]}>Play Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={S.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
          <Image source={APP_ICON} style={{ width: 22, height: 22, borderRadius: 6 }} />
        </TouchableOpacity>
        <Text style={[S.navTitle, { color: colors.text }]}>Scam Block Blast</Text>
        <View style={[S.scoreChip, { backgroundColor: "#FF3B3B18", borderColor: "#FF3B3B40" }]}>
          <Text style={[S.scoreChipTxt, { color: "#FF3B3B" }]}>{score.toLocaleString()}</Text>
        </View>
      </View>

      {flash && (
        <View style={[S.flashBanner, { backgroundColor: "#FF3B3BDD" }]}>
          <Text style={S.flashTxt}>{flash}</Text>
        </View>
      )}

      <View style={S.gridWrap}>
        {grid.map((row, r) => (
          <View key={r} style={S.gridRow}>
            {row.map((cell, c) => {
              const piece = selected !== null ? pieces[selected] : null;
              const isTarget = piece ? canPlace(grid, piece, r, c) : false;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    S.cell,
                    { backgroundColor: cell ? cell.color + "CC" : colors.muted, borderColor: cell ? cell.color + "60" : colors.border, borderRadius: 6 },
                    isTarget && !cell && { backgroundColor: "#FF3B3B22", borderColor: "#FF3B3B80" },
                  ]}
                  onPress={() => handleCellPress(r, c)}
                  activeOpacity={0.7}
                >
                  {cell && <Text style={S.cellEmoji}>{cell.emoji}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <View style={[S.piecesBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <Text style={[S.piecesLabel, { color: colors.textMuted }]}>
          {selected !== null ? "Tap grid to place" : "Select a piece"}
        </Text>
        <View style={S.piecesRow}>
          {pieces.map((piece, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                S.pieceWrap,
                { backgroundColor: piece ? piece.color + "18" : colors.muted, borderColor: piece ? piece.color + "50" : colors.border },
                selected === idx && { borderColor: piece?.color, borderWidth: 2, backgroundColor: piece?.color + "30" },
                !piece && { opacity: 0.3 },
              ]}
              onPress={() => piece && setSelected(selected === idx ? null : idx)}
              disabled={!piece}
            >
              {piece ? (() => {
                const { rows, cols } = getPieceSize(piece);
                const mini = Array(rows).fill(null).map(() => Array(cols).fill(false));
                piece.shape.forEach(([r,c]) => { mini[r][c] = true; });
                return (
                  <View style={{ alignItems: "center", justifyContent: "center" }}>
                    {mini.map((row, r) => (
                      <View key={r} style={{ flexDirection: "row", gap: 2 }}>
                        {row.map((filled, c) => (
                          <View key={c} style={[S.miniCell, { backgroundColor: filled ? piece.color : "transparent" }]}>
                            {filled && <Text style={S.miniEmoji}>{piece.emoji}</Text>}
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                );
              })() : <Text style={[S.usedTxt, { color: colors.textMuted }]}>Used</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  screen:       { flex: 1 },
  nav:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:     { fontFamily: "Inter_700Bold", fontSize: 16 },
  scoreChip:    { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4 },
  scoreChipTxt: { fontFamily: "Inter_700Bold", fontSize: 14 },
  flashBanner:  { position: "absolute", top: 60, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, zIndex: 10 },
  flashTxt:     { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  gridWrap:     { alignSelf: "center", gap: GAP, paddingTop: 8 },
  gridRow:      { flexDirection: "row", gap: GAP },
  cell:         { width: CELL, height: CELL, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cellEmoji:    { fontSize: CELL * 0.55 },
  piecesBar:    { borderTopWidth: 1, padding: 12, gap: 8 },
  piecesLabel:  { fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "center" },
  piecesRow:    { flexDirection: "row", justifyContent: "space-around", gap: 8 },
  pieceWrap:    { flex: 1, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", minHeight: 80, padding: 8 },
  miniCell:     { width: 16, height: 16, borderRadius: 3, alignItems: "center", justifyContent: "center" },
  miniEmoji:    { fontSize: 10 },
  usedTxt:      { fontFamily: "Inter_400Regular", fontSize: 12 },
  menuCard:     { width: "100%", borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 12 },
  menuTitle:    { fontFamily: "Inter_700Bold", fontSize: 24, textAlign: "center" },
  menuSub:      { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 22 },
  bestBadge:    { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  bestTxt:      { fontFamily: "Inter_700Bold", fontSize: 16 },
  playBtn:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, marginTop: 4 },
  playBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  howCard:      { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, gap: 12 },
  howTitle:     { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 },
  howRow:       { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  howDot:       { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  howTxt:       { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, flex: 1 },
  scoreCard:    { borderWidth: 1, borderRadius: 20, padding: 28, alignItems: "center", gap: 8, minWidth: 200 },
  scoreBig:     { fontFamily: "Inter_700Bold", fontSize: 48 },
  scoreLabel:   { fontFamily: "Inter_400Regular", fontSize: 14 },
  newBest:      { fontFamily: "Inter_700Bold", fontSize: 14 },
  goBtn:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  goBtnTxt:     { fontFamily: "Inter_700Bold", fontSize: 14 },
});
