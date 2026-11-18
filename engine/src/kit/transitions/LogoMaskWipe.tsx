// Logo mask wipe: the brand's mark opens in the middle of the frame as a window onto the next scene, then grows
// until the window is the whole frame. For the move into the brand's closing frame, or out of the opening one.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { usePagePaint } from './sheet';

/** The mark opens to this height, as a share of the frame's shorter side, before it grows. */
const OPENS_TO = 0.26;
/** It grows until it is this many frame diagonals tall: enough for a solid part of most marks to cover the frame. */
const GROWS_TO = 14;
/** The scene seen through the mark settles from this much larger. */
const THROUGH = 0.14;
/** Outside the mark the frame is shaded this much while it is open, so the mark reads on a page of one colour. */
const DIM = 0.35;
/** The outgoing scene is pushed forward this much as the mark grows past it. */
const PUSHED = 0.08;

/**
 * The children are the outgoing scene; `next` is the incoming, with its clock starting at 0 when the mark opens
 * on `at`. The mark is the brand's own symbol (the dark page's mark file, whose clear parts are the shape; the
 * light page's may be a filled tile), used only as a shape: the next scene is seen through it, in its own colours.
 *
 * From `at` the mark opens in the middle of the frame over a `base` length, settling to about a quarter of the
 * frame's short side. After a `tick` it grows, even in ratio, over a `scene` and a `base` length (about 1.15 s),
 * around `focus`: a point of the mark given from its middle in mark heights (default its middle), which should lie
 * in a solid part of the mark; that point drifts to the middle of the frame as the mark grows. In the last `tick`
 * whatever is left of the outgoing scene in the mark's gaps fades, so no sliver is cut on the last frame. While
 * the mark is open the frame outside it is shaded, lifting as it grows, so a mark on a page of one colour is seen. The
 * outgoing scene is pushed forward and the next settles from larger, so both move all the way.
 */
export const LogoMaskWipe: FC<{ children: ReactNode; next: ReactNode; at: number; focus?: { x: number; y: number } }> = ({
  children,
  next,
  at,
  focus = { x: 0, y: 0 },
}) => {
  const m = useMotion();
  const brand = useBrand();
  const paint = usePagePaint();
  const stage = useStage();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const src = staticFile(brand.stages.dark.mark);
  const startsOn = Math.round(at * fps);
  const grows = at + m.seconds('base') + m.seconds('tick');
  const length = m.seconds('scene') + m.seconds('base');
  const endsOn = Math.round((grows + length) * fps);
  const through = progress(m.t, at, grows + length + m.seconds('base'), easing.arrive);
  const incoming = (
    <Sequence from={startsOn} layout="none">
      <AbsoluteFill style={{ scale: `${1 + THROUGH * (1 - through)}` }}>{next}</AbsoluteFill>
    </Sequence>
  );
  // The mark file is loaded before the first frame that needs it (Img holds the render until it has loaded).
  const preload = <Img src={src} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />;
  if (frame < startsOn)
    return (
      <AbsoluteFill>
        {children}
        {preload}
      </AbsoluteFill>
    );
  if (frame >= endsOn) return <AbsoluteFill>{incoming}</AbsoluteFill>;

  const short = Math.min(width, height);
  const opened = OPENS_TO * short * Math.max(0, m.settle(at, 'base'));
  const grown = progress(m.t, grows, grows + length, easing.travel);
  const final = GROWS_TO * Math.hypot(width, height);
  const markHeight = opened * Math.exp(Math.log(final / (OPENS_TO * short)) * grown);
  // The focus point starts where it lies in the opened mark and drifts to the middle of the frame.
  const fx = width / 2 + focus.x * OPENS_TO * short * (1 - grown);
  const fy = height / 2 + focus.y * OPENS_TO * short * (1 - grown);
  const mx = fx - focus.x * markHeight - width / 2;
  const my = fy - focus.y * markHeight - height / 2;
  const mask = {
    maskImage: `url("${src}")`,
    maskSize: `auto ${markHeight}px`,
    maskRepeat: 'no-repeat',
    maskPosition: `calc(50% + ${mx}px) calc(50% + ${my}px)`,
    WebkitMaskImage: `url("${src}")`,
    WebkitMaskSize: `auto ${markHeight}px`,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: `calc(50% + ${mx}px) calc(50% + ${my}px)`,
  };
  const last = progress(m.t, grows + length - m.seconds('tick'), grows + length, easing.leave);
  return (
    <AbsoluteFill>
      {preload}
      <AbsoluteFill style={{ scale: `${1 + PUSHED * grown}`, opacity: 1 - last }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: alpha(stage.shade, DIM * Math.max(0, m.settle(at, 'base')) * (1 - grown) * (1 - last)) }} />
      {markHeight > 0.5 ? <AbsoluteFill style={{ ...paint, ...mask }}>{incoming}</AbsoluteFill> : null}
      {last > 0 ? <AbsoluteFill style={{ ...paint, opacity: last }}>{incoming}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
