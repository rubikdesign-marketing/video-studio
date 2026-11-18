// Payoff punch: the payoff word swells with the preset's overshoot and turns accent while the rest of the line
// dims a little, then it settles. For the last beat of a line.
import type { FC } from 'react';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { asLines, type TextMoveProps } from './core';
import { EmphasisText, mixColour, useAnalysis, type Mark } from './emphasis';

/** How far the word swells at its peak and where it rests, as extra scale; how far the rest of the line dims. */
const PEAK = 0.2;
const REST = 0.06;
const DIM = 0.3;

/**
 * At `at` the payoff word (`mark`: a word or phrase; left out, the starred word, else the last word) swells to
 * 1.2 times, the size of the overshoot following the energy preset, then settles to 1.06; it turns to the accent
 * colour and the rest of the line dims by about a third. The neighbouring words step aside as it swells, so
 * nothing overlaps. At `out` the word, the colour and the line return to where they began.
 */
export const PayoffPunch: FC<TextMoveProps & { mark?: Mark }> = ({ lines, at, out, size = 8, align = 'center', colours, style, mark }) => {
  const m = useMotion();
  const stage = useStage();
  const ls = asLines(lines);
  const data = useAnalysis(ls, mark, 'last');
  const base = m.seconds('base');
  const up = m.settle(at, 'base');
  const down = progress(m.t, at + base * 0.9, at + base * 1.9, easing.arrive);
  const colour = progress(m.t, at, at + m.seconds('quick'), easing.arrive);
  const dim = progress(m.t, at, at + base, easing.arrive);
  const gone = out === undefined ? 0 : progress(m.t, out, out + base * EXIT_SHARE, easing.leave);
  const keep = 1 - gone;
  const grow = (PEAK * up - (PEAK - REST) * down) * keep;
  return (
    <EmphasisText
      lines={ls}
      size={size}
      align={align}
      colours={colours}
      style={style}
      mark={mark}
      fallback="last"
      analysis={data}
      word={(e, fx) => {
        if (m.t < at - 0.001 && gone === 0) return undefined;
        if (e.target) {
          return { style: { scale: String(1 + grow), transformOrigin: '50% 72%', color: mixColour(stage.accent, colour * keep, fx.lineColour(e.line)) } };
        }
        // Neighbours step aside by half of what the swollen word gains on each side.
        let shift = 0;
        for (const run of data.runs) {
          if (run.line !== e.line) continue;
          const width = fx.runWidth(run);
          const side = e.word < run.entries[0].word ? -1 : 1;
          shift += (side * grow * width) / 2;
        }
        return { style: { opacity: 1 - DIM * dim * keep, translate: `${shift}px 0` } };
      }}
    />
  );
};
