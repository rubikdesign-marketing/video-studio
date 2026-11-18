// Parallax push: the outgoing scene's layers slide away at different speeds, the front fastest, as the next scene
// pushes in over them. For a change of place that should feel like depth, not a flat slide.
// After the push and slide transitions of Leonxlnx/cinetic and gl-transitions (MIT), rebuilt here with layers; no code copied.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { lerp } from '../motion';
import { MotionBlur, towards, useTravel, type Side } from '../moves/core';
import { useSwap } from './optics-shared';

/** The front layer's journey, as a share of the frame's width (or height). The back layer moves `SLOWEST` of that. */
const JOURNEY = 0.9;
const SLOWEST = 0.35;
const FASTEST = 1.15;

/**
 * The outgoing scene is `layers`, back to front (or a `background` and the `children` as the foreground); `next` is
 * the incoming scene, its own clock starting at 0 as it takes over. From `at` each layer slides towards `to`, speeding
 * up, for a `quick` length, the deeper ones slower; the next scene is already moving the same way as the front layer
 * and slows into place over a `base` length. They cross over one `tick`, with each side blurred by its own speed.
 */
export const ParallaxPush: FC<{
  layers?: ReactNode[];
  background?: ReactNode;
  children?: ReactNode;
  next: ReactNode;
  at: number;
  to?: Side;
}> = ({ layers, background, children, next, at, to = 'left' }) => {
  const s = useSwap(at);
  const travel = useTravel();
  const way = towards[to];
  const stack = layers ?? [background, children].filter((layer) => layer !== undefined && layer !== null);
  const speedOf = (i: number) => (stack.length < 2 ? 1 : lerp(SLOWEST, FASTEST, i / (stack.length - 1)));
  const along = { x: way.x * s.width * JOURNEY, y: way.y * s.height * JOURNEY };
  const out = (t: number) => s.share * s.outward(t);
  const inn = (t: number) => -(1 - s.share) * s.inward(t);
  const slide = (place: (t: number) => number, speed: number, content: ReactNode, key?: number) => (
    <MotionBlur key={key} fill x={travel(place) * along.x * speed} y={travel(place) * along.y * speed}>
      <AbsoluteFill style={{ translate: `${place(s.t) * along.x * speed}px ${place(s.t) * along.y * speed}px` }}>{content}</AbsoluteFill>
    </MotionBlur>
  );
  return (
    <>
      {s.showOut ? <AbsoluteFill style={{ opacity: 1 - s.joined }}>{stack.map((layer, i) => slide(out, speedOf(i), layer, i))}</AbsoluteFill> : null}
      {s.showIn ? (
        <AbsoluteFill style={{ opacity: s.joined }}>
          {slide(
            inn,
            speedOf(stack.length - 1),
            <Sequence from={s.joinOn} layout="none">
              {next}
            </Sequence>,
          )}
        </AbsoluteFill>
      ) : null}
    </>
  );
};
