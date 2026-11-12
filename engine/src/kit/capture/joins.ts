// Transitions between two captures, or two parts of one, on one film clock (CAPTURE-PLAN 7.5 and the 7.9
// transitions table; knowledge/craft/03-transitions.md). This file is the plan: where each of the two shots is, how
// big, how bright and how cut, at any film time, and where the one pointer is across the join. It is pure (no
// React, no Remotion) so tools/checks/capture_transitions.mjs measures exactly what CaptureJoin (transitions.tsx)
// draws.
//
// The join hangs on real data: the click (cursor.json) sets when it happens and where it starts from, the clicked
// thing (tracks.json, or a place given for a take that tracked nothing) is what the camera dives into or what flies,
// the pointer's last move sets the way a push goes, and the scroll log sets how fast a scroll relay starts.
//
// Lengths come from the film's energy: every transition that is not a cut lasts the `scene` token (600 to 900 ms by
// the craft file: calm 900, confident 750, hype 638); a cut is one frame. Whip and snap cut are for hype films only.
//
// Places: frame pixels unless named "page" (page pixels of the recorded window). Times: film seconds on the join's
// clock, which is shot A's clock; shot B's clock starts at `bStart`.
import type { CaptureClipProps } from '../CaptureClip';
import { clamp01, easing, lerp, presets, timing, type Point, type PresetName } from '../motion';
import type { CameraMove } from './camera';
import { boxAround, centreOfRect, clicksOf, rectAt, thingAt, type CaptureTracks, type CursorShape, type Rect } from './data';
import { planOfClip } from './clipplan';
import { withThings } from './glue';
import { resolveLook, type LookName, type StagingName, type TransitionName } from './looks';
import { isWide, sizedStaging } from './relayout';

export type JoinSource = Omit<CaptureClipProps, 'width' | 'style' | 'window'>;
export type Side = 'left' | 'right' | 'up' | 'down';
export type JoinFrame = { width: number; height: number; fps: number };

export type JoinOptions = {
  transition?: TransitionName;
  /** Which click of shot A the join hangs on (1 is the first). Default: the last click shot A plays. */
  click?: number;
  /** Or the film time of the join on shot A's clock, for a take with no click to hang it on. */
  at?: number;
  /** The thing in shot A that is entered, grows or flies: a tracked name or a page rectangle. Default: the clicked thing. */
  from?: string | Rect;
  /** Where it lands in shot B (shared element): a tracked name or a page rectangle. Default: the same place as in A. */
  to?: string | Rect;
  /** The way a push, slide, whip, flip or drag goes. Default: the way the pointer last moved before the click. */
  direction?: Side;
  /** Staging of each shot (CaptureShot). Default: the look's own; window split and device swap set their own. */
  staging?: StagingName;
  stagingB?: StagingName;
  /** How much of the frame's width a card fills (as CaptureShot). */
  size?: number;
  /** Shot B starts on shot A's camera view and eases out (default: on for the joins that pass through the click). */
  carry?: boolean;
};

/** How one shot is drawn at a moment: a 2D move about an origin, plus brightness, softness, a cut-out and a turn. */
export type Layer = {
  visible: boolean;
  tx: number;
  ty: number;
  scale: number;
  ox: number;
  oy: number;
  opacity: number;
  /** Softness in pixels (a zoom's smear, or a blur dissolve). */
  blur: number;
  /** Motion blur along the move: pixels travelled this frame. */
  mx: number;
  my: number;
  /** 0 to 1 darker. */
  dim: number;
  /** Turn about the vertical axis, degrees (card flip). */
  turn: number;
  z: number;
  /** A cut-out: a circle, or a rounded rectangle whose `round` goes from the thing's corners (0) to a window's (1). */
  clip: null | { circle: { x: number; y: number; r: number } } | { inset: Rect; round: number };
};

export type PointerDraw = { tip: Point; opacity: number; shape: CursorShape; press: number; grow: number };

/** The piece of a recording that flies in a shared element, or the face of a container: real pixels. */
export type Piece = { which: 'a' | 'b'; page: Rect; rec: number; dst: Rect; opacity: number; lift: number };

/** A screen of a grid zoom that is not one of the two shots: a still of a real moment. */
export type Tile = { which: 'a' | 'b'; rec: number; dst: Rect; opacity: number };

type Spec = {
  /** One frame, not a move. */
  cut?: boolean;
  /** Hype films only; elsewhere the fallback is used. */
  hypeOnly?: TransitionName;
  /**
   * Shot B starts on A's camera view: "hold" keeps it there until the join is over, then eases out; "during" eases
   * out through the join, and shot A holds its last frame while its camera eases out the same way, so the two
   * pictures lie on each other and only what changed dissolves.
   */
  carry?: 'hold' | 'during';
  /** "carry": one pointer travels from A's to B's; "fade": A's goes, B's comes; "own": each shot keeps its own. */
  pointer: 'carry' | 'fade' | 'own' | 'drag' | 'cut';
  /** The number of the technique in knowledge/craft/03-transitions.md. */
  technique: number | null;
};

export const transitionSpecs: Record<TransitionName, Spec> = {
  cut: { cut: true, pointer: 'cut', technique: 12 },
  'match-cut': { cut: true, carry: 'hold', pointer: 'cut', technique: 5 },
  'snap-cut': { cut: true, hypeOnly: 'cut', pointer: 'cut', technique: 6 },
  'zoom-through': { carry: 'hold', pointer: 'carry', technique: 15 },
  'shared-element': { carry: 'during', pointer: 'carry', technique: 1 },
  'container-grow': { carry: 'hold', pointer: 'carry', technique: 2 },
  push: { pointer: 'carry', technique: 3 },
  slide: { pointer: 'carry', technique: 14 },
  'depth-push': { pointer: 'carry', technique: null },
  'circle-reveal': { carry: 'hold', pointer: 'carry', technique: null },
  'card-flip': { pointer: 'fade', technique: null },
  'stack-shuffle': { pointer: 'fade', technique: null },
  'grid-zoom': { pointer: 'fade', technique: null },
  'scroll-relay': { pointer: 'carry', technique: 14 },
  'cursor-drag': { pointer: 'drag', technique: 7 },
  whip: { hypeOnly: 'push', pointer: 'carry', technique: 11 },
  'window-split': { pointer: 'own', technique: null },
  'device-swap': { pointer: 'fade', technique: null },
  'blur-dissolve': { carry: 'during', pointer: 'carry', technique: null },
  'cross-dissolve': { carry: 'during', pointer: 'carry', technique: null },
};

// ---------------------------------------------------------------- lengths

/** A transition lasts the `scene` token for the film's energy, inside the craft file's 600 to 900 ms. */
export const transitionSeconds = (energy: PresetName) => Math.min(0.9, Math.max(0.6, (timing.scene * presets[energy].length) / 1000));
const tokenSeconds = (token: keyof typeof timing, energy: PresetName) => (timing[token] * presets[energy].length) / 1000;

/**
 * The transition a film's n-th join uses with a look (0 is the first): the look's list in turn, never the same as
 * the join before it, and never one the energy does not allow (whip and snap cut are hype only).
 */
export const pickTransition = (look: LookName | undefined, index: number, energy: PresetName, previous?: TransitionName): TransitionName => {
  const list = resolveLook(look).transitions.map((t) => allowed(t, energy));
  for (let k = 0; k < list.length; k++) {
    const name = list[(index + k) % list.length];
    if (name !== previous || list.length === 1) return name;
  }
  return list[0];
};

const allowed = (name: TransitionName, energy: PresetName): TransitionName => {
  const spec = transitionSpecs[name];
  return spec.hypeOnly && energy !== 'hype' ? spec.hypeOnly : name;
};

// ---------------------------------------------------------------- where a shot sits in the frame

const ASPECT = 16 / 9;
/** The stagings whose region this file places exactly; the others are close, so their pointer fades across a join. */
const EXACT: StagingName[] = ['card', 'frameless', 'browser', 'browser-dark', 'laptop', 'float', 'stacked', 'pip', 'before-after'];

/** The clip's region in the frame for a staging, as CaptureShot lays it out (frame pixels). */
export const shotBox = (staging: StagingName, frame: JoinFrame, pageAspect: number, size = 0.72, page?: { width: number; height: number; scale?: number }): Rect => {
  const { width: W, height: H } = frame;
  // 9:16, 1:1 and 4:5: the re-laid staging's screen region (relayout.ts), as CaptureShot draws it.
  if (!isWide(W, H)) return sizedStaging(staging, frame, page ?? { width: 1920, height: 1920 * pageAspect }).region;
  const vh = (n: number) => (n * H) / 100;
  const fit = (share: number, extra = 0, room = 0.16) => Math.min(W * share, (H * (1 - room) - extra) * ASPECT);
  const centred = (w: number, top?: number): Rect => {
    const h = w * pageAspect;
    return { x: (W - w) / 2, y: top ?? (H - h) / 2, width: w, height: h };
  };
  switch (staging) {
    case 'frameless':
      return centred(Math.min(W, H * ASPECT));
    case 'browser':
    case 'browser-dark':
    case 'email':
    case 'terminal': {
      const bar = vh(4.6);
      const w = fit(size, bar);
      return centred(w, (H - (bar + w / ASPECT)) / 2 + bar);
    }
    case 'laptop': {
      const w = fit(0.6, vh(5), 0.2);
      const pad = vh(1.5);
      const total = w / ASPECT + pad * 2.4 + vh(1.7);
      return centred(w, (H - total) / 2 + pad);
    }
    case 'monitor': {
      const w = fit(0.6, vh(12), 0.16);
      const pad = vh(1.1);
      const total = w / ASPECT + pad * 3.2 + vh(8.3);
      return centred(w, (H - total) / 2 + pad);
    }
    case 'tablet':
      return centred(fit(0.6, vh(6)));
    case 'phone':
    case 'phone-crop': {
      const h = H * (staging === 'phone' ? 0.8 : 0.86);
      const w = staging === 'phone' ? h * (9 / 19.5) : h * (9 / 16);
      return { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h };
    }
    case 'float':
      return centred(fit(size * 0.84));
    case 'isometric':
      return centred(fit(0.56));
    case 'stacked': {
      const w = fit(0.62, 0, 0.26);
      const offset = vh(6);
      const h = w / ASPECT;
      return { x: (W - w - offset * 2) / 2, y: (H - h - offset * 2) / 2 + offset * 2, width: w, height: w * pageAspect };
    }
    case 'pip':
    case 'before-after':
      return centred(fit(size, 0, 0.2));
    default:
      return centred(fit(size));
  }
};

// ---------------------------------------------------------------- small helpers

/** A move's softness: the shutter is open half the frame, nothing blurs below reading speed (as moves/core.tsx). */
export const smearOf = (perFrame: number, frameWidth: number) => {
  const blur = Math.max(0, Math.abs(perFrame) - frameWidth * 0.004) * 0.5 * (1 / Math.sqrt(12));
  return blur < 0.3 ? 0 : blur;
};

const identity = (box: Rect, z = 0): Layer => ({ visible: true, tx: 0, ty: 0, scale: 1, ox: box.x + box.width / 2, oy: box.y + box.height / 2, opacity: 1, blur: 0, mx: 0, my: 0, dim: 0, turn: 0, z, clip: null });
const hidden = (box: Rect): Layer => ({ ...identity(box), visible: false, opacity: 0 });

/** A frame point drawn through a layer (the turn of a card flip is left out). */
export const throughLayer = (l: Layer, p: Point): Point => ({ x: l.ox + (p.x - l.ox) * l.scale + l.tx, y: l.oy + (p.y - l.oy) * l.scale + l.ty });
export const rectThroughLayer = (l: Layer, r: Rect): Rect => {
  const a = throughLayer(l, r);
  return { x: a.x, y: a.y, width: r.width * l.scale, height: r.height * l.scale };
};

const lerpPoint = (a: Point, b: Point, u: number): Point => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
const lerpRect = (a: Rect, b: Rect, u: number): Rect => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), width: lerp(a.width, b.width, u), height: lerp(a.height, b.height, u) });
const sideOf: Record<Side, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
/** A sharp in-and-out for the whip: most of the distance in the middle third. */
const whipEase = (u: number) => {
  // Cubic bezier (0.7, 0, 0.3, 1) by halving on x.
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 30; k++) {
    const s = (lo + hi) / 2;
    const x = 3 * (1 - s) * (1 - s) * s * 0.7 + 3 * (1 - s) * s * s * 0.3 + s * s * s;
    if (x < u) lo = s;
    else hi = s;
  }
  const s = (lo + hi) / 2;
  return 3 * (1 - s) * s * s + s * s * s;
};

/** Where a page thing named or given is, at a recording time. */
const thingRect = (tracks: CaptureTracks | undefined, thing: string | Rect | undefined, rec: number): Rect | null => {
  if (!thing) return null;
  if (typeof thing !== 'string') return thing;
  return rectAt(tracks, thing, rec);
};

// ---------------------------------------------------------------- the plan

export type JoinPlan = ReturnType<typeof planJoin>;

/**
 * Plans a join of shot A (`a`, from its start) into shot B (`b`). Shot B is given as it should play on its own; the
 * plan adds what the join needs (it carries A's camera view in, and keeps its pointer shown when it carries straight
 * on from A's), in `bSource`.
 */
export const planJoin = (givenA: JoinSource, givenB: JoinSource, options: JoinOptions, energy: PresetName, frame: JoinFrame) => {
  const { fps } = frame;
  // In a 9:16, 1:1 or 4:5 frame each shot is planned with the region it is drawn in, so its follow camera is the one
  // the join measures (CaptureShot draws it with the same region).
  const relaid = (s: JoinSource, staging: StagingName): JoinSource =>
    isWide(frame.width, frame.height) || s.relayout ? s : { ...s, relayout: sizedStaging(staging, frame, { ...s.cursor.page, scale: s.cursor.scale }).relayout };
  const askedName = options.transition ?? pickTransition(givenA.look, 0, energy);
  const stagingOf = (which: 'a' | 'b'): StagingName => {
    const look = resolveLook(givenA.look).staging;
    if (askedName === 'device-swap') return which === 'a' ? options.staging ?? 'laptop' : options.stagingB ?? 'phone';
    return which === 'a' ? options.staging ?? look : options.stagingB ?? (askedName === 'window-split' ? 'card' : options.staging ?? look);
  };
  const a = relaid(givenA, stagingOf('a'));
  const b = relaid(givenB, stagingOf('b'));
  const asked = options.transition ?? pickTransition(a.look, 0, energy);
  const name = allowed(asked, energy);
  const spec = transitionSpecs[name];
  const L = spec.cut ? 0 : transitionSeconds(energy);
  const tick = tokenSeconds('tick', energy);
  const tracksA = withThings(a.cursor, a.tracks, a.things);
  const tracksB = withThings(b.cursor, b.tracks, b.things);
  const planA0 = planOfClip(a, tracksA, energy);

  // The click the join hangs on, and the moment.
  const inA = planA0.pointer.clicks.filter((c) => c.t >= planA0.from - 1e-6 && c.t <= planA0.to + 1e-6);
  const click = options.click ? planA0.pointer.clicks.find((c) => Math.abs(c.t - (clicksOf(a.cursor)[options.click! - 1]?.t ?? -1)) < 1e-6) ?? null : inA[inA.length - 1] ?? null;
  const J = options.at ?? (click ? planA0.map.filmAt(name === 'match-cut' ? click.t : click.up) : Math.max(0, planA0.map.duration - L));
  const t0 = Math.round(J * fps) / fps;
  const recA0 = planA0.map.recAt(Math.min(t0, planA0.map.duration));

  // The way things move: the pointer's last move into the click, along its longer axis.
  let direction: Side = options.direction ?? 'left';
  if (!options.direction && click) {
    const move = planA0.pointer.moves.find((m) => Math.abs(m.end - click.arrive) < 1e-6);
    if (move) {
      const dx = move.to.x - move.from.x;
      const dy = move.to.y - move.from.y;
      direction = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    }
  }
  const d = sideOf[direction];

  // Stagings, and where each region sits.
  const lookStaging = resolveLook(a.look).staging;
  const stagingA: StagingName = name === 'device-swap' ? options.staging ?? 'laptop' : options.staging ?? lookStaging;
  const stagingB: StagingName = name === 'device-swap' ? options.stagingB ?? 'phone' : options.stagingB ?? (name === 'window-split' ? 'card' : stagingA);
  const boxA = shotBox(stagingA, frame, a.cursor.page.height / a.cursor.page.width, options.size, { ...a.cursor.page, scale: a.cursor.scale });
  const boxB = shotBox(stagingB, frame, b.cursor.page.height / b.cursor.page.width, options.size, { ...b.cursor.page, scale: b.cursor.scale });
  const tiled = (s: StagingName) => s === 'split' || s === 'split-three' || s === 'grid';
  const exact = isWide(frame.width, frame.height) ? EXACT.includes(stagingA) && EXACT.includes(stagingB) : !tiled(stagingA) && !tiled(stagingB);
  const pointerMode: Spec['pointer'] = spec.pointer === 'carry' && !exact ? 'fade' : spec.pointer;

  // Shot B: its pointer carries on (not hidden as if the clip had just begun) and, for the joins through the
  // click, it starts on A's camera view and eases out once the join is over.
  const pointerFrom = b.pointerFrom ?? (b.from ?? 0);
  const viewA = planA0.camera.at(Math.min(t0, planA0.map.duration));
  const carryMode = options.carry === false ? undefined : spec.carry ?? (options.carry ? 'hold' : undefined);
  const carry = Boolean(carryMode) && !b.moves?.length && viewA.zoom > 1.05 * (planA0.camera.base ?? 1);
  // B's clock starts when it first shows.
  let bStart = t0;
  let swap = t0;
  // Zoom through: one steady push, A from 1 to OUT about the pointer, B from IN to 1 (close to full size, so it never
  // reads as a pull-back). They swap late in the push, still near full speed, dissolving over one tick.
  const OUT = 1.8;
  const IN = 0.8;
  const zTotal = Math.log(OUT / IN);
  if (name === 'zoom-through') {
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (easing.travel(m) * zTotal < Math.log(OUT)) lo = m;
      else hi = m;
    }
    swap = t0 + ((lo + hi) / 2) * L;
    bStart = Math.round((swap - tick / 2) * fps) / fps;
  }
  // Cursor drag: the pointer goes to B's edge first (a pointer move, base), drags it in (the transition, scene), and
  // goes on to where B's own pointer is (base).
  const approach = name === 'cursor-drag' ? tokenSeconds('base', energy) : 0;
  const settleBack = name === 'cursor-drag' ? tokenSeconds('base', energy) : 0;
  const t1 = t0 + approach + L + settleBack;
  const holdB = name === 'match-cut' ? tokenSeconds('base', energy) : carryMode === 'during' ? 0 : t1 - bStart;
  const carryMoves: CameraMove[] = carry
    ? [
        { move: 'pull-out', from: { x: viewA.cx, y: viewA.cy, zoom: viewA.zoom }, at: +holdB.toFixed(4), over: 'scene' },
        { move: 'release', at: +(holdB + tokenSeconds('scene', energy) + 0.05).toFixed(4) },
      ]
    : [];
  const bSource: JoinSource = { ...b, pointerFrom, moves: carry ? carryMoves : b.moves };
  // Carrying through the join, A holds its last frame while its camera eases out with B's.
  const aSource: JoinSource =
    carry && carryMode === 'during'
      ? { ...a, time: { ...a.time, freezes: [...(a.time?.freezes ?? []), { at: planA0.to, hold: +(t1 - planA0.map.duration + 0.2).toFixed(4), push: false }] }, moves: [...(a.moves ?? []), { move: 'key', to: 'page', at: +t0.toFixed(4), over: 'scene' }] }
      : a;
  const planA = aSource === a ? planA0 : planOfClip(aSource, tracksA, energy);
  const durA = planA.map.duration;
  const planB = planOfClip(bSource, tracksB, energy);
  const durB = planB.map.duration;
  const total = name === 'window-split' ? Math.max(durA, bStart + durB) : bStart + durB;

  // ------------------------------------------------ where a shot's own things are drawn (before the join moves it)

  type Which = 'a' | 'b';
  const sideInfo = (w: Which) => (w === 'a' ? { plan: planA, box: boxA, page: a.cursor.page, start: 0, dur: durA, tracks: tracksA } : { plan: planB, box: boxB, page: b.cursor.page, start: bStart, dur: durB, tracks: tracksB });
  /** The clip's own clock at film time t (A holds its last frame once it has run out). */
  const clockOf = (w: Which, t: number) => {
    const s = sideInfo(w);
    return Math.max(0, Math.min(s.dur, t - s.start));
  };
  const toFrame = (w: Which, p: Point, t: number): Point => {
    const s = sideInfo(w);
    const v = s.plan.camera.at(clockOf(w, t));
    const k = s.box.width / s.page.width;
    return { x: s.box.x + (p.x - v.cx) * v.zoom * k + s.box.width / 2, y: s.box.y + (p.y - v.cy) * v.zoom * k + s.box.height / 2 };
  };
  const rectToFrame = (w: Which, r: Rect, t: number): Rect => {
    const s = sideInfo(w);
    const v = s.plan.camera.at(clockOf(w, t));
    const k = s.box.width / s.page.width;
    const a0 = toFrame(w, r, t);
    return { x: a0.x, y: a0.y, width: r.width * v.zoom * k, height: r.height * v.zoom * k };
  };
  /** The clip's own pointer, in frame pixels, before the join moves its shot. */
  const ownPointer = (w: Which, t: number): PointerDraw => {
    const s = sideInfo(w);
    const f = clockOf(w, t);
    const state = s.plan.pointer.at(s.plan.map.recAt(f));
    const v = s.plan.camera.at(f);
    return { tip: toFrame(w, state, t), opacity: state.opacity, shape: state.shape, press: state.press, grow: Math.sqrt(v.zoom / (s.plan.camera.base ?? 1)) };
  };
  const recOf = (w: Which, t: number) => sideInfo(w).plan.map.recAt(clockOf(w, t));

  // The thing: the one given, else the tracked thing clicked, else a box round the click.
  const thingA: Rect | null =
    thingRect(tracksA, options.from, recA0) ?? (click ? thingAt(tracksA, click, click.t)?.rect ?? boxAround(click, 220, 44) : null);
  const thingBAt = (t: number): Rect | null => thingRect(tracksB, options.to, recOf('b', t)) ?? (thingA && typeof options.from !== 'string' ? thingA : thingRect(tracksB, options.from, recOf('b', t)) ?? thingA);

  // The pointer of A where the join starts: what the dives and reveals are centred on.
  const P = click || thingA ? (click ? ownPointer('a', t0).tip : centreOfRect(rectToFrame('a', thingA!, t0))) : { x: boxA.x + boxA.width / 2, y: boxA.y + boxA.height / 2 };

  // Zoom through: both shots grow about A's pointer, which rests on the thing it clicked, at one steady rate. B is
  // set off by `shiftAt` so that its clicked thing (or, without one, its pointer) lies exactly on A's all through
  // the dissolve; once A has gone, the offset eases away as B settles.
  // It is worked out each frame of the dissolve, as A's own camera may still be moving then.
  const shiftAt = (t: number): Point => {
    const thingB = thingA ? thingBAt(t) : null;
    const xa = thingA ? centreOfRect(rectToFrame('a', thingA, t)) : ownPointer('a', t).tip;
    const xb = thingB ? centreOfRect(rectToFrame('b', thingB, t)) : ownPointer('b', t).tip;
    return { x: P.x + ((xa.x - P.x) * OUT) / IN - xb.x, y: P.y + ((xa.y - P.y) * OUT) / IN - xb.y };
  };

  const vh = (n: number) => (n * frame.height) / 100;
  const W = frame.width;
  const H = frame.height;
  const uOf = (t: number) => clamp01((t - t0) / Math.max(1e-6, L));
  const span = (u: number, from: number, to: number) => clamp01((u - from) / (to - from));
  const perFrame = (f: (t: number) => number, t: number) => f(t + 0.5 / fps) - f(t - 0.5 / fps);

  // Scroll relay: one strip moving up (or down when the take was scrolling down), starting at the take's own speed.
  let relayDown = false;
  let relayStart = 0;
  if (name === 'scroll-relay' && tracksA?.frames.length) {
    const rows = tracksA.frames;
    const i = Math.max(1, Math.min(rows.length - 1, Math.round(recA0 * tracksA.fps)));
    const dy = (rows[i].scroll[1] - rows[i - 1].scroll[1]) * tracksA.fps; // page px a second, + is scrolling down
    relayDown = dy < 0;
    relayStart = Math.abs(dy) * (boxA.width / a.cursor.page.width) * viewA.zoom;
  }
  const relayDistance = Math.max(boxB.height + vh(6), (H + boxB.height) / 2 + vh(1));
  const relayM0 = Math.min(2.5, (relayStart * L) / relayDistance);
  const relayAt = (u: number) => relayM0 * (u * u * u - 2 * u * u + u) + (3 * u * u - 2 * u * u * u);

  // Push and whip: the two shots as one strip along the way the pointer went.
  const pushGap = vh(5);
  const pushDistance = (d.x !== 0 ? boxA.width : boxA.height) + pushGap;
  const whipDistance = (d.x !== 0 ? W : H) + pushGap;

  // Grid zoom: a 3 x 3 wall of screens at TILE of the shot's size; B is the neighbour the pointer was heading for.
  const TILE = 0.3;
  const gridPitch = { x: boxA.width * TILE + vh(2), y: boxA.height * TILE + vh(2) };
  const gridB = { x: d.x !== 0 ? -d.x : 0, y: d.y !== 0 ? -d.y : 0 };
  if (gridB.x === 0 && gridB.y === 0) gridB.x = 1;
  const gridAt = (u: number) => {
    const out = 0.42;
    if (u <= out) return { zoom: Math.exp(Math.log(1 / TILE) * (1 - easing.travel(u / out))), cx: 0, cy: 0 };
    const v = easing.travel((u - out) / (1 - out));
    return { zoom: Math.exp(Math.log(1 / TILE) * v), cx: gridB.x * gridPitch.x * v, cy: gridB.y * gridPitch.y * v };
  };
  const gridLayer = (box: Rect, cell: Point, u: number): Layer => {
    const g = gridAt(u);
    const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    return { ...identity(box), scale: g.zoom * TILE, tx: g.zoom * (cell.x * gridPitch.x - g.cx), ty: g.zoom * (cell.y * gridPitch.y - g.cy), ox: c.x, oy: c.y };
  };

  // Window split: the two halves, as CaptureShot's split lays them.
  const splitGap = vh(2.6);
  const splitWidth = Math.min((W * 0.92 - splitGap) / 2, H * 0.8 * ASPECT);
  const splitShift = (splitWidth + splitGap) / 2;

  // Stack shuffle: both shrink to MID as they pass, far enough apart that the one in front changes with no overlap.
  const MID = 0.68;
  const shuffle = boxA.width * MID * 0.53;

  // Cursor drag: B comes in from the side opposite the pointer's way, peeking first.
  const dragSide = d.x > 0 ? -1 : 1;
  const peek = vh(6);
  const dragOut = dragSide * (W / 2 + boxB.width / 2 + vh(2));
  const dragPeek = dragSide * (W / 2 + boxB.width / 2 - peek);
  const dragX = (t: number) => {
    if (t < t0) return dragOut;
    if (t < t0 + approach) return lerp(dragOut, dragPeek, easing.arrive(clamp01((t - t0) / approach)));
    return lerp(dragPeek, 0, easing.travel(clamp01((t - t0 - approach) / L)));
  };
  const grab: Point = { x: boxB.x + boxB.width / 2 + dragPeek - dragSide * (boxB.width / 2 - peek / 2), y: boxB.y + boxB.height * 0.5 };

  // ------------------------------------------------ the two layers at a moment

  const layer = (w: Which, t: number): Layer => {
    const box = w === 'a' ? boxA : boxB;
    const isA = w === 'a';
    if (spec.cut) {
      const cutFrame = Math.round(t0 * fps);
      const shown = isA ? Math.round(t * fps) < cutFrame : Math.round(t * fps) >= cutFrame;
      if (!shown) return hidden(box);
      if (!isA && name === 'snap-cut') {
        const f = (x: number) => 1 + 0.05 * (1 - easing.arrive(clamp01((x - t0) / tokenSeconds('quick', energy))));
        return { ...identity(box, 1), scale: f(t), blur: smearOf(perFrame(f, t) * (H / 2), W) };
      }
      return identity(box, isA ? 0 : 1);
    }
    if (t < t0) return isA ? identity(box) : hidden(box);
    const after = t >= t1;
    if (after && name !== 'window-split') return isA ? hidden(box) : identity(box, 1);
    const u = uOf(t);
    const l = identity(box, isA ? 0 : 1);
    switch (name) {
      case 'zoom-through': {
        const z = (x: number) => zTotal * easing.travel(uOf(x));
        const join = clamp01((t - bStart) / tick);
        if (isA) {
          if (t >= bStart + tick) return hidden(box);
          const s = (x: number) => Math.exp(z(x));
          return { ...l, scale: s(t), ox: P.x, oy: P.y, opacity: 1 - easing.travel(join), blur: smearOf(perFrame(s, t) * (H / 2), W) };
        }
        if (t < bStart) return hidden(box);
        const s = (x: number) => Math.exp(z(x) - zTotal);
        const settled = bStart + tick;
        const shift = shiftAt(Math.min(t, settled));
        const ease = 1 - easing.travel(clamp01((t - settled) / Math.max(1e-6, t1 - settled)));
        return { ...l, scale: s(t), ox: P.x, oy: P.y, tx: shift.x * ease * s(t), ty: shift.y * ease * s(t), opacity: easing.travel(join), blur: smearOf(perFrame(s, t) * (H / 2), W) };
      }
      case 'shared-element':
      case 'cross-dissolve':
        return isA ? l : { ...l, opacity: easing.travel(name === 'shared-element' ? span(u, 0.15, 0.8) : u) };
      case 'blur-dissolve': {
        const soft = vh(1.3);
        return isA ? { ...l, blur: soft * easing.travel(u) } : { ...l, opacity: easing.travel(u), blur: soft * (1 - easing.travel(u)) };
      }
      case 'container-grow': {
        if (isA) return { ...l, dim: 0.22 * easing.travel(u) };
        const from = thingA ? rectToFrame('a', thingA, t0) : boxB;
        const e = easing.travel(u);
        return { ...l, clip: { inset: lerpRect(from, boxB, e), round: e } };
      }
      case 'circle-reveal': {
        if (isA) return l;
        const far = Math.max(...[boxB.x, boxB.x + boxB.width].flatMap((x) => [boxB.y, boxB.y + boxB.height].map((y) => Math.hypot(x - P.x, y - P.y))));
        return { ...l, clip: { circle: { x: P.x, y: P.y, r: (far + 2) * easing.travel(u) } } };
      }
      case 'push':
      case 'whip': {
        const D = name === 'whip' ? whipDistance : pushDistance;
        const e = name === 'whip' ? whipEase : easing.travel;
        const off = (x: number) => D * e(uOf(x)) + (isA ? 0 : -D);
        const v = perFrame(off, t);
        return { ...l, tx: d.x * off(t), ty: d.y * off(t), mx: d.x * v, my: d.y * v };
      }
      case 'slide': {
        const s = W * 0.06;
        if (isA) {
          const off = (x: number) => s * easing.leave(uOf(x));
          return { ...l, tx: d.x * off(t), ty: d.y * off(t) };
        }
        const off = (x: number) => -s * (1 - easing.arrive(span(uOf(x), 0.15, 1)));
        return { ...l, tx: d.x * off(t), ty: d.y * off(t), opacity: easing.travel(span(u, 0.15, 0.75)) };
      }
      case 'depth-push': {
        if (isA) return { ...l, scale: lerp(1, 0.84, easing.travel(u)), dim: 0.3 * easing.travel(u), blur: vh(0.4) * easing.travel(u) };
        const s = (x: number) => lerp(0.9, 1, easing.arrive(span(uOf(x), 0.2, 1)));
        return { ...l, scale: s(t), opacity: easing.travel(span(u, 0.2, 0.65)) };
      }
      case 'card-flip': {
        const turn = 180 * easing.travel(u) * (d.x > 0 ? -1 : 1);
        const s = 1 - 0.1 * Math.sin(Math.PI * easing.travel(u));
        return { ...l, scale: s, turn: isA ? turn : turn - 180 * Math.sign(turn || 1), z: isA ? 1 - Math.round(u) : Math.round(u) };
      }
      case 'stack-shuffle': {
        const pass = Math.sin(Math.PI * easing.travel(u));
        const s = 1 - (1 - MID) * pass;
        const way = d.x > 0 ? 1 : -1;
        if (isA) return { ...l, scale: s * lerp(1, 0.94, easing.travel(span(u, 0.5, 1))), tx: way * -shuffle * pass, opacity: 1 - easing.travel(span(u, 0.55, 0.92)), dim: 0.08 * span(u, 0.5, 1), z: u < 0.5 ? 1 : 0 };
        return { ...l, scale: s * lerp(0.94, 1, easing.travel(span(u, 0, 0.5))), tx: way * shuffle * pass, opacity: easing.travel(span(u, 0, 0.2)), dim: 0.08 * (1 - span(u, 0, 0.5)), z: u < 0.5 ? 0 : 1 };
      }
      case 'grid-zoom':
        // Close in, the neighbours sit just inside the frame's edges: they come and go softly, never in one frame.
        return { ...gridLayer(box, isA ? { x: 0, y: 0 } : gridB, u), opacity: isA ? 1 - easing.travel(span(u, 0.75, 1)) : easing.travel(span(u, 0, 0.25)) };
      case 'scroll-relay': {
        const sign = relayDown ? 1 : -1;
        const off = (x: number) => sign * relayDistance * relayAt(uOf(x)) + (isA ? 0 : -sign * relayDistance);
        const v = perFrame(off, t);
        return { ...l, ty: off(t), my: v };
      }
      case 'cursor-drag': {
        if (isA) return { ...l, dim: 0.18 * easing.travel(clamp01((t - t0 - approach) / L)), scale: lerp(1, 0.97, easing.travel(clamp01((t - t0 - approach) / L))) };
        const v = perFrame(dragX, t);
        return { ...l, tx: dragX(t), mx: v };
      }
      case 'window-split': {
        const e = easing.travel(u);
        const small = splitWidth / boxA.width;
        if (isA) return { ...l, scale: lerp(1, small, e), tx: -splitShift * e, z: 1 };
        const eb = easing.travel(span(u, 0.12, 1));
        return { ...l, scale: small * (boxA.width / boxB.width), tx: lerp(-splitShift * e, splitShift, eb), opacity: easing.travel(span(u, 0.05, 0.35)), z: 0 };
      }
      case 'device-swap': {
        if (isA) return { ...l, tx: -W * 0.28 * easing.leave(u), scale: lerp(1, 0.92, easing.travel(u)), opacity: 1 - easing.travel(span(u, 0.15, 0.7)) };
        return { ...l, tx: W * 0.28 * (1 - easing.arrive(span(u, 0.15, 1))), opacity: easing.travel(span(u, 0.2, 0.65)) };
      }
      default:
        return isA ? hidden(box) : l;
    }
  };

  // ------------------------------------------------ the one pointer across the join

  /** Does shot A (or B) draw its own pointer at this moment? Not while the join draws one for both. */
  const drawsOwn = (_w: Which, t: number) => {
    if (pointerMode === 'cut' || pointerMode === 'own') return true;
    return t < t0 || t >= t1;
  };

  const pointers = (t: number): PointerDraw[] => {
    if (drawsOwn('a', t) && drawsOwn('b', t)) return [];
    const pa = ownPointer('a', t);
    const la = layer('a', t);
    const A: PointerDraw = { ...pa, tip: throughLayer(la, pa.tip) };
    const showsB = t >= bStart;
    const pb = showsB ? ownPointer('b', t) : null;
    const lb = layer('b', t);
    const B: PointerDraw | null = pb ? { ...pb, tip: throughLayer(lb, pb.tip) } : null;
    if (pointerMode === 'fade') {
      const u = uOf(t);
      const out: PointerDraw[] = [];
      if (u < 0.35) out.push({ ...A, opacity: A.opacity * (1 - easing.travel(u / 0.35)) });
      if (B && u > 0.65) out.push({ ...B, opacity: B.opacity * easing.travel((u - 0.65) / 0.35) });
      return out;
    }
    if (pointerMode === 'drag') {
      const grabbed = { x: grab.x + (dragX(t) - dragPeek), y: grab.y };
      if (t < t0 + approach) {
        const u = easing.travel(clamp01((t - t0) / approach));
        const tip = { x: lerp(pa.tip.x, grab.x, u), y: lerp(pa.tip.y, grab.y, u) - Math.sin(Math.PI * u) * vh(4) };
        const press = easing.travel(clamp01((t - (t0 + approach - 0.1)) / 0.1));
        return [{ tip, opacity: Math.max(pa.opacity, u), shape: u > 0.6 ? 'hand' : 'arrow', press, grow: 1 }];
      }
      if (t < t0 + approach + L) return [{ tip: grabbed, opacity: 1, shape: 'hand', press: 1, grow: 1 }];
      const u = easing.travel(clamp01((t - t0 - approach - L) / settleBack));
      const to = B ?? { tip: grabbed, opacity: 1, shape: 'arrow' as CursorShape, press: 0, grow: 1 };
      return [{ tip: lerpPoint(grabbed, to.tip, u), opacity: lerp(1, to.opacity, u), shape: u < 0.3 ? 'hand' : to.shape, press: 1 - easing.travel(clamp01(u / 0.3)), grow: lerp(1, to.grow, u) }];
    }
    // carry: from A's pointer to B's, as the join goes (in a zoom through, as the one shot dissolves into the other).
    if (!B) return [A];
    const w = name === 'zoom-through' ? easing.travel(clamp01((t - bStart) / tick)) : easing.travel(uOf(t));
    return [{ tip: lerpPoint(A.tip, B.tip, w), opacity: lerp(A.opacity, B.opacity, w), shape: w < 0.5 ? A.shape : B.shape, press: A.press * (1 - w), grow: lerp(A.grow, B.grow, w) }];
  };

  // ------------------------------------------------ pieces of real pixels: the flying thing, the container's face

  const pieces = (t: number): Piece[] => {
    if (t < t0 || t >= t1) return [];
    const u = uOf(t);
    if (name === 'shared-element' && thingA) {
      const startRect = rectToFrame('a', thingA, t0);
      const toPage = thingBAt(t) ?? thingA;
      const endRect = rectThroughLayer(layer('b', t), rectToFrame('b', toPage, t));
      const place = easing.travel(u);
      const sized = easing.travel(span(u, 0.08, 1));
      // Along a shallow arc, like every flying thing (motion.ts, arc): the bow is a tenth of the distance.
      const ca = centreOfRect(startRect);
      const cb = centreOfRect(endRect);
      const bend = 0.1;
      const ctrl = { x: (ca.x + cb.x) / 2 - (cb.y - ca.y) * bend * 2, y: (ca.y + cb.y) / 2 + (cb.x - ca.x) * bend * 2 };
      const v = 1 - place;
      const c = { x: v * v * ca.x + 2 * v * place * ctrl.x + place * place * cb.x, y: v * v * ca.y + 2 * v * place * ctrl.y + place * place * cb.y };
      const wdt = lerp(startRect.width, endRect.width, sized);
      const hgt = lerp(startRect.height, endRect.height, sized);
      const dst = { x: c.x - wdt / 2, y: c.y - hgt / 2, width: wdt, height: hgt };
      const lift = Math.sin(Math.PI * place);
      const change = 0.1;
      return [
        { which: 'a', page: thingA, rec: recA0, dst, opacity: 1 - clamp01((sized - (0.5 - change)) / change), lift },
        { which: 'b', page: toPage, rec: recOf('b', t), dst, opacity: clamp01((sized - 0.5) / change), lift },
      ];
    }
    if (name === 'container-grow' && thingA) {
      const face = rectToFrame('a', thingA, t0);
      const grown = lerpRect(face, boxB, easing.travel(u));
      const dst = { x: grown.x + (grown.width - face.width) / 2, y: grown.y + (grown.height - face.height) / 2, width: face.width, height: face.height };
      return [{ which: 'a', page: thingA, rec: recA0, dst, opacity: 1 - easing.travel(clamp01(u / 0.3)), lift: 0 }];
    }
    return [];
  };

  /**
   * Container grow: how much of B's picture shows inside the growing container. It comes in from a fifth of the way
   * to a little past half (laid out at full size from the start, so it is cropped, never stretched): a container
   * left blank for longer reads as an empty white panel.
   */
  const containerContent = (t: number) => (name === 'container-grow' && t < t1 ? easing.travel(clamp01((uOf(t) - 0.2) / 0.35)) : 1);

  /** Grid zoom: the other screens of the wall, stills of real moments of the two takes. */
  const marksA = a.cursor.events.filter((e) => e.type === 'mark').map((e) => e.t);
  const marksB = b.cursor.events.filter((e) => e.type === 'mark').map((e) => e.t);
  const moments: { which: Which; rec: number }[] = [...marksB.map((rec) => ({ which: 'b' as Which, rec })), ...marksA.map((rec) => ({ which: 'a' as Which, rec }))];
  if (!moments.length) moments.push({ which: 'a', rec: recA0 }, { which: 'b', rec: b.from ?? 0 });
  const tiles = (t: number): Tile[] => {
    if (name !== 'grid-zoom' || t < t0 || t >= t1) return [];
    const u = uOf(t);
    const out: Tile[] = [];
    let n = 0;
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        if ((i === 0 && j === 0) || (i === gridB.x && j === gridB.y)) continue;
        const l = gridLayer(boxA, { x: i, y: j }, u);
        const dst = rectThroughLayer(l, boxA);
        n += 1;
        if (dst.x > W || dst.y > H || dst.x + dst.width < 0 || dst.y + dst.height < 0) continue;
        const m = moments[(n * 2 + Math.abs(i * 3 + j)) % moments.length];
        out.push({ which: m.which, rec: m.rec, dst, opacity: Math.min(easing.travel(span(u, 0, 0.25)), 1 - easing.travel(span(u, 0.75, 1))) });
      }
    }
    return out;
  };

  /** Film times of the changes meant to happen in one frame, for tools/checks/smoothness.py. */
  const plannedCuts = spec.cut ? [t0] : [];

  return {
    name,
    asked,
    note: name !== asked ? `"${asked}" is for hype films only; this ${energy} film uses "${name}".` : null,
    energy,
    length: L,
    approach,
    settleBack,
    t0,
    t1,
    swap,
    bStart,
    total,
    durA,
    durB,
    direction,
    click,
    thingA,
    thingBAt,
    stagingA,
    stagingB,
    boxA,
    boxB,
    pointerMode,
    aSource,
    bSource,
    planA,
    planB,
    layer,
    drawsOwn,
    pointers,
    ownPointer,
    toFrame,
    rectToFrame,
    pieces,
    containerContent,
    tiles,
    plannedCuts,
  };
};

// ---------------------------------------------------------------- splitting one take at a click

/**
 * Two parts of one take, for a join at a click that opens the next page: A plays up to the moment the button comes
 * up (the page starts to change a few frames later), B from the moment the new page has settled. The click is the
 * n-th (1 is the first), else the first click that is followed by a wait, else the last click.
 */
export const splitAtClick = (source: JoinSource, n?: number): { a: JoinSource; b: JoinSource } | null => {
  const clicks = clicksOf(source.cursor);
  if (!clicks.length) return null;
  const events = source.cursor.events;
  const waitAfter = (t: number) => events.find((e) => e.type === 'wait' && e.t >= t && e.t - t < 1.5);
  const click = n ? clicks[n - 1] : clicks.find((c) => waitAfter(c.t)) ?? clicks[clicks.length - 1];
  if (!click) return null;
  const up = click.up ?? click.t + 0.08;
  const wait = waitAfter(click.t);
  // The page starts to change a few frames after the button comes up: A stops just before.
  const aTo = Math.min(wait ? wait.t - 0.02 : up + 0.03, up + 0.03);
  const bFrom = wait?.end !== undefined ? wait.end : up + 0.05;
  return { a: { ...source, to: aTo }, b: { ...source, from: bFrom } };
};
