// Iris wipe: a circle opens from a point (a button, a number) and the next scene is inside it; or the circle
// closes to a point and the next scene is outside. For going into whatever the viewer just clicked.
// The idea is gl-transitions' (MIT) "circleopen", done here with a clip-path.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import type { Point } from '../motion';
import { alpha, type StageName } from '../tokens';
import { useStage, useVh } from '../ui';
import { Incoming, useWipe } from './wipes-shared';

/** The scenes lean towards or away from the point by this much while the circle moves. */
const LEAN = 0.06;

/**
 * The children are the outgoing scene; `next` is the incoming one, its clock starting at 0 when the wipe starts.
 * `from` is the point in pixels of the frame (the middle if left out). `mode` "open" (default): from `at` a
 * circle grows from the point over a `scene` length until it passes the furthest corner, and the incoming scene
 * is inside it, settling from a little larger. `mode` "close": the outgoing scene is inside a circle that
 * shrinks to the point, shrinking a little with it, and the incoming scene is outside, already in place. A thin
 * line in the accent runs along the edge and fades as it finishes. No instant change.
 */
export const IrisWipe: FC<{ children: ReactNode; next: ReactNode; at: number; from?: Point; mode?: 'open' | 'close'; page?: StageName }> = ({
  children,
  next,
  at,
  from,
  mode = 'open',
  page,
}) => {
  const { u, width, height, fps, done, started } = useWipe(at);
  const vh = useVh();
  const stage = useStage();
  const fromFrame = Math.round(at * fps);
  if (!started) return <>{children}</>;
  if (done) return <Incoming next={next} fromFrame={fromFrame} page={page} />;
  const point = from ?? { x: width / 2, y: height / 2 };
  // The furthest corner, plus a little so the edge line is fully out of the frame at the end.
  const reach = Math.hypot(Math.max(point.x, width - point.x), Math.max(point.y, height - point.y)) + vh(1);
  const radius = mode === 'open' ? u * reach : (1 - u) * reach;
  const at2 = `${point.x}px ${point.y}px`;
  const clip = `circle(${radius}px at ${at2})`;
  const ring = (
    <div
      style={{
        position: 'absolute',
        left: point.x - radius,
        top: point.y - radius,
        width: radius * 2,
        height: radius * 2,
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: `${vh(0.4)}px solid ${alpha(stage.accent, 1 - u * u)}`,
      }}
    />
  );
  if (mode === 'open') {
    return (
      <>
        <AbsoluteFill style={{ transformOrigin: at2, scale: `${1 + LEAN * 0.5 * u}` }}>{children}</AbsoluteFill>
        <AbsoluteFill style={{ clipPath: clip }}>
          <AbsoluteFill style={{ transformOrigin: at2, scale: `${1 + LEAN * (1 - u)}` }}>
            <Incoming next={next} fromFrame={fromFrame} page={page} />
          </AbsoluteFill>
        </AbsoluteFill>
        {ring}
      </>
    );
  }
  return (
    <>
      <AbsoluteFill style={{ transformOrigin: at2, scale: `${1 + LEAN * 0.5 * (1 - u)}` }}>
        <Incoming next={next} fromFrame={fromFrame} page={page} />
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: clip }}>
        <AbsoluteFill style={{ transformOrigin: at2, scale: `${1 - LEAN * u}` }}>{children}</AbsoluteFill>
      </AbsoluteFill>
      {ring}
    </>
  );
};
