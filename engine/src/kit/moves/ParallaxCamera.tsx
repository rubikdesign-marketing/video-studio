// Parallax camera: three planes at different depths slide at different speeds as the camera moves, and the far
// plane is out of focus. The frame reads as a space, not a flat page.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { easing, progress, useMotion, type Point } from '../motion';
import { useVh } from '../ui';
import { MotionBlur, useTravel } from './core';

/** How far each plane slides, compared with the product plane: the far plane 30 to 40% as far, the near plane 140 to 160%. */
const DEPTH = { far: 0.35, product: 1, near: 1.5 } as const;
/** The far plane is out of focus: how soft it is, as a percentage of frame height (6 to 12 px at 1080), and how much it is dimmed. */
const FAR = { soft: 0.7, dim: 0.35 } as const;

/**
 * The children are the product plane, the one the shot is about. `far` sits behind it, softened and dimmed;
 * `near` is a foreground detail in front of it. Lay each plane out as it should be when the camera has arrived:
 * before `at` every plane stands back from that place, the near one the furthest, and from `at` they slide in over
 * a `scene` length (or a `hero` one), setting off together and slowing together. `by` is how far the product
 * plane slides, as shares of the frame's width and height; the camera moves the other way.
 *
 * Keep the near plane clear of what is being read, and keep the Stage outside: the page does not move. Each
 * plane blurs along its way only while it is fast, so the near plane smears first and nothing at rest is soft
 * except the far plane.
 */
export const ParallaxCamera: FC<{
  children: ReactNode;
  far?: ReactNode;
  near?: ReactNode;
  at: number;
  by: Point;
  over?: 'scene' | 'hero';
}> = ({ children, far, near, at, by, over = 'scene' }) => {
  const m = useMotion();
  const vh = useVh();
  const travel = useTravel();
  const { width, height } = useVideoConfig();
  // How far the camera still has to go: 1 before the move, 0 once it has arrived.
  const left = (t: number) => 1 - progress(t, at, at + m.seconds(over), easing.travel);
  const speed = travel(left);
  const plane = (content: ReactNode, depth: number, soft = false) => {
    const reach = { x: -by.x * width * depth, y: -by.y * height * depth };
    return (
      <MotionBlur fill x={speed * reach.x} y={speed * reach.y}>
        <AbsoluteFill
          style={{
            translate: `${left(m.t) * reach.x}px ${left(m.t) * reach.y}px`,
            filter: soft ? `blur(${vh(FAR.soft)}px)` : undefined,
            opacity: soft ? 1 - FAR.dim : undefined,
          }}
        >
          {content}
        </AbsoluteFill>
      </MotionBlur>
    );
  };
  return (
    <>
      {far ? plane(far, DEPTH.far, true) : null}
      {plane(children, DEPTH.product)}
      {near ? plane(near, DEPTH.near) : null}
    </>
  );
};
