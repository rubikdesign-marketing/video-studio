import { create } from 'zustand';

/** The same key the old review page uses, so a name typed there is already here. */
export const REVIEWER_KEY = 'tulvo-reviewer';

function read(): string {
  try {
    return window.localStorage.getItem(REVIEWER_KEY) ?? '';
  } catch {
    return '';
  }
}

interface ReviewerState { name: string; setName(name: string): void }

/** Who the notes are from. Remembered in this browser. */
export const useReviewer = create<ReviewerState>((set) => ({
  name: read(),
  setName(name) {
    try {
      window.localStorage.setItem(REVIEWER_KEY, name.trim());
    } catch {
      // Storage is blocked. The name still holds for this visit.
    }
    set({ name });
  },
}));
