// The time map: which moment of the recording each moment of the film shows. Speed ramps, freezes, jumps, rewinds
// and pinned events all live here, so the picture, the drawn pointer, the tracked things and the camera all read
// the same clock and can never drift apart.
//
// Film time is seconds on the clip's own clock (0 where the clip starts). Recording time is seconds on the
// capture's clock. Pure functions: no React and no Remotion.
import { clamp01, easing } from '../motion';
import { eventOf, timeOf, type CaptureCursor, type CaptureEvent, type EventRef } from './data';

/** Play a stretch of the recording faster, easing into and out of the faster speed. Times are recording seconds. */
export type Ramp = { from: number; to: number; speed?: number; label?: boolean };
/** Leave out a dead stretch with a clean cut. */
export type Jump = { from: number; to: number };
/** Hold one moment of the recording for `hold` film seconds, with a slow push in unless `push` is false. */
export type Freeze = { at: number; hold: number; push?: boolean };
/** After `at`, run the recording backwards by `back` seconds, then play on from there ("replay") or cut back to `at` ("resume"). */
export type Rewind = { at: number; back: number; speed?: number; then?: 'replay' | 'resume' };
/** Land an event (a click, a mark, a step, a time) on a film time. The stretches between actions are retimed; actions never are. */
export type Pin = { event: EventRef; at: number };

export type TimeSpec = {
  ramps?: Ramp[];
  jumps?: Jump[];
  freezes?: Freeze[];
  rewinds?: Rewind[];
  pins?: Pin[];
  /** Speed up, with the label, every real wait the capture marked (over 0.6 s), and typing longer than `typing` seconds. */
  speedUp?: { waits?: boolean; typing?: number | false };
  /**
   * Hide the product loading (default true). The clip starts just before the first page load ends (see
   * openingStart), and every page load after a step that took longer than 0.6 s plays faster so it lasts 0.6 s, from
   * the end of the step to the settled moment, with the label (see loadSpan). False plays loads like any other wait.
   */
  trimLoads?: boolean;
  /** End where the clip began, so it can play in a loop. */
  loop?: boolean;
};

type Kind = 'play' | 'freeze' | 'rewind';
export type Segment = {
  kind: Kind;
  /** Film seconds. */
  f0: number;
  f1: number;
  /** Recording seconds at its two ends. */
  r0: number;
  r1: number;
  /** For "play": the speed it eases to (1 is real time) and how long the easing takes at each end, in film seconds. */
  speed: number;
  ease: number;
  /** Show the "Sped up" label while it runs fast. */
  label: boolean;
  /** For "freeze": push in slowly while it holds. */
  push: boolean;
  /** A stretch between actions that pins may stretch or squeeze. */
  flex: boolean;
};

/** Longest ease into or out of a ramp's speed, in film seconds. */
const RAMP_EASE = 0.35;
/** A pinned stretch may play this many times faster at most, or this many times slower. */
const MOST_SQUEEZE = 8;
const MOST_STRETCH = 4;
/** The speed a sped-up wait aims for, and the film length it aims to leave (craft file 05: at most 0.6 s of honest wait). */
const WAIT_SPEED = { least: 2, most: 8, keep: 0.6 };
const TYPING_SPEED = 2.5;

// ---------------------------------------------------------------- loads

/** The waits the capture tool logs for the page loading: a new page getting ready, a "wait for settled" step, and the settle check after a step. */
const LOAD = /^the page (loading|to settle|settling)$/;
/** The capture tool's pause between a step and its settle check (GAP in tools/capture/capture.mjs): the load starts at the step's end. */
const STEP_GAP = 0.25;
/** The film starts this long before the first load ends. */
const LEAD_IN = 0.2;
/**
 * A sped-up load runs on to the next action when that comes this soon after the settled moment: what lies between
 * is the capture's own checking (a mark's still, a second settle check), and the recording can show the old picture
 * a little past the moment the capture judged the page settled.
 */
const RUN_ON = 0.5;
/** Events that are the capture's bookkeeping, not something happening on screen. */
const PASSIVE = new Set(['wait', 'mark', 'track', 'line', 'mask', 'dismissed', 'tab-opened']);

/** When something next happens after recording time `t`: an action, or the recorded pointer starting to move. */
const nextAction = (cursor: CaptureCursor, t: number) => {
  let next = Infinity;
  for (const e of cursor.events) if (!PASSIVE.has(e.type) && e.t > t + 1e-6) next = Math.min(next, e.t);
  const path = cursor.path;
  for (let i = 1; i < path.length; i++) {
    if (path[i][0] <= t) continue;
    if (path[i][1] !== path[i - 1][1] || path[i][2] !== path[i - 1][2]) {
      next = Math.min(next, Math.max(t, path[i - 1][0]));
      break;
    }
  }
  return next;
};

const isLoad = (e: CaptureEvent) => e.type === 'wait' && Boolean(e.speed_up) && e.end !== undefined && LOAD.test(e.what ?? '');

/**
 * The stretch of the recording a load covers: from the end of the step that started it (the capture checks the
 * page a short pause after the step) to the settled moment, run on to the next action when that is close.
 */
export const loadSpan = (cursor: CaptureCursor, e: CaptureEvent): [number, number] => {
  let a = e.t;
  if (e.what === 'the page settling') {
    const ends = cursor.events
      .filter((x) => x !== e && x.step === e.step && !PASSIVE.has(x.type) && x.t <= e.t)
      .map((x) => Math.max(x.t, x.up ?? x.t, typeof x.end === 'number' ? x.end : x.t));
    a = Math.min(e.t, Math.max(e.t - STEP_GAP, ...ends));
  }
  let b = e.end ?? e.t;
  const next = nextAction(cursor, b);
  if (next - b <= RUN_ON) b = next;
  return [a, b];
};

/**
 * Where a clip that was asked to play from the recording's start really starts, so the film never opens on a blank
 * or loading page: a moment before the first page load ends, or at the first mark, whichever is earlier, and never
 * past the first action. A clip given its own start, `trimLoads: false`, or a hand-set time effect before that
 * moment keeps the start it was given.
 */
export const openingStart = (cursor: CaptureCursor, from: number, to: number, spec: TimeSpec = {}): number => {
  if (from > 1e-6 || spec.trimLoads === false) return from;
  const first = nextAction(cursor, -1);
  const candidates: number[] = [];
  const load = cursor.events.find((e) => isLoad(e) && e.t < first);
  if (load) candidates.push((load.end as number) - LEAD_IN);
  const mark = cursor.events.find((e) => e.type === 'mark');
  if (mark && mark.t <= first) candidates.push(mark.t);
  if (!candidates.length) return from;
  const start = Math.max(from, Math.min(first, ...candidates));
  if (!(to > start + 0.5)) return from;
  const handSet = [
    ...(spec.ramps ?? []).map((r) => r.from),
    ...(spec.jumps ?? []).map((j) => j.from),
    ...(spec.freezes ?? []).map((z) => z.at),
    ...(spec.rewinds ?? []).map((w) => w.at - w.back),
    ...(spec.pins ?? []).map((p) => timeOf(cursor, p.event)),
  ];
  if (handSet.some((t) => t < start - 1e-6)) return from;
  return start;
};

// ---------------------------------------------------------------- one segment

/** How much of the speed-up has built up `x` film seconds into an eased stretch, integrated: see recAt. */
const builtUp = (x: number, length: number, ease: number) => {
  if (ease <= 0) return x;
  if (x <= ease) return x / 2 - (ease / (2 * Math.PI)) * Math.sin((Math.PI * x) / ease);
  if (x <= length - ease) return ease / 2 + (x - ease);
  const y = x - (length - ease);
  return ease / 2 + (length - 2 * ease) + y / 2 + (ease / (2 * Math.PI)) * Math.sin((Math.PI * y) / ease);
};

/** Recording time inside a segment. */
const recIn = (s: Segment, f: number) => {
  const x = Math.max(0, Math.min(s.f1 - s.f0, f - s.f0));
  const length = s.f1 - s.f0;
  if (s.kind === 'freeze' || length <= 0) return s.r0;
  if (s.kind === 'rewind') return s.r0 + (s.r1 - s.r0) * easing.travel(x / length);
  // Speed is 1 at both ends and `speed` in the middle, with cosine easing between: rate = 1 + (speed - 1) * s(x).
  if (s.ease <= 0) return s.r0 + ((s.r1 - s.r0) * x) / length;
  return s.r0 + x + (s.speed - 1) * builtUp(x, length, s.ease);
};

/** Speed (recording seconds per film second) inside a segment. */
const rateIn = (s: Segment, f: number) => {
  const length = s.f1 - s.f0;
  const x = Math.max(0, Math.min(length, f - s.f0));
  if (s.kind === 'freeze' || length <= 0) return 0;
  if (s.kind === 'rewind') {
    const h = 1e-3;
    return (recIn(s, f + h) - recIn(s, f - h)) / (2 * h);
  }
  if (s.ease <= 0) return (s.r1 - s.r0) / length;
  let built = 1;
  if (x < s.ease) built = (1 - Math.cos((Math.PI * x) / s.ease)) / 2;
  else if (x > length - s.ease) built = (1 + Math.cos((Math.PI * (x - (length - s.ease))) / s.ease)) / 2;
  return 1 + (s.speed - 1) * built;
};

/** A stretch of `rec` recording seconds played over `film` seconds, starting and ending at real speed. */
const fitted = (r0: number, rec: number, film: number, ease = RAMP_EASE): Pick<Segment, 'speed' | 'ease' | 'r0' | 'r1'> => {
  if (Math.abs(rec - film) < 1e-6) return { r0, r1: r0 + rec, speed: 1, ease: 0 };
  const e = Math.min(ease, film / 3, rec / 3);
  return { r0, r1: r0 + rec, speed: (rec - e) / (film - e), ease: e };
};

/** A ramp at a given speed: the film length it takes. */
const rampLength = (rec: number, speed: number) => {
  const e = Math.min(RAMP_EASE, rec / (speed + 1));
  return { film: (rec + (speed - 1) * e) / speed, ease: e };
};

const play = (r0: number, r1: number, flex: boolean): Segment => ({ kind: 'play', f0: 0, f1: r1 - r0, r0, r1, speed: 1, ease: 0, label: false, push: false, flex });

// ---------------------------------------------------------------- the map

export type TimeMap = {
  /** Film length in seconds. */
  duration: number;
  segments: Segment[];
  /** Film times of planned instant changes (jumps, the cut back after a rewind). */
  cuts: number[];
  loop: boolean;
  /** The recording time shown at film time `f`. */
  recAt: (f: number) => number;
  /** Recording seconds per film second at `f`: 1 is real time, 0 a freeze, below 0 a rewind. */
  rateAt: (f: number) => number;
  /** The first film time that shows recording time `r` while playing forward. */
  filmAt: (r: number) => number;
  /** Every film time that shows recording time `r` while playing forward (more than one after a rewind). */
  filmTimesOf: (r: number) => number[];
  /** 0 to 1: how much the "Sped up" label shows at `f`. */
  spedUpAt: (f: number) => number;
  /** 0 to 1: how far the slow push of a freeze has gone at `f` (it eases back after the freeze). */
  freezePushAt: (f: number, release: number) => number;
};

const lay = (segments: Segment[]) => {
  let f = 0;
  for (const s of segments) {
    const length = s.f1 - s.f0;
    s.f0 = f;
    s.f1 = f + length;
    f = s.f1;
  }
};

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] - 1e-6 && b[0] < a[1] - 1e-6;
const fmt = (s: number) => `${Math.round(s * 100) / 100} s`;

/**
 * Builds the map for the stretch [from, to] of a recording. `busy` lists the recording intervals that are actions
 * (a pointer move with its click, typing, a drag, a scroll): pins never retime inside them.
 */
export const buildTimeMap = (cursor: CaptureCursor, from: number, to: number, spec: TimeSpec = {}, busy: [number, number][] = []): TimeMap => {
  if (!(to > from)) throw new Error(`The clip plays nothing: "to" (${fmt(to)}) must be after "from" (${fmt(from)}).`);
  const inside = (a: number, b: number) => a >= from - 1e-6 && b <= to + 1e-6;

  // Everything that changes the speed, in recording order.
  type Op =
    | { kind: 'ramp'; a: number; b: number; speed: number; label: boolean; auto: boolean; film?: number }
    | { kind: 'jump'; a: number; b: number }
    | { kind: 'freeze'; a: number; b: number; hold: number; push: boolean }
    | { kind: 'rewind'; a: number; b: number; back: number; speed: number; then: 'replay' | 'resume' };
  const ops: Op[] = [];
  for (const r of spec.ramps ?? []) ops.push({ kind: 'ramp', a: r.from, b: r.to, speed: r.speed ?? 3, label: r.label ?? true, auto: false });
  for (const j of spec.jumps ?? []) ops.push({ kind: 'jump', a: j.from, b: j.to });
  for (const z of spec.freezes ?? []) ops.push({ kind: 'freeze', a: z.at, b: z.at, hold: z.hold, push: z.push ?? true });
  for (const w of spec.rewinds ?? []) ops.push({ kind: 'rewind', a: w.at, b: w.at, back: w.back, speed: w.speed ?? 2, then: w.then ?? 'replay' });
  for (const op of ops) {
    if (op.b < op.a) throw new Error(`A time effect runs backwards (${fmt(op.a)} to ${fmt(op.b)}): give "from" before "to".`);
    if (!inside(op.a, op.b)) throw new Error(`A time effect at ${fmt(op.a)} is outside the part of the recording the clip plays (${fmt(from)} to ${fmt(to)}).`);
    if (op.kind === 'ramp' && !(op.speed > 1)) throw new Error(`A speed ramp needs a speed above 1 (it was ${op.speed}).`);
    if (op.kind === 'rewind' && op.back > op.a - from) throw new Error(`A rewind of ${fmt(op.back)} at ${fmt(op.a)} would go back before the clip starts.`);
  }

  // Automatic ramps over long real waits and long typing, where nothing set by hand is already happening. A page
  // load is fitted to 0.6 s of film, from the end of its step to the settled moment; if that clashes with something
  // set by hand, it falls back to the plain wait.
  const auto: Op[] = [];
  const waits = spec.speedUp?.waits ?? false;
  const typing = spec.speedUp?.typing ?? false;
  const loads = spec.trimLoads ?? true;
  const clashes = (span: [number, number]) =>
    [...ops, ...auto].some((op) => overlaps([op.a, Math.max(op.b, op.a + 1e-3)], span) || (op.a === op.b && op.a > span[0] && op.a < span[1]));
  for (const e of cursor.events) {
    if (e.end === undefined) continue;
    if (loads && waits && isLoad(e) && e.end - e.t > WAIT_SPEED.keep) {
      const [a, b] = loadSpan(cursor, e);
      const span: [number, number] = [Math.max(from, a), Math.min(to, b)];
      if (span[1] - span[0] > WAIT_SPEED.keep && !clashes(span)) {
        auto.push({ kind: 'ramp', a: span[0], b: span[1], speed: 0, label: true, auto: true, film: WAIT_SPEED.keep });
        continue;
      }
    }
    const span: [number, number] = [Math.max(from, e.t), Math.min(to, e.end)];
    const length = span[1] - span[0];
    let speed = 0;
    if (waits && e.type === 'wait' && e.speed_up && length > WAIT_SPEED.keep) speed = Math.min(WAIT_SPEED.most, Math.max(WAIT_SPEED.least, length / WAIT_SPEED.keep));
    if (typing !== false && e.type === 'type' && length > typing) speed = TYPING_SPEED;
    if (!speed) continue;
    if (!clashes(span)) auto.push({ kind: 'ramp', a: span[0], b: span[1], speed, label: true, auto: true });
  }
  const all = [...ops, ...auto].sort((p, q) => p.a - q.a);
  for (let i = 1; i < all.length; i++) {
    const [p, q] = [all[i - 1], all[i]];
    if (q.a < p.b - 1e-6) throw new Error(`Two time effects overlap, at ${fmt(p.a)} and ${fmt(q.a)} of the recording. Move one of them.`);
  }

  // Lay the segments in film order.
  const segments: Segment[] = [];
  const cutsAtRec: { after: number }[] = [];
  let r = from;
  const playTo = (b: number) => {
    if (b > r + 1e-6) segments.push(play(r, b, true));
    r = Math.max(r, b);
  };
  for (const op of all) {
    playTo(op.a);
    if (op.kind === 'ramp' && op.film !== undefined) {
      // Fitted to a film length: a page load that lasts exactly that long.
      const fit = fitted(op.a, op.b - op.a, op.film, RAMP_EASE);
      segments.push({ kind: 'play', f0: 0, f1: op.film, ...fit, label: op.label, push: false, flex: false });
      r = op.b;
    } else if (op.kind === 'ramp') {
      const { film, ease } = rampLength(op.b - op.a, op.speed);
      segments.push({ kind: 'play', f0: 0, f1: film, r0: op.a, r1: op.b, speed: op.speed, ease, label: op.label, push: false, flex: false });
      r = op.b;
    } else if (op.kind === 'jump') {
      cutsAtRec.push({ after: segments.length });
      r = op.b;
    } else if (op.kind === 'freeze') {
      segments.push({ kind: 'freeze', f0: 0, f1: op.hold, r0: op.a, r1: op.a, speed: 0, ease: 0, label: false, push: op.push, flex: false });
    } else {
      segments.push({ kind: 'rewind', f0: 0, f1: op.back / op.speed, r0: op.a, r1: op.a - op.back, speed: -op.speed, ease: 0, label: false, push: false, flex: false });
      if (op.then === 'resume') {
        cutsAtRec.push({ after: segments.length });
        r = op.a;
      } else {
        r = op.a - op.back;
      }
    }
  }
  playTo(to);
  lay(segments);

  // Pins: split the free stretches at the edges of every action, then stretch or squeeze the free stretches between
  // one anchor and the next so each pinned event lands on its film time.
  const pins = [...(spec.pins ?? [])].map((p) => ({ ...p, r: timeOf(cursor, p.event), what: describe(cursor, p.event) })).sort((p, q) => p.r - q.r);
  if (pins.length) {
    const edges = new Set<number>();
    for (const [a, b] of busy) edges.add(a).add(b);
    for (const p of pins) edges.add(p.r);
    const split: Segment[] = [];
    for (const s of segments) {
      if (!s.flex) {
        split.push(s);
        continue;
      }
      const cutsHere = [...edges].filter((e) => e > s.r0 + 1e-6 && e < s.r1 - 1e-6).sort((p, q) => p - q);
      let a = s.r0;
      for (const b of [...cutsHere, s.r1]) {
        const mid = (a + b) / 2;
        const isBusy = busy.some(([p, q]) => mid > p && mid < q);
        split.push(play(a, b, !isBusy));
        a = b;
      }
    }
    segments.splice(0, segments.length, ...split);
    lay(segments);

    let anchor = { r: from, f: 0, index: 0 };
    for (const pin of pins) {
      // The segment that shows the pinned moment while playing forward, after the last anchor.
      const index = segments.findIndex((s, i) => i >= anchor.index && s.kind === 'play' && pin.r >= s.r0 - 1e-6 && pin.r <= s.r1 + 1e-6);
      if (index < 0) throw new Error(`${pin.what} is not in the part of the recording the clip plays, so it cannot be pinned.`);
      const s = segments[index];
      let [lo, hi] = [s.f0, s.f1];
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        if (recIn(s, mid) < pin.r) lo = mid;
        else hi = mid;
      }
      const now = (lo + hi) / 2;
      const delta = pin.at - now;
      const free = segments.filter((x, i) => i >= anchor.index && i < index && x.flex);
      const total = free.reduce((sum, x) => sum + (x.f1 - x.f0), 0);
      if (Math.abs(delta) > 1e-6) {
        if (total <= 1e-6) throw new Error(`${pin.what} cannot be moved to ${fmt(pin.at)}: there is no pause between it and the moment before it to stretch or squeeze.`);
        for (const x of free) {
          const length = x.f1 - x.f0;
          const rec = x.r1 - x.r0;
          const next = length + (delta * length) / total;
          if (next < rec / MOST_SQUEEZE - 1e-9) throw new Error(`${pin.what} cannot land at ${fmt(pin.at)}: the pauses before it would have to play more than ${MOST_SQUEEZE} times faster. Pin it later, or cut a dead stretch with a jump.`);
          if (next > rec * MOST_STRETCH + 1e-9) throw new Error(`${pin.what} cannot land at ${fmt(pin.at)}: the pauses before it would have to play more than ${MOST_STRETCH} times slower. Pin it earlier, or add a freeze.`);
          x.f1 = x.f0 + next;
        }
        lay(segments);
      }
      for (const x of free) Object.assign(x, fitted(x.r0, x.r1 - x.r0, x.f1 - x.f0, RAMP_EASE));
      anchor = { r: pin.r, f: pin.at, index };
    }
  }

  // Film times of the cuts, now that the segments are laid.
  const cuts = cutsAtRec.map(({ after }) => (after === 0 ? 0 : segments[after - 1].f1)).filter((f) => f > 0);
  const duration = segments.length ? segments[segments.length - 1].f1 : 0;

  const segmentAt = (f: number) => {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].f0 <= f) lo = mid;
      else hi = mid - 1;
    }
    return segments[lo];
  };
  const recAt = (f: number) => (segments.length ? recIn(segmentAt(f), f) : from);
  const rateAt = (f: number) => (segments.length ? rateIn(segmentAt(f), f) : 1);

  const filmTimesOf = (rec: number) => {
    const out: number[] = [];
    for (const s of segments) {
      if (s.kind !== 'play' || rec < s.r0 - 1e-9 || rec > s.r1 + 1e-9) continue;
      // recIn is increasing in a play segment: find the film time by halving.
      let lo = s.f0;
      let hi = s.f1;
      for (let k = 0; k < 50; k++) {
        const mid = (lo + hi) / 2;
        if (recIn(s, mid) < rec) lo = mid;
        else hi = mid;
      }
      const f = (lo + hi) / 2;
      if (!out.some((g) => Math.abs(g - f) < 1e-6)) out.push(f);
    }
    return out;
  };
  const filmAt = (rec: number) => {
    const times = filmTimesOf(rec);
    if (times.length) return times[0];
    // A moment that was jumped over shows at the cut; one outside the clip, at its nearer end.
    for (let i = 1; i < segments.length; i++) if (rec > segments[i - 1].r1 && rec < segments[i].r0) return segments[i].f0;
    return rec <= from ? 0 : duration;
  };

  const spedUpAt = (f: number) => {
    const s = segments.length ? segmentAt(f) : null;
    if (!s || !s.label) return 0;
    return clamp01((rateAt(f) - 1.25) / 0.6);
  };

  const freezePushAt = (f: number, release: number) => {
    let amount = 0;
    for (const s of segments) {
      if (s.kind !== 'freeze' || !s.push || f < s.f0) continue;
      const rise = easing.travel(clamp01((f - s.f0) / Math.max(1e-6, s.f1 - s.f0)));
      const fall = f > s.f1 ? easing.travel(clamp01((f - s.f1) / release)) : 0;
      amount = Math.max(amount, rise * (1 - fall));
    }
    return amount;
  };

  return { duration, segments, cuts, loop: spec.loop ?? false, recAt, rateAt, filmAt, filmTimesOf, spedUpAt, freezePushAt };
};

const describe = (cursor: CaptureCursor, ref: EventRef) => {
  if ('click' in ref) return `Click ${ref.click}`;
  if ('mark' in ref) return `The mark "${ref.mark}"`;
  if ('step' in ref) return `Step ${ref.step}`;
  void eventOf(cursor, ref);
  return `The moment at ${fmt(ref.t)}`;
};
