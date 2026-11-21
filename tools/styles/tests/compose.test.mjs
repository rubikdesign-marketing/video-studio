// Task 5d: the preview composes a staging with its marks on one take, plays every slot from a moment with content on
// screen, and fits graphic scenes to the clip's frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previewSlots, composeMoves, composedMembers, COMPOSE_JOIN, COMPOSE_AS, MAX_MOVES,
  slotStart, timingFor, SAFE_OFFSET_S, LEAD_S, CUE_AFTER_S, LONG_BUILD_S, fitFrame, FIT_MARGIN,
} from '../../../engine/src/library/styles/rules.mjs';

// Families as library/motion/index.json files them.
const FAMILY = {
  'stage-laptop': 'capture-staging', 'stage-split': 'capture-staging', 'stage-card': 'capture-staging', 'stage-browser': 'capture-staging',
  'stage-wall': 'capture-staging', 'stage-email': 'capture-staging',
  'relayout-phone-take-framed': 'capture-relayout', 'relayout-phone-take': 'capture-relayout', 'relayout-vertical-join': 'capture-relayout',
  'camera-push-in': 'capture-camera', 'camera-auto-zoom': 'capture-camera', 'camera-pan-across': 'capture-camera',
  'product-ring': 'capture-product', 'product-toast': 'capture-product', 'product-magnifier': 'capture-product', 'product-sweep': 'capture-product',
  'typing-caret-glow': 'capture-effect', 'click-burst': 'capture-effect', 'capture-sounds': 'capture-sound',
  'cursor-hidden': 'capture-pointer', 'cursor-classic': 'capture-pointer',
  'time-freeze': 'capture-time', 'join-whip': 'capture-transition',
  'light-sweep': 'transition', 'opener-spotlight': 'opener', 'blur-in': 'type', 'bar-grow': 'data',
};
const familyOf = (n) => FAMILY[n] ?? '';
const plus = (...names) => names.join(COMPOSE_JOIN);

test('compose: a staging and its mark play as one scene on one take', () => {
  assert.deepEqual(previewSlots(['stage-split', 'product-ring'], { familyOf }), { moves: [plus('stage-split', 'product-ring')], pointer: null, refused: null });
  assert.deepEqual(previewSlots(['stage-laptop', 'typing-caret-glow'], { familyOf }).moves, [plus('stage-laptop', 'typing-caret-glow')]);
  // the base leads the name whatever the entry's order; the marks keep theirs
  assert.deepEqual(previewSlots(['product-toast', 'stage-email'], { familyOf }).moves, [plus('stage-email', 'product-toast')]);
});

test('compose: a phone re-layout keeps its frame with the mark on it, and the pointer stays a setting', () => {
  const slots = previewSlots(['relayout-phone-take-framed', 'product-toast', 'cursor-hidden'], { familyOf, phone: true });
  assert.deepEqual(slots, { moves: [plus('relayout-phone-take-framed', 'product-toast')], pointer: 'hidden', refused: null });
});

test('compose: a camera move and a mark share the take; staging, camera and mark make one scene', () => {
  assert.deepEqual(previewSlots(['camera-push-in', 'click-burst'], { familyOf }).moves, [plus('camera-push-in', 'click-burst')]);
  assert.deepEqual(previewSlots(['stage-browser', 'camera-auto-zoom', 'product-magnifier'], { familyOf }).moves, [plus('stage-browser', 'camera-auto-zoom', 'product-magnifier')]);
});

test('compose: a standalone scene beside the combo keeps its own slot, in the entry\'s order', () => {
  assert.deepEqual(previewSlots(['opener-spotlight', 'camera-push-in', 'product-ring'], { familyOf }).moves, ['opener-spotlight', plus('camera-push-in', 'product-ring')]);
  assert.deepEqual(previewSlots(['product-ring', 'blur-in', 'stage-card'], { familyOf }).moves, [plus('stage-card', 'product-ring'), 'blur-in']);
});

test('compose: the light sweep beside a staging plays as its glued twin on the take', () => {
  assert.equal(COMPOSE_AS['light-sweep'], 'product-sweep');
  assert.deepEqual(previewSlots(['stage-card', 'light-sweep'], { familyOf }).moves, [plus('stage-card', 'product-sweep')]);
  // with no capture base it stays its own scene
  assert.deepEqual(previewSlots(['light-sweep', 'blur-in'], { familyOf }).moves, ['light-sweep', 'blur-in']);
});

test('compose: the capture sounds compose as the clicks they land on', () => {
  assert.deepEqual(previewSlots(['stage-card', 'capture-sounds'], { familyOf }).moves, [plus('stage-card', 'click-ring')]);
});

test('compose: no mark, or no base, leaves the slots as they were', () => {
  assert.deepEqual(previewSlots(['stage-laptop'], { familyOf }), { moves: ['stage-laptop'], pointer: null, refused: null });
  assert.deepEqual(previewSlots(['product-ring', 'click-burst'], { familyOf }).moves, ['product-ring', 'click-burst']);
  assert.deepEqual(previewSlots(['stage-card', 'join-whip'], { familyOf }).moves, ['stage-card', 'join-whip']);
  assert.deepEqual(previewSlots(['stage-card', 'time-freeze'], { familyOf }).moves, ['stage-card', 'time-freeze']);
});

test('compose: pairings that cannot share one take are refused, with the reason', () => {
  const refused = (names) => previewSlots(names, { familyOf }).refused;
  assert.match(refused(['stage-wall', 'product-ring']), /^staging and mark cannot compose: stage-wall/);
  assert.match(refused(['relayout-vertical-join', 'product-ring']), /^staging and mark cannot compose: relayout-vertical-join/);
  assert.match(refused(['stage-card', 'stage-laptop', 'product-ring']), /^staging and mark cannot compose: /);
  assert.match(refused(['relayout-phone-take', 'camera-push-in', 'product-ring']), /^staging and mark cannot compose: /);
  assert.match(refused(['camera-push-in', 'camera-pan-across', 'product-ring']), /^staging and mark cannot compose: /);
  assert.equal(refused(['stage-split', 'product-ring']), null);
});

test('compose: the members of a composed slot read back in order, a plain name is its own member', () => {
  assert.deepEqual(composedMembers(plus('stage-browser', 'camera-auto-zoom', 'product-magnifier')), ['stage-browser', 'camera-auto-zoom', 'product-magnifier']);
  assert.deepEqual(composedMembers('blur-in'), ['blur-in']);
  assert.deepEqual(composeMoves(['stage-split', 'product-ring', 'product-ring'], familyOf).composed, plus('stage-split', 'product-ring'), 'a mark named twice is one mark');
  assert.ok(previewSlots(['blur-in', 'blur-in', 'blur-in', 'blur-in', 'stage-card', 'product-ring'], { familyOf }).moves.length <= MAX_MOVES);
});

// ---------------------------------------------------------------- where each slot starts

const FPS = 30;
const t = (o) => ({ seconds: 4, built: 0.9, cue: null, empty: [[0, 0.6]], ...o });

test('slot start: from the built moment less the lead', () => {
  assert.equal(LEAD_S, 0.3);
  assert.deepEqual(slotStart({ timing: t(), slot: 45, fps: FPS }), { start: 18, empty: 0, safe: false });
});

test('slot start: a scene with a cue (a transition) starts late enough to show the move, never after its lead', () => {
  // cue at 2.2: the slot of 45 frames must reach cue + CUE_AFTER (3.2 s = 96) so it starts at 51 (1.7 s)
  assert.equal(CUE_AFTER_S, 1);
  assert.equal(slotStart({ timing: t({ cue: 2.2, seconds: 4.5 }), slot: 45, fps: FPS }).start, 51);
  // a long slot: the built moment already shows the cue
  assert.equal(slotStart({ timing: t({ cue: 2.2, seconds: 4.5 }), slot: 90, fps: FPS }).start, 18);
  // a short slot: never later than the cue less the lead
  assert.equal(slotStart({ timing: t({ cue: 2.2, seconds: 4.5 }), slot: 20, fps: FPS }).start, 57);
});

test('slot start: a window that would hold an empty frame moves to the nearest one that does not', () => {
  // a transition's slot from 1.7 s (to show its cue) would run into a blank at 3.0 s, so it starts a little earlier...
  const early = slotStart({ timing: t({ seconds: 4.5, cue: 2.2, empty: [[0, 0.6], [3, 3.1]] }), slot: 45, fps: FPS });
  assert.deepEqual(early, { start: 45, empty: 0, safe: false });
  // ...or later, past the gap, when nothing earlier fits
  const late = slotStart({ timing: t({ empty: [[0, 0.6], [1.5, 1.8]] }), slot: 30, fps: FPS });
  assert.equal(late.start, 54);
  assert.equal(late.empty, 0);
});

test('slot start: when every window holds an empty frame, the one with fewest, and it says how many', () => {
  const r = slotStart({ timing: t({ seconds: 2, empty: [[0, 0.3], [0.9, 1.0], [1.6, 2]] , built: 0.4 }), slot: 45, fps: FPS });
  assert.ok(r.empty > 0);
  assert.ok(r.start >= 0 && r.start <= 60 - 45);
});

test('slot start: the clip\'s own first 0.3 s may be empty (grace), later slots may not', () => {
  const timing = t({ empty: [[0, 0.5]], built: 0.6 });
  assert.equal(slotStart({ timing, slot: 45, fps: FPS, grace: 9 }).start, 9);
  assert.equal(slotStart({ timing, slot: 45, fps: FPS }).start, 15);
});

test('slot start: never past the scene\'s end; a scene shorter than its slot plays from the start', () => {
  assert.equal(slotStart({ timing: t({ built: 3.9, empty: [[0, 3.6]] }), slot: 45, fps: FPS }).start, 120 - 45);
  assert.equal(slotStart({ timing: t({ seconds: 1, built: 0.5, empty: [] }), slot: 45, fps: FPS }).start, 0);
});

test('slot start: a scene with no measured timing starts at the safe offset, and says so', () => {
  assert.deepEqual(slotStart({ timing: null, slot: 45, fps: FPS }), { start: Math.round(SAFE_OFFSET_S * FPS), empty: 0, safe: true });
});

// ---------------------------------------------------------------- fitting a 16:9 scene into another frame

test('fit: a 16:9 clip plays a 16:9 scene in its own frame', () => {
  assert.deepEqual(fitFrame({ width: 480, height: 270 }, 1.2), { width: 480, height: 270, top: 0 });
});

test('fit: in a tall or square clip, the scene gets a frame just wide enough for its content, centred', () => {
  // content 0.4 frame-heights wide fits a 9:16 frame as it is
  assert.deepEqual(fitFrame({ width: 270, height: 480 }, 0.4), { width: 270, height: 480, top: 0 });
  // content 1.2 frame-heights wide needs a frame of aspect 1.2 / (1 - 2 * margin)
  const f = fitFrame({ width: 480, height: 480 }, 1.2);
  const aspect = 1.2 / (1 - 2 * FIT_MARGIN);
  assert.equal(f.width, 480);
  assert.equal(f.height, Math.round(480 / aspect));
  assert.equal(f.top, Math.round((480 - f.height) / 2));
  // never wider than the 16:9 frame it was made for; unknown content is given that frame
  assert.deepEqual(fitFrame({ width: 270, height: 480 }, 3), { width: 270, height: Math.round(270 / (16 / 9)), top: Math.round((480 - Math.round(270 / (16 / 9))) / 2) });
  assert.deepEqual(fitFrame({ width: 270, height: 480 }, null), fitFrame({ width: 270, height: 480 }, 99));
});

test('timing: a row per energy, or one row for all', () => {
  const calm = { seconds: 4, built: 1.2, cue: null, empty: [] };
  const confident = { seconds: 4, built: 0.9, cue: null, empty: [] };
  const scenes = { a: { calm, confident }, b: confident };
  assert.equal(timingFor(scenes, 'a', 'calm'), calm);
  assert.equal(timingFor(scenes, 'a', 'hype'), confident, 'an energy not measured falls back to confident');
  assert.equal(timingFor(scenes, 'b', 'hype'), confident);
  assert.equal(timingFor(scenes, 'c', 'calm'), null);
});

test('slot start: a long build is the scene\'s move, so the slot starts as its content arrives, not when it is done', () => {
  assert.equal(LONG_BUILD_S, 0.5);
  // typing from 0.233 s to 2 s: a later slot starts on the first frame with content
  const typing = { seconds: 4.5, built: 2, cue: null, empty: [[0, 0.233]] };
  assert.equal(slotStart({ timing: typing, slot: 45, fps: FPS }).start, 7);
  // the clip's first slot may start in the empty lead (its first 0.3 s), so the whole build shows
  assert.equal(slotStart({ timing: typing, slot: 45, fps: FPS, grace: 9 }).start, 0);
  // a short entrance (0.233 s) is trimmed to the built moment less the lead
  assert.equal(slotStart({ timing: { seconds: 4, built: 0.733, cue: null, empty: [[0, 0.5]] }, slot: 45, fps: FPS }).start, 15);
});
