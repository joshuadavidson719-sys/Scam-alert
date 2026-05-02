import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Confetti } from "@/components/Confetti";
import { AchievementToast } from "@/components/AchievementToast";
import { useAchievements } from "@/hooks/useAchievements";

interface Question {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}

const QUESTIONS: Question[] = [
  {
    q: "You receive an email saying you've won $1,000,000. It asks you to pay $500 to release the prize. What is this?",
    options: ["Legitimate prize", "Advance fee fraud", "Phishing", "Lottery scam"],
    correct: 1,
    explanation: "This is advance-fee fraud (also called '419 fraud'). Legitimate prizes never require upfront payment.",
  },
  {
    q: "A link arrives via text: 'http://paypa1.com/verify-account'. What's the warning sign?",
    options: ["Nothing suspicious", "Lookalike domain (paypa1 ≠ paypal)", "The word 'verify'", "It came via SMS"],
    correct: 1,
    explanation: "Scammers use lookalike domains — replacing letters with numbers (paypa1 instead of paypal) to trick victims.",
  },
  {
    q: "Someone online claims to love you after 2 weeks and asks for money for a medical emergency. This is likely:",
    options: ["True love", "A friend in need", "A romance scam", "An investment opportunity"],
    correct: 2,
    explanation: "Romance scams build emotional trust quickly before inventing a crisis to extract money. Never send money to someone you haven't met in person.",
  },
  {
    q: "An 'IRS agent' calls threatening arrest unless you pay $2,000 in gift cards immediately. What should you do?",
    options: ["Buy the gift cards", "Ask for their badge number", "Hang up — the IRS never calls like this", "Pay via wire transfer instead"],
    correct: 2,
    explanation: "The IRS contacts taxpayers by mail first. They never demand immediate payment, threaten arrest, or accept gift cards.",
  },
  {
    q: "Which is the safest way to verify a suspicious call claiming to be your bank?",
    options: ["Call back the number they gave you", "Give your card number to prove identity", "Hang up and call the number on the back of your card", "Answer their security questions"],
    correct: 2,
    explanation: "Always use official contact numbers from your card or bank's website — never call back numbers provided by the caller.",
  },
  {
    q: "A job offer promises $5,000/week working from home with no experience required. This is:",
    options: ["A great opportunity", "Almost certainly a scam", "Normal for remote work", "A government program"],
    correct: 1,
    explanation: "Unrealistic pay with zero requirements is a classic scam signal. Legitimate jobs have reasonable expectations.",
  },
  {
    q: "You receive a text: 'Your package could not be delivered. Click here to reschedule.' You weren't expecting a package. What do you do?",
    options: ["Click the link", "Reply STOP", "Ignore or report it as spam", "Forward to friends"],
    correct: 2,
    explanation: "This is a 'smishing' (SMS phishing) attack. If you weren't expecting a package, ignore and report the message.",
  },
  {
    q: "Which of these is a red flag in an online purchase?",
    options: ["Seller has reviews", "Price is far below market value", "Payment via credit card", "Item ships within 5 days"],
    correct: 1,
    explanation: "Prices far below market value are a major red flag — scammers use them to lure victims before taking payment and disappearing.",
  },
  {
    q: "A pop-up says your computer has a virus and you must call Microsoft immediately. What is this?",
    options: ["A real Microsoft warning", "Tech support scam", "Virus notification", "Windows update"],
    correct: 1,
    explanation: "Microsoft never shows pop-ups asking you to call them. These are tech support scams designed to gain remote access or charge fake fees.",
  },
  {
    q: "What should you do FIRST if you've been scammed?",
    options: ["Keep it private to avoid embarrassment", "Contact your bank and report it immediately", "Wait and see if the money returns", "Message the scammer to demand a refund"],
    correct: 1,
    explanation: "Act quickly — contact your bank to stop/reverse transactions, then report to authorities (FTC, FBI IC3). Early action maximizes recovery chances.",
  },
];

export default function ScamQuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { unlock, newlyUnlocked, clearNewlyUnlocked } = useAchievements(user?.uid);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(new Array(QUESTIONS.length).fill(null));

  const q = QUESTIONS[current];
  const isCorrect = selected === q.correct;
  const totalQ = QUESTIONS.length;

  const choose = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const correct = idx === q.correct;
    Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    if (correct) setScore((s) => s + 1);
    setAnswers((prev) => { const a = [...prev]; a[current] = idx; return a; });
  };

  const next = () => {
    if (current < totalQ - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      setDone(true);
      setShowConfetti(true);
      if (user) {
        updateDoc(doc(db, "users", user.uid), { points: increment(score * 5) }).catch(() => {});
        unlock("quiz_done");
        if (score === totalQ) unlock("quiz_perfect");
      }
    }
  };

  const restart = () => {
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setDone(false);
    setAnswers(new Array(QUESTIONS.length).fill(null));
  };

  const pct = Math.round((score / totalQ) * 100);
  const grade = pct >= 90 ? "🏆 Expert" : pct >= 70 ? "🛡️ Aware" : pct >= 50 ? "📢 Learning" : "🌱 Beginner";

  if (done) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Confetti visible={showConfetti} onComplete={() => setShowConfetti(false)} />
        <AchievementToast achievement={newlyUnlocked} onHide={clearNewlyUnlocked} />
        <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Quiz Results</Text>
          <View style={{ width: 22 }} />
        </View>
        <ScrollView contentContainerStyle={{ alignItems: "center", padding: 32, gap: 20 }}>
          <Text style={styles.resultEmoji}>{pct >= 90 ? "🏆" : pct >= 70 ? "🛡️" : pct >= 50 ? "📢" : "🌱"}</Text>
          <Text style={[styles.resultGrade, { color: colors.text }]}>{grade}</Text>
          <Text style={[styles.resultScore, { color: colors.primary }]}>{score}/{totalQ} correct</Text>
          <View style={[styles.scoreBg, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.scoreBar, { width: `${pct}%` as any, backgroundColor: pct >= 70 ? "#10B981" : pct >= 50 ? "#F59E0B" : colors.primary }]} />
          </View>
          <Text style={[styles.resultPct, { color: colors.textSecondary }]}>{pct}% — {score * 5} bonus points awarded!</Text>

          <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>Review Answers</Text>
            {QUESTIONS.map((q, i) => (
              <View key={i} style={[styles.reviewRow, { borderBottomColor: colors.border }]}>
                <Feather
                  name={answers[i] === q.correct ? "check-circle" : "x-circle"}
                  size={18}
                  color={answers[i] === q.correct ? "#10B981" : colors.primary}
                />
                <Text style={[styles.reviewQ, { color: colors.text }]} numberOfLines={2}>{q.q}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.restartBtn, { backgroundColor: colors.primary }]} onPress={restart}>
            <Feather name="refresh-cw" size={18} color="#fff" />
            <Text style={styles.restartBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={() => router.back()}>
            <Text style={[styles.backBtnText, { color: colors.text }]}>Back to App</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Scam Awareness Quiz</Text>
        <Text style={[styles.progress, { color: colors.textMuted }]}>{current + 1}/{totalQ}</Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${((current) / totalQ) * 100}%` as any, backgroundColor: colors.primary }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View style={[styles.questionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.qBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.qBadgeText, { color: colors.primary }]}>Q{current + 1}</Text>
          </View>
          <Text style={[styles.questionText, { color: colors.text }]}>{q.q}</Text>
        </View>

        {q.options.map((opt, i) => {
          let bg = colors.card;
          let border = colors.border;
          let textColor = colors.text;
          if (selected !== null) {
            if (i === q.correct) { bg = "#10B98120"; border = "#10B981"; textColor = "#10B981"; }
            else if (i === selected && selected !== q.correct) { bg = colors.primary + "20"; border = colors.primary; textColor = colors.primary; }
          }
          return (
            <TouchableOpacity
              key={i}
              style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              onPress={() => choose(i)}
              disabled={selected !== null}
            >
              <View style={[styles.optionLetter, { backgroundColor: border + "30" }]}>
                <Text style={[styles.optionLetterText, { color: textColor }]}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={[styles.optionText, { color: textColor }]}>{opt}</Text>
              {selected !== null && i === q.correct && <Feather name="check" size={18} color="#10B981" />}
              {selected !== null && i === selected && selected !== q.correct && <Feather name="x" size={18} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}

        {selected !== null && (
          <View style={[styles.explanation, { backgroundColor: isCorrect ? "#10B98115" : colors.primary + "12", borderColor: isCorrect ? "#10B981" : colors.primary }]}>
            <Feather name={isCorrect ? "check-circle" : "alert-circle"} size={18} color={isCorrect ? "#10B981" : colors.primary} />
            <Text style={[styles.explanationText, { color: colors.text }]}>{q.explanation}</Text>
          </View>
        )}

        {selected !== null && (
          <TouchableOpacity style={[styles.nextBtn, { backgroundColor: colors.primary }]} onPress={next}>
            <Text style={styles.nextBtnText}>{current < totalQ - 1 ? "Next Question" : "See Results"}</Text>
            <Feather name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  progress: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  progressTrack: { height: 4 },
  progressFill: { height: "100%" },
  questionCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
  qBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  qBadgeText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  questionText: { fontFamily: "Inter_600SemiBold", fontSize: 17, lineHeight: 26 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1.5, padding: 16 },
  optionLetter: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  optionLetterText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  optionText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  explanation: { flexDirection: "row", gap: 12, borderRadius: 14, borderWidth: 1.5, padding: 16, alignItems: "flex-start" },
  explanationText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14 },
  nextBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 },
  // Results
  resultEmoji: { fontSize: 72 },
  resultGrade: { fontFamily: "Inter_700Bold", fontSize: 28 },
  resultScore: { fontFamily: "Inter_700Bold", fontSize: 22 },
  scoreBg: { width: "100%", height: 12, borderRadius: 6, borderWidth: 1, overflow: "hidden" },
  scoreBar: { height: "100%", borderRadius: 6 },
  resultPct: { fontFamily: "Inter_400Regular", fontSize: 14 },
  reviewCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  reviewTitle: { fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 4 },
  reviewRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingBottom: 10, borderBottomWidth: 1 },
  reviewQ: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13 },
  restartBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  restartBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 },
  backBtn: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  backBtnText: { fontFamily: "Inter_500Medium", fontSize: 15 },
});
