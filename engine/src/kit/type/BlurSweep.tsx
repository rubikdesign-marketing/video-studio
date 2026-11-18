// Blur sweep: a band of blur passes along the line. Behind it the letters are sharp and in place; ahead of it they
// are not there yet. (After Leonxlnx/cinetic, "blur sweep"; MIT.)
import type { CSSProperties, FC } from 'react';
import { easing } from '../motion';
import { useVh } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/** Half-width of the band, per cent of the line's width. */
const W = 18;
/** How soft the band is, per cent of frame height. */
const SOFT = 1.3;
const ROOM: CSSProperties = { padding: '0.2em 0.3em 0.28em', margin: '-0.2em -0.3em -0.28em' };
const masked = (image: string): CSSProperties => ({ maskImage: image, WebkitMaskImage: image });

/**
 * A band of blur travels along each line, left to right. The letters it has passed are sharp; the letters inside
 * it are soft and fading into focus; the ones ahead of it are not there. The exit sends a band along the line
 * again, taking the letters with it: ahead of the band they are sharp, inside it soft, behind it gone.
 * Two copies of the line sit exactly on top of each other: one sharp, one blurred, each shown through a moving mask.
 */
export const BlurSweep: FC<TextMoveProps> = ({ lines, at, out, size = 8, align = 'center', colours, style }) => {
  const clock = useTextClock(at, out, 'line');
  const vh = useVh();
  const rows = asLines(lines);
  const piece = (blurred: boolean) => (p: { index: number }): CSSProperties => {
    const u = clock.enter(p.index, 'scene', easing.travel);
    const leaving = clock.exit > 0;
    // Where the band's centre is, per cent along the line.
    const c = leaving ? -W + clock.exit * (100 + 1.4 * W) : -0.4 * W + u * (100 + 1.4 * W);
    let image: string;
    if (!leaving) {
      image = blurred
        ? `linear-gradient(90deg, transparent ${c - W}%, #000 ${c - 0.2 * W}%, #000 ${c}%, transparent ${c + 0.4 * W}%)`
        : `linear-gradient(90deg, #000 ${c - W}%, transparent ${c - 0.2 * W}%)`;
    } else {
      image = blurred
        ? `linear-gradient(90deg, transparent ${c - 0.4 * W}%, #000 ${c}%, #000 ${c + 0.2 * W}%, transparent ${c + W}%)`
        : `linear-gradient(90deg, transparent ${c + 0.2 * W}%, #000 ${c + W}%)`;
    }
    return { ...ROOM, ...masked(image), filter: blurred ? `blur(${vh(SOFT)}px)` : undefined };
  };
  return (
    <div style={{ position: 'relative' }}>
      <SplitText lines={rows} size={size} align={align} colours={colours} by="line" style={style} piece={piece(false)} />
      <SplitText lines={rows} size={size} align={align} colours={colours} by="line" style={{ ...style, position: 'absolute', top: 0, left: 0, right: 0 }} piece={piece(true)} />
    </div>
  );
};
