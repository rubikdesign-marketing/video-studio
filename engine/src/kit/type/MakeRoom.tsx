// Make room: a word is put into a line that is already there. Its neighbours slide apart to make room for it
// while it rises in.
import type { FC } from 'react';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { asLines, type TextMoveProps } from './core';
import { flatWords, WordFlow } from './RecentreBuild';

/**
 * The line (all its words except one) arrives together on `at`. On `insertAt` the remaining word opens a slot of
 * its own width, the neighbours glide apart with it, and the word rises into the gap (it fades in only once the
 * gap is half open, so it never overlaps a neighbour). `insert` is the word's place in the sentence, counting
 * from 0 across all lines; by default the first starred word, else the last. The exit lowers the whole line.
 */
export const MakeRoom: FC<TextMoveProps & { insert?: number; insertAt?: number }> = ({ lines, at, out, size = 8, align = 'center', colours, style, insert, insertAt }) => {
  const m = useMotion();
  const all = asLines(lines);
  const flat = flatWords(all).flat();
  const target = insert ?? (flat.findIndex((w) => w.accent) >= 0 ? flat.findIndex((w) => w.accent) : flat.length - 1);
  const when = insertAt ?? at + m.seconds('hero') * 0.7;
  const arrive = progress(m.t, at, at + m.seconds('quick'));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  const opened = progress(m.t, when, when + m.seconds('scene'), easing.arrive);
  return (
    <WordFlow
      lines={all}
      size={size}
      align={align}
      colours={colours}
      style={style}
      word={(_l, _i, index) => {
        if (index !== target) return { grow: 1, style: { opacity: arrive * (1 - exit), translate: `0 ${((1 - arrive) * 0.2 + exit * 0.4) * 1}em` } };
        const seen = progress(opened, 0.35, 0.85);
        return { grow: opened, style: { opacity: seen * (1 - exit), translate: `0 ${((1 - opened) * 0.45 + exit * 0.4)}em` } };
      }}
    />
  );
};
