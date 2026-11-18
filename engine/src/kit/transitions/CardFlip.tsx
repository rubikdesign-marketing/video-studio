// Card flip: the scene lifts off the page as a card, flips over, and the next scene is on its back. For the other
// side of one thing: the question and its answer, the before and the after, the price and what it buys.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { MotionBlur, useTravel } from '../moves/core';
import { useStage, useVh } from '../ui';
import { Sheet } from './sheet';

/** The camera stands this many frame-widths from the card. */
const LENS = 3.5;
/** The card is this much smaller than the frame at the middle of the flip, so its edges and shadow are seen. */
const DIP = 0.34;
/** The shadow under the card at the middle of the flip: drop and blur in percentages of frame height, strength. */
const SHADOW = { drop: 2.4, blur: 6, strength: 0.3 } as const;
/** How dark a face is when it is edge-on. */
const SHADE = 0.3;

/**
 * The children are the front of the card; `next` is its back, with its clock starting at 0 on `at` (it is moving
 * by the time it shows). From `at`, over a `scene` and a `base` length (about 1.15 s), the scene shrinks to a card
 * with round corners and a shadow, turns over about the upright axis (`over`: about the level one, top towards
 * the viewer) and grows back to fill the frame. The swap is the frame on which the card is edge-on, halfway; the
 * card is turning fastest there, so both sides are moving and the swap is unseen. Faces are sheets of the stage's
 * own page: before and after the flip the page does not change. Motion-blurred along the turn at its fastest.
 */
export const CardFlip: FC<{ children: ReactNode; next: ReactNode; at: number; over?: boolean }> = ({ children, next, at, over = false }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const travel = useTravel();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const length = m.seconds('scene') + m.seconds('base');
  const startsOn = Math.round(at * fps);
  const endsOn = Math.round((at + length) * fps);
  const incoming = (
    <Sequence from={startsOn} layout="none">
      {next}
    </Sequence>
  );
  if (frame < startsOn) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (frame >= endsOn) return <AbsoluteFill>{incoming}</AbsoluteFill>;

  const turned = (t: number) => progress(t, at, at + length, easing.travel);
  const p = turned(m.t);
  const angle = 180 * p;
  // The card leaves the page quickly and comes back late, so it is already small when it turns side-on.
  const lifted = Math.sin(Math.PI * p) ** 0.6;
  const scale = 1 - DIP * lifted;
  const front = angle < 90;
  const shown = front ? angle : angle - 180;
  const rotate = over ? 'rotateX' : 'rotateY';
  const edgeOn = Math.abs(Math.sin((angle * Math.PI) / 180));
  const radius = (vh(brand.shape.window) * 2 * lifted) / scale;
  const size = over ? height : width;
  // The card's edge travels half the card across the frame and back: the blur follows the edge.
  const speed = travel((t) => Math.cos(Math.PI * turned(t)) * (size / 2) * (1 - DIP * Math.sin(Math.PI * turned(t))));
  return (
    <MotionBlur fill x={over ? 0 : speed} y={over ? speed : 0}>
      <AbsoluteFill style={{ perspective: LENS * Math.max(width, height), perspectiveOrigin: '50% 50%' }}>
        <Sheet
          style={{
            transformOrigin: `${width / 2}px ${height / 2}px`,
            transform: `scale(${scale}) ${rotate}(${shown}deg)`,
            borderRadius: radius,
            boxShadow:
              lifted > 0.01
                ? `0 0 0 ${1 / scale}px ${alpha(stage.line, lifted)}, 0 ${vh(SHADOW.drop) * lifted}px ${vh(SHADOW.blur) * lifted}px ${alpha(stage.shade, SHADOW.strength * lifted)}`
                : undefined,
          }}
        >
          {front ? children : incoming}
          {edgeOn > 0.01 ? <AbsoluteFill style={{ background: alpha(stage.shade, SHADE * edgeOn) }} /> : null}
        </Sheet>
      </AbsoluteFill>
    </MotionBlur>
  );
};
