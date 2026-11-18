// Invert flash: a small push in, and on the cut the whole frame is inverted for exactly two frames, last frame of
// the old scene and first of the new. For a hard beat in a hype film. Flash-safe: a single inversion, one frame-pair,
// once; never repeat it within a second of itself.
// After the invert cuts of Leonxlnx/cinetic and gl-transitions (MIT), rebuilt here with a backdrop filter; no code copied.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { smear, useTravel } from '../moves/core';
import { useSwap } from './optics-shared';

/** The scene grows by this much in all, split between the two sides. */
const PUSH = 0.1;

/**
 * The children are the outgoing scene; `next` is the incoming, its own clock starting at 0 on the cut. From `at` the
 * outgoing scene pushes in, speeding up, for a `quick` length; on the cut the incoming scene is already moving the
 * same way and settles. On the last frame before the cut and the first frame after it, everything (the page too) is
 * inverted, lightness flipped and hue kept. That is two frames: one flash.
 */
export const InvertFlash: FC<{ children: ReactNode; next: ReactNode; at: number }> = ({ children, next, at }) => {
  const s = useSwap(at, { hard: true });
  const travel = useTravel();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const grow = Math.log(1 + PUSH);
  const out = (t: number) => grow * s.share * s.outward(t);
  const inn = (t: number) => -grow * (1 - s.share) * s.inward(t);
  const soft = (place: (t: number) => number) => {
    const blur = smear(travel(place) * (height / 2), width);
    return blur > 0 ? `blur(${blur}px)` : undefined;
  };
  const inverted = frame === s.joinOn - 1 || frame === s.joinOn;
  return (
    <>
      {s.showOut ? <AbsoluteFill style={{ scale: `${Math.exp(out(s.t))}`, filter: soft(out) }}>{children}</AbsoluteFill> : null}
      {s.showIn ? (
        <AbsoluteFill style={{ scale: `${Math.exp(inn(s.t))}`, filter: soft(inn) }}>
          <Sequence from={s.joinOn} layout="none">
            {next}
          </Sequence>
        </AbsoluteFill>
      ) : null}
      {inverted ? <AbsoluteFill style={{ backdropFilter: 'invert(1) hue-rotate(180deg)' }} /> : null}
    </>
  );
};
