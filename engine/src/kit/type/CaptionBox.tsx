// Caption box: a short-form caption style. The words of the current phrase stand in large type and a box in the
// brand's highlight colour moves from word to word as each is spoken. A brand may choose it for 9:16 instead of
// the fixed glass pill (Captions.tsx); LIBRARY-PLAN decision 6. The file also holds what the second style
// (CaptionPop) shares: grouping words into phrases, the place a caption takes, and the layer that draws a phrase.
import { measureText } from '@remotion/layout-utils';
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { isWide, sizedLayout } from '../capture/relayout';
import { easing, EXIT_SHARE, lerp, progress, useMotion } from '../motion';
import { alpha, contrast } from '../tokens';
import { useVh } from '../ui';

/** One spoken word: its text and when it starts and ends, in seconds. */
export type SpokenWord = { text: string; start: number; end: number };

/** A word may show up to 100 ms before it is spoken, never after (as in Captions.tsx). */
const LEAD = 0.1;
/** Reading time after a phrase's last word before it goes (as in Captions.tsx). */
const HOLD = 0.4;
/** The same safe margin at the bottom of a wide frame as the fixed captions use (Captions.tsx, SAFE_MARGIN). */
const SAFE_MARGIN = 6;
const LINE = 1.16;
/** Opacity of a word not yet spoken. */
const UPCOMING = 0.3;

/**
 * Groups words into phrases of up to `maxWords` words. A phrase never spans a pause longer than `maxGap` seconds
 * or the end of a sentence; a long stretch is cut into even parts rather than five words and a stray one.
 */
export const groupPhrases = (words: SpokenWord[], maxWords = 5, maxGap = 0.45): SpokenWord[][] => {
  const stretches: SpokenWord[][] = [];
  let run: SpokenWord[] = [];
  words.forEach((word, i) => {
    const before = words[i - 1];
    const breaks = before !== undefined && (word.start - before.end > maxGap || /[.!?]$/.test(before.text) || (/[,;:]$/.test(before.text) && run.length >= 3));
    if (breaks) {
      stretches.push(run);
      run = [];
    }
    run.push(word);
  });
  if (run.length > 0) stretches.push(run);
  return stretches.flatMap((stretch) => {
    const parts = Math.ceil(stretch.length / maxWords);
    const each = Math.ceil(stretch.length / parts);
    return Array.from({ length: parts }, (_, p) => stretch.slice(p * each, (p + 1) * each));
  });
};

/**
 * Where a caption sits and how big its type is. In a wide frame: centred, in the bottom safe margin. In 9:16, 1:1
 * and 4:5: the band the platforms leave free, at its bottom (the same slot as the fixed captions, relayout.ts).
 */
export const useCaptionSlot = (sizeOverride?: number) => {
  const { width, height } = useVideoConfig();
  const vh = useVh();
  const band = isWide(width, height) ? null : sizedLayout(width, height).band;
  const maxWidth = band ? band.width : width * 0.78;
  return {
    x: band ? band.x : (width - maxWidth) / 2,
    maxWidth,
    bottom: band ? band.y + band.height : height - vh(SAFE_MARGIN),
    // Large caption type: 8% of frame height, and no more than an eighth of the band's width.
    size: sizeOverride === undefined ? Math.min(vh(8), maxWidth * 0.125) : vh(sizeOverride),
  };
};

type Rect = { x: number; y: number; width: number; height: number };

/** Lays a phrase out in lines of at most `maxWidth` pixels, centred, from measured word widths. */
const layoutPhrase = (words: SpokenWord[], font: { css: string; weight: number; tracking?: number }, size: number, maxWidth: number, extraGap: number) => {
  const measure = (text: string) =>
    measureText({ text, fontFamily: font.css, fontSize: size, fontWeight: String(font.weight), letterSpacing: font.tracking === undefined ? undefined : `${font.tracking}em` }).width;
  // A lone space measures as nothing, so the space is the difference a space makes between two letters.
  const gap = Math.max(measure('a a') - measure('aa'), size * 0.26) + extraGap;
  const widths = words.map((w) => measure(w.text));
  const lines: number[][] = [[]];
  let used = 0;
  widths.forEach((w, i) => {
    const line = lines[lines.length - 1];
    if (line.length > 0 && used + gap + w > maxWidth) {
      lines.push([i]);
      used = w;
    } else {
      line.push(i);
      used += line.length > 1 ? gap + w : w;
    }
  });
  const rects: Rect[] = [];
  const lineHeight = size * LINE;
  lines.forEach((line, li) => {
    const total = line.reduce((sum, i) => sum + widths[i], 0) + gap * (line.length - 1);
    let x = (maxWidth - total) / 2;
    for (const i of line) {
      rects[i] = { x, y: li * lineHeight, width: widths[i], height: lineHeight };
      x += widths[i] + gap;
    }
  });
  return { rects, lineHeight, height: lines.length * lineHeight };
};

/** What a caption style is told when it draws one phrase. Positions are relative to the phrase's own box. */
export type PhraseContext = {
  words: SpokenWord[];
  rects: Rect[];
  size: number;
  lineHeight: number;
  t: number;
  quick: number;
  /** Index of the word being spoken now, or -1 before the first. */
  current: number;
  colours: { text: string; highlight: string; onHighlight: string; shadow: string };
  settle: (at: number) => number;
  /** The word's own style: where it is, its type, and its arrival (rises a little as it is spoken). */
  wordStyle: (i: number) => CSSProperties;
};

/**
 * The layer every short-form caption style is drawn on: groups the words into phrases, lays each out in the
 * caption slot, fades one phrase out as the next begins, and lets `draw` paint the words of a phrase.
 */
export const CaptionLayer: FC<{
  words: SpokenWord[];
  at?: number;
  out?: number;
  maxWords?: number;
  size?: number;
  extraGap?: number;
  draw: (context: PhraseContext) => ReactNode;
}> = ({ words, at = 0, out, maxWords = 5, size, extraGap = 0, draw }) => {
  const m = useMotion();
  const brand = useBrand();
  const slot = useCaptionSlot(size);
  const { captions, fonts } = brand;
  const font = { css: fonts.headline.css, weight: captions.weight, tracking: fonts.headline.tracking };
  const quick = m.seconds('quick');
  const exitLength = quick * EXIT_SHARE;
  const onHighlight = contrast(captions.highlight, captions.text) >= contrast(captions.highlight, captions.glassBottom) ? captions.text : captions.glassBottom;
  const colours = { text: captions.text, highlight: captions.highlight, onHighlight, shadow: alpha(captions.glassBottom, 0.6) };
  const phrases = groupPhrases(
    words.map((w) => ({ ...w, start: w.start + at, end: w.end + at })),
    maxWords,
  );
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {phrases.map((phrase, p) => {
        const appears = phrase[0].start - LEAD;
        const next = phrases[p + 1];
        const leaves = Math.min(phrase[phrase.length - 1].end + HOLD, next ? next[0].start - LEAD : Infinity, out ?? Infinity);
        const fade = progress(m.t, leaves, leaves + exitLength, easing.leave);
        if (m.t < appears || fade >= 1) return null;
        const layout = layoutPhrase(phrase, font, slot.size, slot.maxWidth, extraGap * slot.size);
        const current = phrase.findLastIndex((w) => m.t >= w.start - LEAD);
        const wordStyle = (i: number): CSSProperties => {
          // Words still to come sit faint, so the phrase is always whole and centred; each one comes up as it is spoken.
          const arrived = lerp(UPCOMING, 1, progress(m.t, phrase[i].start - LEAD, phrase[i].start + LEAD / 2));
          const r = layout.rects[i];
          return {
            position: 'absolute',
            left: r.x,
            top: r.y,
            lineHeight: `${layout.lineHeight}px`,
            whiteSpace: 'pre',
            opacity: arrived,
            translate: `0 ${(1 - progress(arrived, UPCOMING, 1)) * 0.12}em`,
          };
        };
        return (
          <div
            key={p}
            style={{
              position: 'absolute',
              left: slot.x,
              top: slot.bottom - layout.height,
              width: slot.maxWidth,
              height: layout.height,
              opacity: 1 - fade,
              translate: `0 ${-fade * slot.size * 0.25}px`,
              color: captions.text,
              fontFamily: fonts.headline.css,
              fontStyle: fonts.headline.style,
              fontWeight: captions.weight,
              fontSize: slot.size,
              letterSpacing: fonts.headline.tracking === undefined ? undefined : `${fonts.headline.tracking}em`,
            }}
          >
            {draw({ words: phrase, rects: layout.rects, size: slot.size, lineHeight: layout.lineHeight, t: m.t, quick, current, colours, settle: (a) => m.settle(a, 'quick'), wordStyle })}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Padding of the box around a word, in em of the caption type. */
const BOX_X = 0.2;
const BOX_Y = 0.04;

/**
 * Large caption type with a highlight box that jumps from the word just spoken to the word being spoken, sliding
 * to it over a quick length. Words not yet spoken sit faint and come up as they are spoken (up to 100 ms before). The box is in the
 * brand's caption highlight colour and the word on it in whichever of the caption text colour or the glass colour
 * reads better. Takes `words` (not `lines`) with seconds on the scene clock; `at` shifts them all. Phrases of up
 * to `maxWords` words are cut at pauses and sentence ends. Place: the platform-safe band (the same as the fixed
 * captions), in type 8% of the frame height, no wider than an eighth of the band.
 */
export const CaptionBox: FC<{ words: SpokenWord[]; at?: number; out?: number; maxWords?: number; size?: number }> = ({ words, at, out, maxWords, size }) => (
  <CaptionLayer
    words={words}
    at={at}
    out={out}
    maxWords={maxWords}
    size={size}
    extraGap={0.2}
    draw={(c) => {
      const spoken = c.current;
      // The box leaves the previous word's place and arrives at this word's, over a quick length from its start.
      const e = spoken < 0 ? 0 : progress(c.t, c.words[spoken].start - LEAD, c.words[spoken].start - LEAD + c.quick, easing.arrive);
      const to = spoken < 0 ? undefined : c.rects[spoken];
      const from = spoken > 0 ? c.rects[spoken - 1] : to;
      const box = to && from ? { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), width: lerp(from.width, to.width, e), height: lerp(from.height, to.height, e) } : undefined;
      return (
        <>
          {box ? (
            <div
              style={{
                position: 'absolute',
                left: box.x - c.size * BOX_X,
                top: box.y + c.size * (0.02 + BOX_Y),
                width: box.width + c.size * BOX_X * 2,
                height: box.height - c.size * (0.04 + BOX_Y * 2),
                borderRadius: c.size * 0.22,
                background: c.colours.highlight,
                opacity: spoken === 0 ? e : 1,
                scale: spoken === 0 ? `${lerp(0.88, 1, e)}` : undefined,
              }}
            />
          ) : null}
          {c.words.map((w, i) => {
            const on = i === spoken ? e : i === spoken - 1 ? 1 - e : 0;
            return (
              <span key={i} style={{ ...c.wordStyle(i), textShadow: `0 ${c.size * 0.04}px ${c.size * 0.2}px ${c.colours.shadow}` }}>
                {w.text}
                {/* The same word in the colour that reads on the box, laid over it while the box is there. */}
                <span style={{ position: 'absolute', left: 0, top: 0, color: c.colours.onHighlight, opacity: on, textShadow: 'none' }}>{w.text}</span>
              </span>
            );
          })}
        </>
      );
    }}
  />
);
