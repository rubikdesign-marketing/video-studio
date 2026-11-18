// Film burn: a burn spreads in from one edge of the frame, ragged like film catching fire, with a scorched
// edge, an orange glow and a hot rim; the next scene is behind it. Stylised: use it sparingly.
//
// One SVG feTurbulence noise field is tilted by a gradient across the frame (strongest at the edge the burn
// starts from) and cut at four levels that fall over time: the scorch, the glow, the rim and the next scene.
import { useId, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { clamp01, easing, useMotion } from '../motion';
import { useStage } from '../ui';
import { lightOf } from '../moves/core';

/** The share of the noise in the field and the share of the edge gradient. */
const NOISE = 0.5;
const EDGE_SHARE = 0.55;
/** The level the field is cut at, when nothing has burned and when everything has. The field runs from about 0.1 to 1. */
const FROM = 1.15;
const TO = 0.02;
/** How steep a cut is. */
const STEEP = 34;
/** How far behind the burn's leading level each layer's own level is, in field units: rim, glow, scorch. */
const LAYERS = { rim: 0.035, glow: 0.1, scorch: 0.19 };

export type BurnFrom = 'left' | 'right' | 'top' | 'bottom';

/**
 * The children are the outgoing scene; `next` is the incoming one, with its own clock starting on `at` (it is
 * behind the burn from the first frame). From `at` the burn spreads from the edge `from` over three quarters of a `hero` length. Its
 * colours are the brand's: scorch is the dark page's near-black, the glow its warm note, the hot rim the accent
 * lifted toward the lightest ink.
 *
 * Flash safety: the burn is a front that sweeps once and never a pulse; the rim is thin, the glow and scorch are
 * not brighter than the pages either side, so each part of the frame changes once and no large area flashes.
 */
export const FilmBurn: FC<{ children: ReactNode; next: ReactNode; at: number; from?: BurnFrom; seed?: number }> = ({ children, next, at, from = 'left', seed = 5 }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const { width, height, fps } = useVideoConfig();
  const id = `burn${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const startOn = Math.round(at * fps);
  const length = m.seconds('hero') * 0.75;
  const u = clamp01((m.t - at) / length);
  const over = u >= 1;
  if (m.t < at) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }
  const level = FROM + (TO - FROM) * easing.travel(Math.min(1, u / 0.9));
  const slope = (at: number) => `0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  ${STEEP} 0 0 0 ${-STEEP * at}`;
  const base = 4 / Math.min(width, height);
  // A gradient that is white at the edge the burn comes from and black across the frame, as a still image.
  const [x1, y1, x2, y2] = { left: [0, 0, 1, 0], right: [1, 0, 0, 0], top: [0, 0, 0, 1], bottom: [0, 1, 0, 0] }[from];
  const gradient = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  )}`;
  const hot = lightOf(brand);
  return (
    <>
      {over ? null : <AbsoluteFill>{children}</AbsoluteFill>}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id={id} filterUnits="userSpaceOnUse" x={0} y={0} width={width} height={height} colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={`${base} ${base}`} numOctaves={4} seed={seed} result="noise" />
          <feImage href={gradient} x={0} y={0} width={width} height={height} preserveAspectRatio="none" result="edge" />
          <feComposite in="noise" in2="edge" operator="arithmetic" k1={0} k2={NOISE} k3={EDGE_SHARE} k4={0} result="field" />
          <feColorMatrix in="field" type="matrix" values={slope(level)} result="next" />
          <feColorMatrix in="field" type="matrix" values={slope(level - LAYERS.rim)} result="rimAt" />
          <feColorMatrix in="field" type="matrix" values={slope(level - LAYERS.glow)} result="glowAt" />
          <feColorMatrix in="field" type="matrix" values={slope(level - LAYERS.scorch)} result="scorchAt" />
          <feFlood floodColor={brand.stages.dark.page} result="scorchColour" />
          <feComposite in="scorchColour" in2="scorchAt" operator="in" result="scorch" />
          <feFlood floodColor={stage.warm.slice(0, 7)} result="glowColour" />
          <feComposite in="glowColour" in2="glowAt" operator="in" result="glow" />
          <feFlood floodColor={hot} result="rimColour" />
          <feComposite in="rimColour" in2="rimAt" operator="in" result="rim" />
          <feComposite in="SourceGraphic" in2="next" operator="in" result="scene" />
          <feMerge>
            <feMergeNode in="scorch" />
            <feMergeNode in="glow" />
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
