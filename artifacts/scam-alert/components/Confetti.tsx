import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
  useAnimatedStyle,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const COLORS = [
  "#FF3B3B", "#FFD700", "#39FF14", "#3B82F6",
  "#FF69B4", "#FF6B35", "#8B5CF6", "#10B981",
  "#F59E0B", "#EC4899", "#06B6D4", "#84CC16",
];
const SHAPES = ["circle", "square", "rect"] as const;
const COUNT = 60;

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  startRotation: number;
  shape: typeof SHAPES[number];
  xDrift: number;
}

function makeParticles(): Particle[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * SCREEN_W,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 7 + Math.random() * 9,
    delay: Math.random() * 1000,
    duration: 1800 + Math.random() * 1200,
    startRotation: Math.random() * 360,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    xDrift: (Math.random() - 0.5) * 80,
  }));
}

function Piece({ p }: { p: Particle }) {
  const y = useSharedValue(-30);
  const x = useSharedValue(p.x);
  const rotate = useSharedValue(p.startRotation);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(p.delay, withTiming(1, { duration: 100 }));
    y.value = withDelay(p.delay, withTiming(SCREEN_H + 60, { duration: p.duration, easing: Easing.in(Easing.quad) }));
    x.value = withDelay(p.delay, withTiming(p.x + p.xDrift, { duration: p.duration }));
    rotate.value = withDelay(p.delay, withTiming(p.startRotation + 540, { duration: p.duration }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const shapeStyle = {
    width: p.shape === "rect" ? p.size * 2 : p.size,
    height: p.size,
    borderRadius:
      p.shape === "circle" ? p.size / 2 : p.shape === "square" ? 2 : 1,
    backgroundColor: p.color,
  };

  return <Animated.View style={[styles.piece, shapeStyle, style]} />;
}

interface ConfettiProps {
  visible: boolean;
  onComplete?: () => void;
}

export function Confetti({ visible, onComplete }: ConfettiProps) {
  const particles = useRef(makeParticles()).current;

  useEffect(() => {
    if (!visible || !onComplete) return;
    const t = setTimeout(onComplete, 3500);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((p) => (
        <Piece key={p.id} p={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    overflow: "hidden",
  },
  piece: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
