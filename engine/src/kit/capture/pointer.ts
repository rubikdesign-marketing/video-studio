// The engine's own pointer for a capture (CAPTURE-PLAN 7.1, craft file 05). It keeps every click, press and drag at
// its recorded time and place, and draws its own path between them: an arc, eased out of rest and into the target,
// 350 to 600 ms a move, arriving 125 ms before each click and staying still through it. It hides while typing,
// fades after 1.2 s of rest and comes back before its next move.
//
// Everything is on the recording's clock (the time map turns film time into it). Pure: no React, no Remotion.
import { arc, clamp01, easing, lerp, type Point } from '../motion';
import { pointerAt, type CaptureCursor, type CaptureEvent, type CursorShape } from './data';

export type Pace = 'calm' | 'confident' | 'hype';

/** Shortest and longest move, by pace: always inside the 350 to 600 ms of craft file 05. */
const MOVE_SECONDS: Record<Pace, [number, number]> = { calm: [0.42, 0.6], confident: [0.36, 0.55], hype: [0.35, 0.48] };
/** A move of this many page pixels or more takes the longest time. */
const LONG_MOVE = 1400;
/** The pointer is in place this long before a click (craft file 05: 100 to 150 ms). */
export const ARRIVE_BEFORE = 0.125;
/** It presses down over this long, ending as the button goes down, and comes back up over this long. */
const PRESS_DOWN = 0.1;
const PRESS_UP = 0.18;
/** After this long at rest it fades out; it fades back in before its next move. */
export const IDLE_SECONDS = 1.2;
const FADE_OUT = 0.3;
const FADE_IN = 0.2;
const HIDE_FOR_TYPING = 0.1;
/** A real pause longer than this before a click counts as a hover the viewer should see. */
const HOVER = 0.3;
/** The pointer counts as still while it creeps slower than this, in page pixels a second. */
const STILL_SPEED = 25;
/** How far a move bows sideways, as a share of its length. */
const BEND = 0.1;
/** Magnet: in the last share of a move the pointer is pulled onto its target. */
const MAGNET_SHARE = 0.22;

type Stop = {
  x: number;
  y: number;
  /** When the engine's pointer is in place, and the earliest it may leave (recording seconds). */
  arrive: number;
  leave: number;
  /** What happens here. */
  click?: CaptureEvent;
  drag?: CaptureEvent;
  /** When the real pointer got here. */
  real: number;
  shape: CursorShape;
};

type Move = {
  start: number;
  end: number;
  from: Point;
  to: Point;
  /** A drag follows its recorded route, so the dragged thing stays glued to the pointer. */
  route?: [number, number, number][];
  bend: number;
  magnet: boolean;
  shapeFrom: CursorShape;
  shapeTo: CursorShape;
};

type Span = { hide: number; hidden: number; show: number; shown: number };

export type PointerOptions = {
  pace?: Pace;
  repath?: boolean;
  magnet?: boolean;
  /**
   * The clip carries straight on from an earlier shot (a transition joins them): the pointer is shown at `from` and
   * rests from there as it would after an action, instead of starting hidden; rests before `from` do not count.
   */
  carried?: boolean;
};

export type PointerState = {
  x: number;
  y: number;
  /** 0 hidden to 1 shown. */
  opacity: number;
  /** 0 up to 1 fully pressed (the pointer scales to 90%). */
  press: number;
  shape: CursorShape;
  /** Page pixels per recording second. */
  vx: number;
  vy: number;
  moving: boolean;
};

/** One click as the checks see it: when the pointer arrived, and whether it was still from then to the button. */
export type ClickTiming = { t: number; up: number; x: number; y: number; arrive: number; lead: number; hover: boolean };

export type PointerPlan = {
  at: (r: number) => PointerState;
  moves: Move[];
  clicks: ClickTiming[];
  /** Recording intervals that are actions (a move into a click, the click, typing, a drag, a scroll): pins never retime inside them. */
  busy: [number, number][];
  /** Moves the recording left too little room for (shorter than 350 ms), for the checks. */
  rushed: { at: number; seconds: number }[];
};

/** The places the real pointer rested, in order: [from, to, x, y]. Rests a few pixels apart count as one. */
const restsOf = (cursor: CaptureCursor, end: number): [number, number, number, number][] => {
  const rows = cursor.path;
  if (!rows.length) return [[0, end, cursor.page.width / 2, cursor.page.height / 2]];
  const rests: [number, number, number, number][] = [];
  const push = (rest: [number, number, number, number]) => {
    const prev = rests[rests.length - 1];
    if (prev && Math.hypot(rest[2] - prev[2], rest[3] - prev[3]) < 6) {
      prev[1] = rest[1];
      prev[2] = rest[2];
      prev[3] = rest[3];
    } else rests.push(rest);
  };
  // Two neighbouring rows are still when the pointer crept slower than STILL_SPEED between them (the end of an eased
  // glide creeps in by fractions of a pixel). A rest is a run of still rows; it sits where the run ends.
  const still = (a: [number, number, number], b: [number, number, number]) => {
    const d = Math.hypot(b[1] - a[1], b[2] - a[2]);
    const dt = b[0] - a[0];
    return d < 0.6 || (dt > 0 && d / dt < STILL_SPEED);
  };
  let start = 0;
  let open = true; // the pointer rests at the first row from the start
  for (let k = 1; k < rows.length; k++) {
    const [a, b] = [rows[k - 1], rows[k]];
    if (still(a, b)) {
      if (!open) {
        open = true;
        start = a[0];
      }
      continue;
    }
    if (open && a[0] - start > 0.05) push([start, a[0], a[1], a[2]]);
    open = false;
  }
  const last = rows[rows.length - 1];
  push([open ? start : last[0], end, last[1], last[2]]);
  return rests;
};

const shapeAfterClick = (events: CaptureEvent[], click: CaptureEvent): CursorShape => {
  const next = events.find((e) => e.t > click.t && (e.type === 'click' || e.type === 'type' || e.type === 'paste' || e.type === 'drag'));
  return next && (next.type === 'type' || next.type === 'paste') && next.t - click.t < 1.5 ? 'text' : 'hand';
};

const moveSeconds = (pace: Pace, distance: number) => {
  const [least, most] = MOVE_SECONDS[pace];
  return lerp(least, most, clamp01(distance / LONG_MOVE));
};

/** Plans the pointer for a whole recording. `from` is where the clip starts: a pointer with nothing to do yet starts hidden. */
export const planPointer = (cursor: CaptureCursor, from: number, options: PointerOptions = {}): PointerPlan => {
  const pace = options.pace ?? 'confident';
  const repath = options.repath ?? true;
  const magnet = options.magnet ?? false;
  const end = cursor.seconds;
  const events = [...cursor.events].sort((a, b) => a.t - b.t);
  const clicks = events.filter((e) => e.type === 'click' && e.x !== undefined);
  const drags = events.filter((e) => e.type === 'drag' && e.path?.length);

  // Stops: every place the real pointer rested, with the click or drag that happened there.
  const stops: Stop[] = [];
  for (const [a, b, x, y] of restsOf(cursor, end)) {
    const click = clicks.find((c) => c.t >= a - 1e-3 && c.t <= b + 1e-3);
    const drag = drags.find((d) => d.t >= a - 1e-3 && d.t <= b + 1e-3);
    const action = click ?? drag;
    let arrive = a;
    if (action && action.t - a <= HOVER) arrive = action.t - ARRIVE_BEFORE;
    const shape: CursorShape = click ? shapeAfterClick(events, click) : drag ? 'hand' : 'arrow';
    // A click or a drag happens exactly where it was recorded.
    const place = click ? { x: click.x ?? x, y: click.y ?? y } : drag && Array.isArray(drag.from) ? { x: drag.from[0], y: drag.from[1] } : { x, y };
    stops.push({ ...place, arrive, leave: b, click, drag, real: a, shape });
  }

  // Moves between stops: the engine's arc into each stop, or the recorded route for a drag.
  const moves: Move[] = [];
  const rushed: { at: number; seconds: number }[] = [];
  let side = 1;
  for (let i = 1; i < stops.length; i++) {
    const [prev, next] = [stops[i - 1], stops[i]];
    const dragging = prev.drag && prev.drag.end !== undefined && prev.drag.end > prev.leave;
    if (dragging && prev.drag?.path) {
      const route = prev.drag.path;
      moves.push({ start: route[0][0], end: route[route.length - 1][0], from: prev, to: next, route, bend: 0, magnet: false, shapeFrom: 'hand', shapeTo: 'hand' });
      continue;
    }
    const distance = Math.hypot(next.x - prev.x, next.y - prev.y);
    const wanted = moveSeconds(pace, distance);
    // A plain rest (a hover) may be reached a little after the real pointer got there, to give the move its time.
    if (!next.click && !next.drag && next.arrive - prev.leave < wanted) next.arrive = Math.max(next.arrive, Math.min(prev.leave + wanted, next.leave - 0.1));
    const window = next.arrive - prev.leave;
    const seconds = Math.max(0.05, Math.min(wanted, window));
    if (seconds < MOVE_SECONDS.confident[0] - 0.01 && distance > 40) rushed.push({ at: next.arrive, seconds: window });
    // Bow the same way for left-to-right and right-to-left moves, so the pointer looks like one hand moving it.
    side = next.x >= prev.x ? -1 : 1;
    moves.push({
      start: next.arrive - seconds,
      end: next.arrive,
      from: prev,
      to: next,
      bend: BEND * side,
      magnet: magnet && Boolean(next.click || next.drag),
      shapeFrom: prev.shape,
      shapeTo: next.shape,
    });
  }

  // When the pointer is busy, so it can fade after 1.2 s of rest and while typing.
  const busyUntil: number[] = [];
  for (const m of moves) busyUntil.push(m.end);
  for (const c of clicks) busyUntil.push(c.up ?? c.t + 0.08);
  for (const d of drags) busyUntil.push(d.end ?? d.t);
  const nextMoveAfter = (t: number) => moves.find((m) => m.start >= t - 1e-6)?.start;
  const spans: Span[] = [];
  const hideUntilMove = (hide: number, fade: number, notBefore: number) => {
    const next = nextMoveAfter(hide);
    const shown = next ?? Infinity;
    const show = Math.max(notBefore, shown - FADE_IN);
    spans.push({ hide, hidden: hide + fade, show: Math.min(show, shown), shown });
  };
  for (const e of events) {
    if (e.type !== 'type' && e.type !== 'paste') continue;
    hideUntilMove(e.t, HIDE_FOR_TYPING, e.end ?? e.t);
  }
  // Rests: from the end of each busy moment to the next move; the clip's start counts as the end of a busy moment.
  const restStarts = [from, ...busyUntil.filter((b) => !options.carried || b > from)].sort((a, b) => a - b);
  for (const start of restStarts) {
    const next = nextMoveAfter(start);
    const laterBusy = busyUntil.some((b) => b > start + 1e-6 && (next === undefined || b < next));
    if (laterBusy) continue;
    const until = next ?? Infinity;
    if (until - start <= IDLE_SECONDS) continue;
    if (start === from && !options.carried) spans.push({ hide: -Infinity, hidden: -Infinity, show: until - FADE_IN, shown: until });
    else hideUntilMove(start + IDLE_SECONDS, FADE_OUT, start + IDLE_SECONDS);
  }

  const opacityAt = (r: number) => {
    let o = 1;
    for (const s of spans) {
      if (r < s.hide || r > s.shown) continue;
      const out = s.hidden <= s.hide ? 1 : easing.leave(clamp01((r - s.hide) / (s.hidden - s.hide)));
      const back = s.shown <= s.show ? (r >= s.shown ? 1 : 0) : easing.arrive(clamp01((r - s.show) / (s.shown - s.show)));
      o = Math.min(o, 1 - Math.min(out, 1 - back));
    }
    return o;
  };

  const pressAt = (r: number) => {
    let press = 0;
    for (const c of clicks) {
      const up = c.up ?? c.t + 0.08;
      if (r < c.t - PRESS_DOWN || r > up + PRESS_UP) continue;
      press = Math.max(press, easing.travel(clamp01((r - (c.t - PRESS_DOWN)) / PRESS_DOWN)) * (1 - easing.arrive(clamp01((r - up) / PRESS_UP))));
    }
    for (const d of drags) {
      const up = d.end ?? d.t;
      if (r < d.t - PRESS_DOWN || r > up + PRESS_UP) continue;
      press = Math.max(press, easing.travel(clamp01((r - (d.t - PRESS_DOWN)) / PRESS_DOWN)) * (1 - easing.arrive(clamp01((r - up) / PRESS_UP))));
    }
    return press;
  };

  const placeAt = (r: number): { p: Point; move: Move | null; u: number } => {
    if (!repath) return { p: pointerAt(cursor, r), move: null, u: 0 };
    for (const m of moves) {
      if (r < m.start || r > m.end) continue;
      if (m.route) {
        const rows = m.route;
        let i = 1;
        while (i < rows.length - 1 && rows[i][0] < r) i++;
        const [a, b] = [rows[i - 1], rows[i]];
        const u = clamp01((r - a[0]) / Math.max(1e-6, b[0] - a[0]));
        return { p: { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u) }, move: m, u: clamp01((r - m.start) / (m.end - m.start)) };
      }
      const u = clamp01((r - m.start) / Math.max(1e-6, m.end - m.start));
      let p = arc(m.from, m.to, easing.travel(u), m.bend);
      if (m.magnet) {
        // Pulled onto the target in the last frames: the approach quickens a little instead of creeping in.
        const pull = clamp01((u - (1 - MAGNET_SHARE)) / MAGNET_SHARE);
        const w = 0.55 * pull * pull * (3 - 2 * pull);
        p = { x: lerp(p.x, m.to.x, w), y: lerp(p.y, m.to.y, w) };
      }
      return { p, move: m, u };
    }
    // At rest: at the last stop reached.
    let at: Point = stops[0] ?? pointerAt(cursor, r);
    for (const s of stops) if (s.arrive <= r) at = s;
    return { p: { x: at.x, y: at.y }, move: null, u: 0 };
  };

  const shapeAt = (r: number, move: Move | null, u: number): CursorShape => {
    if (cursor.shapes?.length) {
      let shape: CursorShape = 'arrow';
      for (const [t, s] of cursor.shapes) if (t <= r) shape = s;
      return shape;
    }
    if (move) return move.route ? 'hand' : u < 0.25 ? move.shapeFrom : u > 0.7 ? move.shapeTo : 'arrow';
    let shape: CursorShape = 'arrow';
    for (const s of stops) if (s.arrive <= r) shape = s.shape;
    return shape;
  };

  const at = (r: number): PointerState => {
    const { p, move, u } = placeAt(r);
    const h = 1 / 240;
    const [a, b] = [placeAt(r - h).p, placeAt(r + h).p];
    const vx = (b.x - a.x) / (2 * h);
    const vy = (b.y - a.y) / (2 * h);
    return { x: p.x, y: p.y, opacity: opacityAt(r), press: pressAt(r), shape: shapeAt(r, move, u), vx, vy, moving: Math.hypot(vx, vy) > 5 };
  };

  const clickTimings: ClickTiming[] = clicks.map((c) => {
    const stop = stops.find((s) => s.click === c);
    const arrive = repath ? (stop?.arrive ?? c.t) : (stop?.real ?? c.t);
    return { t: c.t, up: c.up ?? c.t + 0.08, x: c.x ?? 0, y: c.y ?? 0, arrive, lead: c.t - arrive, hover: Boolean(stop && c.t - stop.real > HOVER) };
  });

  const busy: [number, number][] = [];
  for (const m of moves) {
    const stop = m.to as Stop;
    const actionEnd = stop.click ? (stop.click.up ?? stop.click.t) + 0.15 : stop.drag ? (stop.drag.end ?? stop.drag.t) + 0.15 : m.end;
    busy.push([m.start, Math.max(m.end, actionEnd)]);
  }
  for (const e of events) {
    if (e.type === 'type' || e.type === 'paste') busy.push([e.t - 0.05, (e.end ?? e.t) + 0.1]);
    if (e.type === 'scroll' || e.type === 'drag') busy.push([e.t - 0.05, (e.end ?? e.t) + 0.1]);
    if (e.type === 'press') busy.push([e.t - 0.05, e.t + 0.25]);
  }

  return { at, moves, clicks: clickTimings, busy, rushed };
};
