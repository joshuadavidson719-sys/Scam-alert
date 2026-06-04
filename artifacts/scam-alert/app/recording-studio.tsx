import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Alert,
  Platform,
  Image,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const APP_ICON = require("@/assets/images/icon.png");

// ─── Constants ────────────────────────────────────────────────────────────────
const TRACKS = [
  { id: "vox",   label: "Vocals",   emoji: "🎤", color: "#FF3B3B" },
  { id: "gtr",   label: "Guitar",   emoji: "🎸", color: "#F59E0B" },
  { id: "bass",  label: "Bass",     emoji: "🎵", color: "#10B981" },
  { id: "drums", label: "Drums",    emoji: "🥁", color: "#3B82F6" },
  { id: "keys",  label: "Keys",     emoji: "🎹", color: "#8B5CF6" },
  { id: "fx",    label: "FX / Pad", emoji: "🎛️", color: "#EC4899" },
];

const EFFECTS = [
  { id: "reverb",   label: "Reverb",      emoji: "🌊" },
  { id: "delay",    label: "Delay",       emoji: "🔁" },
  { id: "compress", label: "Compressor",  emoji: "📉" },
  { id: "eq",       label: "EQ",          emoji: "📊" },
  { id: "chorus",   label: "Chorus",      emoji: "✨" },
  { id: "pitch",    label: "Pitch",       emoji: "🎼" },
];

const EQ_BANDS = ["60", "250", "1k", "4k", "8k", "16k"];

type TransportState = "idle" | "recording" | "playing" | "paused";

// ─── Waveform bar component ────────────────────────────────────────────────────
function WaveBar({ active, color, height }: { active: boolean; color: string; height: number }) {
  const anim = useRef(new Animated.Value(0.2)).current;
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      loop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.random() * 0.6 + 0.4,
            duration: 120 + Math.random() * 200,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: Math.random() * 0.3 + 0.1,
            duration: 120 + Math.random() * 200,
            easing: Easing.ease,
            useNativeDriver: false,
          }),
        ])
      );
      loop.current.start();
    } else {
      loop.current?.stop();
      Animated.timing(anim, {
        toValue: 0.2,
        duration: 300,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start();
    }
    return () => { loop.current?.stop(); };
  }, [active]);

  return (
    <Animated.View
      style={{
        width: 3,
        height: anim.interpolate({ inputRange: [0, 1], outputRange: [4, height] }),
        borderRadius: 2,
        backgroundColor: color,
        alignSelf: "flex-end",
      }}
    />
  );
}

// ─── VU Meter ─────────────────────────────────────────────────────────────────
function VUMeter({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const loop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      loop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.8 + Math.random() * 0.2, duration: 150, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.3 + Math.random() * 0.3, duration: 200, useNativeDriver: false }),
        ])
      );
      loop.current.start();
    } else {
      loop.current?.stop();
      Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: false }).start();
    }
    return () => { loop.current?.stop(); };
  }, [active]);

  return (
    <View style={vu.container}>
      {[...Array(12)].map((_, i) => (
        <Animated.View
          key={i}
          style={[
            vu.segment,
            {
              backgroundColor: anim.interpolate({
                inputRange: [0, 0.5, 0.75, 1],
                outputRange: [
                  i < 7 ? "#10B98130" : i < 10 ? "#F59E0B30" : "#FF3B3B30",
                  i < 7 ? (i <= Math.floor(0.5 * 12) ? "#10B981" : "#10B98130")
                        : i < 10 ? "#F59E0B30" : "#FF3B3B30",
                  i < 7 ? "#10B981" : i < 10 ? (i <= Math.floor(0.75 * 12) ? "#F59E0B" : "#F59E0B30") : "#FF3B3B30",
                  i < 7 ? "#10B981" : i < 10 ? "#F59E0B" : "#FF3B3B",
                ],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const vu = StyleSheet.create({
  container: { flexDirection: "column-reverse", gap: 2, height: 60, justifyContent: "flex-start" },
  segment:   { width: 10, height: 3, borderRadius: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RecordingStudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [transport, setTransport] = useState<TransportState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [masterVol, setMasterVol] = useState(85);
  const [sessionName, setSessionName] = useState("Untitled Session");
  const [editingName, setEditingName] = useState(false);
  const [trackVols, setTrackVols] = useState<Record<string, number>>(
    Object.fromEntries(TRACKS.map((t) => [t.id, 80]))
  );
  const [mutedTracks, setMutedTracks] = useState<Set<string>>(new Set());
  const [soloTrack, setSoloTrack] = useState<string | null>(null);
  const [activeEffects, setActiveEffects] = useState<Set<string>>(new Set(["reverb", "compress"]));
  const [eqVals, setEqVals] = useState<Record<string, number>>(
    Object.fromEntries(EQ_BANDS.map((b) => [b, 50]))
  );
  const [recordedTracks, setRecordedTracks] = useState<Set<string>>(new Set());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Transport timer
  useEffect(() => {
    if (transport === "recording" || transport === "playing") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [transport]);

  // Record button pulse
  useEffect(() => {
    if (transport === "recording") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    return () => { pulseLoop.current?.stop(); };
  }, [transport]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleRecord = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (transport === "recording") {
      setTransport("idle");
      setRecordedTracks((prev) => {
        const next = new Set(prev);
        TRACKS.forEach((t) => next.add(t.id));
        return next;
      });
    } else {
      setElapsed(0);
      setTransport("recording");
    }
  }, [transport]);

  const handlePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (transport === "playing") {
      setTransport("paused");
    } else if (transport === "paused") {
      setTransport("playing");
    } else {
      setElapsed(0);
      setTransport("playing");
    }
  }, [transport]);

  const handleStop = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTransport("idle");
    setElapsed(0);
  }, []);

  const handleTapTempo = useCallback(() => {
    Haptics.selectionAsync();
    setBpm((b) => (b >= 200 ? 60 : b + 5));
  }, []);

  const handleToggleMute = (id: string) => {
    Haptics.selectionAsync();
    setMutedTracks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSolo = (id: string) => {
    Haptics.selectionAsync();
    setSoloTrack((prev) => (prev === id ? null : id));
  };

  const handleToggleEffect = (id: string) => {
    Haptics.selectionAsync();
    setActiveEffects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    Alert.alert(
      "Export Session",
      `"${sessionName}" will be exported as a high-quality WAV file.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Export WAV", onPress: () => Alert.alert("Exported!", "Your session has been saved to your device.") },
        { text: "Export MP3", onPress: () => Alert.alert("Exported!", "Your session has been saved as MP3.") },
      ]
    );
  };

  const isActive = transport === "recording" || transport === "playing";

  return (
    <View style={[s.root, { backgroundColor: "#0A0A0A" }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: "#1E1E1E" }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Image source={APP_ICON} style={s.backIcon} resizeMode="cover" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          {editingName ? (
            <TextInput
              style={[s.sessionInput, { color: "#fff", borderColor: "#333" }]}
              value={sessionName}
              onChangeText={setSessionName}
              onBlur={() => setEditingName(false)}
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)}>
              <Text style={s.sessionName}>{sessionName}</Text>
              <Text style={s.sessionSub}>🎵 Recording Studio</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={handleExport} style={s.exportBtn}>
          <Text style={s.exportTxt}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── Transport & Timer ── */}
        <View style={s.transportSection}>
          {/* Time display */}
          <View style={s.timerBox}>
            <Text style={[s.timerDisplay, { color: transport === "recording" ? "#FF3B3B" : "#00FF88" }]}>
              {formatTime(elapsed)}
            </Text>
            <Text style={s.timerLabel}>
              {transport === "recording" ? "● REC" : transport === "playing" ? "▶ PLAY" : transport === "paused" ? "⏸ PAUSED" : "⬜ STOPPED"}
            </Text>
          </View>

          {/* BPM */}
          <View style={s.bpmBox}>
            <TouchableOpacity onPress={() => setBpm((b) => Math.max(40, b - 1))} style={s.bpmArrow}>
              <Text style={s.bpmArrowTxt}>◀</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleTapTempo} style={s.bpmCenter}>
              <Text style={s.bpmVal}>{bpm}</Text>
              <Text style={s.bpmLabel}>BPM</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBpm((b) => Math.min(300, b + 1))} style={s.bpmArrow}>
              <Text style={s.bpmArrowTxt}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Waveform Visualizer ── */}
        <View style={[s.waveSection, { borderColor: "#1E1E1E" }]}>
          <View style={s.waveLabel}>
            <Text style={s.waveLabelTxt}>MASTER OUTPUT</Text>
            <VUMeter active={isActive} />
          </View>
          <View style={s.waveform}>
            {[...Array(48)].map((_, i) => (
              <WaveBar
                key={i}
                active={isActive}
                color={
                  transport === "recording"
                    ? i % 3 === 0 ? "#FF3B3B" : "#FF6B6B"
                    : i % 3 === 0 ? "#00FF88" : "#00CC66"
                }
                height={60}
              />
            ))}
          </View>
        </View>

        {/* ── Transport Controls ── */}
        <View style={s.controls}>
          {/* Rewind */}
          <TouchableOpacity style={s.ctrlBtn} onPress={handleStop}>
            <Text style={s.ctrlIcon}>⏮</Text>
          </TouchableOpacity>

          {/* Stop */}
          <TouchableOpacity style={[s.ctrlBtn, s.ctrlBtnLg, { backgroundColor: "#1E1E1E", borderColor: "#333" }]} onPress={handleStop}>
            <Text style={[s.ctrlIcon, { fontSize: 22 }]}>⏹</Text>
          </TouchableOpacity>

          {/* Record */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[
                s.recBtn,
                transport === "recording" && { backgroundColor: "#FF3B3B", shadowColor: "#FF3B3B", shadowRadius: 16, shadowOpacity: 0.8, elevation: 10 },
              ]}
              onPress={handleRecord}
            >
              <View style={[
                s.recDot,
                { backgroundColor: transport === "recording" ? "#fff" : "#FF3B3B" },
              ]} />
            </TouchableOpacity>
          </Animated.View>

          {/* Play/Pause */}
          <TouchableOpacity
            style={[
              s.ctrlBtn, s.ctrlBtnLg,
              (transport === "playing") && { backgroundColor: "#00FF8820", borderColor: "#00FF8840" },
            ]}
            onPress={handlePlay}
          >
            <Text style={[s.ctrlIcon, { fontSize: 22, color: transport === "playing" ? "#00FF88" : "#ccc" }]}>
              {transport === "playing" ? "⏸" : "▶"}
            </Text>
          </TouchableOpacity>

          {/* Fast-forward */}
          <TouchableOpacity style={s.ctrlBtn}>
            <Text style={s.ctrlIcon}>⏭</Text>
          </TouchableOpacity>
        </View>

        {/* ── Master Volume ── */}
        <View style={[s.masterRow, { borderColor: "#1E1E1E" }]}>
          <Text style={s.masterLabel}>MASTER VOL</Text>
          <View style={s.volTrack}>
            {[...Array(20)].map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  s.volSegment,
                  {
                    backgroundColor: i < Math.round(masterVol / 5)
                      ? i < 14 ? "#00FF88" : i < 18 ? "#F59E0B" : "#FF3B3B"
                      : "#1E1E1E",
                  },
                ]}
                onPress={() => { setMasterVol((i + 1) * 5); Haptics.selectionAsync(); }}
              />
            ))}
          </View>
          <Text style={s.masterVolTxt}>{masterVol}%</Text>
        </View>

        {/* ── Track Mixer ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>MIXER</Text>
          <Text style={s.sectionSub}>6 tracks · Tap S/M to solo or mute</Text>
        </View>

        <View style={[s.mixer, { borderColor: "#1E1E1E" }]}>
          {TRACKS.map((track) => {
            const muted = mutedTracks.has(track.id);
            const soloed = soloTrack === track.id;
            const vol = trackVols[track.id] ?? 80;
            const hasRecording = recordedTracks.has(track.id);
            return (
              <View key={track.id} style={[s.trackRow, { borderBottomColor: "#1A1A1A" }]}>
                {/* Track info */}
                <View style={s.trackInfo}>
                  <View style={[s.trackDot, { backgroundColor: track.color }]} />
                  <View>
                    <Text style={s.trackEmoji}>{track.emoji}</Text>
                    <Text style={[s.trackName, { color: muted ? "#444" : "#ccc" }]} numberOfLines={1}>
                      {track.label}
                    </Text>
                  </View>
                  {hasRecording && <View style={[s.recIndicator, { backgroundColor: track.color }]} />}
                </View>

                {/* Volume fader */}
                <View style={s.faderArea}>
                  {[...Array(15)].map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        s.faderSeg,
                        {
                          backgroundColor: muted ? "#111" :
                            i < Math.round(vol / 7)
                              ? track.color + (i < 10 ? "DD" : i < 13 ? "99" : "55")
                              : "#1A1A1A",
                        },
                      ]}
                      onPress={() => {
                        setTrackVols((p) => ({ ...p, [track.id]: (i + 1) * 7 }));
                        Haptics.selectionAsync();
                      }}
                    />
                  ))}
                </View>

                {/* vol % */}
                <Text style={[s.faderVal, { color: muted ? "#333" : "#666" }]}>{vol}%</Text>

                {/* S / M buttons */}
                <View style={s.smRow}>
                  <TouchableOpacity
                    style={[s.smBtn, soloed && { backgroundColor: "#F59E0B", borderColor: "#F59E0B" }]}
                    onPress={() => handleSolo(track.id)}
                  >
                    <Text style={[s.smTxt, soloed && { color: "#000" }]}>S</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.smBtn, muted && { backgroundColor: "#FF3B3B", borderColor: "#FF3B3B" }]}
                    onPress={() => handleToggleMute(track.id)}
                  >
                    <Text style={[s.smTxt, muted && { color: "#fff" }]}>M</Text>
                  </TouchableOpacity>
                </View>

                {/* mini VU */}
                {isActive && !muted && (
                  <VUMeter active={isActive} />
                )}
              </View>
            );
          })}
        </View>

        {/* ── EQ Section ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>EQ — PARAMETRIC EQUALIZER</Text>
        </View>

        <View style={[s.eqPanel, { borderColor: "#1E1E1E" }]}>
          {EQ_BANDS.map((band) => {
            const val = eqVals[band] ?? 50;
            const db = Math.round((val - 50) / 50 * 12);
            return (
              <View key={band} style={s.eqBand}>
                <Text style={s.eqHz}>{band}</Text>
                {/* Vertical fader */}
                <View style={s.eqFader}>
                  {[...Array(10)].map((_, i) => {
                    const slot = 9 - i;
                    const active = val >= 50
                      ? slot >= 5 && slot <= Math.floor(val / 10)
                      : slot < 5 && slot >= Math.ceil(val / 10);
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          s.eqSeg,
                          {
                            backgroundColor: active
                              ? val >= 50 ? "#00FF88" : "#FF3B3B"
                              : slot === 4 ? "#2A2A2A" : "#181818",
                          },
                        ]}
                        onPress={() => { setEqVals((p) => ({ ...p, [band]: (9 - i) * 11 })); Haptics.selectionAsync(); }}
                      />
                    );
                  })}
                </View>
                <Text style={[s.eqDb, { color: db > 0 ? "#00FF88" : db < 0 ? "#FF3B3B" : "#555" }]}>
                  {db > 0 ? `+${db}` : db}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Effects Rack ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>EFFECTS RACK</Text>
        </View>

        <View style={s.fxGrid}>
          {EFFECTS.map((fx) => {
            const on = activeEffects.has(fx.id);
            return (
              <TouchableOpacity
                key={fx.id}
                style={[
                  s.fxChip,
                  { borderColor: on ? "#00FF88" : "#222", backgroundColor: on ? "#00FF8812" : "#111" },
                ]}
                onPress={() => handleToggleEffect(fx.id)}
              >
                <Text style={s.fxEmoji}>{fx.emoji}</Text>
                <Text style={[s.fxLabel, { color: on ? "#00FF88" : "#555" }]}>{fx.label}</Text>
                <View style={[s.fxLED, { backgroundColor: on ? "#00FF88" : "#222" }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Session Actions ── */}
        <View style={s.sessionActions}>
          <TouchableOpacity
            style={[s.sessionBtn, { backgroundColor: "#1E1E1E", borderColor: "#2A2A2A" }]}
            onPress={() => Alert.alert("New Session", "Start a new empty session?", [
              { text: "Cancel", style: "cancel" },
              { text: "New Session", onPress: () => { handleStop(); setSessionName("Untitled Session"); setRecordedTracks(new Set()); } },
            ])}
          >
            <Text style={{ fontSize: 16 }}>📁</Text>
            <Text style={[s.sessionBtnTxt, { color: "#ccc" }]}>New</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.sessionBtn, { backgroundColor: "#1E1E1E", borderColor: "#2A2A2A" }]}
            onPress={() => Alert.alert("Saved!", `"${sessionName}" has been saved.`)}
          >
            <Text style={{ fontSize: 16 }}>💾</Text>
            <Text style={[s.sessionBtnTxt, { color: "#ccc" }]}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.sessionBtn, { backgroundColor: "#FF3B3B15", borderColor: "#FF3B3B30" }]}
            onPress={handleExport}
          >
            <Text style={{ fontSize: 16 }}>📤</Text>
            <Text style={[s.sessionBtnTxt, { color: "#FF3B3B" }]}>Export</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.sessionBtn, { backgroundColor: "#00FF8815", borderColor: "#00FF8830" }]}
            onPress={() => Alert.alert("Share", "Share this recording to the community feed as a Reel?",[
              { text: "Cancel", style: "cancel" },
              { text: "Post as Reel", onPress: () => router.push("/reels-upload" as never) },
            ])}
          >
            <Text style={{ fontSize: 16 }}>🎵</Text>
            <Text style={[s.sessionBtnTxt, { color: "#00FF88" }]}>Post</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn:     { padding: 4 },
  backIcon:    { width: 26, height: 26, borderRadius: 7 },
  headerCenter: { alignItems: "center" },
  sessionName: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff", textAlign: "center" },
  sessionSub:  { fontFamily: "Inter_400Regular", fontSize: 11, color: "#555", textAlign: "center" },
  sessionInput: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 160,
    textAlign: "center",
  },
  exportBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#FF3B3B20",
    borderWidth: 1,
    borderColor: "#FF3B3B40",
  },
  exportTxt: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#FF3B3B" },

  // ── Transport & Timer
  transportSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  timerBox: { alignItems: "flex-start" },
  timerDisplay: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  timerLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#444", letterSpacing: 2 },

  bpmBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#111",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#222",
  },
  bpmArrow: { padding: 4 },
  bpmArrowTxt: { color: "#555", fontSize: 12 },
  bpmCenter: { alignItems: "center", paddingHorizontal: 6 },
  bpmVal: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#F59E0B" },
  bpmLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: "#444", letterSpacing: 2 },

  // ── Waveform
  waveSection: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#0D0D0D",
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  waveLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  waveLabelTxt: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#333", letterSpacing: 2 },
  waveform: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    height: 60,
    overflow: "hidden",
  },

  // ── Controls
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  ctrlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnLg: { width: 54, height: 54, borderRadius: 27 },
  ctrlIcon: { fontSize: 16, color: "#888" },

  recBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1A0000",
    borderWidth: 2,
    borderColor: "#FF3B3B",
    alignItems: "center",
    justifyContent: "center",
  },
  recDot: { width: 28, height: 28, borderRadius: 14 },

  // ── Master
  masterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  masterLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#333", letterSpacing: 1.5, width: 56 },
  volTrack: { flex: 1, flexDirection: "row", gap: 3 },
  volSegment: { flex: 1, height: 18, borderRadius: 3 },
  masterVolTxt: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#444", width: 36, textAlign: "right" },

  // ── Mixer
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#444", letterSpacing: 2 },
  sectionSub:   { fontFamily: "Inter_400Regular", fontSize: 10, color: "#2A2A2A" },

  mixer: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#0D0D0D",
    overflow: "hidden",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  trackInfo: { flexDirection: "row", alignItems: "center", gap: 8, width: 72 },
  trackDot: { width: 3, height: 36, borderRadius: 2 },
  trackEmoji: { fontSize: 14 },
  trackName: { fontFamily: "Inter_500Medium", fontSize: 10, marginTop: 1 },
  recIndicator: { width: 5, height: 5, borderRadius: 3, marginLeft: -4, marginTop: -14 },

  faderArea: { flex: 1, flexDirection: "row", gap: 2 },
  faderSeg: { flex: 1, height: 20, borderRadius: 3 },
  faderVal: { fontFamily: "Inter_400Regular", fontSize: 9, width: 26, textAlign: "right" },

  smRow: { flexDirection: "row", gap: 4 },
  smBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  smTxt: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#444" },

  // ── EQ
  eqPanel: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#0D0D0D",
    flexDirection: "row",
    padding: 14,
    gap: 6,
  },
  eqBand: { flex: 1, alignItems: "center", gap: 4 },
  eqHz: { fontFamily: "Inter_600SemiBold", fontSize: 8, color: "#333", letterSpacing: 0.5 },
  eqFader: { gap: 3 },
  eqSeg: { width: 22, height: 12, borderRadius: 2 },
  eqDb: { fontFamily: "Inter_600SemiBold", fontSize: 8 },

  // ── FX
  fxGrid: {
    marginHorizontal: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  fxChip: {
    width: "30%",
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  fxEmoji: { fontSize: 22 },
  fxLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  fxLED: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },

  // ── Session Actions
  sessionActions: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 20,
  },
  sessionBtn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  sessionBtnTxt: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
});
