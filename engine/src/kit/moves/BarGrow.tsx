// Bar grow: one bar grows from its baseline to its value and slows into place. Build a chart from several,
// each a stagger after the last.
import type { CSSProperties, FC } from 'react';
import { useBrand } from '../brand';
import { clamp01, easing, EXIT_SHARE, progress, useMotion, type TimingToken } from '../motion';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import { useGrowth } from './core';

/** A bar that is not the point being made is ink at this strength. */
const MUTED = 0.3;

/**
 * A bar that grows from `at`, upwards or to the right. `share` is its value as a share of the full `length`, so a
 * bar always starts at zero. `length` and `thickness` are percentages of frame height. With `track`, the full
 * length is there, faint, before the bar arrives. `emphasis` paints the bar in the accent: one bar per chart.
 * Give a number the same `at` and `over` (CountWithBar does) and the two finish on the same frame.
 */
export const BarGrow: FC<{
  share: number;
  at: number;
  out?: number;
  grow?: 'up' | 'right';
  length: number;
  thickness?: number;
  over?: TimingToken;
  track?: boolean;
  emphasis?: boolean;
  style?: CSSProperties;
}> = ({ share, at, out, grow = 'up', length, thickness = 1.6, over = 'base', track = false, emphasis = false, style }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const { grown } = useGrowth(at, over);
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  const up = grow === 'up';
  const [full, thick] = [vh(length), vh(thickness)];
  const filled = clamp01(share) * full;
  const round = Math.min(thick / 2, vh(brand.shape.control));
  // The bar slides out from behind its baseline, so its edge moves between pixels and its end keeps its shape.
  const hidden = (1 - grown) * filled;
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: up ? thick : full,
        height: up ? full : thick,
        borderRadius: track ? round : 0,
        background: track ? stage.line : undefined,
        opacity: 1 - exit,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: up ? thick : filled,
          height: up ? filled : thick,
          // On a track the bar is rounded at both ends; in a chart it is square where it meets the baseline.
          borderRadius: track ? round : up ? `${round}px ${round}px 0 0` : `0 ${round}px ${round}px 0`,
          background: emphasis ? stage.accent : alpha(stage.ink, MUTED),
          translate: up ? `0 ${hidden}px` : `${-hidden}px 0`,
        }}
      />
    </div>
  );
};
