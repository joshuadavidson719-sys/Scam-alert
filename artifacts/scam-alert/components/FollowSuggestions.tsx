import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { sendPushNotification } from "@/lib/notifications";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useFollowSuggestions, type SuggestedUser } from "@/hooks/useFollowSuggestions";
import { UserAvatar } from "./UserAvatar";

const NICHE_COLORS: Record<string, string> = {
  Cybersecurity: "#FF3B3B",
  Finance: "#8B5CF6",
  "Health & Wellness": "#22C55E",
  Technology: "#06B6D4",
  "News & Journalism": "#3B82F6",
  Education: "#F97316",
  "Law & Crime": "#EF4444",
  "General Awareness": "#F59E0B",
};

function UserCard({
  suggestion,
  onFollowed,
}: {
  suggestion: SuggestedUser;
  onFollowed: (uid: string) => void;
}) {
  const colors = useColors();
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [followed, setFollowed] = useState(false);

  const nicheColor = NICHE_COLORS[suggestion.niche] ?? colors.primary;
  const followerCount = suggestion.followers?.length ?? 0;

  const handleFollow = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      await Promise.all([
        // Add target to current user's following list
        updateDoc(doc(db, "users", user.uid), {
          following: arrayUnion(suggestion.uid),
        }),
        // Add current user to target's followers list
        updateDoc(doc(db, "users", suggestion.uid), {
          followers: arrayUnion(user.uid),
        }),
      ]);
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFollowed(true);
      // Notify the followed user
      sendPushNotification(
        suggestion.uid,
        "👤 New Follower",
        `${profile?.username ?? "Someone"} started following you`,
        {
          type: "follow",
          actorId: user.uid,
          actorName: profile?.username ?? "Someone",
          actorAvatar: profile?.profilePhoto ?? "",
        }
      );
      // Remove from list after short delay so user sees the success state
      setTimeout(() => onFollowed(suggestion.uid), 800);
    } catch {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={() => router.push(`/user/${suggestion.uid}` as never)}
      activeOpacity={0.85}
    >
      {/* Niche accent strip */}
      <View style={[styles.nicheStrip, { backgroundColor: nicheColor }]} />

      <View style={styles.cardInner}>
        <UserAvatar
          uri={suggestion.profilePhoto}
          name={suggestion.displayName}
          size={52}
        />

        <Text
          style={[styles.name, { color: colors.text }]}
          numberOfLines={1}
        >
          {suggestion.displayName}
        </Text>

        {suggestion.username ? (
          <Text
            style={[styles.handle, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            @{suggestion.username}
          </Text>
        ) : null}

        {/* Niche badge */}
        {suggestion.niche ? (
          <View style={[styles.nicheBadge, { backgroundColor: nicheColor + "20", borderColor: nicheColor + "44" }]}>
            <Text style={[styles.nicheText, { color: nicheColor }]} numberOfLines={1}>
              {suggestion.niche}
            </Text>
          </View>
        ) : null}

        {/* Follower count */}
        <Text style={[styles.followers, { color: colors.textMuted }]}>
          {followerCount === 1 ? "1 follower" : `${followerCount} followers`}
        </Text>

        {/* Follow button */}
        <TouchableOpacity
          style={[
            styles.followBtn,
            followed
              ? { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }
              : { backgroundColor: colors.primary },
          ]}
          onPress={handleFollow}
          disabled={loading || followed}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : followed ? (
            <View style={styles.followBtnInner}>
              <Feather name="check" size={12} color={colors.textMuted} />
              <Text style={[styles.followBtnText, { color: colors.textMuted }]}>
                Following
              </Text>
            </View>
          ) : (
            <Text style={[styles.followBtnText, { color: "#fff" }]}>
              Follow
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export function FollowSuggestions() {
  const colors = useColors();
  const { user, profile } = useAuth();
  const { suggestions, loading, refresh } = useFollowSuggestions(8);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (!user || !profile) return null;

  const visible = suggestions.filter((s) => !dismissed.has(s.uid));

  if (!loading && visible.length === 0) return null;

  const handleFollowed = (uid: string) => {
    setDismissed((prev) => new Set([...prev, uid]));
  };

  return (
    <View style={[styles.section, { borderBottomColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="users" size={16} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            People to Follow
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push("/people-to-follow" as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={refresh}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.refreshBtn, { backgroundColor: colors.muted }]}
          >
            <Feather name="refresh-cw" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Subtitle */}
      {profile.niche ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Based on your interest in {profile.niche}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {visible.map((suggestion) => (
            <UserCard
              key={suggestion.uid}
              suggestion={suggestion}
              onFollowed={handleFollowed}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderBottomWidth: 1,
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  seeAllText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  refreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 2,
  },
  loadingRow: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  // User card
  card: {
    width: 152,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  nicheStrip: {
    height: 4,
    width: "100%",
  },
  cardInner: {
    padding: 14,
    alignItems: "center",
    gap: 5,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  handle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
  },
  nicheBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  nicheText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.3,
  },
  followers: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  followBtn: {
    marginTop: 8,
    width: "100%",
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  followBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  followBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
