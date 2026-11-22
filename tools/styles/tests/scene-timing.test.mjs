// Task 5d: the motion library's standalone scenes expose no timing as data, so it is measured from one render of each.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { parseMetadata, analyzeScene, sceneList, reelOffsets, boxesFromColumns, mergeTimings, EMPTY_EDGE, BUILT_SHARE, CUE_FAMILIES } from '../lib/scene-timing.mjs';

test('metadata: ffmpeg metadata=print lines become one value per frame, in frame order', () => {
  const text = [
    'frame:0    pts:0       pts_time:0',
    'lavfi.signalstats.YAVG=0.12',
    'frame:1    pts:1       pts_time:0.0333',
    'lavfi.signalstats.YAVG=2.5',
    'frame:2    pts:2       pts_time:0.0667',
    'lavfi.cropdetect.x1=40',
    'lavfi.cropdetect.x2=420',
  ].join('\n');
  assert.deepEqual(parseMetadata(text, 'lavfi.signalstats.YAVG'), [0.12, 2.5, null]);
  assert.deepEqual(parseMetadata(text, 'lavfi.cropdetect.x1'), [null, null, 40]);
});

const fps = 10;
// A scene 2 s long at 10 fps: empty for 0.3 s, building to full by 0.8 s, a change at 1.4 s, empty again at the end.
const edges = [0, 0, 0, 1, 2, 3, 4, 4.5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 0.1, 0.1];
const page = edges.map((e) => (e < EMPTY_EDGE ? 1 : 20));
const motion = edges.map((_, i) => (i === 14 ? 9 : 1));
const boxes = edges.map((e) => (e < EMPTY_EDGE ? null : { x1: 100, x2: 299 }));

test('analysis: built is the first frame at BUILT_SHARE of the peak; empty spans are runs of empty frames, in seconds', () => {
  assert.equal(BUILT_SHARE, 0.8);
  const r = analyzeScene({ edges, page, motion, boxes, fps, seconds: 2, size: [480, 270], cue: false });
  assert.equal(r.seconds, 2);
  assert.equal(r.built, 0.8);
  assert.equal(r.cue, null);
  assert.deepEqual(r.empty, [[0, 0.3], [1.8, 2]]);
});

test('analysis: the cue is the biggest change after the build, for the families that have one', () => {
  const r = analyzeScene({ edges, page, motion, boxes, fps, seconds: 2, size: [480, 270], cue: true });
  assert.equal(r.cue, 1.4);
});

test('analysis: a flat colour that is not the page is not empty (a dip to colour)', () => {
  const flat = edges.map(() => 0);
  const coloured = edges.map(() => 40);
  const r = analyzeScene({ edges: flat, page: coloured, motion, boxes: flat.map(() => null), fps, seconds: 2, size: [480, 270], cue: false });
  assert.deepEqual(r.empty, []);
});

test('analysis: extent is the content\'s width about the middle, as a share of the frame height', () => {
  const r = analyzeScene({ edges, page, motion, boxes, fps, seconds: 2, size: [480, 270], cue: false });
  // middle 240; content from 100 to 300: 140 px each side at most, 280 / 270
  assert.equal(r.extent, +(280 / 270).toFixed(3));
});

test('scene list: names and lengths read from the motion library\'s own lists, capture files left out', () => {
  const list = sceneList();
  const byName = new Map(list.map((s) => [s.name, s]));
  assert.equal(byName.get('blur-in').seconds, 4);
  assert.equal(byName.get('feather-wipe').seconds, 4.5);
  assert.equal(byName.get('feather-wipe').sized, true);
  assert.equal(byName.get('bar-grow').sized, false);
  assert.ok(!byName.has('product-ring') && !byName.has('stage-card'));
  assert.ok(list.length >= 120, `${list.length} scenes`);
});

test('reel: each scene\'s first frame in the reel, after a lead of empty page', () => {
  assert.deepEqual(reelOffsets([{ name: 'a', seconds: 1 }, { name: 'b', seconds: 2.5 }], 30, 1), [{ name: 'a', from: 30, frames: 30 }, { name: 'b', from: 60, frames: 75 }]);
});

test('boxes: the columns with edges in each small grey edge frame, in full-frame pixels', () => {
  // two frames of 4 x 2 (scaled down 120 times from 480 wide): frame 0 has edges in columns 1 and 2, frame 1 none
  const w = 4, h = 2;
  const buf = Buffer.from([0, 90, 0, 0, 0, 0, 80, 0, /* frame 1 */ 0, 10, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(boxesFromColumns(buf, { width: w, height: h, scale: 120, threshold: 40 }), [{ x1: 120, x2: 359 }, null]);
});

test('stale guard: the committed table has a row for every scene and no other, each measured at the scene\'s length', () => {
  const studio = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const table = JSON.parse(readFileSync(join(studio, 'library', 'motion', 'scene-timing.json'), 'utf8')).scenes;
  const list = sceneList();
  assert.deepEqual(Object.keys(table).sort(), list.map((s) => s.name).sort());
  const stale = [];
  for (const s of list) for (const [energy, row] of Object.entries(table[s.name])) if (row.seconds !== s.seconds) stale.push(`${s.name} ${energy}: ${row.seconds} s measured, ${s.seconds} s in the code`);
  assert.deepEqual(stale, []);
});

test('measuring: rows for scenes no longer in the library are dropped, other energies kept', () => {
  const old = { gone: { confident: { seconds: 1 } }, kept: { calm: { seconds: 2 }, confident: { seconds: 2 } } };
  const merged = mergeTimings(old, [{ name: 'kept', seconds: 2 }, { name: 'new', seconds: 3 }], 'confident', { kept: { seconds: 2, built: 1 }, new: { seconds: 3, built: 1 } });
  assert.deepEqual(Object.keys(merged).sort(), ['kept', 'new']);
  assert.deepEqual(merged.kept.calm, { seconds: 2 });
  assert.deepEqual(merged.kept.confident, { seconds: 2, built: 1 });
});

test('analysis: a change before the built moment (the after-state is the denser one, a whip) is still the cue', () => {
  // content from 0.2 s at edge 2; the whip at 1.1 s; the after-state (edge 6) is built at 1.2 s
  const e = Array.from({ length: 20 }, (_, i) => (i < 2 ? 0 : i < 12 ? 2 : 6));
  const m = e.map((_, i) => (i === 11 ? 9 : i === 3 ? 3 : 1));
  const r = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion: m, boxes: e.map(() => null), fps: 10, seconds: 2, size: [480, 270], cue: true });
  assert.equal(r.built, 1.2);
  assert.equal(r.cue, 1.1);
});

// ---------------------------------------------------------------- second visual check (R1, R2, R9)

test('analysis: an empty dark page is empty too (a scene that opens on the dark page before its captions)', () => {
  const e = Array.from({ length: 20 }, (_, i) => (i < 8 ? 0 : 6));
  const light = e.map(() => 60); // far from the light page: it is dark
  const dark = e.map((x) => (x ? 30 : 2)); // the empty frames are the dark page
  const r = analyzeScene({ edges: e, page: light, dark, motion: e.map(() => 1), boxes: e.map(() => null), fps: 10, seconds: 2, size: [480, 270], cue: false });
  assert.deepEqual(r.empty, [[0, 0.8]]);
  // a flat colour that is neither page (a dip to colour) is still not empty
  const r2 = analyzeScene({ edges: e.map(() => 0), page: light, dark: e.map(() => 40), motion: e.map(() => 1), boxes: e.map(() => null), fps: 10, seconds: 2, size: [480, 270], cue: false });
  assert.deepEqual(r2.empty, []);
});

test('analysis: a slow change (a luma dissolve) above the scene\'s own grain is still the cue', () => {
  // grain level 0.45 a frame; the dissolve adds about 0.6 over 1.7 to 2.1 s; no single frame reaches 1.5
  const fps = 30;
  const n = 126;
  const motion = Array.from({ length: n }, (_, i) => (i === 6 ? 4 : i >= 51 && i <= 63 ? 1.05 + (i === 57 ? 0.15 : 0) : 0.45));
  const e = Array.from({ length: n }, (_, i) => (i < 7 ? 0 : 5));
  const r = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion, boxes: e.map(() => null), fps, seconds: 4.2, size: [480, 270], cue: true });
  assert.equal(r.cue, 1.9);
  // grain alone is no cue
  const flat = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion: motion.map((m, i) => (i === 6 ? 4 : 0.45 + (i % 2) * 0.05)), boxes: e.map(() => null), fps, seconds: 4.2, size: [480, 270], cue: true });
  assert.equal(flat.cue, null);
});

test('analysis: exit is where a scene that leaves stops being fully built (slam: built, held, then blurs out)', () => {
  // built from 0.5 s, starts to blur at 2.6 s (edges fall), gone from 2.9 s
  const fps = 10;
  const e = Array.from({ length: 35 }, (_, i) => (i < 4 ? 0 : i < 5 ? 3 : i < 26 ? 6 : i < 29 ? 2 : 0));
  const r = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion: e.map(() => 1), boxes: e.map(() => null), fps, seconds: 3.5, size: [480, 270], cue: false });
  assert.deepEqual(r.empty, [[0, 0.4], [2.9, 3.5]]);
  assert.equal(r.exit, 2.6);
  // a scene that never leaves has no exit
  assert.equal(analyzeScene({ edges: e.map((x, i) => (i < 4 ? 0 : 6)), page: e.map((x, i) => (i < 4 ? 1 : 20)), motion: e.map(() => 1), boxes: e.map(() => null), fps, seconds: 3.5, size: [480, 270], cue: false }).exit, null);
});

test('cue families: a mark or emphasis landing on its line is a change to keep, as a transition is', () => {
  assert.ok(CUE_FAMILIES.has('emphasis'));
  assert.ok(CUE_FAMILIES.has('transition'));
});

test('analysis: the exit is measured against the scene\'s last look, not its peak (captions that get smaller)', () => {
  // a big caption to 1.0 s, a smaller one from 1.1 s, which blurs out from 2.6 s and is gone at 2.9 s
  const fps = 10;
  const e = Array.from({ length: 35 }, (_, i) => (i < 2 ? 0 : i < 11 ? 8 : i < 26 ? 5 : i < 29 ? 2 : 0));
  const r = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion: e.map(() => 1), boxes: e.map(() => null), fps, seconds: 3.5, size: [480, 270], cue: false });
  assert.equal(r.exit, 2.6);
});

test('analysis: the cue is looked for before the scene leaves (a mark, not its exit)', () => {
  // the text is on from 0.4 s, the mark lands at 1.4 s (a small change), the scene leaves at 4.2 s (a big one)
  const fps = 30;
  const n = 138;
  const e = Array.from({ length: n }, (_, i) => (i < 10 ? 0 : i < 126 ? 5 : 0));
  const motion = Array.from({ length: n }, (_, i) => (i >= 40 && i <= 46 ? (i === 42 ? 2 : 1.5) : i >= 118 && i <= 128 ? 4 : 0.4));
  const r = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion, boxes: e.map(() => null), fps, seconds: 4.6, size: [480, 270], cue: true });
  assert.equal(r.cue, 1.4);
});

test('authored cue: a scene whose mark the scan cannot see (a thin bracket) states its moment in its list, and that wins', () => {
  const byName = new Map(sceneList().map((s) => [s.name, s]));
  assert.equal(byName.get('mark-word-bracket').cue, 1.4);
  assert.equal(byName.get('focus-pull').cue, 1.3);
  assert.equal(byName.get('lift').cue, 1.2);
  assert.equal(byName.get('blur-in').cue, null);
  const e = Array.from({ length: 46 }, (_, i) => (i < 3 ? 0 : 5));
  const base = { edges: e, page: e.map((x) => (x ? 20 : 1)), motion: e.map(() => 0.3), boxes: e.map(() => null), fps: 10, seconds: 4.6, size: [480, 270] };
  assert.equal(analyzeScene({ ...base, cue: true }).cue, null);
  assert.equal(analyzeScene({ ...base, cue: true, authored: 1.4 }).cue, 1.4);
});

test('analysis: built waits for the frame to go still (a ring that keeps sweeping after its track and label are drawn)', () => {
  // track and label from 0.2 s, edges at 80% by 0.8 s while the ring still sweeps (motion 1.0 to 1.1 s), still from 1.2 s
  const fps = 10;
  const e = Array.from({ length: 35 }, (_, i) => (i < 2 ? 0 : i < 8 ? 4 : 6));
  const motion = e.map((_, i) => (i >= 7 && i <= 11 ? 1 : 0.4));
  const r = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion, boxes: e.map(() => null), fps, seconds: 3.5, size: [480, 270], cue: false });
  assert.equal(r.built, 1.2);
  // never past the scene's cue: a transition's later change does not count as its build
  const r2 = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion: e.map((_, i) => (i === 22 ? 3.5 : i >= 20 && i <= 24 ? 3 : 0.4)), boxes: e.map(() => null), fps, seconds: 3.5, size: [480, 270], cue: true });
  assert.equal(r2.cue, 2.2);
  assert.equal(r2.built, 0.8);
});

test('analysis: action is where the build\'s run of change starts (the ring\'s sweep, not its track); content when the run is too quiet to see', () => {
  const fps = 10;
  const e = Array.from({ length: 35 }, (_, i) => (i < 2 ? 0 : i < 8 ? 4 : 6));
  const motion = e.map((_, i) => (i >= 7 && i <= 11 ? 1 : 0.4));
  assert.equal(analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion, boxes: e.map(() => null), fps, seconds: 3.5, size: [480, 270], cue: false }).action, 0.7);
  // typing barely changes the frame: its action is its content's arrival
  const quiet = analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion: e.map(() => 0.4), boxes: e.map(() => null), fps, seconds: 3.5, size: [480, 270], cue: false });
  assert.equal(quiet.action, 0.2);
});

test('analysis: a build in steps (a caption lighting word by word, 0.2 s apart) is one action from its first step', () => {
  const fps = 10;
  const e = Array.from({ length: 30 }, (_, i) => (i < 2 ? 0 : i < 13 ? 4 : 6));
  const motion = e.map((_, i) => ([3, 6, 9, 12].includes(i) ? 2 : 0.4));
  assert.equal(analyzeScene({ edges: e, page: e.map((x) => (x ? 20 : 1)), motion, boxes: e.map(() => null), fps, seconds: 3, size: [480, 270], cue: false }).action, 0.3);
});
