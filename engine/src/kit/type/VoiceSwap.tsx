// Voice swap: a word changes from the headline voice to the accent voice, crossfading with a little blur, and the
// line around it re-flows smoothly to fit. For the word a sentence turns on.
import type { CSSProperties, FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, lerp, progress, useMotion } from '../motion';
import { em } from '../moves/core';
import { asLines, type TextMoveProps } from './core';
import { analyse, EmphasisText, measure, useAnalysis, type Mark } from './emphasis';
import { useFitSize } from './split';

/** The blur at the middle of the swap, as a share of the type size. */
const BLUR = 0.07;

/**
 * Swaps the chosen word (`mark`; left out, the starred word, which is written with its stars but starts in the
 * headline voice) from the headline voice to the accent voice at `at`: the old shape blurs and fades as the new
 * one sharpens and fades in, over a `base` length. The word's slot grows or shrinks to the new width over the
 * same time, so the words around it glide and nothing jumps. At `out` it swaps back. A brand with no accent face
 * of its own gets its headline face, heavier, as the starred voice, and the swap is then a weight change.
 */
export const VoiceSwap: FC<TextMoveProps & { mark?: Mark }> = ({ lines, at, out, size = 8, align = 'center', colours, style, mark }) => {
  const m = useMotion();
  const brand = useBrand();
  const original = asLines(lines);
  const ls = original.map((l) => l.replace(/\*/g, ''));
  const chosen: Mark = mark ?? analyse(original, undefined, 'last').lines.flat().filter((e) => e.target).map((e) => e.word);
  const data = useAnalysis(ls, chosen, 'last');
  const fontSize = useFitSize(ls, size);
  const { accent, headline } = brand.fonts;
  const base = m.seconds('base');
  const there = progress(m.t, at, at + base, easing.arrive);
  const back = out === undefined ? 0 : progress(m.t, out, out + base * EXIT_SHARE, easing.leave);
  const swap = there * (1 - back);
  const fade = progress(m.t, at, at + base, easing.travel) * (1 - (out === undefined ? 0 : progress(m.t, out, out + base * EXIT_SHARE, easing.travel)));
  const accentStyle: CSSProperties = { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale) };
  const blur = (own: number) => `blur(${(fontSize * BLUR * own).toFixed(2)}px)`;
  return (
    <EmphasisText
      lines={ls}
      size={size}
      align={align}
      colours={colours}
      style={style}
      mark={chosen}
      fallback="last"
      analysis={data}
      word={(e) => {
        if (!e.target) return undefined;
        const from = measure(e.text, headline, fontSize);
        const to = measure(e.text, accent, fontSize * accent.scale);
        return {
          node: (
            <span style={{ display: 'inline-grid', gridTemplateColumns: 'minmax(0, 1fr)', width: lerp(from, to, swap), alignItems: 'baseline', justifyItems: 'center', whiteSpace: 'pre' }}>
              <span style={{ gridArea: '1 / 1', opacity: 1 - fade, filter: blur(fade) , whiteSpace: 'pre' }}>{e.text}</span>
              <span style={{ gridArea: '1 / 1', ...accentStyle, opacity: fade, filter: blur(1 - fade), whiteSpace: 'pre' }}>{e.text}</span>
            </span>
          ),
        };
      }}
    />
  );
};
