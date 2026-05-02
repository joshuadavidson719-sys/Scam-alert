import React from "react";
import { View, StyleSheet } from "react-native";
import { UserAvatar } from "./UserAvatar";
import { getBadgeForPoints } from "@/hooks/usePoints";

const FRAME_STYLES: Record<string, { colors: string[]; width: number }> = {
  newcomer:  { colors: ["#6B7280"],                      width: 2 },
  aware:     { colors: ["#3B82F6"],                      width: 2 },
  reporter:  { colors: ["#10B981"],                      width: 2.5 },
  guardian:  { colors: ["#8B5CF6"],                      width: 3 },
  sentinel:  { colors: ["#F59E0B"],                      width: 3 },
  protector: { colors: ["#FF3B3B"],                      width: 3.5 },
  legend:    { colors: ["#F59E0B", "#FF3B3B", "#F59E0B"], width: 4 },
};

interface Props {
  uri: string | null;
  name: string;
  size: number;
  points?: number;
  badgeId?: string;
  showFrame?: boolean;
}

export function ProfileFrame({ uri, name, size, points = 0, badgeId, showFrame = true }: Props) {
  const badge = badgeId
    ? { id: badgeId }
    : getBadgeForPoints(points);

  const frame = FRAME_STYLES[badge.id] ?? FRAME_STYLES.newcomer;
  const padding = showFrame ? frame.width + 2 : 0;
  const outerSize = size + padding * 2;

  if (!showFrame || badge.id === "newcomer") {
    return <UserAvatar uri={uri} name={name} size={size} />;
  }

  const isLegend = badge.id === "legend";

  return (
    <View
      style={[
        styles.frame,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
          padding,
          borderWidth: frame.width,
          borderColor: isLegend ? "#F59E0B" : frame.colors[0],
          shadowColor: frame.colors[0],
          shadowOpacity: 0.6,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
      ]}
    >
      <UserAvatar uri={uri} name={name} size={size} />
      {isLegend && (
        <View style={styles.legendCrown}>
          <View style={styles.crownText}>
            <View style={[styles.crownDot, { backgroundColor: "#F59E0B" }]} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  legendCrown: {
    position: "absolute",
    top: -8,
    alignSelf: "center",
  },
  crownText: {
    flexDirection: "row",
    gap: 2,
  },
  crownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
