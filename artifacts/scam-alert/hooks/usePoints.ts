import { doc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const POINTS = {
  POST_CREATED: 10,
  LIKE_RECEIVED: 2,
  COMMENT_MADE: 1,
  SHARE_RECEIVED: 3,
  REPORT_FILED: 1,
} as const;

export const BADGES = [
  { id: "newcomer", label: "Newcomer", icon: "🌱", minPoints: 0 },
  { id: "aware", label: "Aware", icon: "👀", minPoints: 20 },
  { id: "reporter", label: "Reporter", icon: "📢", minPoints: 50 },
  { id: "guardian", label: "Guardian", icon: "🛡️", minPoints: 100 },
  { id: "sentinel", label: "Sentinel", icon: "🔦", minPoints: 250 },
  { id: "protector", label: "Protector", icon: "⚔️", minPoints: 500 },
  { id: "legend", label: "Legend", icon: "🏆", minPoints: 1000 },
] as const;

export type BadgeId = (typeof BADGES)[number]["id"];

export function getBadgeForPoints(points: number) {
  const earned = BADGES.filter((b) => points >= b.minPoints);
  return earned[earned.length - 1] ?? BADGES[0];
}

export function getNextBadge(points: number) {
  return BADGES.find((b) => points < b.minPoints) ?? null;
}

export async function awardPoints(uid: string, amount: number) {
  try {
    await updateDoc(doc(db, "users", uid), {
      points: increment(amount),
    });
  } catch {
    // Silently fail — points are non-critical
  }
}

export async function getUserPoints(uid: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      return (snap.data().points as number) ?? 0;
    }
  } catch {
    // ignore
  }
  return 0;
}
