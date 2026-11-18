// Clock wipe: a radial sweep, like a clock hand going round, reveals the next scene. For a reveal that has a
// beginning and an end: a countdown, a timer, "and then". The idea is gl-transitions' (MIT) "radial", done with a conic mask.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import type { Point } from '../motion';
import type { StageName } from '../tokens';
import { Incoming, useWipe } from './wipes-shared';

/** The edge of the sweep is this many degrees wide: enough to be smooth, too little to see. */
const SOFT = 1.2;
/** The outgoing scene swells and the incoming one settles by this much while the hand goes round. */
const LEAN = 0.03;

/**
 * The children are the outgoing scene; `next` is the incoming one, its clock starting at 0 when the sweep starts.
 * From `at` a hand turns once around `from` (pixels of the frame; the middle if left out) over a `hero` length,
 * and the incoming scene shows in the part it has passed. It starts at `start` degrees (0 is twelve o'clock) and
 * goes clockwise unless `clockwise` is false. The sweep starts and ends on the same line, so there is no
 * moment of a half-empty frame: one scene is always behind every point. No instant change.
 */
export const ClockWipe: FC<{
  children: ReactNode;
  next: ReactNode;
  at: number;
  from?: Point;
  start?: number;
  clockwise?: boolean;
  page?: StageName;
}> = ({ children, next, at, from, start = 0, clockwise = true, page }) => {
  const { u, width, height, fps, done, started } = useWipe(at, 'hero');
  const fromFrame = Math.round(at * fps);
  if (!started) return <>{children}</>;
  if (done) return <Incoming next={next} fromFrame={fromFrame} page={page} />;
  const point = from ?? { x: width / 2, y: height / 2 };
  const edge = u * (360 + SOFT);
  const gradient = clockwise
    ? `black ${(edge - SOFT).toFixed(2)}deg, transparent ${edge.toFixed(2)}deg`
    : `transparent ${(360 - edge).toFixed(2)}deg, black ${(360 - edge + SOFT).toFixed(2)}deg`;
  const mask = `conic-gradient(from ${start}deg at ${point.x}px ${point.y}px, ${gradient})`;
  return (
    <>
      <AbsoluteFill style={{ scale: `${1 + LEAN * 0.8 * u}` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <AbsoluteFill style={{ scale: `${1 + LEAN * (1 - u)}` }}>
          <Incoming next={next} fromFrame={fromFrame} page={page} />
        </AbsoluteFill>
      </AbsoluteFill>
    </>
  );
};
