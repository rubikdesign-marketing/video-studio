import { create } from 'zustand';
import type { Platform } from './safe-zones';

export type CompareMode = 'side' | 'wipe';

export interface CanvasState {
  /** Show the film at the width of a phone. */
  phone: boolean;
  titleSafe: boolean;
  thirds: boolean;
  /** The app whose safe zone is shown, or null for none. */
  zone: Platform | null;
  /** The app shown last, so the shortcut brings the same one back. */
  lastZone: Platform;
  compare: boolean;
  compareMode: CompareMode;
  /** The version shown next to the one being watched. */
  compareWith: string | null;
  /** Where the wipe line sits, as a share of the width. */
  wipe: number;
  set(change: Partial<Omit<CanvasState, 'set' | 'toggleZones'>>): void;
  /** Shows or hides the safe zone (the `S` key). */
  toggleZones(): void;
}

export const useCanvas = create<CanvasState>((set, get) => ({
  phone: false,
  titleSafe: false,
  thirds: false,
  zone: null,
  lastZone: 'reels',
  compare: false,
  compareMode: 'side',
  compareWith: null,
  wipe: 0.5,
  set: (change) => set({ ...change, ...(change.zone ? { lastZone: change.zone } : {}) }),
  toggleZones: () => set({ zone: get().zone ? null : get().lastZone }),
}));
