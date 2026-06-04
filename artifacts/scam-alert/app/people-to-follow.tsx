import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import * as Haptics from "expo-haptics";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { useAuth, NICHES } from "@/context/AuthContext";
import { useFollowSuggestions, type SuggestedUser } from "@/hooks/useFollowSuggestions";
import { UserAvatar } from "@/components/UserAvatar";

const APP_ICON = require("@/assets/images/icon.png");

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

function UserRow({
  item,
  isFollowing,
  onFollow,
}: {
  item: SuggestedUser;
  isFollowing: boolean;
  onFollow: (uid: string) => void;
}) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useAuth();
  const nicheColor = NICHE_COLORS[item.niche] ?? colors.primary;

  const handleFollow = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      await Promise.all([
        updateDoc(doc(db, "users", user.uid), { following: arrayUnion(item.uid) }),
        updateDoc(doc(db, "users", item.uid), { followers: arrayUnion(user.uid) }),
      ]);
      await refreshProfile();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onFollow(item.uid);
    } catch {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/user/${item.uid}` as never)}
      activeOpacity={0.75}
    >
      {/* Niche accent bar */}
      <View style={[styles.accentBar, { backgroundColor: nicheColor }]} />

      <UserAvatar uri={item.profilePhoto} name={item.displayName} size={52} />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          {item.username ? (
            <Text style={[styles.rowHandle, { color: colors.textMuted }]}>
              @{item.username}
            </Text>
          ) : null}
        </View>

        {item.bio ? (
          <Text style={[styles.rowBio, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.bio}
          </Text>
        ) : null}

        <View style={styles.rowFooter}>
          {item.niche ? (
            <View style={[styles.nicheBadge, { backgroundColor: nicheColor + "18", borderColor: nicheColor + "44" }]}>
              <Text style={[styles.nicheText, { color: nicheColor }]}>{item.niche}</Text>
            </View>
          ) : null}
          <Text style={[styles.followerCount, { color: colors.textMuted }]}>
            {item.followers?.length ?? 0} followers
          </Text>
        </View>
      </View>

      {/* Follow / Following button */}
      <TouchableOpacity
        style={[
          styles.followBtn,
          isFollowing
            ? { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }
            : { backgroundColor: colors.primary },
        ]}
        onPress={handleFollow}
        disabled={loading || isFollowing}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : isFollowing ? (
          <View style={styles.followBtnInner}>
            <Text style={{ fontSize: 12 }}>✓</Text>
            <Text style={[styles.followBtnText, { color: colors.textMuted }]}>Following</Text>
          </View>
        ) : (
          <Text style={[styles.followBtnText, { color: "#fff" }]}>Follow</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function PeopleToFollowScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const { profile } = useAuth();

  const [search, setSearch] = useState("");
  const [activeNiche, setActiveNiche] = useState<string>("all");
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const { suggestions, loading, refresh } = useFollowSuggestions(200);

  const handleFollow = useCallback((uid: string) => {
    setFollowed((prev) => new Set([...prev, uid]));
  }, []);

  const filtered = suggestions.filter((s) => {
    const matchesNiche = activeNiche === "all" || s.niche === activeNiche;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.displayName?.toLowerCase().includes(q) ||
      s.username?.toLowerCase().includes(q) ||
      s.bio?.toLowerCase().includes(q);
    return matchesNiche && matchesSearch;
  });

  const yourNiche = profile?.niche;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Nav bar */}
      <View
        style={[
          styles.navBar,
          { paddingTop: topPad + 8, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Image source={APP_ICON} style={styles.navIcon} resizeMode="cover" />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>People to Follow</Text>
        <TouchableOpacity
          onPress={refresh}
          style={[styles.refreshBtn, { backgroundColor: colors.muted }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Image source={APP_ICON} style={styles.refreshIcon} resizeMode="cover" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image source={APP_ICON} style={styles.searchIcon} resizeMode="cover" />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, handle, or bio..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 14, color: colors.textMuted }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Niche filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.pillScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.pillScrollContent}
      >
        {/* All pill */}
        <TouchableOpacity
          style={[
            styles.pill,
            activeNiche === "all"
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => setActiveNiche("all")}
        >
          <Text style={[styles.pillText, { color: activeNiche === "all" ? "#fff" : colors.textMuted }]}>
            All
          </Text>
        </TouchableOpacity>

        {NICHES.map((niche) => {
          const isActive = activeNiche === niche;
          const nicheColor = NICHE_COLORS[niche] ?? colors.primary;
          const isYours = niche === yourNiche;
          return (
            <TouchableOpacity
              key={niche}
              style={[
                styles.pill,
                isActive
                  ? { backgroundColor: nicheColor, borderColor: nicheColor }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setActiveNiche(niche)}
            >
              <Text style={[styles.pillText, { color: isActive ? "#fff" : colors.textMuted }]}>
                {niche}
              </Text>
              {isYours && (
                <View style={[styles.yoursDot, { backgroundColor: isActive ? "#fff" : nicheColor }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Finding people for you…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 44 }}>👥</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No one found</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {search ? "Try a different search term" : "Check back as more users join"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <UserRow
              item={item}
              isFollowing={followed.has(item.uid)}
              onFollow={handleFollow}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            yourNiche && activeNiche === "all" && !search ? (
              <View style={[styles.recommendedBanner, { backgroundColor: colors.primary + "12", borderBottomColor: colors.primary + "30" }]}>
                <Text style={{ fontSize: 13 }}>⭐</Text>
                <Text style={[styles.recommendedText, { color: colors.primary }]}>
                  Showing your niche ({yourNiche}) first
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  navIcon:     { width: 22, height: 22, borderRadius: 6 },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshIcon: { width: 14, height: 14, borderRadius: 3 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
  },
  searchIcon: { width: 15, height: 15, borderRadius: 4 },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    padding: 0,
  },
  pillScroll: {
    maxHeight: 52,
    borderBottomWidth: 1,
  },
  pillScrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  yoursDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // List row
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  accentBar: {
    width: 3,
    height: 52,
    borderRadius: 2,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTop: { gap: 1 },
  rowName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  rowHandle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  rowBio: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  nicheBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  nicheText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.2,
  },
  followerCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 86,
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
  // States
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  recommendedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  recommendedText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
