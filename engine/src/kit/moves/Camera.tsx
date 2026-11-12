// Camera: a wrapper that moves everything inside it as one shot. It drifts, pushes in on a point, or follows a
// point. One move and one direction per shot: never in, out, in.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { clamp01, easing, progress, useMotion, type Point } from '../motion';
import { towards, type Side } from './core';

/** The furthest a hero push goes. */
const MAX_PUSH = 2.5;
/** A following camera covers this share of the way to the point: it moves less than the pointer does. */
const FOLLOW_SHARE = 0.7;

/** A slow constant move through the whole shot, sized by the preset. The one move that runs at a constant speed. */
type Drift = { move: 'drift'; direction?: 'in' | 'out' | Side };
/** Push in on `to` (pixels in the frame) from `at`, over a `scene` length or a `hero` one. The point ends in the middle of the frame. */
type Push = { move: 'push'; to: Point; at: number; scale?: number; over?: 'scene' | 'hero' };
/**
 * Follow a point the pointer is travelling to. `at` is when the pointer clicks there, as in a kit Cursor move: the
 * camera sets off a `quick` after the pointer, travels less far, and lands on the click.
 */
type Follow = { move: 'follow'; to: Point; at: number; scale?: number };

export type CameraShot = Drift | Push | Follow;

/**
 * Put a scene's content inside it, and keep the Stage outside: the page stays still while the shot moves.
 * Every move has a cause (a click, a word, a reveal); finish the move, then land the number or word it went for.
 */
export const Camera: FC<CameraShot & { children: ReactNode }> = ({ children, ...shot }) => {
  const m = useMotion();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const centre = { x: width / 2, y: height / 2 };

  let origin = centre;
  let shift = { x: 0, y: 0 };
  let scale = 1;
  if (shot.move === 'drift') {
    const through = clamp01(m.t / (durationInFrames / fps));
    const direction = shot.direction ?? 'in';
    if (direction === 'in') scale = 1 + m.preset.drift * through;
    else if (direction === 'out') scale = 1 + m.preset.drift * (1 - through);
    else shift = { x: towards[direction].x * m.preset.drift * width * through, y: towards[direction].y * m.preset.drift * height * through };
  } else {
    // A push starts on its cue. A follow starts a `quick` after the pointer, which sets off a `scene` and a `tick` before its click.
    const [from, to] =
      shot.move === 'push'
        ? [shot.at, shot.at + m.seconds(shot.over ?? 'scene')]
        : [shot.at - m.seconds('tick') - m.seconds('scene') + m.seconds('quick'), shot.at];
    const moved = progress(m.t, from, to, easing.travel);
    const reach = shot.move === 'push' ? 1 : FOLLOW_SHARE;
    origin = shot.to;
    shift = { x: (centre.x - shot.to.x) * reach * moved, y: (centre.y - shot.to.y) * reach * moved };
    // The size grows by a constant factor, not a constant amount, so a long push closes in at one steady rate
    // and does not rush at first and crawl at the end.
    scale = Math.min(MAX_PUSH, shot.scale ?? (shot.move === 'push' ? 1.6 : 1)) ** moved;
  }
  return (
    <AbsoluteFill style={{ transformOrigin: `${origin.x}px ${origin.y}px`, translate: `${shift.x}px ${shift.y}px`, scale: `${scale}` }}>
      {children}
    </AbsoluteFill>
  );
};
