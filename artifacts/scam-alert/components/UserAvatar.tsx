import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { resolveProfilePhotoUri } from "@/lib/api-base";

export const AVATAR_PRESETS = [
  { id: "shield", label: "Shield", icon: "shield" },
  { id: "alert", label: "Alert", icon: "alert-triangle" },
  { id: "star", label: "Star", icon: "star" },
  { id: "heart", label: "Heart", icon: "heart" },
  { id: "zap", label: "Energy", icon: "zap" },
  { id: "globe", label: "Globe", icon: "globe" },
  { id: "smile", label: "Smile", icon: "smile" },
  { id: "award", label: "Award", icon: "award" },
] as const;

interface Props {
  uri?: string | null;
  name?: string;
  size?: number;
}

export function UserAvatar({ uri, name = "?", size = 40 }: Props) {
  const colors = useColors();
  const [imageFailed, setImageFailed] = useState(false);
  const preset = uri?.startsWith("avatar:")
    ? AVATAR_PRESETS.find((item) => item.id === uri.slice("avatar:".length))
    : undefined;
  const imageUri = resolveProfilePhotoUri(uri);
  const showImage = !!imageUri && !preset && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);
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
      {preset ? (
        <Feather
          name={preset.icon as React.ComponentProps<typeof Feather>["name"]}
          size={size * 0.46}
          color={colors.primary}
        />
      ) : showImage ? (
        <Image
          source={{ uri: imageUri! }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImageFailed(true)}
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
