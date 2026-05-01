import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  uri?: string | null;
  name?: string;
  size?: number;
}

export function UserAvatar({ uri, name = "?", size = 40 }: Props) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary + "33",
          borderColor: colors.primary + "55",
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            { fontSize: size * 0.38, color: colors.primary },
          ]}
        >
          {initials || "?"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  initials: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
