// Fade up: words fade in and rise a short way, one after another. The quietest arrival; for calm, confident copy.
// (After Leonxlnx/cinetic, "fade up"; MIT.)
import type { FC } from 'react';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/** How far a piece rises into place, and drifts on leaving, in em. */
const RISE = 0.3;
const LEAVE = 0.12;

/**
 * Each word (or each whole line, `by: "line"`) fades in while rising a short way into place, a little after the one
 * before. Nothing overshoots and nothing is blurred. The exit fades the whole text out as it drifts up a touch.
 */
export const FadeUp: FC<TextMoveProps & { by?: 'word' | 'line' }> = ({ lines, at, out, size = 8, align = 'center', colours, style, by = 'word' }) => {
  const clock = useTextClock(at, out, by);
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by={by}
      style={style}
      piece={(p) => {
        const u = clock.enter(p.index, 'base');
        return { opacity: u * (1 - clock.exit), translate: `0 ${(1 - u) * RISE - clock.exit * LEAVE}em` };
      }}
    />
  );
};
