import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export function useUnreadMessages(): number {
  const { user, loading } = useAuth();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (loading || !user) {
      setTotal(0);
      return;
    }
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let count = 0;
        snap.docs.forEach((d) => {
          const data = d.data();
          const unreadCounts: Record<string, number> = data.unreadCounts ?? {};
          count += unreadCounts[user.uid] ?? 0;
        });
        setTotal(count);
      },
      () => setTotal(0)
    );
    return unsub;
  }, [user]);

  return total;
}
