// Mask rise: each line, word or letter rises into view from behind its own edge, as if from a slot. The classic
// title arrival (after Leonxlnx/cinetic, "mask reveal"; MIT).
import type { FC } from 'react';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { lastRank, rankOf, SplitText, type Order, type Unit } from './split';

/**
 * Pieces rise from below a hidden edge. Lines rise as wholes (`by: "line"`), or word by word, or letter by letter.
 * Each piece is clipped to its own box, so nothing shows until it crosses the edge. The exit drops the text back
 * behind the edge, all at once and faster.
 */
export const MaskRise: FC<TextMoveProps & { by?: Unit; order?: Order }> = ({ lines, at, out, size = 8, align = 'center', colours, style, by = 'word', order = 'start' }) => {
  const clock = useTextClock(at, out, by);
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by={by}
      style={style}
      mask
      piece={(p) => {
        const u = clock.enter(rankOf(order, p.index, p.count), 'base');
        return { translate: `0 ${(1 - u + clock.exit) * 110}%` };
      }}
    />
  );
};

/** When the last piece of a mask rise has landed, for a scene that cues the next thing after it. */
export const maskRiseEnds = (at: number, count: number, order: Order, gap: number, base: number) => at + lastRank(order, count) * gap + base;
