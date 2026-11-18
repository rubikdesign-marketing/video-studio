// Letter wave: the letters of the chosen word rise and fall once in a wave. A small nudge of attention.
import type { FC } from 'react';
import { progress, useMotion, easing } from '../motion';
import { asLines, pieceGap, type TextMoveProps } from './core';
import { EmphasisText, useAnalysis, type Mark } from './emphasis';

/** The height of the crest, in em, and how much a letter swells at its crest. */
const CREST = 0.13;
const SWELL = 0.05;

/**
 * At `at` the letters of the chosen word (`mark`) each rise and fall once, one after another from the first to the
 * last, so a crest runs along the word. It is a small movement and the word ends where it began. At `out` the
 * crest runs back from the last letter to the first, quicker, as a release. Nothing else on the line moves.
 */
export const LetterWave: FC<TextMoveProps & { mark?: Mark }> = ({ lines, at, out, size = 8, align = 'center', colours, style, mark }) => {
  const m = useMotion();
  const ls = asLines(lines);
  const data = useAnalysis(ls, mark);
  const gap = pieceGap('letter', m.preset.staggerMs) * 1.6;
  const length = m.seconds('base') * 1.1;
  const bell = (start: number, long: number) => Math.sin(Math.PI * progress(m.t, start, start + long, easing.travel));
  return (
    <EmphasisText
      lines={ls}
      size={size}
      align={align}
      colours={colours}
      style={style}
      mark={mark}
      analysis={data}
      word={(e) => {
        if (!e.target) return undefined;
        const chars = data.runs[e.run].chars;
        return {
          letter: (_ch, i) => {
            const c = e.offset + i;
            const lift = bell(at + c * gap, length) + (out === undefined ? 0 : bell(out + (chars - 1 - c) * gap * 0.65, length * 0.65));
            return { translate: `0 ${-lift * CREST}em`, scale: String(1 + lift * SWELL) };
          },
        };
      }}
    />
  );
};
