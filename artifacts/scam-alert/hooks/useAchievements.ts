import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: "first_post",   emoji: "🌱", title: "First Steps",      desc: "Posted your first scam alert",      rarity: "common"    },
  { id: "scam_buster",  emoji: "🛡️", title: "Scam Buster",      desc: "Filed your first report",           rarity: "common"    },
  { id: "quiz_done",    emoji: "🧩", title: "Quiz Taker",       desc: "Completed the Scam Quiz",           rarity: "common"    },
  { id: "quiz_perfect", emoji: "🧠", title: "Quiz Master",      desc: "Scored 10/10 on the Scam Quiz",     rarity: "epic"      },
  { id: "streak_3",     emoji: "⚡", title: "Warming Up",       desc: "Logged in 3 days in a row",         rarity: "common"    },
  { id: "streak_7",     emoji: "🔥", title: "On Fire",          desc: "Logged in 7 days in a row",         rarity: "rare"      },
  { id: "streak_30",    emoji: "💎", title: "Diamond Streak",   desc: "Logged in 30 days in a row",        rarity: "legendary" },
  { id: "social_10",    emoji: "👥", title: "Social Butterfly", desc: "Gained 10 followers",               rarity: "rare"      },
  { id: "viral_post",   emoji: "📊", title: "Going Viral",      desc: "A post of yours got 10 likes",      rarity: "rare"      },
  { id: "legend",       emoji: "🏆", title: "Legend",           desc: "Reached 1,000 points",              rarity: "legendary" },
  { id: "helper",       emoji: "🌟", title: "Community Star",   desc: "Made 10 helpful comments",         rarity: "rare"      },
  { id: "dark_web",     emoji: "🕵️", title: "Dark Web Scout",   desc: "Used the Dark Web Checker",        rarity: "epic"      },
];

export const RARITY_COLORS: Record<Achievement["rarity"], string> = {
  common:    "#6B7280",
  rare:      "#3B82F6",
  epic:      "#8B5CF6",
  legendary: "#F59E0B",
};

export function getRarityColor(rarity: Achievement["rarity"]) {
  return RARITY_COLORS[rarity];
}

export function useAchievements(uid?: string) {
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) {
        setUnlockedIds((snap.data().achievements as string[]) ?? []);
      }
      setLoading(false);
    });
  }, [uid]);

  const unlock = useCallback(
    async (id: string) => {
      if (!uid || unlockedIds.includes(id)) return;
      const achievement = ALL_ACHIEVEMENTS.find((a) => a.id === id);
      if (!achievement) return;
      try {
        await updateDoc(doc(db, "users", uid), { achievements: arrayUnion(id) });
        setUnlockedIds((prev) => [...prev, id]);
        setNewlyUnlocked(achievement);
      } catch {}
    },
    [uid, unlockedIds]
  );

  const clearNewlyUnlocked = useCallback(() => setNewlyUnlocked(null), []);
  const unlocked = ALL_ACHIEVEMENTS.filter((a) => unlockedIds.includes(a.id));

  return { unlocked, unlockedIds, newlyUnlocked, clearNewlyUnlocked, unlock, loading };
}
