// Tests for lib.ts. Run: node --test --experimental-strip-types engine/src/jobs/rubik-ep1/lib.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { cueTime, findWord, groupCueTime, type Word } from './lib.ts';

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
