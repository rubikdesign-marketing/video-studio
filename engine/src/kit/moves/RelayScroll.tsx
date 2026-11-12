// Relay scroll: the outgoing content speeds up and off, is swapped in one frame, and the incoming content starts
// a little low and slows to rest. No fade. For moving to the next step in a sequence.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { MotionBlur, towards, useTravel, type Side } from './core';

/** How far from its place the incoming content starts, as a share of the frame: 10 to 14%. */
const LOW = 0.12;

/**
 * The children are the outgoing content; `next` is the incoming, with its own clock starting at 0 on the swap.
 * From `at` the outgoing content leaves towards `to` (up, unless told otherwise), then the incoming content
 * carries on the same way and settles over a `scene` length. Keep the Stage outside: the page does not move.
 * Use one direction for "next step" through a whole film.
 *
 * `reach` is how far the outgoing content must travel to be out of the frame, as a share of the frame: 1 for
 * content that fills it, about 0.6 for a line or a card in the middle. The swap lands as the content clears the
 * edge, so the page is never left empty. The outgoing content blurs along its way as it speeds up; it is no
 * longer being read.
 */
export const RelayScroll: FC<{ children: ReactNode; next: ReactNode; at: number; to?: Side; reach?: number }> = ({
  children,
  next,
  at,
  to = 'up',
  reach = 1,
}) => {
  const m = useMotion();
  const travel = useTravel();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const swapOn = Math.round((at + m.seconds('scene') * EXIT_SHARE) * fps);
  const swapAt = swapOn / fps;
  const way = towards[to];
  const frameAlong = { x: way.x * width, y: way.y * height };
  if (frame < swapOn) {
    const off = (t: number) => progress(t, at, swapAt, easing.leave) * reach;
    const speed = travel(off);
    return (
      <MotionBlur fill x={speed * frameAlong.x} y={speed * frameAlong.y}>
        <AbsoluteFill style={{ translate: `${off(m.t) * frameAlong.x}px ${off(m.t) * frameAlong.y}px` }}>{children}</AbsoluteFill>
      </MotionBlur>
    );
  }
  const short = (t: number) => (1 - progress(t, swapAt, swapAt + m.seconds('scene'))) * LOW;
  const speed = travel(short);
  return (
    <MotionBlur fill x={speed * frameAlong.x} y={speed * frameAlong.y}>
      <AbsoluteFill style={{ translate: `${-short(m.t) * frameAlong.x}px ${-short(m.t) * frameAlong.y}px` }}>
        <Sequence from={swapOn} layout="none">
          {next}
        </Sequence>
      </AbsoluteFill>
    </MotionBlur>
  );
};
