// Light leak: a warm wash of light crosses the frame at the cut, tinted toward the brand's accent, and the scene
// is different once it has passed. Stylised: use it sparingly (once a film, on a warm, human beat).
//
// @remotion/light-leaks (4.0.543) was checked first. Its leak is frame-pure, but it is a fixed yellow and orange
// that can only be turned around the colour wheel (hueShift), so it cannot be tinted to a brand's accent, and the
// package marks it as replaced by `lightLeak()` in @remotion/effects. This one is drawn from gradients instead.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { clamp01, easing, lerp, rng, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useGrainShare, useStage } from '../ui';
import { lightOf } from '../moves/core';

/** How strong the wash is at its peak. Below full, so the leak never turns the frame to a flat sheet of colour. */
const PEAK = 0.97;
/** The blobs of light: where each sits across the leak's path, its colour role and its size, as shares of the frame. */
const BLOBS = 5;

/**
 * The children are the outgoing scene; `next` is the incoming one, with its own clock starting on the cut. From
 * `at` a leak builds over half of three quarters of a `hero` length, the scene swaps at its peak, as a dissolve a `tick` long hidden
 * inside the wash and the leak clears over the other half. The light drifts left to right, in the accent
 * with a warmer edge and a pale hot core.
 *
 * Flash safety: the wash rises and falls once, smoothly, over about a second and a half and never reaches white, so it is one slow
 * brightness change and not a flash. `seed` changes the shape of the leak.
 */
export const LightLeak: FC<{ children: ReactNode; next: ReactNode; at: number; seed?: number }> = ({ children, next, at, seed = 4 }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const length = m.seconds('hero') * 0.75;
  // The cut is a short dissolve inside the wash, a `tick` long, so that no frame of the swap is seen as a jump.
  const mid = at + length / 2;
  const swapFrom = Math.round((mid - m.seconds('tick') / 2) * fps);
  const swapTo = Math.round((mid + m.seconds('tick') / 2) * fps);
  const u = clamp01((m.t - at) / length);
  const strength = Math.pow(Math.sin(Math.PI * u), 1.1);
  const front = lerp(-0.2, 1.2, easing.travel(u));
  const light = lightOf(brand);
  const roles = [stage.accent, stage.warm, stage.accent, stage.warm, stage.accent];
  const draw = rng(seed);
  const blobs = Array.from({ length: BLOBS }, (_, i) => {
    const across = front + (draw() - 0.5) * 0.5;
    const wide = width * (0.4 + draw() * 0.35);
    const tall = height * (0.55 + draw() * 0.5);
    const at_y = height * (0.1 + draw() * 0.8);
    return { x: across * width, y: at_y, wide, tall, colour: roles[i % roles.length] };
  });
  const glow = blobs
    .map((b) => `radial-gradient(ellipse ${b.wide}px ${b.tall}px at ${b.x}px ${b.y}px, ${alpha(b.colour, 0.95)} 0%, ${alpha(b.colour, 0.55)} 38%, ${alpha(b.colour, 0)} 72%)`)
    .join(', ');
  const core = `radial-gradient(ellipse ${width * 0.3}px ${height * 0.7}px at ${front * width}px ${height * 0.45}px, ${alpha(light, 0.55)} 0%, ${alpha(light, 0)} 70%)`;
  // Over a saturated wash the stage's grain would read several times stronger: ask for less of it.
  useGrainShare(1 - 0.6 * strength);
  const showing = m.t >= at && u < 1;
  return (
    <>
      {frame < swapTo ? <AbsoluteFill>{children}</AbsoluteFill> : null}
      {frame >= swapFrom ? (
        <AbsoluteFill style={{ opacity: frame >= swapTo ? 1 : (frame - swapFrom) / Math.max(1, swapTo - swapFrom) }}>
          <Sequence from={swapFrom} layout="none">
            {next}
          </Sequence>
        </AbsoluteFill>
      ) : null}
      {showing ? (
        <AbsoluteFill style={{ opacity: strength * PEAK }}>
          <AbsoluteFill style={{ backgroundColor: alpha(stage.accent, 0.9 * strength) }} />
          <AbsoluteFill style={{ backgroundImage: glow }} />
          <AbsoluteFill style={{ backgroundImage: core, opacity: 0.8 }} />
        </AbsoluteFill>
      ) : null}
    </>
  );
};
