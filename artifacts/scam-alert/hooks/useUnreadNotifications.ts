import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export function useUnreadNotifications(): number {
  const { user, loading } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (loading || !user) {
      setCount(0);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", user.uid),
      where("read", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      setCount(snap.size);
    }, () => setCount(0));

    return unsub;
  }, [user]);

  return count;
}
