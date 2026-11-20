import type { Film, Seconds } from '../contracts/film';
import type { DraftNote } from '../contracts/review';
import type { Snap, SnapPoint } from '../contracts/store';

/** When two points are equally near, the earlier kind in this list wins. */
export const SNAP_ORDER: SnapPoint['source'][] = ['scene', 'line', 'cue', 'note', 'playhead'];
/** How near, in pixels, a drag has to come before it snaps. The caller turns this into seconds at the current zoom. */
export const SNAP_PIXELS = 8;

/**
 * Pulls a time onto the nearest point within the tolerance. Nearest wins; a tie goes to the kind that comes first
 * in SNAP_ORDER, then to the earlier point in the list. With nothing near enough the time comes back unchanged.
 */
export const snap: Snap = (t, points, tolerance) => {
  let hit: SnapPoint | null = null; let best = Number.POSITIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.time)) continue;
    const distance = Math.abs(point.time - t);
    if (distance > tolerance) continue;
    const nearer = distance < best - 1e-9;
    const tie = Math.abs(distance - best) <= 1e-9;
    if (nearer || (tie && hit !== null && SNAP_ORDER.indexOf(point.source) < SNAP_ORDER.indexOf(hit.source))) { hit = point; best = Math.min(best, distance); }
  }
  return { time: hit ? hit.time : t, hit };
};

/** Every place a drag can snap to: scene edges, voice line starts, cue edges, note pins and the playhead. */
export function snapPoints(film: Film, notes: DraftNote[], playhead: Seconds | null, skip?: { scene: string; cue: number }): SnapPoint[] {
  const points: SnapPoint[] = [];
  for (const scene of film.scenes) {
    points.push({ time: scene.start, source: 'scene' }, { time: scene.end, source: 'scene' });
    for (const line of scene.lines) points.push({ time: line.start, source: 'line' });
    scene.texts.forEach((cue, index) => {
      if (skip && skip.scene === scene.id && skip.cue === index) return;      // a cue does not snap to itself
      points.push({ time: scene.start + cue.at, source: 'cue' }, { time: scene.start + cue.out, source: 'cue' });
    });
  }
  for (const note of notes) points.push({ time: note.time, source: 'note' });
  if (playhead !== null) points.push({ time: playhead, source: 'playhead' });
  return points;
}

/** The shortest an on-screen text may be dragged to, in seconds. */
export const MIN_CUE = 0.2;
const round = (t: number) => Math.round(t * 1000) / 1000;

export interface CueDrag {
  /** Dragging the whole text, its start edge or its end edge. */
  mode: 'move' | 'start' | 'end';
  /** Where the text was when the drag began, in seconds from the start of its scene. */
  at: Seconds; out: Seconds;
  sceneStart: Seconds; sceneLength: Seconds;
  /** How far the pointer has moved, in seconds at the current zoom. */
  delta: Seconds;
  points: SnapPoint[];
  tolerance: Seconds;
}

/**
 * Where a dragged on-screen text lands: snapped, never outside its scene, never shorter than MIN_CUE.
 * `guide` is the film time of the point it is snapped to, for the guide line, or null.
 */
export function dragCue(d: CueDrag): { at: Seconds; out: Seconds; guide: Seconds | null } {
  const length = d.out - d.at;
  const toFilm = (t: Seconds) => d.sceneStart + t;
  let at = d.at; let out = d.out; let guide: Seconds | null = null;
  if (d.mode === 'move') {
    const first = snap(toFilm(d.at + d.delta), d.points, d.tolerance);
    const last = snap(toFilm(d.out + d.delta), d.points, d.tolerance);
    const firstPull = first.hit ? Math.abs(first.time - toFilm(d.at + d.delta)) : Number.POSITIVE_INFINITY;
    const lastPull = last.hit ? Math.abs(last.time - toFilm(d.out + d.delta)) : Number.POSITIVE_INFINITY;
    let wanted = d.at + d.delta;
    if (first.hit && firstPull <= lastPull) { wanted = first.time - d.sceneStart; guide = first.time; }
    else if (last.hit) { wanted = last.time - d.sceneStart - length; guide = last.time; }
    at = Math.min(Math.max(0, wanted), Math.max(0, d.sceneLength - length));
    out = at + length;
    if (Math.abs(at - wanted) > 1e-6) guide = null;                         // stopped by the scene's edge, not by the snap
  } else if (d.mode === 'start') {
    const s = snap(toFilm(d.at + d.delta), d.points, d.tolerance);
    const wanted = s.time - d.sceneStart;
    at = Math.min(Math.max(0, wanted), d.out - MIN_CUE);
    guide = s.hit && Math.abs(at - wanted) <= 1e-6 ? s.time : null;
  } else {
    const s = snap(toFilm(d.out + d.delta), d.points, d.tolerance);
    const wanted = s.time - d.sceneStart;
    out = Math.max(Math.min(d.sceneLength, wanted), d.at + MIN_CUE);
    guide = s.hit && Math.abs(out - wanted) <= 1e-6 ? s.time : null;
  }
  return { at: round(at), out: round(Math.min(out, d.sceneLength)), guide };
}
