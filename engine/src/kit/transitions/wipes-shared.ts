// What the wipes share: the incoming scene on its own clock, a wipe's progress, and the geometry of a side.
// Only the wipes in this folder use it. Nothing here names a colour or a length.
import { createElement, type CSSProperties, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { easing, progress, useMotion, type Ease, type TimingToken } from '../motion';
import type { StageName } from '../tokens';
import { Panel } from '../ui';
import { towards, type Side } from '../moves/core';

/** Where a wipe is at: `u` runs 0 to 1 over a timing token, `started` and `done` say whether it is under way or over. */
export const useWipe = (at: number, token: TimingToken = 'scene', ease: Ease = easing.travel) => {
  const m = useMotion();
  const { width, height, fps } = useVideoConfig();
  const length = m.seconds(token);
  return { m, width, height, fps, length, end: at + length, u: progress(m.t, at, at + length, ease), started: m.t >= at, done: m.t >= at + length };
};

/** The first frame in `from`..`to` (seconds) for which `test` holds, as a frame number; `to` if none does. */
export const firstFrame = (fps: number, from: number, to: number, test: (t: number) => boolean) => {
  const last = Math.round(to * fps);
  for (let f = Math.round(from * fps); f < last; f++) if (test(f / fps)) return f;
  return last;
};

/**
 * The incoming scene. Its clock starts at 0 on frame `from` (a frame number on the outgoing scene's clock). Given
 * a `page` it sits on that page of the brand and everything inside takes that page's colours; without one it
 * shares the stage with the outgoing scene. It fills the frame either way.
 */
export const Incoming: FC<{ next: ReactNode; fromFrame: number; page?: StageName; style?: CSSProperties }> = ({ next, fromFrame, page, style }) => {
  const inside = createElement(Sequence, { from: fromFrame, layout: 'none' }, next);
  if (page) return createElement(Panel, { name: page, style: { position: 'absolute', inset: 0, ...style } }, inside);
  return createElement(AbsoluteFill, { style }, inside);
};

/** The way a side points, turned by `degrees` (clockwise on screen). */
export const direction = (side: Side, degrees = 0) => {
  const way = towards[side];
  const a = (degrees * Math.PI) / 180;
  return { x: way.x * Math.cos(a) - way.y * Math.sin(a), y: way.x * Math.sin(a) + way.y * Math.cos(a) };
};

/** True for a side the frame's width runs along. */
export const isAcross = (side: Side) => side === 'left' || side === 'right';

/**
 * A band that has travelled from `from` to `to` pixels along the way of `side` (measured from the edge it came
 * in at), as a box in the frame. Going right or down the band's start is the left or top edge; going left or up
 * it is the right or bottom.
 */
export const bandBox = (side: Side, from: number, to: number, width: number, height: number): CSSProperties => {
  const [lo, hi] = [Math.min(from, to), Math.max(from, to)];
  switch (side) {
    case 'right':
      return { left: lo, width: hi - lo, top: 0, height };
    case 'left':
      return { left: width - hi, width: hi - lo, top: 0, height };
    case 'down':
      return { top: lo, height: hi - lo, left: 0, width };
    case 'up':
      return { top: height - hi, height: hi - lo, left: 0, width };
  }
};

/** A smooth step from 0 to 1, for the soft edge of a mask. */
export const smooth = (x: number) => x * x * (3 - 2 * x);
