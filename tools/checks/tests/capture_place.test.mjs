// Tests for tools/checks/lib/capture_place.mjs, on Tulvo's boards take 5 (read only).
// Run: node --test tools/checks/tests/*.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { STUDIO } from '../lib/film.mjs';
import { placeCapture } from '../lib/capture_place.mjs';

const take = path.join(STUDIO, 'jobs/_tulvo-capture-test/capture/boards/take-5');
// The Tulvo take is the test material; on a copy of the studio without it, these tests are skipped.
const skip = !fs.existsSync(path.join(take, 'cursor.json')) && 'Tulvo boards take 5 is not in this copy of the studio';

test('moments: the click, the hover and the three marks, in film time after the start', { skip }, async () => {
  const p = await placeCapture({ takeDir: take, clip: {}, start: 2, place: { x: 0, y: 0, width: 1920 } }, { width: 1920, height: 1080 });
  const kinds = p.moments.map((m) => m.kind);
  assert.deepEqual(kinds.filter((k) => k === 'mark').length, 3);
  const click = p.moments.find((m) => m.kind === 'click');
  assert.equal(click.name, 'Campaign Launch Board');
  assert.ok(click.t > 2, 'after the clip starts');
  assert.ok(p.moments.some((m) => m.kind === 'hover' && m.name === 'New'));
  // Moments are in film order.
  for (let i = 1; i < p.moments.length; i++) assert.ok(p.moments[i].t >= p.moments[i - 1].t);
});

test('with the camera still, a page box lands where the clip is placed, scaled to its width', { skip }, async () => {
  const p = await placeCapture({ takeDir: take, clip: { camera: { auto: false } }, start: 0, place: { x: 100, y: 50, width: 960 } }, { width: 1920, height: 1080 });
  const click = p.moments.find((m) => m.kind === 'click');
  const b = click.focus;
  assert.ok(Math.abs(b.x - 106) < 0.01, `x ${b.x}`);
  assert.ok(Math.abs(b.y - 240.75) < 0.01, `y ${b.y}`);
  assert.ok(Math.abs(b.width - 111.5) < 0.01);
  assert.ok(Math.abs(b.height - 16) < 0.01);
  assert.ok(Math.abs(click.scale - 0.5) < 1e-6, 'frame pixels per page pixel');
});

test('with a push in on the click, the clicked thing is larger in the frame at the click', { skip }, async () => {
  const still = await placeCapture({ takeDir: take, clip: { camera: { auto: false } }, start: 0 }, { width: 1920, height: 1080 });
  const pushed = await placeCapture({ takeDir: take, clip: { camera: { auto: false }, moves: [{ move: 'push-in', to: { click: 1 }, at: 0.5 }] }, start: 0 }, { width: 1920, height: 1080 });
  const a = still.moments.find((m) => m.kind === 'click');
  const b = pushed.moments.find((m) => m.kind === 'click');
  assert.ok(b.scale > a.scale * 1.3, `${b.scale} against ${a.scale}`);
  assert.ok(b.focus.height > a.focus.height * 1.3);
});

test('things at a film time: the step targets on screen then, in frame pixels', { skip }, async () => {
  const p = await placeCapture({ takeDir: take, clip: { camera: { auto: false } }, start: 0 }, { width: 1920, height: 1080 });
  const late = p.thingsAt(p.end - 0.1).map((t) => t.name);
  assert.ok(late.includes('New'));
});
