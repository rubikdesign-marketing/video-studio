// Momentum cut: the outgoing shot starts to move, there is a hard cut, and the incoming shot is already moving
// the same way and settles. It joins two zoom levels of the same screen without zooming across small text.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { easing, progress, useMotion } from '../motion';
import { MotionBlur, towards, useTravel, type Side } from './core';

/** How far the outgoing shot travels before the cut, as a share of the frame: 2 to 12%. */
const BEFORE = 0.06;
/**
 * How far from its place the incoming shot is on the cut: 2 to 8%. It is the distance that gives it, on its first
 * frame, the speed the outgoing shot had on its last, so nothing is at rest on the cut and nothing lurches.
 */
const AFTER = 0.032;
/** The incoming shot settles in this share of a `base` length: 250 to 350 ms. */
const SETTLE = 0.75;

/**
 * The children are the outgoing shot; `next` is the incoming, with its own clock starting at 0 on the cut. From
 * `at` the outgoing shot slides towards `to`, speeding up, for a `quick` length; then the cut; the incoming shot
 * carries on the same way and slows to rest. The cut is one frame and is planned: there is no fade.
 *
 * Both shots must sit on the same page, so keep the Stage outside. Use it between a wide view and a close view
 * of one screen; it is not a way to change world.
 */
export const MomentumCut: FC<{ children: ReactNode; next: ReactNode; at: number; to?: Side }> = ({ children, next, at, to = 'left' }) => {
  const m = useMotion();
  const travel = useTravel();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const cutOn = Math.round((at + m.seconds('quick')) * fps);
  const cutAt = cutOn / fps;
  const way = towards[to];
  const frameAlong = { x: way.x * width, y: way.y * height };
  if (frame < cutOn) {
    const off = (t: number) => progress(t, at, cutAt, easing.leave) * BEFORE;
    const speed = travel(off);
    return (
      <MotionBlur fill x={speed * frameAlong.x} y={speed * frameAlong.y}>
        <AbsoluteFill style={{ translate: `${off(m.t) * frameAlong.x}px ${off(m.t) * frameAlong.y}px` }}>{children}</AbsoluteFill>
      </MotionBlur>
    );
  }
  const short = (t: number) => (1 - progress(t, cutAt, cutAt + m.seconds('base') * SETTLE)) * AFTER;
  const speed = travel(short);
  return (
    <MotionBlur fill x={speed * frameAlong.x} y={speed * frameAlong.y}>
      <AbsoluteFill style={{ translate: `${-short(m.t) * frameAlong.x}px ${-short(m.t) * frameAlong.y}px` }}>
        <Sequence from={cutOn} layout="none">
          {next}
        </Sequence>
      </AbsoluteFill>
    </MotionBlur>
  );
};
