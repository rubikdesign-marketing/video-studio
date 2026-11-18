/** Where a piece of work stands: safely on disk, changed since, on its way, or not saved after a try. */
export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed';

export interface SaverOptions {
  /** Saves what is there now. */
  save(): Promise<void>;
  /** How long to wait after the last change before saving, in ms. */
  delayMs: number;
  onStatus(status: SaveStatus): void;
  /** Called when a save fails. Return how long to wait before trying again, or null to wait for the next change. */
  onError(error: unknown): number | null;
}

/** Saves a little after the last change, never two saves at once, and never loses a change made during a save. */
export function createSaver(options: SaverOptions) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  let running: Promise<void> | null = null;
  let busy = false;

  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void run(); }, ms);
  };
  const run = (): Promise<void> => {
    if (running) return running;
    if (timer) { clearTimeout(timer); timer = null; }
    if (!dirty) return Promise.resolve();
    dirty = false; busy = true;
    options.onStatus('saving');
    running = options.save().then(
      () => {
        running = null; busy = false;
        if (dirty) { options.onStatus('unsaved'); schedule(options.delayMs); } else options.onStatus('saved');
      },
      (error: unknown) => {
        running = null; busy = false; dirty = true;
        options.onStatus('failed');
        const retry = options.onError(error);
        if (retry !== null) schedule(retry);
      },
    );
    return running;
  };

  return {
    /** Something changed: save it soon. */
    touch() { dirty = true; if (!busy) options.onStatus('unsaved'); schedule(options.delayMs); },
    /** Save now, without waiting. Resolves when everything changed so far has been tried. */
    async flush() { if (running) await running; await run(); },
    /** Forget anything waiting to be saved (the server already has it, or it no longer applies). */
    settle() { dirty = false; if (timer) { clearTimeout(timer); timer = null; } options.onStatus('saved'); },
    /** True while there is anything the server does not have yet. */
    get dirty() { return dirty || busy; },
  };
}
