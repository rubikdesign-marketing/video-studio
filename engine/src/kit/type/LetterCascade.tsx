// Letter cascade: letters fade in one after another with a slight rise. One move for the letter fade cascade, the
// random-order letters and the centre-out stagger. (After Leonxlnx/cinetic, "letter cascade"; MIT.)
import type { FC } from 'react';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, SplitText, type Order } from './split';

const RISE = 0.22;
const LEAVE = 0.1;

/**
 * Letters fade in with a slight rise, each a few hundredths of a second after the last. `order` sets who goes
 * first: `start` (left to right), `end`, `centre` (out from the middle), `edges` (in from both ends) or `random`
 * (shuffled, the same every render). The exit fades all letters out together as they drift up.
 */
export const LetterCascade: FC<TextMoveProps & { order?: Order }> = ({ lines, at, out, size = 9, align = 'center', colours, style, order = 'start' }) => {
  const clock = useTextClock(at, out, 'letter');
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="letter"
      style={style}
      piece={(p) => {
        const u = clock.enter(rankOf(order, p.index, p.count), 'quick');
        return { opacity: u * (1 - clock.exit), translate: `0 ${(1 - u) * RISE - clock.exit * LEAVE}em` };
      }}
    />
  );
};
