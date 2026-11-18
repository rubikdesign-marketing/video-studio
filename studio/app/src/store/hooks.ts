import { useMemo } from 'react';
import { useStore } from 'zustand';
import { api } from '../api';
import type { Film, TextCue } from '../contracts/film';
import type { Selection } from '../contracts/store';
import { applyEdits, editedCue } from './edits';
import { createEditor, type EditsState, type FilmState, type NotesState, type SavingState, type StorageLike } from './editor';
import type { HistoryState } from './history';

function browserStorage(): StorageLike | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/** The one editor of this page. Call `editor.open(job)` to load a film; every action is a method on it. */
export const editor = createEditor({ api, storage: browserStorage() });
/** The History contract: `history.run(command)`, `history.undo()`, `history.redo()`. */
export const history = editor.history;

// Each hook takes a selector. Select one value (a string, a number, an array as it is stored); a selector that
// builds a new object or array on every call makes the component render forever. Wrap those in `useShallow`.
export const useFilm = <T,>(select: (s: FilmState) => T): T => useStore(editor.stores.film, select);
export const useNotes = <T,>(select: (s: NotesState) => T): T => useStore(editor.stores.notes, select);
export const useEdits = <T,>(select: (s: EditsState) => T): T => useStore(editor.stores.edits, select);
export const useSaving = <T,>(select: (s: SavingState) => T): T => useStore(editor.stores.saving, select);
export const useHistory = <T,>(select: (s: HistoryState) => T): T => useStore(editor.stores.history, select);
export const useSelection = (): Selection => useStore(editor.stores.selection, (s) => s.selection);

/** The film with the pending text edits applied: what the timeline and the inspector should show. */
export function useEditedFilm(): Film | null {
  const film = useFilm((s) => s.film);
  const edits = useEdits((s) => s.edits);
  return useMemo(() => (film ? applyEdits(film, edits) : null), [film, edits]);
}
/** One on-screen text with the pending edits applied, and whether its words or timing differ from the film. */
export function useEditedCue(scene: string, cue: number): { cue: TextCue; words: boolean; time: boolean } | null {
  const film = useFilm((s) => s.film);
  const edits = useEdits((s) => s.edits);
  return useMemo(() => (film ? editedCue(film, edits, scene, cue) : null), [film, edits, scene, cue]);
}
/** One line for a status chip: "Saved", "Saving…", "Unsaved changes" or "Not saved". */
export function useSaveLabel(): { status: SavingState['notes']; label: string; message: string | null } {
  const notes = useSaving((s) => s.notes); const edits = useSaving((s) => s.edits); const message = useSaving((s) => s.message);
  const status = [notes, edits].includes('failed') ? 'failed' : [notes, edits].includes('saving') ? 'saving' : [notes, edits].includes('unsaved') ? 'unsaved' : 'saved';
  const label = { failed: 'Not saved', saving: 'Saving…', unsaved: 'Unsaved changes', saved: 'Saved' }[status];
  return { status, label, message };
}
