// Match cut: a shape in the outgoing scene and one in the incoming scene occupy the same place on the cut, so the
// eye carries over and the rest of the frame changes around it. For a hype or confident film on a strong beat.
// After the shape-match and zoom-through ideas in Leonxlnx/cinetic and gl-transitions (MIT); built here, no code copied.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { smear, centreOf, useTravel, type Rect } from '../moves/core';
import { useSwap } from './optics-shared';

/**
 * The children are the outgoing scene; `next` is the incoming, its own clock starting at 0 on the cut. `from` is a
 * shape in the outgoing scene and `to` the matching shape in the incoming scene, both in pixels of the frame. The
 * outgoing scene eases (scale and place, speeding up) so that `from` lands on a common rectangle on the last frame
 * before the cut; on the cut the incoming scene is placed so that `to` is on the very same rectangle, and it
 * eases to rest. The common rectangle is chosen so both scenes move the same way at the same speed.
 *
 * The scene is scaled evenly, so the match is exact when both shapes have the same proportions (a circle and a
 * circle, a card and a card). With different proportions the two share their centre and area. The shapes should be
 * within about a quarter of the frame of each other in size, or the move reads as a zoom.
 */
export const MatchCut: FC<{ children: ReactNode; next: ReactNode; at: number; from: Rect; to: Rect }> = ({ children, next, at, from, to }) => {
  const s = useSwap(at, { hard: true, lead: 1 });
  const travel = useTravel();
  const c1 = centreOf(from);
  const c2 = centreOf(to);
  const d = { x: c2.x - c1.x, y: c2.y - c1.y };
  // Total change of size, as a log of the ratio of the shapes' sizes (even scale: the square root of their areas).
  const L = Math.log(Math.sqrt((to.width * to.height) / (from.width * from.height)));
  const outAmount = (t: number) => s.share * s.outward(t);
  const inAmount = (t: number) => -(1 - s.share) * s.inward(t);
  // How far the picture moves in a frame, in pixels, for the blur: its place and its size (about the middle) together.
  const soft = (amount: (t: number) => number) => {
    const move = Math.hypot(travel((t) => amount(t) * d.x), travel((t) => amount(t) * d.y)) + Math.abs(travel((t) => amount(t) * L)) * (s.height / 2);
    const blur = smear(move, s.width);
    return blur > 0 ? `blur(${blur}px)` : undefined;
  };
  const pose = (amount: (t: number) => number, c: { x: number; y: number }) => {
    const a = amount(s.t);
    return {
      transformOrigin: `${c.x}px ${c.y}px`,
      translate: `${a * d.x}px ${a * d.y}px`,
      scale: `${Math.exp(a * L)}`,
      filter: soft(amount),
    };
  };
  return (
    <>
      {s.showOut ? <AbsoluteFill style={pose(outAmount, c1)}>{children}</AbsoluteFill> : null}
      {s.showIn ? (
        <AbsoluteFill style={pose(inAmount, c2)}>
          <Sequence from={s.joinOn} layout="none">
            {next}
          </Sequence>
        </AbsoluteFill>
      ) : null}
    </>
  );
};
