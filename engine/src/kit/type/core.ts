// What the text moves share besides the splitter: their common props, the exit, and the gap between pieces.
// Lengths come from the motion tokens and the energy preset; colours and type from the brand; nothing is named here.
import type { CSSProperties } from 'react';
import { easing, EXIT_SHARE, progress, timing, useMotion, type TimingToken } from '../motion';
import type { LineColour } from './split';

/** Props every text move takes. */
export type TextMoveProps = {
  /** One line, or several. Star a word (`*word*`) to set it in the accent voice. */
  lines: string | string[];
  /** Seconds on the scene clock when the move starts. */
  at: number;
  /** Seconds when it leaves. Optional. */
  out?: number;
  /** Type size, per cent of frame height. Shrunk to fit narrow frames. */
  size?: number;
  align?: 'left' | 'center' | 'right';
  /** Colour roles by line. Default: ink, then second. */
  colours?: LineColour[];
  style?: CSSProperties;
};

export const asLines = (lines: string | string[]) => (typeof lines === 'string' ? [lines] : lines);

/** Seconds between pieces arriving, by unit: letters 18 to 30 ms, words 40 to 50 ms, lines a quick length apart. */
export const pieceGap = (unit: 'line' | 'word' | 'letter', staggerMs: number) => {
  if (unit === 'letter') return Math.min(0.03, Math.max(0.018, staggerMs / 2000));
  if (unit === 'word') return Math.min(timing.tick * 0.5, Math.max(timing.tick * 0.4, staggerMs)) / 1000;
  return (timing.quick * 0.6) / 1000;
};

/**
 * The common clock of a text move. `start(rank)` is when a piece of that rank begins; `enter(rank, token)` its
 * progress in; `exit` the whole text's progress out (shorter than the entry, speeding up), 0 without `out`.
 */
export const useTextClock = (at: number, out: number | undefined, unit: 'line' | 'word' | 'letter', exitToken: TimingToken = 'base') => {
  const m = useMotion();
  const gap = pieceGap(unit, m.preset.staggerMs);
  const start = (rank: number) => at + rank * gap;
  const enter = (rank: number, token: TimingToken = 'base', ease = easing.arrive) => progress(m.t, start(rank), start(rank) + m.seconds(token), ease);
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds(exitToken) * EXIT_SHARE, easing.leave);
  return { m, t: m.t, gap, start, enter, exit };
};
