// Push wipe: the incoming scene pushes the outgoing one off the frame, the two moving together, hard and fast.
// For a firm change of subject on a beat. The idea is gl-transitions' (MIT) directional wipes, done here as a plain move.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { easing, progress } from '../motion';
import { MotionBlur, towards, useTravel, type Side } from '../moves/core';
import type { StageName } from '../tokens';
import { Incoming, useWipe } from './wipes-shared';

/**
 * The children are the outgoing scene; `next` is the incoming one, its clock starting at 0 when the push starts.
 * From `at` the two travel together towards `side` (the side the old scene leaves by) over a `base` length,
 * edge to edge, so the frame is never empty and the cut point is the whole move: both are moving the same way
 * the whole time. Each is blurred along its way at the speed it moves. Give `page` when the incoming scene is on
 * the brand's other page. No instant change.
 */
export const PushWipe: FC<{ children: ReactNode; next: ReactNode; at: number; side?: Side; page?: StageName }> = ({
  children,
  next,
  at,
  side = 'left',
  page,
}) => {
  const { u, width, height, fps, done, started, length } = useWipe(at, 'base', easing.travel);
  const travel = useTravel();
  const way = towards[side];
  const across = way.x !== 0;
  const reach = across ? width : height;
  const fromFrame = Math.round(at * fps);
  if (!started) return <>{children}</>;
  if (done) return <Incoming next={next} fromFrame={fromFrame} page={page} />;
  const speed = travel((t) => progress(t, at, at + length, easing.travel) * reach);
  const blur = { x: speed * way.x, y: speed * way.y };
  const gone = u * reach;
  return (
    <>
      <MotionBlur fill {...blur}>
        <AbsoluteFill style={{ translate: `${way.x * gone}px ${way.y * gone}px` }}>{children}</AbsoluteFill>
      </MotionBlur>
      <MotionBlur fill {...blur}>
        <AbsoluteFill style={{ translate: `${-way.x * (reach - gone)}px ${-way.y * (reach - gone)}px` }}>
          <Incoming next={next} fromFrame={fromFrame} page={page} />
        </AbsoluteFill>
      </MotionBlur>
    </>
  );
};
