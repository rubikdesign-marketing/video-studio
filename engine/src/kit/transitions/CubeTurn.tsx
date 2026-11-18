// Cube turn: the two scenes are two faces of one cube, and the cube turns a quarter turn to bring the next face
// round. For a step to a neighbouring idea that belongs to the same set (this feature, then the next one).
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { easing, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { MotionBlur, useTravel, type Side } from '../moves/core';
import { useStage } from '../ui';
import { Sheet } from './sheet';

/** The camera stands this many frame-widths (or heights, for a vertical turn) from the face: a natural lens. */
const LENS = 2;
/** How far the camera pulls back at the middle of the turn, in face widths, so the whole cube is in view. */
const PULL = 0.6;
/** How dark a face is when it is side-on to the camera. */
const SHADE = 0.32;

/**
 * The children are the outgoing face; `next` is the face that turns in, its clock starting at 0 on `at` (it is
 * already moving into view). From `at` the cube turns 90 degrees over a `scene` and a `quick` length (about
 * 960 ms), the next face coming from the side opposite `to` ('left' by default: the content moves left, as if
 * the viewer moved right). The camera pulls back a little at the middle so the whole cube is seen, then
 * returns, and the face that turns away darkens. The faces are sheets of the stage's own page, so before and
 * after the turn nothing changes on the page. Both faces are moving at every frame of the turn; the turn is
 * even (it speeds up and slows down) and is motion-blurred at its fastest.
 */
export const CubeTurn: FC<{ children: ReactNode; next: ReactNode; at: number; to?: Side }> = ({ children, next, at, to = 'left' }) => {
  const m = useMotion();
  const stage = useStage();
  const travel = useTravel();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const length = m.seconds('scene') + m.seconds('quick');
  const startsOn = Math.round(at * fps);
  const endsOn = Math.round((at + length) * fps);
  const incoming = (
    <Sequence from={startsOn} layout="none">
      {next}
    </Sequence>
  );
  if (frame < startsOn) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (frame >= endsOn) return <AbsoluteFill>{incoming}</AbsoluteFill>;

  const across = to === 'left' || to === 'right';
  const size = across ? width : height;
  // The sign of the turn: with `to` left, the outgoing face swings away to the left.
  const sign = to === 'left' || to === 'up' ? 1 : -1;
  const turned = (t: number) => progress(t, at, at + length, easing.travel);
  const p = turned(m.t);
  const angle = 90 * p;
  const back = PULL * size * Math.sin(Math.PI * p);
  const half = size / 2;
  // The cube's edges are drawn while it turns, so the faces read as faces on a page of the same colour.
  const edge = Math.min(1, 4 * Math.sin(Math.PI * p));
  const rotate = across ? 'rotateY' : 'rotateX';
  // rotateY turns the right side away for a positive angle; rotateX turns the top towards the viewer.
  const axisSign = across ? -sign : sign;
  const face = (degrees: number, content: ReactNode, shade: number) => (
    <Sheet
      style={{
        transformOrigin: `${width / 2}px ${height / 2}px`,
        transform: `translateZ(${-half - back}px) ${rotate}(${axisSign * degrees}deg) translateZ(${half}px)`,
        backfaceVisibility: 'hidden',
        boxShadow: edge > 0.01 ? `0 0 0 ${1.5}px ${alpha(stage.line, edge)}` : undefined,
      }}
    >
      {content}
      {shade > 0.001 ? <AbsoluteFill style={{ background: alpha(stage.shade, shade) }} /> : null}
    </Sheet>
  );
  // The edge between the faces travels about half a face across the frame: that is the speed the blur follows.
  const speed = travel((t) => turned(t) * half);
  return (
    <MotionBlur fill x={across ? speed : 0} y={across ? 0 : speed}>
      <AbsoluteFill style={{ perspective: LENS * size, perspectiveOrigin: '50% 50%' }}>
        {face(angle, children, SHADE * Math.sin((angle * Math.PI) / 180))}
        {face(angle - 90, incoming, SHADE * Math.cos((angle * Math.PI) / 180))}
      </AbsoluteFill>
    </MotionBlur>
  );
};
