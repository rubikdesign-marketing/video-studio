// Exposure bloom: the frame over-exposes into a bright bloom of the brand's light tone and comes back on the next
// scene. For a reveal or a change of mood. Flash-safe: one rise and one fall, no hard edge, and the bloom is
// strongest in the middle and weaker at the corners, so the frame is never one flat white.
// After the exposure and glow transitions of Leonxlnx/cinetic and gl-transitions (MIT), rebuilt here; no code copied.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { useBrand } from '../brand';
import { lightOf } from '../moves/core';
import { alpha } from '../tokens';
import { useVh } from '../ui';
import { useSwap } from './optics-shared';

/** How much brighter the scene gets at the peak (1 is as it was). */
const BRIGHTER = 0.9;
/** The bloom's strength at the middle and at the corners of the frame, at the peak. Never 1: no flat white frame. */
const CENTRE = 0.8;
const CORNER = 0.42;
/** The scene softens by this much at the peak, per cent of frame height, and grows by this much. */
const SOFT = 1.2;
const GROW = 0.04;

/**
 * The children are the outgoing scene; `next` is the incoming, its own clock starting at 0 as it takes over. The
 * light rises over a `base` length from `at`, the swap is hidden at its peak, and it falls over the next `base`
 * length. The light is the brand's lighter ink. It is one flash: one rise and one fall, about 0.8 s end to end.
 */
export const ExposureBloom: FC<{ children: ReactNode; next: ReactNode; at: number }> = ({ children, next, at }) => {
  const s = useSwap(at, { out: 'base', in: 'base' });
  const brand = useBrand();
  const vh = useVh();
  const light = lightOf(brand);
  const pose = (p: number) => ({
    scale: `${1 + GROW * p}`,
    filter: p > 0 ? `brightness(${1 + BRIGHTER * p}) saturate(${1 - 0.3 * p}) blur(${p * vh(SOFT)}px)` : undefined,
  });
  const p = s.showIn ? s.inward(s.t) : s.outward(s.t);
  return (
    <>
      {s.showOut ? <AbsoluteFill style={{ opacity: 1 - s.joined, ...pose(s.outward(s.t)) }}>{children}</AbsoluteFill> : null}
      {s.showIn ? (
        <AbsoluteFill style={{ opacity: s.joined, ...pose(s.inward(s.t)) }}>
          <Sequence from={s.joinOn} layout="none">
            {next}
          </Sequence>
        </AbsoluteFill>
      ) : null}
      {p > 0 ? (
        <AbsoluteFill
          style={{ background: `radial-gradient(circle at 50% 50%, ${alpha(light, CENTRE * p)} 0%, ${alpha(light, CORNER * p)} 100%)` }}
        />
      ) : null}
    </>
  );
};
