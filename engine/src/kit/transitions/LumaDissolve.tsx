// Luma dissolve: the next scene appears through soft-edged patches that spread like ink in water, following a
// cloud of noise whose threshold moves. For a gentle change of mood or time ("later that day").
// After gl-transitions "luma" by gre (MIT): a threshold sweeping through a grey map, here a seeded SVG noise.
import { useId, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { easing, lerp, progress, useMotion } from '../motion';

/** Patches are about this share of the frame's shorter side across. */
const PATCH = 0.2;
/** The soft edge of a patch, in noise values (0 to 1): wider is softer. */
const SOFT = 0.07;
/**
 * The threshold sweeps through the values where this noise mostly lies (measured by eye on renders: patches
 * first show near 0.8 and the frame is nearly all turned by 0.42) over most of the move, then runs on to below
 * zero in the last share, so every pixel has turned by the last frame and nothing is cut.
 */
const SWEEP = { from: 0.8, to: 0.42, last: 0.18 } as const;
/** Both scenes drift this much in scale through the move: the outgoing grows, the incoming settles. */
const DRIFT = 0.03;

/**
 * Noise turned into a mask: where the noise is above `threshold` the layer shows, below it the layer is clear,
 * with a soft edge. `invert` gives the other side, so two layers with the same seed fit together exactly.
 */
const NoiseMask: FC<{ id: string; seed: number; threshold: number; invert: boolean; frequency: number }> = ({ id, seed, threshold, invert, frequency }) => {
  // alpha = (noise - threshold) / SOFT, clamped; inverted: (threshold - noise) / SOFT.
  const k = (invert ? -1 : 1) / SOFT;
  const b = (invert ? threshold : -threshold) / SOFT + 0.5;
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }}>
      <filter id={id} x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={3} seed={seed} stitchTiles="noStitch" result="noise" />
        <feColorMatrix in="noise" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${k} 0 0 0 ${b}`} result="mask" />
        <feComposite in="SourceGraphic" in2="mask" operator="in" />
      </filter>
    </svg>
  );
};

/**
 * The children are the outgoing scene; `next` is the incoming, with its clock starting at 0 on `at`. From `at`,
 * over a `scene` and a `base` length (about 1.15 s), a threshold sweeps through a fixed cloud of noise (`seed`
 * picks the cloud): the next scene shows wherever the noise is above it, so it arrives in soft patches that grow
 * and join. The outgoing scene is cut by the same cloud the other way, so the two never sit on top of each other
 * except in the soft edge. Both scenes keep moving: the outgoing grows slightly, the incoming settles from slightly
 * larger. Patch size follows the frame's shorter side, so every size of frame looks the same.
 */
export const LumaDissolve: FC<{ children: ReactNode; next: ReactNode; at: number; seed?: number }> = ({ children, next, at, seed = 7 }) => {
  const m = useMotion();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const id = `luma${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const length = m.seconds('scene') + m.seconds('base');
  const startsOn = Math.round(at * fps);
  const endsOn = Math.round((at + length) * fps);
  const p = progress(m.t, at, at + length, easing.travel);
  const settle = progress(m.t, at, at + length + m.seconds('base'), easing.arrive);
  const incoming = (
    <Sequence from={startsOn} layout="none">
      <AbsoluteFill style={{ scale: `${1 + DRIFT * (1 - settle)}` }}>{next}</AbsoluteFill>
    </Sequence>
  );
  if (frame < startsOn) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (frame >= endsOn) return <AbsoluteFill>{incoming}</AbsoluteFill>;

  const main = progress(m.t, at, at + length * (1 - SWEEP.last), easing.travel);
  const tail = progress(m.t, at + length * (1 - SWEEP.last), at + length, (x) => x);
  const threshold = lerp(SWEEP.from, SWEEP.to, main) - (SWEEP.to + SOFT) * tail;
  const frequency = 1 / (PATCH * Math.min(width, height));
  return (
    <AbsoluteFill>
      <NoiseMask id={`${id}a`} seed={seed} threshold={threshold} invert frequency={frequency} />
      <NoiseMask id={`${id}b`} seed={seed} threshold={threshold} invert={false} frequency={frequency} />
      <AbsoluteFill style={{ filter: `url(#${id}a)` }}>
        <AbsoluteFill style={{ scale: `${1 + DRIFT * p}` }}>{children}</AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ filter: `url(#${id}b)` }}>{incoming}</AbsoluteFill>
    </AbsoluteFill>
  );
};
