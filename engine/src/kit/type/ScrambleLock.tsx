// Scramble lock: every letter cycles through random characters and locks onto its real letter one after another,
// from the start of the line or from its centre. For a title that "decodes". After Leonxlnx/cinetic,
// "text scramble" (MIT).
import type { FC } from 'react';
import { progress, rng } from '../motion';
import { useStage } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, SplitText, type Order } from './split';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

/** The characters a letter may cycle through: its own kind, so a lower-case letter never turns into a capital. */
const poolFor = (ch: string) => (/[A-Z]/.test(ch) ? UPPER : /[a-z]/.test(ch) ? LOWER : /\d/.test(ch) ? DIGITS : '');

/** A fixed pick from a pool for one letter at one step (seeded: the same on every render). */
const pick = (pool: string, seed: number, letter: number, step: number) => pool[Math.floor(rng(seed * 7919 + letter * 104729 + step * 31)() * pool.length)];

/**
 * Each letter cycles through random characters of its own kind (a new one every half tick) and locks onto its
 * real letter, one at a time. `order` is `start` (left to right) or `centre` (the middle locks first and the lock
 * runs outwards: decode from the centre). Every letter sits in a box as wide as its real letter, so the line never
 * changes width or jumps. Cycling letters are in the stage's second colour; a locked one in ink. Punctuation
 * is never scrambled. Seeded.
 */
export const ScrambleLock: FC<TextMoveProps & { order?: Extract<Order, 'start' | 'centre'>; seed?: number }> = ({
  lines,
  at,
  out,
  size = 8,
  align = 'center',
  colours,
  style,
  order = 'start',
  seed = 4,
}) => {
  const clock = useTextClock(at, out, 'letter');
  const { m } = clock;
  const stage = useStage();
  const step = Math.floor(Math.max(0, m.t - at) / (m.seconds('tick') * 0.5));
  const lockGap = m.seconds('tick') * 0.55;
  const lockAt = (p: { index: number; count: number }) => at + m.seconds('base') + rankOf(order, p.index, p.count) * lockGap;
  const enter = progress(m.t, at, at + m.seconds('quick'));
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="letter"
      style={{ opacity: enter * (1 - clock.exit), ...style }}
      piece={(p) => ({ position: 'relative', color: m.t >= lockAt(p) || !poolFor(p.text) ? undefined : stage.second })}
      content={(p) => {
        const pool = poolFor(p.text);
        if (!pool || m.t >= lockAt(p)) return p.text;
        // The real letter, unseen, gives the box its width; the cycling character sits centred in it.
        return (
          <>
            <span style={{ visibility: 'hidden' }}>{p.text}</span>
            <span style={{ position: 'absolute', left: '-0.2em', right: '-0.2em', top: 0, textAlign: 'center' }}>{pick(pool, seed, p.index, step)}</span>
          </>
        );
      }}
    />
  );
};
