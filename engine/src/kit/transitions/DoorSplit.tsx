// Door split: the outgoing scene splits down the middle and its two halves slide apart, like doors, with the next
// scene waiting behind. For opening on something: a reveal, a launch. The idea is gl-transitions' (MIT) "doorway", done with two clips.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { MotionBlur, useTravel } from '../moves/core';
import { easing, progress } from '../motion';
import { alpha, type StageName } from '../tokens';
import { useStage, useVh } from '../ui';
import { Incoming, useWipe } from './wipes-shared';

/** The next scene settles from this much larger. */
const LEAN = 0.05;
/** The shade on the next scene along each door's edge: this many per cent of frame height wide. */
const SHADE_WIDTH = 5;

/**
 * The children are the outgoing scene; `next` is the incoming one, its clock starting at 0 when the doors start.
 * `axis` "vertical" (default) splits along a vertical seam and the halves go left and right; "horizontal" splits
 * along a horizontal seam and the halves go up and down (the better choice in a tall frame). From `at` the halves
 * speed up and go over a `scene` length, each leaving its own side of the frame, blurred at its speed; the
 * incoming scene is behind them from the first frame, with a soft shade along each door's edge. The outgoing
 * scene is drawn twice, in two halves: nothing in it may need its own state. No instant change.
 */
export const DoorSplit: FC<{ children: ReactNode; next: ReactNode; at: number; axis?: 'vertical' | 'horizontal'; page?: StageName }> = ({
  children,
  next,
  at,
  axis = 'vertical',
  page,
}) => {
  const { u, width, height, fps, done, started, length } = useWipe(at, 'scene', easing.leave);
  const travel = useTravel();
  const vh = useVh();
  const stage = useStage();
  const fromFrame = Math.round(at * fps);
  if (!started) return <>{children}</>;
  if (done) return <Incoming next={next} fromFrame={fromFrame} page={page} />;
  const across = axis === 'vertical';
  const half = (across ? width : height) / 2;
  const open = u * half;
  const speed = travel((t) => progress(t, at, at + length, easing.leave) * half);
  const one = (sign: 1 | -1) => {
    const clip = across
      ? sign === -1
        ? 'inset(0 50% 0 0)'
        : 'inset(0 0 0 50%)'
      : sign === -1
        ? 'inset(0 0 50% 0)'
        : 'inset(50% 0 0 0)';
    return (
      <MotionBlur fill x={across ? sign * speed : 0} y={across ? 0 : sign * speed}>
        <AbsoluteFill style={{ translate: across ? `${sign * open}px 0` : `0 ${sign * open}px` }}>
          <AbsoluteFill style={{ clipPath: clip, backgroundColor: stage.page }}>{children}</AbsoluteFill>
        </AbsoluteFill>
      </MotionBlur>
    );
  };
  const edge = alpha(stage.shade, 0.4 * (1 - u * 0.6));
  const gap: CSSProperties = across
    ? { left: half - open, width: open * 2, top: 0, height, backgroundImage: `linear-gradient(to right, ${edge}, transparent ${vh(SHADE_WIDTH)}px, transparent calc(100% - ${vh(SHADE_WIDTH)}px), ${edge})` }
    : { top: half - open, height: open * 2, left: 0, width, backgroundImage: `linear-gradient(to bottom, ${edge}, transparent ${vh(SHADE_WIDTH)}px, transparent calc(100% - ${vh(SHADE_WIDTH)}px), ${edge})` };
  return (
    <>
      <AbsoluteFill style={{ scale: `${1 + LEAN * (1 - u)}` }}>
        <Incoming next={next} fromFrame={fromFrame} page={page} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', ...gap }} />
      {one(-1)}
      {one(1)}
    </>
  );
};
