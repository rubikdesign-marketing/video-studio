// The camera over a capture (CAPTURE-PLAN 7.2 and the camera table of 7.9). It moves over the double-sharpness
// recording, never past 2x, so the picture stays sharp.
//
// - Auto-zoom: before each action it eases in on the real thing (from tracks.json) with room around it, holds
//   through the action and a proof moment, and eases out. Actions close together share one shot.
// - Follow: while zoomed it drifts towards the pointer, 150 ms behind it, and covers only part of the way.
// - It never zooms during a declared reading hold, and hand-set moves override the automatic ones.
// - Moves: push in, pull out, snap zoom (hype only), pan across, crane reveal, dolly and tilt, float, orbit and
//   rack focus. Turns in depth stay under 10 degrees and fade away as the camera closes in (wides only).
//
// Times are film seconds on the clip's clock. Places are page pixels. Pure: no React, no Remotion.
import { clamp01, easing, lerp, presets, timing, type Point, type TimingToken } from '../motion';
import { boxAround, centreOfRect, grow, rectAt, thingAt, union, type CaptureCursor, type CaptureEvent, type CaptureTracks, type Rect } from './data';
import type { Pace, PointerPlan } from './pointer';
import type { TimeMap } from './timemap';

/** The furthest the camera goes in: past this a double-sharpness recording starts to look soft. */
export const MOST_ZOOM = 2;
/** The most a screen turns in depth, in degrees, and only on wide shots. */
const MOST_TURN = 10;
/** A shot that would zoom in less than this stays wide. */
const LEAST_ZOOM = 1.12;
/** Follow: how far behind the pointer, in seconds, and what share of the way it covers. */
const FOLLOW_DELAY = 0.15;
const FOLLOW_SHARE = 0.3;
/** Room kept between the thing and the frame's edge while zoomed, as a share of the view. */
export const KEEP_ROOM = 0.06;
/** Actions closer together than this (seconds) share one shot. */
const SAME_SHOT = 1.0;

export type Target = 'page' | Rect | { thing: string } | { click: number } | (Point & { zoom?: number });

export type CameraMove =
  | { move: 'push-in'; to: Target; at: number; over?: TimingToken; zoom?: number }
  | { move: 'pull-out'; from: Target; at: number; over?: TimingToken; zoom?: number }
  | { move: 'snap-zoom'; to: Target; at: number; zoom?: number }
  | { move: 'pan-across'; from: Target; to: Target; at: number; over?: TimingToken; zoom?: number }
  | { move: 'crane-reveal'; from: Target; at: number; over?: TimingToken }
  | { move: 'key'; to: Target; at: number; over?: TimingToken; zoom?: number }
  | { move: 'release'; at: number; over?: TimingToken }
  | { move: 'dolly-tilt'; at: number; over?: TimingToken; turn?: number }
  | { move: 'orbit'; at: number; over?: TimingToken; turn?: number }
  | { move: 'rack-focus'; from: Target; to: Target; at: number; over?: TimingToken; until?: number };

export type CameraOptions = {
  /** Zoom in on actions by itself. */
  auto?: boolean;
  /** Drift towards the pointer while zoomed. */
  follow?: boolean;
  /** Land each zoom with a soft spring (calm never springs). */
  spring?: boolean;
  /** Keep the screen alive with a slow drift in depth (wides only). */
  float?: boolean;
  /** Give every action its own shot instead of sharing one between actions close together. */
  everyAction?: boolean;
  /** The furthest automatic zooms go (never past 2). */
  most?: number;
  /** How long a zoom takes. */
  over?: TimingToken;
  /** How long to hold after the action before easing out, in seconds (the proof moment: 0.6 to 1.3). */
  holdAfter?: number;
  /** Hand-set moves; they override the automatic camera from their cue on. */
  moves?: CameraMove[];
  /** Film-time spans that must be read: the camera does not move during them. */
  holds?: [number, number][];
  /** A slow constant push through the whole clip, as a share (0.06 is 6% closer by the end). */
  drift?: number;
};

export type CameraState = {
  /** The page pixel at the middle of the view, and how far in (1 is the whole page). */
  cx: number;
  cy: number;
  zoom: number;
  /** Turns in depth, in degrees. */
  turnX: number;
  turnY: number;
  /** Rack focus: the sharp area and how strongly the rest is softened (0 to 1). */
  focus: { rect: Rect; amount: number } | null;
};

/** A shot of the automatic camera, for the checks: when it is in, and the thing it is on. */
export type Shot = { inStart: number; inEnd: number; holdEnd: number; outEnd: number; rect: Rect; zoom: number; things: string[]; recFrom: number; recTo: number };

/**
 * `base`: the zoom at which the page's height fills the clip's region (1 for a region the page's own shape; more for
 * a tall region, phase 8). The pointer is drawn at its own size there and grows with the square root of zoom past it.
 */
export type CameraPlan = { at: (f: number) => CameraState; shots: Shot[]; base?: number };

type View = { cx: number; cy: number; zoom: number };
type Transition = { t0: number; t1: number; from: View | null; to: View; spring: boolean; ease?: (u: number) => number };

/**
 * A soft spring as an easing: the travel curve, plus a small rise past the end that settles back with no speed
 * left. `overshoot` is the preset's (none for calm). Position and scale only.
 */
export const springEase = (overshoot: number) => (u: number) => {
  const v = clamp01((u - 0.55) / 0.45);
  return easing.travel(u) + overshoot * 1.6 * Math.sin(Math.PI * v) ** 2 * (1 - v);
};

/** max(a, b) with a rounded knee `k` wide, so a limit never puts a kink in a move. */
const softMax = (a: number, b: number, k: number) => (Math.abs(a - b) >= k ? Math.max(a, b) : (a + b) / 2 + ((a - b) * (a - b)) / (4 * k) + k / 4);
const softClamp = (x: number, lo: number, hi: number, k: number) => -softMax(-softMax(x, lo, k), -hi, k);
/** Between two views. `ez` eases the size on its own, so a spring can settle the zoom while the place travels evenly. */
const mix = (a: View, b: View, e: number, ez = e): View => ({
  cx: lerp(a.cx, b.cx, e),
  cy: lerp(a.cy, b.cy, e),
  // Size changes by a constant factor, so a long zoom closes in at one steady rate.
  zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), ez)),
});

/**
 * The tracked thing typing goes into: the field clicked just before, or a tracked thing that turned up just before
 * (a search box opened by a shortcut). Undefined when neither.
 */
export const typingTarget = (cursor: CaptureCursor, tracks: CaptureTracks | undefined, clicks: PointerPlan['clicks'], e: CaptureEvent): string | undefined => {
  const click = [...clicks].reverse().find((c) => c.t <= e.t && e.t - c.t < 1.5);
  if (click) return thingAt(tracks, click, e.t)?.name;
  return [...cursor.events].reverse().find((x) => x.type === 'track' && x.t <= e.t && e.t - x.t < 1.5 && x.name)?.name;
};

export const planCamera = (
  cursor: CaptureCursor,
  tracks: CaptureTracks | undefined,
  map: TimeMap,
  pointer: PointerPlan,
  options: CameraOptions & { pace: Pace; energy: Pace },
): CameraPlan => {
  const page = cursor.page;
  const wide: View = { cx: page.width / 2, cy: page.height / 2, zoom: 1 };
  const lengthOf = (token: TimingToken) => (timing[token] * presets[options.pace].length) / 1000;
  const zoomLength = lengthOf(options.over ?? 'scene');
  const holdAfter = options.holdAfter ?? 0.8;
  const overshoot = options.spring ? presets[options.energy].overshoot : 0;
  // A spring lands a little past its zoom and settles back; leave it room under the 2x limit, so the limit never
  // flattens the settle into a kink.
  const most = Math.min(MOST_ZOOM / (1 + 2 * overshoot), options.most ?? MOST_ZOOM);
  const settle = springEase(overshoot);

  /** The view that shows a box with room around it. */
  const fit = (rect: Rect, zoom?: number): View => {
    const room = grow(rect, Math.max(48, 0.35 * Math.max(rect.width, rect.height * (page.width / page.height))));
    const z = zoom ?? Math.min(most, page.width / room.width, page.height / room.height);
    const c = centreOfRect(rect);
    return onPage({ cx: c.x, cy: c.y, zoom: Math.max(1, Math.min(MOST_ZOOM, z)) });
  };
  /** The same view moved the least it takes to stay on the page. */
  const onPage = (v: View): View => {
    const halfW = page.width / (2 * v.zoom);
    const halfH = page.height / (2 * v.zoom);
    return { zoom: v.zoom, cx: Math.min(page.width - halfW, Math.max(halfW, v.cx)), cy: Math.min(page.height - halfH, Math.max(halfH, v.cy)) };
  };

  /** The box a target means at film time `f`. */
  const rectOf = (target: Target, f: number): Rect | 'page' => {
    if (target === 'page') return 'page';
    const r = map.recAt(f);
    if ('thing' in target) {
      const rect = rectAt(tracks, target.thing, r);
      if (!rect) throw new Error(`The camera was asked to go to "${target.thing}", but that thing is not tracked (or not on the page) at ${f.toFixed(2)} s.`);
      return rect;
    }
    if ('click' in target) {
      const click = pointer.clicks[target.click - 1];
      if (!click) throw new Error(`The camera was asked to go to click ${target.click}, but the capture has ${pointer.clicks.length} clicks.`);
      return thingAt(tracks, click, click.t)?.rect ?? boxAround(click, 360, 200);
    }
    if ('width' in target) return target;
    return boxAround(target, page.width / (target.zoom ?? 1.6), page.height / (target.zoom ?? 1.6));
  };
  const viewOf = (target: Target, f: number, zoom?: number): View => {
    const rect = rectOf(target, f);
    if (rect === 'page') return wide;
    if (target !== 'page' && !('width' in target) && !('thing' in target) && !('click' in target)) return { cx: target.x, cy: target.y, zoom: target.zoom ?? zoom ?? 1.6 };
    return fit(rect, zoom);
  };

  // ------------------------------------------------ the automatic camera

  type Action = { from: number; ready: number; to: number; rect: Rect; recFrom: number; recTo: number; thing?: string };
  const actions: Action[] = [];
  const thingsOver = (name: string | undefined, r0: number, r1: number, fallback: Rect) => {
    if (!name || !tracks) return fallback;
    let box: Rect | null = null;
    for (let r = r0; r <= r1 + 1e-6; r += 1 / 30) {
      const rect = rectAt(tracks, name, r);
      if (rect) box = box ? union(box, rect) : rect;
    }
    return box ?? fallback;
  };
  const clipFrom = map.recAt(0);
  const clipTo = map.recAt(map.duration);
  for (const click of pointer.clicks) {
    if (click.t < clipFrom || click.t > clipTo) continue;
    const thing = thingAt(tracks, click, click.t);
    const move = pointer.moves.find((m) => Math.abs(m.end - click.arrive) < 1e-6);
    const rect = thingsOver(thing?.name, click.arrive, click.up, thing?.rect ?? boxAround(click, 360, 200));
    actions.push({ from: map.filmAt(move?.start ?? click.arrive), ready: map.filmAt(click.arrive), to: map.filmAt(click.up), rect, recFrom: click.arrive, recTo: click.up, thing: thing?.name });
  }
  for (const e of cursor.events) {
    if (e.t < clipFrom || e.t > clipTo) continue;
    if (e.type === 'type' || e.type === 'paste') {
      const end = e.end ?? e.t + 0.3;
      const name = typingTarget(cursor, tracks, pointer.clicks, e);
      const click = [...pointer.clicks].reverse().find((c) => c.t <= e.t && e.t - c.t < 1.5);
      const fallback = click ? boxAround(click, 520, 160) : null;
      const over = name ? thingsOver(name, e.t, end, fallback as Rect) : fallback;
      const thing = name && over !== fallback ? { name, rect: over } : null;
      const rect = over;
      if (!rect) continue;
      actions.push({ from: map.filmAt(e.t), ready: map.filmAt(e.t), to: map.filmAt(end), rect, recFrom: e.t, recTo: end, thing: thing?.rect ? thing.name : undefined });
    } else if (e.type === 'drag' && Array.isArray(e.from) && Array.isArray(e.to)) {
      const start = { x: e.from[0], y: e.from[1] };
      const thing = thingAt(tracks, start, e.t);
      const end = e.end ?? e.t;
      const ends = union(boxAround(start, 200, 120), boxAround({ x: e.to[0], y: e.to[1] }, 200, 120));
      const rect = union(thingsOver(thing?.name, e.t, end, ends), ends);
      actions.push({ from: map.filmAt(e.t - 0.3), ready: map.filmAt(e.t - 0.15), to: map.filmAt(end), rect, recFrom: e.t, recTo: end, thing: thing?.name });
    }
  }
  actions.sort((a, b) => a.from - b.from);

  // Group actions close in time and place into one shot; drop shots that would hardly zoom.
  type Draft = Shot & { actionEnd: number };
  const drafts: Draft[] = [];
  for (const a of actions) {
    const last = drafts[drafts.length - 1];
    const zoom = fit(a.rect).zoom;
    const sameThing = last && a.thing !== undefined && last.things.length === 1 && last.things[0] === a.thing;
    if (last && (!options.everyAction || sameThing)) {
      const close = a.ready - 0.05 - zoomLength - last.actionEnd < SAME_SHOT;
      const rect = union(last.rect, a.rect);
      const together = fit(rect).zoom;
      if (close && together >= Math.max(LEAST_ZOOM, 0.75 * Math.min(zoom, last.zoom))) {
        Object.assign(last, {
          rect,
          zoom: together,
          actionEnd: Math.max(last.actionEnd, a.to),
          holdEnd: Math.max(last.holdEnd, a.to + holdAfter),
          outEnd: Math.max(last.outEnd, a.to + holdAfter + zoomLength),
          recTo: Math.max(last.recTo, a.recTo),
          things: [...new Set([...last.things, ...(a.thing ? [a.thing] : [])])],
        });
        continue;
      }
    }
    drafts.push({
      inStart: a.ready - 0.05 - zoomLength,
      inEnd: a.ready - 0.05,
      holdEnd: a.to + holdAfter,
      outEnd: a.to + holdAfter + zoomLength,
      rect: a.rect,
      zoom,
      things: a.thing ? [a.thing] : [],
      recFrom: a.recFrom,
      recTo: a.recTo,
      actionEnd: a.to,
    });
  }
  const kept = drafts.filter((s) => s.zoom >= LEAST_ZOOM);

  // Lay the moves: a move into a shot never starts before the last shot's action is done. When there is no time
  // to ease out and back in, the camera moves straight from one shot to the next.
  const autoTransitions: Transition[] = [];
  if (options.auto ?? true) {
    let state: View = wide;
    const quick = lengthOf('quick');
    kept.forEach((shot, i) => {
      const prev = kept[i - 1];
      const view = fit(shot.rect);
      let t0 = Math.max(0, shot.inStart, prev ? prev.actionEnd + 0.15 : 0);
      if (shot.inEnd - t0 < quick) t0 = Math.max(0, shot.inEnd - quick);
      shot.inStart = t0;
      let from: View | null = state;
      if (prev && prev.outEnd > t0) {
        // Straight on from the last shot: its hold ends where this move starts, and the move sets off from wherever
        // the camera is then, even if it has not quite landed on the last shot yet.
        prev.holdEnd = Math.min(prev.holdEnd, t0);
        prev.outEnd = prev.holdEnd;
        autoTransitions.pop();
        from = null;
      }
      autoTransitions.push({ t0, t1: Math.max(t0 + 1e-3, shot.inEnd), from, to: view, spring: Boolean(options.spring) });
      autoTransitions.push({ t0: shot.holdEnd, t1: shot.outEnd, from: view, to: wide, spring: false });
      state = wide;
    });
  }

  const evaluate = (list: Transition[], f: number, start: View): View => {
    let view = start;
    for (const tr of list) {
      if (f < tr.t0) break;
      const from = tr.from ?? view;
      const u = clamp01((f - tr.t0) / Math.max(1e-6, tr.t1 - tr.t0));
      const e = tr.ease ? tr.ease(u) : easing.travel(u);
      view = mix(from, tr.to, e, tr.spring ? settle(u) : e);
    }
    return view;
  };

  // Follow: in each shot the camera drifts towards the pointer, 150 ms behind it, covering 30% of the way, and
  // never so far that the thing leaves the shot. The drift fades in and out with the shot's own moves.
  const followOf = (shot: Shot, f: number) => {
    const target = fit(shot.rect);
    // Never look back across a cut: just after one, follow the pointer as it is now.
    const lastCut = Math.max(0, ...map.cuts.filter((c) => c <= f));
    const behind = pointer.at(map.recAt(Math.max(lastCut, f - FOLLOW_DELAY)));
    const halfW = page.width / (2 * target.zoom);
    const halfH = page.height / (2 * target.zoom);
    const rect = shot.rect;
    // Room to keep, plus the width of the soft limit's knee, so the knee never eats into the room.
    const roomW = halfW * 2 * KEEP_ROOM + 12;
    const roomH = halfH * 2 * KEEP_ROOM + 12;
    const bound = (lo: number, hi: number, pageLo: number, pageHi: number) => [Math.max(lo, pageLo), Math.min(hi, pageHi)];
    const [lowX, highX] = bound(rect.x + rect.width + roomW - halfW, rect.x - roomW + halfW, halfW, page.width - halfW);
    const [lowY, highY] = bound(rect.y + rect.height + roomH - halfH, rect.y - roomH + halfH, halfH, page.height - halfH);
    const want = { x: target.cx + FOLLOW_SHARE * (behind.x - target.cx), y: target.cy + FOLLOW_SHARE * (behind.y - target.cy) };
    return {
      x: lowX <= highX ? softClamp(want.x, lowX, highX, 40) - target.cx : 0,
      y: lowY <= highY ? softClamp(want.y, lowY, highY, 40) - target.cy : 0,
    };
  };
  const weightOf = (shot: Shot, f: number) => {
    // A shot that hands straight on to the next one lets go during the next one's move.
    const next = kept[kept.indexOf(shot as Draft) + 1];
    const [a, b] = shot.outEnd === shot.holdEnd && next ? [next.inStart, next.inEnd] : [shot.holdEnd, shot.outEnd];
    if (f <= shot.inStart || f >= b) return 0;
    const rise = easing.travel(clamp01((f - shot.inStart) / Math.max(1e-6, shot.inEnd - shot.inStart)));
    const fall = easing.travel(clamp01((f - a) / Math.max(1e-6, b - a)));
    return rise * (1 - fall);
  };

  const autoAt = (f: number): View => {
    const view = evaluate(autoTransitions, f, wide);
    if (!(options.follow ?? true)) return view;
    let dx = 0;
    let dy = 0;
    for (const shot of kept) {
      const w = weightOf(shot, f);
      if (w <= 0) continue;
      const d = followOf(shot, f);
      dx += w * d.x;
      dy += w * d.y;
    }
    return { ...view, cx: view.cx + dx, cy: view.cy + dy };
  };

  // ------------------------------------------------ hand-set moves

  const moves = [...(options.moves ?? [])].sort((a, b) => a.at - b.at);
  const framing = moves.filter((m) => m.move !== 'dolly-tilt' && m.move !== 'orbit' && m.move !== 'rack-focus');
  const startsSomewhere = (m: CameraMove) => m.move === 'pull-out' || m.move === 'pan-across' || m.move === 'crane-reveal';
  const handFrom = framing.length ? (startsSomewhere(framing[0]) ? 0 : framing[0].at) : Infinity;
  const handTransitions: Transition[] = [];
  let releaseAt = Infinity;
  let releaseLength = zoomLength;
  for (const m of framing) {
    const length = lengthOf(('over' in m && m.over) || (m.move === 'snap-zoom' ? 'quick' : m.move === 'pan-across' || m.move === 'crane-reveal' ? 'hero' : 'scene'));
    if (m.move === 'release') {
      releaseAt = m.at;
      releaseLength = length;
      break;
    }
    if (m.move === 'push-in' || m.move === 'key') {
      handTransitions.push({ t0: m.at, t1: m.at + length, from: null, to: viewOf(m.to, m.at, m.zoom), spring: Boolean(options.spring) });
    } else if (m.move === 'snap-zoom') {
      // A snap with a tiny settle is for hype films; elsewhere it is an ordinary push in.
      const hype = options.energy === 'hype';
      const snap = springEase(0.04);
      handTransitions.push({ t0: m.at, t1: m.at + (hype ? length * 1.4 : lengthOf('scene')), from: null, to: viewOf(m.to, m.at, m.zoom ?? 1.8), spring: false, ease: hype ? snap : undefined });
    } else if (m.move === 'pull-out' || m.move === 'crane-reveal') {
      const start = viewOf(m.from, m.at, m.move === 'pull-out' ? m.zoom : undefined);
      handTransitions.push({ t0: handTransitions.length ? m.at - 1e-3 : -1, t1: handTransitions.length ? m.at : 0, from: null, to: start, spring: false });
      handTransitions.push({ t0: m.at, t1: m.at + length, from: start, to: wide, spring: false });
    } else if (m.move === 'pan-across') {
      const zoom = m.zoom ?? 1.6;
      const a = viewOf(m.from, m.at, zoom);
      const b = viewOf(m.to, m.at, zoom);
      handTransitions.push({ t0: handTransitions.length ? m.at - 1e-3 : -1, t1: handTransitions.length ? m.at : 0, from: null, to: { ...a, zoom }, spring: false });
      handTransitions.push({ t0: m.at, t1: m.at + length, from: { ...a, zoom }, to: { ...b, zoom }, spring: false });
    }
  }

  const framed = (f: number): View => {
    const auto = autoAt(f);
    if (f < handFrom) return auto;
    const hand = evaluate(handTransitions, f, autoAt(handFrom));
    if (f < releaseAt) return hand;
    const back = easing.travel(clamp01((f - releaseAt) / releaseLength));
    return mix(evaluate(handTransitions, releaseAt, autoAt(handFrom)), auto, back);
  };

  // ------------------------------------------------ reading holds, freezes, the loop and depth

  const holds = [...(options.holds ?? [])].sort((a, b) => a[0] - b[0]);
  const held = (f: number): View => {
    for (const [h0, h1] of holds) {
      if (f >= h0 && f <= h1) return framed(h0);
      if (f > h1 && f < h1 + zoomLength) return mix(framed(h0), framed(f), easing.travel((f - h1) / zoomLength));
    }
    return framed(f);
  };

  const loopLength = Math.min(map.duration / 3, lengthOf('hero'));

  const at = (f: number): CameraState => {
    let view = { ...held(f) };
    const push = map.freezePushAt(f, zoomLength);
    if (push > 0) view = { ...view, zoom: view.zoom * (1 + 0.05 * push) };
    if (options.drift) view.zoom *= 1 + options.drift * clamp01(f / Math.max(1e-6, map.duration));
    if (map.loop) {
      const back = easing.travel(clamp01((f - (map.duration - loopLength)) / loopLength));
      if (back > 0) view = mix(view, held(0), back);
    }
    view.zoom = Math.max(1, Math.min(MOST_ZOOM, view.zoom));
    // Keep the view on the page.
    const halfW = page.width / (2 * view.zoom);
    const halfH = page.height / (2 * view.zoom);
    // Every view the camera aims for is already on the page, and moves between them stay on it, so this rarely acts.
    view.cx = Math.min(page.width - halfW, Math.max(halfW, view.cx));
    view.cy = Math.min(page.height - halfH, Math.max(halfH, view.cy));

    // Turns in depth: wides only, and never past 10 degrees.
    const wideness = clamp01((1.25 - view.zoom) / 0.25);
    let turnX = 0;
    let turnY = 0;
    if (options.float) {
      turnX += 2 * Math.sin((2 * Math.PI * f) / 7.3);
      turnY += 2.6 * Math.sin((2 * Math.PI * f) / 9.1 + 1);
    }
    let focus: CameraState['focus'] = null;
    for (const m of moves) {
      const length = lengthOf(('over' in m && m.over) || (m.move === 'rack-focus' ? 'scene' : 'hero'));
      if (m.move === 'dolly-tilt') {
        const u = easing.travel(clamp01((f - m.at) / length));
        const turn = Math.min(MOST_TURN, m.turn ?? 8);
        turnY += turn * (1 - u);
        if (f >= m.at) view.zoom = Math.min(view.zoom * (1 + 0.08 * u), MOST_ZOOM);
      } else if (m.move === 'orbit') {
        const turn = Math.min(MOST_TURN, m.turn ?? 7);
        const u = easing.travel(clamp01((f - m.at) / length));
        turnY += lerp(-turn, turn, u);
        turnX += 3;
      } else if (m.move === 'crane-reveal') {
        const u = clamp01((f - m.at) / length);
        turnX += 7 * Math.sin(Math.PI * u);
      } else if (m.move === 'rack-focus') {
        const a = rectOf(m.from, m.at);
        const b = rectOf(m.to, m.at);
        if (a === 'page' || b === 'page') continue;
        const u = easing.travel(clamp01((f - m.at) / length));
        const rect = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), width: lerp(a.width, b.width, u), height: lerp(a.height, b.height, u) };
        const fadeIn = easing.arrive(clamp01((f - (m.at - 0.6)) / 0.4));
        const fadeOut = m.until === undefined ? 0 : easing.leave(clamp01((f - m.until) / 0.4));
        const amount = fadeIn * (1 - fadeOut);
        if (amount > 0) focus = { rect, amount };
      }
    }
    const scale = Math.min(1, MOST_TURN / Math.max(MOST_TURN, Math.hypot(turnX, turnY)));
    return { cx: view.cx, cy: view.cy, zoom: view.zoom, turnX: turnX * scale * wideness, turnY: turnY * scale * wideness, focus };
  };

  return { at, shots: options.auto ?? true ? kept : [] };
};
