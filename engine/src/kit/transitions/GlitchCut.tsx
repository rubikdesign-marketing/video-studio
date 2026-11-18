// Glitch cut: for a few frames the picture tears into slices that slip sideways, with two brand-coloured ghosts
// of it offset to each side, and the scene is different when it settles. Stylised: use it sparingly.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { rng, useMotion } from '../motion';
import type { StageName } from '../tokens';
import { useStage } from '../ui';
import { isDarkPage } from '../moves/core';

/** How strong the glitch is on each of its steps, 0 to 1: it builds, tears hardest in the middle and lets go. */
const STEPS = [0.35, 0.8, 1, 0.7, 0.3];
/** The cut falls on this step: the middle of the burst, while the picture is torn. */
const CUT_STEP = 2;
/** The picture is cut into this many horizontal slices. */
const SLICES = 9;
/** The most a slice slips, as a share of the frame width. */
const SLIP = 0.1;
/** How far the two ghosts sit from the picture, as a share of the frame width, at full strength. */
const SPLIT = 0.014;

const fill: CSSProperties = { position: 'absolute', inset: 0 };

/**
 * The children are the outgoing scene; `next` is the incoming one, with its own clock starting on the cut. From
 * `at` the glitch runs for five steps, each half a `tick` long. A glitch is stepped on purpose: each step is an
 * instant change, so the previews list them as planned. Which slices slip and which way is seeded (`seed`), so
 * it is the same every render. The ghosts are the scene's ink redrawn in the accent and in the second colour, offset to each side and
 * blended so the page itself is not tinted (only the writing is); slices that slip leave a bar of accent where they were.
 *
 * Flash safety: no step changes more than a third of the frame in brightness, the ghosts come on once and go
 * once, and nothing alternates light and dark. Over the whole burst of about a quarter of a second there is
 * one brightness change over the large area, not a flicker.
 */
export const GlitchCut: FC<{ children: ReactNode; next: ReactNode; at: number; seed?: number; nextPage?: StageName }> = ({
  children,
  next,
  at,
  seed = 11,
  nextPage,
}) => {
  const m = useMotion();
  const stage = useStage();
  const brand = useBrand();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const step = m.seconds('tick') / 2;
  const s = Math.floor((m.t - at) / step);
  const active = s >= 0 && s < STEPS.length;
  const cutOn = Math.round((at + CUT_STEP * step) * fps);
  const scene = frame < cutOn ? (
    children
  ) : (
    <Sequence from={cutOn} layout="none">
      {next}
    </Sequence>
  );
  if (!active) {
    return <AbsoluteFill>{scene}</AbsoluteFill>;
  }
  const strength = STEPS[s];
  const draw = rng(seed * 101 + s);
  // The slices are cut the same way every step, from the seed alone: nine bands of uneven height.
  const cuts = rng(seed);
  const weights = Array.from({ length: SLICES }, () => 0.4 + cuts());
  const total = weights.reduce((a, b) => a + b, 0);
  let top = 0;
  const bands = weights.map((w) => {
    const band = { top, bottom: top + w / total };
    top = band.bottom;
    return band;
  });
  const slips = bands.map(() => (draw() < 0.25 + 0.4 * strength ? (draw() < 0.5 ? -1 : 1) * (0.25 + 0.75 * draw()) * SLIP * strength * width : 0));
  const dark = isDarkPage(stage);
  const outgoing = dark ? 'dark' : 'light';
  const incoming: StageName = nextPage ?? (outgoing === 'dark' ? 'light' : 'dark');
  // The ghosts are blended for the page that is showing: the outgoing one before the cut, the incoming one after.
  const pageNow = frame < cutOn ? outgoing : incoming;
  const darkNow = pageNow === 'dark';
  const ghost = (colour: string, shift: number): CSSProperties => ({
    ...fill,
    translate: `${shift}px 0`,
    opacity: 0.55,
    mixBlendMode: darkNow ? 'screen' : 'multiply',
    backgroundColor: colour,
    isolation: 'isolate',
  });
  const split = SPLIT * width * strength;
  return (
    <AbsoluteFill>
      <AbsoluteFill>{scene}</AbsoluteFill>
      {s >= 1 && s <= 3 ? (
        <>
          <div style={ghost(stage.accent, -split)}>
            <div style={{ ...fill, mixBlendMode: darkNow ? 'multiply' : 'screen', backgroundColor: brand.stages[pageNow].page }}>{scene}</div>
          </div>
          <div style={ghost(stage.second, split)}>
            <div style={{ ...fill, mixBlendMode: darkNow ? 'multiply' : 'screen', backgroundColor: brand.stages[pageNow].page }}>{scene}</div>
          </div>
        </>
      ) : null}
      {bands.map((band, i) =>
        slips[i] === 0 ? null : (
          <div key={i} style={{ ...fill, clipPath: `inset(${band.top * height}px 0 ${height - band.bottom * height}px 0)`, translate: `${slips[i]}px 0` }}>
            {scene}
            <div
              style={{
                position: 'absolute',
                top: band.top * height,
                height: (band.bottom - band.top) * height,
                width: Math.abs(slips[i]) * 0.18,
                [slips[i] > 0 ? 'left' : 'right']: 0,
                backgroundColor: brand.stages[pageNow].accent,
              }}
            />
          </div>
        ),
      )}
    </AbsoluteFill>
  );
};
