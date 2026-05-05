import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, orderBy, limit, getDocs,
} from "firebase/firestore";

const APP_ICON = require("@/assets/images/icon.png");

const { width: SW } = Dimensions.get("window");

type GameMeta = {
  id: string;
  route: string;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  scoreCollection: string;
  tags: string[];
};

const GAMES: GameMeta[] = [
  {
    id: "surfer",
    route: "/scam-game",
    emoji: "🏃‍♂️",
    title: "Scam Surfer",
    subtitle: "Endless Runner",
    description: "Dodge phishing emails, fake calls and crypto scams in 3 lanes. Grab shields and rack up your highest score!",
    color: "#FF3B3B",
    scoreCollection: "gameScores",
    tags: ["Action", "Endless", "Runner"],
  },
  {
    id: "tap",
    route: "/scam-tap",
    emoji: "🎯",
    title: "Scam Tap",
    subtitle: "Whack-a-Mole",
    description: "Scam icons pop up on the grid — tap them before they escape! Don't tap the legitimate ones or lose a life.",
    color: "#F97316",
    scoreCollection: "tapScores",
    tags: ["Reflexes", "Speed", "45 sec"],
  },
  {
    id: "swipe",
    route: "/scam-swipe",
    emoji: "🃏",
    title: "Scam Swipe",
    subtitle: "Card Identification",
    description: "Read real-world scam scenarios and swipe to decide: is it a scam or is it legit? 25 cards, streak multipliers.",
    color: "#3B82F6",
    scoreCollection: "swipeScores",
    tags: ["Knowledge", "Education", "25 cards"],
  },
  {
    id: "racer",
    route: "/scam-racer",
    emoji: "🏎️",
    title: "Scam Racer",
    subtitle: "High-Speed Racing",
    description: "Race through 4 lanes and dodge scam vehicles at high speed. Grab shield power-ups, fire your nitro boost and outrun the fraud fleet!",
    color: "#FF3B3B",
    scoreCollection: "racerScores",
    tags: ["Racing", "Action", "Nitro Boost"],
  },
  {
    id: "blockblast",
    route: "/scam-block-blast",
    emoji: "🧱",
    title: "Scam Block Blast",
    subtitle: "Block Puzzle",
    description: "Place scam-labeled blocks onto an 8×8 grid. Fill complete rows or columns to blast them away and score big!",
    color: "#DC2626",
    scoreCollection: "blockScores",
    tags: ["Puzzle", "Strategy", "Block Drop"],
  },
  {
    id: "fraudflip",
    route: "/fraud-flip",
    emoji: "🎴",
    title: "Fraud Flip",
    subtitle: "Memory Match",
    description: "Flip cards to find matching scam type pairs. Learn a new fraud fact with every match — 8 pairs to uncover!",
    color: "#7C3AED",
    scoreCollection: "flipScores",
    tags: ["Memory", "Education", "8 Pairs"],
  },
  {
    id: "wordhunt",
    route: "/scam-word-hunt",
    emoji: "🔍",
    title: "Scam Word Hunt",
    subtitle: "Word Search",
    description: "Find 8 scam-related words hidden in a 10×10 letter grid before time runs out. Words go in every direction!",
    color: "#0369A1",
    scoreCollection: "wordScores",
    tags: ["Word Game", "120 sec", "8 Words"],
  },
  {
    id: "hilldash",
    route: "/scam-hill-dash",
    emoji: "🚗",
    title: "Scam Hill Dash",
    subtitle: "Hill Climb Racing",
    description: "Drive over scam-infested hills! Hold GAS to climb, collect fuel cans and shields, dodge fraud bombs to survive!",
    color: "#10B981",
    scoreCollection: "hillScores",
    tags: ["Racing", "Physics", "Survival"],
  },
  {
    id: "motoblitz",
    route: "/moto-blitz",
    emoji: "🏍️",
    title: "Moto Blitz",
    subtitle: "Bike Dodge Racing",
    description: "Weave through heavy traffic on your motorcycle! Dodge cars, trucks and buses, collect coins and survive as long as you can at full throttle!",
    color: "#F97316",
    scoreCollection: "motoScores",
    tags: ["Bike", "Dodge", "Endless"],
  },
  {
    id: "galaxystrike",
    route: "/galaxy-strike",
    emoji: "🚀",
    title: "Galaxy Strike",
    subtitle: "Space Shooter",
    description: "Alien invaders are descending on Earth — blast them out of the sky! Survive wave after wave of enemy formations and protect the planet!",
    color: "#7C3AED",
    scoreCollection: "galaxyScores",
    tags: ["Shooter", "Arcade", "Waves"],
  },
  {
    id: "royal21",
    route: "/royal-21",
    emoji: "🃏",
    title: "Royal 21",
    subtitle: "Casino Blackjack",
    description: "Hit or Stand? Play Vegas-style Blackjack with 1000 starting chips. Place bets, go for Blackjack, Double Down, and climb the High Rollers leaderboard!",
    color: "#10B981",
    scoreCollection: "royal21Scores",
    tags: ["Cards", "Casino", "Strategy"],
  },
  {
    id: "shadowquest",
    route: "/shadow-quest",
    emoji: "🧙",
    title: "Shadow Quest",
    subtitle: "Dungeon RPG Adventure",
    description: "Explore dark dungeons, fight monsters, collect loot and level up your hero! Face powerful bosses, use potions and weapons across multiple floors!",
    color: "#A855F7",
    scoreCollection: "questScores",
    tags: ["RPG", "Adventure", "Dungeon"],
  },
];

export default function GamesHub() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [bests, setBests] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    GAMES.forEach(async (g) => {
      try {
        const snap = await getDocs(
          query(collection(db, g.scoreCollection),
            where("userId", "==", user.uid),
            orderBy("score", "desc"),
            limit(1))
        );
        if (!snap.empty) {
          setBests(prev => ({ ...prev, [g.id]: snap.docs[0].data().score as number }));
        }
      } catch {}
    });
  }, [user]);

  return (
    <View style={[S.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={S.nav}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Image source={APP_ICON} style={{ width: 22, height: 22, borderRadius: 6 }} />
        </TouchableOpacity>
        <Text style={[S.navTitle, { color: colors.text }]}>Scam Games 🎮</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

        {/* Banner */}
        <View style={[S.banner, { backgroundColor: "#FF3B3B0D", borderColor: "#FF3B3B25" }]}>
          <Text style={S.bannerEmoji}>🎮</Text>
          <View style={{ flex: 1 }}>
            <Text style={[S.bannerTitle, { color: colors.text }]}>Play & Learn</Text>
            <Text style={[S.bannerSub, { color: colors.textMuted }]}>
              Eight unique games, one goal — sharpen your scam radar and compete with friends.
            </Text>
          </View>
        </View>

        {/* Game cards */}
        {GAMES.map((game) => (
          <TouchableOpacity
            key={game.id}
            style={[S.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(game.route as never)}
            activeOpacity={0.82}
          >
            {/* Top section */}
            <View style={[S.cardTop, { backgroundColor: game.color + "12" }]}>
              <Text style={S.cardEmoji}>{game.emoji}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[S.cardTitle, { color: colors.text }]}>{game.title}</Text>
                <View style={[S.subtitleBadge, { backgroundColor: game.color + "20", borderColor: game.color + "40" }]}>
                  <Text style={[S.subtitleText, { color: game.color }]}>{game.subtitle}</Text>
                </View>
              </View>
              <View style={[S.playIcon, { backgroundColor: game.color }]}>
                <Text style={{ fontSize: 16, color: "#fff" }}>▶</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={[S.cardDesc, { color: colors.textMuted }]}>{game.description}</Text>

            {/* Tags */}
            <View style={S.tagsRow}>
              {game.tags.map(tag => (
                <View key={tag} style={[S.tag, { backgroundColor: colors.muted }]}>
                  <Text style={[S.tagText, { color: colors.textMuted }]}>{tag}</Text>
                </View>
              ))}
            </View>

            {/* Personal best */}
            {bests[game.id] != null ? (
              <View style={[S.bestRow, { borderTopColor: colors.border }]}>
                <Text style={S.bestEmoji}>🏆</Text>
                <Text style={[S.bestLabel, { color: colors.textMuted }]}>Your best</Text>
                <Text style={[S.bestScore, { color: game.color }]}>{bests[game.id].toLocaleString()}</Text>
              </View>
            ) : (
              <View style={[S.bestRow, { borderTopColor: colors.border }]}>
                <Text style={S.bestEmoji}>🎯</Text>
                <Text style={[S.bestLabel, { color: colors.textMuted }]}>No score yet</Text>
                <Text style={[S.bestPlay, { color: game.color }]}>Play now →</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Community callout */}
        <View style={[S.communityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 28 }}>👥</Text>
          <View style={{ flex: 1 }}>
            <Text style={[S.communityTitle, { color: colors.text }]}>Compete with Friends</Text>
            <Text style={[S.communitySub, { color: colors.textMuted }]}>
              Every score is saved to the leaderboard. Follow people on Scam Alert to see how you rank against each other!
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  screen:       { flex: 1 },
  nav:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  navTitle:     { fontFamily: "Inter_700Bold", fontSize: 18 },

  content:      { paddingHorizontal: 16, gap: 16 },

  banner:       { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 18, borderWidth: 1 },
  bannerEmoji:  { fontSize: 36 },
  bannerTitle:  { fontFamily: "Inter_700Bold", fontSize: 16 },
  bannerSub:    { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 2 },

  card:         { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  cardTop:      { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  cardEmoji:    { fontSize: 40 },
  cardTitle:    { fontFamily: "Inter_700Bold", fontSize: 17 },
  subtitleBadge:{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  subtitleText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  playIcon:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  cardDesc:     { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, paddingHorizontal: 16, paddingBottom: 12 },

  tagsRow:      { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
  tag:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagText:      { fontFamily: "Inter_600SemiBold", fontSize: 10 },

  bestRow:      { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  bestEmoji:    { fontSize: 16 },
  bestLabel:    { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 },
  bestScore:    { fontFamily: "Inter_700Bold", fontSize: 16 },
  bestPlay:     { fontFamily: "Inter_600SemiBold", fontSize: 13 },

  communityCard:{ flexDirection: "row", gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, alignItems: "flex-start" },
  communityTitle:{ fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 },
  communitySub: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
});
