// Panel wipe: a solid panel in the brand's accent sweeps across the frame, and the next scene is there as the panel
// leaves. For a strong change of chapter on a beat. The idea is the common colour-panel wipe (see also gl-transitions' wipes, MIT), with the brand as the panel.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { useBrand } from '../brand';
import { MotionBlur, towards, useTravel, type Side } from '../moves/core';
import { easing, progress } from '../motion';
import type { StageName } from '../tokens';
import { useStage } from '../ui';
import { bandBox, firstFrame, Incoming, isAcross, useWipe } from './wipes-shared';

/** The accent panel is this much longer than the frame is wide, so it covers the whole frame for a few frames. */
const PANEL = 1.3;
/** The trailing page-coloured panel is this share of the frame. */
const TRAIL = 0.4;
/** The scenes are swapped when the panel's front edge is this far across, as a share of the frame (1 is the far edge): the middle of the covered stretch. */
const SWAP = (1 + PANEL) / 2;
/** The outgoing scene swells and the incoming one settles by this much. */
const LEAN = 0.04;

/**
 * The children are the outgoing scene; `next` is the incoming one, its clock starting at 0 on the swap. From `at`
 * a panel in the accent travels towards `side` over a `scene` length, leading edge first, and covers the whole
 * frame for a few frames. The scenes are swapped in the middle of that: **the instant change is planned and
 * hidden under the panel**, so what the viewer sees is the panel crossing and the new scene coming out from
 * behind it. With `trail` a second panel in the incoming page's colour follows the accent one (accent, then the
 * page), so the new page is already the colour of the frame as the accent leaves. Blurred along its way.
 * Give `page` when the incoming scene is on the brand's other page.
 */
export const PanelWipe: FC<{ children: ReactNode; next: ReactNode; at: number; side?: Side; trail?: boolean; page?: StageName }> = ({
  children,
  next,
  at,
  side = 'right',
  trail = false,
  page,
}) => {
  const { width, height, fps, end, started, done, m } = useWipe(at);
  const brand = useBrand();
  const travel = useTravel();
  const stage = useStage();
  const reach = isAcross(side) ? width : height;
  const trailColour = (page ? brand.stages[page] : stage).page;
  const sweep = reach * (1 + PANEL + (trail ? TRAIL : 0));
  const edgeAt = (t: number) => progress(t, at, end, easing.travel) * sweep;
  const swapFrame = firstFrame(fps, at, end, (t) => edgeAt(t) >= reach * SWAP);
  if (!started) return <>{children}</>;
  if (done) return <Incoming next={next} fromFrame={swapFrame} page={page} />;
  const edge = edgeAt(m.t);
  const speed = travel(edgeAt);
  const way = towards[side];
  const frame = Math.round(m.t * fps);
  const after = Math.min(1, Math.max(0, (frame - swapFrame) / Math.max(1, Math.round(end * fps) - swapFrame)));
  const band = (from: number, to: number, colour: string) => (
    <div style={{ position: 'absolute', backgroundColor: colour, ...bandBox(side, from, to, width, height) }} />
  );
  return (
    <>
      {frame >= swapFrame ? (
        <AbsoluteFill style={{ scale: `${1 + LEAN * (1 - after)}` }}>
          <Incoming next={next} fromFrame={swapFrame} page={page} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ scale: `${1 + LEAN * Math.min(1, edge / (reach * SWAP))}` }}>{children}</AbsoluteFill>
      )}
      <MotionBlur fill x={speed * way.x} y={speed * way.y}>
        {band(edge - reach * PANEL, edge, stage.accent)}
        {trail ? band(edge - reach * (PANEL + TRAIL), edge - reach * PANEL, trailColour) : null}
      </MotionBlur>
    </>
  );
};
