// Dip to colour: the scene dips into one of the brand's colours (its accent, or a page, never black), holds there
// for a few frames and comes out into the next scene. For a quiet change of subject where nothing is near enough to carry the eye.
// The idea is the classic dip; nothing is copied from a library.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { useBrand } from '../brand';
import { easing, progress } from '../motion';
import type { StageName } from '../tokens';
import { useStage } from '../ui';
import { Incoming, useWipe } from './wipes-shared';

/** The outgoing scene swells and the incoming one settles by this much while the colour comes and goes. */
const LEAN = 0.03;

/**
 * The children are the outgoing scene; `next` is the incoming one, its clock starting at 0 on the swap. From `at`
 * the colour comes up over a `quick` length, **holds full for a `tick` length (a few frames)**, and goes over a
 * `base` length. The scenes are swapped in the middle of the hold: **the instant change is planned and hidden
 * under the full colour**. `colour` is "accent" (default) or "page": the accent, or the page colour, of the
 * incoming page (`page`, or the current one). Flash safety: the colour changes over at least a `quick` length on
 * the way in and a `base` length on the way out, never in one frame, and it is never white unless the brand's
 * page is. Do not follow it with a bright scene on a bright colour: a light page dipping into a dark accent
 * and out to a light page is three brightness changes in about a second at most, which is within the limit.
 */
export const DipToColour: FC<{ children: ReactNode; next: ReactNode; at: number; colour?: 'accent' | 'page'; page?: StageName }> = ({
  children,
  next,
  at,
  colour = 'accent',
  page,
}) => {
  const { m, fps } = useWipe(at);
  const brand = useBrand();
  const stage = useStage();
  const palette = page ? brand.stages[page] : stage;
  const fill = colour === 'accent' ? palette.accent : palette.page;
  // Whole frames, so the hold is a whole number of frames and the swap sits inside it.
  const inFrame = Math.round((at + m.seconds('quick')) * fps);
  const outFrame = inFrame + Math.max(2, Math.round(m.seconds('tick') * fps));
  const swapFrame = inFrame + Math.floor((outFrame - inFrame) / 2);
  const endFrame = outFrame + Math.round(m.seconds('base') * fps);
  const frame = Math.round(m.t * fps);
  const t = frame / fps;
  if (frame < Math.round(at * fps)) return <>{children}</>;
  if (frame >= endFrame) return <Incoming next={next} fromFrame={swapFrame} page={page} />;
  const rise = progress(t, at, inFrame / fps, easing.travel);
  const fall = progress(t, outFrame / fps, endFrame / fps, easing.arrive);
  const cover = frame < outFrame ? rise : 1 - fall;
  return (
    <>
      {frame < swapFrame ? (
        <AbsoluteFill style={{ scale: `${1 + LEAN * rise}` }}>{children}</AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ scale: `${1 + LEAN * (1 - fall)}` }}>
          <Incoming next={next} fromFrame={swapFrame} page={page} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ backgroundColor: fill, opacity: cover }} />
    </>
  );
};
