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

/** A pointer move (cursor-classic ... cursor-hidden): the capture-pointer family. Its style is the name after cursor-. */
export const isPointerMove = (name, family) => family === 'capture-pointer' && /^cursor-/.test(name);
export const pointerStyleOf = (name) => String(name).replace(/^cursor-/, '');

/**
 * A move made for a take recorded at phone size (the phone-take re-layouts), read from its name or its catalogue
 * text. A wide take shown in a phone frame (stage-phone, relayout-vertical-phone-frame) is not one.
 */
export const isPhoneMove = (name, does = '') => /^relayout-phone-take/.test(name) || /phone-size take|recorded at phone size/i.test(does);

/**
 * Which moves take a slot in the clip, and the pointer its capture moves are drawn with. A pointer named beside
 * another capture move sets that move's pointer and takes no slot; a pointer with no capture move beside it plays its
 * own scene. On the phone take the pointer is hidden unless one is named: the take's own default is the touch dot.
 * `familyOf(name)` gives a move's family (library/motion/index.json). Returns `{ moves, pointer }`, pointer a style
 * name ("hidden", "classic" ...) or null for the move's own.
 */
export function previewSlots(names, { familyOf, phone = false }) {
  const pointerOf = (n) => isPointerMove(n, familyOf(n));
  const others = names.filter((n) => !pointerOf(n));
  const setting = others.some((n) => isCaptureMove(n, familyOf(n)));
  const named = setting ? names.find(pointerOf) : undefined;
  const moves = (setting ? others : names).slice(0, MAX_MOVES);
  const pointer = named ? pointerStyleOf(named) : phone ? 'hidden' : null;
  return { moves, pointer };
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
