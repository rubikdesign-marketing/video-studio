// Tests for the repair conductor's pure parts (FOOTAGE-PLAN.md phase 3). Run: node --test tools/footage/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kept, speechSegments } from '../lib/repair.mjs';
import { roomBeds } from '../lib/rough.mjs';

test('the guard keeps a repair only when the voice and overall scores hold', () => {
  const before = { SIG: 3.3, BAK: 3.1, OVRL: 2.7 };
  assert.equal(kept(before, { SIG: 3.28, BAK: 3.9, OVRL: 3.0 }), true);
  assert.equal(kept(before, { SIG: 3.2, BAK: 4.0, OVRL: 3.0 }), false); // cleaner background, but the voice suffered
  assert.equal(kept(before, { SIG: 3.4, BAK: 3.5, OVRL: 2.6 }), false);
});

test('speech is scored sentence by sentence, with a little room', () => {
  const w = [{ text: 'Hello', start: 1, end: 1.3 }, { text: 'there.', start: 1.35, end: 1.8 }, { text: 'Next', start: 3, end: 3.4 }];
  assert.deepEqual(speechSegments(w), [{ id: 1, start: 0.9, end: 2 }, { id: 2, start: 2.9, end: 3.6 }]);
});

test('the room is evened toward the noisiest audible room, never from silence, never with a big lift', () => {
  const beds = roomBeds({ a: -61, b: -120, c: -62 }, { a: -62, b: -120, c: -63 });
  assert.equal(beds.b.bed, 'a');
  assert.ok(Math.abs(beds.b.gainDb - 1) < 0.1);
  assert.equal(beds.c, undefined); // within 2 dB already
  assert.deepEqual(roomBeds({ a: -80, b: -120 }, { a: -80, b: -120 }), {}); // nothing audible to match
  assert.deepEqual(roomBeds({ a: -40, b: -120 }, { a: -70, b: -120 }), {}); // would need a 30 dB lift
});
