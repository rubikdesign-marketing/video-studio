// Spin whip: a quick rotation about the middle of the frame with rotational blur, and the swap at the peak of the
// spin. For a playful or hype change; the next scene comes out of the same turn.
// After the rotate and swirl transitions of Leonxlnx/cinetic and gl-transitions (MIT), rebuilt here as a trail of
// turned copies; no code copied.
import type { FC, ReactNode } from 'react';
import { Sequence } from 'remotion';
import { useTravel } from '../moves/core';
import { copies, useSwap } from './optics-shared';

/** The whole turn, in degrees (clockwise). */
const TURN = 80;
/** The blur spans this many times one frame's turn. */
const STREAK = 1.8;
/** One copy for each of this many degrees of blur: about 17 px apart at the edge of a full-HD frame. */
const STEP = 1;
const MOST = 20;

/**
 * The children are the outgoing scene; `next` is the incoming, its own clock starting at 0 as it takes over. From
 * `at` the outgoing scene turns clockwise, speeding up, for a `quick` length; the next scene is already turning
 * the same way, from a quarter turn back, and settles upright over a `base` length. They cross over one `tick` at
 * peak spin. The blur is only as long as the spin is fast: both ends are sharp.
 */
export const SpinWhip: FC<{ children: ReactNode; next: ReactNode; at: number }> = ({ children, next, at }) => {
  const s = useSwap(at);
  const travel = useTravel();
  const out = (t: number) => TURN * s.share * s.outward(t);
  const inn = (t: number) => -TURN * (1 - s.share) * s.inward(t);
  const layer = (place: (t: number) => number, content: ReactNode) => {
    const sweep = Math.abs(travel(place)) * STREAK;
    const count = sweep < STEP / 2 ? 1 : Math.min(MOST, Math.ceil(sweep / STEP) + 1);
    // The copies are spread evenly across the time the shutter would be open, centred on now.
    return copies(content, count, (u) => ({ rotate: `${place(s.t + (u - 0.5) * (STREAK / s.fps))}deg` }));
  };
  return (
    <>
      {s.showOut ? <div style={{ position: 'absolute', inset: 0, opacity: 1 - s.joined }}>{layer(out, children)}</div> : null}
      {s.showIn ? (
        <div style={{ position: 'absolute', inset: 0, opacity: s.joined }}>
          {layer(
            inn,
            <Sequence from={s.joinOn} layout="none">
              {next}
            </Sequence>,
          )}
        </div>
      ) : null}
    </>
  );
};
