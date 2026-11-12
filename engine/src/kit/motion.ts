// Motion tokens and helpers (knowledge/craft/02-motion.md).
// Time is in seconds and every helper is a pure function of it, so any frame renders on its own.
import { createContext, createElement, useContext, type ReactNode } from 'react';
import { Easing, spring, useCurrentFrame, useVideoConfig, type SpringConfig } from 'remotion';

// ---------------------------------------------------------------- tokens

/** Lengths in milliseconds: the middle of each range in the craft file. Presets scale them. */
export const timing = { tick: 100, quick: 210, base: 400, scene: 750, hero: 1600 } as const;
export type TimingToken = keyof typeof timing;

export const msToFrames = (ms: number, fps: number) => Math.max(1, Math.round((ms / 1000) * fps));

export type Ease = (x: number) => number;

export const easing = {
  /** Fast in, long soft landing. Anything entering or settling. */
  arrive: Easing.bezier(0.22, 1, 0.36, 1),
  /** Even in and out. Camera moves, things crossing the frame. */
  travel: Easing.bezier(0.4, 0, 0.2, 1),
  /** Speeds up and goes. Exits. */
  leave: Easing.bezier(0.4, 0, 1, 1),
} satisfies Record<string, Ease>;

/** An exit lasts this share of the matching entry (60-70%). */
export const EXIT_SHARE = 0.65;

export type Preset = {
  /** Multiplier on every timing token. */
  length: number;
  /** How far `settle` springs overshoot, as a share of the move. */
  overshoot: number;
  /** Delay between items of a group, in milliseconds. */
  staggerMs: number;
  /** Camera drift through one shot, as a share of the frame. */
  drift: number;
};

export const presetNames = ['calm', 'confident', 'hype'] as const;
export type PresetName = (typeof presetNames)[number];

/** Energy presets. Where the craft file gives a range, this is a value inside it. */
export const presets: Record<PresetName, Preset> = {
  calm: { length: 1.25, overshoot: 0, staggerMs: 60, drift: 0.025 },
  confident: { length: 1, overshoot: 0.025, staggerMs: 45, drift: 0.04 },
  hype: { length: 0.85, overshoot: 0.045, staggerMs: 30, drift: 0.065 },
};

/** Damping ratio whose step response overshoots by this share (0 gives no overshoot). */
const dampingRatio = (overshoot: number) =>
  overshoot <= 0 ? 1 : -Math.log(overshoot) / Math.hypot(Math.PI, Math.log(overshoot));

/** Remotion spring settings for a damping ratio (mass 1, stiffness 100, so damping is 20 x the ratio). */
const springConfig = (ratio: number): SpringConfig => ({ mass: 1, stiffness: 100, damping: 20 * ratio, overshootClamping: false });

export const springs = {
  /** A small overshoot sized by the preset: damping ratio 0.7 (hype) to 1 (calm). Position and scale only, never opacity. */
  settle: (preset: Preset) => springConfig(dampingRatio(preset.overshoot)),
  /** Playful bounce, damping ratio 0.55. At most four times in a film. */
  pop: () => springConfig(0.55),
};

// ---------------------------------------------------------------- helpers

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Progress 0..1 of a move that runs from `from` to `to` seconds. */
export const progress = (t: number, from: number, to: number, ease: Ease = easing.arrive) => {
  if (to <= from) return t >= from ? 1 : 0;
  return ease(clamp01((t - from) / (to - from)));
};

export type Point = { x: number; y: number };

/**
 * A point on an arc from `a` to `b` at progress `u`. The arc bows out sideways by `bend` x the distance
 * (the sign picks the side). Cursors and flying objects travel on these, never on straight lines.
 */
export const arc = (a: Point, b: Point, u: number, bend = 0.16): Point => {
  // Quadratic bezier. Its control point sits twice the bow away from the midpoint, at right angles to the path.
  const cx = (a.x + b.x) / 2 - (b.y - a.y) * bend * 2;
  const cy = (a.y + b.y) / 2 + (b.x - a.x) * bend * 2;
  const v = 1 - u;
  return { x: v * v * a.x + 2 * v * u * cx + u * u * b.x, y: v * v * a.y + 2 * v * u * cy + u * u * b.y };
};

/** Seeded random numbers 0..1 (mulberry32) for anything that should look random but render the same every time. */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---------------------------------------------------------------- preset and clock

type FilmMotion = { preset: PresetName; now: number };
const MotionContext = createContext<FilmMotion | null>(null);

/**
 * Wrap each composition in this once, outside any <Sequence>. It sets the energy preset for everything inside
 * and starts the film's real-time clock.
 */
export const MotionProvider = ({ preset, children }: { preset: PresetName; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return createElement(MotionContext.Provider, { value: { preset, now: frame / fps } }, children);
};

const useFilmMotion = () => {
  const film = useContext(MotionContext);
  if (!film) throw new Error('Wrap the composition in <MotionProvider preset="...">.');
  return film;
};

/** Real seconds since the film began. Stages, grain and captions run on this, never on a scene's own clock. */
export const useRealTime = () => useFilmMotion().now;

/** The local clock plus the timing tokens, stagger and springs, all scaled by the active preset. */
export const useMotion = () => {
  const preset = presets[useFilmMotion().preset];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ms = (token: TimingToken) => timing[token] * preset.length;
  const springFrom = (config: SpringConfig) => (at: number, token: TimingToken = 'base') =>
    spring({ frame: (t - at) * fps, fps, config, durationInFrames: msToFrames(ms(token), fps) });
  return {
    /** Seconds on the local clock: the enclosing <Sequence>, or the film. */
    t,
    preset,
    /** Length of a timing token in seconds. */
    seconds: (token: TimingToken) => ms(token) / 1000,
    /** Length of a timing token in frames at the composition fps. */
    frames: (token: TimingToken) => msToFrames(ms(token), fps),
    /** Delay between items of a group, in seconds. */
    stagger: preset.staggerMs / 1000,
    /** 0 to 1 from `at` seconds with the preset's small overshoot. Position and scale only. */
    settle: springFrom(springs.settle(preset)),
    /** 0 to 1 from `at` seconds with a playful bounce. */
    pop: springFrom(springs.pop()),
  };
};
