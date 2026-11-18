// Focus in: the whole text starts slightly large and soft, then pulls into focus and size together, as a lens
// focusing. A focus pull for type; unlike BlurIn it moves the text as one, not word by word.
import type { FC } from 'react';
import { easing } from '../motion';
import { useVh } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/** How soft it starts, per cent of frame height; how much larger. */
const SOFT = 1.8;
const LARGER = 0.1;

/**
 * Every line starts a tenth too large and out of focus, fades up quickly, and settles to its real size and a
 * clean edge over a `scene` length (the blur clears a little after the size does, so the focus is what is
 * noticed). Lines arrive together. The exit drifts out of focus the other way: a touch larger, softer, gone.
 */
export const FocusIn: FC<TextMoveProps> = ({ lines, at, out, size = 8, align = 'center', colours, style }) => {
  const clock = useTextClock(at, out, 'line');
  const vh = useVh();
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="line"
      style={style}
      piece={() => {
        const grow = 1 - clock.enter(0, 'scene', easing.arrive);
        const soft = 1 - clock.enter(0, 'scene', easing.travel);
        const seen = clock.enter(0, 'quick');
        const e = clock.exit;
        const blur = soft * vh(SOFT) + e * vh(SOFT);
        return {
          opacity: seen * (1 - e),
          scale: 1 + grow * LARGER + e * LARGER * 0.5,
          filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
          transformOrigin: '50% 55%',
        };
      }}
    />
  );
};
