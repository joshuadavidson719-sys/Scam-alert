import { useTheme } from "@/context/ThemeContext";
import colors from "@/constants/colors";
import { useColorScheme } from "react-native";

type ColorKey = keyof typeof colors;

export function useColors() {
  const { mode } = useTheme();
  const systemScheme = useColorScheme();

  let palette: (typeof colors)[ColorKey];

  if (mode === "system") {
    palette = systemScheme === "dark" ? colors.dark : colors.light;
  } else if (mode in colors) {
    palette = colors[mode as ColorKey];
  } else {
    palette = colors.dark;
  }

  return palette;
}
