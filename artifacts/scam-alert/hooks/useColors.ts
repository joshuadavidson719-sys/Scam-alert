import { useColorScheme } from "react-native";
import colors from "@/constants/colors";
import { useTheme } from "@/context/ThemeContext";

export function useColors() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  // The native release also supports a mode-only theme provider. Its palette
  // must retain a real primary color rather than being overwritten by undefined.
  const accentColor = "accentColor" in theme && typeof theme.accentColor === "string"
    ? theme.accentColor
    : palette.primary;
  return {
    ...palette,
    primary: accentColor,
    tint: accentColor,
    accentForeground: accentColor,
    radius: colors.radius,
  };
}
