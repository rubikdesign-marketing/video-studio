// Feather wipe: a soft-edged wipe crosses the frame at an angle and the next scene is behind it. For a gentle
// reveal, before to after. The idea is gl-transitions' (MIT) directional wipe with a soft edge, done with a CSS mask.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import type { Side } from '../moves/core';
import type { StageName } from '../tokens';
import { direction, Incoming, smooth, useWipe } from './wipes-shared';

/** The soft edge is this share of the distance the wipe crosses. */
const FEATHER = 0.24;
/** How many steps the soft edge is drawn in: enough that no step shows. */
const STEPS = 10;
/** The scenes lean in or out by this much while it crosses, so neither is flat. */
const LEAN = 0.035;

/**
 * The children are the outgoing scene; `next` is the incoming one, its clock starting at 0 when the wipe starts.
 * From `at` a soft edge travels towards `side`, tilted `angle` degrees (default 18), over a `scene` length; the
 * incoming scene shows behind it. The outgoing scene swells a little and the incoming one settles from a little
 * larger, so both move all the way through. The edge starts and ends outside the frame: it is never a hard cut,
 * and the frame is never empty. No instant change.
 */
export const FeatherWipe: FC<{ children: ReactNode; next: ReactNode; at: number; side?: Side; angle?: number; page?: StageName }> = ({
  children,
  next,
  at,
  side = 'right',
  angle = 18,
  page,
}) => {
  const { u, width, height, fps, done, started } = useWipe(at);
  const fromFrame = Math.round(at * fps);
  if (!started) return <>{children}</>;
  if (done) return <Incoming next={next} fromFrame={fromFrame} page={page} />;
  const way = direction(side, angle);
  // The mask's gradient line is as long as the frame is along the way of the wipe.
  const reach = width * Math.abs(way.x) + height * Math.abs(way.y);
  const soft = reach * FEATHER;
  const edge = u * (reach + soft);
  const css = (Math.atan2(way.x, -way.y) * 180) / Math.PI;
  const stops = Array.from({ length: STEPS + 1 }, (_, k) => `rgba(0, 0, 0, ${(1 - smooth(k / STEPS)).toFixed(4)}) ${(edge - soft + (soft * k) / STEPS).toFixed(1)}px`);
  const mask = `linear-gradient(${css.toFixed(3)}deg, black ${(edge - soft).toFixed(1)}px, ${stops.join(', ')}, transparent ${edge.toFixed(1)}px)`;
  return (
    <>
      <AbsoluteFill style={{ scale: `${1 + LEAN * 0.85 * u}` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <AbsoluteFill style={{ scale: `${1 + LEAN * (1 - u)}` }}>
          <Incoming next={next} fromFrame={fromFrame} page={page} />
        </AbsoluteFill>
      </AbsoluteFill>
    </>
  );
};
