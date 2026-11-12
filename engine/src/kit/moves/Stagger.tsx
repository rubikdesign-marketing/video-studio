// Stagger with a source: the items of a group arrive in order from a place: the left, the centre, or a point
// such as where the cursor clicked. Distance to the source sets the delay.
import { Children, type CSSProperties, type FC, type ReactNode } from 'react';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useVh } from '../ui';

/** How far from its place an item starts, as a percentage of frame height. It starts on the side of the source. */
const TRAVEL = 1.6;

/**
 * A row or a grid whose children arrive from a source. `from` is "left", "centre", or the index of the item at
 * the point (the one the cursor clicked). With `columns` the children are a grid and distance is measured across
 * rows and columns. Items the same distance away arrive together; the whole stagger stays inside a `base` length.
 * Each child sits in a box of its own (`itemStyle`); lay the group out with `style`.
 */
export const Stagger: FC<{
  children: ReactNode;
  at: number;
  out?: number;
  from?: 'left' | 'centre' | number;
  columns?: number;
  style?: CSSProperties;
  itemStyle?: CSSProperties;
}> = ({ children, at, out, from = 'left', columns, style, itemStyle }) => {
  const m = useMotion();
  const vh = useVh();
  const items = Children.toArray(children);
  const perRow = columns ?? items.length;
  const place = (i: number) => ({ x: i % perRow, y: Math.floor(i / perRow) });
  const rows = Math.ceil(items.length / perRow);
  const source = from === 'centre' ? { x: (perRow - 1) / 2, y: (rows - 1) / 2 } : place(from === 'left' ? 0 : from);
  // "left" is the whole left edge, one step outside the group: only the column counts.
  const offsets = items.map((_, i) => (from === 'left' ? { x: place(i).x + 1, y: 0 } : { x: place(i).x - source.x, y: place(i).y - source.y }));
  const distances = offsets.map((offset) => Math.hypot(offset.x, offset.y));
  // Items are ranked by distance, so equal distances share a delay, and the last one starts within a `base`.
  const ranks = [...new Set(distances)].sort((a, b) => a - b);
  const gap = ranks.length > 1 ? Math.min(m.stagger, m.seconds('base') / (ranks.length - 1)) : 0;
  const quick = m.seconds('quick');
  const exit = out === undefined ? 0 : progress(m.t, out, out + quick * EXIT_SHARE, easing.leave);
  return (
    <div style={style}>
      {items.map((child, i) => {
        const start = at + ranks.indexOf(distances[i]) * gap;
        const away = (1 - m.settle(start)) * vh(TRAVEL);
        // The item at the source rises into place; every other item comes from the direction of the source.
        const [dx, dy] = distances[i] > 0 ? [-offsets[i].x / distances[i], -offsets[i].y / distances[i]] : [0, 1];
        return (
          <div
            key={i}
            style={{ ...itemStyle, opacity: progress(m.t, start, start + quick) * (1 - exit), translate: `${dx * away}px ${dy * away}px` }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
};
