// One word stack: a sentence shown one very large word at a time, centred, each word replacing the last on its cue.
import type { CSSProperties, FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, timing, useMotion } from '../motion';
import { em, voiceStyle } from '../moves/core';
import { useStage } from '../ui';
import { AbsoluteFill } from 'remotion';
import { asLines, type TextMoveProps } from './core';
import { flatWords } from './RecentreBuild';
import { useFitSize } from './split';

/**
 * Shows the words of the text one at a time in the middle of the frame, large enough that the longest word fills
 * most of the width. Word `i` starts at `times[i]` (seconds on the scene clock); without `times` they come at an
 * even pace, `pace` seconds apart (default a base length). A new word rises a little as it fades in while the old
 * one fades out over a tick, so a swap is never a bare cut. The last word stays until `out`, then drops away.
 * All lines are read as one sentence.
 */
export const OneWordStack: FC<TextMoveProps & { times?: number[]; pace?: number }> = ({ lines, at, out, size = 18, colours, style, times, pace }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const words = flatWords(asLines(lines)).flat();
  // One size for every word: the longest word fits the frame, so the type does not jump between words.
  const fontSize = useFitSize(words.map((w) => w.text), size);
  const every = pace ?? m.seconds('base');
  const start = (i: number) => (times ? times[i] : at + i * every);
  const swap = (timing.tick / 1000) * m.preset.length;
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  const role = colours?.[0] ?? 'ink';
  const { headline, accent } = brand.fonts;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', ...style }}>
      {words.map((w, i) => {
        const into = progress(m.t, start(i), start(i) + m.seconds('quick'), easing.arrive);
        const gone = i < words.length - 1 ? progress(m.t, start(i + 1), start(i + 1) + swap * EXIT_SHARE, easing.leave) : exit;
        if (m.t < start(i) || gone >= 1) return null;
        const look: CSSProperties = w.accent ? { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale) } : {};
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...voiceStyle(headline, fontSize),
              color: stage[role],
              whiteSpace: 'pre',
              opacity: into * (1 - gone),
              translate: `0 ${((1 - into) * 0.14 + (i === words.length - 1 ? exit * 0.5 : 0)) * 1}em`,
            }}
          >
            <span style={look}>{w.text}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
