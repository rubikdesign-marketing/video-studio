// Slide-off reveal: finished content speeds up and off one side while the next title, already in place beneath
// it, comes up. For ending a section and naming the next.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { easing, progress, useMotion } from '../motion';
import { useVh } from '../ui';
import { MotionBlur, towards, useTravel, type Side } from './core';

/**
 * The children are the finished content; `next` is the title beneath it. From `at` the content leaves towards
 * `to` over a `scene` length, blurring along its way as it speeds up (it has been read). The title comes up in
 * a `quick` length once the content is under way: give it no entrance of its own, and keep it still until it has
 * been read.
 */
export const SlideOffReveal: FC<{ children: ReactNode; next: ReactNode; at: number; to?: Side }> = ({ children, next, at, to = 'left' }) => {
  const m = useMotion();
  const vh = useVh();
  const travel = useTravel();
  const { width, height } = useVideoConfig();
  const gone = (t: number) => progress(t, at, at + m.seconds('scene'), easing.leave);
  const titleAt = at + m.seconds('quick');
  const shown = progress(m.t, titleAt, titleAt + m.seconds('quick'));
  const way = towards[to];
  const frameAlong = { x: way.x * width, y: way.y * height };
  const speed = travel(gone);
  return (
    <>
      {shown > 0 ? <AbsoluteFill style={{ opacity: shown, translate: `0 ${(1 - shown) * vh(1.2)}px` }}>{next}</AbsoluteFill> : null}
      {gone(m.t) < 1 ? (
        <MotionBlur fill x={speed * frameAlong.x} y={speed * frameAlong.y}>
          <AbsoluteFill style={{ translate: `${gone(m.t) * frameAlong.x}px ${gone(m.t) * frameAlong.y}px` }}>{children}</AbsoluteFill>
        </MotionBlur>
      ) : null}
    </>
  );
};
