// Arc swing: words swing up on an arc about the left end of their baseline and land upright, one after another.
// Energetic, a little theatrical.
import type { FC } from 'react';
import { easing, progress } from '../motion';
import { smear, useTravel } from '../moves/core';
import { useVideoConfig } from 'remotion';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, SplitText, useFitSize, type Order } from './split';

/**
 * Each word hangs `angle` degrees below its own baseline start and swings up about that point into place,
 * with a small overshoot. A word is blurred a little while its far end is moving fast. The exit swings the words up
 * and away the other way. `order` is the order words swing in.
 */
export const ArcSwing: FC<TextMoveProps & { angle?: number; order?: Order }> = ({ lines, at, out, size = 9, align = 'center', colours, style, angle = 65, order = 'start' }) => {
  const clock = useTextClock(at, out, 'word', 'quick');
  const { m } = clock;
  const travel = useTravel();
  const { width } = useVideoConfig();
  const px = useFitSize(asLines(lines), size);
  const exitAt = (t: number) => (out === undefined ? 0 : progress(t, out, out + m.seconds('quick') * 0.65, easing.leave));
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
        const sett = m.settle(s, 'base');
        const deg = angle * (1 - sett) - (angle + 25) * clock.exit;
        // The far end of the word sweeps a circle as long as the word: its speed sets the blur.
        const reach = p.text.length * px * 0.5;
        const radians = (t: number) => ((angle * (1 - progress(t, s, s + m.seconds('base'))) - (angle + 25) * exitAt(t)) * Math.PI) / 180;
        const blur = smear(travel((t) => radians(t) * reach), width);
        return {
          rotate: `${deg}deg`,
          transformOrigin: '0% 100%',
          opacity: progress(m.t, s, s + m.seconds('tick'), easing.travel) * (1 - clock.exit),
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        };
      }}
    />
  );
};
