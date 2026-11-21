// Task 5d: the motion library's standalone scenes expose no timing as data, so it is measured from one render of each.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMetadata, analyzeScene, sceneList, reelOffsets, boxesFromColumns, EMPTY_EDGE, BUILT_SHARE } from '../lib/scene-timing.mjs';

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
