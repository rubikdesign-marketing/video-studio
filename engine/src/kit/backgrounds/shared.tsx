// What every background shares: the three energy levels, the film's real clock, the colours of the stage it sits
// on, and a few drawing helpers. A background is the bottom layer inside a <Stage>: it paints the page itself, and
// the Stage lays the brand's vignette and grain over it and over everything else.
// Colours come only from the stage's roles; nothing here names one.
import { useMemo, type CSSProperties, type FC, type ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { clamp01, rng, useRealTime, type Point } from '../motion';
import { alpha } from '../tokens';
import { useStage } from '../ui';

// ---------------------------------------------------------------- energy

export const energyNames = ['rest', 'alive', 'peak'] as const;
export type Energy = (typeof energyNames)[number];

/**
 * How fast a background's clock runs and how far its parts travel. Every background is tuned at "alive": a drift
 * the eye can follow when it looks for it. "rest" is so slow that tools/study/profile.py measures the frame as
 * still, and "peak" is the most a background may move while staying quieter than the content. The figures measured
 * for each background are in library/backgrounds/measured.json.
 */
const levels: Record<Energy, { rate: number; reach: number }> = {
  rest: { rate: 0.2, reach: 0.6 },
  alive: { rate: 1, reach: 1 },
  peak: { rate: 1.6, reach: 1.4 },
};

export type BackgroundProps = {
  /** How much it moves. Set it once per film, or change it on a cut: the clock runs at a different rate at each level. */
  energy?: Energy;
  /** Changes where everything starts, so two films with the same background do not match. */
  seed?: number;
};

/** A moving treatment can also lie over another background: with `over` it leaves out its own page colour. */
export type TreatmentProps = BackgroundProps & { over?: boolean };

const PHASES = 16;

/** The clock, the frame, the stage colours and the slow wander every background is built from. */
export const useBackdrop = (energy: Energy, seed: number) => {
  const now = useRealTime();
  const { width, height } = useVideoConfig();
  const stage = useStage();
  const phases = useMemo(() => {
    const random = rng(seed);
    return Array.from({ length: PHASES }, () => random() * Math.PI * 2);
  }, [seed]);
  const { rate, reach } = levels[energy];
  const t = now * rate;
  const phase = (i: number) => phases[i % PHASES];
  // Two sines that never line up, so the path does not visibly repeat: at "alive" one turns every 33 seconds and
  // the other every 20, and at "peak" every 21 and 13. Between -1 and 1.
  const sway = (i: number, speed = 1) => (Math.sin(t * 0.19 * speed + phase(i)) + 0.4 * Math.sin(t * 0.31 * speed + phase(i + 5))) / 1.4;
  const vh = (percent: number) => (height * percent) / 100;
  // The page is the darker of page and ink on a dark stage, and that is what the stage calls its shade.
  const dark = stage.shade === stage.page;
  return {
    /** Seconds on the film's real clock, scaled by the energy. Never a scene's own clock. */
    t,
    /** How far things travel at this energy, as a multiplier. */
    reach,
    width,
    height,
    vh,
    stage,
    dark,
    /** The lightest colour the brand has: the ink of its dark page. For light itself. */
    bright: dark ? stage.ink : stage.onInk,
    /** The line colour, nearer the ink on a light page so that a thin line survives video compression and a half-size render. */
    rule: dark ? stage.line : mix(stage.line, stage.ink, 0.14),
    /** The width of a thin edge drawn with a box: one whole pixel at 1080, two at 2160. */
    hair: Math.max(1, Math.round(height / 1080)),
    /** The width of a thin drawn line: a pixel and a half at 1080, so it is still there when the film is shown at half size. */
    thin: height / 720,
    /** A fixed angle for the thing numbered `i`, set by the seed. */
    phase,
    /** A slow wander between -1 and 1 for the thing numbered `i`. */
    sway,
    /** The same wander in pixels: `percent` of frame height at "alive", less at "rest", more at "peak". */
    drift: (i: number, percent: number, speed = 1) => sway(i, speed) * reach * vh(percent),
    /**
     * Steady one-way travel for the thing numbered `i`: a place between 0 and `span` that moves on by `speed` each
     * second and starts again from 0 when it gets there. For anything that moves along one line, such as a band of
     * light: a wander there would go and come back over the same ground, which reads as a loop.
     */
    travel: (i: number, speed: number, span: number) => (((t * speed + (phase(i) / (Math.PI * 2)) * span) % span) + span) % span,
  };
};
export type Backdrop = ReturnType<typeof useBackdrop>;

// ---------------------------------------------------------------- layers

/** The bottom layer: a page colour (left out when the background lies over another) and gradient layers, top one first. */
export const Fill: FC<{ colour?: string; layers?: string[]; children?: ReactNode }> = ({ colour, layers = [], children }) => (
  <AbsoluteFill style={{ backgroundColor: colour, backgroundImage: layers.join(', ') || undefined, overflow: 'hidden', pointerEvents: 'none' }}>
    {children}
  </AbsoluteFill>
);

/** A length in pixels for a CSS string, kept to a hundredth so slow movement stays smooth. */
export const px = (n: number) => `${Math.round(n * 100) / 100}px`;

/** How a soft edge falls away: a cosine, sampled often enough that no ring shows. Share of the radius, then strength. */
const FALLOFF: [number, number][] = Array.from({ length: 11 }, (_, i) => [i / 10, Math.round(500 * (1 + Math.cos((Math.PI * i) / 10))) / 1000]);

/** A soft pool of one colour as a gradient layer, centred on (x, y) pixels and gone at `rx` (and `ry`) pixels. */
export const pool = (colour: string, opacity: number, x: number, y: number, rx: number, ry = rx) => {
  const stops = FALLOFF.map(([at, strength]) => `${alpha(colour, opacity * strength)} ${at * 100}%`);
  return `radial-gradient(${px(rx)} ${px(ry)} at ${px(x)} ${px(y)}, ${stops.join(', ')})`;
};

/**
 * The opposite of a pool, for the shade around a light: nothing within `from` pixels of (x, y), rising smoothly
 * to `opacity` at `to` pixels and staying there beyond.
 */
export const surround = (colour: string, opacity: number, x: number, y: number, from: number, to: number) => {
  const stops = [...FALLOFF].reverse().map(([at, strength]) => `${alpha(colour, opacity * strength)} ${px(from + (to - from) * (1 - at))}`);
  return `radial-gradient(circle at ${px(x)} ${px(y)}, ${stops.join(', ')})`;
};

/**
 * A soft straight band of light as a gradient layer. `angle` is in degrees; `centre` and `half` are where the band
 * sits and its half width, as percentages of the way across the frame.
 */
export const band = (colour: string, opacity: number, angle: number, centre: number, half: number) => {
  const side = (sign: number) => FALLOFF.map(([at, strength]) => `${alpha(colour, opacity * strength)} ${Math.round((centre + sign * at * half) * 100) / 100}%`);
  return `linear-gradient(${angle}deg, ${[...side(-1).reverse(), ...side(1).slice(1)].join(', ')})`;
};

/**
 * A mask that shows a layer in full at the edges of the frame and at `keep` of its strength in the middle, where
 * the content sits. Give it the stage's page colour: a mask needs a solid colour, and any will do.
 */
export const quietCentre = (solid: string, keep = 0.25): CSSProperties => {
  const image = `radial-gradient(50% 55% at 50% 50%, ${alpha(solid, keep)} 0%, ${alpha(solid, keep)} 40%, ${solid} 100%)`;
  return { maskImage: image, WebkitMaskImage: image };
};

/** A smooth open curve through `points`, as an SVG path. */
export const smoothPath = (points: Point[]) => {
  const at = ({ x, y }: Point) => `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`;
  const curves = points.slice(1, -1).map((p, i) => {
    const next = points[i + 2];
    return `Q${at(p)} ${at({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 })}`;
  });
  return `M${at(points[0])} ${curves.join(' ')} L${at(points[points.length - 1])}`;
};

// ---------------------------------------------------------------- colour

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toScreen = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** A colour in Oklab, a space where a blend between two colours looks even to the eye. Any opacity is dropped. */
const toLab = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

/**
 * Two brand colours blended, `share` of the way from `a` to `b`, as a solid colour. The blend runs through a
 * perceptual space so the midpoint is not muddy (knowledge/craft/06-light-and-finish.md).
 */
export const mix = (a: string, b: string, share: number) => {
  const to = toLab(b);
  const [L, A, B] = toLab(a).map((v, i) => v + (to[i] - v) * share);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb.map((c) => Math.round(clamp01(toScreen(clamp01(c))) * 255).toString(16).padStart(2, '0')).join('')}`;
};
