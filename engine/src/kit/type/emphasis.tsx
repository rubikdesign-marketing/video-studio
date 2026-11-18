// Shared by the text emphasis moves (highlighter, mark-word, shimmer, colour-front, gradient-ink, payoff-punch,
// weight-wave, letter-wave, voice-swap): choose the words to emphasise, lay the line out through the shared
// splitter, and hand each chosen word (or run of chosen words) to the move. The splitter itself is not changed.
import { Fragment, type CSSProperties, type FC, type ReactNode } from 'react';
import { useBrand } from '../brand';
import { clamp01 } from '../motion';
import { em } from '../moves/core';
import type { Voice } from '../tokens';
import { useStage } from '../ui';
import { splitText, SplitText, textWidth, useFitSize, type LineColour } from './split';

/**
 * Which words are chosen. A string is a word or a phrase ("one", "save time", the stars are ignored; the first
 * place it occurs is used); a number is a word's place in the text, from 0; a list mixes both. Left out, the
 * starred words (`*word*`) are chosen.
 */
export type Mark = string | number | Array<string | number>;

/** One piece of a line: a word, or the punctuation that follows a starred word. */
export type Entry = {
  text: string;
  accent: boolean;
  line: number;
  /** Word number in the whole text, from 0. */
  word: number;
  letters: string[];
  /** A space comes before it. */
  spaceBefore: boolean;
  /** It is one of the chosen words. */
  target: boolean;
  /** The run of neighbouring chosen words it belongs to, or -1. */
  run: number;
  /** Where it starts and ends along its run, as shares of the run's letters (spaces count). */
  from: number;
  to: number;
  /** Letters (and spaces) in its run before it. */
  offset: number;
  runFirst: boolean;
  runLast: boolean;
};

/** Neighbouring chosen words on one line: the unit a marker or a front travels along. */
export type Run = { id: number; line: number; entries: Entry[]; chars: number };

const norm = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

type Analysis = { lines: Entry[][]; runs: Run[] };

/** Splits the lines and marks the chosen words. `fallback` says what is chosen when nothing is (the last word, or nothing). */
export const analyse = (lines: string[], mark: Mark | undefined, fallback: 'last' | 'none'): Analysis => {
  const split = splitText(lines);
  const grid: Entry[][] = split.lines.map((line, li) => {
    const out: Entry[] = [];
    line.words.forEach((w, wi) => {
      out.push({
        text: w.text,
        accent: w.accent,
        line: li,
        word: w.word,
        letters: w.letters,
        spaceBefore: wi > 0 && w.word !== line.words[wi - 1].word,
        target: false,
        run: -1,
        from: 0,
        to: 1,
        offset: 0,
        runFirst: false,
        runLast: false,
      });
    });
    return out;
  });
  const all = grid.flat();
  if (mark === undefined) {
    for (const e of all) e.target = e.accent;
  } else {
    for (const item of Array.isArray(mark) ? mark : [mark]) {
      if (typeof item === 'number') {
        for (const e of all) if (e.word === item) e.target = true;
        continue;
      }
      const tokens = item.replace(/\*/g, '').split(/\s+/).map(norm).filter(Boolean);
      if (tokens.length === 0) continue;
      let found = false;
      for (const line of grid) {
        const content = line.filter((e) => norm(e.text) !== '');
        for (let i = 0; i + tokens.length <= content.length && !found; i++) {
          if (tokens.every((token, k) => norm(content[i + k].text) === token)) {
            for (let k = 0; k < tokens.length; k++) content[i + k].target = true;
            found = true;
          }
        }
        if (found) break;
      }
    }
  }
  if (fallback === 'last' && !all.some((e) => e.target)) {
    const content = all.filter((e) => norm(e.text) !== '');
    const last = content[content.length - 1];
    if (last) last.target = true;
  }
  // Runs: chosen entries side by side on one line.
  const runs: Run[] = [];
  grid.forEach((line, li) => {
    let current: Run | null = null;
    for (const e of line) {
      if (!e.target) {
        current = null;
        continue;
      }
      if (!current) {
        current = { id: runs.length, line: li, entries: [], chars: 0 };
        runs.push(current);
      }
      const gap = current.entries.length > 0 && e.spaceBefore ? 1 : 0;
      e.run = current.id;
      e.offset = current.chars + gap;
      current.chars += gap + e.letters.length;
      current.entries.push(e);
    }
  });
  for (const run of runs) {
    run.entries.forEach((e, i) => {
      e.from = e.offset / run.chars;
      e.to = (e.offset + e.letters.length) / run.chars;
      e.runFirst = i === 0;
      e.runLast = i === run.entries.length - 1;
    });
  }
  return { lines: grid, runs };
};

/** Where a move is drawing: type size, line colours, and measurements of the chosen words in pixels. */
export type Fx = {
  fontSize: number;
  /** The line's height in pixels. */
  lineHeight: number;
  lineColour: (line: number) => string;
  /** A word's width in pixels, in the voice it is set in. */
  widthOf: (entry: Entry) => number;
  /** A run's width in pixels, spaces included. */
  runWidth: (run: Run) => number;
  spaceWidth: number;
};

export const measure = (text: string, voice: Voice, size: number) => textWidth(text, voice, size);

/** What a move says about one word. */
export type WordLook = {
  style?: CSSProperties;
  /** Style of each letter, when the move works letter by letter (the letters then become inline blocks). */
  letter?: (char: string, index: number, count: number) => CSSProperties;
  /** Replaces the word's own text. */
  node?: ReactNode;
};

export type EmphasisTextProps = {
  lines: string[];
  size: number;
  align: 'left' | 'center' | 'right';
  colours?: LineColour[];
  style?: CSSProperties;
  mark: Mark | undefined;
  fallback?: 'last' | 'none';
  word?: (entry: Entry, fx: Fx) => WordLook | undefined;
  /** Drawn behind or over a run of chosen words, in a box exactly its size. */
  overlay?: (run: Run, fx: Fx) => ReactNode;
  /** Room, in em, the line opens on each side of a run of chosen words that has an overlay, so a mark has air. */
  pad?: number;
  /** The analysis, if the move needs it before drawing (to time its parts). */
  analysis?: Analysis;
};

/** Reads which words are chosen, for a move that needs the runs to time itself. */
export const useAnalysis = (lines: string[], mark: Mark | undefined, fallback: 'last' | 'none' = 'none') => analyse(lines, mark, fallback);

/**
 * The line, laid out by the shared splitter, with the chosen words handed to the move. Every word is an inline
 * block, so a move can move, scale, blur or recolour it alone; the layout is the same in every move.
 */
export const EmphasisText: FC<EmphasisTextProps> = ({ lines, size, align, colours, style, mark, fallback = 'none', word, overlay, pad = 0, analysis }) => {
  const brand = useBrand();
  const stage = useStage();
  const fontSize = useFitSize(lines, size);
  const data = analysis ?? analyse(lines, mark, fallback);
  const { accent, headline } = brand.fonts;
  const roles = colours ?? (['ink', 'second'] as LineColour[]);
  const lh = headline.lineHeight ?? 1.2;
  const widthOf = (e: Entry) => (e.accent ? measure(e.text, accent, fontSize * accent.scale) : measure(e.text, headline, fontSize));
  const spaceWidth = measure(' ', headline, fontSize);
  const fx: Fx = {
    fontSize,
    lineHeight: fontSize * lh,
    lineColour: (line) => stage[roles[Math.min(line, roles.length - 1)]],
    widthOf,
    runWidth: (run) => run.entries.reduce((total, e, i) => total + widthOf(e) + (i > 0 && e.spaceBefore ? spaceWidth : 0), 0),
    spaceWidth,
  };
  const accentStyle: CSSProperties = { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale) };
  const renderEntry = (e: Entry, key: string) => {
    const look = word?.(e, fx);
    const body: ReactNode = look?.node ?? (look?.letter ? e.letters.map((ch, i) => (
      <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', ...look.letter!(ch, i, e.letters.length) }}>
        {ch}
      </span>
    )) : e.text);
    return (
      <span key={key} style={{ display: 'inline-block', whiteSpace: 'pre', ...(e.accent ? accentStyle : null), ...look?.style }}>
        {body}
      </span>
    );
  };
  return (
    <SplitText
      lines={lines}
      size={size}
      align={align}
      colours={colours}
      by="line"
      style={style}
      piece={() => ({})}
      content={(p) => {
        const entries = data.lines[p.line] ?? [];
        const out: ReactNode[] = [];
        let i = 0;
        while (i < entries.length) {
          const e = entries[i];
          if (e.run >= 0 && overlay) {
            const run = data.runs[e.run];
            const members = entries.slice(i, i + run.entries.length);
            out.push(
              <Fragment key={i}>
                {e.spaceBefore ? ' ' : null}
                <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre', isolation: 'isolate', padding: pad ? `0 ${pad}em` : undefined }}>
                  {overlay(run, fx)}
                  {members.map((m, k) => (
                    <Fragment key={k}>
                      {k > 0 && m.spaceBefore ? ' ' : null}
                      {renderEntry(m, `${i}-${k}`)}
                    </Fragment>
                  ))}
                </span>
              </Fragment>,
            );
            i += run.entries.length;
          } else {
            out.push(
              <Fragment key={i}>
                {e.spaceBefore ? ' ' : null}
                {renderEntry(e, `${i}`)}
              </Fragment>,
            );
            i += 1;
          }
        }
        return out;
      }}
    />
  );
};

/** `color-mix` of two colours: `share` (0 to 1) of `a` in `b`. The studio's one way to derive a tone without a new hex. */
export const mixColour = (a: string, share: number, b: string) => `color-mix(in srgb, ${a} ${Math.round(clamp01(share) * 100)}%, ${b})`;

/** How many letters each cue of a letter-by-letter move takes, so long runs take longer than short ones. */
export const letterSpan = (chars: number, gap: number) => chars * gap;
