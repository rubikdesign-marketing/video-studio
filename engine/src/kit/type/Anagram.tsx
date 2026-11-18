// Anagram: the letters of one phrase rearrange into another, each letter travelling on its own arc to its new
// place. Either two phrases made of the same letters, or a scrambled line that sorts itself into the real one.
// For a reveal of the line ("Listen" becomes "Silent"). After Leonxlnx/cinetic, "text shuffle" (MIT).
import type { CSSProperties, FC } from 'react';
import { measureText } from '@remotion/layout-utils';
import { useBrand } from '../brand';
import { arc, easing, progress, rng } from '../motion';
import { MotionBlur, useTravel, voiceStyle } from '../moves/core';
import { useStage } from '../ui';
import { useTextClock, type TextMoveProps } from './core';
import { useFitSize } from './split';

/** Matches each letter of `to` to a letter of `from` that is the same character (ignoring case), the nearest one free. */
const match = (from: string[], to: string[]) => {
  const used = new Set<number>();
  return to.map((ch, j) => {
    let best = -1;
    from.forEach((f, i) => {
      if (used.has(i) || f.toLowerCase() !== ch.toLowerCase() || ch === ' ') return;
      if (best < 0 || Math.abs(i - j) < Math.abs(best - j)) best = i;
    });
    if (best >= 0) used.add(best);
    return best;
  });
};

/** A seeded shuffle of the letters of `text` among its letter places; spaces stay where they are. */
const shuffled = (text: string, seed: number) => {
  const random = rng(seed);
  const chars = [...text];
  const places = chars.map((c, i) => (c === ' ' ? -1 : i)).filter((i) => i >= 0);
  const letters = places.map((i) => chars[i]);
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const k = Math.floor(random() * (i + 1));
    [letters[i], letters[k]] = [letters[k], letters[i]];
  }
  places.forEach((place, i) => (chars[place] = letters[i]));
  return chars.join('');
};

/**
 * Shows `from` (or, without it, a seeded shuffle of `text`), holds it for a reading pause, then every letter
 * travels on its own arc, a little after the one before, to its place in `text`. Letters in `from` that are the
 * same character as one in `text` are matched (nearest first); one that has no partner fades out and an unmatched
 * letter of `text` fades in. Fast travel is motion-blurred. One line; a starred word is not supported (the
 * letters are placed one by one). The line holds the width of the wider of the two.
 */
export const Anagram: FC<Omit<TextMoveProps, 'lines'> & { text: string; from?: string; seed?: number }> = ({ text, from, at, out, size = 8, align = 'center', colours, style, seed = 8 }) => {
  const clock = useTextClock(at, out, 'letter');
  const { m } = clock;
  const brand = useBrand();
  const stage = useStage();
  const travel = useTravel();
  const start = from ?? shuffled(text, seed);
  const fontPx = useFitSize([text, start], size);
  const voice = brand.fonts.headline;
  const to = [...text];
  const was = [...start];
  const measure = (s: string) =>
    measureText({ text: s, fontFamily: voice.css, fontSize: fontPx, fontWeight: String(voice.weight), letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em` }).width;
  const lineWidth = Math.max(measure(text), measure(start));
  const shift = (s: string) => (align === 'left' ? 0 : align === 'right' ? lineWidth - measure(s) : (lineWidth - measure(s)) / 2);
  const placeIn = (chars: string[], s: string, i: number) => shift(s) + measure(chars.slice(0, i).join(''));
  const lineHeight = fontPx * (voice.lineHeight ?? 1.1);

  const partner = match(was, to);
  const hold = m.seconds('hero') * 0.75;
  const gap = m.seconds('tick') * 0.45;
  const travelFor = m.seconds('hero') * 0.55;
  const enter = progress(m.t, at, at + m.seconds('quick'));
  const colour = stage[colours?.[0] ?? 'ink'];
  const base: CSSProperties = { ...voiceStyle(voice, fontPx), color: colour, whiteSpace: 'pre', position: 'absolute', left: 0, top: 0 };

  const letters: { key: string; ch: string; x: (t: number) => number; y: (t: number) => number; opacity: number }[] = [];
  let order = 0;
  to.forEach((ch, j) => {
    if (ch === ' ') return;
    const i = partner[j];
    const begin = at + hold + order * gap;
    order += 1;
    const end = begin + travelFor;
    const target = { x: placeIn(to, text, j), y: 0 };
    if (i < 0) {
      letters.push({ key: `to${j}`, ch, x: () => target.x, y: () => 0, opacity: progress(m.t, begin, end) });
      return;
    }
    const origin = { x: placeIn(was, start, i), y: 0 };
    // Letters bow up or down by turns, so they pass each other instead of through each other.
    const bend = (j % 2 === 0 ? 1 : -1) * 0.13;
    const at_ = (t: number) => arc(origin, target, progress(t, begin, end, easing.travel), bend);
    letters.push({ key: `to${j}`, ch: m.t >= end ? ch : was[i], x: (t) => at_(t).x, y: (t) => at_(t).y * Math.min(1, Math.abs(target.x - origin.x) / (fontPx * 2)) , opacity: 1 });
  });
  // Letters of `from` with no partner fade out as the move begins.
  const used = new Set(partner.filter((i) => i >= 0));
  was.forEach((ch, i) => {
    if (ch === ' ' || used.has(i)) return;
    const x = placeIn(was, start, i);
    letters.push({ key: `from${i}`, ch, x: () => x, y: () => 0, opacity: 1 - progress(m.t, at + hold, at + hold + travelFor) });
  });

  return (
    <div style={{ position: 'relative', width: lineWidth, height: lineHeight, opacity: enter * (1 - clock.exit), ...style }}>
      {letters.map((l) => (
        <span key={l.key} style={{ ...base, opacity: l.opacity, translate: `${l.x(m.t)}px ${l.y(m.t)}px` }}>
          <MotionBlur x={travel(l.x)} y={travel(l.y)}>
            {l.ch}
          </MotionBlur>
        </span>
      ))}
    </div>
  );
};
