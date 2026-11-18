// Blinds: the next scene is seen through slices that open one after another, like venetian blinds. For a
// rhythmic reveal on a list, a grid or a before and after. The idea is gl-transitions' (MIT) "windowblinds", done with a mask.
// The studio's craft file lists slat and blind wipes as generic: use this one only where the rhythm is the point.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { clamp01, easing, progress } from '../motion';
import type { Side } from '../moves/core';
import type { StageName } from '../tokens';
import { Incoming, isAcross, useWipe } from './wipes-shared';

/** The incoming scene settles from this much larger while the slices open. */
const LEAN = 0.03;

/**
 * The children are the outgoing scene; `next` is the incoming one, its clock starting at 0 when the first slice
 * starts. The frame is cut into `count` slices (default 8): columns when `direction` is "left" or "right", rows
 * when it is "up" or "down" (default "right"). From `at` each slice opens from its own middle, over a `base`
 * length, one `stagger` after the one before it, starting at the side `direction` comes from. The whole move
 * takes a `base` length plus one stagger for each slice after the first. The outgoing scene is never moved or
 * dimmed. A slice within two pixels of open is drawn fully open and overlaps its neighbours by a pixel, so no hairline of the old scene shows between them. No instant change.
 */
export const Blinds: FC<{ children: ReactNode; next: ReactNode; at: number; count?: number; direction?: Side; page?: StageName }> = ({
  children,
  next,
  at,
  count = 8,
  direction = 'right',
  page,
}) => {
  const { m, width, height, fps } = useWipe(at, 'base');
  const gap = m.stagger;
  const end = at + m.seconds('base') + gap * (count - 1);
  const fromFrame = Math.round(at * fps);
  if (m.t < at) return <>{children}</>;
  if (m.t >= end) return <Incoming next={next} fromFrame={fromFrame} page={page} />;
  const across = isAcross(direction);
  const reversed = direction === 'left' || direction === 'up';
  const size = (across ? width : height) / count;
  const rects = Array.from({ length: count }, (_, i) => {
    const order = reversed ? count - 1 - i : i;
    const open = progress(m.t, at + order * gap, at + order * gap + m.seconds('base'), easing.travel);
    if (open <= 0) return null;
    // A slice that is within two pixels of fully open is drawn fully open and a pixel over on each side, so the
    // easing's long tail never leaves a hairline of the old scene between neighbours.
    const shut = (1 - clamp01(open)) * size >= 2;
    const lap = shut ? 0 : 2;
    const along = shut ? open * size : size + lap;
    const start = shut ? i * size + (size - open * size) / 2 : i * size - lap / 2;
    return across ? `<rect x="${start.toFixed(2)}" y="0" width="${along.toFixed(2)}" height="${height}"/>` : `<rect x="0" y="${start.toFixed(2)}" width="${width}" height="${along.toFixed(2)}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g fill="black">${rects.join('')}</g></svg>`;
  const mask = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  const share = clamp01((m.t - at) / (end - at));
  return (
    <>
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask, maskSize: `${width}px ${height}px`, WebkitMaskSize: `${width}px ${height}px`, maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' }}>
        <AbsoluteFill style={{ scale: `${1 + LEAN * (1 - share)}` }}>
          <Incoming next={next} fromFrame={fromFrame} page={page} />
        </AbsoluteFill>
      </AbsoluteFill>
    </>
  );
};
