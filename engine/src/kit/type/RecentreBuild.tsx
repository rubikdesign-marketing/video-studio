// Recentre build: a line made one word at a time, centred all the while. Each new word opens a slot for itself and
// the line slides to stay centred, so nothing jumps. The file also holds WordFlow, the row of word slots that
// MakeRoom and WordMorph's neighbours use.
import { measureText } from '@remotion/layout-utils';
import type { CSSProperties, FC } from 'react';
import { useBrand, useFontsLoaded } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { em, voiceStyle } from '../moves/core';
import { useStage } from '../ui';
import { asLines, type TextMoveProps } from './core';
import { splitText, useFitSize, type LineColour } from './split';

/** A word of a line with its starred state; punctuation after a starred word stays part of the word. */
export type FlatWord = { text: string; accent: boolean };

/** The words of each line, a starred word and its trailing punctuation merged into one. */
export const flatWords = (lines: string[]): FlatWord[][] =>
  splitText(lines).lines.map((line) => {
    const out: FlatWord[] = [];
    let last = -1;
    for (const w of line.words) {
      if (w.word === last) out[out.length - 1].text += w.text;
      else out.push({ text: w.text, accent: w.accent });
      last = w.word;
    }
    return out;
  });

type Grow = { grow: number; style?: CSSProperties };

/**
 * Rows of words, each word in a slot as wide as `grow` (0 to 1) of its own width plus the space before it. The
 * rows are centred (or aligned), so a slot that opens pushes the words around it apart and a slot that closes
 * pulls them together, smoothly. A word sits in the middle of its slot, and its own `style` is drawn on it.
 * `word(line, index, flat)` says how open the slot is and how the word looks.
 */
export const WordFlow: FC<{
  lines: string[];
  size: number;
  align?: 'left' | 'center' | 'right';
  colours?: LineColour[];
  style?: CSSProperties;
  word: (line: number, index: number, flat: number) => Grow;
}> = ({ lines, size, align = 'center', colours, style, word }) => {
  const brand = useBrand();
  // measureText remembers what it measured, so a width taken before the brand's fonts arrive would stay wrong:
  // asking again with a different (harmless) style once they have arrived gives a fresh measure.
  const loaded = useFontsLoaded();
  const stage = useStage();
  const fontSize = useFitSize(lines, size);
  const { headline, accent } = brand.fonts;
  const rows = flatWords(lines);
  const roles = colours ?? (['ink', 'second'] as LineColour[]);
  const measure = (text: string, accented: boolean) => {
    const voice = accented ? accent : headline;
    return measureText({
      text,
      fontFamily: voice.css,
      fontSize: accented ? fontSize * accent.scale : fontSize,
      fontWeight: String(voice.weight),
      additionalStyles: { fontStyle: voice.style, fontKerning: loaded ? 'normal' : 'auto' },
      letterSpacing: (voice.tracking ?? headline.tracking) === undefined ? undefined : `${voice.tracking ?? headline.tracking}em`,
    }).width;
  };
  // A lone space can measure as nothing: take what a space adds between two letters.
  const space = Math.max(measure('a a', false) - measure('aa', false), fontSize * 0.24);
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  let flat = 0;
  return (
    <div style={{ ...voiceStyle(headline, fontSize), ...style }}>
      {rows.map((row, li) => (
        <div key={li} style={{ display: 'flex', justifyContent: justify, color: stage[roles[Math.min(li, roles.length - 1)]], height: `${headline.lineHeight ?? 1.1}em` }}>
          {row.map((w, wi) => {
            const width = measure(w.text, w.accent);
            const { grow, style: own } = word(li, wi, flat++);
            return (
              <span key={wi} style={{ position: 'relative', flex: 'none', display: 'inline-block', width: grow * ((wi > 0 ? space : 0) + width), height: '100%' }}>
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    width,
                    marginLeft: -width / 2 + (wi > 0 ? (space * grow) / 2 : 0),
                    whiteSpace: 'pre',
                    textAlign: 'center',
                    ...(w.accent ? { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale) } : {}),
                    ...own,
                  }}
                >
                  {w.text}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/**
 * Words join the line one by one, `pace` seconds apart (default three quarters of a base length). Each opens a slot
 * and rises into it while the whole line slides to stay centred, so the words already there glide aside by half the
 * new word's width. The exit drops all the words together and faster. Several lines build one after the other.
 */
export const RecentreBuild: FC<TextMoveProps & { pace?: number }> = ({ lines, at, out, size = 8, align = 'center', colours, style, pace }) => {
  const m = useMotion();
  const every = pace ?? m.seconds('base') * 0.75;
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  return (
    <WordFlow
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      style={style}
      word={(_l, _i, flat) => {
        const from = at + flat * every;
        const grow = progress(m.t, from, from + m.seconds('base'), easing.arrive);
        const seen = progress(m.t, from + 0.06, from + m.seconds('base') * 0.7);
        return { grow, style: { opacity: seen * (1 - exit), translate: `0 ${(1 - grow + exit * 0.9) * 0.3}em` } };
      }}
    />
  );
};

/** When the last word of a recentre build has landed. */
export const recentreBuildEnds = (at: number, words: number, pace: number, base: number) => at + (words - 1) * pace + base;
