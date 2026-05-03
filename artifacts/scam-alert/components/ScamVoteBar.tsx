import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const VERIFIED_THRESHOLD = 10;   // min total votes to show badge
const VERIFIED_PCT = 0.70;        // min % "real" to show verified badge

interface Props {
  postId: string;
  scamVotes?: string[];
  notScamVotes?: string[];
  compact?: boolean;             // compact mode for PostCard vs full for detail
}

export function ScamVoteBar({ postId, scamVotes = [], notScamVotes = [], compact = true }: Props) {
  const colors = useColors();
  const { user } = useAuth();

  const [realVotes, setRealVotes] = useState(scamVotes);
  const [fakeVotes, setFakeVotes] = useState(notScamVotes);

  const myRealVote = !!user && realVotes.includes(user.uid);
  const myFakeVote = !!user && fakeVotes.includes(user.uid);

  const total = realVotes.length + fakeVotes.length;
  const realPct = total === 0 ? 0 : realVotes.length / total;
  const fakePct = total === 0 ? 0 : fakeVotes.length / total;

  const isVerified = total >= VERIFIED_THRESHOLD && realPct >= VERIFIED_PCT;
  const isDebunked = total >= VERIFIED_THRESHOLD && fakePct >= VERIFIED_PCT;

  const handleVote = async (vote: "real" | "fake") => {
    if (!user) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const postRef = doc(db, "posts", postId);

    if (vote === "real") {
      if (myRealVote) {
        // toggle off
        setRealVotes((v) => v.filter((id) => id !== user.uid));
        await updateDoc(postRef, { scamVotes: arrayRemove(user.uid) });
      } else {
        // add real, remove fake if any
        setRealVotes((v) => [...v, user.uid]);
        setFakeVotes((v) => v.filter((id) => id !== user.uid));
        await updateDoc(postRef, {
          scamVotes: arrayUnion(user.uid),
          notScamVotes: arrayRemove(user.uid),
        });
      }
    } else {
      if (myFakeVote) {
        setFakeVotes((v) => v.filter((id) => id !== user.uid));
        await updateDoc(postRef, { notScamVotes: arrayRemove(user.uid) });
      } else {
        setFakeVotes((v) => [...v, user.uid]);
        setRealVotes((v) => v.filter((id) => id !== user.uid));
        await updateDoc(postRef, {
          notScamVotes: arrayUnion(user.uid),
          scamVotes: arrayRemove(user.uid),
        });
      }
    }
  };

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {/* Verified / Debunked badge */}
      {isVerified && (
        <View style={styles.badge}>
          <View style={[styles.badgeInner, { backgroundColor: "#FF3B3B" }]}>
            <Feather name="shield" size={11} color="#fff" />
            <Text style={styles.badgeText}>COMMUNITY VERIFIED SCAM</Text>
          </View>
        </View>
      )}
      {isDebunked && (
        <View style={styles.badge}>
          <View style={[styles.badgeInner, { backgroundColor: "#10B981" }]}>
            <Feather name="check-circle" size={11} color="#fff" />
            <Text style={styles.badgeText}>COMMUNITY DEBUNKED</Text>
          </View>
        </View>
      )}

      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          Is this a real scam?
        </Text>
        {total > 0 && (
          <Text style={[styles.totalVotes, { color: colors.textMuted }]}>
            {total} {total === 1 ? "vote" : "votes"}
          </Text>
        )}
      </View>

      {/* Vote bar */}
      {total > 0 && (
        <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.barReal, { flex: realPct, backgroundColor: "#FF3B3B" }]} />
          <View style={[styles.barFake, { flex: fakePct, backgroundColor: "#10B981" }]} />
        </View>
      )}

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[
            styles.voteBtn,
            {
              backgroundColor: myRealVote ? "#FF3B3B18" : colors.muted,
              borderColor: myRealVote ? "#FF3B3B" : "transparent",
              flex: 1,
            },
          ]}
          onPress={() => handleVote("real")}
          activeOpacity={0.8}
        >
          <Text style={styles.btnEmoji}>🚨</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.btnLabel, { color: myRealVote ? "#FF3B3B" : colors.text }]}>
              Real Scam
            </Text>
            {total > 0 && (
              <Text style={[styles.btnPct, { color: myRealVote ? "#FF3B3B" : colors.textMuted }]}>
                {Math.round(realPct * 100)}%
              </Text>
            )}
          </View>
          {myRealVote && <Feather name="check-circle" size={15} color="#FF3B3B" />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.voteBtn,
            {
              backgroundColor: myFakeVote ? "#10B98118" : colors.muted,
              borderColor: myFakeVote ? "#10B981" : "transparent",
              flex: 1,
            },
          ]}
          onPress={() => handleVote("fake")}
          activeOpacity={0.8}
        >
          <Text style={styles.btnEmoji}>✅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.btnLabel, { color: myFakeVote ? "#10B981" : colors.text }]}>
              Not a Scam
            </Text>
            {total > 0 && (
              <Text style={[styles.btnPct, { color: myFakeVote ? "#10B981" : colors.textMuted }]}>
                {Math.round(fakePct * 100)}%
              </Text>
            )}
          </View>
          {myFakeVote && <Feather name="check-circle" size={15} color="#10B981" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  badge: { alignItems: "flex-start" },
  badgeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#fff",
    letterSpacing: 0.6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  totalVotes: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    flexDirection: "row",
    overflow: "hidden",
  },
  barReal: { borderRadius: 3 },
  barFake: { borderRadius: 3 },
  buttons: {
    flexDirection: "row",
    gap: 8,
  },
  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnEmoji: { fontSize: 18 },
  btnLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  btnPct: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 1,
  },
});
