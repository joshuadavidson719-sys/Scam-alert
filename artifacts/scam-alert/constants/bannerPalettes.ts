export type BannerColorId = "red" | "yellow" | "green" | "blue" | "purple";

export interface BannerPalette {
  id: BannerColorId;
  label: string;
  /** Saturated brand colour for shield, wordmark, swatch */
  accent: string;
  /** Darker partner used for gradient edges */
  deep: string;
  /** Highlight used for stat numbers and the avatar ring */
  highlight: string;
  /** Text colour that reads on top of `accent` */
  onAccent: string;
}

export const BANNER_PALETTES: readonly BannerPalette[] = [
  { id: "red", label: "Red", accent: "#FF2E2E", deep: "#7A0A0A", highlight: "#FFD23F", onAccent: "#FFFFFF" },
  { id: "yellow", label: "Yellow", accent: "#FFC81A", deep: "#7A5200", highlight: "#FFE680", onAccent: "#1A1300" },
  { id: "green", label: "Green", accent: "#1FD16B", deep: "#04542A", highlight: "#B6FF5C", onAccent: "#04210F" },
  { id: "blue", label: "Blue", accent: "#2F86FF", deep: "#082F73", highlight: "#7FE3FF", onAccent: "#FFFFFF" },
  { id: "purple", label: "Purple", accent: "#A04DFF", deep: "#3B0E78", highlight: "#FF9BEA", onAccent: "#FFFFFF" },
] as const;

/** Dark base the banner sits on, independent of app theme */
export const BANNER_BASE = { night: "#0A0D16", ink: "#121726", text: "#F4F6FB", textDim: "#AAB2C5" };

export const DEFAULT_BANNER_COLOR: BannerColorId = "red";

export function getBannerPalette(id?: string | null): BannerPalette {
  return BANNER_PALETTES.find((p) => p.id === id) ?? BANNER_PALETTES[0];
}
