import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAnswer, checkAnswer, HOOK_FAMILIES, questions } from '../lib/brief.mjs';

const base = () => ({ brand: 'acme', references: [{ source: 'their reel', liked_for: [] }] });

test('answers: choice questions carry their field and choices, open ones carry none', () => {
  const q = questions(base());
  const size = q.find((x) => x.id === 'size');
  assert.equal(size.field, 'size');
  assert.deepEqual(size.choices.map((c) => c.value), ['9:16', '1:1', '4:5', '16:9']);
  assert.equal(size.choices.find((c) => c.value === '9:16').recommended, true);
  assert.equal(q.find((x) => x.id === 'ref-0').many, true);
  assert.equal(q.find((x) => x.id === 'angle').choices, null);
});

test('answers: plain words map to a value, anything else is refused with a reason', () => {
  assert.deepEqual(checkAnswer({}, 'audience', 'Problem aware'), { ok: true, field: 'awareness', value: 'problem-aware', reason: null });
  assert.equal(checkAnswer({}, 'look', 'colour field').value, 'colour-field');
  const bad = checkAnswer({}, 'look', 'neon');
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /paper, night, glass/);
  assert.ok(HOOK_FAMILIES.includes('demonstration'));
});

test('answers: applyAnswer fills the field so the question is not asked again', () => {
  let b = applyAnswer(base(), 'size', { value: '9:16' });
  assert.equal(b.deliver[0].size, '9:16');
  b = applyAnswer(b, 'audience', { value: 'cold', words: 'agency owners' });
  assert.equal(b.awareness, 'cold'); assert.equal(b.for, 'agency owners');
  b = applyAnswer(b, 'ref-0', { value: ['pacing', 'sound'] });
  assert.deepEqual(b.references[0].liked_for, ['pacing', 'sound']);
  b = applyAnswer(b, 'hook', { value: 'demonstration', words: 'the export lands first' });
  assert.deepEqual(b.hook, { family: 'demonstration', idea: 'the export lands first' });
  b = applyAnswer(b, 'proof', { words: 'export to PDF' });
  assert.deepEqual(b.must_show, [{ what: 'export to PDF', evidence: '' }]);
  const ids = questions(b).map((x) => x.id);
  for (const id of ['size', 'audience', 'ref-0', 'hook', 'proof']) assert.ok(!ids.includes(id), id);
});

test('answers: "none" for the reference means the studio chooses', () => {
  const b = applyAnswer({ brand: 'acme' }, 'reference', { value: 'none' });
  assert.equal(b.no_reference, true);
});

test('answers: an invalid answer throws and leaves the brief untouched', () => {
  const b = base();
  assert.throws(() => applyAnswer(b, 'kind', { value: 'documentary' }), /kind must be one of/);
  assert.throws(() => applyAnswer(b, 'nonsense', { value: 'x' }), /No question nonsense/);
  assert.equal(b.kind, undefined);
});
