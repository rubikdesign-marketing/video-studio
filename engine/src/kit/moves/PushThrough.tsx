// Push through: the camera pushes into one element until its colour fills the frame, and that colour is the
// page of the next scene. For entering a new world.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, progress, useMotion } from '../motion';
import type { StageName } from '../tokens';
import { Panel, useVh } from '../ui';
import { centreOf, smear, useTravel, type Rect } from './core';

/** A rounded corner covers this share of its radius less than a square one would, measured along each edge. */
const CORNER = 0.3;

/**
 * The children are the outgoing scene. `target` is the element to enter (pixels in the frame): paint it in the
 * `page` the next scene is on and give it the corner `radius` it has (a percentage of frame height; the brand's
 * control radius if left out). From `at` the push speeds up over a `scene` length.
 *
 * What grows is a plain plate drawn over the element in the same colour and shape, so nothing with detail is
 * ever enlarged: the rest of the outgoing scene softens and is gone within a `quick` length, before the push has
 * magnified it enough to smear. The plate reaches the corners of the frame on the last frame of the push, and
 * `next` takes over on that page on the very next frame, with its own clock starting at 0: no empty wait.
 */
export const PushThrough: FC<{ children: ReactNode; next: ReactNode; target: Rect; at: number; page: StageName; radius?: number }> = ({
  children,
  next,
  target,
  at,
  page,
  radius,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const vh = useVh();
  const travel = useTravel();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const length = m.seconds('scene');
  const landsOn = Math.round((at + length) * fps);
  const centre = centreOf(target);
  const round = vh(radius ?? brand.shape.control);
  // The scale at which the plate, growing about its own centre, reaches the furthest corner of the frame, round corners included.
  const cover = Math.max(
    Math.max(centre.x, width - centre.x) / (target.width / 2 - round * CORNER),
    Math.max(centre.y, height - centre.y) / (target.height / 2 - round * CORNER),
  );
  // The scale grows by a constant factor, not a constant amount, so the push reads as one steady move inwards.
  const closeness = (t: number) => Math.log(cover) * progress(t, at, at + length, easing.leave);
  if (frame >= landsOn) {
    return (
      <Panel name={page} style={{ position: 'absolute', inset: 0 }}>
        <Sequence from={landsOn} layout="none">
          {next}
        </Sequence>
      </Panel>
    );
  }
  const scale = Math.exp(closeness(m.t));
  const gone = progress(m.t, at, at + m.seconds('quick'), easing.leave);
  // What is left of the outgoing scene softens as the camera passes it: its edges move this far in a frame.
  const soft = smear(travel(closeness) * (height / 2), width);
  const origin = `${centre.x}px ${centre.y}px`;
  return (
    <>
      {gone < 1 ? (
        <AbsoluteFill style={{ transformOrigin: origin, scale: `${scale}`, opacity: 1 - gone, filter: soft > 0 ? `blur(${soft}px)` : undefined }}>
          {children}
        </AbsoluteFill>
      ) : null}
      {m.t >= at ? (
        <AbsoluteFill style={{ transformOrigin: origin, scale: `${scale}`, opacity: progress(m.t, at, at + m.seconds('tick')) }}>
          <Panel name={page} style={{ position: 'absolute', left: target.x, top: target.y, width: target.width, height: target.height, borderRadius: round }} />
        </AbsoluteFill>
      ) : null}
    </>
  );
};
