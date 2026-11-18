// Word pop: words pop in one at a time from a small scale, each about its own centre, with the preset's spring
// overshoot. The friendly, quick way to say a short line.
import type { FC } from 'react';
import { easing, progress } from '../motion';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, SplitText, type Order } from './split';

/**
 * Each word grows from `from` (a share of its size) to full size with a small overshoot that depends on the energy
 * preset (none when calm), fading in over a tick. The exit shrinks and fades every word together. `order` is the
 * order words arrive in.
 */
export const WordPop: FC<TextMoveProps & { from?: number; order?: Order }> = ({ lines, at, out, size = 9, align = 'center', colours, style, from = 0.35, order = 'start' }) => {
  const clock = useTextClock(at, out, 'word', 'quick');
  const { m } = clock;
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="word"
      style={style}
      piece={(p) => {
        const s = clock.start(rankOf(order, p.index, p.count));
        const sett = m.settle(s, 'quick');
        return {
          scale: (from + (1 - from) * sett) * (1 - clock.exit * 0.2),
          opacity: progress(m.t, s, s + m.seconds('tick'), easing.travel) * (1 - clock.exit),
        };
      }}
    />
  );
};
