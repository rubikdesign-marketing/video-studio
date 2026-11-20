import type { NoteKind } from '../contracts/review';
import { editor } from '../store';
import { showToast } from '../ui';
import { addNoteInOrder, playhead } from './actions';
import { useComposer } from './composer';

export interface Reaction { key: '1' | '2' | '3' | '4'; label: string; text: string; topic: string | null; kind: NoteKind }

/**
 * The four reactions most notes are, on keys 1 to 4: one press makes the note at the playhead (or over the marked
 * stretch), with no typing and no stopping to write (EDITOR-V2-PLAN.md, phase B2). Keep uses the existing keep kind,
 * so Claude leaves that moment alone.
 */
export const REACTIONS: Reaction[] = [
  { key: '1', label: 'Too fast', text: 'Too fast here. Give it more time to land.', topic: 'Pacing', kind: 'change' },
  { key: '2', label: 'Too slow', text: 'Too slow here. Tighten it.', topic: 'Pacing', kind: 'change' },
  { key: '3', label: 'Hard to read', text: 'Hard to read here: make it bigger, use fewer words, or keep it on screen longer.', topic: 'Words', kind: 'change' },
  { key: '4', label: 'Keep this', text: 'Keep this. It works.', topic: null, kind: 'keep' },
];

/** Adds a reaction as a note, without stopping the film: reacting should not interrupt the watch. Returns the note's id. */
export function react(reaction: Reaction): string {
  const c = useComposer.getState();
  const span = c.span;
  const time = span ? span.start : playhead();
  const id = addNoteInOrder(editor, { time, end: span?.end ?? null, text: reaction.text, kind: reaction.kind, topic: reaction.topic, must: false, box: null });
  if (span) c.set({ span: null });
  const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  showToast(`${reaction.label}: note added at ${clock(time)}${span ? ` to ${clock(span.end)}` : ''}. Cmd or Ctrl + Z takes it back.`, { tone: 'good' });
  return id;
}

/** Marks a stretch from the playhead (I) or to it (O), for the next note. The other end stays if it still makes sense. */
export function markSpan(edge: 'start' | 'end', duration: number): void {
  const t = playhead();
  const c = useComposer.getState();
  const old = c.span;
  const span = edge === 'start'
    ? { start: t, end: old && old.end > t + 0.15 ? old.end : Math.min(duration, t + 1) }
    : { start: old && old.start < t - 0.15 ? old.start : Math.max(0, t - 1), end: t };
  if (span.end - span.start < 0.15) return;
  c.set({ span });
}
