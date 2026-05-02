import { useState, useEffect } from "react";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface StreakData {
  streak: number;
  longestStreak: number;
  lastLoginDate: string;
  isNewDay: boolean;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export function useStreak(): StreakData {
  const { user } = useAuth();
  const [data, setData] = useState<StreakData>({
    streak: 0,
    longestStreak: 0,
    lastLoginDate: "",
    isNewDay: false,
  });

  useEffect(() => {
    if (!user) return;
    const run = async () => {
      const today = todayStr();
      const yesterday = yesterdayStr();
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const d = snap.data();
      const lastLogin: string = d.lastLoginDate ?? "";
      const currentStreak: number = d.streak ?? 0;
      const longestStreak: number = d.longestStreak ?? 0;

      if (lastLogin === today) {
        setData({ streak: currentStreak, longestStreak, lastLoginDate: lastLogin, isNewDay: false });
        return;
      }

      let newStreak =
        lastLogin === yesterday ? currentStreak + 1 : 1;
      const newLongest = Math.max(newStreak, longestStreak);

      const achievementsToUnlock: string[] = [];
      if (newStreak >= 3)  achievementsToUnlock.push("streak_3");
      if (newStreak >= 7)  achievementsToUnlock.push("streak_7");
      if (newStreak >= 30) achievementsToUnlock.push("streak_30");

      await updateDoc(ref, {
        streak: newStreak,
        longestStreak: newLongest,
        lastLoginDate: today,
        ...(achievementsToUnlock.length > 0
          ? { achievements: arrayUnion(...achievementsToUnlock) }
          : {}),
      });
      setData({ streak: newStreak, longestStreak: newLongest, lastLoginDate: today, isNewDay: true });
    };
    run();
  }, [user]);

  return data;
}
