// Type-on: characters appear at a human rhythm, in bursts of a few letters with small pauses at spaces and
// punctuation. For prompts and search fields.
import { useMemo, type CSSProperties, type FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, rng, useMotion } from '../motion';
import { useStage, useVh } from '../ui';
import { voiceStyle } from './core';

type Range = readonly [number, number];
/** Letters typed at one pace before the pace changes. */
const BURST: Range = [3, 6];
/** One key, in ticks: 40 to 70 ms. */
const KEY: Range = [0.4, 0.7];
/** The pause at a space or at punctuation, in ticks: 120 to 250 ms. */
const PAUSE: Range = [1.2, 2.5];
const BREATH = /[\s,.;:!?]/;

/** When each character lands, in ticks after the first key is pressed. The same text and seed give the same rhythm. */
const rhythm = (chars: string[], seed: number): number[] => {
  const random = rng(seed);
  const between = ([low, high]: Range) => low + (high - low) * random();
  let clock = 0;
  let left = 0;
  let pace = 0;
  let midWord = false;
  return chars.map((char) => {
    const breath = BREATH.test(char);
    // A new burst has a new pace, and when it starts in the middle of a word its first key takes a double beat.
    const hesitates = left <= 0 && midWord && !breath;
    if (left <= 0) {
      left = Math.round(between(BURST));
      pace = between(KEY);
    }
    clock += breath ? between(PAUSE) : pace * (hesitates ? 2 : 1);
    left = breath ? 0 : left - 1;
    midWord = !breath;
    return clock;
  });
};

/**
 * Text typed from `at`. The whole text holds its place from the first frame, so nothing around it shifts while it
 * is typed. With `over`, the typing is fitted to that many seconds (a prompt takes 2 to 3 s whatever its length).
 * The caret is a line in the accent colour; it leaves once the last character is in.
 */
export const TypeOn: FC<{
  text: string;
  at: number;
  over?: number;
  out?: number;
  voice?: 'product' | 'label' | 'headline';
  size?: number;
  caret?: boolean;
  seed?: number;
  style?: CSSProperties;
}> = ({ text, at, over, out, voice = 'product', size = 3.4, caret = true, seed = 1, style }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const chars = useMemo(() => [...text], [text]);
  const beats = useMemo(() => rhythm(chars, seed), [chars, seed]);

  const total = beats.at(-1) ?? 0;
  const beat = over === undefined || total <= 0 ? m.seconds('tick') : over / total;
  const landed = beats.findIndex((when) => at + when * beat > m.t);
  const typed = landed < 0 ? chars.length : landed;
  const end = at + total * beat;

  const quick = m.seconds('quick');
  const exit = out === undefined ? 0 : progress(m.t, out, out + quick * EXIT_SHARE, easing.leave);
  const caretIn = progress(m.t, at - quick, at);
  const caretOut = progress(m.t, end + m.seconds('base'), end + m.seconds('base') + quick * EXIT_SHARE, easing.leave);
  return (
    <div style={{ ...voiceStyle(brand.fonts[voice], vh(size)), color: stage.ink, whiteSpace: 'pre-wrap', opacity: 1 - exit, ...style }}>
      <span>{chars.slice(0, typed).join('')}</span>
      {caret ? (
        // An empty inline box: it marks the place between typed and untyped text without changing where lines break.
        <span style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: '0.04em',
              top: '0.05em',
              width: '0.07em',
              height: '1.1em',
              background: stage.accent,
              opacity: caretIn * (1 - caretOut),
            }}
          />
        </span>
      ) : null}
      <span style={{ opacity: 0 }}>{chars.slice(typed).join('')}</span>
    </div>
  );
};
