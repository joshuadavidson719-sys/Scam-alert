import { useColorScheme } from "react-native";
import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

export function useColors() {
  const scheme = useColorScheme();
  const { accentColor } = useTheme();
  const palette =
    scheme === "dark" && "dark" in colors
      ? (colors as Record<string, typeof colors.light>).dark
      : colors.light;
  return {
    ...palette,
    primary: accentColor,
    tint: accentColor,
    accentForeground: accentColor,
    radius: colors.radius,
  };
}
