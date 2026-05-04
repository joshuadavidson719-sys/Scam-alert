import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

export interface Poll {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, string[]>; // optionIndex -> [userId]
  authorId: string;
  authorName: string;
  createdAt: number;
  expiresAt: number;
}

interface PollCardProps {
  poll: Poll;
}

export function PollCard({ poll }: PollCardProps) {
  const colors = useColors();
  const { user } = useAuth();
  const [voting, setVoting] = useState(false);

  const totalVotes = Object.values(poll.votes).reduce((s, arr) => s + arr.length, 0);
  const myVote = user
    ? Object.entries(poll.votes).find(([, voters]) => voters.includes(user.uid))?.[0]
    : undefined;
  const hasVoted = myVote !== undefined;
  const isExpired = Date.now() > poll.expiresAt;

  const vote = async (optIdx: string) => {
    if (!user || hasVoted || isExpired || voting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVoting(true);
    try {
      const ref = doc(db, "polls", poll.id);
      await updateDoc(ref, { [`votes.${optIdx}`]: arrayUnion(user.uid) });
    } catch {}
    setVoting(false);
  };

  const isActive = !isExpired;
  const hoursLeft = Math.max(0, Math.round((poll.expiresAt - Date.now()) / 3600000));

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.pollTag, { backgroundColor: "#3B82F620", borderColor: "#3B82F640" }]}>
          <Text style={styles.pollTagText}>📊 Community Poll</Text>
        </View>
        <Text style={[styles.timer, { color: isActive ? "#10B981" : colors.textMuted }]}>
          {isExpired ? "Ended" : `${hoursLeft}h left`}
        </Text>
      </View>

      <Text style={[styles.question, { color: colors.text }]}>{poll.question}</Text>

      <View style={styles.options}>
        {poll.options.map((opt, i) => {
          const key = String(i);
          const voters = poll.votes[key] ?? [];
          const pct = totalVotes > 0 ? Math.round((voters.length / totalVotes) * 100) : 0;
          const isMyVote = myVote === key;
          const winning = hasVoted && pct === Math.max(...Object.values(poll.votes).map((v) => v.length));

          return (
            <TouchableOpacity
              key={i}
              onPress={() => vote(key)}
              disabled={hasVoted || isExpired || voting}
              activeOpacity={0.8}
              style={[
                styles.option,
                {
                  backgroundColor: isMyVote
                    ? "#3B82F615"
                    : colors.surface ?? colors.muted,
                  borderColor: isMyVote ? "#3B82F6" : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.progressBar,
                  {
                    width: hasVoted ? `${pct}%` : "0%",
                    backgroundColor: isMyVote ? "#3B82F620" : "#3B82F610",
                  },
                ]}
              />
              <View style={styles.optRow}>
                <Text style={[styles.optText, { color: colors.text }]}>{opt}</Text>
                {hasVoted && (
                  <View style={styles.pctRow}>
                    {winning && <Text style={styles.winBadge}>👑</Text>}
                    <Text style={[styles.pct, { color: isMyVote ? "#3B82F6" : colors.textMuted }]}>
                      {pct}%
                    </Text>
                  </View>
                )}
                {isMyVote && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.voteCount, { color: colors.textMuted }]}>
        {totalVotes} vote{totalVotes !== 1 ? "s" : ""} · by {poll.authorName}
      </Text>
    </View>
  );
}

export function ActivePoll() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = Date.now();
    const q = query(
      collection(db, "polls"),
      where("expiresAt", ">", now),
      orderBy("expiresAt", "asc"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const data = d.data();
        setPoll({
          id: d.id,
          question: data.question,
          options: data.options,
          votes: data.votes ?? {},
          authorId: data.authorId,
          authorName: data.authorName,
          createdAt: data.createdAt?.toMillis?.() ?? 0,
          expiresAt: data.expiresAt,
        });
      } else {
        setPoll(null);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  if (loading) return null;
  if (!poll) return null;
  return <PollCard poll={poll} />;
}

function NoPollCTA() {
  const colors = useColors();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push("/create-poll" as never)}
      activeOpacity={0.85}
      style={[
        noPollStyles.card,
        { backgroundColor: colors.card, borderColor: "#3B82F640" },
      ]}
    >
      <View style={[noPollStyles.icon, { backgroundColor: "#3B82F620" }]}>
        <Feather name="bar-chart-2" size={24} color="#3B82F6" />
      </View>
      <Text style={[noPollStyles.title, { color: colors.text }]}>No active poll</Text>
      <Text style={[noPollStyles.sub, { color: colors.textMuted }]}>
        Be the first to ask the community something!
      </Text>
      <View style={[noPollStyles.btn, { backgroundColor: "#3B82F6" }]}>
        <Text style={noPollStyles.btnText}>Create a Poll</Text>
      </View>
    </TouchableOpacity>
  );
}

const noPollStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 16 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", lineHeight: 18 },
  btn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  btnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pollTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  pollTagText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#3B82F6" },
  timer: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  question: { fontFamily: "Inter_700Bold", fontSize: 16, lineHeight: 23 },
  options: { gap: 8 },
  option: {
    position: "relative",
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  progressBar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 10,
  },
  optRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  optText: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  pctRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  winBadge: { fontSize: 13 },
  pct: { fontFamily: "Inter_700Bold", fontSize: 13 },
  checkmark: { color: "#3B82F6", fontFamily: "Inter_700Bold", fontSize: 14 },
  voteCount: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "right" },
});
