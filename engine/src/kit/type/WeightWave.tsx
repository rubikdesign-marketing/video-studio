// Weight wave: the type's own weight carries the emphasis. A chosen word goes from regular to heavy, or a wave of
// weight runs through its letters. Needs a variable headline face; without one it uses opacity and scale instead.
import type { FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, lerp, progress, useMotion } from '../motion';
import { asLines, pieceGap, type TextMoveProps } from './core';
import { EmphasisText, useAnalysis, type Mark } from './emphasis';


/**
 * `mode: "shift"` sets the whole line at the face's regular weight (the light end of its weight range) and takes the
 * chosen word (`mark`) to its heaviest (or `heavy`, if lower) at `at`, over a `scene` length, the neighbours
 * easing aside as it widens. `mode: "wave"` runs a crest of weight along the letters
 * of the word, one after another, and leaves each back at its own weight. At `out` the shift reverses, or the wave
 * runs once more. The weight is driven through `font-variation-settings`, so the brand's headline face must be
 * variable (the demo brand's Inter is). When it is not, the move says nothing about weight and instead dims the
 * word and swells it a little (shift), or swells each letter in turn (wave): the same timing, a plainer effect.
 */
export const WeightWave: FC<TextMoveProps & { mark?: Mark; mode?: 'shift' | 'wave'; heavy?: number }> = ({
  lines,
  at,
  out,
  size = 8,
  align = 'center',
  colours,
  style,
  mark,
  mode = 'shift',
  heavy,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const ls = asLines(lines);
  const data = useAnalysis(ls, mark);
  const face = brand.fontFaces.find((f) => f.family === brand.fonts.headline.family && /\s/.test(f.weight.trim()));
  const variable = face !== undefined;
  const range = (face?.weight.trim().split(/\s+/).map(Number) ?? [400, 700]) as number[];
  const lo = range[0];
  const hi = Math.min(range[range.length - 1], heavy ?? Infinity);
  const gap = pieceGap('letter', m.preset.staggerMs) * 1.4;
  const scene = m.seconds('scene');
  const into = progress(m.t, at, at + scene, easing.arrive);
  const back = out === undefined ? 0 : progress(m.t, out, out + scene * EXIT_SHARE, easing.leave);
  const shifted = into * (1 - back);
  const bell = (start: number, long: number) => Math.sin(Math.PI * progress(m.t, start, start + long, easing.travel));
  const settled = m.settle(at, 'base') * (1 - back);
  const weightStyle = (w: number) => ({ fontWeight: w, fontVariationSettings: `"wght" ${w.toFixed(1)}` });
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
        if (!e.target) return variable ? { style: weightStyle(lo) } : undefined;
        const own = lo;
        if (mode === 'shift') {
          if (variable) return { style: weightStyle(lerp(own, hi, shifted)) };
          return { style: { opacity: lerp(0.55, 1, shifted), scale: String(1 + 0.06 * settled), transformOrigin: '50% 70%' } };
        }
        const chars = data.runs[e.run].chars;
        return {
          letter: (_ch, i) => {
            const c = e.offset + i;
            const crest = bell(at + c * gap, scene * 1.3) + (out === undefined ? 0 : bell(out + (chars - 1 - c) * gap * 0.65, scene * 0.85));
            if (variable) return weightStyle(lerp(own, hi, Math.min(1, crest)));
            return { opacity: lerp(0.6, 1, Math.min(1, crest) * 0.6 + 0.4 * (1 - Math.min(1, crest))), scale: String(1 + 0.1 * crest), transformOrigin: '50% 70%' };
          },
        };
      }}
    />
  );
};
