// Tests for lib.ts. Run: node --test --experimental-strip-types engine/src/jobs/rubik-ep1/lib.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { beatAt, capPlan, resolveBeats, spotlightLevel, checkMarks, contains, cueTime, findWord, fitView, groupCueTime, markBoxAt, pageBox, perimeterPoint, zoomOf, scrollAt, srcAt, viewAt, viewBox, type Box, type Word } from './lib.ts';

const words = (...ws: string[]): Word[] => ws.map((w, i) => ({ w, t0: 10 + i, t1: 10.8 + i }));

test('a cue matches the whole word, not a word that contains it ("call" in "basically")', () => {
  assert.equal(findWord(words('basically', 'we', 'call', 'them'), 'call')?.w, 'call');
});

test('"AI" matches "AI." and not "said"', () => {
  assert.equal(findWord(words('said', 'the', 'AI.'), 'AI')?.w, 'AI.');
});

test('punctuation in the cue is kept when given', () => {
  assert.equal(findWord(words('do', 'what', 'do?'), 'do?')?.w, 'do?');
  assert.equal(findWord(words('nerds', 'by', 'nerds.'), 'nerds.')?.w, 'nerds.');
});

test('with no whole word, falls back to a word starting with the cue, then one containing it', () => {
  assert.equal(findWord(words('the', 'integrations', 'part'), 'integration')?.w, 'integrations');
  assert.equal(findWord(words('the', 'testimonials,', 'part'), 'monial')?.w, 'testimonials,');
});

test('cueTime: seconds from the shot start, a number unchanged, a miss gives the default', () => {
  const ws = words('basically', 'we', 'call');
  assert.equal(cueTime(ws, 9, 'call'), 3);
  assert.equal(cueTime(ws, 9, 1.5), 1.5);
  assert.equal(cueTime(ws, 9, 'nothing', 0.7), 0.7);
  assert.equal(cueTime(ws, 9, undefined, 0.2), 0.2);
});

test('groupCueTime: first shot holding the word, as seconds from the group start', () => {
  const shots = [{ start: 0, words: words('basically', 'so') }, { start: 12, words: [{ w: 'call', t0: 13, t1: 13.4 }] }];
  assert.equal(groupCueTime(shots, 'call', 0, 99), 13);
  assert.equal(groupCueTime(shots, 'missing', 0, 99), 99);
});

test('the voice clock is unchanged: 16035 frames, as rendered in v2', () => {
  const T = JSON.parse(fs.readFileSync(new URL('./timeline.json', import.meta.url), 'utf8'));
  assert.equal(Math.round(T.duration * T.fps), 16035);
});

// ---- highlights on a scrolling page, and views that hold them
test('scrollAt is linear between samples and clamped at both ends', () => {
  const tr: [number, number][] = [[0, 0], [1, 100]];
  assert.equal(scrollAt(tr, 0.5), 50);
  assert.equal(scrollAt(tr, -1), 0);
  assert.equal(scrollAt(tr, 9), 100);
});

test('a box marked at scroll 0 is 400 px higher once the page has scrolled 400 px', () => {
  assert.deepEqual(viewBox(pageBox([323, 358, 415, 536], 0), 400), [323, -42, 415, 536]);
  assert.deepEqual(viewBox(pageBox([10, 20, 30, 40], 300), 300), [10, 20, 30, 40]);
});

test('fitView holds the box with its margin, at 16:9', () => {
  const b: Box = [292, 166, 426, 268];
  const v = fitView([b], { margin: 40, minW: 640 });
  assert.ok(contains(v, b));
  assert.ok(Math.abs(v[2] / v[3] - 16 / 9) < 0.01);
  assert.ok(v[0] <= b[0] - 40 && v[1] <= b[1] - 40);
});

test('fitView of a box touching the right edge stays inside the 1920 x 1080 page', () => {
  const v = fitView([[1700, 500, 220, 100]], { margin: 40, minW: 640 });
  assert.ok(v[0] >= 0 && v[1] >= 0 && v[0] + v[2] <= 1920.001 && v[1] + v[3] <= 1080.001);
  assert.ok(contains(v, [1700, 500, 220, 100]));
});

test('fitView holds every box it is given, and is never narrower than minW', () => {
  const bs: Box[] = [[323, 358, 415, 536], [758, 358, 415, 536], [1189, 358, 415, 536]];
  const v = fitView(bs, { margin: 30, minW: 640 });
  for (const b of bs) assert.ok(contains(v, b));
  assert.ok(fitView([[900, 500, 20, 20]], { margin: 10, minW: 640 })[2] >= 640);
});

test('contains is false when the inner box sticks out', () => {
  assert.equal(contains([0, 0, 100, 100], [50, 50, 60, 10]), false);
  assert.equal(contains([0, 0, 100, 100], [0, 0, 100, 100]), true);
});

// ---- capture timing, the zoomed view, and the in-view check
test('capPlan: the speed that reaches `to` by the shot end, kept between 0.4 and 2.6', () => {
  assert.equal(capPlan(30, 2, 6, 4).rate, 1);
  assert.equal(capPlan(30, 0, 20, 4).rate, 2.6);
  const p = capPlan(30, 5, undefined, 3, 1);
  assert.equal(p.rate, 1); assert.equal(p.playable, 3);
});

test('srcAt follows the capture clock, holds at its end, and stays put for a still', () => {
  const p = capPlan(10, 2, 4, 4); // rate 0.5
  assert.equal(srcAt(p, 2, 1, false), 2.5);
  assert.equal(srcAt(p, 2, 99, false), 4);
  assert.equal(srcAt(p, 2, 1, true), 2);
});

test('viewAt eases from the start box to the end box over the zoom span', () => {
  const a: Box = [0, 0, 1920, 1080]; const b: Box = [480, 270, 960, 540];
  assert.deepEqual(viewAt({ from: a, to: b }, 1, 2, 0.5), a);
  assert.deepEqual(viewAt({ from: a, to: b }, 1, 2, 3.5), b);
  assert.deepEqual(viewAt(undefined, 0, 1, 0.5), a);
});

test('markBoxAt moves a marked box up as the page scrolls past it', () => {
  const track: [number, number][] = [[0, 0], [2, 200]];
  assert.deepEqual(markBoxAt([100, 500, 50, 50], 0, track, 1), [100, 400, 50, 50]);
});

test('checkMarks reports a ring cut off by its zoom, and passes one inside it', () => {
  const T = { shots: [{ n: 1, start: 0, end: 4, words: [] }] };
  const marks = { cap: { scroll: [[0, 0]] as [number, number][], marks: {} } };
  const inside = { 1: { type: 'site', cap: 'cap', from: 0, rings: [{ at: 0, box: [500, 300, 200, 100] }], zoom: { to: [400, 225, 960, 540] } } };
  const cut = { 1: { type: 'site', cap: 'cap', from: 0, rings: [{ at: 0, box: [100, 100, 200, 100] }], zoom: { from: [400, 225, 960, 540], to: [400, 225, 960, 540] } } };
  assert.equal(checkMarks(inside, T, marks, { cap: 10 }).filter((r) => !r.ok).length, 0);
  assert.equal(checkMarks(cut, T, marks, { cap: 10 }).filter((r) => !r.ok).length, 1);
});

test('focus: the zoom ends on a 16:9 view that holds every highlight, with its margin', () => {
  const shot = { n: 1, start: 0, end: 4, words: [] };
  const sp = { type: 'site', cap: 'cap', from: 0, rings: [{ at: 0, box: [292, 166, 426, 268] as Box }], focus: { margin: 48 } };
  const z = zoomOf(sp, shot, { cap: { scroll: [[0, 0]], marks: {} } }, { cap: 10 });
  assert.ok(z && contains(z.to, [292 - 48, 166 - 48, 426 + 96, 268 + 96]));
  const T = { shots: [shot] };
  assert.equal(checkMarks({ 1: sp }, T, { cap: { scroll: [[0, 0]], marks: {} } }, { cap: 10 }).filter((r) => !r.ok).length, 0);
});

test('a shot with its own zoom keeps it', () => {
  const shot = { n: 1, start: 0, end: 4, words: [] };
  const zoom = { to: [1, 2, 1600, 900] as Box };
  assert.deepEqual(zoomOf({ type: 'site', cap: 'cap', from: 0, zoom }, shot, { cap: { scroll: [[0, 0]], marks: {} } }, { cap: 10 })?.to, zoom.to);
});

test('perimeterPoint walks the box clockwise from its top-left corner', () => {
  const r = (p: [number, number]) => p.map((v) => Math.round(v * 1e6) / 1e6);
  assert.deepEqual(r(perimeterPoint(100, 50, 0)), [0, 0]);
  assert.deepEqual(r(perimeterPoint(100, 50, 100 / 300)), [100, 0]);
  assert.deepEqual(r(perimeterPoint(100, 50, 150 / 300)), [100, 50]);
  assert.deepEqual(r(perimeterPoint(100, 50, 250 / 300)), [0, 50]);
  assert.deepEqual(r(perimeterPoint(100, 50, 1)), [0, 0]);
  assert.deepEqual(r(perimeterPoint(100, 50, 275 / 300)), [0, 25]);
});

// ---- beats: go to what he names, frame it, hold
test('beatAt holds the first beat before anything is named', () => {
  const b = [{ t: 1, src: 5, view: [0, 0, 1920, 1080] as Box }, { t: 3, src: 9, view: [400, 200, 960, 540] as Box }];
  assert.deepEqual(beatAt(b, 0.2), { src: 5, view: [0, 0, 1920, 1080] });
  assert.deepEqual(beatAt(b, 2.5), { src: 5, view: [0, 0, 1920, 1080] });
});

test('beatAt moves to the next beat over 0.8 s, playing the capture forward, then holds', () => {
  const b = [{ t: 0, src: 5, view: [0, 0, 1920, 1080] as Box }, { t: 3, src: 9, view: [400, 200, 960, 540] as Box }];
  const mid = beatAt(b, 3.4);
  assert.ok(mid.src > 5 && mid.src < 9);
  assert.ok(mid.view[2] < 1920 && mid.view[2] > 960);
  assert.deepEqual(beatAt(b, 3.8), { src: 9, view: [400, 200, 960, 540] });
  assert.deepEqual(beatAt(b, 10), { src: 9, view: [400, 200, 960, 540] });
});

test('going back up the page cuts straight to the earlier moment instead of playing it backwards', () => {
  const b = [{ t: 0, src: 20, view: [0, 0, 1920, 1080] as Box }, { t: 2, src: 4, view: [0, 0, 1920, 1080] as Box }];
  assert.equal(beatAt(b, 2.01).src, 4);
  assert.equal(beatAt(b, 1.99).src, 20);
});

test('a beat with play: the capture runs on from its moment while it holds the view', () => {
  const b = [{ t: 0, src: 5, view: [0, 0, 1920, 1080] as Box, play: 1 }];
  assert.equal(beatAt(b, 2).src, 7);
});

test('resolveBeats: a beat named by a mark starts at that mark; no view means the whole page', () => {
  const shot = { n: 1, start: 10, end: 20, words: [{ w: 'features', t0: 13, t1: 13.5 }] };
  const marks = { cap: { scroll: [[0, 0]] as [number, number][], marks: { feat: { t: 21.4, scroll: 6691 } } } };
  const b = resolveBeats({ type: 'site', cap: 'cap', from: 0, beats: [{ at: 0, src: 1 }, { at: 'features', mark: 'feat', view: [100, 100, 960, 540] }] }, shot, marks);
  assert.deepEqual(b, [{ t: 0, src: 1, view: [0, 0, 1920, 1080], play: undefined }, { t: 3, src: 21.4, view: [100, 100, 960, 540], play: undefined }]);
});

test('checkMarks follows the beats: a ring inside the beat it shows in passes, one outside is cut', () => {
  const T = { shots: [{ n: 1, start: 0, end: 4, words: [] }] };
  const marks = { cap: { scroll: [[0, 0]] as [number, number][], marks: {} } };
  const sp = (box: Box) => ({ 1: { type: 'site', cap: 'cap', from: 0, beats: [{ at: 0, src: 2, view: [400, 225, 960, 540] as Box }], rings: [{ at: 1, box }] } });
  assert.equal(checkMarks(sp([500, 300, 200, 100]), T, marks, { cap: 10 }).filter((r) => !r.ok).length, 0);
  assert.equal(checkMarks(sp([100, 100, 200, 100]), T, marks, { cap: 10 }).filter((r) => !r.ok).length, 1);
});

test('a spotlight carried over from the shot before is fully on from the first frame (no blink at the cut)', () => {
  assert.equal(spotlightLevel(0, 0, true), 1);
  assert.equal(spotlightLevel(0, 0, false), 0);
  assert.equal(spotlightLevel(0.6, 0, false), 1);
  assert.equal(spotlightLevel(0.1, 0.5, false), 0);
});
