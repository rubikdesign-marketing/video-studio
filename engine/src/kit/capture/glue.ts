// Glue between the recording and what the engine draws over it (CAPTURE-PLAN 7.4 and 7.9, "Animations on the
// product"). Every product animation takes its place from one function here, `anchorOf`: the tracked rectangle at the
// recording moment on screen, through the same camera the picture uses. So a ring, a lift or a privacy blur stays on
// the real thing while the page scrolls and the camera moves. Pure: no React, no Remotion, so the checks can measure it.
//
// Places are page pixels of the recorded window; region pixels are the clip's own box in the frame, before the
// screen is turned. Times: `rec` is the recording's clock, `f` the clip's (film) clock.
import { clamp01, type Point } from '../motion';
import type { CameraState } from './camera';
import { centreOfRect, rectAt, type CaptureCursor, type CaptureTracks, type Rect, type TrackRow } from './data';

// ---------------------------------------------------------------- fixed things, for takes without tracks

/**
 * A thing with a known place, for a take that tracked nothing (or to add one more): `[x, y, width, height]` in page
 * pixels, on the page from `from` to `to` seconds of the recording. It moves with the page's scroll from the moment
 * it is given (unless `scrolls` is false, for a fixed bar). Measure it from a mark's still.
 */
export type FixedThing = { rect: [number, number, number, number]; from?: number; to?: number; scrolls?: boolean };

const withCache = new WeakMap<object, Map<string, CaptureTracks>>();
const NO_TRACKS = {};

/** The tracks with fixed things added, as if the capture had tracked them. Made once per set of things. */
export const withThings = (cursor: CaptureCursor, tracks: CaptureTracks | undefined, things: Record<string, FixedThing> | undefined): CaptureTracks | undefined => {
  if (!things || !Object.keys(things).length) return tracks;
  const key = JSON.stringify(things);
  const owner = tracks ?? cursor ?? NO_TRACKS;
  let known = withCache.get(owner);
  if (!known) withCache.set(owner, (known = new Map()));
  const hit = known.get(key);
  if (hit) return hit;
  const fps = tracks?.fps ?? 60;
  const count = tracks?.frames.length ?? Math.ceil(cursor.seconds * fps) + 1;
  const base: TrackRow[] = tracks?.frames ?? Array.from({ length: count }, (_, i) => ({ t: i / fps, scroll: [0, 0], page: [cursor.page.width, cursor.page.height], at: {} }));
  const startScroll = (from: number): [number, number] => base[Math.max(0, Math.min(base.length - 1, Math.round(from * fps)))].scroll;
  const frames = base.map((row) => {
    const at = { ...row.at };
    for (const [name, thing] of Object.entries(things)) {
      const from = thing.from ?? 0;
      const to = thing.to ?? Infinity;
      if (row.t < from || row.t > to) {
        if (!(name in at)) at[name] = null;
        continue;
      }
      const s0 = thing.scrolls === false ? row.scroll : startScroll(from);
      const [x, y, w, h] = thing.rect;
      at[name] = [x - (row.scroll[0] - s0[0]), y - (row.scroll[1] - s0[1]), w, h];
    }
    return { ...row, at };
  });
  const made: CaptureTracks = { fps, seconds: tracks?.seconds ?? cursor.seconds, things: { ...(tracks?.things ?? {}), ...Object.fromEntries(Object.keys(things).map((n) => [n, { found_by: 'given' }])) }, frames };
  known.set(key, made);
  return made;
};

// ---------------------------------------------------------------- where the picture really was

/** seen.json (tools/film/seen_scroll.mjs): the scroll the picture really showed, per recording frame, during scrolls. */
export type CaptureSeen = { tracks_frames: number; tracks_seconds: number; scroll: Record<string, [number, number]> };

const seenCache = new WeakMap<object, CaptureTracks>();

/**
 * The tracks moved to where the picture shows things: the page is measured a frame or a few before its picture
 * arrives, unevenly, so during a scroll every thing that moves with the page is put where the recording shows it
 * (seen.json). Things that stay put while the page scrolls (a fixed bar, a toast) are left alone. A seen.json made for
 * other tracks (an older take) is ignored.
 */
export const seenTracks = (tracks: CaptureTracks | undefined, seen: CaptureSeen | null | undefined): CaptureTracks | undefined => {
  if (!tracks || !seen || seen.tracks_frames !== tracks.frames.length || Math.abs(seen.tracks_seconds - tracks.seconds) > 1e-3) return tracks;
  const known = seenCache.get(tracks);
  if (known) return known;
  // A thing scrolls with the page when, frame to frame, it moves by the scroll's change.
  const follows: Record<string, { yes: number; no: number }> = {};
  const rows = tracks.frames;
  for (let i = 1; i < rows.length; i++) {
    const ds = rows[i].scroll[1] - rows[i - 1].scroll[1];
    if (Math.abs(ds) < 1) continue;
    for (const [name, box] of Object.entries(rows[i].at)) {
      const before = rows[i - 1].at[name];
      if (!box || !before) continue;
      const f = (follows[name] ??= { yes: 0, no: 0 });
      if (Math.abs(box[1] - before[1] + ds) < 1.5) f.yes += 1;
      else if (Math.abs(box[1] - before[1]) < 0.5) f.no += 1;
    }
  }
  const scrolls = (name: string) => (follows[name] ? follows[name].yes >= follows[name].no : true);
  // The scroll column of tracks.json is read a moment apart from the things' places while the page moves, so each
  // thing is placed from the still frame just before its scroll: its place there, moved by how far the picture has
  // scrolled since.
  let still = 0;
  const frames = rows.map((row, i) => {
    const s = seen.scroll[String(i)];
    if (!s) {
      still = i;
      return row;
    }
    const ref = rows[still];
    const dx = ref.scroll[0] - s[0];
    const dy = ref.scroll[1] - s[1];
    const at: TrackRow['at'] = {};
    for (const [name, box] of Object.entries(row.at)) {
      const before = ref.at[name];
      at[name] = box && before && scrolls(name) ? [before[0] + dx, before[1] + dy, box[2], box[3]] : box;
    }
    return { ...row, scroll: s, at };
  });
  const made = { ...tracks, frames };
  seenCache.set(tracks, made);
  return made;
};

// ---------------------------------------------------------------- from the page to the clip's region

/** How the page sits in the clip's region at one moment: the camera's view, the region's size, page-to-region scale. */
export type RegionView = { cx: number; cy: number; zoom: number; k: number; width: number; height: number };

export const regionView = (view: Pick<CameraState, 'cx' | 'cy' | 'zoom'>, k: number, width: number, height: number): RegionView => ({ cx: view.cx, cy: view.cy, zoom: view.zoom, k, width, height });

/** A page point in region pixels. This is the transform the picture is drawn with. */
export const pointToRegion = (v: RegionView, p: Point): Point => ({ x: (p.x - v.cx) * v.zoom * v.k + v.width / 2, y: (p.y - v.cy) * v.zoom * v.k + v.height / 2 });

/** A page rectangle in region pixels. */
export const rectToRegion = (v: RegionView, r: Rect): Rect => {
  const a = pointToRegion(v, r);
  return { x: a.x, y: a.y, width: r.width * v.zoom * v.k, height: r.height * v.zoom * v.k };
};

// ---------------------------------------------------------------- targets

/**
 * What an animation is glued to: a tracked thing by name, a rectangle of the page (page pixels, for a still page),
 * or a point (a small box around it, for a click on something untracked).
 */
export type GlueTarget = string | { thing: string } | { rect: Rect } | (Point & { size?: number });

/** The page rectangle of a target at `rec` seconds of the recording, or null when the thing is not on the page. */
export const targetRect = (tracks: CaptureTracks | undefined, target: GlueTarget, rec: number): Rect | null => {
  if (typeof target === 'string') return rectAt(tracks, target, rec);
  if ('thing' in target) return rectAt(tracks, target.thing, rec);
  if ('rect' in target) return target.rect;
  const size = target.size ?? 40;
  return { x: target.x - size / 2, y: target.y - size / 2, width: size, height: size };
};

/** The name of a tracked target, for messages. */
export const targetName = (target: GlueTarget) => (typeof target === 'string' ? target : 'thing' in target ? target.thing : 'rect' in target ? 'a page rectangle' : 'a point');

/**
 * The one place every product animation is drawn from: the target's tracked rectangle at the recording moment on
 * screen, in region pixels through the camera the picture uses. Null while the thing is off the page.
 */
export const anchorOf = (tracks: CaptureTracks | undefined, target: GlueTarget, rec: number, v: RegionView): Rect | null => {
  const r = targetRect(tracks, target, rec);
  return r ? rectToRegion(v, r) : null;
};

export const centreOf = centreOfRect;

/** The part of a box inside the region, or null when none is. */
export const visiblePart = (box: Rect, width: number, height: number): Rect | null => {
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(width, box.x + box.width);
  const y1 = Math.min(height, box.y + box.height);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
};

// ---------------------------------------------------------------- product animations

export const emphasisKinds = [
  'lift',
  'isolate',
  'fly-out',
  'focus',
  'outline',
  'underline',
  'ring',
  'sweep',
  'magnifier',
  'callout',
  'arrow',
  'connect',
  'steps',
  'retype',
  'toast',
  'success',
  'blur-reveal',
  'privacy',
] as const;
export type EmphasisKind = (typeof emphasisKinds)[number];

/**
 * One animation on the product. `at` and `out` are seconds on the clip's clock (the film's), like every other cue.
 * Real-content rule: the kinds that move or enlarge the thing (lift, isolate, fly out, magnifier, toast, retype,
 * blur reveal, privacy) show the recording's own pixels at the tracked rectangle, never a redrawing; the engine
 * draws no text or number the capture does not have. A callout's words are the film's, like a caption.
 */
export type Emphasis = {
  kind: EmphasisKind;
  /** What it is glued to. Arrow and connection line: where they start. */
  target: GlueTarget;
  /** Arrow and connection line: where they end. */
  to?: GlueTarget;
  at: number;
  /** When it goes. Default: it stays to the clip's end (privacy, steps), or a beat (the rest). */
  out?: number;
  /** Callout: the short label, sentence case, a few words. */
  label?: string;
  /** Callout: which side of the thing the label sits on. Default above, or below near the top edge. */
  side?: 'above' | 'below' | 'left' | 'right';
  /** Step badges: the number. Default: the order among the clip's step badges. */
  number?: number;
  /** Success moment: a drawn check (default) or confetti. */
  style?: 'check' | 'confetti';
  /** Magnifier: how much it enlarges (at most what the recording's sharpness allows). Default 1.8. */
  zoom?: number;
  /** Typed again: which typing of the recording (1 is the first; default the one into this thing), and its speed. */
  typing?: number;
  speed?: number;
  /** Page pixels of the thing's own corner radius, for the lifted layer. Default 8. */
  radius?: number;
};

/** Kinds that are not "the" emphasis of a beat: they mark or hide, and may sit next to one emphasis. */
export const besideEmphasis: EmphasisKind[] = ['privacy', 'steps', 'toast', 'retype'];

/** How long an emphasis holds when no `out` is given, in seconds (before the energy's length). */
export const BEAT_SECONDS = 2.4;

export const outOf = (e: Emphasis, clipSeconds: number) => e.out ?? (e.kind === 'privacy' || e.kind === 'steps' ? clipSeconds + 1 : e.at + BEAT_SECONDS);

/**
 * Pairs of emphases on screen at the same time (craft file 05: one per beat; two cancel out). Privacy blurs, step
 * badges, toast pops and typing again are left out: they sit next to the one emphasis.
 */
export const emphasisClashes = (list: Emphasis[], clipSeconds: number): [number, number][] => {
  const out: [number, number][] = [];
  const main = list.map((e, i) => ({ e, i })).filter(({ e }) => !besideEmphasis.includes(e.kind));
  for (let a = 0; a < main.length; a++)
    for (let b = a + 1; b < main.length; b++) {
      const [x, y] = [main[a].e, main[b].e];
      if (x.at < outOf(y, clipSeconds) && y.at < outOf(x, clipSeconds)) out.push([main[a].i, main[b].i]);
    }
  return out;
};

/** 0 to 1: how far an emphasis is in, from its cue in `enter` seconds, and out over `leave` seconds from `out`. */
export const amountOf = (f: number, at: number, out: number, enter: number, leave: number, ease: (x: number) => number, easeOut: (x: number) => number) =>
  ease(clamp01((f - at) / enter)) * (1 - easeOut(clamp01((f - out) / leave)));
