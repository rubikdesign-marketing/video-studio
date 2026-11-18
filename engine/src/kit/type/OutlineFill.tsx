// Outline fill: letters appear as outlines, then fill from the bottom up, one after another. A drawn-then-filled
// title for a bold headline.
import type { FC } from 'react';
import { easing } from '../motion';
import { useStage } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/** Outline weight, in em of the type. */
const STROKE = 0.028;

/**
 * Each letter shows first as an outline in ink (all letters together, a `quick` length), then fills from the
 * bottom up, left to right a little apart. The exit lets the fill sink away, bottom to top reversed, while the
 * outlines fade. Works best in a heavy headline voice.
 */
export const OutlineFill: FC<TextMoveProps> = ({ lines, at, out, size = 10, align = 'center', colours, style }) => {
  const clock = useTextClock(at, out, 'letter');
  const stage = useStage();
  const { m } = clock;
  const roles = colours ?? (['ink', 'second'] as const);
  const fillFrom = at + m.seconds('quick');
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="letter"
      style={style}
      piece={() => ({})}
      content={(p) => {
        const outline = clock.enter(0, 'quick');
        const start = fillFrom + p.index * clock.gap * 2;
        const level = m.t <= start ? 0 : Math.min(1, (m.t - start) / m.seconds('base'));
        const filled = easing.arrive(level);
        // The top edge of the fill: 100% is empty, 0 is full. Leaving, the level sinks again.
        const top = Math.min(100, (1 - filled + clock.exit) * 100);
        const ink = stage[roles[Math.min(p.line, roles.length - 1)]];
        return (
          <span style={{ position: 'relative', display: 'inline-block', opacity: outline * (1 - clock.exit * 0.9) }}>
            <span style={{ color: 'transparent', WebkitTextFillColor: 'transparent', WebkitTextStroke: `${STROKE}em ${ink}` }}>{p.text}</span>
            <span style={{ position: 'absolute', left: 0, top: 0, clipPath: `inset(${top}% -10% -10% -10%)`, color: ink }}>{p.text}</span>
          </span>
        );
      }}
    />
  );
};
