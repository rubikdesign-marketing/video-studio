// Gradient ink: the chosen word fills with a slowly drifting gradient of the brand's accent and a lighter tone of it.
// For the one word that should feel alive without moving.
import type { FC } from 'react';
import { useBrand } from '../brand';
import { contrast } from '../tokens';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { lightOf } from '../moves/core';
import { useStage } from '../ui';
import { asLines, type TextMoveProps } from './core';
import { EmphasisText, mixColour, useAnalysis, type Mark } from './emphasis';

/** The most light the lighter stop may carry, the contrast every part of the fill must keep against the page, and how long one drift takes, in `hero` lengths. */
const LIGHTER = 0.5;
const LEGIBLE = 4.5;
const CYCLE = 2.5;

/**
 * Fills the chosen words (`mark`) with a gradient that eases in from their ink at `at` (a `base` length) and
 * then drifts slowly across them, one full pass every few seconds. The tones come from the brand's accent: the
 * accent itself, and the accent lightened toward the brand's lightest ink as far as it keeps 4.5:1 against the page. At `out` the fill drains back to ink.
 * The drift runs on the clock, so a render is the same every time.
 */
export const GradientInk: FC<TextMoveProps & { mark?: Mark }> = ({ lines, at, out, size = 8, align = 'center', colours, style, mark }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const ls = asLines(lines);
  const data = useAnalysis(ls, mark);
  const base = m.seconds('base');
  const on = progress(m.t, at, at + base, easing.arrive) * (1 - (out === undefined ? 0 : progress(m.t, out, out + base * EXIT_SHARE, easing.leave)));
  // The lightest tone of the accent that still reads on this page: more light is taken out until it does.
  const light = lightOf(brand);
  const blend = (t: number) => {
    const [a, b] = [stage.accent, light].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
    return `#${a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('')}`;
  };
  let share = LIGHTER;
  while (share > 0 && contrast(blend(share), stage.page) < LEGIBLE) share -= 0.05;
  const lighter = blend(Math.max(0, share));
  const phase = (m.t - at) / (m.seconds('hero') * CYCLE);
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
        if (!e.target || on <= 0) return undefined;
        const ink = fx.lineColour(e.line);
        const a = mixColour(stage.accent, on, ink);
        const b = mixColour(lighter, on, ink);
        const shift = (((phase - e.from * 0.5) % 1) + 1) % 1;
        return {
          style: {
            backgroundImage: `linear-gradient(90deg, ${a}, ${b}, ${a})`,
            backgroundSize: '200% 100%',
            backgroundRepeat: 'repeat-x',
            backgroundPosition: `${(shift * 200).toFixed(2)}% 0`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
          },
        };
      }}
    />
  );
};
