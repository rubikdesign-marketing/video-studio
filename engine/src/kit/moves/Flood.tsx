// Flood: a control floods the frame with the other page colour (a toggle flips and its knob's colour covers
// everything), and the next scene starts on the new page. Measured in liked product films: a toggle flip of 0.18 s,
// a flood of about 0.2 to 0.35 s grown past the farthest corner, the next headline about 0.15 s after full cover
// (revid:15, pm-221cab). The flood can then contract into the next object, carrying the next scene inside it. It
// is also the one way craft file 13 allows a film to move from one design family to another.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { easing, lerp, progress, useMotion, type Point } from '../motion';
import type { StageName } from '../tokens';
import { Panel, useVh } from '../ui';
import type { Rect } from './core';

/** Seconds at the confident preset. The flood grows over 0.32 s: fast enough to feel caused, slow enough not to flash. */
const GROW = 0.32;
/** The next scene starts this long after the frame is fully covered. */
const NEXT_AFTER = 0.15;
/** The circle grows to the farthest corner and this share again, so its edge never shows in the last frames. */
const PAST = 0.1;

const isRect = (p: Point | Rect): p is Rect => 'width' in p;

/**
 * Covers the frame from `from` (a point, or the rect of the control: its middle is used, and the circle starts at
 * its size) with the brand's `page`, starting at `at` on the scene clock. Put it after the scene it covers. The
 * children are the next scene, painted on the new page; their clock starts 0.15 s after full cover, so their cues
 * start from 0 there. With `contract`, the page later shrinks into `contract.to` (pixels; corners of `radius` per
 * cent of frame height), carrying the next scene inside it, scaled down whole: the flood becomes the next object.
 */
export const Flood: FC<{
  from: Point | Rect;
  at: number;
  page: StageName;
  children?: ReactNode;
  contract?: { at: number; to: Rect; radius?: number };
  style?: CSSProperties;
}> = ({ from, at, page, children, contract, style }) => {
  const m = useMotion();
  const vh = useVh();
  const { width, height, fps } = useVideoConfig();
  const scale = m.preset.length;
  const grow = GROW * scale;
  const c = isRect(from) ? { x: from.x + from.width / 2, y: from.y + from.height / 2 } : from;
  const startR = isRect(from) ? Math.min(from.width, from.height) / 2 : 0;
  const farthest = Math.max(...[[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => Math.hypot(x - c.x, y - c.y))) * (1 + PAST);
  if (m.t < at) return null;
  const u = progress(m.t, at, at + grow, easing.travel);
  const covered = u >= 1;
  const R = lerp(startR, farthest, u);

  // The contraction: the full page shrinks into the target, and what is on it shrinks with it.
  const k = contract ? progress(m.t, contract.at, contract.at + m.seconds('base'), easing.travel) : 0;
  const to = contract?.to;
  const shrink = to ? lerp(1, Math.min(to.width / width, to.height / height), k) : 1;
  const inset = to ? [to.y, width - to.x - to.width, height - to.y - to.height, to.x].map((edge) => lerp(0, edge, k)) : [0, 0, 0, 0];
  const round = contract ? lerp(0, vh(contract.radius ?? 0), k) : 0;
  const clip = !covered ? `circle(${R}px at ${c.x}px ${c.y}px)` : k > 0 ? `inset(${inset.map((e) => `${e}px`).join(' ')} round ${round}px)` : undefined;
  // The content moves with the page: its middle goes to the target's middle as the page shrinks round it.
  const middle = to ? { x: lerp(width / 2, to.x + to.width / 2, k), y: lerp(height / 2, to.y + to.height / 2, k) } : { x: width / 2, y: height / 2 };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', ...style }}>
      <Panel name={page} style={{ position: 'absolute', inset: 0, clipPath: clip }}>
        <AbsoluteFill style={{ translate: `${middle.x - width / 2}px ${middle.y - height / 2}px`, scale: `${shrink}` }}>
          <Sequence from={Math.round((at + grow + NEXT_AFTER) * fps)} layout="absolute-fill">
            {children}
          </Sequence>
        </AbsoluteFill>
      </Panel>
    </AbsoluteFill>
  );
};
