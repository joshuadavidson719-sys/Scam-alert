import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { db, storage } from "@/lib/firebase";
import {
  collection, query, where, orderBy, getDocs, doc,
  updateDoc, arrayUnion, arrayRemove, increment, addDoc,
  onSnapshot, serverTimestamp, limit, deleteDoc,
} from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";

const { width: SW, height: SH } = Dimensions.get("window");

export type ReelDoc = {
  id: string;
  userId: string;
  username: string;
  profilePhoto?: string;
  videoUrl: string;
  caption: string;
  likes: string[];
  views: number;
  createdAt: number;
  musicUrl?: string | null;
  musicName?: string | null;
  musicEmoji?: string | null;
};

type Comment = { id: string; userId: string; username: string; text: string; createdAt: number };

// ── Spinning music note ──────────────────────────────────────────────────────
function MusicTicker({ name, emoji }: { name: string; emoji: string }) {
  return (
    <View style={ST.ticker}>
      <Text style={{ fontSize: 14 }}>{emoji}</Text>
      <Text style={ST.tickerTxt} numberOfLines={1}>{name}</Text>
    </View>
  );
}
const ST = StyleSheet.create({
  ticker: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start", maxWidth: 220 },
  tickerTxt: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff", flex: 1 },
});

// ── Single Reel Item ────────────────────────────────────────────────────────
function ReelItem({
  reel, isActive, isNear, currentUserId, onLike, onOpenComments, onDelete,
}: {
  reel: ReelDoc;
  isActive: boolean;
  isNear: boolean;
  currentUserId?: string;
  onLike: (id: string, liked: boolean) => void;
  onOpenComments: (reel: ReelDoc) => void;
  onDelete: (id: string) => void;
}) {
  const soundRef    = useRef<Audio.Sound | null>(null);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [viewed, setViewed] = useState(false);
  const isOwner  = !!currentUserId && currentUserId === reel.userId;
  const liked    = currentUserId ? reel.likes.includes(currentUserId) : false;
  const hasMusic = !!reel.musicUrl;

  // ── expo-video (native only) ─────────────────────────────────────────────
  const player = useVideoPlayer(
    (Platform.OS !== "web" && isNear) ? { uri: reel.videoUrl } : null,
    (p) => { p.loop = true; p.muted = hasMusic; },
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (isActive && !paused) {
      try { player.play(); } catch {}
    } else {
      try { player.pause(); } catch {}
    }
  }, [isActive, paused]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = player.addListener("playingChange", ({ isPlaying }: { isPlaying: boolean }) => {
      if (isPlaying && !viewed) {
        setViewed(true);
        updateDoc(doc(db, "reels", reel.id), { views: increment(1) }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [reel.id, viewed]);

  // ── Web video ref callbacks ──────────────────────────────────────────────
  // When the active reel changes on web, play/pause the <video> element
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = webVideoRef.current;
    if (!el) return;
    if (isActive && !paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isActive, paused]);

  // ── Background music (native only via expo-av Audio) ────────────────────
  useEffect(() => {
    if (Platform.OS === "web" || !hasMusic || !reel.musicUrl) return;
    let cancelled = false;
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false }).catch(() => {});
    Audio.Sound.createAsync(
      { uri: reel.musicUrl },
      { shouldPlay: isActive, isLooping: true, volume: 0.85 },
    ).then(({ sound }) => {
      if (cancelled) { sound.unloadAsync(); return; }
      soundRef.current = sound;
    }).catch(() => {});
    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, [reel.id]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!isActive || paused) soundRef.current?.pauseAsync().catch(() => {});
    else soundRef.current?.playAsync().catch(() => {});
  }, [isActive, paused]);

  // ── Tap to pause / resume ────────────────────────────────────────────────
  const handleTap = () => {
    const next = !paused;
    setPaused(next);
    if (Platform.OS === "web") {
      const el = webVideoRef.current;
      if (el) { next ? el.pause() : el.play().catch(() => {}); }
    } else {
      try { next ? player.pause() : player.play(); } catch {}
      if (next) soundRef.current?.pauseAsync().catch(() => {});
      else soundRef.current?.playAsync().catch(() => {});
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Reel",
      "This reel and its video will be permanently removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDelete(reel.id);
            deleteDoc(doc(db, "reels", reel.id)).catch(() => {});
            try {
              const url = new URL(reel.videoUrl);
              const pathEncoded = url.pathname.split("/o/")[1]?.split("?")[0];
              if (pathEncoded) {
                deleteObject(storageRef(storage, decodeURIComponent(pathEncoded))).catch(() => {});
              }
            } catch { /* non-fatal */ }
          },
        },
      ],
    );
  };

  return (
    <View style={S.reel}>
      {/* ── Full-screen tap to pause/resume ── */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleTap}>

        {/* ── Video ── only mount when near to save memory & bandwidth ── */}
        {Platform.OS === "web" ? (
          isNear ? React.createElement("video", {
            key: reel.videoUrl,
            src: reel.videoUrl,
            muted: true,
            loop: true,
            playsInline: true,
            preload: isActive ? "auto" : "metadata",
            ref: (el: HTMLVideoElement | null) => {
              webVideoRef.current = el;
              if (el && isActive && !paused) el.play().catch(() => {});
            },
            style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
          }) : null
        ) : (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            allowsPictureInPicture={false}
          />
        )}

        {/* Gradient overlays */}
        <LinearGradient
          colors={["transparent", "transparent", "rgba(0,0,0,0.82)"]}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.4, 1]}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.45)", "transparent"]}
          style={[StyleSheet.absoluteFill, { bottom: "80%" as any }]}
        />

        {/* Pause indicator */}
        {paused && (
          <View style={S.pauseIcon}>
            <Feather name="pause" size={40} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </TouchableOpacity>

      {/* Bottom info */}
      <View style={S.bottomOverlay}>
        <TouchableOpacity
          style={S.userRow}
          onPress={() => router.push(`/user/${reel.userId}` as never)}
        >
          <UserAvatar uri={reel.profilePhoto} name={reel.username} size={36} />
          <View style={{ marginLeft: 10 }}>
            <Text style={S.reelUsername}>@{reel.username}</Text>
          </View>
        </TouchableOpacity>
        <Text style={S.caption} numberOfLines={3}>{reel.caption}</Text>

        {hasMusic && reel.musicName && (
          <MusicTicker name={reel.musicName} emoji={reel.musicEmoji ?? "🎵"} />
        )}

        <View style={[S.statsRow, { marginTop: 8 }]}>
          <Feather name="eye" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={S.statTxt}>{reel.views.toLocaleString()} views</Text>
          <Text style={[S.statTxt, { marginLeft: 10 }]}>❤️ {reel.likes.length.toLocaleString()}</Text>
        </View>
      </View>

      {/* Right actions */}
      <View style={S.rightActions}>
        <TouchableOpacity style={S.actionBtn} onPress={() => onLike(reel.id, liked)}>
          <Feather name="heart" size={26} color={liked ? "#FF3B3B" : "#fff"} />
          <Text style={S.actionCount}>{reel.likes.length}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.actionBtn} onPress={() => onOpenComments(reel)}>
          <Feather name="message-circle" size={26} color="#fff" />
          <Text style={S.actionCount}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.actionBtn}>
          <Feather name="share-2" size={24} color="#fff" />
          <Text style={S.actionCount}>Share</Text>
        </TouchableOpacity>
        {hasMusic && (
          <TouchableOpacity style={S.actionBtn} onPress={handleTap}>
            <Feather name={paused ? "volume-x" : "music"} size={22} color="#EC4899" />
            <Text style={[S.actionCount, { color: "#EC4899" }]}>Music</Text>
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity style={S.actionBtn} onPress={handleDelete}>
            <Feather name="trash-2" size={22} color="#FF3B3B" />
            <Text style={[S.actionCount, { color: "#FF3B3B" }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Comments Sheet ──────────────────────────────────────────────────────────
function CommentsModal({
  reel, visible, onClose, currentUserId, username,
}: {
  reel: ReelDoc | null;
  visible: boolean;
  onClose: () => void;
  currentUserId?: string;
  username?: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!reel || !visible) return;
    const q = query(
      collection(db, "reelComments"),
      where("reelId", "==", reel.id),
      limit(50),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Comment))
        .sort((a, b) => b.createdAt - a.createdAt);
      setComments(data);
    });
    return unsub;
  }, [reel?.id, visible]);

  const postComment = async () => {
    if (!text.trim() || !currentUserId || !reel || !username) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "reelComments"), {
        reelId: reel.id, userId: currentUserId, username,
        text: text.trim(), createdAt: Date.now(),
      });
      setText("");
    } catch {}
    setPosting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[S.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
          <View style={[S.sheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[S.sheetTitle, { color: colors.text }]}>Comments</Text>
          <FlatList
            data={comments}
            keyExtractor={c => c.id}
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}
            renderItem={({ item }) => (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 12 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.text }}>{item.username}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>{item.text}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ textAlign: "center", color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, padding: 20 }}>
                No comments yet. Be the first!
              </Text>
            }
          />
          <View style={[S.commentInput, { borderTopColor: colors.border }]}>
            <TextInput
              style={[S.commentBox, { color: colors.text, backgroundColor: colors.muted, borderColor: colors.border }]}
              placeholder="Add a comment…"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={postComment}
            />
            <TouchableOpacity
              style={[S.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
              onPress={postComment}
              disabled={posting || !text.trim()}
            >
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="send" size={16} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function ReelsViewer() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ userId?: string; startIndex?: string }>();

  const [reels, setReels]             = useState<ReelDoc[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeIndex, setActiveIndex] = useState(parseInt(params.startIndex ?? "0") || 0);
  const [commentReel, setCommentReel] = useState<ReelDoc | null>(null);

  const handleDeleteReel = useCallback((deletedId: string) => {
    setReels(prev => {
      const next = prev.filter(r => r.id !== deletedId);
      if (next.length === 0) { router.back(); return prev; }
      return next;
    });
    setActiveIndex(prev => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        let q;
        if (params.userId) {
          q = query(collection(db, "reels"), where("userId", "==", params.userId));
        } else {
          q = query(collection(db, "reels"), orderBy("createdAt", "desc"), limit(50));
        }
        const snap = await getDocs(q);
        const data = snap.docs
          .map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
          } as ReelDoc))
          .sort((a, b) => b.createdAt - a.createdAt);
        setReels(data);
      } catch (err) {
        console.error("[ReelsViewer] fetch error:", err);
      }
      setLoading(false);
    };
    fetch();
  }, [params.userId]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleLike = async (reelId: string, liked: boolean) => {
    if (!user) return;
    const reelRef = doc(db, "reels", reelId);
    try {
      if (liked) {
        await updateDoc(reelRef, { likes: arrayRemove(user.uid) });
      } else {
        await updateDoc(reelRef, { likes: arrayUnion(user.uid) });
      }
      setReels(prev => prev.map(r =>
        r.id === reelId
          ? { ...r, likes: liked ? r.likes.filter(u => u !== user.uid) : [...r.likes, user.uid] }
          : r,
      ));
    } catch {}
  };

  if (loading) {
    return (
      <View style={[S.screen, { justifyContent: "center", alignItems: "center", gap: 16 }]}>
        <LinearGradient colors={["#1a0000", "#2d0a0a", "#000"]} style={StyleSheet.absoluteFill} />
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#FF3B3B", alignItems: "center", justifyContent: "center" }}>
          <Feather name="film" size={32} color="#fff" />
        </View>
        <ActivityIndicator size="large" color="#FF3B3B" />
        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" }}>Loading Reels…</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ position: "absolute", top: insets.top + 8, left: 16 }}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={[S.screen, { justifyContent: "center", alignItems: "center", paddingTop: insets.top }]}>
        <TouchableOpacity style={S.backBtn} onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: 48 }}>🎬</Text>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff", marginTop: 12 }}>No Reels Yet</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 6, textAlign: "center", paddingHorizontal: 40 }}>
          {params.userId ? "This user hasn't posted any reels yet." : "Be the first to post a scam alert reel!"}
        </Text>
        <TouchableOpacity
          style={[S.uploadEmpty, { marginTop: 24 }]}
          onPress={() => router.push("/reels-upload" as never)}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" }}>Post a Reel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={S.screen}>
      <View style={[S.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={S.topTitle}>Reels</Text>
        <TouchableOpacity onPress={() => router.push("/reels-upload" as never)}>
          <Feather name="plus-circle" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={reels}
        keyExtractor={r => r.id}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={activeIndex}
        getItemLayout={(_, index) => ({ length: SH, offset: SH * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS !== "web"}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            isNear={Math.abs(index - activeIndex) <= 1}
            currentUserId={user?.uid}
            onLike={handleLike}
            onOpenComments={setCommentReel}
            onDelete={handleDeleteReel}
          />
        )}
      />

      <CommentsModal
        reel={commentReel}
        visible={!!commentReel}
        onClose={() => setCommentReel(null)}
        currentUserId={user?.uid}
        username={profile?.username}
      />
    </View>
  );
}

const S = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: "#000" },
  topBar:       { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
  topTitle:     { fontFamily: "Inter_700Bold", fontSize: 17, color: "#fff" },
  backBtn:      { position: "absolute", top: 60, left: 16, zIndex: 10 },
  uploadEmpty:  { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FF3B3B", paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14 },

  reel:         { width: SW, height: SH, backgroundColor: "#000" },
  pauseIcon:    { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },


  bottomOverlay:{ position: "absolute", bottom: 90, left: 16, right: 80 },
  userRow:      { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  reelUsername: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  caption:      { fontFamily: "Inter_400Regular", fontSize: 14, color: "#fff", lineHeight: 20, marginBottom: 8 },
  statsRow:     { flexDirection: "row", alignItems: "center" },
  statTxt:      { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)", marginLeft: 4 },

  rightActions: { position: "absolute", right: 12, bottom: 100, alignItems: "center", gap: 20 },
  actionBtn:    { alignItems: "center", gap: 4 },
  actionCount:  { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },

  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  sheetHandle:  { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetTitle:   { fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "center", marginBottom: 8 },

  commentInput: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, marginTop: 8 },
  commentBox:   { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  sendBtn:      { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
