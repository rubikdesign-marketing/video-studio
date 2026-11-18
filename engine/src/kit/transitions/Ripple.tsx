// Ripple: a ripple spreads from a point; inside the wavefront the next scene has already arrived, and the ring
// itself bends whatever is under it like the surface of water. Stylised: use it sparingly.
//
// The bending is an SVG feTurbulence + feDisplacementMap filter whose noise is morphed by the scene clock, laid
// over the ring only (a soft ring-shaped mask). The ring's lit and shadowed edges are drawn gradients.
import { useId, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { clamp01, easing, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { lightOf } from '../moves/core';

/** How wide the ring is, as a share of the frame's height. */
const RING = 0.16;
/** The most the ring bends the picture, as a share of the frame's height. */
const BEND = 0.035;

/**
 * The children are the outgoing scene; `next` is the incoming one, with its own clock starting on `at` (it is
 * on screen, inside the ring, from the first frame the ring has any size). `origin` is where the ripple starts, as shares
 * of the frame (the middle if left out). From `at` the ring spreads over a `hero` length until it has left the
 * frame on every side, slowing as it goes.
 *
 * Flash safety: nothing brightens. The ring's light and shade edges are faint (about a fifth) and move, so no
 * area of the frame changes brightness more than once; the page change itself is the one brightness step.
 */
export const Ripple: FC<{ children: ReactNode; next: ReactNode; at: number; origin?: { x: number; y: number }; seed?: number }> = ({
  children,
  next,
  at,
  origin = { x: 0.5, y: 0.5 },
  seed = 3,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const { width, height, fps } = useVideoConfig();
  const id = `ripple${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const length = m.seconds('hero');
  const startOn = Math.round(at * fps);
  const u = clamp01((m.t - at) / length);
  const cx = origin.x * width;
  const cy = origin.y * height;
  const ring = RING * height;
  const reach = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy)) + ring * 1.2;
  const radius = u === 0 ? 0 : easing.travel(u) * reach;
  const over = u >= 1;
  const wave = (frontStops: string) => `radial-gradient(circle at ${cx}px ${cy}px, ${frontStops})`;
  const px = (v: number) => `${Math.max(0, v)}px`;
  // The ring: transparent until three quarters of a width behind the front, full strength just behind it, gone a little ahead.
  const mask = wave(
    `transparent ${px(radius - ring)}, #000 ${px(radius - ring * 0.45)}, #000 ${px(radius - ring * 0.05)}, transparent ${px(radius + ring * 0.2)}`,
  );
  const light = lightOf(brand);
  // The ring's light edge sits at the front and its shade edge a third of a width behind: a crest and a trough.
  const crest = wave(
    `transparent ${px(radius - ring * 0.5)}, ${alpha(stage.shade, 0.18)} ${px(radius - ring * 0.36)}, transparent ${px(radius - ring * 0.2)}, ${alpha(light, 0.3)} ${px(radius - ring * 0.04)}, transparent ${px(radius + ring * 0.08)}`,
  );
  // Both scenes at once: the next one only inside the circle.
  const both = (
    <>
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `circle(${radius}px at ${cx}px ${cy}px)` }}>
        <Sequence from={startOn} layout="none">
          {next}
        </Sequence>
      </AbsoluteFill>
    </>
  );
  if (over) {
    return (
      <Sequence from={startOn} layout="none">
        {next}
      </Sequence>
    );
  }
  // The noise is stretched a little sideways and drifts with the clock, so the water seems to move.
  const base = 5 / height;
  const drift = 1 + 0.18 * Math.sin(m.t * 5);
  const amount = BEND * height * (1 - 0.5 * u);
  if (m.t < at) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }
  return (
    <>
      {(
        <>
          <svg width={0} height={0} style={{ position: 'absolute' }}>
            <filter id={id} filterUnits="userSpaceOnUse" x={0} y={0} width={width} height={height} colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency={`${base * drift} ${base * 1.5 * drift}`} numOctaves={2} seed={seed} result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={amount} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </svg>
          {both}
          <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask }}>
            <AbsoluteFill style={{ filter: `url(#${id})` }}>{both}</AbsoluteFill>
          </AbsoluteFill>
          <AbsoluteFill style={{ backgroundImage: crest }} />
        </>
      )}
    </>
  );
};
