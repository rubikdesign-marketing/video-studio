// Human type: large film type typed at a human rhythm, with a caret that is solid while keys land and blinks while
// it waits. For a headline that is "written" on screen (not a search field: see TypeOn in the moves for that).
// Idea after Leonxlnx/cinetic, "typewriter" (MIT).
import type { CSSProperties, FC } from 'react';
import { clamp01, progress, rng } from '../motion';
import { useStage } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText, splitText } from './split';

const BREATH = /[,.;:!?]/;

/**
 * When each key lands, in seconds after the first one: a seeded, uneven gap between keys (0.45 to 0.95 of a tick),
 * and a longer pause (1.2 to 2.6 ticks) after a space, a line break or punctuation. The same text and seed give
 * the same rhythm on every render.
 */
export const keyTimes = (lines: string[], seed: number, tick: number): number[] => {
  const random = rng(seed);
  const split = splitText(lines);
  const times: number[] = [];
  let clock = 0;
  let before = '';
  let wordBefore = -1;
  for (const line of split.lines) {
    for (const word of line.words) {
      word.letters.forEach((ch, i) => {
        const first = times.length === 0;
        if (!first) {
          const pause = (i === 0 && word.word !== wordBefore) || BREATH.test(before);
          clock += tick * (0.45 + 0.5 * random()) + (pause ? tick * (1.2 + 1.4 * random()) : 0);
        }
        times.push(clock);
        before = ch;
      });
      wordBefore = word.word;
    }
  }
  return times;
};

/** A caret's opacity: solid while `since` (seconds since the last key) is inside `hold`, then a soft blink. */
export const caretOpacity = (since: number, hold: number, period: number) => {
  if (since < hold) return 1;
  const phase = ((since - hold) / period) % 1;
  return clamp01(0.5 + 0.9 * Math.cos(2 * Math.PI * phase));
};

/**
 * Types the lines letter by letter from `at`. The whole text holds its place from the first frame, so nothing
 * shifts while it is typed. The caret (accent colour) is solid while keys land and blinks while it waits, before
 * the first key and after the last. `out` fades the text and caret away.
 */
export const HumanType: FC<TextMoveProps & { seed?: number; caret?: boolean }> = ({ lines, at, out, size = 8, align = 'center', colours, style, seed = 3, caret = true }) => {
  const clock = useTextClock(at, out, 'letter');
  const { m } = clock;
  const tick = m.seconds('tick');
  const all = asLines(lines);
  const times = keyTimes(all, seed, tick);
  const typed = times.filter((when) => at + when <= m.t).length;
  const lastKey = typed === 0 ? at - m.seconds('quick') : at + times[typed - 1];
  const since = m.t - lastKey;
  const caretIn = progress(m.t, at - m.seconds('quick'), at);
  const blink = caretOpacity(since, tick * 1.6, m.seconds('hero') * 0.6) * caretIn;
  const accent = useStage().accent;
  const caretStyle = (side: 'left' | 'right'): CSSProperties => ({
    position: 'absolute',
    top: '6%',
    bottom: '6%',
    width: '0.06em',
    background: accent,
    opacity: blink,
    ...(side === 'right' ? { left: '100%', marginLeft: '0.05em' } : { right: '100%', marginRight: '0.05em' }),
  });
  return (
    <SplitText
      lines={all}
      size={size}
      align={align}
      colours={colours}
      by="letter"
      style={{ opacity: 1 - clock.exit, ...style }}
      piece={(p) => ({ position: 'relative', opacity: p.index < typed ? 1 : 0 })}
      content={(p) => (
        <>
          {p.text}
          {caret && p.index === typed - 1 ? <span style={caretStyle('right')} /> : null}
          {caret && typed === 0 && p.index === 0 ? <span style={caretStyle('left')} /> : null}
        </>
      )}
    />
  );
};
