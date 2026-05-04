import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  doc,
  limit,
  Timestamp,
} from "firebase/firestore";
import { router } from "expo-router";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { formatTimeAgo } from "@/lib/utils";

const APP_ICON = require("@/assets/images/icon.png");

// ── Types ────────────────────────────────────────────────
type NType = "like" | "comment" | "share" | "follow" | "report" | "system";

interface AppNotification {
  id: string;
  recipientId: string;
  type: NType;
  actorId: string | null;
  actorName: string | null;
  actorAvatar: string | null;
  postId: string | null;
  postTitle: string | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

// ── Per-type config ──────────────────────────────────────
const TYPE_CONFIG: Record<NType, { emoji: string; color: string; label: string }> = {
  like:    { emoji: "❤️",  color: "#FF3B3B", label: "liked your post"        },
  comment: { emoji: "💬",  color: "#3B82F6", label: "commented on your post"  },
  share:   { emoji: "📤",  color: "#10B981", label: "shared your post"        },
  follow:  { emoji: "👤",  color: "#F59E0B", label: "followed you"            },
  report:  { emoji: "🚩",  color: "#8B5CF6", label: "flagged your post"       },
  system:  { emoji: "🔔",  color: "#6B7280", label: ""                        },
};

// ── Notification row ─────────────────────────────────────
function NotificationRow({
  item,
  onPress,
  colors,
}: {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.system;

  return (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: item.read ? colors.card : cfg.color + "12",
          borderColor: item.read ? colors.border : cfg.color + "30",
        },
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {/* Unread dot */}
      {!item.read && (
        <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />
      )}

      {/* Actor avatar or icon */}
      {item.actorId ? (
        <View>
          <UserAvatar uri={item.actorAvatar} name={item.actorName ?? "?"} size={42} />
          <View style={[styles.typeBadge, { backgroundColor: cfg.color }]}>
            <Text style={styles.badgeEmoji}>{cfg.emoji}</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.iconCircle, { backgroundColor: cfg.color + "20" }]}>
          <Text style={styles.iconEmoji}>{cfg.emoji}</Text>
          <Image source={APP_ICON} style={styles.iconImg} resizeMode="cover" />
        </View>
      )}

      {/* Text */}
      <View style={styles.textCol}>
        <Text style={[styles.body, { color: colors.text }]} numberOfLines={2}>
          {item.body}
        </Text>
        {item.postTitle && (
          <Text
            style={[styles.postTitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            "{item.postTitle}"
          </Text>
        )}
        <Text style={[styles.time, { color: colors.textMuted }]}>
          {formatTimeAgo(item.createdAt)}
        </Text>
      </View>

      {/* Chevron for navigable items */}
      {(item.postId || item.actorId) && (
        <Image source={APP_ICON} style={styles.chevronIcon} resizeMode="cover" />
      )}
    </TouchableOpacity>
  );
}

// ── Main screen ──────────────────────────────────────────
export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real-time listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", user.uid),
      limit(80)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items: AppNotification[] = snap.docs
        .map((d) => {
          const data = d.data();
          const ts = data.createdAt as Timestamp | number | null;
          const createdAt =
            ts instanceof Timestamp
              ? ts.toMillis()
              : typeof ts === "number"
              ? ts
              : Date.now();
          return {
            id: d.id,
            recipientId: data.recipientId,
            type: data.type as NType,
            actorId: data.actorId ?? null,
            actorName: data.actorName ?? null,
            actorAvatar: data.actorAvatar ?? null,
            postId: data.postId ?? null,
            postTitle: data.postTitle ?? null,
            title: data.title ?? "",
            body: data.body ?? "",
            read: data.read ?? false,
            createdAt,
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(items);
      setLoading(false);
      setRefreshing(false);
    });

    return unsub;
  }, [user]);

  // Mark all unread → read when screen opens
  useEffect(() => {
    if (!user || notifications.length === 0) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.slice(0, 500).forEach((n) => {
      batch.update(doc(db, "notifications", n.id), { read: true });
    });
    batch.commit().catch(() => {});
  }, [user, notifications.length]);

  const handlePress = useCallback((item: AppNotification) => {
    if (item.postId) {
      router.push(`/post/${item.postId}` as never);
    } else if (item.actorId) {
      router.push(`/user/${item.actorId}` as never);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const now = Date.now();
  const today   = notifications.filter((n) => now - n.createdAt < 86_400_000);
  const earlier = notifications.filter((n) => now - n.createdAt >= 86_400_000);

  const listData: (AppNotification | { sectionTitle: string })[] = [
    ...(today.length   > 0 ? [{ sectionTitle: "Today" },   ...today]   : []),
    ...(earlier.length > 0 ? [{ sectionTitle: "Earlier" }, ...earlier] : []),
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Image source={APP_ICON} style={styles.headerIcon} resizeMode="cover" />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.muted }]}>
            <Text style={styles.emptyEmoji}>🔕</Text>
            <Image source={APP_ICON} style={styles.emptyImg} resizeMode="cover" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No notifications yet
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            When someone likes, comments on, or shares your post — you'll see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) =>
            "sectionTitle" in item ? item.sectionTitle : item.id
          }
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: insets.bottom + 100,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            if ("sectionTitle" in item) {
              return (
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  {item.sectionTitle}
                </Text>
              );
            }
            return (
              <NotificationRow
                item={item}
                onPress={handlePress}
                colors={colors}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerIcon:  { width: 28, height: 28, borderRadius: 8 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyEmoji: { fontSize: 28, position: "absolute" },
  emptyImg:   { width: 28, height: 28, borderRadius: 8, opacity: 0.3 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 8, textAlign: "center" },
  emptyBody:  { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    position: "relative",
  },
  unreadDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconEmoji:  { fontSize: 20, position: "absolute" },
  iconImg:    { width: 20, height: 20, borderRadius: 6, opacity: 0.25 },
  typeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  badgeEmoji: { fontSize: 9 },
  textCol:   { flex: 1, gap: 2 },
  body:      { fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 18 },
  postTitle: { fontFamily: "Inter_400Regular", fontSize: 12, fontStyle: "italic" },
  time:      { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  chevronIcon: { width: 16, height: 16, borderRadius: 4, opacity: 0.4 },
});
