// Retype: a phrase is typed, held, partly deleted and typed again with a better ending ("Reports in hours" becomes
// "Reports in minutes"). For a claim that corrects itself. Idea after Leonxlnx/cinetic, "typewriter" (MIT).
import type { CSSProperties, FC } from 'react';
import { useBrand } from '../brand';
import { progress, rng } from '../motion';
import { voiceStyle } from '../moves/core';
import { useStage } from '../ui';
import { caretOpacity } from './HumanType';
import { useTextClock, type TextMoveProps } from './core';
import { useFitSize } from './split';

const BREATH = /[\s,.;:!?]/;

/** The number of leading characters two strings share. */
const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
};

/**
 * Types `text`, holds for a reading pause, deletes back to `keep` characters (about twice as fast as it typed),
 * pauses a beat and types `to` in place of the rest. `keep` defaults to the characters the two phrases share at
 * the start. The line holds the width of the longer phrase, so nothing around it moves. Caret solid while keys
 * land, blinking while it waits. One line, no starred words.
 */
export const Retype: FC<Omit<TextMoveProps, 'lines'> & { text: string; to: string; keep?: number; seed?: number }> = ({
  text,
  to,
  keep,
  at,
  out,
  size = 8,
  align = 'center',
  colours,
  style,
  seed = 5,
}) => {
  const clock = useTextClock(at, out, 'letter');
  const { m } = clock;
  const brand = useBrand();
  const stage = useStage();
  const tick = m.seconds('tick');
  const from = [...text];
  const next = [...to];
  const kept = Math.min(keep ?? commonPrefix(text, to), from.length, next.length);

  // Events: [time, length on screen from then on].
  const random = rng(seed);
  const events: [number, number][] = [[at - 1, 0]];
  let clock_ = at;
  const key = (before: string, first: boolean) => {
    if (!first) clock_ += tick * (0.45 + 0.5 * random()) + (BREATH.test(before) ? tick * (1.2 + 1.4 * random()) : 0);
  };
  from.forEach((_, i) => {
    key(from[i - 1] ?? '', i === 0);
    events.push([clock_, i + 1]);
  });
  clock_ += m.seconds('hero'); // the phrase is read before it is corrected
  for (let n = from.length - 1; n >= kept; n -= 1) {
    events.push([clock_, n]);
    clock_ += tick * 0.22 * (1 - 0.5 * ((from.length - 1 - n) / Math.max(1, from.length - kept))); // backspace speeds up
  }
  clock_ += m.seconds('quick');
  const retypeFrom = clock_;
  next.slice(kept).forEach((_, i) => {
    key(next[kept + i - 1] ?? '', i === 0);
    events.push([clock_, kept + i + 1]);
  });

  let length = 0;
  let last = events[0][0];
  for (const [when, n] of events) {
    if (when <= m.t) {
      length = n;
      last = when;
    }
  }
  // The text on screen is the original while it is typed and deleted, then the new one after the deletion.
  const source = m.t < retypeFrom ? from : next;
  const shown = source.slice(0, length).join('');

  const longer = from.length >= next.length ? text : to;
  const fit = useFitSize([longer], size);
  const base: CSSProperties = { ...voiceStyle(brand.fonts.headline, fit), color: stage[colours?.[0] ?? 'ink'], whiteSpace: 'pre' };
  const blink = caretOpacity(m.t - last, tick * 1.6, m.seconds('hero') * 0.6) * progress(m.t, at - m.seconds('quick'), at);
  return (
    <div style={{ ...base, textAlign: align, opacity: 1 - clock.exit, ...style }}>
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {/* The longer phrase, unseen: it fixes the width and the height of the line. */}
        <span style={{ visibility: 'hidden' }}>{longer}</span>
        <span style={{ position: 'absolute', left: 0, top: 0, whiteSpace: 'pre' }}>
          {shown}
          <span style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.05em', top: '0.06em', bottom: '0.02em', height: '0.95em', width: '0.06em', background: stage.accent, opacity: blink }} />
          </span>
        </span>
      </span>
    </div>
  );
};
