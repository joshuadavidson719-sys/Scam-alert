import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { UserProfile } from "@/context/AuthContext";

export type SuggestedUser = Pick<
  UserProfile,
  "uid" | "username" | "profilePhoto" | "niche" | "bio" | "followers"
> & { displayName: string };

export function useFollowSuggestions(max = 8): {
  suggestions: SuggestedUser[];
  loading: boolean;
  refresh: () => void;
} {
  const { user, profile } = useAuth();
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;
    setLoading(true);

    const alreadyFollowing = new Set<string>([user.uid, ...(profile.following ?? [])]);
    const niche = profile.niche;

    const fetchSuggestions = async () => {
      try {
        const results: SuggestedUser[] = [];

        // 1. Same-niche users first (up to 40 candidates)
        if (niche) {
          const nicheSnap = await getDocs(
            query(
              collection(db, "users"),
              where("niche", "==", niche),
              limit(40)
            )
          );
          nicheSnap.docs.forEach((d) => {
            if (!alreadyFollowing.has(d.id)) {
              const data = d.data() as UserProfile;
              results.push({
                uid: d.id,
                username: data.username ?? "",
                profilePhoto: data.profilePhoto ?? null,
                niche: data.niche ?? "",
                bio: data.bio ?? "",
                followers: data.followers ?? [],
                displayName: data.username ?? "User",
              });
            }
          });
        }

        // 2. Fill remaining slots with any users not yet following
        if (results.length < max) {
          const fallbackSnap = await getDocs(
            query(collection(db, "users"), limit(60))
          );
          fallbackSnap.docs.forEach((d) => {
            if (
              !alreadyFollowing.has(d.id) &&
              !results.find((r) => r.uid === d.id)
            ) {
              const data = d.data() as UserProfile;
              results.push({
                uid: d.id,
                username: data.username ?? "",
                profilePhoto: data.profilePhoto ?? null,
                niche: data.niche ?? "",
                bio: data.bio ?? "",
                followers: data.followers ?? [],
                displayName: data.username ?? "User",
              });
            }
          });
        }

        // Sort: same niche first, then by follower count desc
        results.sort((a, b) => {
          const sameA = a.niche === niche ? 1 : 0;
          const sameB = b.niche === niche ? 1 : 0;
          if (sameB !== sameA) return sameB - sameA;
          return (b.followers?.length ?? 0) - (a.followers?.length ?? 0);
        });

        if (!cancelled) setSuggestions(results.slice(0, max));
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [user, profile, tick, max]);

  return { suggestions, loading, refresh };
}
