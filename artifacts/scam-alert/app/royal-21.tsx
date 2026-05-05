import React, { useState, useCallback, useEffect } from "react";
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

// ── Deck ───────────────────────────────────────────────────────────────────
const SUITS  = ["♠", "♥", "♦", "♣"] as const;
const VALUES = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"] as const;
type Suit  = typeof SUITS[number];
type Value = typeof VALUES[number];
type Card  = { suit: Suit; value: Value };

function makeDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const v of VALUES) d.push({ suit: s, value: v });
  return d;
}

function shuffle(d: Card[]): Card[] {
  const a = [...d];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(c: Card): number[] {
  if (c.value === "A") return [1, 11];
  if (["J","Q","K"].includes(c.value)) return [10];
  return [parseInt(c.value)];
}

function handScore(hand: Card[]): number {
  let total = 0; let aces = 0;
  for (const c of hand) {
    const vals = cardValue(c);
    total += vals[vals.length - 1];
    if (c.value === "A") aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isRed(c: Card) { return c.suit === "♥" || c.suit === "♦"; }

type GameState = "betting" | "playing" | "dealerTurn" | "result";
type Result    = "win" | "lose" | "push" | "blackjack" | "bust";

const STARTING_CHIPS = 1000;
const BET_OPTS = [25, 50, 100, 200, 500];

type Leader = { username: string; score: number };

export default function Royal21() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [chips, setChips] = useState(STARTING_CHIPS);
  const [bet, setBet] = useState(0);
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [dealerRevealed, setDealerRevealed] = useState(false);
  const [gameState, setGameState] = useState<GameState>("betting");
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [highScore, setHighScore] = useState(STARTING_CHIPS);
  const [statsWins, setStatsWins] = useState(0);
  const [statsGames, setStatsGames] = useState(0);
  const [canDouble, setCanDouble] = useState(false);
  const flashAnim = React.useRef(new Animated.Value(0)).current;

  const fetchLeaders = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, "royal21Scores"), orderBy("score", "desc"), limit(5)));
      setLeaders(snap.docs.map(d => d.data() as Leader));
    } catch {}
  }, []);

  useEffect(() => { fetchLeaders(); }, [fetchLeaders]);

  const flash = (color: string) => {
    flashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const placeBet = (amount: number) => {
    if (amount > chips) return;
    Haptics.selectionAsync();
    setBet(prev => {
      const next = Math.min(chips, prev + amount);
      return next;
    });
  };

  const clearBet = () => { setBet(0); Haptics.selectionAsync(); };

  const dealGame = useCallback(() => {
    if (bet === 0) { setMessage("Place a bet first!"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const d = shuffle(makeDeck());
    const ph = [d[0], d[2]];
    const dh = [d[1], d[3]];
    setDeck(d.slice(4));
    setPlayerHand(ph);
    setDealerHand(dh);
    setDealerRevealed(false);
    setResult(null);
    setMessage("");
    setCanDouble(chips >= bet * 2);
    setGameState("playing");
    const ps = handScore(ph);
    if (ps === 21) {
      setDealerRevealed(true);
      setGameState("result");
      const ds = handScore(dh);
      if (ds === 21) { setResult("push"); setMessage("🤝 Push — Both Blackjack!"); setChips(c => c); }
      else { setResult("blackjack"); setMessage("🃏 Blackjack! You win 3:2!"); setChips(c => c + Math.floor(bet * 2.5)); flash("#FFD700"); }
      setStatsGames(g => g + 1); setStatsWins(w => w + 1);
    }
  }, [bet, chips]);

  const hit = useCallback(() => {
    if (gameState !== "playing") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayerHand(prev => {
      const next = [...prev, deck[0]];
      setDeck(d => d.slice(1));
      const score = handScore(next);
      if (score > 21) {
        setDealerRevealed(true);
        setGameState("result");
        setResult("bust");
        setMessage("💥 Bust! Over 21.");
        setChips(c => c - bet);
        setStatsGames(g => g + 1);
        flash("#EF4444");
      }
      setCanDouble(false);
      return next;
    });
  }, [gameState, deck, bet]);

  const stand = useCallback(() => {
    if (gameState !== "playing") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDealerRevealed(true);
    setGameState("dealerTurn");
    let dh = [...dealerHand]; let d = [...deck];
    while (handScore(dh) < 17) { dh = [...dh, d[0]]; d = d.slice(1); }
    setDealerHand(dh);
    setDeck(d);
    const ps = handScore(playerHand);
    const ds = handScore(dh);
    setGameState("result");
    setStatsGames(g => g + 1);
    if (ds > 21 || ps > ds) {
      setResult("win"); setMessage(`🎉 You win! ${ps} vs ${ds}`);
      setChips(c => c + bet); setStatsWins(w => w + 1); flash("#10B981");
    } else if (ps === ds) {
      setResult("push"); setMessage(`🤝 Push! Both ${ps}`); flash("#F59E0B");
    } else {
      setResult("lose"); setMessage(`😞 Dealer wins. ${ds} vs ${ps}`);
      setChips(c => { const n = c - bet; if (n > highScore) { setHighScore(n); saveScore(n); } return n; }); flash("#EF4444");
    }
  }, [gameState, dealerHand, playerHand, deck, bet, highScore]);

  const doubleDown = useCallback(() => {
    if (!canDouble || gameState !== "playing") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const newBet = bet * 2;
    setBet(newBet);
    setPlayerHand(prev => {
      const next = [...prev, deck[0]];
      setDeck(d => d.slice(1));
      setCanDouble(false);
      setTimeout(() => stand(), 100);
      return next;
    });
  }, [canDouble, gameState, bet, deck, stand]);

  const saveScore = async (score: number) => {
    if (!user) return;
    try {
      await addDoc(collection(db, "royal21Scores"), {
        userId: user.uid, username: profile?.username ?? "Player",
        score, createdAt: serverTimestamp(),
      });
      await fetchLeaders();
    } catch {}
  };

  const newHand = () => {
    if (chips <= 0) { setChips(STARTING_CHIPS); }
    setBet(0); setGameState("betting"); setMessage(""); setResult(null);
  };

  const playerScore = playerHand.length > 0 ? handScore(playerHand) : 0;
  const dealerScore = dealerRevealed && dealerHand.length > 0 ? handScore(dealerHand) : 0;

  const resultColor = result === "win" || result === "blackjack" ? "#10B981"
    : result === "lose" || result === "bust" ? "#EF4444" : "#F59E0B";

  return (
    <View style={[C.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={C.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Image source={APP_ICON} style={C.backIcon} resizeMode="cover" />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={C.title}>Royal 21 ♠</Text>
          <Text style={C.subtitle}>Blackjack · Casino Style</Text>
        </View>
        <View style={C.chipsBox}>
          <Text style={C.chipsVal}>{chips.toLocaleString()}</Text>
          <Text style={C.chipsLbl}>chips</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 0 }}>
        {/* Flash overlay */}
        <Animated.View style={[C.flashOverlay, { opacity: flashAnim }]} pointerEvents="none" />

        {/* Dealer area */}
        <View style={C.tableArea}>
          <View style={C.handSection}>
            <Text style={C.handLabel}>DEALER {dealerScore > 0 ? `— ${dealerScore}` : ""}</Text>
            <View style={C.cards}>
              {dealerHand.map((c, i) => {
                const hidden = !dealerRevealed && i === 1;
                return hidden ? (
                  <View key={i} style={[C.card, C.cardHidden]}>
                    <Text style={C.cardBack}>🂠</Text>
                  </View>
                ) : (
                  <View key={i} style={[C.card, isRed(c) && C.cardRed]}>
                    <Text style={[C.cardVal, { color: isRed(c) ? "#DC2626" : "#111" }]}>{c.value}</Text>
                    <Text style={[C.cardSuit, { color: isRed(c) ? "#DC2626" : "#111" }]}>{c.suit}</Text>
                  </View>
                );
              })}
              {dealerHand.length === 0 && <Text style={C.waitTxt}>Waiting…</Text>}
            </View>
          </View>

          {/* Divider */}
          <View style={C.divider}><Text style={C.dividerTxt}>♠♥ TABLE ♦♣</Text></View>

          {/* Player area */}
          <View style={C.handSection}>
            <Text style={C.handLabel}>YOU {playerScore > 0 ? `— ${playerScore}` : ""}</Text>
            <View style={C.cards}>
              {playerHand.map((c, i) => (
                <View key={i} style={[C.card, isRed(c) && C.cardRed]}>
                  <Text style={[C.cardVal, { color: isRed(c) ? "#DC2626" : "#111" }]}>{c.value}</Text>
                  <Text style={[C.cardSuit, { color: isRed(c) ? "#DC2626" : "#111" }]}>{c.suit}</Text>
                </View>
              ))}
              {playerHand.length === 0 && <Text style={C.waitTxt}>Place bet to start</Text>}
            </View>
          </View>
        </View>

        {/* Message */}
        {message !== "" && (
          <View style={[C.resultBanner, { backgroundColor: resultColor + "20", borderColor: resultColor + "50" }]}>
            <Text style={[C.resultTxt, { color: resultColor }]}>{message}</Text>
          </View>
        )}

        {/* ── BETTING UI ── */}
        {gameState === "betting" && (
          <View style={C.betPanel}>
            <View style={C.betRow}>
              <Text style={C.betLabel}>Current Bet:</Text>
              <Text style={C.betVal}>🪙 {bet.toLocaleString()}</Text>
              <TouchableOpacity onPress={clearBet} style={C.clearBtn}>
                <Text style={C.clearBtnTxt}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={C.chipRow}>
              {BET_OPTS.map(amt => (
                <TouchableOpacity
                  key={amt}
                  style={[C.chipBtn, chips < amt && C.chipBtnDisabled]}
                  onPress={() => placeBet(amt)}
                  disabled={chips < amt}
                >
                  <Text style={C.chipBtnTxt}>{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[C.dealBtn, bet === 0 && C.dealBtnDisabled]}
              onPress={dealGame}
              disabled={bet === 0}
            >
              <Text style={C.dealBtnTxt}>🃏 DEAL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── PLAYING UI ── */}
        {gameState === "playing" && (
          <View style={C.actionPanel}>
            <TouchableOpacity style={[C.actionBtn, { backgroundColor: "#10B981" }]} onPress={hit}>
              <Text style={C.actionBtnTxt}>HIT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[C.actionBtn, { backgroundColor: "#3B82F6" }]} onPress={stand}>
              <Text style={C.actionBtnTxt}>STAND</Text>
            </TouchableOpacity>
            {canDouble && (
              <TouchableOpacity style={[C.actionBtn, { backgroundColor: "#F59E0B" }]} onPress={doubleDown}>
                <Text style={C.actionBtnTxt}>2× DOUBLE</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── RESULT UI ── */}
        {gameState === "result" && (
          <View style={C.actionPanel}>
            <TouchableOpacity style={[C.actionBtn, { backgroundColor: "#7C3AED", flex: 1 }]} onPress={newHand}>
              <Text style={C.actionBtnTxt}>
                {chips <= 0 ? "🔄 REBUY" : "NEXT HAND ▶"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stats */}
        <View style={C.statsPanel}>
          <View style={C.statItem}><Text style={C.statVal2}>{statsGames}</Text><Text style={C.statLbl2}>Hands</Text></View>
          <View style={C.statItem}><Text style={[C.statVal2, { color: "#10B981" }]}>{statsWins}</Text><Text style={C.statLbl2}>Wins</Text></View>
          <View style={C.statItem}><Text style={[C.statVal2, { color: "#F59E0B" }]}>{statsGames > 0 ? Math.round(statsWins / statsGames * 100) : 0}%</Text><Text style={C.statLbl2}>Win Rate</Text></View>
          <View style={C.statItem}><Text style={[C.statVal2, { color: "#A855F7" }]}>{highScore.toLocaleString()}</Text><Text style={C.statLbl2}>Best</Text></View>
        </View>

        {/* Leaderboard */}
        {leaders.length > 0 && (
          <View style={C.leaderPanel}>
            <Text style={C.leaderTitle}>🏆 High Rollers</Text>
            {leaders.map((l, i) => (
              <View key={i} style={C.leaderRow}>
                <Text style={{ fontSize: 18 }}>{["🥇","🥈","🥉","4.","5."][i]}</Text>
                <Text style={C.leaderName}>{l.username}</Text>
                <Text style={C.leaderChips}>🪙 {l.score.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

const C = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#0A3D1F" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, paddingTop: 8, backgroundColor: "#071F10", borderBottomWidth: 1, borderBottomColor: "#0E4A22" },
  backIcon:     { width: 26, height: 26, borderRadius: 7 },
  title:        { fontFamily: "Inter_700Bold", fontSize: 18, color: "#FFD700" },
  subtitle:     { fontFamily: "Inter_400Regular", fontSize: 11, color: "#5A8A6A" },
  chipsBox:     { alignItems: "flex-end" },
  chipsVal:     { fontFamily: "Inter_700Bold", fontSize: 18, color: "#FBBF24" },
  chipsLbl:     { fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A8A6A" },

  tableArea:    { backgroundColor: "#0A3D1F", padding: 16, gap: 10 },
  handSection:  { gap: 8 },
  handLabel:    { fontFamily: "Inter_700Bold", fontSize: 11, color: "#5A8A6A", letterSpacing: 1.5 },
  cards:        { flexDirection: "row", gap: 8, flexWrap: "wrap", minHeight: 80, alignItems: "center" },
  card: {
    width: 56, height: 80, borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowRadius: 4, shadowOpacity: 0.3, elevation: 4,
    gap: 2,
  },
  cardRed:      { borderColor: "#DC262640" },
  cardHidden:   { backgroundColor: "#1E3A2F", borderColor: "#2A5A3F" },
  cardBack:     { fontSize: 44, color: "#2A5A3F" },
  cardVal:      { fontFamily: "Inter_700Bold", fontSize: 20 },
  cardSuit:     { fontFamily: "Inter_400Regular", fontSize: 16 },
  waitTxt:      { fontFamily: "Inter_400Regular", fontSize: 13, color: "#3A7A50", fontStyle: "italic" },

  divider:      { alignItems: "center", paddingVertical: 6 },
  dividerTxt:   { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#1E5A32", letterSpacing: 4 },

  resultBanner: { marginHorizontal: 16, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  resultTxt:    { fontFamily: "Inter_700Bold", fontSize: 18 },

  flashOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#FFD70040", zIndex: 5 },

  betPanel:     { padding: 16, gap: 12 },
  betRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  betLabel:     { fontFamily: "Inter_500Medium", fontSize: 14, color: "#5A8A6A", flex: 1 },
  betVal:       { fontFamily: "Inter_700Bold", fontSize: 18, color: "#FBBF24" },
  clearBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#1E3A2F" },
  clearBtnTxt:  { fontFamily: "Inter_500Medium", fontSize: 12, color: "#5A8A6A" },
  chipRow:      { flexDirection: "row", gap: 8 },
  chipBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 40, alignItems: "center", justifyContent: "center",
    backgroundColor: "#1E5A32", borderWidth: 2, borderColor: "#FFD70060",
  },
  chipBtnDisabled: { opacity: 0.3 },
  chipBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 14, color: "#FFD700" },
  dealBtn:      { backgroundColor: "#FFD700", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  dealBtnDisabled: { opacity: 0.4 },
  dealBtnTxt:   { fontFamily: "Inter_700Bold", fontSize: 18, color: "#071F10", letterSpacing: 1 },

  actionPanel:  { flexDirection: "row", padding: 16, gap: 10 },
  actionBtn:    { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  actionBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff", letterSpacing: 0.5 },

  statsPanel:   { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#071F10", borderTopWidth: 1, borderTopColor: "#0E4A22" },
  statItem:     { flex: 1, alignItems: "center" },
  statVal2:     { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff" },
  statLbl2:     { fontFamily: "Inter_400Regular", fontSize: 10, color: "#5A8A6A", marginTop: 2 },

  leaderPanel:  { padding: 16, gap: 8 },
  leaderTitle:  { fontFamily: "Inter_700Bold", fontSize: 14, color: "#5A8A6A" },
  leaderRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  leaderName:   { fontFamily: "Inter_500Medium", fontSize: 14, color: "#ccc", flex: 1 },
  leaderChips:  { fontFamily: "Inter_700Bold", fontSize: 14, color: "#FBBF24" },
});
