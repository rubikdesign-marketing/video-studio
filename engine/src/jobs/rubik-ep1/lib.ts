// Pure helpers for Episode 1 (no React, no Remotion), shared by Film.tsx, the sound plan
// (projects/rubik/video-1-edit/build/audio_events.mjs) and the checks. Tests: lib.test.ts.
export type Word = { w: string; t0: number; t1: number };
export type Cue = number | string;

const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9?.,!]/g, '');
const bare = (s: string) => lower(s).replace(/[?.,!]/g, '');

/** The word a cue names: the whole word first (punctuation compared only when the cue has some), then the first word
 *  starting with the cue, then the first word containing it. "call" no longer lands on "basically". */
export function findWord(words: Word[], cue: string): Word | undefined {
  const c = lower(cue); const cb = bare(cue); const punct = c !== cb;
  return words.find((x) => (punct ? lower(x.w) === c : bare(x.w) === cb))
    ?? words.find((x) => bare(x.w).startsWith(cb))
    ?? words.find((x) => bare(x.w).includes(cb));
}

/** A cue as seconds from the shot's start: a number as it is, a word at the moment it begins. */
export function cueTime(words: Word[], start: number, cue: Cue | undefined, dflt = 0): number {
  if (cue === undefined) return dflt;
  if (typeof cue === 'number') return cue;
  const w = findWord(words, cue);
  return w ? Math.max(0, w.t0 - start) : dflt;
}

/** A cue across a group of shots (a card that runs over several voice shots), as seconds from `first`. */
export function groupCueTime(shots: { start: number; words: Word[] }[], cue: Cue, first: number, dflt: number): number {
  if (typeof cue === 'number') return cue;
  const w = findWord(shots.flatMap((s) => s.words), cue);
  return w ? w.t0 - first : dflt;
}
