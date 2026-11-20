// Shape morph: one primitive becomes another (a square becomes a line, a circle, a star, a mark). Every outline is
// resampled to the same number of points by arc length, lined up start to start and turning the same way, and the
// points ease across together, so corners stay corners. Carrier and Flood draw through the same outlines.
import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { arc, easing, EXIT_SHARE, lerp, progress, useMotion, type Point } from '../motion';
import { useStage } from '../ui';
import { MotionBlur, useTravel } from './core';
import { alignTo, blend, middleOf, mixFill, outline, pathOf, shift, useSnap, type FillRole, type Shape } from './shape';

/** One state of a morph: the shape it becomes, and from when. */
export type ShapeKey = { at: number; shape: Shape; fill?: FillRole };

/** Where the outline is at time `t`, and how far through the current morph it is. Pure: other moves reuse it. */
export const shapeAt = (keys: ShapeKey[], t: number, length: number, bend = 0) => {
  let i = 0;
  while (i + 1 < keys.length && t >= keys[i + 1].at) i++;
  const here = outline(keys[i].shape);
  if (i === 0) return { points: here, from: 0, to: 0, u: 1 };
  const before = outline(keys[i - 1].shape);
  const [a, b] = [middleOf(before), middleOf(here)];
  // Line the outlines up about their own middles, so a shape that also travels does not twist on the way.
  const local = (pts: Point[], c: Point) => shift(pts, { x: -c.x, y: -c.y });
  const fromLocal = local(before, a);
  const toLocal = alignTo(local(here, b), fromLocal);
  const u = progress(t, keys[i].at, keys[i].at + length, easing.arrive);
  const centre = bend === 0 ? { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) } : arc(a, b, u, bend);
  return { points: shift(blend(fromLocal, toLocal, u), centre), from: i - 1, to: i, u };
};

/**
 * A filled shape that morphs through `keys`. The first key is the shape it arrives as, at its `at`; every later key
 * starts a morph of `length` seconds into its shape (default the `base` length, 350 to 500 ms). Put keys at least a
 * morph apart, with a reading hold of about 0.4 s between them. When the boxes are in different places the shape
 * travels between them on an arc (`bend`, 0 for straight) and blurs along the way only while it is fast. `fill` is
 * a stage colour by role and may change with each key. `out` shrinks it away.
 */
export const ShapeMorph: FC<{
  keys: [ShapeKey, ...ShapeKey[]];
  length?: number;
  bend?: number;
  fill?: FillRole;
  out?: number;
  style?: CSSProperties;
}> = ({ keys, length, bend = 0.16, fill = 'accent', out, style }) => {
  const m = useMotion();
  const stage = useStage();
  const travel = useTravel();
  const { snap } = useSnap();
  const { width, height } = useVideoConfig();
  const morph = length ?? m.seconds('base');
  const now = shapeAt(keys, m.t, morph, bend);
  const centreAt = (t: number) => middleOf(shapeAt(keys, t, morph, bend).points);
  const roleOf = (i: number) => keys[i].fill ?? fill;
  const colour = mixFill(stage, roleOf(now.from), roleOf(now.to), now.u);
  // Arrives from its middle on a snap (no visible bounce), leaves faster than it came.
  const enter = snap(keys[0].at, m.seconds('quick'));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  if (m.t < keys[0].at || exit >= 1) return null;
  const c = middleOf(now.points);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', ...style }}>
      <MotionBlur fill x={travel((t) => centreAt(t).x)} y={travel((t) => centreAt(t).y)}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <path d={pathOf(now.points)} fill={colour} style={{ transformOrigin: `${c.x}px ${c.y}px`, scale: `${enter * (1 - exit * 0.4)}`, opacity: 1 - exit }} />
        </svg>
      </MotionBlur>
    </AbsoluteFill>
  );
};
