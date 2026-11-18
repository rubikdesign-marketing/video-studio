import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Command, History } from '../contracts/store';

/** The History contract, plus two things the editor needs around it. */
export interface HistoryState extends History {
  /**
   * Like `run`, but a change with the same `key` made straight after the last one joins it, so typing a sentence
   * or dragging an edge is one step to undo, not fifty. Use a key such as `words:S03:0`.
   */
  runMerged(key: string, c: Command): void;
  /** Forgets every step. Used when the film is reloaded or the notes are sent. */
  clear(): void;
}

interface Entry { command: Command; key: string | null; at: number }

export interface HistoryOptions {
  /** How many steps are kept. */
  limit?: number;
  /** How long after a change a merged change may still join it, in ms. */
  mergeWindowMs?: number;
  now?: () => number;
}

export function createHistory(options: HistoryOptions = {}): StoreApi<HistoryState> {
  const { limit = 200, mergeWindowMs = 1000, now = () => Date.now() } = options;
  const done: Entry[] = [];
  const undone: Command[] = [];
  let busy = false;                              // a command may not start another step from inside its own do or undo

  const store = createStore<HistoryState>(() => ({
    canUndo: false, canRedo: false, labels: {},
    run: (c) => push(c, null),
    runMerged: (key, c) => push(c, key),
    undo() {
      const entry = done.at(-1);
      if (!entry || busy) return;
      guarded(() => entry.command.undo());
      done.pop(); undone.push(entry.command); publish();
    },
    redo() {
      const command = undone.at(-1);
      if (!command || busy) return;
      guarded(() => command.do());
      undone.pop(); done.push({ command, key: null, at: 0 }); publish();
    },
    clear() { done.length = 0; undone.length = 0; publish(); },
  }));

  function guarded(work: () => void) { busy = true; try { work(); } finally { busy = false; } }
  function publish() {
    const labels: History['labels'] = {};
    const last = done.at(-1); const next = undone.at(-1);
    if (last) labels.undo = last.command.label;
    if (next) labels.redo = next.label;
    store.setState({ canUndo: done.length > 0, canRedo: undone.length > 0, labels });
  }
  function push(c: Command, key: string | null) {
    if (busy) return;
    guarded(() => c.do());
    const last = done.at(-1); const at = now();
    if (key !== null && last && last.key === key && undone.length === 0 && at - last.at <= mergeWindowMs) {
      const first = last.command;                // keep the oldest undo, take the newest do
      last.command = { label: c.label, do: () => c.do(), undo: () => first.undo() };
      last.at = at;
    } else {
      done.push({ command: c, key, at });
      if (done.length > limit) done.shift();
    }
    undone.length = 0;
    publish();
  }
  return store;
}

/**
 * The History contract as one lasting object that always reads the latest state. Hand this to code that keeps hold
 * of a History (the shortcuts do); a `getState()` snapshot would go on showing the labels from when it was taken.
 */
export function liveHistory(store: StoreApi<HistoryState>): History {
  return {
    run: (c) => store.getState().run(c),
    undo: () => store.getState().undo(),
    redo: () => store.getState().redo(),
    get canUndo() { return store.getState().canUndo; },
    get canRedo() { return store.getState().canRedo; },
    get labels() { return store.getState().labels; },
  };
}
