// Scatter assemble: the letters start thrown about the frame, tilted, then fly into the line and lock into place.
// A busy, energetic title build; on the way out they scatter again.
import { measureText } from '@remotion/layout-utils';
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, rng } from '../motion';
import { MotionBlur, useTravel } from '../moves/core';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, splitText, SplitText, useFitSize, type Order } from './split';

type Spot = { x: number; y: number };

/**
 * Where each letter rests, in pixels from the middle of the frame, worked out from the text's own measurements
 * (centred in the frame, as the gallery and the film place it). Accent words are measured in the headline voice,
 * so their places are close, not exact: this only decides where a letter flies from.
 */
const useRestingSpots = (lines: string[], size: number, align: 'left' | 'center' | 'right'): Spot[] => {
  const voice = useBrand().fonts.headline;
  const px = useFitSize(lines, size);
  const split = splitText(lines);
  const wide = (text: string) =>
    measureText({ text, fontFamily: voice.css, fontSize: px, fontWeight: String(voice.weight), letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em` }).width;
  const widths = split.lines.map((l) => wide(l.words.map((w) => w.text).join(' ')));
  const block = Math.max(...widths);
  const spots: Spot[] = [];
  split.lines.forEach((l, li) => {
    const shift = align === 'center' ? -widths[li] / 2 : align === 'left' ? -block / 2 : block / 2 - widths[li];
    const y = (li - (split.lines.length - 1) / 2) * px * (voice.lineHeight ?? 1.1);
    l.words.forEach((w, wi) => {
      const before = l.words.slice(0, wi).map((o) => o.text).join(' ') + (wi > 0 ? ' ' : '');
      w.letters.forEach((ch, ci) => {
        const left = wide(before + w.letters.slice(0, ci).join(''));
        spots[w.firstLetter + ci] = { x: shift + left + wide(ch) / 2, y };
      });
    });
  });
  return spots;
};

/**
 * Letters start at seeded places and tilts inside the frame (any size of frame), show up there, then fly in one after
 * another and land with the preset's small overshoot, smeared along their flight. The exit throws them back out to
 * where they began. `order` is the order they fly in (shuffled by default); `seed` changes the scatter.
 */
export const ScatterAssemble: FC<TextMoveProps & { order?: Order; seed?: number }> = ({ lines, at, out, size = 11, align = 'center', colours, style, order = 'random', seed = 5 }) => {
  const list = asLines(lines);
  const clock = useTextClock(at, out, 'letter', 'scene');
  const { m } = clock;
  const travel = useTravel();
  const { width, height } = useVideoConfig();
  const spots = useRestingSpots(list, size, align);
  const hold = m.seconds('quick');
  const exitAt = (t: number) => (out === undefined ? 0 : progress(t, out, out + m.seconds('scene') * EXIT_SHARE, easing.leave));
  const plan = (letter: number, index: number, count: number) => {
    const r = rng(seed * 1009 + letter * 31 + 1);
    const home = spots[letter] ?? { x: 0, y: 0 };
    return {
      // From where it rests to a seeded place inside the frame (kept off the very edge).
      ox: (r() - 0.5) * 2 * width * 0.44 - home.x,
      oy: (r() - 0.5) * 2 * height * 0.42 - home.y,
      turn: (r() - 0.5) * 2 * 150,
      start: at + hold + clock.gap * rankOf(order, index, count, seed),
    };
  };
  return (
    <SplitText
      lines={list}
      size={size}
      align={align}
      colours={colours}
      by="letter"
      style={style}
      piece={(p) => {
        const { ox, oy, turn, start } = plan(p.letter, p.index, p.count);
        const sett = m.settle(start, 'scene');
        const away = 1 - sett + clock.exit;
        return {
          translate: `${ox * away}px ${oy * away}px`,
          rotate: `${turn * away}deg`,
          scale: 0.7 + 0.3 * (1 - Math.min(1, away)),
          opacity: progress(m.t, at, at + m.seconds('tick'), easing.travel) * (1 - clock.exit),
        };
      }}
      content={(p) => {
        const { ox, oy, start } = plan(p.letter, p.index, p.count);
        const away = (t: number) => 1 - progress(t, start, start + m.seconds('scene')) + exitAt(t);
        return (
          <MotionBlur x={travel((t) => ox * away(t))} y={travel((t) => oy * away(t))}>
            {p.text}
          </MotionBlur>
        );
      }}
    />
  );
};
