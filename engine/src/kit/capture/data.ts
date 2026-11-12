// What the capture tool (tools/capture/capture.mjs) hands the engine, and small readers for it. Pure functions of
// the recording's clock: no React, no Remotion, so the checks can run them outside a render.
//
// All places are page pixels in the recorded window (1920 x 1080 for a desktop take); all times are seconds on the
// recording's clock. The film's clock is a different one: see timemap.ts.
import { clamp01, lerp, type Point } from '../motion';

export type Rect = { x: number; y: number; width: number; height: number };

/** One thing that happened during the recording, at `t` seconds on the recording's clock. */
export type CaptureEvent = {
  t: number;
  type: string;
  step?: number;
  /** click: where, when the button came back up, which button and how many clicks. */
  x?: number;
  y?: number;
  up?: number;
  button?: string;
  count?: number;
  /** press: the key, and for a shortcut its keys ("Meta", "K"). */
  key?: string;
  shortcut?: boolean;
  keys?: number[] | string[];
  /** type: the words and when each key went down. type, drag, scroll and wait: when it ended. */
  text?: string;
  end?: number;
  /** drag: where it started and ended, and its route as [seconds, x, y] rows. */
  from?: number | [number, number];
  to?: number | [number, number];
  path?: [number, number, number][];
  /** wait: what was waited for, and whether the engine may play it faster. */
  what?: string;
  speed_up?: boolean;
  /** mark and track: the name. */
  name?: string;
  dy?: number;
};

/** A capture's cursor.json. */
export type CaptureCursor = {
  page: { width: number; height: number };
  scale: number;
  seconds: number;
  /** [seconds, x, y]. The pointer moves in a straight line between rows and stays put after the last one. */
  path: [number, number, number][];
  events: CaptureEvent[];
  /**
   * The pointer's shape over time, as [seconds, "arrow" | "hand" | "text"] rows, when the capture logs it. Without
   * it the engine works the shape out from the events (a click followed by typing is a field: a text bar; any
   * other click or a drag: a hand; otherwise an arrow).
   */
  shapes?: [number, CursorShape][];
};

export type CursorShape = 'arrow' | 'hand' | 'text';

/** One row of tracks.json: one frame of the recording. */
export type TrackRow = { t: number; scroll: [number, number]; page: [number, number]; at: Record<string, [number, number, number, number] | null> };

/** A capture's tracks.json: where each tracked thing was in every frame. */
export type CaptureTracks = { fps: number; seconds: number; things: Record<string, unknown>; frames: TrackRow[] };

// ---------------------------------------------------------------- the recorded pointer

/** Where the real pointer was at `t` seconds of the recording, in page pixels. */
export const pointerAt = (cursor: CaptureCursor, t: number): Point => {
  const { path } = cursor;
  if (!path.length) return { x: cursor.page.width / 2, y: cursor.page.height / 2 };
  if (t <= path[0][0]) return { x: path[0][1], y: path[0][2] };
  let lo = 0;
  let hi = path.length - 1;
  if (t >= path[hi][0]) return { x: path[hi][1], y: path[hi][2] };
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid][0] <= t) lo = mid;
    else hi = mid;
  }
  const [a, b] = [path[lo], path[hi]];
  const u = clamp01((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
  return { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u) };
};

/** When a named moment (a "mark" step) happened, in seconds of the recording. */
export const markAt = (cursor: CaptureCursor, name: string): number => {
  const mark = cursor.events.find((e) => e.type === 'mark' && e.name === name);
  if (!mark) throw new Error(`The capture has no mark called "${name}".`);
  return mark.t;
};

/** The clicks of a capture, in the order they happened. */
export const clicksOf = (cursor: CaptureCursor) => cursor.events.filter((e) => e.type === 'click' && e.x !== undefined && e.y !== undefined);

/**
 * A moment of the recording, named the way a person would: the nth click (1 is the first), a mark, the nth step of
 * the script, or a time in seconds.
 */
export type EventRef = { click: number } | { mark: string } | { step: number } | { t: number };

/** The event a reference means, or null for a plain time. */
export const eventOf = (cursor: CaptureCursor, ref: EventRef): CaptureEvent | null => {
  if ('t' in ref) return null;
  if ('click' in ref) {
    const click = clicksOf(cursor)[ref.click - 1];
    if (!click) throw new Error(`The capture has ${clicksOf(cursor).length} clicks, so there is no click ${ref.click}.`);
    return click;
  }
  if ('mark' in ref) {
    const mark = cursor.events.find((e) => e.type === 'mark' && e.name === ref.mark);
    if (!mark) throw new Error(`The capture has no mark called "${ref.mark}".`);
    return mark;
  }
  const step = cursor.events.find((e) => e.step === ref.step && e.type !== 'track' && e.type !== 'line');
  if (!step) throw new Error(`Nothing was logged for step ${ref.step} of the capture.`);
  return step;
};

/** The recording time a reference means. */
export const timeOf = (cursor: CaptureCursor, ref: EventRef): number => ('t' in ref ? ref.t : eventOf(cursor, ref)!.t);

// ---------------------------------------------------------------- tracked things

const rowAt = (tracks: CaptureTracks, t: number): TrackRow | null => {
  const rows = tracks.frames;
  if (!rows.length) return null;
  const i = Math.max(0, Math.min(rows.length - 1, Math.round(t * tracks.fps)));
  return rows[i];
};

const asRect = (box: [number, number, number, number] | null | undefined): Rect | null =>
  box ? { x: box[0], y: box[1], width: box[2], height: box[3] } : null;

/** Where a tracked thing was at `t` seconds of the recording, or null when it was not on the page. */
export const rectAt = (tracks: CaptureTracks | undefined, name: string, t: number): Rect | null => {
  if (!tracks) return null;
  return asRect(rowAt(tracks, t)?.at[name]);
};

/** The smallest tracked thing that held a point at `t`, with its name. Null when no tracked thing did. */
export const thingAt = (tracks: CaptureTracks | undefined, p: Point, t: number, slack = 6): { name: string; rect: Rect } | null => {
  if (!tracks) return null;
  const row = rowAt(tracks, t);
  if (!row) return null;
  let best: { name: string; rect: Rect } | null = null;
  for (const [name, box] of Object.entries(row.at)) {
    const rect = asRect(box);
    if (!rect) continue;
    const inside = p.x >= rect.x - slack && p.x <= rect.x + rect.width + slack && p.y >= rect.y - slack && p.y <= rect.y + rect.height + slack;
    if (inside && (!best || rect.width * rect.height < best.rect.width * best.rect.height)) best = { name, rect };
  }
  return best;
};

/** The box that holds both. */
export const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

/** A box grown by `by` page pixels on every side. */
export const grow = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, width: r.width + 2 * by, height: r.height + 2 * by });

/** A box of a given size around a point. */
export const boxAround = (p: Point, width: number, height: number): Rect => ({ x: p.x - width / 2, y: p.y - height / 2, width, height });

export const centreOfRect = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
