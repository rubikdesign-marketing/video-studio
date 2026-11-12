// Ring sweep: a ring fills clockwise from the top to its share of a whole. One ring, one point.
import type { CSSProperties, FC, ReactNode } from 'react';
import { clamp01, easing, EXIT_SHARE, progress, useMotion, type TimingToken } from '../motion';
import { useStage, useVh } from '../ui';
import { useGrowth } from './core';

/**
 * A ring that sweeps to `share` (0 to 1) from `at`. The full ring is there, faint, before the sweep. `size` is
 * the diameter and `weight` the thickness, as percentages of frame height. Children sit in the middle: put a
 * Count there with the same `at` and `over` and the number and the ring finish on the same frame.
 */
export const RingSweep: FC<{
  share: number;
  at: number;
  out?: number;
  size?: number;
  weight?: number;
  over?: TimingToken;
  children?: ReactNode;
  style?: CSSProperties;
}> = ({ share, at, out, size = 36, weight = 2.4, over = 'scene', children, style }) => {
  const m = useMotion();
  const stage = useStage();
  const vh = useVh();
  const { grown } = useGrowth(at, over);
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  const [diameter, stroke] = [vh(size), vh(weight)];
  const circle = { cx: diameter / 2, cy: diameter / 2, r: (diameter - stroke) / 2, fill: 'none', strokeWidth: stroke } as const;
  const swept = grown * clamp01(share);
  return (
    <div style={{ position: 'relative', width: diameter, height: diameter, opacity: 1 - exit, ...style }}>
      {/* A circle starts at three o'clock and runs clockwise; a quarter turn back starts it at the top. */}
      <svg width={diameter} height={diameter} style={{ display: 'block', rotate: '-90deg' }}>
        <circle {...circle} stroke={stage.line} />
        {/* Square ends: a round end would show as a dot while the sweep is still shorter than it is thick. */}
        {swept > 0 ? <circle {...circle} stroke={stage.accent} pathLength={1} strokeDasharray={`${swept} 2`} /> : null}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
};
