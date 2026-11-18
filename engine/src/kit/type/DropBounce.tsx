// Drop and bounce: letters fall from above one after another, hit the line and bounce once into place. Playful;
// use it sparingly (one line a film).
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { clamp01, easing, EXIT_SHARE, progress, rng } from '../motion';
import { MotionBlur, useTravel } from '../moves/core';
import { useVh } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, SplitText, type Order } from './split';

/**
 * Letters fall (speeding up) from above the frame, hit their place, rise a small bounce and land. Each letter
 * tilts a little in the air and is smeared up and down while it falls. The exit lets the letters fall away the
 * bottom in turn. `order` is the order letters drop in.
 */
export const DropBounce: FC<TextMoveProps & { order?: Order }> = ({ lines, at, out, size = 11, align = 'center', colours, style, order = 'start' }) => {
  const clock = useTextClock(at, out, 'letter');
  const { m } = clock;
  const travel = useTravel();
  const vh = useVh();
  const { height } = useVideoConfig();
  const fall = m.seconds('base') * 0.7;
  const bounce = m.seconds('quick') * 0.8;
  const gap = clock.gap * 2;
  const dist = height * 0.6;
  const lift = vh(3);
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="letter"
      style={style}
      piece={(p) => {
        const rank = rankOf(order, p.index, p.count);
        const s = at + rank * gap;
        const leave = (t: number) => (out === undefined ? 0 : progress(t, out + rank * gap, out + rank * gap + m.seconds('base') * EXIT_SHARE, easing.leave));
        // Height above its place at time t: falling with gravity, one small bounce, then at rest; away through the bottom on exit.
        const y = (t: number) => {
          const u = (t - s) / fall;
          if (u < 1) return -dist * (1 - clamp01(u) ** 2);
          const b = clamp01((t - s - fall) / bounce);
          return -lift * 4 * b * (1 - b) + leave(t) * dist * 1.1;
        };
        const tilt = (rng(11 + p.letter)() - 0.5) * 36;
        return {
          translate: `0 ${y(m.t)}px`,
          rotate: `${tilt * (1 - clamp01((m.t - s) / fall))}deg`,
          opacity: m.t >= s ? 1 : 0,
        };
      }}
      content={(p) => {
        const rank = rankOf(order, p.index, p.count);
        const s = at + rank * gap;
        const leave = (t: number) => (out === undefined ? 0 : progress(t, out + rank * gap, out + rank * gap + m.seconds('base') * EXIT_SHARE, easing.leave));
        const y = (t: number) => {
          const u = (t - s) / fall;
          return u < 1 ? -dist * (1 - clamp01(u) ** 2) : leave(t) * dist * 1.1;
        };
        return <MotionBlur y={travel(y)}>{p.text}</MotionBlur>;
      }}
    />
  );
};
