// Zoom blur: a radial zoom blur rushes into the centre of the frame and out of it on the next scene. For a hype
// change, or when the next thing is the thing to see.
// After the zoom and radial transitions of Leonxlnx/cinetic and gl-transitions (MIT), rebuilt here as a trail of
// scaled copies with falling opacity; no code copied.
import type { FC, ReactNode } from 'react';
import { Sequence } from 'remotion';
import { useTravel } from '../moves/core';
import { copies, useSwap } from './optics-shared';

/** The whole journey in size: the frame grows to this many times over the move (the next scene starts well below 1). */
const REACH = 2.8;
/** The trail is this many times longer than one frame's travel. */
const STREAK = 2.2;
/** One copy for each of this much growth (log scale): about 10 px apart at the edge of a full-HD frame. */
const STEP = 0.01;
const MOST = 26;

/**
 * The children are the outgoing scene; `next` is the incoming, its own clock starting at 0 as it takes over. From
 * `at` the outgoing scene rushes towards the camera, speeding up, for a `quick` length, smeared outwards from the
 * centre; the next scene is already rushing the same way, from small, and settles at its own size over a `base`
 * length. They cross over one `tick` at peak speed.
 */
export const ZoomBlur: FC<{ children: ReactNode; next: ReactNode; at: number }> = ({ children, next, at }) => {
  const s = useSwap(at);
  const travel = useTravel();
  const reach = Math.log(REACH);
  const out = (t: number) => reach * s.share * s.outward(t);
  const inn = (t: number) => -reach * (1 - s.share) * s.inward(t);
  const layer = (place: (t: number) => number, content: ReactNode) => {
    const sweep = Math.abs(travel(place)) * STREAK;
    const count = sweep < STEP / 2 ? 1 : Math.min(MOST, Math.ceil(sweep / STEP) + 1);
    // The first copy is where the layer is now; the others trail behind it in time.
    return copies(content, count, (u) => ({ scale: `${Math.exp(place(s.t - (u * STREAK) / s.fps))}` }), true);
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
