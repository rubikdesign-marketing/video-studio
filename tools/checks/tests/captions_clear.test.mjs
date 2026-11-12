// Tests for the captions-clear-of-UI rule (tools/checks/captions_clear.mjs). Run: node --test tools/checks/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captionClashes } from '../captions_clear.mjs';

const W = 1920;
const H = 1080;
const line = (text, start, end) => ({ start, end, words: text.split(' ').map((t, i) => ({ text: t, start: start + i * 0.2, end: start + i * 0.2 + 0.18 })) });
const film = (captions, position = 'bottom') => ({ width: W, height: H, captions, scenes: [{ id: 'S01', start: 0, end: 10, captions: position }] });
// A placement as placeCapture returns it, with one button and one click on it at 4 s.
const placement = (box) => ({
  scene: 'S01',
  start: 0,
  end: 10,
  moments: [{ kind: 'click', name: 'New', t: 4, focus: box, focusName: 'New' }],
  thingsAt: (t) => (t >= 0 && t <= 10 ? [{ name: 'New', tracked: false, box }] : []),
});

test('a caption over the clicked button at the click fails', () => {
  const button = { x: 900, y: 940, width: 120, height: 40 }; // inside the bottom caption band (929 to 1015)
  const clashes = captionClashes(film({ lines: [line('Add a lead in one click', 3.5, 4.8)] }), [placement(button)]);
  assert.ok(clashes.length >= 1);
  assert.equal(clashes[0].what, 'New');
  assert.equal(clashes[0].moment, 'click');
  assert.ok(Math.abs(clashes[0].t - 4) < 0.01);
});

test('the same button with the caption moved to the top passes', () => {
  const button = { x: 900, y: 940, width: 120, height: 40 };
  assert.deepEqual(captionClashes(film({ lines: [line('Add a lead in one click', 3.5, 4.8)] }, 'top'), [placement(button)]), []);
});

test('a button beside a short caption passes', () => {
  const button = { x: 1700, y: 950, width: 120, height: 40 };
  assert.deepEqual(captionClashes(film({ lines: [line('Add a lead', 3.5, 4.8)] }), [placement(button)]), []);
});

test('no caption on screen at the click passes', () => {
  const button = { x: 900, y: 940, width: 120, height: 40 };
  assert.deepEqual(captionClashes(film({ lines: [line('Add a lead in one click', 6, 7)] }), [placement(button)]), []);
});

test('a tracked thing under a caption between key moments is caught too', () => {
  const p = placement({ x: 0, y: 0, width: 10, height: 10 });
  p.moments = [];
  p.thingsAt = (t) => [{ name: 'card', tracked: true, box: { x: 800, y: 900, width: 300, height: 100 } }];
  const clashes = captionClashes(film({ lines: [line('Watch the card', 1, 2)] }), [p]);
  assert.ok(clashes.some((c) => c.what === 'card' && c.moment === 'tracked'));
});
