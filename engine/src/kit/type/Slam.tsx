// Slam: an oversized word or short line drops in from larger than the frame and lands hard, with a tiny settle.
// For hype and confident films; pairs with an impact sound on the landing.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { easing, EXIT_SHARE, progress } from '../motion';
import { smear, useTravel } from '../moves/core';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/**
 * Each line starts `from` times its size (so it fills and passes the frame), falls to its size fast and lands with
 * the preset's small overshoot. It is blurred while it is fast and sharp as it lands. The exit punches the text
 * a little larger and out, quickly. `from` is the starting scale.
 */
export const Slam: FC<TextMoveProps & { from?: number }> = ({ lines, at, out, size = 14, align = 'center', colours, style, from = 3.2 }) => {
  const clock = useTextClock(at, out, 'line', 'quick');
  const { m } = clock;
  const travel = useTravel();
  const { width, height } = useVideoConfig();
  const quick = m.seconds('quick');
  const exitAt = (t: number) => (out === undefined ? 0 : progress(t, out, out + quick * EXIT_SHARE, easing.leave));
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="line"
      style={style}
      piece={(p) => {
        const s = clock.start(p.index);
        const sett = m.settle(s, 'quick');
        const ex = clock.exit;
        // How far the line is from rest, as extra scale: the edge of the text moves at this rate times half the width.
        const grow = (t: number) => (from - 1) * (1 - progress(t, s, s + quick)) + exitAt(t) * 0.35;
        const blur = smear(travel((t) => grow(t) * width * 0.5), width);
        return {
          scale: 1 + (from - 1) * (1 - sett) + ex * 0.35,
          translate: `0 ${-(1 - sett) * height * 0.08}px`,
          opacity: progress(m.t, s, s + m.seconds('tick'), easing.travel) * (1 - ex),
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        };
      }}
    />
  );
};
