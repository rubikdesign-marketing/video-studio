// What the optical and camera transitions share: one clock for "leave, swap, arrive" in which both sides move the
// same way at the same speed on the swap, and a way to draw a moving layer as a trail of copies (rotational and
// radial blur, which no single blur filter gives). Everything is a pure function of the scene clock.
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { easing, progress, useMotion, type TimingToken } from '../motion';

/** The slope of `easing.leave` on its last frame and of `easing.arrive` on its first, as multiples of an even pace. */
const SLOPE_OUT = 1 / 0.6;
const SLOPE_IN = 1 / 0.22;

export const fill: CSSProperties = { position: 'absolute', inset: 0 };

/**
 * The clock of a swap. The outgoing scene leaves from `at`, speeding up, for the `out` length; the incoming scene
 * arrives and slows to rest over the `in` length. They overlap for one `tick` centred on the swap (a `hard` swap
 * has no overlap: one frame the old scene, the next the new), so the frame is never empty.
 *
 * `outward(t)` goes 0 to 1 on the way out; `inward(t)` goes 1 to 0 on the way in. `share` is how much of the whole
 * journey (a distance, an angle, a log-scale) the outgoing scene covers: the rest is the incoming scene's, and the
 * split is the one that gives both the same speed on the swap. `lead` stops the outgoing scene that many frames
 * before the swap (for a match, which must hold still for one frame).
 */
export const useSwap = (at: number, options: { out?: TimingToken; in?: TimingToken; hard?: boolean; lead?: number } = {}) => {
  const m = useMotion();
  const { fps, width, height } = useVideoConfig();
  const outLen = m.seconds(options.out ?? 'quick');
  const inLen = m.seconds(options.in ?? 'base');
  const half = options.hard ? 0 : m.seconds('tick') / 2;
  const joinOn = Math.round((at + outLen - half) * fps);
  const joinFrom = joinOn / fps;
  const joinTo = joinFrom + half * 2;
  const outEnd = joinTo - (options.lead ?? 0) / fps;
  const outward = (t: number) => progress(t, at, outEnd, easing.leave);
  const inward = (t: number) => 1 - progress(t, joinFrom, joinFrom + inLen, easing.arrive);
  const ratio = (SLOPE_IN * (outEnd - at)) / (SLOPE_OUT * inLen);
  return {
    m,
    fps,
    width,
    height,
    t: m.t,
    /** The whole frame the incoming scene's clock starts on: wrap `next` in <Sequence from={joinOn}>. */
    joinOn,
    /** The swap, in seconds (the middle of the overlap). */
    swapAt: joinFrom + half,
    joined: progress(m.t, joinFrom, joinTo, easing.travel),
    showOut: m.t < joinTo,
    showIn: m.t >= joinFrom,
    outward,
    inward,
    share: ratio / (1 + ratio),
  };
};

export type Swap = ReturnType<typeof useSwap>;

/**
 * Whatever is inside, drawn `count` times, each copy placed by `styleAt(u)` (u from 0 to 1 across the trail) and
 * weighted so the copies add up to one picture: a smear along rotation or zoom. `falling` makes the copies fade
 * from the first (u = 0) to the last, like a trail. One copy (count 1, or at rest) is drawn plainly and sharp.
 */
export const copies = (children: ReactNode, count: number, styleAt: (u: number) => CSSProperties, falling = false): ReactNode => {
  if (count <= 1) return createElement('div', { style: { ...fill, ...styleAt(0.5) } }, children);
  const raw = Array.from({ length: count }, (_, i) => (falling ? count - i : 1));
  const total = raw.reduce((a, b) => a + b, 0);
  return createElement(
    'div',
    { style: { ...fill, isolation: 'isolate' } },
    raw.map((w, i) =>
      createElement(
        'div',
        { key: i, style: { ...fill, opacity: w / total, mixBlendMode: 'plus-lighter', ...styleAt(i / (count - 1)) } },
        children,
      ),
    ),
  );
};
