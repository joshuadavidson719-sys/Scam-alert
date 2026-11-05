import { arrayRemove, arrayUnion, doc, writeBatch, type Firestore } from "firebase/firestore";

/** Commit both sides together; a failed request must not leave a half-follow. */
export async function saveWebFollow(
  db: Firestore,
  followerId: string,
  targetId: string,
  following: boolean,
): Promise<void> {
  if (!followerId || !targetId || followerId === targetId) {
    throw new Error("A follow requires two different signed-in profiles.");
  }
  const change = following ? arrayRemove : arrayUnion;
  const batch = writeBatch(db);
  batch.update(doc(db, "users", targetId), { followers: change(followerId) });
  batch.update(doc(db, "users", followerId), { following: change(targetId) });
  await batch.commit();
}
