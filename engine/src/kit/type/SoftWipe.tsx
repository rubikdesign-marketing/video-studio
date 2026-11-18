// Soft wipe: a soft-edged mask sweeps across each line from the reading side and writes it on. The gentle
// write-on; no hard edge anywhere. (After Leonxlnx/cinetic, "soft edge write-on"; MIT.)
import type { CSSProperties, FC } from 'react';
import { easing } from '../motion';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/** Width of the soft edge, per cent of the line's width. */
const EDGE = 28;
/** Padding that keeps descenders and accents inside the mask, pulled back with an equal margin. */
const ROOM: CSSProperties = { padding: '0.1em 0.1em 0.18em', margin: '-0.1em -0.1em -0.18em' };

/** A gradient mask as a style, with the prefixed name too. */
const masked = (image: string): CSSProperties => ({ maskImage: image, WebkitMaskImage: image });

/**
 * Each line is written on by a soft-edged mask moving across it, left to right (`direction: "rtl"` for right to
 * left scripts). Lines follow one another a short gap apart. The exit wipes each line off the same way, so the
 * text leaves as it came.
 */
export const SoftWipe: FC<TextMoveProps & { direction?: 'ltr' | 'rtl' }> = ({ lines, at, out, size = 8, align = 'center', colours, style, direction = 'ltr' }) => {
  const clock = useTextClock(at, out, 'line');
  const to = direction === 'ltr' ? '90deg' : '270deg';
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="line"
      style={style}
      piece={(p) => {
        const u = clock.enter(p.index, 'scene', easing.travel);
        // Entering: opaque behind the edge, clear ahead. Leaving: clear behind the edge, opaque ahead.
        const edge = -EDGE + u * (100 + EDGE);
        const gone = -EDGE + clock.exit * (100 + EDGE);
        const image =
          clock.exit > 0
            ? `linear-gradient(${to}, transparent ${gone}%, #000 ${gone + EDGE}%)`
            : `linear-gradient(${to}, #000 ${edge}%, transparent ${edge + EDGE}%)`;
        return { ...ROOM, ...masked(image) };
      }}
    />
  );
};
