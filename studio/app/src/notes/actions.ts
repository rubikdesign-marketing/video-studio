import { captureAt, stageVideo } from '../canvas/video';
import type { Box, DraftNote, NoteKind } from '../contracts/review';
import { usePlayback } from '../playback';
import type { Editor } from '../store';

type Ed = Pick<Editor, 'stores' | 'history'>;

const clock = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
let made = 0;
const newId = () => `note-${Date.now().toString(36)}-${(++made).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Where the film is now: the video's own clock when there is one, else the playback store's. */
export function playhead(): number {
  const video = stageVideo();
  return video && video.readyState >= 1 ? video.currentTime : usePlayback.getState().time;
}

export interface NewNote { time: number; text: string; kind: NoteKind; topic: string | null; must: boolean; box: Box | null; end?: number | null }

/**
 * Adds a note and keeps the notes in film order, as the old review page does, so a sent batch reads from the
 * first second to the last. The store's own `addNote` puts a new note at the end, so this is its own undo step.
 * The time is kept to a thousandth of a second and the text loses its outer spaces, again as the old page does.
 */
export function addNoteInOrder(ed: Ed, note: NewNote): string {
  const before = ed.stores.notes.getState().notes;
  const added: DraftNote = {
    localId: newId(),
    time: Number(note.time.toFixed(3)),
    kind: note.kind,
    topic: note.topic,
    must: note.kind === 'keep' ? false : note.must,
    text: note.text.trim(),
    box: note.box,
    ...(note.end != null && note.end > note.time ? { end: Number(note.end.toFixed(3)) } : {}),
  };
  const after = [...before, added].sort((a, b) => a.time - b.time);
  ed.history.run({
    label: added.end ? `Add a note from ${clock(added.time)} to ${clock(added.end)}` : `Add a note at ${clock(added.time)}`,
    do: () => ed.stores.notes.setState({ notes: after }),
    undo: () => ed.stores.notes.setState({ notes: before }),
  });
  return added.localId;
}

export { captureAt };
