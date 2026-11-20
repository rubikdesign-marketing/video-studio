// Sticker pop: a small creator-style reaction that pops onto the frame, wobbles and goes. The shapes are drawn here
// from paths (a heart, a star, a tick in a disc, a sparkle, a starburst): original line work, not an emoji font and
// not an image. A white outline and a soft shadow make it read as a sticker. A few specks fly off on landing; their
// directions come from a seeded random generator, so the same frame always renders the same.
// Plain 2D (SVG and HTML): no WebGL.
import type { CSSProperties, FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, lerp, progress, rng, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { lightOf } from '../moves/core';

export const stickerShapes = ['heart', 'star', 'tick', 'spark', 'burst'] as const;
export type StickerShape = (typeof stickerShapes)[number];

export type StickerPopProps = {
  shape?: StickerShape;
  /** Seconds on the scene clock when it pops. */
  at?: number;
  /** Seconds when it leaves. Leave out to hold to the end of the scene. */
  out?: number;
  /** Where its middle sits, as shares of the frame (0..1). */
  x?: number;
  y?: number;
  /** Its width as a per cent of the frame's SHORT side (default 18). */
  size?: number;
  /** Tilt in degrees (default -9). It wobbles a few degrees around this. */
  rotate?: number;
  /** The fill: "accent" or "warm" (the brand's), "ink", or any six-digit colour. Default "accent". */
  colour?: string;
  /** The sticker's outline; the brand's light ink by default. */
  outline?: string;
  /** The tick's mark colour inside a disc; the brand's colour on the accent by default. */
  mark?: string;
  /** Specks flying off on landing (0..12, default 7). */
  specks?: number;
  /** Seed of the specks' directions. */
  seed?: number;
  style?: CSSProperties;
};

const point = (cx: number, cy: number, r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`;
/** A star-shaped path in a 24 unit box with `points` tips between an inner and an outer radius. */
const starPath = (points: number, inner: number, outer: number) => {
  const steps = points * 2;
  const pts = Array.from({ length: steps }, (_, i) => point(12, 12, i % 2 === 0 ? outer : inner, -Math.PI / 2 + (i * Math.PI) / points));
  return `M${pts.join("L")}Z`;
};

const PATHS: Record<StickerShape, string> = {
  heart: 'M12 21.4S2.6 15.6 1.4 9.4C.7 5.8 3 2.8 6.4 2.8c2.1 0 3.9 1.1 5.6 3.4 1.7-2.3 3.5-3.4 5.6-3.4 3.4 0 5.7 3 5 6.6-1.2 6.2-10.6 12-10.6 12z',
  star: starPath(5, 5.1, 11.2),
  spark: 'M12 .8C12.9 7.8 16.2 11.1 23.2 12 16.2 12.9 12.9 16.2 12 23.2 11.1 16.2 7.8 12.9.8 12 7.8 11.1 11.1 7.8 12 .8Z',
  burst: starPath(12, 8.6, 11.4),
  tick: 'M12 1.2a10.8 10.8 0 1 0 0 21.6 10.8 10.8 0 0 0 0-21.6Z',
};

export const StickerPop: FC<StickerPopProps> = ({ shape = 'heart', at = 0, out, x = 0.78, y = 0.3, size = 18, rotate = -9, colour = 'accent', outline, mark, specks = 7, seed = 7, style }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const { width, height } = useVideoConfig();
  const short = Math.min(width, height);
  const d = (short * size) / 100;
  const fill = colour === 'accent' ? stage.accent : colour === 'warm' ? stage.warm : colour === 'ink' ? stage.ink : colour;
  const edge = outline ?? lightOf(brand);
  const inside = mark ?? stage.onAccent;
  if (m.t < at - 1e-6) return null;
  const land = m.pop(at, 'scene');
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  if (exit >= 1) return null;
  const since = Math.max(0, m.t - at);
  const wobble = Math.sin(since * 7.5) * 4 * Math.exp(-since * 2.2);
  const scale = Math.max(0, land) * (1 - 0.35 * exit);
  const random = rng(seed);
  const flecks = Array.from({ length: Math.round(Math.min(12, Math.max(0, specks))) }, (_, i) => {
    const angle = ((i + random() * 0.6) / Math.max(1, specks)) * Math.PI * 2;
    const reach = d * lerp(0.62, 0.98, random());
    const grow = progress(m.t, at + 0.04, at + 0.5, easing.arrive);
    return { angle, reach, grow, r: d * lerp(0.028, 0.055, random()) };
  });
  const fade = 1 - progress(m.t, at + 0.2, at + 0.55, easing.leave);
  return (
    <div style={{ position: 'absolute', left: width * x - d / 2, top: height * y - d / 2, width: d, height: d, opacity: 1 - exit, translate: `0 ${-exit * d * 0.2}px`, ...style }}>
      <svg width={d} height={d} viewBox="0 0 24 24" style={{ overflow: 'visible', scale: `${scale}`, rotate: `${rotate + wobble}deg`, filter: `drop-shadow(0 ${d * 0.05}px ${d * 0.09}px ${alpha(stage.shade, 0.5)})` }}>
        <path d={PATHS[shape]} fill={edge} stroke={edge} strokeWidth={2.8} strokeLinejoin="round" />
        <path d={PATHS[shape]} fill={fill} stroke={fill} strokeWidth={0.4} strokeLinejoin="round" />
        {shape === 'tick' ? <path d="M7 12.4l3.3 3.3L17 8.9" fill="none" stroke={inside} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {shape === 'heart' ? <path d="M6.2 7.4c.5-1.3 1.7-2 3-1.8" fill="none" stroke={alpha(edge, 0.7)} strokeWidth={1.1} strokeLinecap="round" /> : null}
      </svg>
      {flecks.map((f, i) => (
        <span key={i} style={{ position: 'absolute', left: d / 2 + Math.cos(f.angle) * f.reach * f.grow - f.r, top: d / 2 + Math.sin(f.angle) * f.reach * f.grow - f.r, width: f.r * 2, height: f.r * 2, borderRadius: '50%', background: i % 2 === 0 ? fill : edge, opacity: fade * (1 - exit) }} />
      ))}
    </div>
  );
};
