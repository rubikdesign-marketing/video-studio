// Text window: huge type used as a window. The letters are cut out of a brand-coloured page, so the picture behind
// shows only through them; then the window can open, the letters growing until the picture fills the frame.
import { measureText } from '@remotion/layout-utils';
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useId } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, lerp, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { asLines, type TextMoveProps } from './core';
import { useFitSize } from './split';

/**
 * `children` (a product screenshot, a gradient, a clip) fill the frame behind a cover of `cover` colour (accent by
 * default) that has the letters cut out. The cover fades in on `at`. If `open` is given, then from that second the
 * letters grow around the middle of one letter (`focus`, counted from 0 along the first line, default the middle
 * one) until it is bigger than the frame, and the cover clears as the picture fills it. The zoom is even in
 * ratio, over a hero length. Without `out` the window stays closed or open; with it, the cover fades away. Use a
 * heavy headline and few letters (one to three short words). Stars are ignored. Zoom is not motion-blurred (a
 * radial zoom has no direction to smear along).
 */
export const TextWindow: FC<
  Omit<TextMoveProps, 'align' | 'colours' | 'size'> & { children: ReactNode; size?: number; cover?: 'accent' | 'ink' | 'soft'; open?: number; focus?: number }
> = ({ lines, at, out, size = 24, style, children, cover = 'accent', open, focus }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const { width, height } = useVideoConfig();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const rows = asLines(lines).map((l) => l.replace(/\*/g, ''));
  const fontSize = useFitSize(rows, size, 0.9);
  const voice = brand.fonts.headline;
  const lineHeight = fontSize * 0.95;
  const widthOf = (text: string) =>
    measureText({ text, fontFamily: voice.css, fontSize, fontWeight: String(voice.weight), letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em` }).width;
  const baseline = (r: number) => height / 2 + (r - (rows.length - 1) / 2) * lineHeight + fontSize * 0.35;
  // The middle of the focus letter, on the first line (the line's text is centred on the frame).
  const first = [...rows[0]];
  const which = Math.min(first.length - 1, Math.max(0, focus ?? Math.floor((first.length - 1) / 2)));
  const before = widthOf(first.slice(0, which).join(''));
  const letter = widthOf(first[which]);
  const fx = width / 2 - widthOf(rows[0]) / 2 + before + letter / 2;
  const fy = baseline(0) - fontSize * 0.35;
  // Scale at which that letter covers the whole frame.
  const final = Math.max(width / Math.max(letter, 1), height / (fontSize * 0.72)) * 1.5;
  const opening = open === undefined ? 0 : progress(m.t, open, open + m.seconds('hero'), easing.travel);
  const scale = Math.exp(Math.log(final) * opening);
  const arrive = progress(m.t, at, at + m.seconds('base'));
  const leave = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  const clear = progress(opening, 0.7, 1);
  const colour = stage[cover];
  return (
    <AbsoluteFill style={style}>
      <AbsoluteFill>{children}</AbsoluteFill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, opacity: arrive * (1 - leave) * (1 - clear) }}>
        <defs>
          <mask id={`w${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
            <rect width={width} height={height} fill="white" />
            <g transform={`translate(${fx} ${fy}) scale(${scale}) translate(${-fx} ${-fy})`}>
              {rows.map((row, r) => (
                <text
                  key={r}
                  x={width / 2}
                  y={baseline(r)}
                  textAnchor="middle"
                  fill="black"
                  fontFamily={voice.css}
                  fontStyle={voice.style}
                  fontWeight={voice.weight}
                  fontSize={fontSize}
                  letterSpacing={voice.tracking === undefined ? undefined : `${voice.tracking}em`}
                  style={{ whiteSpace: 'pre' }}
                >
                  {row}
                </text>
              ))}
            </g>
          </mask>
        </defs>
        <rect width={width} height={height} fill={colour} mask={`url(#w${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** Where the opening ends, for a scene that cues the next thing after it. */
export const textWindowOpens = (open: number, hero: number) => open + hero;
void lerp;
