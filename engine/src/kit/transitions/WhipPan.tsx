// Whip pan: both scenes travel sideways at whip speed, with strong directional blur, and the swap happens at the
// peak of the speed. For a quick change of place in a fast film; the camera never stops between the two.
// After the whip and directional-warp transitions of Leonxlnx/cinetic and gl-transitions (MIT), rebuilt here; no code copied.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { MotionBlur, towards, useTravel, type Side } from '../moves/core';
import { useSwap } from './optics-shared';

/** The whole journey, as a share of the frame's width (or height, going up or down). */
const JOURNEY = 0.95;
/** A whip smears longer than a camera shutter would: the travel is counted this many times for the blur. */
const STREAK = 2.4;

/**
 * The children are the outgoing scene; `next` is the incoming, its own clock starting at 0 as it takes over. From
 * `at` the outgoing scene slides towards `to`, speeding up, for a `quick` length; the next scene is already
 * moving the same way, at the same speed, and slows into place over a `base` length. The two cross over one
 * `tick` at peak speed. Nothing should need reading until the next scene has settled.
 */
export const WhipPan: FC<{ children: ReactNode; next: ReactNode; at: number; to?: Side }> = ({ children, next, at, to = 'left' }) => {
  const s = useSwap(at);
  const travel = useTravel();
  const way = towards[to];
  const along = { x: way.x * s.width * JOURNEY, y: way.y * s.height * JOURNEY };
  const out = (t: number) => s.share * s.outward(t);
  const inn = (t: number) => -(1 - s.share) * s.inward(t);
  const layer = (place: (t: number) => number, opacity: number, content: ReactNode) => (
    <MotionBlur fill x={travel(place) * along.x * STREAK} y={travel(place) * along.y * STREAK} style={{ opacity }}>
      <AbsoluteFill style={{ translate: `${place(s.t) * along.x}px ${place(s.t) * along.y}px` }}>{content}</AbsoluteFill>
    </MotionBlur>
  );
  return (
    <>
      {s.showOut ? layer(out, 1 - s.joined, children) : null}
      {s.showIn
        ? layer(
            inn,
            s.joined,
            <Sequence from={s.joinOn} layout="none">
              {next}
            </Sequence>,
          )
        : null}
    </>
  );
};
