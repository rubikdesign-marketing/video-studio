// Page turn: the scene is a page; its right edge lifts, curls over and the page is turned away to the left,
// showing the next page beneath. For the next chapter of a story, a report, a guide.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { easing, lerp, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { Sheet } from './sheet';

/** The curl's radius, as a share of the frame's shorter side. */
const CURL = 0.11;
/** The page is cut into upright strips this wide, as a share of the frame's shorter side: thin next to the curl. */
const STRIP = 1 / 26;
/** The camera stands this many frame-widths away: the lifted page comes a little towards the viewer. */
const LENS = 2.6;
/** The next page is this much larger when the turn starts, and settles to its size as the page uncovers it. */
const UNDER = 0.035;
/** The shadow the curl casts on the page beneath, as a share of the frame's shorter side, and its strength. */
const SHADOW = { reach: 0.16, strength: 0.28 } as const;

/** Where a point of the page `u` pixels from its left edge is once the page is wrapped round a curl standing at `axis`. */
const wrapped = (u: number, axis: number, radius: number) => {
  if (u <= axis) return { x: u, z: 0 };
  const along = u - axis;
  if (along <= Math.PI * radius) {
    const turn = along / radius;
    return { x: axis + radius * Math.sin(turn), z: radius * (1 - Math.cos(turn)) };
  }
  return { x: axis - (along - Math.PI * radius), z: 2 * radius };
};

/**
 * The children are the page being turned; `next` is the page beneath, with its clock starting at 0 on `at` (it
 * is uncovered while it settles). From `at`, over a `scene` and a `base` length (about 1.15 s), the page bends
 * round an upright curl that runs from the right edge to past the left, as a page of a book does: the part past
 * the curl is turned over (its back is plain page, lit a little), lies on top and leaves the frame to the left.
 * The page beneath settles from slightly larger, and the curl's shadow falls on it. Built from thin strips of one
 * sheet in CSS 3D, so it is a pure function of the frame; nothing is a picture. No single swap frame: the next
 * page is uncovered from the right edge from the first frame of the turn to the last.
 */
export const PageTurn: FC<{ children: ReactNode; next: ReactNode; at: number }> = ({ children, next, at }) => {
  const m = useMotion();
  const stage = useStage();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const length = m.seconds('scene') + m.seconds('base');
  const startsOn = Math.round(at * fps);
  const endsOn = Math.round((at + length) * fps);
  const p = progress(m.t, at, at + length, easing.travel);
  const settle = progress(m.t, at, at + length + m.seconds('base'), easing.arrive);
  const incoming = (
    <Sequence from={startsOn} layout="none">
      <AbsoluteFill style={{ scale: `${1 + UNDER * (1 - settle)}` }}>{next}</AbsoluteFill>
    </Sequence>
  );
  if (frame < startsOn) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (frame >= endsOn) return <AbsoluteFill>{incoming}</AbsoluteFill>;

  const short = Math.min(width, height);
  const radius = CURL * short;
  // The curl starts just off the right edge and ends where the whole page, curl included, has left the frame.
  const axis = lerp(width + radius * 0.2, -radius * 1.2, p);
  const count = Math.ceil(width / (STRIP * short));
  const strip = width / count;
  // Light on the bend, as a shade that changes smoothly along the page (a gradient across each strip, so the
  // strips do not show): darker where the page is turned towards the side, the back of the page plain and a
  // little darker than the front, and a soft line where the turned-over flap ends.
  const shadeAt = (u: number) => {
    const a = wrapped(u - 0.5, axis, radius);
    const b = wrapped(u + 0.5, axis, radius);
    const facing = Math.cos(Math.atan2(b.z - a.z, b.x - a.x));
    return facing >= 0 ? 0.22 * (1 - facing) : 0.06 + 0.1 * (1 + facing);
  };
  const lightAcross = (u0: number) => {
    const stops = [0, 0.5, 1].map((share) => `${alpha(stage.shade, shadeAt(u0 + share * strip))} ${share * 100}%`);
    return `linear-gradient(to right, ${stops.join(', ')})`;
  };
  const strips = Array.from({ length: count }, (_, i) => {
    const u0 = i * strip;
    const a = wrapped(u0, axis, radius);
    const b = wrapped(u0 + strip, axis, radius);
    // The strip lies along the chord between its two ends; CSS turns the right side away for a positive angle.
    const turn = Math.atan2(b.z - a.z, b.x - a.x);
    const facing = Math.cos(turn); // 1 flat and face up, -1 turned over
    return { i, u0, a, turn, facing };
  });
  // The curl casts its shadow on the uncovered page, to the right of the fold.
  const fold = axis + radius;
  const reach = SHADOW.reach * short;
  const fading = SHADOW.strength * (1 - progress(p, 0.75, 1, (x) => x));
  const shadow = `linear-gradient(to right, ${alpha(stage.shade, fading)} 0px, ${alpha(stage.shade, 0)} ${reach}px)`;
  return (
    <AbsoluteFill>
      {incoming}
      <div style={{ position: 'absolute', left: fold, top: 0, width: reach, height, background: shadow }} />
      <AbsoluteFill style={{ perspective: LENS * width, perspectiveOrigin: '50% 50%' }}>
        {strips.map(({ i, u0, a, turn, facing }) => {
          const back = facing < 0;
          return (
            <Sheet
              key={i}
              cut={{ x: u0, y: 0, width: strip + 0.75, height }}
              style={{
                transformOrigin: `0px ${height / 2}px`,
                transform: `translate3d(${a.x - u0}px, 0px, ${a.z}px) rotateY(${(-turn * 180) / Math.PI}deg)`,
              }}
            >
              {back ? null : children}
              <AbsoluteFill style={{ background: lightAcross(u0) }} />
            </Sheet>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
