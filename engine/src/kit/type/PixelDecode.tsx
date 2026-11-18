// Pixel decode: a line resolves from coarse blocks to sharp type in a few steps, as an image does when it
// loads. For a reveal that should feel digital without moving. After Leonxlnx/cinetic, "pixel reveal" (MIT).
import { useId, type FC } from 'react';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText, useFitSize } from './split';

/** The block size of each step, as a share of the type size: coarse first, sharp after the last. */
const BLOCKS = [0.6, 0.38, 0.24, 0.15, 0.09, 0.05] as const;

/**
 * Each line shows in blocks that halve, step by step, until it is sharp (six steps of about a tick and a half;
 * a line after the first starts a quick length later). The blocks are an SVG filter on the real text (it samples
 * the type on a grid and fills each cell), so it needs no canvas and is the same on every render. Every step is
 * an instant change, and the move's note lists them as planned.
 */
export const PixelDecode: FC<TextMoveProps> = ({ lines, at, out, size = 8, align = 'center', colours, style }) => {
  const clock = useTextClock(at, out, 'line');
  const { m } = clock;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const all = asLines(lines);
  const fontPx = useFitSize(all, size);
  const stepLength = m.seconds('tick') * 1.5;
  const lineGap = m.seconds('quick') * 0.6;
  const blockAt = (line: number) => {
    const s = Math.floor((m.t - (at + line * lineGap)) / stepLength);
    if (s < 0) return null;
    return s >= BLOCKS.length ? 0 : Math.max(4, Math.round(BLOCKS[s] * fontPx));
  };
  return (
    <>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        {all.map((_, li) => {
          const b = blockAt(li);
          if (!b) return null;
          return (
            <filter key={li} id={`${id}-${li}-${b}`} x="-5%" y="-8%" width="110%" height="116%" colorInterpolationFilters="sRGB">
              <feFlood x={Math.floor(b / 2) - 1} y={Math.floor(b / 2) - 1} width={2} height={2} />
              <feComposite width={b} height={b} />
              <feTile result="grid" />
              <feComposite in="SourceGraphic" in2="grid" operator="in" />
              <feMorphology operator="dilate" radius={Math.floor(b / 2)} />
            </filter>
          );
        })}
      </svg>
      <SplitText
        lines={all}
        size={size}
        align={align}
        colours={colours}
        by="line"
        style={{ opacity: 1 - clock.exit, ...style }}
        piece={(p) => {
          const b = blockAt(p.index);
          return { opacity: b === null ? 0 : 1, filter: b ? `url(#${id}-${p.index}-${b})` : undefined };
        }}
      />
    </>
  );
};
