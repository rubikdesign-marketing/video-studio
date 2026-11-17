// Tests for the hook library's validator, and for the library itself. Run: node --test tools/hooks/tests/*.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { HOOKS_DIR, loadLibrary, normalise, validate } from '../lib/library.mjs';
import { measure } from '../lib/pick.mjs';

const formula = (over = {}) => ({ id: 'question-still', family: 'question', name: 'Still doing it by hand', spoken: 'Are you still {old way}?', example: 'Are you still copying numbers between two tabs?',
  on_screen: 'Still doing this by hand', first_frame: 'The old way on screen, mid-task', suits: { types: ['promo'], platforms: ['reels'], awareness: ['problem-aware'] }, trap: 'The old way must be one the viewer really has.', source: 's', status: 'untested', ...over });
const lib = (formulas, over = {}) => ({ families: [{ id: 'question', name: 'Question', what: 'asks' }], sources: [{ id: 's', name: 'S', url: 'https://example.org', licence: 'MIT' }], formulas, avoid: [], ...over });

test('a sound library has no problems', () => {
  assert.deepEqual(validate(lib([formula(), formula({ id: 'q2', spoken: 'What if {task} took a minute?' }), formula({ id: 'q3', spoken: 'Why does {task} take so long?' })])), []);
});

test('the validator names each kind of problem', () => {
  const has = (l, re) => assert.ok(validate(l, { minPerFamily: 1 }).some((p) => re.test(p)), `${re} not in ${JSON.stringify(validate(l, { minPerFamily: 1 }))}`);
  has(lib([formula(), formula()]), /used twice/);
  has(lib([formula(), formula({ id: 'other', spoken: 'are you STILL {the old way}' })]), /same spoken line/);
  has(lib([formula({ family: 'nope' })]), /family "nope"/);
  has(lib([formula({ source: 'nope' })]), /source "nope"/);
  has(lib([formula({ status: 'proven' })]), /untested/);
  has(lib([formula({ on_screen: 'one two three four five six seven eight' })]), /8 words/);
  has(lib([formula({ example: 'Cut your costs by 40% this week' })]), /makes a claim/);
  has(lib([formula({ example: 'A proven way to plan' })]), /makes a claim/);
  has(lib([formula({ suits: { types: ['film'], platforms: ['reels'], awareness: ['cold'] } })]), /suits.types has "film"/);
  has(lib([formula({ trap: '' })]), /"trap" is missing/);
  has(lib([formula()], { sources: [{ id: 's', licence: 'CC BY-NC 4.0' }] }), /not one that allows copying/);
  assert.ok(validate(lib([formula()])).some((p) => /family question: 1 formulas/.test(p)));
  has(lib([formula()], { avoid: [{ pattern: '(', why: 'x' }] }), /not a valid pattern/);
  has(lib([formula()], { avoid: [{ pattern: '', why: 'x' }] }), /no pattern/);
  has(lib([formula()], { avoid: [{ why: 'x' }] }), /no pattern/);
  assert.ok(validate({ families: [], sources: [], formulas: [], avoid: [] }).some((p) => /no formulas/.test(p)));
});

test('normalise ignores case, punctuation and slot names, and keeps figures', () => {
  assert.equal(normalise('Are you STILL {old way}?'), normalise('are you still {the previous method}'));
  assert.notEqual(normalise('3 mistakes with {thing}'), normalise('5 mistakes with {thing}'));
});

test('the studio\'s own hook library is sound, and big enough to choose from', { skip: !fs.existsSync(path.join(HOOKS_DIR, 'index.json')) && 'library/hooks/index.json is not there yet' }, () => {
  const real = loadLibrary();
  assert.deepEqual(validate(real), []);
  assert.ok(real.formulas.length >= 120, `${real.formulas.length} formulas`);
  assert.ok(real.families.length >= 8);
  assert.ok(real.avoid.length >= 10);
  // The library keeps its own rules: no formula opens in a way the avoid list forbids, and no example runs long.
  for (const f of real.formulas) {
    assert.deepEqual(measure(f.spoken, { avoid: real.avoid }).avoid_hits, [], `${f.id}: its spoken line is on the avoid list`);
    const m = measure(f.example, { avoid: real.avoid });
    assert.deepEqual(m.avoid_hits, [], `${f.id}: its example is on the avoid list`);
    assert.ok(m.seconds <= 7, `${f.id}: its example takes ${m.seconds} s to say`);
  }
});

test('a picture-first formula (all slots) is told apart by what its slots say', () => {
  assert.notEqual(normalise('{Short line describing what just broke}.'), normalise('{Plain statement of the number on screen}.'));
});
