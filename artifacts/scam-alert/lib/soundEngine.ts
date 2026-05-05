// soundEngine.ts — Web Audio API synthesizer, no external files needed
// Works on Expo Web. Silently no-ops on native.
import { Platform } from "react-native";

export type SoundType =
  | "punch" | "smash" | "blast" | "block" | "victory" | "defeat"
  | "coin"  | "crash" | "shoot" | "explode" | "cardDeal" | "cardFlip"
  | "win"   | "lose"  | "levelUp" | "enemyHit" | "click" | "combo" | "rage";

export type MusicTheme = "battle" | "racing" | "space" | "casino" | "dungeon" | "none";

// ── Singleton audio context ───────────────────────────────────────────────────
let _ctx: AudioContext | null = null;
let _masterGain: GainNode | null = null;
let _sfxGain:    GainNode | null = null;
let _musicGain:  GainNode | null = null;
let _musicTimer: ReturnType<typeof setTimeout> | null = null;
let _musicStep    = 0;
let _currentTheme: MusicTheme = "none";
let _sfxOn   = true;
let _musicOn = true;

function ac(): AudioContext | null {
  if (Platform.OS !== "web") return null;
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try {
      const W = window as any;
      const Ctx = W.AudioContext || W.webkitAudioContext;
      if (!Ctx) return null;
      _ctx        = new Ctx();
      _masterGain = _ctx.createGain(); _masterGain.gain.value = 1;
      _masterGain.connect(_ctx.destination);
      _sfxGain    = _ctx.createGain(); _sfxGain.gain.value = 0.55;
      _sfxGain.connect(_masterGain);
      _musicGain  = _ctx.createGain(); _musicGain.gain.value = 0.2;
      _musicGain.connect(_masterGain);
    } catch { return null; }
  }
  if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
  return _ctx;
}

// ── Low-level primitives ──────────────────────────────────────────────────────
function tone(
  c: AudioContext, g: GainNode,
  f1: number, f2: number, dur: number, vol: number,
  wave: OscillatorType = "sine", delay = 0,
) {
  const osc = c.createOscillator();
  const env = c.createGain();
  const t   = c.currentTime + delay;
  osc.type = wave;
  osc.frequency.setValueAtTime(f1, t);
  if (f2 !== f1 && f2 > 0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur * 0.85);
  env.gain.setValueAtTime(0.001, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(env); env.connect(g);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function noiseBurst(c: AudioContext, g: GainNode, vol: number, dur: number, hpf = 0, delay = 0) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const env = c.createGain();
  const t   = c.currentTime + delay;
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  if (hpf > 0) {
    const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hpf;
    src.connect(f); f.connect(env);
  } else { src.connect(env); }
  env.connect(g); src.start(t); src.stop(t + dur + 0.02);
}

// ── Sound effects library ─────────────────────────────────────────────────────
export function playSound(type: SoundType) {
  if (!_sfxOn) return;
  const c = ac(); if (!c || !_sfxGain) return;
  const g = _sfxGain;

  switch (type) {
    case "punch":
      noiseBurst(c, g, 0.45, 0.08, 900);
      tone(c, g, 220, 45, 0.09, 0.55, "sawtooth");
      break;

    case "smash":
      noiseBurst(c, g, 0.8, 0.22, 80);
      tone(c, g, 110, 22, 0.28, 0.85, "sawtooth");
      tone(c, g, 60,  28, 0.32, 0.55, "sine");
      break;

    case "blast":
      noiseBurst(c, g, 0.55, 0.42, 180);
      tone(c, g, 180, 1400, 0.38, 0.45, "sine");
      tone(c, g, 440, 55,  0.52, 0.35, "sawtooth");
      tone(c, g, 880, 220, 0.25, 0.25, "triangle", 0.1);
      break;

    case "block":
      tone(c, g, 900, 600, 0.1, 0.55, "square");
      noiseBurst(c, g, 0.3, 0.09, 1200);
      break;

    case "victory":
      ([0, 0.13, 0.26, 0.39, 0.52] as const).forEach((t, i) => {
        const f = [261.63, 329.63, 392, 523.25, 659.25][i];
        tone(c, g, f, f, 0.35, 0.28, "sine", t);
      });
      break;

    case "defeat":
      ([0, 0.28, 0.56] as const).forEach((t, i) => {
        const f = [329.63, 261.63, 196][i];
        tone(c, g, f, f * 0.88, 0.44, 0.26, "sine", t);
      });
      break;

    case "coin":
      tone(c, g, 880, 1760, 0.16, 0.38, "sine");
      tone(c, g, 1320, 2200, 0.1, 0.2, "triangle", 0.05);
      break;

    case "crash":
      noiseBurst(c, g, 0.9, 0.32, 50);
      tone(c, g, 80, 18, 0.38, 0.75, "sawtooth");
      break;

    case "shoot":
      tone(c, g, 700, 90, 0.14, 0.32, "sawtooth");
      break;

    case "explode":
      noiseBurst(c, g, 0.65, 0.38, 100);
      tone(c, g, 160, 22, 0.42, 0.55, "square");
      break;

    case "cardDeal":
      noiseBurst(c, g, 0.22, 0.07, 2500);
      tone(c, g, 320, 200, 0.07, 0.15, "sine");
      break;

    case "cardFlip":
      noiseBurst(c, g, 0.18, 0.055, 3200);
      break;

    case "win":
      ([0, 0.11, 0.22, 0.33] as const).forEach((t, i) => {
        const f = [392, 523.25, 659.25, 783.99][i];
        tone(c, g, f, f, 0.28, 0.26, "sine", t);
      });
      break;

    case "lose":
      tone(c, g, 220, 110, 0.42, 0.32, "sine");
      break;

    case "levelUp":
      ([0, 0.09, 0.18, 0.27, 0.36] as const).forEach((t, i) => {
        const f = [261.63, 329.63, 392, 523.25, 659.25][i];
        tone(c, g, f, f, 0.2, 0.22, "triangle", t);
      });
      break;

    case "enemyHit":
      tone(c, g, 155, 55, 0.18, 0.48, "square");
      noiseBurst(c, g, 0.28, 0.12, 350);
      break;

    case "click":
      tone(c, g, 480, 380, 0.055, 0.22, "sine");
      break;

    case "combo":
      tone(c, g, 660, 990, 0.12, 0.32, "triangle");
      break;

    case "rage":
      noiseBurst(c, g, 0.45, 0.18, 150);
      tone(c, g, 120, 80, 0.22, 0.55, "sawtooth");
      break;
  }
}

// ── Music sequencer ───────────────────────────────────────────────────────────
// Each beat: [frequency_hz (0=rest), duration_ms]
type Beat = [number, number];

const MUSIC: Record<MusicTheme, Beat[]> = {
  battle: [
    [164.81,220],[0,50],[164.81,170],[0,50],[196,230],[0,50],[220,330],[0,90],
    [196,190],[0,50],[174.61,190],[0,50],[164.81,430],[0,180],
    [130.81,230],[0,90],[146.83,230],[164.81,490],[0,180],
  ],
  racing: [
    [261.63,105],[329.63,105],[392,105],[523.25,210],[0,55],
    [523.25,105],[392,105],[329.63,105],[392,210],[0,75],
    [293.66,105],[349.23,105],[440,210],[0,115],
  ],
  space: [
    [220,430],[0,180],[261.63,310],[0,120],[329.63,430],[0,170],
    [293.66,360],[0,240],[220,560],[0,290],
  ],
  casino: [
    [261.63,185],[329.63,185],[392,185],[493.88,370],[0,95],
    [440,185],[392,185],[0,75],[349.23,185],[440,370],[0,185],
  ],
  dungeon: [
    [110,680],[0,290],[123.47,570],[0,370],[110,720],[0,270],
    [98,830],[0,520],
  ],
  none: [],
};

function scheduleNext() {
  if (!_musicOn || _currentTheme === "none") return;
  const c = ac(); if (!c || !_musicGain) return;
  const seq = MUSIC[_currentTheme];
  if (!seq || seq.length === 0) return;
  const [freq, dur] = seq[_musicStep % seq.length];
  _musicStep++;
  if (freq > 0) tone(c, _musicGain, freq, freq, (dur / 1000) * 0.82, 0.11, "triangle");
  _musicTimer = setTimeout(scheduleNext, dur);
}

export function startMusic(theme: MusicTheme) {
  if (theme === _currentTheme && _musicTimer !== null) return;
  stopMusic();
  _currentTheme = theme;
  _musicStep    = 0;
  scheduleNext();
}

export function stopMusic() {
  if (_musicTimer !== null) { clearTimeout(_musicTimer); _musicTimer = null; }
  _currentTheme = "none";
}

export function setMusicEnabled(v: boolean) { _musicOn = v; if (!v) stopMusic(); }
export function setSfxEnabled(v: boolean)   { _sfxOn = v; }
export function getMusicEnabled()            { return _musicOn; }
export function getSfxEnabled()              { return _sfxOn; }
