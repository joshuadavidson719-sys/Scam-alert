import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { db } from "@/lib/firebase";
import {
  collection, query, where, orderBy, getDocs, doc,
  updateDoc, arrayUnion, arrayRemove, increment, addDoc,
  onSnapshot, serverTimestamp, limit,
} from "firebase/firestore";

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
};

type Comment = { id: string; userId: string; username: string; text: string; createdAt: number };

// ── Single Reel Item ────────────────────────────────────────────────────────
function ReelItem({
  reel, isActive, currentUserId, onLike, onOpenComments,
}: {
  reel: ReelDoc;
  isActive: boolean;
  currentUserId?: string;
  onLike: (id: string, liked: boolean) => void;
  onOpenComments: (reel: ReelDoc) => void;
}) {
  const videoRef = useRef<InstanceType<typeof Video>>(null);
  const [paused, setPaused]   = useState(false);
  const [viewed, setViewed]   = useState(false);
  const liked = currentUserId ? reel.likes.includes(currentUserId) : false;

  useEffect(() => {
    if (!isActive) {
      videoRef.current?.pauseAsync();
      setPaused(false);
    } else {
      videoRef.current?.playAsync();
    }
  }, [isActive]);

  const handlePlayback = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.isPlaying && !viewed) {
      setViewed(true);
      updateDoc(doc(db, "reels", reel.id), { views: increment(1) }).catch(() => {});
    }
  };

  const togglePause = () => {
    if (paused) { videoRef.current?.playAsync(); setPaused(false); }
    else        { videoRef.current?.pauseAsync(); setPaused(true); }
  };

  return (
    <View style={S.reel}>
      {/* Video */}
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={togglePause}>
        <Video
          ref={videoRef}
          source={{ uri: reel.videoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive && !paused}
          isLooping
          onPlaybackStatusUpdate={handlePlayback}
        />
        {/* Dark overlay */}
        <LinearGradient
          colors={["transparent", "transparent", "rgba(0,0,0,0.8)"]}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.4, 1]}
        />
        {/* Top gradient */}
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "transparent"]}
          style={[StyleSheet.absoluteFill, { bottom: "80%" as any }]}
        />
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
        <View style={S.statsRow}>
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
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
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

// ── Main Screen ────────────────────────────────────────────────────────────
export default function ReelsViewer() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ userId?: string; startIndex?: string }>();

  const [reels, setReels]           = useState<ReelDoc[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeIndex, setActiveIndex] = useState(parseInt(params.startIndex ?? "0") || 0);
  const [commentReel, setCommentReel] = useState<ReelDoc | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        let q;
        if (params.userId) {
          q = query(
            collection(db, "reels"),
            where("userId", "==", params.userId),
            orderBy("createdAt", "desc"),
          );
        } else {
          q = query(collection(db, "reels"), orderBy("createdAt", "desc"), limit(50));
        }
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
        } as ReelDoc));
        setReels(data);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [params.userId]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 75 }).current;

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
      <View style={[S.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#FF3B3B" />
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
      {/* Back button */}
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
        showsVerticalScrollIndicator={false}
        initialScrollIndex={activeIndex}
        getItemLayout={(_, index) => ({ length: SH, offset: SH * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            currentUserId={user?.uid}
            onLike={handleLike}
            onOpenComments={setCommentReel}
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
