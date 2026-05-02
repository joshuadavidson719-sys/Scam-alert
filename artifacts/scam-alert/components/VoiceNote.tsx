import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import {
  useAudioRecorder,
  useAudioPlayer,
  requestRecordingPermissionsAsync,
  RecordingPresets,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

interface VoiceNoteRecorderProps {
  onSend: (uri: string, durationMs: number) => void;
  onCancel: () => void;
}

export function VoiceNoteRecorder({ onSend, onCancel }: VoiceNoteRecorderProps) {
  const colors = useColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    startRecording();
    return () => {
      timerRef.current && clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      pulse.value = withRepeat(
        withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const startRecording = async () => {
    try {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission needed", "Microphone permission is required to record voice notes.");
        onCancel();
        return;
      }
      await recorder.record();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("Error", "Could not start recording.");
      onCancel();
    }
  };

  const stopAndSend = async () => {
    timerRef.current && clearInterval(timerRef.current);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSend(uri, duration * 1000);
      }
    } catch {
      Alert.alert("Error", "Could not save recording.");
    }
    setIsRecording(false);
  };

  const cancel = async () => {
    timerRef.current && clearInterval(timerRef.current);
    try { await recorder.stop(); } catch {}
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const formatDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <View style={[styles.recorderRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity onPress={cancel} style={styles.cancelBtn}>
        <Feather name="x" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.waveWrap}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: isRecording ? 4 + Math.abs(Math.sin(i * 0.7 + duration * 0.3)) * 14 : 4,
                backgroundColor: "#FF3B3B" + (isRecording ? "CC" : "40"),
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.dur, { color: "#FF3B3B" }]}>{formatDur(duration)}</Text>

      <Animated.View style={pulseStyle}>
        <TouchableOpacity
          onPress={stopAndSend}
          style={[styles.sendBtn, { backgroundColor: "#FF3B3B" }]}
        >
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

interface VoiceNotePlayerProps {
  uri: string;
  durationMs: number;
  isMine: boolean;
}

export function VoiceNotePlayer({ uri, durationMs, isMine }: VoiceNotePlayerProps) {
  const colors = useColors();
  const player = useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (player.playing) {
        setPosMs(player.currentTime * 1000);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => {
    if (!player.playing && playing) {
      setPlaying(false);
      setPosMs(0);
    }
  }, [player.playing]);

  const togglePlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  const total = durationMs / 1000;
  const current = posMs / 1000;
  const pct = durationMs > 0 ? Math.min(1, posMs / durationMs) : 0;
  const formatDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const accentColor = isMine ? "#FFFFFF" : "#FF3B3B";
  const trackBg = isMine ? "rgba(255,255,255,0.25)" : colors.border;

  return (
    <View style={styles.playerRow}>
      <TouchableOpacity
        onPress={togglePlay}
        style={[styles.playBtn, { backgroundColor: isMine ? "rgba(255,255,255,0.2)" : "#FF3B3B20" }]}
      >
        <Feather name={playing ? "pause" : "play"} size={16} color={accentColor} />
      </TouchableOpacity>

      <View style={styles.trackWrap}>
        <View style={[styles.track, { backgroundColor: trackBg }]}>
          <View style={[styles.trackFill, { width: `${pct * 100}%`, backgroundColor: accentColor }]} />
        </View>
        <Text style={[styles.trackTime, { color: accentColor + "AA" }]}>
          {playing || posMs > 0 ? formatDur(current) : formatDur(total)} 🎤
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  recorderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 24,
    borderWidth: 1,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  cancelBtn: { padding: 4 },
  waveWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 28,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  dur: { fontFamily: "Inter_700Bold", fontSize: 13, minWidth: 36 },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 160,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  trackWrap: { flex: 1, gap: 4 },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  trackFill: { height: "100%", borderRadius: 2 },
  trackTime: { fontFamily: "Inter_400Regular", fontSize: 10 },
});
