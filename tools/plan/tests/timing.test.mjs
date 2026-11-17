// Tests for script line timings. Run: node --test tools/plan/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineTimes, spoken, wordCount } from '../lib/timing.mjs';

const script = [
  { id: '01', text: '[calm, inviting] Imagine your whole week on one board.', gap_after: 0.5, beat: 'hook', energy: 4 },
  { id: '02', text: '[warm] Every task, every file, every person.', gap_after: 0.7 },
  { id: '03', text: 'Try it free today.' },
];

test('directions are not spoken', () => {
  assert.equal(spoken('[calm, inviting] Imagine your week.'), 'Imagine your week.');
  assert.equal(wordCount('[x] one two  three [y]'), 3);
});

test('without the voice, times are estimated at 2.5 words a second with each line\'s pause', () => {
  const r = lineTimes(script);
  assert.equal(r.measured, false);
  assert.deepEqual(r.lines.map((l) => [l.start, l.end]), [[0.3, 3.1], [3.6, 6], [6.7, 8.3]]);
  assert.equal(r.lines[0].beat, 'hook'); assert.equal(r.lines[0].energy, 4); assert.equal(r.lines[1].beat, null);
});

test('the voice\'s own times are used when there; a line it lacks is estimated and named', () => {
  const r = lineTimes(script, { lines: [{ id: '01', start: 0.2, end: 2.9 }, { id: '02', start: 3.4, end: 6.0 }] });
  assert.equal(r.measured, true); assert.deepEqual(r.estimated, ['03']);
  assert.deepEqual(r.lines.map((l) => [l.start, l.end]), [[0.2, 2.9], [3.4, 6], [6.7, 8.3]]);
});
