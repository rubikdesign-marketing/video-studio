// What the hook openers share: the written hook line laid out large enough to read with the sound off, the exit,
// and the hand-over to the film. An opener never sets its own type size: it asks for a share of the frame's SHORT
// side, so the line is as big in a 9:16 phone frame as in a 16:9 one (knowledge/craft/15-hooks.md, section 5).
import { measureText } from '@remotion/layout-utils';
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { em, voiceStyle } from '../moves/core';
import type { Voice } from '../tokens';
import { useStage } from '../ui';

/** Props every hook opener takes. */
export type OpenerProps = {
  /** Seconds on the scene clock when the opener starts. 0 is the first frame of the film. */
  at?: number;
  /** Seconds when the opener hands over. It leaves in a short fade; the film is already under it. Optional. */
  out?: number;
  /** The film that follows. Its own clock starts at 0 on `out`, so it can be written as if it began there. */
  next?: ReactNode;
  /** The written line's size as a per cent of the frame's SHORT side (the floor is 8.2). Shrunk, never grown, to fit. */
  size?: number;
  style?: CSSProperties;
};

/** The hook line's smallest size, per cent of the short side. The rule is 7.8; the extra keeps a measured line above it. */
export const HOOK_FLOOR = 8.2;
/** The default size of the written line, per cent of the short side. */
export const HOOK_SIZE = 12.5;

export type HookPart = { text: string; accent: boolean };
export type HookWord = { index: number; parts: HookPart[]; text: string; accent: boolean; row: number; x: number; width: number };
export type HookRow = { words: HookWord[]; width: number };
export type HookLayout = { size: number; rows: HookRow[]; lineHeight: number; width: number; height: number; short: number };

const STARRED = /^\*(.+?)\*(.*)$/;

/** Cuts a line into words; a starred word (`*word*`) and any punctuation after it are one word in two voices. */
const parseWords = (line: string) =>
  line
    .split(' ')
    .filter((raw) => raw.length > 0)
    .map((raw, index) => {
      const starred = STARRED.exec(raw);
      const parts: HookPart[] = starred ? [{ text: starred[1], accent: true }, ...(starred[2] ? [{ text: starred[2], accent: false }] : [])] : [{ text: raw, accent: false }];
      return { index, parts, text: parts.map((p) => p.text).join(''), accent: parts.some((p) => p.accent) };
    });

const widthOf = (text: string, voice: Voice, size: number) =>
  measureText({ text, fontFamily: voice.css, fontSize: size, fontWeight: String(voice.weight), letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em` }).width;

/** Stars the last word when no word is starred (the accent voice lands on the last word). */
export const starLast = (line: string) => {
  if (line.includes('*')) return line;
  const words = line.split(' ');
  words[words.length - 1] = `*${words[words.length - 1]}*`;
  return words.join(' ');
};

/** One word on its own: how wide it is at `size` pixels, accent parts in the accent voice. */
export const wordWidth = (parts: HookPart[], headline: Voice, accent: Voice, size: number) =>
  parts.reduce((total, p) => total + (p.accent ? widthOf(p.text, accent, size * accent.scale) : widthOf(p.text, headline, size)), 0);

/**
 * Lays the line out as large as it may be: starting from `size` per cent of the frame's short side, it takes the
 * largest size at which the line wraps into at most `maxLines` rows that fit `share` of the frame width, and never
 * goes below the hook floor (8.2% of the short side) unless the caller asks for less.
 */
export const useHookLayout = (line: string, { size = HOOK_SIZE, maxLines, share = 0.88, floor = HOOK_FLOOR, balance = false }: { size?: number; maxLines?: number; share?: number; floor?: number; balance?: boolean } = {}): HookLayout => {
  const brand = useBrand();
  const { width, height } = useVideoConfig();
  const short = Math.min(width, height);
  const { headline, accent } = brand.fonts;
  const words = parseWords(line);
  const limit = maxLines ?? (height > width ? 4 : 3);
  const maxWidth = width * share;
  const wrap = (px: number, limitWidth = maxWidth) => {
    const space = widthOf(' ', headline, px);
    const rows: HookRow[] = [];
    let row: HookRow = { words: [], width: 0 };
    for (const w of words) {
      const wide = wordWidth(w.parts, headline, accent, px);
      const next = row.words.length === 0 ? wide : row.width + space + wide;
      if (row.words.length > 0 && next > limitWidth) {
        rows.push(row);
        row = { words: [], width: 0 };
      }
      const x = row.words.length === 0 ? 0 : row.width + space;
      row.words.push({ ...w, row: rows.length, x, width: wide });
      row.width = x + wide;
    }
    rows.push(row);
    return rows;
  };
  let px = (short * size) / 100;
  const least = (short * Math.min(floor, size)) / 100;
  let rows = wrap(px);
  const fits = (r: HookRow[]) => r.length <= limit && Math.max(...r.map((x) => x.width)) <= maxWidth;
  while (!fits(rows) && px > least) {
    px = Math.max(least, px * 0.95);
    rows = wrap(px);
  }
  if (balance && rows.length > 1) {
    // Evens the rows out: the narrowest width that still wraps into the same number of rows, so no row is left with one word.
    const count = rows.length;
    let lo = Math.max(...words.map((w) => wordWidth(w.parts, headline, accent, px)));
    let hi = maxWidth;
    for (let i = 0; i < 12; i += 1) {
      const mid = (lo + hi) / 2;
      if (wrap(px, mid).length === count) hi = mid;
      else lo = mid;
    }
    rows = wrap(px, hi);
  }
  const lineHeight = px * (headline.lineHeight ?? 1.1);
  return { size: px, rows, lineHeight, width: Math.max(...rows.map((r) => r.width)), height: rows.length * lineHeight, short };
};

/** The layout of one row of a layout, for a move that animates row by row. */
export const rowOf = (layout: HookLayout, row: number): HookLayout => ({ ...layout, rows: [layout.rows[row]], height: layout.lineHeight, width: layout.rows[row].width });

/**
 * The written hook line: rows of words in the brand's headline face (starred words in its accent voice), each row
 * centred, each word its own inline box so a move can style it. `decorate` draws inside a word's box (for a caret),
 * `rowDecor` inside a row's box (for a strike).
 */
export const HookText: FC<{
  layout: HookLayout;
  word?: (word: HookWord) => CSSProperties;
  decorate?: (word: HookWord) => ReactNode;
  rowDecor?: (row: number, info: HookRow) => ReactNode;
  rowStyle?: (row: number) => CSSProperties;
  colour?: string;
  align?: 'left' | 'center';
  style?: CSSProperties;
}> = ({ layout, word, decorate, rowDecor, rowStyle, colour, align = 'center', style }) => {
  const brand = useBrand();
  const stage = useStage();
  const { accent } = brand.fonts;
  const accentStyle: CSSProperties = { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale), lineHeight: 0 };
  return (
    <div style={{ ...voiceStyle(brand.fonts.headline, layout.size), color: colour ?? stage.ink, width: 'fit-content', textAlign: align, ...style }}>
      {layout.rows.map((row, ri) => (
        <div key={ri} style={{ position: 'relative', width: 'fit-content', margin: align === 'center' ? '0 auto' : 0, whiteSpace: 'pre', ...rowStyle?.(ri) }}>
          {row.words.map((w, wi) => (
            <span key={wi}>
              {wi > 0 ? ' ' : null}
              <span style={{ display: 'inline-block', position: 'relative', whiteSpace: 'pre', ...word?.(w) }}>
                {w.parts.map((p, pi) => (
                  <span key={pi} style={p.accent ? accentStyle : undefined}>
                    {p.text}
                  </span>
                ))}
                {decorate?.(w)}
              </span>
            </span>
          ))}
          {rowDecor?.(ri, row)}
        </div>
      ))}
    </div>
  );
};

/** The place of the middle of a word inside the block `HookText` draws, in pixels from the block's top left. */
export const wordCentre = (layout: HookLayout, w: HookWord) => {
  const row = layout.rows[w.row];
  return { x: (layout.width - row.width) / 2 + w.x + w.width / 2, y: (w.row + 0.5) * layout.lineHeight };
};

/** A bar in the accent colour that grows from its left edge to `share` of `width`. */
export const Bar: FC<{ width: number; thickness: number; share: number; colour: string; style?: CSSProperties }> = ({ width, thickness, share, colour, style }) => (
  <div style={{ width, height: thickness, background: colour, borderRadius: thickness, transformOrigin: '0 50%', scale: `${share} 1`, ...style }} />
);

/** The ease of a hit: starts at full speed and stops dead (an exponential out, exact at both ends). */
export const hit = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : (1 - 2 ** (-10 * u)) / (1 - 2 ** -10));

/** Eases in and keeps speeding up: for something that flies at the lens. */
export const rush = (u: number) => Math.max(0, Math.min(1, u)) ** 2.4;

/**
 * The frame of an opener: everything inside is drawn, then leaves at `out` in a short fade, while `next` (the film)
 * is already running under it on its own clock from 0. The fade is the exit, so nothing is cut off mid-word.
 */
export const Opener: FC<{ out?: number; next?: ReactNode; children: ReactNode; style?: CSSProperties }> = ({ out, next, children, style }) => {
  const m = useMotion();
  const { fps } = useVideoConfig();
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  return (
    <AbsoluteFill>
      {next !== undefined && out !== undefined ? <Sequence from={Math.round(out * fps)}>{next}</Sequence> : null}
      {exit < 1 ? <AbsoluteFill style={{ opacity: 1 - exit, overflow: 'hidden', ...style }}>{children}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};

/** The block of the line, centred in the frame (a little above the middle in a tall frame, clear of the platform's own buttons). */
export const Centred: FC<{ children: ReactNode; style?: CSSProperties }> = ({ children, style }) => {
  const { width, height } = useVideoConfig();
  return <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: height > width ? height * 0.04 : 0, ...style }}>{children}</AbsoluteFill>;
};
