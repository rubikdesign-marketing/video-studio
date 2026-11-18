// Colour front: a front of colour travels along the chosen words, turning them from ink to the accent, letter
// by letter, as a wave. For the word a sentence turns on.
import type { FC } from 'react';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { asLines, pieceGap, type TextMoveProps } from './core';
import { EmphasisText, mixColour, useAnalysis, type Mark } from './emphasis';

/** How many letters the soft edge of the front spans. */
const EDGE = 4;

/**
 * Turns the chosen words (`mark`) from their ink to the accent colour as a front runs along them from the
 * first letter to the last, starting at `at`. Each letter lifts a little as the front passes it. A run of
 * words is one front, so it crosses the spaces without a pause. At `out` the colour drains back the same way,
 * quicker.
 */
export const ColourFront: FC<TextMoveProps & { mark?: Mark }> = ({ lines, at, out, size = 8, align = 'center', colours, style, mark }) => {
  const m = useMotion();
  const stage = useStage();
  const ls = asLines(lines);
  const data = useAnalysis(ls, mark);
  const gap = pieceGap('letter', m.preset.staggerMs);
  const longest = Math.max(1, ...data.runs.map((r) => r.chars));
  const length = Math.max(m.seconds('base'), longest * gap) + m.seconds('quick');
  const forward = progress(m.t, at, at + length, easing.travel);
  const back = out === undefined ? 0 : progress(m.t, out, out + length * EXIT_SHARE, easing.leave);
  const front = (u: number, chars: number) => u * (chars + EDGE) - EDGE;
  return (
    <EmphasisText
      lines={ls}
      size={size}
      align={align}
      colours={colours}
      style={style}
      mark={mark}
      analysis={data}
      word={(e, fx) => {
        if (!e.target) return undefined;
        const chars = data.runs[e.run].chars;
        return {
          letter: (_ch, i) => {
            const c = e.offset + i;
            const on = Math.max(0, Math.min(1, (front(forward, chars) - c) / EDGE + 1)) * (1 - Math.max(0, Math.min(1, (front(back, chars) - c) / EDGE + 1)));
            const lift = Math.sin(Math.PI * Math.max(0, Math.min(1, (front(forward, chars) - c) / EDGE + 1))) * (back > 0 ? 0 : 1);
            return { color: mixColour(stage.accent, on, fx.lineColour(e.line)), translate: `0 ${-lift * 0.05}em` };
          },
        };
      }}
    />
  );
};
