import { useEffect } from 'react';
import { useStore } from 'zustand';
import { handleKey, shortcutStore, type ShortcutsState } from './table';

/** Listens for shortcut keys on the whole page. The shell calls it once. Keys typed into fields are ignored. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { handleKey(e); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Reads the shortcut table or whether the sheet and menu are open. Select one value at a time. */
export const useShortcutState = <T,>(select: (s: ShortcutsState) => T): T => useStore(shortcutStore, select);
