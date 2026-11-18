import type { EventsStatus, StudioEvent } from './types';

/** The part of the browser's EventSource this file uses, so a test can stand in for it. */
export interface EventSourceLike {
  onopen: ((e: unknown) => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  close(): void;
}

export interface EventsOptions {
  onEvent(event: StudioEvent): void;
  /** Called when the connection opens, drops and comes back. */
  onStatus?(status: EventsStatus): void;
  /** First wait before trying again, in ms. It doubles each time up to `maxRetryMs`, and resets once connected. */
  retryMs?: number;
  maxRetryMs?: number;
  /** For tests. The browser's own EventSource by default. */
  open?(url: string): EventSourceLike;
}

const KNOWN = new Set(['render', 'rendering', 'version', 'batch']);

/**
 * Listens to the studio's live events and keeps listening: when the connection drops (the server restarted, the
 * laptop slept) it tries again, waiting a little longer each time. Returns the function that stops it.
 */
export function subscribeEvents(url: string, options: EventsOptions): () => void {
  const { onEvent, onStatus, retryMs = 1000, maxRetryMs = 15000 } = options;
  const open = options.open ?? ((u: string) => new EventSource(u) as unknown as EventSourceLike);
  let source: EventSourceLike | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wait = retryMs;
  let stopped = false;

  const connect = () => {
    timer = null;
    if (stopped) return;
    let current: EventSourceLike;
    try { current = open(url); } catch { again(); return; }
    source = current;
    current.onopen = () => { wait = retryMs; onStatus?.('live'); };
    current.onmessage = (e) => {
      let event: unknown;
      try { event = JSON.parse(e.data); } catch { return; }
      if (event && typeof event === 'object' && KNOWN.has((event as { type?: string }).type ?? '')) onEvent(event as StudioEvent);
    };
    current.onerror = () => { if (source === current) { current.close(); source = null; again(); } };
  };
  const again = () => {
    if (stopped || timer) return;
    onStatus?.('reconnecting');
    timer = setTimeout(connect, wait);
    wait = Math.min(wait * 2, maxRetryMs);
  };

  onStatus?.('connecting');
  connect();
  return () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    source?.close();
    source = null;
    onStatus?.('closed');
  };
}
