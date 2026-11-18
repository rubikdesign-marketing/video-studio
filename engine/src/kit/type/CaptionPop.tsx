// Caption pop: the second short-form caption style. The phrase stands in large type and the word being spoken
// swells and turns the brand's highlight colour, popping slightly as it starts. LIBRARY-PLAN decision 6.
import type { FC } from 'react';
import { easing, lerp, progress } from '../motion';
import { CaptionLayer, type SpokenWord } from './CaptionBox';

/** How much larger the spoken word grows, as a share of its size. */
const GROW = 0.16;

/**
 * Words not yet spoken sit faint and come up as they are spoken (up to 100 ms before). The word being spoken is enlarged and in the caption
 * highlight colour; it pops with the preset's small overshoot as it starts, and settles back to the size and colour of
 * the others when the next word begins. Words are laid out with extra room so the enlarged word never touches
 * its neighbours. Takes `words` with seconds on the scene clock (`at` shifts them), groups them into phrases of up
 * to `maxWords`, and sits in the same platform-safe band as the fixed captions.
 */
export const CaptionPop: FC<{ words: SpokenWord[]; at?: number; out?: number; maxWords?: number; size?: number }> = ({ words, at, out, maxWords, size }) => (
  <CaptionLayer
    words={words}
    at={at}
    out={out}
    maxWords={maxWords}
    size={size}
    extraGap={0.22}
    draw={(c) => (
      <>
        {c.words.map((w, i) => {
          const next = c.words[i + 1];
          // How far this word is "the spoken one": in as it starts, out as the next word starts.
          const entered = progress(c.t, w.start - 0.1, w.start - 0.1 + c.quick);
          const left = next ? progress(c.t, next.start - 0.1, next.start - 0.1 + c.quick, easing.travel) : 0;
          const on = entered * (1 - left);
          const pop = c.settle(w.start - 0.1) * (1 - left);
          return (
            <span
              key={i}
              style={{
                ...c.wordStyle(i),
                scale: `${1 + GROW * pop}`,
                translate: `0 ${(1 - progress(c.t, w.start - 0.1, w.start + 0.05)) * 0.18 - 0.03 * pop}em`,
                textShadow: `0 ${c.size * 0.04}px ${c.size * 0.22}px ${c.colours.shadow}`,
              }}
            >
              {w.text}
              <span style={{ position: 'absolute', left: 0, top: 0, color: c.colours.highlight, opacity: lerp(0, 1, on) }}>{w.text}</span>
            </span>
          );
        })}
      </>
    )}
  />
);
