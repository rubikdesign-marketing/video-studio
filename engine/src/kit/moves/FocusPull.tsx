// Focus pull: everything except the chosen child dims and softens, so the eye goes to the one that stays sharp.
import { Children, type CSSProperties, type FC, type ReactNode } from 'react';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useVh } from '../ui';

/** How much the others dim: 30 to 50%. */
const DIM = 0.4;
/** How soft the others go, as a percentage of frame height (6 to 12 px at 1080). */
const SOFT = 0.8;

/**
 * A group that pulls focus to one of its children at `at` and gives it back at `out`. `keep` is the index of the
 * child that stays sharp. Each child sits in a box of its own (`itemStyle`); lay the group out with `style`.
 * One emphasis per beat: do not lift or mark the kept child at the same time.
 */
export const FocusPull: FC<{
  children: ReactNode;
  keep: number;
  at: number;
  out?: number;
  style?: CSSProperties;
  itemStyle?: CSSProperties;
}> = ({ children, keep, at, out, style, itemStyle }) => {
  const m = useMotion();
  const vh = useVh();
  const base = m.seconds('base');
  const pulled = progress(m.t, at, at + base, easing.travel);
  const back = out === undefined ? 0 : progress(m.t, out, out + base * EXIT_SHARE, easing.travel);
  const away = pulled * (1 - back);
  return (
    <div style={style}>
      {Children.toArray(children).map((child, i) => (
        <div
          key={i}
          style={{
            ...itemStyle,
            opacity: i === keep ? 1 : 1 - away * DIM,
            filter: i === keep || away <= 0 ? undefined : `blur(${away * vh(SOFT)}px)`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};
