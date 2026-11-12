// Zoom-through swap: the outgoing group shrinks, the next arrives larger and settles. It reads as one pull-back.
// For a full change of content inside one world.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { easing, lerp, progress, useMotion } from '../motion';
import { smear, useTravel } from './core';

/** The outgoing group shrinks to this size. */
const SHRINK = 0.78;
/** The incoming group arrives at this size. */
const ARRIVE = 1.58;

/**
 * The children are the outgoing group; `next` is the incoming, with its own clock starting at 0 as it appears.
 * From `at` the outgoing group shrinks, speeding up, for a `quick` length; the next one is already shrinking
 * when it takes over and slows to its size over a `base` length. Both scale about the middle of the frame.
 *
 * The two are joined while both are moving fast and the same way: one dissolves into the other over a single
 * `tick` centred on the swap, so there is never an empty frame and never a frame where the new group snaps in
 * at rest. Each softens with its speed across the join. Nothing in `next` should need reading until it has
 * settled, so start its own cues a `base` length in.
 */
export const ZoomThroughSwap: FC<{ children: ReactNode; next: ReactNode; at: number }> = ({ children, next, at }) => {
  const m = useMotion();
  const travel = useTravel();
  const { width, height, fps } = useVideoConfig();
  const half = m.seconds('tick') / 2;
  // The incoming group appears on a whole frame, half a tick before the middle of the join.
  const joinOn = Math.round((at + m.seconds('quick') - half) * fps);
  const joinFrom = joinOn / fps;
  const joinTo = joinFrom + half * 2;
  const joined = progress(m.t, joinFrom, joinTo, easing.travel);

  const shrunk = (t: number) => Math.log(lerp(1, SHRINK, progress(t, at, joinTo, easing.leave)));
  const arriving = (t: number) => Math.log(lerp(ARRIVE, 1, progress(t, joinFrom, joinFrom + m.seconds('base'))));
  // How soft a group is while it changes size: its edges move this far in a frame.
  const softness = (size: (t: number) => number) => {
    const soft = smear(travel(size) * (height / 2), width);
    return soft > 0 ? `blur(${soft}px)` : undefined;
  };
  return (
    <>
      {joined < 1 ? (
        <AbsoluteFill style={{ scale: `${Math.exp(shrunk(m.t))}`, opacity: 1 - joined, filter: softness(shrunk) }}>{children}</AbsoluteFill>
      ) : null}
      {m.t >= joinFrom ? (
        <AbsoluteFill style={{ scale: `${Math.exp(arriving(m.t))}`, opacity: joined, filter: softness(arriving) }}>
          <Sequence from={joinOn} layout="none">
            {next}
          </Sequence>
        </AbsoluteFill>
      ) : null}
    </>
  );
};
