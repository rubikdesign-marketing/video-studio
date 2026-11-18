// From the lens: the line comes from behind the viewer, huge, soft and see-through, and shrinks to its place as it
// sharpens. A depth arrival for a big claim. The exit sends it back into the distance.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { easing, EXIT_SHARE, progress } from '../motion';
import { smear, useTravel } from '../moves/core';
import { useVh } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/**
 * Each line starts `from` times its size and grows smaller by a steady share of depth (so it seems to travel at
 * an even speed towards its place), fading and sharpening on the way, and lands with the preset's small overshoot.
 * The exit shrinks it away and blurs it as it fades.
 */
export const FromLens: FC<TextMoveProps & { from?: number }> = ({ lines, at, out, size = 10, align = 'center', colours, style, from = 4 }) => {
  const clock = useTextClock(at, out, 'line', 'scene');
  const { m } = clock;
  const travel = useTravel();
  const vh = useVh();
  const { width } = useVideoConfig();
  const exitAt = (t: number) => (out === undefined ? 0 : progress(t, out, out + m.seconds('scene') * EXIT_SHARE, easing.leave));
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="line"
      style={style}
      piece={(p) => {
        const s = clock.start(p.index);
        const sett = m.settle(s, 'scene');
        const ex = clock.exit;
        const scaleAt = (t: number) => from ** (1 - progress(t, s, s + m.seconds('scene'))) * 0.4 ** exitAt(t);
        const speed = smear(travel((t) => scaleAt(t) * width * 0.5), width);
        const focus = (1 - sett) ** 2 * vh(1.4) + ex * vh(1.2);
        const blur = Math.max(0, speed + focus);
        return {
          scale: from ** (1 - sett) * 0.4 ** ex,
          opacity: progress(m.t, s, s + m.seconds('quick'), easing.travel) * (1 - ex),
          filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        };
      }}
    />
  );
};
