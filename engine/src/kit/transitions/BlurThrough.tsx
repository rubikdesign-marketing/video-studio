// Blur through: the outgoing scene blurs out as the incoming blurs in, and they cross at the peak of the blur, with
// a slight push in. For a soft change of thought inside one world.
// After the blur dissolves of Leonxlnx/cinetic and gl-transitions (MIT), rebuilt here with CSS blur; no code copied.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { useVh } from '../ui';
import { useSwap } from './optics-shared';

/** The blur at the crossing, per cent of frame height. */
const PEAK = 4.2;
/** The scene grows by this much in all, split between the two sides. */
const PUSH = 0.1;

/**
 * The children are the outgoing scene; `next` is the incoming, its own clock starting at 0 as it takes over. From
 * `at` the outgoing scene blurs and grows, speeding up, for a `quick` length; the next one is already as blurred
 * and as large, and sharpens and settles over a `base` length. The two cross over a single `tick` at the peak, so
 * there is never an empty frame. Keep reading text out of both ends: nothing is legible near the crossing.
 */
export const BlurThrough: FC<{ children: ReactNode; next: ReactNode; at: number }> = ({ children, next, at }) => {
  const s = useSwap(at);
  const vh = useVh();
  const grow = Math.log(1 + PUSH);
  const outPose = (p: number) => ({ scale: `${Math.exp(grow * s.share * p)}`, filter: p > 0 ? `blur(${p * vh(PEAK)}px)` : undefined });
  const inPose = (p: number) => ({ scale: `${Math.exp(-grow * (1 - s.share) * p)}`, filter: p > 0 ? `blur(${p * vh(PEAK)}px)` : undefined });
  return (
    <>
      {s.showOut ? <AbsoluteFill style={{ opacity: 1 - s.joined, ...outPose(s.outward(s.t)) }}>{children}</AbsoluteFill> : null}
      {s.showIn ? (
        <AbsoluteFill style={{ opacity: s.joined, ...inPose(s.inward(s.t)) }}>
          <Sequence from={s.joinOn} layout="none">
            {next}
          </Sequence>
        </AbsoluteFill>
      ) : null}
    </>
  );
};
