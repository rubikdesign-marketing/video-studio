// Smear in: words slide in sideways very fast, smeared and leaning into the move, and snap clear as they stop.
// A whip-pan arrival for hype films.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { easing, EXIT_SHARE, progress } from '../motion';
import { MotionBlur, useTravel } from '../moves/core';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, SplitText, type Order } from './split';

/**
 * Each word starts a frame width off to one side and crosses to its place, leaning along the move and smeared
 * strongly in the direction it travels; the smear and lean fall away as it slows and stops. The exit carries
 * the words on the same way and out. `from` is the side they come from (`alternate` gives each line the opposite
 * side to the one above); `strength` scales the smear.
 */
export const SmearIn: FC<TextMoveProps & { from?: 'left' | 'right' | 'alternate'; strength?: number; order?: Order }> = ({
  lines,
  at,
  out,
  size = 9,
  align = 'center',
  colours,
  style,
  from = 'left',
  strength = 2.2,
  order = 'start',
}) => {
  const clock = useTextClock(at, out, 'word', 'base');
  const { m } = clock;
  const travel = useTravel();
  const { width } = useVideoConfig();
  const exitAt = (t: number) => (out === undefined ? 0 : progress(t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave));
  const dirOf = (line: number) => (from === 'left' ? 1 : from === 'right' ? -1 : line % 2 === 0 ? 1 : -1);
  const x = (t: number, s: number, dir: number) => dir * width * (-1.1 * (1 - progress(t, s, s + m.seconds('base'))) + 1.1 * exitAt(t));
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="word"
      style={style}
      piece={(p) => {
        const s = clock.start(rankOf(order, p.index, p.count));
        const dir = dirOf(p.line);
        const speed = travel((t) => x(t, s, dir)) / width;
        const lean = Math.max(-22, Math.min(22, -speed * 260));
        return {
          translate: `${x(m.t, s, dir)}px 0`,
          transform: `skewX(${lean}deg)`,
          opacity: progress(m.t, s, s + m.seconds('tick'), easing.travel),
        };
      }}
      content={(p) => {
        const s = clock.start(rankOf(order, p.index, p.count));
        const dir = dirOf(p.line);
        return <MotionBlur x={travel((t) => x(t, s, dir)) * strength}>{p.text}</MotionBlur>;
      }}
    />
  );
};
