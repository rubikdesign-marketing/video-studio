// Shapes as outlines of the same number of points, so any shape can become any other: ShapeMorph, MorphChain,
// Carrier and Flood all draw through these. Every outline starts at the top centre and runs clockwise, and the
// count divides by 4, 5, 6, 8, 10 and 12, so the corners of a square, a pentagon or a five-pointed star land on a
// point of their own and stay sharp through a morph. Pure functions: no colour, length or typeface lives here.
import { interpolateColors, spring, useVideoConfig } from 'remotion';
import { clamp01, lerp, springs, useMotion, type Point } from '../motion';
import type { StagePalette } from '../tokens';
import type { Rect } from './core';

/** Points in every outline. */
export const OUTLINE_POINTS = 120;

/**
 * A shape in a box. `rect` is in pixels of the frame.
 * - square, circle: the largest that fits the box, centred in it.
 * - rect: the box with corners of `radius` pixels (0 is sharp).
 * - pill: the box with fully round ends. A thin pill is a line.
 * - polygon: `sides` corners on the circle that fits the box, one at the top.
 * - star: `points` tips (5 by default), the inner corners at `inner` of the radius.
 * - path: any closed SVG path in its own units, fitted into the box. Browser only (it is measured on an SVG path).
 */
export type Shape =
  | { kind: 'square' | 'circle' | 'pill'; rect: Rect }
  | { kind: 'rect'; rect: Rect; radius?: number }
  | { kind: 'polygon'; rect: Rect; sides: number }
  | { kind: 'star'; rect: Rect; points?: number; inner?: number }
  | { kind: 'path'; rect: Rect; d: string };

/** The stage colours a shape can be filled with. */
export type FillRole = keyof Pick<StagePalette, 'ink' | 'second' | 'accent' | 'warm' | 'soft' | 'line' | 'page'>;

/** The text colour that reads on a fill. */
export const onFill = (stage: StagePalette, fill: FillRole) =>
  fill === 'ink' ? stage.onInk : fill === 'accent' || fill === 'warm' ? stage.onAccent : stage.ink;

const centre = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

/** Evenly spaced points along a closed polyline, by arc length, starting at its first point. */
const resample = (corners: Point[], n = OUTLINE_POINTS): Point[] => {
  const closed = [...corners, corners[0]];
  const lengths = closed.slice(1).map((p, i) => Math.hypot(p.x - closed[i].x, p.y - closed[i].y));
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total === 0) return Array.from({ length: n }, () => ({ ...corners[0] }));
  const out: Point[] = [];
  let seg = 0;
  let walked = 0;
  for (let i = 0; i < n; i++) {
    const want = (i / n) * total;
    while (seg < lengths.length - 1 && walked + lengths[seg] < want - 1e-9) walked += lengths[seg++];
    const u = lengths[seg] === 0 ? 0 : (want - walked) / lengths[seg];
    out.push({ x: lerp(closed[seg].x, closed[seg + 1].x, u), y: lerp(closed[seg].y, closed[seg + 1].y, u) });
  }
  return out;
};

/** A rounded box traced finely enough to resample, from the top centre, clockwise. */
const roundedBox = (r: Rect, radius: number): Point[] => {
  const k = Math.max(0, Math.min(radius, r.width / 2, r.height / 2));
  const [x0, y0, x1, y1] = [r.x, r.y, r.x + r.width, r.y + r.height];
  const pts: Point[] = [{ x: (x0 + x1) / 2, y: y0 }];
  const corner = (cx: number, cy: number, from: number) => {
    for (let s = 0; s <= 24; s++) {
      const a = from + (s / 24) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * k, y: cy + Math.sin(a) * k });
    }
  };
  if (k === 0) {
    pts.push({ x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 });
    return pts;
  }
  corner(x1 - k, y0 + k, -Math.PI / 2);
  corner(x1 - k, y1 - k, 0);
  corner(x0 + k, y1 - k, Math.PI / 2);
  corner(x0 + k, y0 + k, Math.PI);
  return pts;
};

/** Corners of a regular polygon or star, the first at the top, clockwise. */
const radial = (c: Point, radii: number[], count: number): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i / count) * Math.PI * 2;
    const r = radii[i % radii.length];
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });

/** Points along any SVG path, measured in the browser, fitted into the box with its proportions kept. */
const pathPoints = (d: string, r: Rect, n: number): Point[] => {
  if (typeof document === 'undefined') throw new Error('A path shape is measured in the browser: render it, do not plan with it.');
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', d);
  const total = el.getTotalLength();
  const raw = Array.from({ length: n }, (_, i) => el.getPointAtLength((i / n) * total));
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const [w, h] = [Math.max(...xs) - minX || 1, Math.max(...ys) - minY || 1];
  const s = Math.min(r.width / w, r.height / h);
  const [ox, oy] = [r.x + (r.width - w * s) / 2, r.y + (r.height - h * s) / 2];
  const fitted = raw.map((p) => ({ x: ox + (p.x - minX) * s, y: oy + (p.y - minY) * s }));
  // Start at the point nearest the top centre and run clockwise, like every other outline.
  return canonical(fitted, centre(r));
};

/** Signed area: positive for clockwise on screen (y runs down). */
const area = (pts: Point[]) => pts.reduce((sum, p, i) => sum + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0) / 2;

/** Clockwise, starting at the point nearest straight above `c`. */
const canonical = (pts: Point[], c: Point): Point[] => {
  const cw = area(pts) >= 0 ? pts : [...pts].reverse();
  let best = 0;
  let bestScore = Infinity;
  cw.forEach((p, i) => {
    const score = Math.abs(Math.atan2(p.x - c.x, c.y - p.y));
    if (score < bestScore) [best, bestScore] = [i, score];
  });
  return [...cw.slice(best), ...cw.slice(0, best)];
};

const outlineCache = new Map<string, Point[]>();

/** The shape as OUTLINE_POINTS points, clockwise from the top centre. */
export const outline = (shape: Shape): Point[] => {
  const key = JSON.stringify(shape);
  const hit = outlineCache.get(key);
  if (hit) return hit;
  const r = shape.rect;
  const c = centre(r);
  const side = Math.min(r.width, r.height);
  const fit: Rect = { x: c.x - side / 2, y: c.y - side / 2, width: side, height: side };
  let pts: Point[];
  switch (shape.kind) {
    case 'square':
      pts = resample(roundedBox(fit, 0));
      break;
    case 'circle':
      pts = radial(c, [side / 2], OUTLINE_POINTS);
      break;
    case 'pill':
      pts = resample(roundedBox(r, Math.min(r.width, r.height) / 2));
      break;
    case 'rect':
      pts = resample(roundedBox(r, shape.radius ?? 0));
      break;
    case 'polygon':
      pts = resample(radial(c, [side / 2], Math.max(3, Math.round(shape.sides))));
      break;
    case 'star': {
      const tips = Math.max(3, Math.round(shape.points ?? 5));
      pts = resample(radial(c, [side / 2, (side / 2) * (shape.inner ?? 0.45)], tips * 2));
      break;
    }
    case 'path':
      pts = pathPoints(shape.d, r, OUTLINE_POINTS);
      break;
  }
  outlineCache.set(key, pts);
  return pts;
};

/** The outline shifted so its points line up with `target` point for point: the least total travel. */
export const alignTo = (pts: Point[], target: Point[]): Point[] => {
  const n = pts.length;
  let best = 0;
  let bestCost = Infinity;
  for (let shift = 0; shift < n; shift += 1) {
    let cost = 0;
    for (let i = 0; i < n; i += 4) {
      const p = pts[(i + shift) % n];
      cost += (p.x - target[i].x) ** 2 + (p.y - target[i].y) ** 2;
    }
    if (cost < bestCost) [best, bestCost] = [shift, cost];
  }
  return best === 0 ? pts : [...pts.slice(best), ...pts.slice(0, best)];
};

/** Point by point between two outlines of the same length. */
export const blend = (a: Point[], b: Point[], u: number): Point[] => a.map((p, i) => ({ x: lerp(p.x, b[i].x, u), y: lerp(p.y, b[i].y, u) }));

/** Moves an outline by an offset. */
export const shift = (pts: Point[], by: Point): Point[] => pts.map((p) => ({ x: p.x + by.x, y: p.y + by.y }));

/** The middle of an outline's bounding box. */
export const middleOf = (pts: Point[]): Point => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
};

/** An SVG path through the outline, closed. */
export const pathOf = (pts: Point[]) => `M ${pts.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`;

/** A colour part way between two colours (both from the brand's stage). */
export const mixColour = (from: string, to: string, u: number) => (from === to ? to : interpolateColors(clamp01(u), [0, 1], [from, to]));

/** Colour between two stage roles. */
export const mixFill = (stage: StagePalette, from: FillRole, to: FillRole, u: number) => mixColour(stage[from], stage[to], u);

// ---------------------------------------------------------------- snaps: springs with almost no overshoot

/**
 * The most a snap overshoots: liked product films keep overshoot under 2% and the morph reads as a quick ease-out,
 * never a bounce (knowledge/craft/17-motion-graphics.md). A calm preset has none at all.
 */
export const SNAP_OVERSHOOT = 0.015;

/**
 * A spring 0 to 1 that starts at `at` and settles in `seconds` (both on the scene clock), overshooting by no more
 * than SNAP_OVERSHOOT. Remotion's own spring, stretched to the length given, so every frame renders on its own.
 */
export const useSnap = () => {
  const m = useMotion();
  const { fps } = useVideoConfig();
  const config = springs.settle({ ...m.preset, overshoot: Math.min(m.preset.overshoot, SNAP_OVERSHOOT) });
  const length = (seconds: number) => Math.max(1, Math.round(seconds * fps));
  const at = (t: number, start: number, seconds: number) =>
    t < start ? 0 : spring({ frame: (t - start) * fps, fps, config, durationInFrames: length(seconds) });
  // `scale` is the preset's length multiplier, for moves that keep a measured length in seconds: calm runs a
  // quarter longer, hype a little shorter, and confident keeps the measured length.
  return { snap: (start: number, seconds: number) => at(m.t, start, seconds), snapAt: at, scale: m.preset.length };
};

/**
 * A value that springs to each new target in turn. The springs are summed, so a target set before the last spring
 * has settled carries on from wherever the value is: it never jumps. `snapAt` comes from useSnap.
 */
export const summed = (
  snapAt: (t: number, start: number, seconds: number) => number,
  t: number,
  keys: { at: number; value: number }[],
  seconds: number,
) => keys.reduce((v, key, i) => (i === 0 ? key.value : v + (key.value - keys[i - 1].value) * snapAt(t, key.at, seconds)), 0);
