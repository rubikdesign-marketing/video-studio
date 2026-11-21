// The motion library's standalone scenes (demos/ and the sized families) keep their cues inside their code, so their
// timing is measured: one render of every scene back to back (the "style-scene-reel" composition), scanned with
// ffmpeg the way the visual check scans the preview clips. These are the pure parts: the scene list, the reel's
// layout, reading ffmpeg's per-frame metadata and turning it into each scene's timing.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MOTION_DIR = join(STUDIO, 'engine', 'src', 'library', 'motion');
/** The folders whose scenes lay themselves out for every size (sized.tsx); demos/ is made for 16:9. */
export const SIZED_DIRS = ['text', 'transitions', 'openers', 'shaders', 'ugc'];

/** A frame with less edge than this (ffmpeg edgedetect=low=0.05:high=0.15, YAVG) has nothing drawn on it. */
export const EMPTY_EDGE = 0.3;
/** ...unless it differs from the empty page by at least this much (mean, 0 to 255): a flat colour is not an empty page. */
export const PAGE_SAME = 6;
/** A scene is built at the first frame with this share of its peak edge (its peak over its first 2.5 s). */
export const BUILT_SHARE = 0.8;
const PEAK_WINDOW_S = 2.5;
/** A change smaller than this (mean frame difference, 0 to 255) is no cue. */
export const CUE_MIN = 1.5;
/** The families whose scene has one change worth landing on: a transition, a camera move, a control switching. */
export const CUE_FAMILIES = new Set(['transition', 'camera', 'ui']);

/** The scenes: `{ name, seconds, sized }` in the order their lists give them (demos first, then the sized families). */
export function sceneList(motionDir = MOTION_DIR) {
  const out = [];
  const seen = new Set();
  const read = (dir, sized) => {
    for (const f of readdirSync(join(motionDir, dir)).sort()) {
      if (!/\.tsx?$/.test(f)) continue;
      const text = readFileSync(join(motionDir, dir, f), 'utf8');
      for (const m of text.matchAll(/\{\s*name:\s*'([a-z0-9-]+)',\s*title:\s*(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"),\s*seconds:\s*([\d.]+)/g)) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        out.push({ name: m[1], seconds: Number(m[2]), sized });
      }
    }
  };
  read('demos', false);
  for (const d of SIZED_DIRS) read(d, true);
  return out;
}

/** Where each scene sits in the reel: `{ name, from, frames }`, after `leadSeconds` of empty page. */
export function reelOffsets(list, fps, leadSeconds) {
  let at = Math.round(leadSeconds * fps);
  return list.map((s) => {
    const frames = Math.round(s.seconds * fps);
    const row = { name: s.name, from: at, frames };
    at += frames;
    return row;
  });
}

/** One value per frame for `key` from ffmpeg's metadata=print output (null where the frame has none). */
export function parseMetadata(text, key) {
  const values = [];
  let frame = -1;
  for (const line of String(text).split('\n')) {
    const f = /^frame:(\d+)/.exec(line);
    if (f) { frame = Number(f[1]); values[frame] = null; continue; }
    const eq = line.indexOf('=');
    if (frame >= 0 && eq > 0 && line.slice(0, eq).trim() === key) values[frame] = Number(line.slice(eq + 1));
  }
  return Array.from(values, (v) => (v === undefined ? null : v));
}

/**
 * The box of what has edges in each frame, from ffmpeg's edge frames scaled down by `scale` to `width` x `height`
 * grey bytes (area average): the columns whose sum reaches `threshold`, as `{ x1, x2 }` in full-frame pixels, or null.
 */
export function boxesFromColumns(buf, { width, height, scale, threshold }) {
  const size = width * height;
  const out = [];
  for (let at = 0; at + size <= buf.length; at += size) {
    let x1 = -1;
    let x2 = -1;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = 0; y < height; y++) sum += buf[at + y * width + x];
      if (sum >= threshold) { if (x1 < 0) x1 = x; x2 = x; }
    }
    out.push(x1 < 0 ? null : { x1: x1 * scale, x2: (x2 + 1) * scale - 1 });
  }
  return out;
}

const round = (x) => +x.toFixed(3);

/**
 * One scene's timing from its frames: `edges` (edge per frame), `page` (difference from the empty page), `motion`
 * (difference from the frame before), `boxes` (`{ x1, x2 }` of what has edges, or null), at `fps`, in a frame of
 * `size` [width, height]. `cue` says whether the scene's family has one change to land on: the biggest change from
 * 0.3 s after its content arrives. Returns
 * `{ seconds, built, cue, empty, extent }`: built and cue in seconds, empty as [from, to] spans in seconds, extent the
 * content's width about the middle as a share of the frame height (null when nothing has edges).
 */
export function analyzeScene({ edges, page, motion, boxes, fps, seconds, size, cue }) {
  const n = edges.length;
  const empty = edges.map((e, i) => (e ?? 0) < EMPTY_EDGE && (page[i] ?? 0) < PAGE_SAME);
  const peakEnd = Math.min(n, Math.round(PEAK_WINDOW_S * fps));
  const peak = Math.max(0, ...edges.slice(0, peakEnd).map((e) => e ?? 0));
  const content = empty.findIndex((x) => !x);
  let built = content < 0 ? 0 : content;
  for (let f = Math.max(0, content); f < n; f++) if ((edges[f] ?? 0) >= BUILT_SHARE * peak) { built = f; break; }
  let cueAt = null;
  if (cue) {
    let best = CUE_MIN;
    // From 0.3 s after the content arrives: a whip or a dissolve can come before the built moment (the after-state may be the denser one).
    for (let f = Math.max(0, content) + Math.round(0.3 * fps); f < n - Math.round(0.3 * fps); f++) if ((motion[f] ?? 0) > best) { best = motion[f]; cueAt = f; }
  }
  const spans = [];
  for (let f = 0; f < n; f++) {
    if (!empty[f]) continue;
    let g = f;
    while (g + 1 < n && empty[g + 1]) g++;
    spans.push([round(f / fps), round((g + 1) / fps)]);
    f = g;
  }
  const mid = size[0] / 2;
  let half = -1;
  boxes.forEach((b, i) => { if (b && !empty[i]) half = Math.max(half, Math.abs(b.x1 - mid), Math.abs(b.x2 + 1 - mid)); });
  return { seconds, built: round(built / fps), cue: cueAt === null ? null : round(cueAt / fps), empty: spans, extent: half < 0 ? null : round((2 * half) / size[1]) };
}

/**
 * The table's rows after measuring `list` at `energy`: a row for every scene in the list and no other (rows for
 * scenes no longer in the library are dropped), this energy's measurements in, the other energies' rows kept.
 */
export function mergeTimings(old, list, energy, measured) {
  const out = {};
  for (const { name } of list) {
    const prev = old?.[name] && typeof old[name].seconds !== 'number' ? old[name] : {};
    out[name] = { ...prev, ...(measured[name] ? { [energy]: measured[name] } : {}) };
  }
  return out;
}
