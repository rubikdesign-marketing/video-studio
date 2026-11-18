// Ink bleed: the next scene bleeds in through organic blots that start at a few points, swell and merge until
// they fill the frame, each with a thin rim of the brand's accent like ink soaking into paper. Stylised: use
// it sparingly, on soft, handmade, human subjects.
//
// The blots are one SVG feTurbulence noise field (seeded) cut at a level that falls over time: where the noise is
// above the level the next scene shows. Lower the level and the blots grow, touch and merge.
import { useId, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { clamp01, easing, useMotion } from '../motion';
import { useStage } from '../ui';

/** The level the noise is cut at, when nothing shows and when everything does. Noise runs from about 0.3 to 0.7. */
const FROM = 0.8;
const TO = 0.18;
/** How sharp the blot's edge is (the steepness of the cut). Higher is crisper. */
const EDGE = 14;
/** The bleed lasts this share of a `hero` length, and the blots have filled the frame by this share of that. */
const LENGTH = 0.75;
const FILLED = 0.82;
/** How wide the accent rim is, in noise units. */
const RIM = 0.045;

/**
 * The children are the outgoing scene; `next` is the incoming one, with its own clock starting on `at` (it is
 * on screen, inside the blots, from the first frame they have any size). From `at` the blots grow over three quarters of a `hero` length, slowest
 * to start and fastest through the middle, as ink does. `seed` changes where the blots start. The noise is
 * scaled to the frame's shorter side, so the blots are the same size in every format.
 *
 * Flash safety: nothing flashes. The accent rim is a thin line, and every part of the frame changes once, as a
 * blot reaches it.
 */
export const InkBleed: FC<{ children: ReactNode; next: ReactNode; at: number; seed?: number }> = ({ children, next, at, seed = 8 }) => {
  const m = useMotion();
  const stage = useStage();
  const { width, height, fps } = useVideoConfig();
  const id = `ink${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const startOn = Math.round(at * fps);
  const length = m.seconds('hero') * LENGTH;
  const u = clamp01((m.t - at) / length);
  const over = u >= 1;
  if (m.t < at) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }
  const level = FROM + (TO - FROM) * easing.travel(Math.min(1, u / FILLED));
  // The rim fades before the blots are through, so nothing of it is left on the new scene.
  const rim = 1 - clamp01((u - 0.55) / 0.3);
  const cut = (at: number) => `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${EDGE} 0 0 0 ${-EDGE * at}`;
  const base = 4.5 / Math.min(width, height);
  return (
    <>
      {over ? null : <AbsoluteFill>{children}</AbsoluteFill>}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id={id} filterUnits="userSpaceOnUse" x={0} y={0} width={width} height={height} colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={`${base} ${base}`} numOctaves={4} seed={seed} result="noise" />
          <feColorMatrix in="noise" type="matrix" values={cut(level)} result="blots" />
          <feColorMatrix in="noise" type="matrix" values={cut(level - RIM)} result="wider" />
          <feFlood floodColor={stage.accent} floodOpacity={rim} result="ink" />
          <feComposite in="ink" in2="wider" operator="in" result="rim" />
          <feComposite in="SourceGraphic" in2="blots" operator="in" result="scene" />
          <feMerge>
            <feMergeNode in="rim" />
            <feMergeNode in="scene" />
          </feMerge>
        </filter>
      </svg>
      <AbsoluteFill style={{ filter: over ? undefined : `url(#${id})` }}>
        <Sequence from={startOn} layout="none">
          {next}
        </Sequence>
      </AbsoluteFill>
    </>
  );
};
