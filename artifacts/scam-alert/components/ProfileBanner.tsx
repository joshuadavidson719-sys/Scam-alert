import React from "react";
import { View, Text, Image, StyleSheet, useWindowDimensions, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import {
  BANNER_BASE,
  BANNER_PALETTES,
  getBannerPalette,
  type BannerColorId,
} from "@/constants/bannerPalettes";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

interface Props {
  colorId?: string | null;
  username: string;
  niche?: string | null;
  posts: number;
  followers: number;
  following: number;
  /** Avatar node (owner passes an editable touchable) */
  avatar: React.ReactNode;
  /** Optional top-right action buttons */
  actions?: React.ReactNode;
}

export function ProfileBanner({ colorId, username, niche, posts, followers, following, avatar, actions }: Props) {
  const p = getBannerPalette(colorId);
  const { width } = useWindowDimensions();
  const compact = width < 720;

  const stats = (
    <View style={styles.stats}>
      {[
        { n: posts, l: "Posts" },
        { n: followers, l: "Followers" },
        { n: following, l: "Following" },
      ].map((s, i) => (
        <View key={s.l} style={[styles.stat, i > 0 && styles.statBorder]}>
          <Text style={[styles.statNum, { color: p.highlight }]}>{formatCount(s.n)}</Text>
          <Text style={styles.statLabel}>{s.l}</Text>
        </View>
      ))}
    </View>
  );

  const brandAspect = 900 / 437;

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { borderColor: p.accent + "AA" }]}>
        <Image source={require("@/assets/images/banner-map.jpg")} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View pointerEvents="none" style={[styles.panelA, { backgroundColor: p.accent }]} />
        <View pointerEvents="none" style={[styles.panelB, { backgroundColor: p.deep }]} />
        <View pointerEvents="none" style={[styles.panelC, { backgroundColor: p.accent + "99" }]} />
        <View style={[styles.body, compact && styles.bodyCompact]}>
          <View style={compact ? styles.brandCompact : styles.brand}>
            <Image
              source={require("@/assets/images/banner-brand.png")}
              style={{ width: "100%", aspectRatio: brandAspect }}
              resizeMode="contain"
              accessibilityLabel="Scam Alert. Report, learn, stay safe."
            />
            {!compact && (
              <LinearGradient
                pointerEvents="none"
                colors={["transparent", BANNER_BASE.night + "00", BANNER_BASE.night + "CC"]}
                locations={[0, 0.85, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
          <View style={[styles.identity, compact && styles.identityCompact]}>
            <View style={[styles.ring, { borderColor: p.highlight }]}>{avatar}</View>
            <View style={styles.idText}>
              <Text style={styles.username} numberOfLines={1}>{username}</Text>
              <Text style={[styles.niche, { color: p.highlight }]} numberOfLines={1}>
                {niche || "Scam Alert Community"}
              </Text>
              {stats}
            </View>
          </View>
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

interface PickerProps {
  value?: string | null;
  pending: BannerColorId | null;
  error: string | null;
  onSelect: (id: BannerColorId) => void;
  onRetry?: () => void;
  textColor: string;
  mutedColor: string;
}

export function BannerColorPicker({ value, pending, error, onSelect, onRetry, textColor, mutedColor }: PickerProps) {
  const current = getBannerPalette(value).id;
  return (
    <View style={styles.picker}>
      <View style={styles.pickerHead}>
        <Text style={[styles.pickerTitle, { color: textColor }]}>Banner colour</Text>
        {pending ? (
          <View style={styles.pending}>
            <ActivityIndicator size="small" color={mutedColor} />
            <Text style={[styles.pendingText, { color: mutedColor }]}>Saving...</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Banner colour">
        {BANNER_PALETTES.map((pal) => {
          const selected = (pending ?? current) === pal.id;
          return (
            <TouchableOpacity
              key={pal.id}
              testID={`banner-color-${pal.id}`}
              onPress={() => onSelect(pal.id)}
              disabled={!!pending}
              accessibilityRole="radio"
              accessibilityLabel={`${pal.label} banner`}
              accessibilityState={{ selected, disabled: !!pending }}
              style={[
                styles.swatch,
                { backgroundColor: pal.accent, borderColor: selected ? textColor : "transparent", opacity: pending && !selected ? 0.5 : 1 },
              ]}
            >
              {selected ? <Feather name="check" size={16} color={pal.onAccent} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Feather name="alert-triangle" size={13} color="#E5484D" />
          <Text style={styles.errorText}>{error}</Text>
          {onRetry ? (
            <TouchableOpacity onPress={onRetry} accessibilityRole="button">
              <Text style={[styles.retry, { color: textColor }]}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12 },
  card: { borderRadius: 22, borderWidth: 1.5, overflow: "hidden", backgroundColor: BANNER_BASE.night },
  panelA: { position: "absolute", width: 70, height: 600, right: -10, top: -150, transform: [{ rotate: "24deg" }] },
  panelB: { position: "absolute", width: 40, height: 600, right: 70, top: -150, opacity: 0.9, transform: [{ rotate: "24deg" }] },
  panelC: { position: "absolute", width: 14, height: 600, right: 120, top: -150, transform: [{ rotate: "24deg" }] },
  actions: { position: "absolute", top: 10, right: 10, flexDirection: "row", gap: 8, zIndex: 2 },
  body: { flexDirection: "row", alignItems: "center", paddingRight: 28 },
  bodyCompact: { flexDirection: "column", alignItems: "stretch", paddingRight: 0, paddingBottom: 12 },
  brand: { flex: 1.35, maxWidth: 620 },
  brandCompact: { width: "100%", paddingTop: 34 },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 16, paddingLeft: 8 },
  identityCompact: { flex: 0, backgroundColor: "rgba(10,13,22,0.72)", borderRadius: 16, padding: 12, marginHorizontal: 12, marginTop: 4 },
  ring: { borderWidth: 3, borderRadius: 60, padding: 3, backgroundColor: BANNER_BASE.night },
  idText: { flexShrink: 1, gap: 2 },
  username: { fontFamily: "Inter_700Bold", fontSize: 22, color: BANNER_BASE.text, letterSpacing: -0.3 },
  niche: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  stats: { flexDirection: "row", marginTop: 8, marginLeft: -10 },
  stat: { paddingHorizontal: 10, alignItems: "center" },
  statBorder: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.25)" },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 18 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: BANNER_BASE.text },
  picker: { marginTop: 14, paddingHorizontal: 16, gap: 10 },
  pickerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  pending: { flexDirection: "row", alignItems: "center", gap: 6 },
  pendingText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  swatches: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#E5484D55", backgroundColor: "#E5484D14" },
  errorText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 12, color: "#E5484D" },
  retry: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
