// Line draw: a line draws itself along a path, and its end mark appears last. For a trend, or to connect two
// things (the second thing reacts once the line has reached it).
import type { FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion, type Point, type TimingToken } from '../motion';
import { useStage, useVh } from '../ui';
import { pathThrough, useGrowth, voiceStyle } from './core';

/** Half the length of the end mark, as a percentage of frame height. */
const MARK = 1.5;

/**
 * A line through `points` (pixels in its parent, like a cursor path), drawn from `at` over a `scene` length, or a
 * shorter `over` for a connector. When it arrives, a short stroke across its end lands with one small overshoot,
 * and `label` (a value, in the accent) appears above it. With the same `at` and `over` as a Count, the line and
 * the number finish on the same frame. The parent must be positioned.
 */
export const LineDraw: FC<{
  points: [Point, Point, ...Point[]];
  at: number;
  out?: number;
  over?: TimingToken;
  curve?: boolean;
  weight?: number;
  mark?: boolean;
  label?: string;
}> = ({ points, at, out, over = 'scene', curve = false, weight = 0.6, mark = true, label }) => {
  const m = useMotion();
  const fonts = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  const { grown, end: endsAt } = useGrowth(at, over);
  const quick = m.seconds('quick');
  const exit = out === undefined ? 0 : progress(m.t, out, out + quick * EXIT_SHARE, easing.leave);
  if (grown <= 0) return null;

  const [last, previous] = [points[points.length - 1], points[points.length - 2]];
  const run = Math.hypot(last.x - previous.x, last.y - previous.y) || 1;
  // The end mark crosses the line at right angles. It grows from the middle: scale, so a spring is allowed.
  const half = vh(MARK) * m.settle(endsAt, 'quick');
  const across = { x: (-(last.y - previous.y) / run) * half, y: ((last.x - previous.x) / run) * half };
  // Square ends: a round end would show as a dot while the line is still shorter than it is thick.
  const stroke = { stroke: stage.accent, strokeWidth: vh(weight), strokeLinecap: 'butt', strokeLinejoin: 'round', fill: 'none' } as const;
  return (
    <>
      <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', opacity: 1 - exit }}>
        {/* The dash is as long as the part drawn so far; the path's length is called 1 so shares can be used. */}
        <path d={pathThrough(points, curve)} pathLength={1} strokeDasharray={`${grown} 2`} {...stroke} />
        {mark && half > 0 ? <line x1={last.x - across.x} y1={last.y - across.y} x2={last.x + across.x} y2={last.y + across.y} {...stroke} /> : null}
      </svg>
      {label ? (
        <div
          style={{
            ...voiceStyle(fonts.label, vh(3)),
            position: 'absolute',
            left: last.x,
            top: last.y - vh(MARK * 1.6),
            translate: '-50% -100%',
            whiteSpace: 'pre',
            fontVariantNumeric: 'tabular-nums',
            color: stage.accent,
            opacity: progress(m.t, endsAt, endsAt + quick) * (1 - exit),
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};
