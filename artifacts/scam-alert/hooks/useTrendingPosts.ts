import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PostData } from "@/components/PostCard";

export interface TrendingPost extends PostData {
  trendScore: number;
}

function computeScore(post: PostData): number {
  const ageMs = Date.now() - (post.createdAt ?? 0);
  const ageHours = ageMs / (1000 * 60 * 60);
  const likeScore = (post.likes?.length ?? 0) * 3;
  const commentScore = (post.commentCount ?? 0) * 2;
  const shareScore = (post.shareCount ?? 0) * 1.5;
  const decayPenalty = Math.sqrt(Math.max(ageHours, 0.1)) * 0.8;
  return likeScore + commentScore + shareScore - decayPenalty;
}

export function useTrendingPosts(topN = 8): {
  trending: TrendingPost[];
  loading: boolean;
  refresh: () => void;
} {
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(120))
    )
      .then((snap) => {
        if (cancelled) return;
        const scored: TrendingPost[] = snap.docs
          .map((d) => {
            const post = { ...(d.data() as Omit<PostData, "id">), id: d.id };
            return { ...post, trendScore: computeScore(post) };
          })
          .sort((a, b) => b.trendScore - a.trendScore)
          .slice(0, topN);
        setTrending(scored);
      })
      .catch(() => {
        if (!cancelled) setTrending([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick, topN]);

  return { trending, loading, refresh };
}
