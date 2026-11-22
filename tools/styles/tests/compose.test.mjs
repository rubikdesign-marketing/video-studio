// Task 5d: the preview composes a staging with its marks on one take, plays every slot from a moment with content on
// screen, and fits graphic scenes to the clip's frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  previewSlots, composeMoves, composedMembers, COMPOSE_JOIN, COMPOSE_AS, MAX_MOVES,
  slotStart, timingFor, SAFE_OFFSET_S, LEAD_S, CUE_AFTER_S, LONG_BUILD_S, sceneNeed, slotLengths, READ_S, MIN_SLOT_S, CHANGE_S, fitFrame, FIT_MARGIN,
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
  assert.deepEqual(slotStart({ timing: t(), slot: 45, fps: FPS }), { start: 18, empty: 0, safe: false, freeze: null, problem: null });
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
  assert.deepEqual(early, { start: 45, empty: 0, safe: false, freeze: null, problem: null });
  // ...or later, past the gap, when nothing earlier fits
  const late = slotStart({ timing: t({ empty: [[0, 0.6], [1.5, 1.8]] }), slot: 30, fps: FPS });
  assert.equal(late.start, 54);
  assert.equal(late.empty, 0);
});

test('slot start: when every window holds an empty frame, the slot starts after the last one and holds the scene\'s end', () => {
  const r = slotStart({ timing: t({ seconds: 2, empty: [[0, 0.3], [0.9, 1.0], [1.4, 2]] , built: 0.4 }), slot: 45, fps: FPS });
  assert.deepEqual(r, { start: 30, empty: 0, safe: false, freeze: 42, problem: null });
});

test('slot start: the clip\'s own first 0.3 s may be empty (grace), later slots may not', () => {
  const timing = t({ empty: [[0, 0.5]], built: 0.6 });
  assert.equal(slotStart({ timing, slot: 45, fps: FPS, grace: 9 }).start, 9);
  assert.equal(slotStart({ timing, slot: 45, fps: FPS }).start, 15);
});

test('slot start: never past the scene\'s end; a scene shorter than its slot plays from the start', () => {
  // content only from 3.6 s: it starts there and holds the last frame rather than run into its blank lead
  assert.deepEqual(slotStart({ timing: t({ built: 3.9, empty: [[0, 3.6]] }), slot: 45, fps: FPS }), { start: 108, empty: 0, safe: false, freeze: 120, problem: null });
  assert.equal(slotStart({ timing: t({ seconds: 1, built: 0.5, empty: [] }), slot: 45, fps: FPS }).start, 0);
});

test('slot start: a scene with no measured timing starts at the safe offset, and says so', () => {
  assert.deepEqual(slotStart({ timing: null, slot: 45, fps: FPS }), { start: Math.round(SAFE_OFFSET_S * FPS), empty: 0, safe: true, freeze: null, problem: null });
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

// ---------------------------------------------------------------- review fixes: pass-throughs, the cue kept, short scenes held

// Rows as library/motion/scene-timing.json has them (confident unless named), for the entries the review named.
const ROW = {
  'blur-through': { seconds: 4, built: 0.333, cue: 1.9, empty: [[0, 0.233], [1.833, 1.967]] },
  'morph-chain': { seconds: 5.2, built: 0.433, cue: 1.433, empty: [[0, 0.333], [1.5, 1.567]] },
  'parallax-push': { seconds: 4.2, built: 0.533, cue: 2, empty: [[2.033, 2.1]] },
  carrier: { seconds: 6, built: 0.167, cue: 4.467, empty: [[0, 0.133], [1.5, 1.633], [3, 3.067], [4.433, 4.467]] },
  'slam (hype)': { seconds: 3.5, built: 0.533, cue: null, empty: [[0, 0.433], [0.467, 0.5], [2.9, 3.5]] },
  'word-pop': { seconds: 4, built: 0.567, cue: null, empty: [[0, 0.467], [3.133, 4]] },
  'line-draw (calm)': { seconds: 3.5, built: 1.267, cue: null, empty: [[0, 0.833]] },
};
const inside = (r, cue, slot) => r.start <= Math.round(cue * FPS) && Math.round(cue * FPS) < r.start + slot;

test('pass-through: a transition\'s own short blank is no empty frame, so the slot keeps its change (mo-rh-decelerate, blur-through)', () => {
  const r = slotStart({ timing: ROW['blur-through'], slot: 45, fps: FPS, transition: true });
  assert.deepEqual(r, { start: 42, empty: 0, safe: false, freeze: null, problem: null });
  assert.ok(inside(r, 1.9, 45));
});

test('pass-through: a short blank within 0.2 s of the cue, in any family (pui-layout-search-becomes-answer, morph-chain)', () => {
  const r = slotStart({ timing: ROW['morph-chain'], slot: 45, fps: FPS, transition: false });
  assert.equal(r.start, 28);
  assert.equal(r.problem, null);
  assert.ok(inside(r, 1.433, 45));
});

test('pass-through: film-parallax-push-join (parallax-push) and film-carried-object (carrier) keep their change', () => {
  const push = slotStart({ timing: ROW['parallax-push'], slot: 45, fps: FPS, transition: true });
  assert.equal(push.start, 45);
  assert.ok(inside(push, 2, 45));
  const carrier = slotStart({ timing: ROW.carrier, slot: 45, fps: FPS, transition: true });
  assert.equal(carrier.start, 119);
  assert.equal(carrier.problem, null);
  assert.ok(inside(carrier, 4.467, 45));
});

test('pass-through: only short (6 frames or fewer), with content both sides, near the cue or in a transition', () => {
  // 7 frames at the cue is a real blank: no window holding the cue is clear, so a clear one without it is used and reported
  const long = { seconds: 4, built: 0.5, cue: 2, empty: [[0, 0.3], [1.9, 2.133]] };
  const r = slotStart({ timing: long, slot: 30, fps: FPS, transition: true });
  assert.equal(r.problem, 'change');
  assert.equal(r.empty, 0);
  assert.ok(!inside(r, 2, 30));
  // a short blank far from any cue in a scene that is not a transition is a real blank
  const far = { seconds: 4, built: 0.5, cue: null, empty: [[0, 0.3], [1.5, 1.6]] };
  // (every 90-frame window from the start holds frames 45 to 47, so the slot starts after them and holds the last frame)
  assert.deepEqual(slotStart({ timing: far, slot: 90, fps: FPS }), { start: 48, empty: 0, safe: false, freeze: 120, problem: null });
  // the same blank in a transition is a pass-through: the slot plays from its built moment, nothing held
  // (and, being a transition with no measured change point, it is reported as such)
  assert.deepEqual(slotStart({ timing: far, slot: 90, fps: FPS, transition: true }), { start: 9, empty: 0, safe: false, freeze: null, problem: 'nocue' });
});

test('cue: a change that cannot sit in any clear window is reported, never slid past silently', () => {
  const blocked = { seconds: 4, built: 0.5, cue: 2, empty: [[0, 0.3], [1.9, 2.2]] };
  const r = slotStart({ timing: blocked, slot: 30, fps: FPS });
  assert.equal(r.problem, 'change');
  assert.equal(r.empty, 0);
});

test('hold: a scene that leaves before its slot ends holds its last content frame (an-type-slam, an-type-word-pop)', () => {
  const slam = slotStart({ timing: ROW['slam (hype)'], slot: 90, fps: FPS, grace: 9 });
  assert.deepEqual(slam, { start: 7, empty: 0, safe: false, freeze: 87, problem: null });
  const pop = slotStart({ timing: ROW['word-pop'], slot: 90, fps: FPS, grace: 9 });
  assert.deepEqual(pop, { start: 8, empty: 0, safe: false, freeze: 94, problem: null });
});

test('hold: a scene shorter than its slot holds its last frame instead of starting early in its blank lead (pui-data-trend-line, line-draw)', () => {
  const r = slotStart({ timing: ROW['line-draw (calm)'], slot: 90, fps: FPS, grace: 9 });
  assert.deepEqual(r, { start: 29, empty: 0, safe: false, freeze: 105, problem: null });
});

test('hold: only when nothing can fill the slot is it reported, for its real cause', () => {
  const nothing = { seconds: 2, built: 0, cue: null, empty: [[0, 2]] };
  assert.equal(slotStart({ timing: nothing, slot: 45, fps: FPS }).problem, 'content');
  // real blanks inside every window: the slot starts after the last and holds, it is not reported
  const gaps = { seconds: 3.5, built: 0.5, cue: null, empty: [[0, 0.3], [1, 1.3], [2, 2.3]] };
  assert.deepEqual(slotStart({ timing: gaps, slot: 45, fps: FPS }), { start: 69, empty: 0, safe: false, freeze: 105, problem: null });
});

test('timing: a row measured at another length than the scene now has is no timing', () => {
  const row = { seconds: 4, built: 0.9, cue: null, empty: [] };
  assert.equal(timingFor({ a: { confident: row } }, 'a', 'confident', 4), row);
  assert.equal(timingFor({ a: { confident: row } }, 'a', 'confident', 4.5), null);
  assert.equal(timingFor({ a: row }, 'a', 'calm', 3), null);
});

// ---------------------------------------------------------------- second visual check: slots weighed by build (R3), hold before the exit (R9), no silent start (R2)

test('hold: the held frame is the last fully built one, before the exit begins (an-type-slam)', () => {
  const slam = { ...ROW['slam (hype)'], exit: 2.6 };
  assert.deepEqual(slotStart({ timing: slam, slot: 90, fps: FPS, grace: 9 }), { start: 7, empty: 0, safe: false, freeze: 78, problem: null });
});

test('cue: a transition with no measured change point is reported, not started anywhere silently', () => {
  const luma = { seconds: 4.2, built: 0.267, cue: null, empty: [[0, 0.233]] };
  assert.equal(slotStart({ timing: luma, slot: 45, fps: FPS, transition: true }).problem, 'nocue');
  assert.equal(slotStart({ timing: luma, slot: 45, fps: FPS, transition: false }).problem, null);
});

test('need: a long build needs its build and a short read; a short entrance its lead and a read; a cue its lead and what follows', () => {
  assert.equal(READ_S, 0.3);
  // stat reel (hype): bars grow from 0.333 to 0.933 s, first slot (it may start in the clip's empty lead)
  assert.equal(sceneNeed({ seconds: 3.5, built: 0.933, cue: null, empty: [[0, 0.333]] }, FPS, { first: true }), 36);
  // the ring sweeps from its first frame to 0.833 s
  assert.equal(sceneNeed({ seconds: 3.5, built: 0.833, cue: null, empty: [] }, FPS), 34);
  // the count arrives in under 0.5 s: from built less the lead, plus the read, never below MIN_SLOT_S
  assert.equal(sceneNeed({ seconds: 3.5, built: 0.9, cue: null, empty: [[0, 0.433]] }, FPS), Math.round(MIN_SLOT_S * FPS));
  // a mark landing at 1.5 s: its lead, then the change and a short read (CHANGE_S), so three transitions fit in 3 s
  assert.equal(CHANGE_S, 0.6);
  assert.equal(sceneNeed({ seconds: 4.6, built: 0.367, cue: 1.5, empty: [[0, 0.333]] }, FPS), 27);
  // a scene built after its cue (a whip into a denser scene) also needs its built moment and a read
  assert.equal(sceneNeed({ seconds: 3.8, built: 2, cue: 1.7, empty: [[0, 0.233], [1.7, 1.833]] }, FPS), 27);
  assert.equal(sceneNeed({ seconds: 3.8, built: 2.4, cue: 1.7, empty: [[0, 0.233]] }, FPS), 39);
  assert.equal(sceneNeed(null, FPS), null);
});

test('slots: weighed by need within 3 s; the time left over is shared; unknown needs take an equal share', () => {
  // pui-data-bars-then-target: bars need 38 frames, the line 18: 56, and 34 over to share
  assert.deepEqual(slotLengths([38, 18]), { frames: [55, 35], over: 0 });
  // pui-data-stat-reel: 36 + 34 + 18 = 88 of 90
  assert.deepEqual(slotLengths([36, 34, 18]), { frames: [37, 35, 18], over: 0 });
  // a capture scene's need is not known ahead: it counts as an equal share
  assert.deepEqual(slotLengths([null, 20]), { frames: [58, 32], over: 0 });
  // more than 3 s of need: scaled to fit, and `over` says how much was needed
  const r = slotLengths([60, 50]);
  assert.equal(r.frames.reduce((a, b) => a + b, 0), 90);
  assert.equal(r.over, 110);
  assert.deepEqual(slotLengths([]), { frames: [], over: 0 });
});

test('need and start: a long build counts from where its action starts, with no lead (its content is already on screen)', () => {
  // the ring: track and label from 0 s, the sweep from 0.633 s, built (still) at 1.233 s
  const ring = { seconds: 3.5, built: 1.233, cue: null, empty: [], action: 0.633 };
  assert.equal(sceneNeed(ring, FPS), 27);
  assert.equal(slotStart({ timing: ring, slot: 30, fps: FPS }).start, 19);
  // with no action measured, as before: from the content's arrival
  assert.equal(sceneNeed({ ...ring, action: undefined }, FPS), 46);
});
