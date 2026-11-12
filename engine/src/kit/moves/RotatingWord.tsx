// Rotating word: the last word of a line swaps for another inside a box that resizes to fit, while the rest of
// the line holds still.
import { measureText } from '@remotion/layout-utils';
import type { CSSProperties, FC } from 'react';
import { useBrand, useFontsLoaded } from '../brand';
import { easing, lerp, progress, useMotion } from '../motion';
import { useStage, useVh } from '../ui';
import { em, useCue, voiceStyle } from './core';

/** Space between a word and the sides of its box, in em. */
const PAD = 0.26;
/** From one word to the next on the roll, in em: more than the height of the box, so only one word is whole at a time. */
const PITCH = 1.3;

/**
 * A line that ends in a box holding one word at a time, in the accent colour. The first word arrives with the
 * line at `at`; a new word comes every `every` seconds (a cue: about half a second of reading plus the swap).
 * The line is as wide as its widest word from the first frame, so nothing before the box ever shifts.
 * The words are on one roll: the old word leaves through the top of the box as the new one comes up from below,
 * the same distance apart all the way, so two words are never printed over each other. Nothing fades.
 */
export const RotatingWord: FC<{
  lead?: string;
  words: [string, string, ...string[]];
  at: number;
  every: number;
  out?: number;
  size?: number;
  style?: CSSProperties;
}> = ({ lead, words, at, every, out, size = 7, style }) => {
  const m = useMotion();
  const brand = useBrand();
  const { headline } = brand.fonts;
  const stage = useStage();
  const vh = useVh();
  const fontsLoaded = useFontsLoaded();
  const line = useCue(at, out);
  if (!fontsLoaded) return null; // the box is sized from measured words

  const fontSize = vh(size);
  const pad = fontSize * PAD;
  const widths = words.map(
    (text) =>
      measureText({
        text,
        fontFamily: headline.css,
        fontSize,
        fontWeight: headline.weight,
        letterSpacing: em(headline.tracking),
        additionalStyles: { fontStyle: headline.style },
      }).width +
      pad * 2,
  );

  const index = Math.min(words.length - 1, Math.max(0, Math.floor((m.t - at) / every)));
  const swapAt = at + index * every;
  const swapped = index > 0;
  // One roll, a `quick` long: it sets off from rest and slows into place, and most of it happens within a tick.
  // The box reaches its new width with the word.
  const rolled = swapped ? progress(m.t, swapAt, swapAt + m.seconds('quick'), easing.travel) : 1;
  const width = lerp(widths[Math.max(0, index - 1)], widths[index], rolled);
  const radius = vh(brand.shape.control);
  return (
    <div
      style={{
        ...voiceStyle(headline, fontSize),
        display: 'inline-flex',
        alignItems: 'baseline',
        whiteSpace: 'pre',
        color: stage.ink,
        opacity: line.enter * (1 - line.exit),
        translate: `0 ${(1 - line.enter) * vh(1.2)}px`,
        ...style,
      }}
    >
      {lead ? <span>{lead} </span> : null}
      {/* The slot keeps the width of the widest word; the box inside it is the part that resizes. */}
      <span style={{ display: 'inline-block', width: Math.max(...widths) }}>
        <span
          style={{
            position: 'relative',
            display: 'inline-block',
            boxSizing: 'border-box',
            width,
            padding: `0.06em ${pad}px`,
            borderRadius: radius,
            background: stage.accent,
            color: stage.onAccent,
            // A clip path, not overflow: hidden, so the box keeps the baseline of the line.
            clipPath: `inset(0 round ${radius}px)`,
          }}
        >
          <span style={{ display: 'inline-block', translate: `0 ${(1 - rolled) * PITCH}em` }}>{words[index]}</span>
          {swapped && rolled < 1 ? (
            <span style={{ position: 'absolute', left: pad, top: '0.06em', translate: `0 ${-rolled * PITCH}em` }}>{words[index - 1]}</span>
          ) : null}
        </span>
      </span>
    </div>
  );
};
