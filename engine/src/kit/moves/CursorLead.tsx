// Cursor lead: a large cursor travels on an arc and clicks; the camera follows it late, travels less, and lands
// with the click. The pointer leads the eye, and the camera never leads the pointer.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { arc, easing, progress, useMotion, type Point } from '../motion';
import { Cursor } from '../ui';
import { Camera } from './Camera';
import { MotionBlur, useTravel } from './core';

/** How small a pressed control gets: it dips to about 92%. */
const DIP = 0.08;
/** How much a pressed control fades while it is down. */
const FADE = 0.1;
/** The cursor is drawn this much larger than the kit's, about its tip: it is the lead object and must read on a phone. */
const LARGE = 1.5;
/** How far a cursor's path bows, as a share of the distance, when the scene does not say. The same as the kit cursor's. */
const BEND = 0.16;

/**
 * Wraps a control the cursor clicks at `at`. It dips while the cursor presses (a `tick` before the click) and
 * comes back in a `tick` after it. Change what the control says or shows one frame after `at`, not before.
 */
export const Pressed: FC<{ children: ReactNode; at: number; style?: CSSProperties }> = ({ children, at, style }) => {
  const m = useMotion();
  const tick = m.seconds('tick');
  const down = progress(m.t, at - tick, at, easing.travel) * (1 - progress(m.t, at, at + tick, easing.travel));
  return <div style={{ scale: `${1 - down * DIP}`, opacity: 1 - down * FADE, ...style }}>{children}</div>;
};

/**
 * The children are the screen. The cursor starts at `from` and clicks on `to` at `at` (pixels in the frame, on
 * the scene clock, so the click can sit on a spoken word). It sets off a `scene` and a `tick` before the click,
 * bows along an arc, and is at rest on the control a `tick` before it presses. The camera sets off a `quick`
 * after the cursor, covers 70% of the way to the control while pushing in to `scale`, and lands on the click.
 * The cursor is in the shot, so it grows with the push: it is the lead object, and larger than life.
 *
 * Put the control in a `Pressed` with the same `at`, and nothing else on the screen should change until the click.
 * The cursor blurs along its path only while it is crossing fast; it is sharp when it arrives.
 */
export const CursorLead: FC<{
  children: ReactNode;
  from: Point;
  to: Point;
  at: number;
  scale?: number;
  bend?: number;
  out?: number;
}> = ({ children, from, to, at, scale = 1.4, bend = BEND, out }) => {
  const m = useMotion();
  const travel = useTravel();
  // The kit cursor's own timetable: it leaves a scene and a tick before the click and lands a tick before it.
  const [leaves, lands] = [at - m.seconds('tick') - m.seconds('scene'), at - m.seconds('tick')];
  const tipAt = (t: number) => arc(from, to, progress(t, leaves, lands, easing.travel), bend);
  const tip = tipAt(m.t);
  return (
    <Camera move="follow" to={to} at={at} scale={scale}>
      {children}
      <MotionBlur fill x={travel((t) => tipAt(t).x)} y={travel((t) => tipAt(t).y)}>
        <AbsoluteFill style={{ transformOrigin: `${tip.x}px ${tip.y}px`, scale: `${LARGE}` }}>
          <Cursor from={from} moves={[{ to, at, click: true }]} bend={bend} out={out} />
        </AbsoluteFill>
      </MotionBlur>
    </Camera>
  );
};
