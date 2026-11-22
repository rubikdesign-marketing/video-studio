// Rules the preview composition (StylePreview.tsx) and the plan (tools/styles/render-previews.mjs) must agree on.
// A plain module with no imports, so both the Remotion bundler and node can load it.

/** Clip size in pixels for each size name: 480 on the long side. */
export const SIZES = {
  '9:16': { width: 270, height: 480 },
  '16:9': { width: 480, height: 270 },
  '1:1': { width: 480, height: 480 },
  '4:5': { width: 384, height: 480 },
};

/** BlurIn to blur-in. */
export const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** A move plays on a real capture when its family starts with capture-, or its name starts with join-, stage-, product- or relayout-. */
export const isCaptureMove = (name, family) => String(family).startsWith('capture-') || /^(join|stage|product|relayout)-/.test(name);

/**
 * Capture moves with no gallery scene of their own, and the scene a preview plays for them. The capture sounds play
 * on the clicks; a preview clip is silent, so it shows the clicks they land on.
 */
export const CAPTURE_STANDS_IN = { 'capture-sounds': 'click-ring' };

/** At most this many moves are played in one clip; each gets an equal share of the frames. */
export const MAX_MOVES = 3;

/** A preview clip: 30 frames a second, 90 frames (3 s). */
export const PREVIEW_FPS = 30;
export const PREVIEW_FRAMES = 90;
/** The frames slot `i` of `count` plays: an equal share, the last slot taking what is left. */
export const slotFrames = (count, i) => {
  const each = Math.floor(PREVIEW_FRAMES / Math.max(1, count));
  return i === count - 1 ? PREVIEW_FRAMES - each * i : each;
};

/** A pointer move (cursor-classic ... cursor-hidden): the capture-pointer family. Its style is the name after cursor-. */
export const isPointerMove = (name, family) => family === 'capture-pointer' && /^cursor-/.test(name);
export const pointerStyleOf = (name) => String(name).replace(/^cursor-/, '');

/**
 * A move made for a take recorded at phone size (the phone-take re-layouts), read from its name or its catalogue
 * text. A wide take shown in a phone frame (stage-phone, relayout-vertical-phone-frame) is not one.
 */
export const isPhoneMove = (name, does = '') => /^relayout-phone-take/.test(name) || /phone-size take|recorded at phone size/i.test(does);

/** Families whose move sets the picture a take is shown in (one at most), and the camera on it (one at most). */
export const PICTURE_FAMILIES = new Set(['capture-staging', 'capture-relayout']);
export const CAMERA_FAMILIES = new Set(['capture-camera']);
/** Families whose move marks something on the take: an animation on the product, a click or typing effect, the clicks' sounds. */
export const MARK_FAMILIES = new Set(['capture-product', 'capture-effect', 'capture-sound']);
/**
 * Moves with a twin glued to the take, played as that twin when a capture picture is beside them: the light sweep
 * crossing a surface is product-sweep crossing the thing (library/motion/index.json: "the light sweep, glued").
 */
export const COMPOSE_AS = { 'light-sweep': 'product-sweep' };
/** Pictures no mark can go on, and why. */
export const NO_MARKS = {
  'stage-wall': 'a wall of still frames has no live take for the mark to sit on',
  'relayout-vertical-join': 'it splits the take at a join, so the mark has no one take to sit on',
};
/** A composed slot's name: its members joined by this, the picture first, then the camera, then the marks. */
export const COMPOSE_JOIN = '+';
export const composedMembers = (name) => String(name).split(COMPOSE_JOIN);
const REFUSED = 'staging and mark cannot compose';

/**
 * One scene for a staging, re-layout, phone or camera move named beside capture marks: the picture on the take, with
 * the marks on that same take. Returns `{ composed, members, refused }`: `composed` the slot's name (members joined
 * by COMPOSE_JOIN) or null; `members` the entry's names it stands for; `refused` the reason when the pairing cannot
 * share one take ("staging and mark cannot compose: ..."), or null.
 */
export function composeMoves(names, familyOf) {
  const as = (n) => CAPTURE_STANDS_IN[n] ?? n;
  const pictures = names.filter((n) => PICTURE_FAMILIES.has(familyOf(n)));
  const cameras = names.filter((n) => CAMERA_FAMILIES.has(familyOf(n)));
  const base = pictures.length + cameras.length > 0;
  const isMark = (n) => MARK_FAMILIES.has(familyOf(n)) || (base && n in COMPOSE_AS);
  const marks = names.filter(isMark);
  if (!base || !marks.length) return { composed: null, members: [], refused: null };
  const members = names.filter((n) => pictures.includes(n) || cameras.includes(n) || marks.includes(n));
  const refuse = (why) => ({ composed: null, members, refused: `${REFUSED}: ${why}` });
  if (pictures.length > 1) return refuse(`${pictures.join(' and ')} are two pictures, and a take is shown in one`);
  if (cameras.length > 1) return refuse(`${cameras.join(' and ')} are two camera moves on one take`);
  const picture = pictures[0];
  if (picture && NO_MARKS[picture]) return refuse(`${picture}: ${NO_MARKS[picture]}`);
  if (picture && cameras.length && familyOf(picture) === 'capture-relayout') return refuse(`${picture} moves its own camera, so ${cameras[0]} has no camera to set`);
  const parts = [picture, cameras[0], ...marks.map((n) => as(COMPOSE_AS[n] ?? n))].filter(Boolean);
  return { composed: [...new Set(parts)].join(COMPOSE_JOIN), members, refused: null };
}

/**
 * Which moves take a slot in the clip, and the pointer its capture moves are drawn with. A pointer named beside
 * another capture move sets that move's pointer and takes no slot; a pointer with no capture move beside it plays its
 * own scene. On the phone take the pointer is hidden unless one is named: the take's own default is the touch dot.
 * A picture (staging, re-layout) or camera move named beside marks plays as one composed slot where the first of them
 * stood (composeMoves). `familyOf(name)` gives a move's family (library/motion/index.json). Returns
 * `{ moves, pointer, refused }`: pointer a style name ("hidden", "classic" ...) or null for the move's own; refused
 * the reason a pairing cannot compose (the plan reports the entry instead of rendering it), or null.
 */
export function previewSlots(names, { familyOf, phone = false }) {
  const pointerOf = (n) => isPointerMove(n, familyOf(n));
  const others = names.filter((n) => !pointerOf(n));
  const setting = others.some((n) => isCaptureMove(n, familyOf(n)));
  const named = setting ? names.find(pointerOf) : undefined;
  let list = setting ? others : names;
  const { composed, members, refused } = composeMoves(list, familyOf);
  if (composed) {
    const at = list.findIndex((n) => members.includes(n));
    list = list.filter((n, i) => i === at || !members.includes(n)).map((n, i) => (i === at ? composed : n));
  }
  const moves = list.slice(0, MAX_MOVES);
  const pointer = named ? pointerStyleOf(named) : phone ? 'hidden' : null;
  return { moves, pointer, refused };
}

/** Seconds of lead before a scene's defining moment (a click, a mark, a join) when its slot starts. */
export const LEAD_S = 0.3;

/**
 * The frame of its own scene a slot starts on: the scene's defining moment (`cue`, seconds on the scene's clock)
 * less LEAD_S, never before the scene's start and never so late that the slot runs past the scene's end (`seconds`,
 * when known). A scene that declares no cue starts at 0.
 */
export function sceneStart({ cue, seconds, slot, fps }) {
  if (typeof cue !== 'number' || !Number.isFinite(cue)) return 0;
  const want = Math.round((cue - LEAD_S) * fps);
  const last = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.floor(seconds * fps) - slot : Infinity;
  return Math.max(0, Math.min(want, last));
}

/**
 * A scene's measured timing for an energy from scene-timing.json's `scenes`: a row per energy (calm, confident, hype;
 * the entrances run at the energy's pace), or one row for all. Null when the scene was not measured, or (given the
 * scene's length in `seconds`) when the row was measured at another length: a stale row is no timing.
 */
export function timingFor(scenes, name, energy, seconds) {
  const row = scenes?.[name];
  if (!row) return null;
  const pick = typeof row.seconds === 'number' ? row : row[energy] ?? row.confident ?? null;
  if (!pick) return null;
  if (typeof seconds === 'number' && Math.abs(pick.seconds - seconds) > 1e-6) return null;
  return pick;
}

/** Seconds into a scene a slot starts when nothing measured says better (library/motion/scene-timing.json has no row). */
export const SAFE_OFFSET_S = 0.6;
/** A slot that holds a scene's cue (a transition's change) keeps at least this long after it. */
export const CUE_AFTER_S = 1;
/**
 * A scene whose content takes longer than this to arrive (from its first frame with content to its built moment) is
 * one whose build is the move (typing, a cascade, bars growing, a ring sweeping): its slot starts as the content
 * arrives (in the clip's first slot, up to LEAD_S before, in the empty lead the clip may open on), not when it is done.
 */
export const LONG_BUILD_S = 0.5;

/** A blank of at most this many frames, with content on both sides, is a designed pass-through when it falls in a transition or near the cue. */
export const PASS_THROUGH_FRAMES = 6;
/** ...near the cue meaning within this many seconds of it. */
export const PASS_THROUGH_NEAR_S = 0.2;

/**
 * The frame of its own scene a slot starts on, from the scene's measured timing (library/motion/scene-timing.json:
 * `{ seconds, built, cue, empty: [[from, to] ...] }`, seconds on the scene's clock).
 * - It starts at the built moment (its content on screen) less LEAD_S, or as its content arrives for a long build
 *   (LONG_BUILD_S); for a scene with a cue, late enough to show CUE_AFTER_S after it but never after the cue less
 *   LEAD_S; never past the scene's end.
 * - A designed pass-through is no empty frame: a blank of PASS_THROUGH_FRAMES or fewer with content on both sides,
 *   in a transition-family scene (`transition`) or within PASS_THROUGH_NEAR_S of the cue.
 * - A window that would hold an empty frame moves to the nearest one that holds none (the first `grace` frames of
 *   the window do not count: the clip's own first 0.3 s); a scene with a cue keeps the cue inside its window.
 * - When no window is clear, the slot holds the scene's last fully built frame from `freeze` (its measured exit, else
 *   the start of the blank it leaves on, else its end) to the slot's end: a still, not an empty frame.
 * Returns `{ start, empty, safe, freeze, problem }`: `freeze` the scene frame the hold starts on, or null; `problem`
 * null, "change" (no clear window keeps the cue: a clear one without it is used), "empty" (every window holds an empty
 * frame; `empty` says how many at best), "content" (the scene has nothing to show) or "nocue" (a transition with no
 * measured change point); `safe` when there was no timing
 * and SAFE_OFFSET_S was used.
 */
export function slotStart({ timing, slot, fps, grace = 0, transition = false }) {
  const done = (start, more = {}) => ({ start, empty: 0, safe: false, freeze: null, problem: null, ...more });
  if (!timing) return done(Math.round(SAFE_OFFSET_S * fps), { safe: true });
  const frames = Math.max(1, Math.floor(timing.seconds * fps));
  const spans = (timing.empty ?? []).map(([a, b]) => [Math.round(a * fps), Math.round(b * fps)]);
  const cue = typeof timing.cue === 'number' ? Math.round(timing.cue * fps) : null;
  const near = Math.round(PASS_THROUGH_NEAR_S * fps);
  const passes = ([a, b]) => b - a <= PASS_THROUGH_FRAMES && a > 0 && b < frames && (transition || (cue !== null && a < cue + near && b > cue - near));
  const real = spans.filter((sp) => !passes(sp));
  const blank = (f) => real.some(([a, b]) => f >= a && f < b);
  const lastBlank = blank(frames - 1);
  // The hold starts where the scene stops being fully built before it leaves (its measured exit), else where it
  // leaves for good (a blank running to its end), else at its end.
  const tail = spans.find(([, b]) => b >= frames);
  const holdFrom = typeof timing.exit === 'number' ? Math.round(timing.exit * fps) : tail ? tail[0] : frames;
  let hasContent = false;
  for (let f = 0; f < holdFrom && !hasContent; f++) if (!blank(f)) hasContent = true;
  if (!hasContent) return done(0, { problem: 'content' });
  const emptyIn = (s, hold) => {
    let n = 0;
    for (let f = s + grace; f < s + slot; f++) {
      if (hold && f >= holdFrom) break;
      if (f >= frames ? lastBlank : blank(f)) n++;
    }
    return n;
  };
  const opening = spans.find(([a]) => a === 0);
  const content = opening ? opening[1] / fps : 0;
  // A long build starts where its action starts (measured; its content is on screen already), else as its content arrives.
  const acted = typeof timing.action === 'number' && timing.action > content + 1e-6;
  let want = timing.built - content > LONG_BUILD_S + 1e-6 ? Math.round((acted ? timing.action : content - (grace ? LEAD_S : 0)) * fps) : Math.round((timing.built - LEAD_S) * fps);
  if (cue !== null) want = Math.max(want, Math.min(cue - Math.round(LEAD_S * fps), cue + Math.round(CUE_AFTER_S * fps) - slot));
  const holds = (s, hold) => (hold && s + slot > holdFrom ? holdFrom : null);
  /** The clear window nearest `want` (later first on a tie), or the one with fewest empty frames. */
  const search = (hold, keepCue) => {
    const latest = hold ? Math.max(0, holdFrom - 1) : Math.max(0, frames - slot);
    const from = Math.max(0, Math.min(latest, want));
    let best = null;
    for (let d = 0; d <= latest; d++) {
      for (const s of d ? [from + d, from - d] : [from]) {
        if (s < 0 || s > latest) continue;
        if (keepCue && !(s <= cue && cue < s + slot)) continue;
        const n = emptyIn(s, hold);
        if (n === 0) return { start: s, empty: 0, hold };
        if (!best || n < best.empty) best = { start: s, empty: n, hold };
      }
    }
    return best;
  };
  const keep = cue !== null && cue < frames;
  // A transition with no measured change point cannot keep it: said so, never started anywhere silently.
  const nocue = transition && cue === null ? { problem: 'nocue' } : {};
  for (const hold of [false, true]) {
    const r = search(hold, keep);
    if (r && r.empty === 0) return done(r.start, { freeze: holds(r.start, hold), ...nocue });
  }
  if (keep) {
    for (const hold of [false, true]) {
      const r = search(hold, false);
      if (r && r.empty === 0) return done(r.start, { freeze: holds(r.start, hold), problem: 'change' });
    }
  }
  const fewest = [search(false, false), search(true, false)].filter(Boolean).sort((x, y) => x.empty - y.empty)[0];
  return done(fewest.start, { empty: fewest.empty, freeze: holds(fewest.start, fewest.hold), problem: 'empty' });
}

/** Room kept on each side of a fitted scene, as a share of the clip's width. */
export const FIT_MARGIN = 0.06;
const WIDE = 16 / 9;

/**
 * The frame a scene made for 16:9 (and not laid out for other sizes) plays in, inside a clip of another shape: as
 * tall as the clip when its content fits the clip's width with FIT_MARGIN each side, else just wide enough for it
 * (never wider than 16:9), full clip width and centred. `extent` is the content's width as a share of the frame's
 * height, measured at 16:9 (scene-timing.json); null means unknown, and the scene gets the whole 16:9 frame.
 * Returns `{ width, height, top }` in clip pixels.
 */
export function fitFrame(clip, extent) {
  const aspect = clip.width / clip.height;
  if (aspect >= WIDE - 1e-6) return { width: clip.width, height: clip.height, top: 0 };
  const need = typeof extent === 'number' && Number.isFinite(extent) ? extent / (1 - 2 * FIT_MARGIN) : WIDE;
  const fitted = Math.min(WIDE, Math.max(aspect, need));
  const height = fitted <= aspect + 1e-9 ? clip.height : Math.round(clip.width / fitted);
  return { width: clip.width, height, top: Math.round((clip.height - height) / 2) };
}

/** A slot keeps this long on the built moment (or after the cue's CUE_AFTER_S) for the eye to read it. */
export const READ_S = 0.3;
/** No slot is planned shorter than this. */
export const MIN_SLOT_S = 0.6;
/** What a scene with a cue needs after it: the change itself and a short read (slotStart still keeps CUE_AFTER_S when the slot allows). */
export const CHANGE_S = 0.6;

/**
 * The frames a scene needs so its defining action completes in its slot, from its measured timing: a long build
 * (LONG_BUILD_S) from where its action starts (measured `action`), else from the content's arrival (in the clip's `first` slot up to LEAD_S before) to the built moment, a
 * short entrance from the built moment less LEAD_S, a scene with a cue from the cue less LEAD_S to CHANGE_S after
 * it; each to at least READ_S past the built moment; at least MIN_SLOT_S, at most the scene. Null without timing.
 */
export function sceneNeed(timing, fps, { first = false } = {}) {
  if (!timing) return null;
  const opening = (timing.empty ?? []).find(([a]) => a <= 1e-6);
  const content = opening ? opening[1] : 0;
  const long = timing.built - content > LONG_BUILD_S + 1e-6;
  const acted = typeof timing.action === 'number' && timing.action > content + 1e-6;
  const from = typeof timing.cue === 'number' ? timing.cue - LEAD_S : Math.max(0, long ? (acted ? timing.action : content - (first ? LEAD_S : 0)) : timing.built - LEAD_S);
  const to = Math.max(timing.built + READ_S, typeof timing.cue === 'number' ? timing.cue + CHANGE_S : 0);
  const need = Math.min(timing.seconds, Math.max(MIN_SLOT_S, to - Math.max(0, from)));
  return Math.round(need * fps);
}

/**
 * Each slot's frames in the clip, weighed by what its scene needs (sceneNeed; null for a scene whose need is not
 * known ahead, such as a capture scene: it counts as an equal share). Within PREVIEW_FRAMES, the time left over is
 * shared equally (a frame more to the first slots for any remainder). When the needs come to more, they are scaled to
 * fit and `over` says how many frames were needed (the plan reports it). Returns `{ frames, over }`.
 */
export function slotLengths(needs) {
  const n = needs.length;
  if (!n) return { frames: [], over: 0 };
  const share = Math.floor(PREVIEW_FRAMES / n);
  const base = needs.map((x) => (typeof x === 'number' ? x : share));
  const total = base.reduce((a, b) => a + b, 0);
  if (total <= PREVIEW_FRAMES) {
    const extra = PREVIEW_FRAMES - total;
    const each = Math.floor(extra / n);
    const left = extra - each * n;
    return { frames: base.map((b, i) => b + each + (i < left ? 1 : 0)), over: 0 };
  }
  const frames = base.map((b) => Math.floor((b * PREVIEW_FRAMES) / total));
  let left = PREVIEW_FRAMES - frames.reduce((a, b) => a + b, 0);
  for (let i = 0; left > 0; i = (i + 1) % n, left--) frames[i]++;
  return { frames, over: total };
}
