import { create } from 'zustand';
import type { Box, NoteKind } from '../contracts/review';

/** The note being written, before it is added. */
export interface ComposerState {
  kind: NoteKind;
  text: string;
  topic: string | null;
  must: boolean;
  box: Box | null;
  /** True while an area is being drawn on the film. */
  marking: boolean;
  /** Goes up by one each time the note field should take the cursor (the `N` key). */
  focusAsk: number;
  /** A stretch of time for the next note, marked with I and O or by dragging in the Notes lane. Null for one moment. */
  span: { start: number; end: number } | null;
  set(change: Partial<Pick<ComposerState, 'kind' | 'text' | 'topic' | 'must' | 'box' | 'marking' | 'span'>>): void;
  askFocus(): void;
  /** Each note starts clean. The kind stays, as on the old page. */
  clear(): void;
}

export const useComposer = create<ComposerState>((set, get) => ({
  kind: 'change',
  text: '',
  topic: null,
  must: false,
  box: null,
  marking: false,
  focusAsk: 0,
  span: null,
  set: (change) => set(change.kind === 'keep' ? { ...change, must: false } : change),
  askFocus: () => set({ focusAsk: get().focusAsk + 1 }),
  clear: () => set({ text: '', topic: null, must: false, box: null, marking: false, span: null }),
}));
