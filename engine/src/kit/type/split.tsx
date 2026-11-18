// The one splitter every text move shares. It cuts film type into lines, words and letters, keeps a starred word
// in the brand's accent voice, sizes the type so its widest line fits the frame in any of the four sizes, and
// hands each piece to the move as a style. A move never measures or splits text itself.
import { measureText } from '@remotion/layout-utils';
import { Fragment, type CSSProperties, type FC, type ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand, useFontsLoaded } from '../brand';
import { rng } from '../motion';
import { em, voiceStyle } from '../moves/core';
import type { StagePalette, Voice } from '../tokens';
import { useStage, useVh } from '../ui';

/** Which pieces a move animates. */
export type Unit = 'line' | 'word' | 'letter';

/** One piece of the text, with where it sits among the others. */
export type Piece = {
  /** The piece's own text: a letter, a word without its stars, or a whole line. */
  text: string;
  /** In the accent voice (the word was starred). */
  accent: boolean;
  line: number;
  /** Word number in the whole text, from 0. */
  word: number;
  /** Letter number in the whole text, from 0 (spaces are not counted). */
  letter: number;
  /** Number among pieces of the unit being animated, from 0, and how many there are. */
  index: number;
  count: number;
};

type SplitWord = { text: string; accent: boolean; letters: string[]; word: number; firstLetter: number };
type SplitLine = { text: string; words: SplitWord[] };
export type Split = { lines: SplitLine[]; words: number; letters: number };

/**
 * Cuts lines into words and letters. A word written `*word*` is in the accent voice (punctuation after it is not),
 * and so is every word of a starred phrase, `*in one place*`: the star opens on its first word and closes on its last.
 */
export const splitText = (lines: string[]): Split => {
  let word = 0;
  let letter = 0;
  const out: SplitLine[] = lines.map((line) => {
    const words: SplitWord[] = [];
    let inPhrase = false;
    // A token that is only stars is not a word and opens no phrase (a stray "*" in copy).
    for (const raw of line.split(' ').filter((w) => w.length > 0 && !/^\*+$/.test(w))) {
      // Leading punctuation, the star, the word, the closing star, and punctuation after it.
      const m = /^([^*\p{L}\p{N}]*)(\*?)(.*?)(\*?)([^*\p{L}\p{N}]*)$/u.exec(raw);
      const [, before, open, body, close, after] = m ?? ['', '', '', raw, '', ''];
      const starts = open === '*';
      const ends = close === '*';
      const accent = inPhrase || starts;
      const parts: { text: string; accent: boolean }[] = [];
      if (accent && (starts || ends || inPhrase)) {
        if (before) parts.push({ text: before, accent: false });
        parts.push({ text: body.replace(/\*/g, ''), accent: true });
        if (after) parts.push({ text: after, accent: false });
      } else parts.push({ text: raw.replace(/\*/g, ''), accent: false });
      inPhrase = (inPhrase || starts) && !ends;
      for (const part of parts.filter((p) => p.text.length > 0)) {
        const letters = [...part.text];
        words.push({ text: part.text, accent: part.accent, letters, word, firstLetter: letter });
        letter += letters.length;
      }
      word += 1;
    }
    return { text: line.replace(/\*/g, ''), words };
  });
  return { lines: out, words: word, letters: letter };
};

/** The order pieces arrive in: from the start, from the end, from the middle out, or shuffled (the same every render). */
export type Order = 'start' | 'end' | 'centre' | 'edges' | 'random';

/** The arrival rank of piece `i` of `n` in this order, 0 first. Pieces of equal rank arrive together. */
export const rankOf = (order: Order, i: number, n: number, seed = 7): number => {
  if (order === 'start') return i;
  if (order === 'end') return n - 1 - i;
  const middle = (n - 1) / 2;
  // Floor, so the middle piece (or the middle two of an even count) arrives first, at rank 0.
  if (order === 'centre') return Math.floor(Math.abs(i - middle));
  if (order === 'edges') return Math.round(middle - Math.abs(i - middle));
  // A fixed shuffle: piece i takes the place it has in a seeded permutation.
  const random = rng(seed);
  const keys = Array.from({ length: n }, (_, k) => ({ k, r: random() }));
  keys.sort((a, b) => a.r - b.r);
  return keys.findIndex((key) => key.k === i);
};

/** The highest rank in an order, so a move knows when its last piece starts. */
export const lastRank = (order: Order, n: number) => (n <= 0 ? 0 : Math.max(...Array.from({ length: n }, (_, i) => rankOf(order, i, n))));

/** The widest share of the frame width a line of film type may take. */
export const MAX_WIDTH = 0.86;

const widthOf = (text: string, voice: Voice, size: number) =>
  measureText({
    text,
    fontFamily: voice.css,
    fontSize: size,
    fontWeight: String(voice.weight),
    letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em`,
    // An italic accent is narrower than its upright cut: measure it as it is drawn.
    additionalStyles: { fontStyle: voice.style },
  }).width;

/** A text's width in pixels in one of the brand's voices, as drawn. For moves that place pieces themselves. */
export const textWidth = widthOf;

/**
 * The type size in pixels for `size` per cent of frame height, made smaller when the widest line would not fit
 * `share` of the frame's width. A 16:9 headline therefore keeps its size, and the same headline in 9:16 shrinks
 * just enough to fit. Accent words are measured in the accent voice.
 */
export const useFitSize = (lines: string[], size: number, share = MAX_WIDTH, voiceName: 'headline' | 'label' | 'product' = 'headline') => {
  const brand = useBrand();
  const vh = useVh();
  const { width } = useVideoConfig();
  const want = vh(size);
  // Measuring before the brand's fonts are in would measure a fallback face, and the measure is cached: wait.
  const fontsLoaded = useFontsLoaded();
  if (!fontsLoaded) return want;
  const voice = brand.fonts[voiceName];
  const { accent } = brand.fonts;
  const split = splitText(lines);
  const widest = Math.max(
    1,
    ...split.lines.map((line) =>
      line.words.reduce(
        // A space only between words: a starred word and the punctuation after it are one word on screen.
        (total, w, i) => total + (i > 0 && w.word !== line.words[i - 1].word ? widthOf(' ', voice, want) : 0) + (w.accent ? widthOf(w.text, accent, want * accent.scale) : widthOf(w.text, voice, want)),
        0,
      ),
    ),
  );
  return Math.min(want, (want * width * share) / widest);
};

/** Colour role of each line: the first in ink, the rest in the stage's second colour (as Headline does). */
export type LineColour = keyof Pick<StagePalette, 'ink' | 'second' | 'accent'>;

export type SplitTextProps = {
  lines: string[];
  /** Type size, per cent of frame height. Shrunk to fit narrow frames. */
  size?: number;
  align?: 'left' | 'center' | 'right';
  /** The pieces `piece` styles. */
  by: Unit;
  /** The style of one piece. Called for every piece on every frame: keep it a pure function of the piece and time. */
  piece: (piece: Piece) => CSSProperties;
  /** What a piece contains, if not its own text (for decode and typing moves that show other letters). */
  content?: (piece: Piece) => ReactNode;
  /**
   * Each piece sits in a still window cut to its own box, and its style moves it inside that window: a piece that
   * slides out of its window is hidden (mask reveals). The window is padded so accents and descenders are not cut.
   */
  mask?: boolean;
  /** Style of each whole line (for a line that moves as one around its letters). */
  line?: (index: number) => CSSProperties;
  /** Colour roles by line. Default: ink, then second. */
  colours?: LineColour[];
  voice?: 'headline' | 'label' | 'product';
  style?: CSSProperties;
};

const inline: CSSProperties = { display: 'inline-block', whiteSpace: 'pre' };
/**
 * A masked piece's window: padded beyond the piece's box (so descenders, accents and an italic's overhang are not
 * cut) and pulled back by the same amount, so the layout is the same as unmasked.
 */
const MASK_BOX: CSSProperties = { ...inline, padding: '0.1em 0.08em 0.16em', margin: '-0.1em -0.08em -0.16em', clipPath: 'inset(0)' };

/** One piece: its style on an inline box, inside a still window when masked. */
const Box: FC<{ style: CSSProperties; mask: boolean; children: ReactNode; outer?: CSSProperties }> = ({ style, mask, children, outer }) =>
  mask ? (
    <span style={{ ...MASK_BOX, ...outer }}>
      <span style={{ ...inline, ...style }}>{children}</span>
    </span>
  ) : (
    <span style={{ ...inline, ...outer, ...style }}>{children}</span>
  );

/**
 * Lays out text and styles each piece. Words never break inside; lines break where the caller put them. Each
 * piece is an inline block, so transforms, blur and clip apply to it alone.
 */
export const SplitText: FC<SplitTextProps> = ({ lines, size = 7, align = 'center', by, piece, content, mask = false, line, colours, voice = 'headline', style }) => {
  const brand = useBrand();
  const stage = useStage();
  const fontSize = useFitSize(lines, size, MAX_WIDTH, voice);
  const split = splitText(lines);
  const { accent } = brand.fonts;
  // The accent's own tracking, as it is measured in useFitSize (and as kit Headlines set it).
  const accentStyle: CSSProperties = { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale), letterSpacing: em(accent.tracking) };
  const count = by === 'line' ? split.lines.length : by === 'word' ? split.words : split.letters;
  const roles = colours ?? (['ink', 'second'] as LineColour[]);
  return (
    <div style={{ ...voiceStyle(brand.fonts[voice], fontSize), textAlign: align, ...style }}>
      {split.lines.map((l, li) => {
        const lineStyle = line?.(li) ?? {};
        const linePiece: Piece = { text: l.text, accent: false, line: li, word: l.words[0]?.word ?? 0, letter: l.words[0]?.firstLetter ?? 0, index: li, count };
        const body = l.words.map((w, wi) => {
          const space = wi > 0 && w.word !== l.words[wi - 1].word ? ' ' : null;
          const wordPiece: Piece = { text: w.text, accent: w.accent, line: li, word: w.word, letter: w.firstLetter, index: w.word, count };
          const outer = w.accent ? accentStyle : undefined;
          let inner: ReactNode;
          if (by === 'letter') {
            inner = w.letters.map((ch, ci) => {
              const p: Piece = { text: ch, accent: w.accent, line: li, word: w.word, letter: w.firstLetter + ci, index: w.firstLetter + ci, count };
              return (
                <Box key={ci} style={piece(p)} mask={mask}>
                  {content ? content(p) : ch}
                </Box>
              );
            });
          }
          return (
            <Fragment key={wi}>
              {space}
              {by === 'word' ? (
                <Box style={piece(wordPiece)} mask={mask} outer={outer}>
                  {content ? content(wordPiece) : w.text}
                </Box>
              ) : (
                <span style={{ ...inline, ...outer }}>{by === 'letter' ? inner : w.text}</span>
              )}
            </Fragment>
          );
        });
        return (
          <div key={li} style={{ color: stage[roles[Math.min(li, roles.length - 1)]], ...lineStyle }}>
            {by === 'line' ? (
              <Box style={piece(linePiece)} mask={mask}>
                {content ? content(linePiece) : body}
              </Box>
            ) : (
              <span style={inline}>{body}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
