import type { Film, Scene, TextCue } from '../contracts/film';
import type { Edit } from '../contracts/review';

/** On-screen text may have at most this many words across its lines (the studio's seven-word rule). */
export const MAX_WORDS = 7;

/** Counts words the way the server does. Marks such as the stars around *a word* are not words on their own. */
export function countWords(lines: string[]): number {
  return lines.join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const seconds = (n: number) => `${Math.round(n * 100) / 100}s`;
export const sceneNumber = (film: Film | null, sceneId: string): string => {
  const i = film ? film.scenes.findIndex((s) => s.id === sceneId) : -1;
  return i >= 0 ? String(i + 1) : sceneId;
};

/** Checks one edit against the film. Returns null when it fits, or a plain sentence saying what is wrong. */
export function checkEdit(film: Film, edit: Edit): string | null {
  const scene = film.scenes.find((s) => s.id === edit.scene);
  if (!scene) return `Scene ${edit.scene} is not in this film.`;
  if (!Number.isInteger(edit.cue) || edit.cue < 0 || edit.cue >= scene.texts.length) return `Scene ${sceneNumber(film, scene.id)} has no on-screen text number ${edit.cue + 1}.`;
  if (edit.op === 'text.words') {
    const words = countWords(edit.lines);
    if (!edit.lines.length || !words) return 'On-screen text needs at least one word.';
    if (words > MAX_WORDS) return `On-screen text can have at most seven words. This has ${words}.`;
    return null;
  }
  const length = scene.end - scene.start;
  if (!Number.isFinite(edit.at) || !Number.isFinite(edit.out)) return 'The text needs a start and an end time.';
  if (edit.at < 0) return 'The text cannot start before its scene does.';
  if (edit.out <= edit.at) return 'The text has to end after it starts.';
  if (edit.out > length + 1e-6) return `The text cannot stay on past the end of its scene (${seconds(length)}).`;
  return null;
}

const sameSpot = (a: Edit, b: Edit) => a.op === b.op && a.scene === b.scene && a.cue === b.cue;
const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((l, i) => l === b[i]);

/** True when the edit would leave the cue exactly as the film already has it, so there is nothing to keep. */
export function changesNothing(film: Film, edit: Edit): boolean {
  const cue = film.scenes.find((s) => s.id === edit.scene)?.texts[edit.cue];
  if (!cue) return false;
  return edit.op === 'text.words' ? sameLines(cue.lines, edit.lines) : cue.at === edit.at && cue.out === edit.out;
}

/** The list with this edit in it: it replaces an earlier edit of the same thing, and the list keeps its order. */
export function putEdit(edits: Edit[], edit: Edit): Edit[] {
  const at = edits.findIndex((e) => sameSpot(e, edit));
  return at < 0 ? [...edits, edit] : edits.map((e, i) => (i === at ? edit : e));
}

/** The list without the edits of one cue. `what` narrows it to the words or the timing. */
export function dropEdits(edits: Edit[], scene: string, cue: number, what?: Edit['op']): Edit[] {
  return edits.filter((e) => !(e.scene === scene && e.cue === cue && (!what || e.op === what)));
}

/** The film as it will read once the edits are applied. The film passed in is never changed. */
export function applyEdits(film: Film, edits: Edit[]): Film {
  if (!edits.length) return film;
  const touched = new Set(edits.map((e) => e.scene));
  const scenes = film.scenes.map((scene): Scene => {
    if (!touched.has(scene.id)) return scene;
    const texts = scene.texts.map((cue, i): TextCue => {
      let next = cue;
      for (const e of edits) {
        if (e.scene !== scene.id || e.cue !== i || checkEdit(film, e) !== null) continue;
        next = e.op === 'text.words' ? { ...next, lines: [...e.lines] } : { ...next, at: e.at, out: e.out };
      }
      return next;
    });
    return { ...scene, texts };
  });
  return { ...film, scenes };
}

/** One cue as it reads with the edits applied, and whether its words or timing were changed. */
export function editedCue(film: Film, edits: Edit[], scene: string, cue: number): { cue: TextCue; words: boolean; time: boolean } | null {
  const original = film.scenes.find((s) => s.id === scene)?.texts[cue];
  if (!original) return null;
  const edited = applyEdits(film, edits.filter((e) => e.scene === scene && e.cue === cue)).scenes.find((s) => s.id === scene)?.texts[cue] ?? original;
  return { cue: edited, words: !sameLines(original.lines, edited.lines), time: original.at !== edited.at || original.out !== edited.out };
}
