import { createStore } from 'zustand/vanilla';
import type { History, Shortcut } from '../contracts/store';
import { isMac, isTyping, matchKeys, type KeyPress } from './keys';

// ---------------------------------------------------------------- the one table
// Every shortcut the editor has: its keys, its wording and its group. What each one does is handed in by the part
// of the app that owns it, through the register functions below.

type Entry = Omit<Shortcut, 'run'>;
const entry = (id: string, keys: string, label: string, group: string): Entry => ({ id, keys, label, group });

export const GROUPS = ['Playback', 'Timeline', 'Notes', 'Editing', 'Panels', 'Help'] as const;

export const TABLE = {
  // Playback and timeline (Worker 2)
  playPause: entry('playback.toggle', 'Space', 'Play or pause', 'Playback'),
  frameBack: entry('playback.frame-back', 'ArrowLeft', 'Back one frame', 'Playback'),
  frameForward: entry('playback.frame-forward', 'ArrowRight', 'Forward one frame', 'Playback'),
  secondBack: entry('playback.second-back', 'Shift+ArrowLeft', 'Back one second', 'Playback'),
  secondForward: entry('playback.second-forward', 'Shift+ArrowRight', 'Forward one second', 'Playback'),
  previousScene: entry('playback.previous-scene', 'ArrowUp', 'Go to the scene before', 'Playback'),
  nextScene: entry('playback.next-scene', 'ArrowDown', 'Go to the next scene', 'Playback'),
  loopScene: entry('playback.loop-scene', 'L', 'Repeat this scene', 'Playback'),
  slower: entry('playback.slower', ',', 'Play slower', 'Playback'),
  faster: entry('playback.faster', '.', 'Play faster', 'Playback'),
  fitTimeline: entry('timeline.fit', 'Shift+Z', 'Fit the whole film in the timeline', 'Timeline'),
  zoomIn: entry('timeline.zoom-in', '=', 'Zoom in on the timeline', 'Timeline'),
  zoomOut: entry('timeline.zoom-out', '-', 'Zoom out of the timeline', 'Timeline'),
  // Notes, canvas and inspector (Worker 3)
  newNote: entry('notes.new', 'N', 'Write a note at this moment', 'Notes'),
  markGood: entry('notes.mark-good', 'G', 'Mark this scene as good', 'Notes'),
  removeSelected: entry('notes.remove', 'Backspace', 'Remove the selected note', 'Notes'),
  pointAtArea: entry('notes.point', 'B', 'Point at an area of the picture', 'Notes'),
  toggleSafeZones: entry('canvas.safe-zones', 'S', 'Show or hide the safe zones', 'Notes'),
  compareVersions: entry('canvas.compare', 'C', 'Compare two versions', 'Notes'),
  send: entry('notes.send', 'Mod+Enter', 'Send the notes', 'Notes'),
  // Panels and theme (Worker 1)
  toggleLeft: entry('panels.left', '[', 'Show or hide the left panel', 'Panels'),
  toggleRight: entry('panels.right', ']', 'Show or hide the right panel', 'Panels'),
  toggleTimeline: entry('panels.timeline', 'T', 'Show or hide the timeline', 'Panels'),
  toggleTheme: entry('panels.theme', 'Shift+D', 'Switch between night and paper', 'Panels'),
  // History and help (here)
  undo: entry('history.undo', 'Mod+Z', 'Undo', 'Editing'),
  redo: entry('history.redo', 'Shift+Mod+Z', 'Redo', 'Editing'),
  sheet: entry('help.shortcuts', '?', 'Show the keyboard shortcuts', 'Help'),
  menu: entry('help.commands', 'Mod+K', 'Find a command', 'Help'),
} as const satisfies Record<string, Entry>;

type Name = keyof typeof TABLE;
type Handlers<K extends Name> = Partial<Record<K, () => void>>;

// ---------------------------------------------------------------- what is registered right now

export interface ShortcutsState {
  /** Every registered shortcut, in table order. */
  shortcuts: Shortcut[];
  sheetOpen: boolean;
  menuOpen: boolean;
}
export const shortcutStore = createStore<ShortcutsState>(() => ({ shortcuts: [], sheetOpen: false, menuOpen: false }));

const ORDER = new Map<string, number>(Object.values(TABLE).map((e, i) => [e.id, i]));
const inOrder = (list: Shortcut[]) => [...list].sort((a, b) => (ORDER.get(a.id) ?? 999) - (ORDER.get(b.id) ?? 999));

/** Adds shortcuts (one with the same id replaces the old one). Returns the function that takes them out again. */
export function registerShortcuts(list: Shortcut[]): () => void {
  const ids = new Set(list.map((s) => s.id));
  shortcutStore.setState((s) => ({ shortcuts: inOrder([...s.shortcuts.filter((x) => !ids.has(x.id)), ...list]) }));
  return () => shortcutStore.setState((s) => ({ shortcuts: s.shortcuts.filter((x) => !list.includes(x)) }));
}
function bind<K extends Name>(handlers: Handlers<K>): () => void {
  const list: Shortcut[] = [];
  for (const name of Object.keys(handlers) as K[]) {
    const run = handlers[name];
    if (run) list.push({ ...TABLE[name], run });
  }
  return registerShortcuts(list);
}

/** Worker 2: playback and the timeline. Pass what each key should do; leave out what is not built yet. */
export const registerPlaybackShortcuts = (handlers: Handlers<'playPause' | 'frameBack' | 'frameForward' | 'secondBack' | 'secondForward' | 'previousScene' | 'nextScene' | 'loopScene' | 'slower' | 'faster' | 'fitTimeline' | 'zoomIn' | 'zoomOut'>) => bind(handlers);
/** Worker 3: notes, the canvas and sending. */
export const registerNoteShortcuts = (handlers: Handlers<'newNote' | 'markGood' | 'removeSelected' | 'pointAtArea' | 'toggleSafeZones' | 'compareVersions' | 'send'>) => bind(handlers);
/** Worker 1: panels and the theme. */
export const registerPanelShortcuts = (handlers: Handlers<'toggleLeft' | 'toggleRight' | 'toggleTimeline' | 'toggleTheme'>) => bind(handlers);

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** Undo and redo. Their labels say what would be undone: "Undo: change the words in scene 3". */
export function registerHistoryShortcuts(history: History): () => void {
  return registerShortcuts([
    { ...TABLE.undo, get label() { const l = history.labels.undo; return l ? `Undo: ${lowerFirst(l)}` : 'Undo'; }, run: () => history.undo() },
    { ...TABLE.redo, get label() { const l = history.labels.redo; return l ? `Redo: ${lowerFirst(l)}` : 'Redo'; }, run: () => history.redo() },
  ]);
}
/** The sheet on "?" and the command menu on Cmd+K. */
export function registerHelpShortcuts(): () => void {
  return bind<'sheet' | 'menu'>({ sheet: toggleSheet, menu: toggleMenu });
}
/** What the shell calls once: undo, redo, the sheet and the command menu. */
export function registerCoreShortcuts(history: History): () => void {
  const stops = [registerHistoryShortcuts(history), registerHelpShortcuts()];
  return () => stops.forEach((stop) => stop());
}

export const openSheet = () => shortcutStore.setState({ sheetOpen: true, menuOpen: false });
export const closeSheet = () => shortcutStore.setState({ sheetOpen: false });
export const toggleSheet = () => shortcutStore.setState((s) => ({ sheetOpen: !s.sheetOpen, menuOpen: false }));
export const openMenu = () => shortcutStore.setState({ menuOpen: true, sheetOpen: false });
export const closeMenu = () => shortcutStore.setState({ menuOpen: false });
export const toggleMenu = () => shortcutStore.setState((s) => ({ menuOpen: !s.menuOpen, sheetOpen: false }));

// ---------------------------------------------------------------- key handling

export interface KeyEvent extends KeyPress { target?: unknown; defaultPrevented?: boolean; preventDefault?(): void }

/**
 * Runs the shortcut for a key press, if there is one. Returns true when it did.
 * Keys typed into a field are left alone. While the sheet or the menu is open, only their own keys work.
 */
export function handleKey(e: KeyEvent, mac: boolean = isMac()): boolean {
  if (e.defaultPrevented) return false;
  const state = shortcutStore.getState();
  const dialogOpen = state.sheetOpen || state.menuOpen;
  if (dialogOpen && e.key === 'Escape') { e.preventDefault?.(); closeSheet(); closeMenu(); return true; }
  if (isTyping(e.target)) return false;
  const hit = state.shortcuts.find((s) => matchKeys(s.keys, e, mac));
  if (!hit || (dialogOpen && hit.id !== TABLE.sheet.id && hit.id !== TABLE.menu.id)) return false;
  e.preventDefault?.();
  hit.run();
  return true;
}

/** The shortcuts whose wording contains every word typed, for the command menu. */
export function filterShortcuts(shortcuts: Shortcut[], query: string): Shortcut[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return shortcuts.filter((s) => {
    const text = `${s.label} ${s.group}`.toLowerCase();
    return s.id !== TABLE.menu.id && words.every((w) => text.includes(w));
  });
}
/** The shortcuts by group, in the order the sheet shows them. */
export function groupShortcuts(shortcuts: Shortcut[]): { group: string; shortcuts: Shortcut[] }[] {
  const names = [...new Set([...GROUPS, ...shortcuts.map((s) => s.group)])];
  return names.map((group) => ({ group, shortcuts: shortcuts.filter((s) => s.group === group) })).filter((g) => g.shortcuts.length);
}
