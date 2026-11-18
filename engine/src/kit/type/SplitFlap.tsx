// Split flap: every letter is a tile on a departure board. It flips through the alphabet, the top half falling
// over the bottom, until it shows its own letter; the tiles start a beat apart. For times, status and short
// announcements. After Leonxlnx/cinetic, "split flap" (MIT).
import type { CSSProperties, FC, ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { clamp01, progress, rng } from '../motion';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, splitText, SplitText, type Order } from './split';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
/** A tile's width and height, in em of the type size. */
const TILE = { width: 0.7, height: 1.1 } as const;
/** The gap between tiles, in em. */
const TILE_GAP = 0.05;
/** The width a space takes between words, in em. */
const SPACE = 0.3;

const poolFor = (ch: string) => (/[A-Z]/.test(ch) ? UPPER : /\d/.test(ch) ? DIGITS : '');

/** One half of a tile showing `glyph`: its upper half or its lower half. */
const Half: FC<{ glyph: string; top: boolean; fill: string; style?: CSSProperties; children?: ReactNode }> = ({ glyph, top, fill, style, children }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      [top ? 'top' : 'bottom']: 0,
      height: '50%',
      overflow: 'hidden',
      background: fill,
      borderRadius: top ? '0.09em 0.09em 0 0' : '0 0 0.09em 0.09em',
      backfaceVisibility: 'hidden',
      ...style,
    }}
  >
    <div style={{ position: 'absolute', left: 0, right: 0, [top ? 'top' : 'bottom']: 0, height: '200%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{glyph}</div>
    {children}
  </div>
);

/**
 * Every letter is a flip tile (letters show in capitals, as on a board). A tile flips through the alphabet up to
 * its own letter, three to six flips by tile, each a top half dropping over the bottom half and the next letter's
 * bottom half settling. Tiles start `order` apart (default left to right). Digits flip through digits;
 * punctuation sits on its tile without flipping. The tiles stay on screen until `out`.
 */
export const SplitFlap: FC<TextMoveProps & { order?: Order; seed?: number }> = ({ lines, at, out, size = 7, align = 'center', colours, style, order = 'start', seed = 9 }) => {
  const clock = useTextClock(at, out, 'letter');
  const { m } = clock;
  const stage = useStage();
  const mix = `color-mix(in srgb, ${stage.soft}, ${stage.shade} 14%)`;
  const vh = useVh();
  const { width } = useVideoConfig();
  const all = asLines(lines);

  // Tiles are wider than the letters they hold, so the fit is worked out from the tiles' own width.
  const split = splitText(all);
  const widest = Math.max(1, ...split.lines.map((line) => line.words.reduce((sum, w, i) => sum + (i > 0 ? SPACE : 0) + w.letters.length * (TILE.width + 2 * TILE_GAP), 0)));
  const fontPx = Math.min(vh(size), (width * 0.86) / widest);

  const flip = m.seconds('tick') * 1.5;
  const gap = m.seconds('tick') * 0.5;
  const enter = progress(m.t, at, at + m.seconds('quick'));
  return (
    <SplitText
      lines={all}
      size={fontPx / vh(1)}
      align={align}
      colours={colours}
      by="letter"
      style={{ opacity: enter * (1 - clock.exit), ...style }}
      piece={() => ({ margin: `0 ${TILE_GAP}em`, verticalAlign: 'middle' })}
      content={(p) => {
        const real = p.text.toUpperCase();
        const pool = poolFor(real);
        const tile: CSSProperties = { position: 'relative', display: 'inline-block', width: `${TILE.width}em`, height: `${TILE.height}em`, perspective: '5em', color: stage[colours?.[Math.min(p.line, (colours?.length ?? 1) - 1)] ?? (p.line === 0 ? 'ink' : 'second')], textAlign: 'center', boxShadow: `0 0 0 1px ${stage.line}`, borderRadius: '0.09em' };
        const fill = mix;
        const hingeFor = (settled: boolean): CSSProperties => ({ position: 'absolute', left: 0, right: 0, top: '50%', height: '0.02em', marginTop: '-0.01em', background: alpha(stage.shade, settled ? 0.08 : 0.55), zIndex: 3 });
        if (!pool) {
          return (
            <span style={tile}>
              <Half glyph={real} top fill={fill} />
              <Half glyph={real} top={false} fill={fill} />
              <span style={hingeFor(true)} />
            </span>
          );
        }
        const random = rng(seed * 6007 + p.index * 131);
        const flips = 3 + Math.floor(random() * 4);
        const at0 = at + rankOf(order, p.index, p.count) * gap;
        const u = Math.min(flips, Math.max(0, (m.t - at0) / flip));
        const base = pool.indexOf(real);
        const glyphAt = (k: number) => pool[(((base - flips + k) % pool.length) + pool.length) % pool.length];
        const k = Math.min(flips - 1, Math.floor(u));
        const done = u >= flips;
        const p01 = done ? 1 : u - k;
        const [old, next] = done ? [real, real] : [glyphAt(k), glyphAt(k + 1)];
        // Top half falls (accelerating) in the first half of the flip; the new bottom half settles in the second.
        const fall = clamp01(p01 * 2);
        const rise = clamp01(p01 * 2 - 1);
        const shade = (amount: number): CSSProperties => ({ position: 'absolute', inset: 0, background: alpha(stage.shade, 0.4 * amount) });
        return (
          <span style={tile}>
            <Half glyph={done ? real : next} top fill={fill} />
            <Half glyph={old} top={false} fill={fill} />
            {!done && p01 < 0.5 ? (
              <Half glyph={old} top fill={fill} style={{ transformOrigin: 'bottom', transform: `rotateX(${-90 * fall * fall}deg)`, zIndex: 2 }}>
                <span style={shade(fall)} />
              </Half>
            ) : null}
            {!done && p01 >= 0.5 ? (
              <Half glyph={next} top={false} fill={fill} style={{ transformOrigin: 'top', transform: `rotateX(${90 * (1 - (1 - (1 - rise) * (1 - rise)))}deg)`, zIndex: 2 }}>
                <span style={shade(1 - rise)} />
              </Half>
            ) : null}
            <span style={hingeFor(done)} />
          </span>
        );
      }}
    />
  );
};
