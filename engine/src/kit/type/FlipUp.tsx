// Flip up: words (or letters) stand up from lying flat, tipping about their bottom edge into place, in
// perspective. A crisp, mechanical arrival for confident product lines.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { easing, progress } from '../motion';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, SplitText, type Order, type Unit } from './split';

/**
 * Each piece starts flat (turned 90° about its bottom edge, seen edge-on) and flips up to stand, with the preset's
 * small overshoot. The exit folds the pieces back down together. `by` is words or letters; `order` is the order
 * they flip in.
 */
export const FlipUp: FC<TextMoveProps & { by?: Exclude<Unit, 'line'>; order?: Order }> = ({ lines, at, out, size = 9, align = 'center', colours, style, by = 'word', order = 'start' }) => {
  const clock = useTextClock(at, out, by, 'quick');
  const { m } = clock;
  const { width } = useVideoConfig();
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by={by}
      style={style}
      piece={(p) => {
        const s = clock.start(rankOf(order, p.index, p.count));
        const sett = m.settle(s, 'base');
        const deg = 90 * (1 - sett) + 90 * clock.exit;
        return {
          transform: `perspective(${Math.round(width * 0.8)}px) rotateX(${deg}deg)`,
          transformOrigin: '50% 100%',
          opacity: progress(m.t, s, s + m.seconds('tick'), easing.travel) * (1 - clock.exit),
        };
      }}
    />
  );
};
