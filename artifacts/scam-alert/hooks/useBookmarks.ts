import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@scam_alert_bookmarks";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((val) => {
      if (val) setBookmarks(JSON.parse(val));
    });
  }, []);

  const save = async (ids: string[]) => {
    setBookmarks(ids);
    await AsyncStorage.setItem(KEY, JSON.stringify(ids));
  };

  const toggle = async (postId: string) => {
    const next = bookmarks.includes(postId)
      ? bookmarks.filter((id) => id !== postId)
      : [postId, ...bookmarks];
    await save(next);
    return !bookmarks.includes(postId);
  };

  const isBookmarked = (postId: string) => bookmarks.includes(postId);

  return { bookmarks, toggle, isBookmarked };
}
