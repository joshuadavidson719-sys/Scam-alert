import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Animated, PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, addDoc, query, where, orderBy,
  limit, getDocs, serverTimestamp,
} from "firebase/firestore";

const { width: SW, height: SH } = Dimensions.get("window");
const CARD_W = SW - 48;
const CARD_H = SH * 0.42;
const SWIPE_THRESHOLD = SW * 0.28;

// ── Card data ──────────────────────────────────────────────────────────────
type CardType = "scam" | "legit";
type Card = { id: number; type: CardType; category: string; emoji: string; scenario: string; hint: string };

const ALL_CARDS: Card[] = [
  { id: 1,  type: "scam",  category: "Email",        emoji: "📧", scenario: "You get an email from paypal@secure-payments-verify.net asking you to confirm your card details immediately.", hint: "PayPal only emails from @paypal.com — the domain is fake." },
  { id: 2,  type: "legit", category: "Email",        emoji: "📧", scenario: "Amazon sends an order confirmation with your name, address and correct order number to your registered email.", hint: "Legitimate order confirmations from Amazon include your full delivery details." },
  { id: 3,  type: "scam",  category: "Text Message", emoji: "💬", scenario: "'URGENT: Your package is delayed. Pay a £3 customs fee to release it: bit.ly/pkg-fee99'", hint: "Delivery companies never ask you to pay fees via SMS links." },
  { id: 4,  type: "scam",  category: "Phone Call",   emoji: "📞", scenario: "A caller says they're from Microsoft Support and that your PC has sent error alerts. They want remote access to fix it.", hint: "Microsoft never calls you unsolicited. This is a remote access scam." },
  { id: 5,  type: "legit", category: "Email",        emoji: "🏦", scenario: "Your bank emails your monthly statement PDF to the address on file — no links, no requests for details.", hint: "Monthly statements via registered email with no action required are normal." },
  { id: 6,  type: "scam",  category: "Social Media", emoji: "🎁", scenario: "'Congratulations! You've been selected to win a brand new iPhone 15. Tap to claim before midnight!'", hint: "Unsolicited prize notifications are always scams. No one gives away iPhones." },
  { id: 7,  type: "scam",  category: "WhatsApp",     emoji: "💬", scenario: "'Hi Mum, I broke my phone. This is my new number. Can you send £250 urgently? Will explain later.'", hint: "Family impersonation scams — always call back on the number you already have." },
  { id: 8,  type: "legit", category: "Insurance",    emoji: "🛡️", scenario: "Your insurance company emails your annual renewal quote from their official domain with your policy number.", hint: "Annual renewal quotes to your registered email are routine and expected." },
  { id: 9,  type: "scam",  category: "Email",        emoji: "📺", scenario: "'Your Netflix account will be closed today. Update your payment info now: netflix-account-billing.com'", hint: "Netflix only uses netflix.com — any other domain is phishing." },
  { id: 10, type: "scam",  category: "Investment",   emoji: "₿",  scenario: "An ad: 'Invest just $200 in our crypto fund and earn $2,000 guaranteed in 7 days. 100% safe returns!'", hint: "No investment has guaranteed returns. This is an investment scam." },
  { id: 11, type: "legit", category: "Government",   emoji: "📝", scenario: "HMRC sends a physical letter about your tax return showing your correct National Insurance number.", hint: "HMRC uses post for official matters and includes your NI number for verification." },
  { id: 12, type: "scam",  category: "Pop-up",       emoji: "⚠️", scenario: "A browser pop-up: 'ALERT: 3 viruses detected on your device! Download ScamCleaner Pro immediately to remove them!'", hint: "Websites cannot detect viruses on your device. This is scareware." },
  { id: 13, type: "legit", category: "Healthcare",   emoji: "🏥", scenario: "Your GP surgery sends a text reminder for tomorrow's appointment you booked last week.", hint: "Appointment reminders from your registered GP are completely normal." },
  { id: 14, type: "scam",  category: "LinkedIn",     emoji: "💼", scenario: "A LinkedIn stranger messages: 'I saw your profile. Join my private investment group — members earn 300% weekly, guaranteed.'", hint: "No legitimate investment returns 300% weekly. This is a social media investment scam." },
  { id: 15, type: "scam",  category: "Email",        emoji: "📧", scenario: "'Your email storage is 99% full. Your account will be deleted in 24 hours unless you click here to upgrade.'", hint: "Real storage warnings appear inside your email app — never via urgent links." },
  { id: 16, type: "legit", category: "Payment",      emoji: "💳", scenario: "PayPal sends a payment receipt for a pair of trainers you just bought, from service@paypal.com.", hint: "Legitimate if you made the purchase and the sender domain is exactly @paypal.com." },
  { id: 17, type: "scam",  category: "Romance",      emoji: "💝", scenario: "Someone you met online two weeks ago has fallen in love with you and urgently needs £500 in gift cards for a medical emergency.", hint: "Requesting gift cards is one of the biggest red flags of a romance scam." },
  { id: 18, type: "scam",  category: "Text Message", emoji: "💰", scenario: "'You have an unclaimed HMRC tax refund of £842. Claim within 48 hours: hmrc-tax-refund.co.uk/claim'", hint: "HMRC never initiates refunds via text message or unofficial links." },
  { id: 19, type: "legit", category: "Utility",      emoji: "⚡", scenario: "Your energy supplier emails to confirm your direct debit has increased by £15 from next month.", hint: "Billing change notifications from your provider to your registered email are normal." },
  { id: 20, type: "scam",  category: "Phone Call",   emoji: "🚔", scenario: "A caller claims to be a police officer. You owe a fine and must pay via Bitcoin within 2 hours or be arrested.", hint: "Police never demand Bitcoin payments. This is a police impersonation scam." },
  { id: 21, type: "scam",  category: "Email",        emoji: "🎰", scenario: "'You have been randomly selected for a £5,000 cash prize survey. Complete it in 10 minutes to receive your reward.'", hint: "Random cash prize surveys are phishing for your personal information." },
  { id: 22, type: "legit", category: "Shopping",     emoji: "📦", scenario: "Royal Mail sends a tracking notification with a reference number for a parcel you are expecting.", hint: "Tracking texts with a reference matching your order are legitimate." },
  { id: 23, type: "scam",  category: "Investment",   emoji: "📈", scenario: "A friend's hacked Instagram sends you a DM: 'I made £3,000 last week using this trading bot, check it out!'", hint: "Friends' accounts get hacked to promote scams. Always verify via another channel." },
  { id: 24, type: "legit", category: "Banking",      emoji: "🏦", scenario: "Your bank sends a fraud alert text and calls you — but only asks you to confirm transactions you can see in your app.", hint: "Legitimate bank fraud alerts only ask about transactions, not passwords or PINs." },
  { id: 25, type: "scam",  category: "QR Code",      emoji: "📷", scenario: "A QR code on a parking meter links to 'pay-parking-uk.com' and asks for your card details and home address.", hint: "Fake QR codes on parking meters are a growing scam. Always check the official app." },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Screen = "menu" | "playing" | "result" | "gameover";

export default function ScamSwipe() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [screen,       setScreen]       = useState<Screen>("menu");
  const [deck,         setDeck]         = useState<Card[]>([]);
  const [cardIdx,      setCardIdx]      = useState(0);
  const [score,        setScore]        = useState(0);
  const [lives,        setLives]        = useState(3);
  const [streak,       setStreak]       = useState(0);
  const [lastCorrect,  setLastCorrect]  = useState<boolean | null>(null);
  const [personalBest, setPersonalBest] = useState(0);
  const [finalScore,   setFinalScore]   = useState(0);
  const [newBest,      setNewBest]      = useState(false);

  const translate  = useRef(new Animated.ValueXY()).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const scoreRef   = useRef(0);
  const livesRef   = useRef(3);
  const streakRef  = useRef(0);

  // Load personal best
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "swipeScores"),
      where("userId", "==", user.uid), orderBy("score", "desc"), limit(1)))
      .then(s => { if (!s.empty) setPersonalBest(s.docs[0].data().score); })
      .catch(() => {});
  }, [user]);

  // Derived animated values
  const cardRotate = translate.x.interpolate({
    inputRange: [-SW / 2, 0, SW / 2],
    outputRange: ["-14deg", "0deg", "14deg"],
  });
  const scamOpacity = translate.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD * 0.3, 0],
    outputRange: [1, 0.5, 0], extrapolate: "clamp",
  });
  const legitOpacity = translate.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD * 0.3, SWIPE_THRESHOLD],
    outputRange: [0, 0.5, 1], extrapolate: "clamp",
  });

  // PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event(
        [null, { dx: translate.x, dy: translate.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, state) => {
        if (Math.abs(state.dx) > SWIPE_THRESHOLD) {
          const dir = state.dx > 0 ? "legit" : "scam";
          animateOff(dir);
        } else {
          Animated.spring(translate, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const animateOff = useCallback((answer: CardType) => {
    const toX = answer === "legit" ? SW * 1.4 : -SW * 1.4;
    Animated.timing(translate, {
      toValue: { x: toX, y: 0 }, duration: 280, useNativeDriver: false,
    }).start(() => {
      translate.setValue({ x: 0, y: 0 });
      handleAnswer(answer);
    });
  }, [translate]); // eslint-disable-line

  const handleAnswer = useCallback((answer: CardType) => {
    setCardIdx(ci => {
      const card = deck[ci];
      if (!card) return ci;
      const correct = answer === card.type;

      setLastCorrect(correct);
      setScreen("result");
      resultAnim.setValue(0);
      Animated.timing(resultAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();

      if (correct) {
        streakRef.current++;
        setStreak(streakRef.current);
        const bonus = Math.min(streakRef.current, 5) * 10;
        scoreRef.current += bonus;
        setScore(scoreRef.current);
      } else {
        streakRef.current = 0;
        setStreak(0);
        livesRef.current--;
        setLives(livesRef.current);
      }

      // Auto-advance after 1.4s
      setTimeout(() => {
        const nextIdx = ci + 1;
        if (livesRef.current <= 0 || nextIdx >= deck.length) {
          endGame(scoreRef.current);
        } else {
          setScreen("playing");
          setCardIdx(nextIdx);
        }
      }, 1400);

      return ci;
    });
  }, [deck, resultAnim]); // eslint-disable-line

  const endGame = (sc: number) => {
    setFinalScore(sc);
    setScreen("gameover");
    if (user && profile && sc > 0) {
      addDoc(collection(db, "swipeScores"), {
        userId: user.uid, username: profile.username,
        profilePhoto: profile.profilePhoto ?? null,
        score: sc, createdAt: serverTimestamp(),
      }).then(() => {
        if (sc > personalBest) { setPersonalBest(sc); setNewBest(true); }
      }).catch(() => {});
    }
  };

  const startGame = () => {
    const shuffled = shuffle(ALL_CARDS);
    setDeck(shuffled);
    setCardIdx(0);
    scoreRef.current = 0; livesRef.current = 3; streakRef.current = 0;
    setScore(0); setLives(3); setStreak(0);
    setLastCorrect(null); setNewBest(false);
    translate.setValue({ x: 0, y: 0 });
    setScreen("playing");
  };

  // ══════════════════════════════════════════════════════════════════════
  // MENU
  // ══════════════════════════════════════════════════════════════════════
  if (screen === "menu") {
    return (
      <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={S.nav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[S.navTitle, { color: colors.text }]}>Scam Swipe 🃏</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={[S.heroCard, { backgroundColor: "#3B82F610", borderColor: "#3B82F630" }]}>
          <Text style={S.heroEmoji}>🃏</Text>
          <Text style={[S.heroTitle, { color: colors.text }]}>Real or Scam?</Text>
          <Text style={[S.heroSub, { color: colors.textMuted }]}>
            Read each scenario and decide: is it a scam or is it legitimate?
            Swipe right for LEGIT, swipe left for SCAM.
          </Text>
          <View style={S.swipeHints}>
            <View style={[S.swipeHint, { backgroundColor: "#EF444418", borderColor: "#EF444440" }]}>
              <Text style={S.swipeArrow}>←</Text>
              <Text style={[S.swipeHintLabel, { color: "#EF4444" }]}>SCAM</Text>
            </View>
            <Text style={{ fontSize: 28 }}>🃏</Text>
            <View style={[S.swipeHint, { backgroundColor: "#10B98118", borderColor: "#10B98140" }]}>
              <Text style={[S.swipeHintLabel, { color: "#10B981" }]}>LEGIT</Text>
              <Text style={S.swipeArrow}>→</Text>
            </View>
          </View>
          <Text style={[S.streakInfo, { color: colors.textMuted }]}>
            🔥 Streak bonus: up to ×5 points for consecutive correct answers!
          </Text>
          {personalBest > 0 && (
            <View style={[S.bestRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={S.bestEmoji}>🏆</Text>
              <Text style={[S.bestLabel, { color: colors.textMuted }]}>Your Best</Text>
              <Text style={[S.bestScore, { color: "#3B82F6" }]}>{personalBest.toLocaleString()}</Text>
            </View>
          )}
        </View>

        <Text style={[S.cardCount, { color: colors.textMuted }]}>{ALL_CARDS.length} scenarios to identify</Text>

        <TouchableOpacity style={[S.playBtn, { backgroundColor: "#3B82F6" }]} onPress={startGame} activeOpacity={0.85}>
          <Text style={S.playBtnEmoji}>🃏</Text>
          <Text style={S.playBtnLabel}>Start Swiping</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.outlineBtn, { borderColor: colors.border }]} onPress={() => router.back()}>
          <Text style={[S.outlineBtnLabel, { color: colors.textMuted }]}>← Back to Games</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // GAME OVER
  // ══════════════════════════════════════════════════════════════════════
  if (screen === "gameover") {
    const pct = Math.round((finalScore / (ALL_CARDS.length * 50)) * 100);
    const grade = pct >= 80 ? "🛡️ Expert" : pct >= 60 ? "🔍 Sharp" : pct >= 40 ? "📚 Learning" : "⚠️ Vulnerable";
    return (
      <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top, justifyContent: "center" }]}>
        <View style={S.goWrap}>
          <Text style={S.goEmoji}>{newBest ? "🏆" : grade.split(" ")[0]}</Text>
          <Text style={[S.goTitle, { color: colors.text }]}>{newBest ? "New Record!" : grade.split(" ")[1] + "!"}</Text>
          <Text style={[S.goSub, { color: colors.textMuted }]}>
            {pct >= 80 ? "Excellent! You can spot scams like a pro." : pct >= 60 ? "Good awareness. Keep training!" : "More practice will sharpen your instincts."}
          </Text>
          <View style={[S.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={S.scoreRow}>
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: "#3B82F6" }]}>{finalScore.toLocaleString()}</Text>
                <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Score</Text>
              </View>
              <View style={[S.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: "#10B981" }]}>{pct}%</Text>
                <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Accuracy</Text>
              </View>
              <View style={[S.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={S.scoreItem}>
                <Text style={[S.scoreVal, { color: "#F59E0B" }]}>{Math.max(finalScore, personalBest).toLocaleString()}</Text>
                <Text style={[S.scoreLabel, { color: colors.textMuted }]}>Best</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={[S.playBtn, { backgroundColor: "#3B82F6", marginTop: 24 }]} onPress={startGame}>
            <Text style={S.playBtnEmoji}>🔄</Text>
            <Text style={S.playBtnLabel}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[S.outlineBtn, { borderColor: colors.border }]} onPress={() => setScreen("menu")}>
            <Text style={[S.outlineBtnLabel, { color: colors.textMuted }]}>🏠 Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // PLAYING + RESULT
  // ══════════════════════════════════════════════════════════════════════
  const card = deck[cardIdx];
  if (!card) return null;

  const remaining = deck.length - cardIdx;
  const progressPct = cardIdx / deck.length;

  return (
    <View style={[S.screen, { backgroundColor: "#070B14", paddingTop: insets.top }]}>

      {/* HUD */}
      <View style={S.hud}>
        <TouchableOpacity onPress={() => setScreen("menu")} style={S.hudBack}>
          <Feather name="x" size={16} color="#fff" />
        </TouchableOpacity>
        <View style={S.hudCenter}>
          <Text style={S.hudScore}>{score}</Text>
          {streak > 1 && <Text style={S.hudStreak}>🔥 {streak} streak!</Text>}
        </View>
        <View style={S.hudRight}>
          <View style={S.livesRow}>
            {[0, 1, 2].map(i => (
              <Text key={i} style={{ fontSize: 14, opacity: i < lives ? 1 : 0.18 }}>❤️</Text>
            ))}
          </View>
          <Text style={S.hudCards}>{remaining} left</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={S.progressBg}>
        <View style={[S.progressFill, { width: `${progressPct * 100}%` as any }]} />
      </View>

      {/* Swipe direction labels */}
      <View style={S.dirRow}>
        <Animated.View style={[S.dirLabel, S.dirScam, { opacity: scamOpacity }]}>
          <Text style={S.dirText}>← SCAM</Text>
        </Animated.View>
        <Animated.View style={[S.dirLabel, S.dirLegit, { opacity: legitOpacity }]}>
          <Text style={S.dirText}>LEGIT →</Text>
        </Animated.View>
      </View>

      {/* Card */}
      <View style={S.cardStack}>
        {/* Back cards (visual depth) */}
        {[2, 1].map((depth) => (
          deck[cardIdx + depth] && (
            <View key={depth} style={[S.card, S.backCard, {
              backgroundColor: "#111828",
              transform: [{ scale: 1 - depth * 0.04 }, { translateY: depth * 8 }],
              opacity: 1 - depth * 0.3,
            }]} />
          )
        ))}

        {/* Active card */}
        <Animated.View
          style={[S.card, {
            backgroundColor: "#111828",
            transform: [
              { translateX: translate.x },
              { translateY: translate.y },
              { rotate: cardRotate },
            ],
          }]}
          {...(screen === "playing" ? panResponder.panHandlers : {})}
        >
          {/* Category badge */}
          <View style={[S.categoryBadge, { backgroundColor: "#3B82F620", borderColor: "#3B82F640" }]}>
            <Text style={S.categoryEmoji}>{card.emoji}</Text>
            <Text style={[S.categoryText, { color: "#3B82F6" }]}>{card.category}</Text>
          </View>

          {/* Card number */}
          <Text style={S.cardNumber}>#{cardIdx + 1} of {deck.length}</Text>

          {/* Scenario */}
          <Text style={S.scenarioText}>{card.scenario}</Text>

          {/* Swipe hint */}
          {screen === "playing" && (
            <View style={S.swipePrompt}>
              <Text style={S.swipePromptTxt}>← Scam &nbsp;&nbsp; Legit →</Text>
            </View>
          )}

          {/* Result overlay */}
          {screen === "result" && (
            <Animated.View style={[
              S.resultOverlay,
              {
                backgroundColor: lastCorrect ? "#10B98188" : "#EF444488",
                opacity: resultAnim,
              },
            ]}>
              <Text style={S.resultBigEmoji}>{lastCorrect ? "✅" : "❌"}</Text>
              <Text style={S.resultTitle}>{lastCorrect ? "Correct!" : "Wrong!"}</Text>
              <Text style={S.resultHint}>{card.hint}</Text>
              {lastCorrect && streak > 1 && (
                <Text style={S.resultBonus}>🔥 ×{Math.min(streak, 5)} streak bonus!</Text>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </View>

      {/* Tap buttons (alternative to swipe) */}
      {screen === "playing" && (
        <View style={S.tapButtons}>
          <TouchableOpacity
            style={[S.tapBtn, { backgroundColor: "#EF444420", borderColor: "#EF444460" }]}
            onPress={() => animateOff("scam")}
          >
            <Text style={S.tapBtnArrow}>←</Text>
            <Text style={[S.tapBtnLabel, { color: "#EF4444" }]}>SCAM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.tapBtn, { backgroundColor: "#10B98120", borderColor: "#10B98160" }]}
            onPress={() => animateOff("legit")}
          >
            <Text style={[S.tapBtnLabel, { color: "#10B981" }]}>LEGIT</Text>
            <Text style={S.tapBtnArrow}>→</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  screen:       { flex: 1 },
  nav:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:     { fontFamily: "Inter_700Bold", fontSize: 18 },

  heroCard:     { margin: 16, borderRadius: 20, borderWidth: 1, padding: 16, alignItems: "center", gap: 8 },
  heroEmoji:    { fontSize: 48 },
  heroTitle:    { fontFamily: "Inter_700Bold", fontSize: 20 },
  heroSub:      { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 20 },
  swipeHints:   { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 },
  swipeHint:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  swipeArrow:   { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  swipeHintLabel:{ fontFamily: "Inter_700Bold", fontSize: 13 },
  streakInfo:   { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center" },
  bestRow:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, width: "100%" },
  bestEmoji:    { fontSize: 18 },
  bestLabel:    { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 },
  bestScore:    { fontFamily: "Inter_700Bold", fontSize: 18 },
  cardCount:    { textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 4 },

  playBtn:      { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  playBtnEmoji: { fontSize: 22 },
  playBtnLabel: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  outlineBtn:   { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, paddingVertical: 14, borderWidth: 1, alignItems: "center" },
  outlineBtnLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },

  goWrap:       { alignItems: "center", paddingHorizontal: 24, gap: 8 },
  goEmoji:      { fontSize: 64 },
  goTitle:      { fontFamily: "Inter_700Bold", fontSize: 28 },
  goSub:        { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center" },
  scoreCard:    { width: "100%", borderRadius: 20, borderWidth: 1, padding: 24, marginTop: 16 },
  scoreRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  scoreItem:    { alignItems: "center", gap: 4 },
  scoreVal:     { fontFamily: "Inter_700Bold", fontSize: 22 },
  scoreLabel:   { fontFamily: "Inter_400Regular", fontSize: 12 },
  scoreDivider: { width: 1, height: 40 },

  hud:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  hudBack:      { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  hudCenter:    { flex: 1, alignItems: "center" },
  hudScore:     { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff" },
  hudStreak:    { fontFamily: "Inter_700Bold", fontSize: 12, color: "#F59E0B" },
  hudRight:     { alignItems: "flex-end", gap: 4 },
  hudCards:     { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.4)" },
  livesRow:     { flexDirection: "row", gap: 2 },

  progressBg:   { height: 4, backgroundColor: "#1A1A2E", marginHorizontal: 12, borderRadius: 2 },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: "#3B82F6" },

  dirRow:       { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 8 },
  dirLabel:     { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  dirScam:      { backgroundColor: "#EF444430" },
  dirLegit:     { backgroundColor: "#10B98130" },
  dirText:      { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },

  cardStack:    { flex: 1, alignItems: "center", justifyContent: "center" },
  card:         { width: CARD_W, height: CARD_H, borderRadius: 24, padding: 24, gap: 12, position: "relative", overflow: "hidden", elevation: 8 },
  backCard:     { position: "absolute", borderRadius: 24 },
  categoryBadge:{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, alignSelf: "flex-start" },
  categoryEmoji:{ fontSize: 16 },
  categoryText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  cardNumber:   { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.3)" },
  scenarioText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff", lineHeight: 24, flex: 1 },
  swipePrompt:  { alignItems: "center", paddingTop: 8 },
  swipePromptTxt:{ fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.3)" },

  resultOverlay:{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 24, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  resultBigEmoji:{ fontSize: 52 },
  resultTitle:  { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  resultHint:   { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.9)", textAlign: "center", lineHeight: 20 },
  resultBonus:  { fontFamily: "Inter_700Bold", fontSize: 14, color: "#F59E0B" },

  tapButtons:   { flexDirection: "row", gap: 12, paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
  tapBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5 },
  tapBtnArrow:  { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  tapBtnLabel:  { fontFamily: "Inter_700Bold", fontSize: 16 },
});
