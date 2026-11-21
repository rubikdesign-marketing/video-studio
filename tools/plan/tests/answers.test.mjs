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

test('answers: the master is one of the sizes already asked for, and no second delivery is added', () => {
  const b = { brand: 'acme', deliver: [{ platform: 'reels', size: '9:16' }, { platform: 'feed', size: '1:1' }] };
  const q = questions(b).find((x) => x.id === 'master');
  assert.deepEqual(q.choices.map((c) => c.value), ['9:16', '1:1']);
  assert.equal(checkAnswer(b, 'master', '4:5').ok, false);
  const out = applyAnswer(b, 'master', { value: '1:1' });
  assert.deepEqual(out.deliver, [{ platform: 'reels', size: '9:16' }, { platform: 'feed', size: '1:1', master: true }]);
  assert.equal(b.deliver[1].master, undefined);
  assert.ok(!questions(out).some((x) => x.id === 'master'));
});

test('answers: length must be a number of seconds', () => {
  const bad = checkAnswer({}, 'length', 'a while');
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /seconds/);
  assert.throws(() => applyAnswer({}, 'length', { words: 'a while' }), /seconds/);
  assert.equal(applyAnswer({}, 'length', { words: '30 s' }).length_cap_seconds, 30);
});

test('answers: show-N sets what the viewer sees, and a missing target is refused', () => {
  const b = { brand: 'acme', must_show: [{ what: 'export to PDF', evidence: '' }] };
  const out = applyAnswer(b, 'show-0', { words: 'the PDF opens in the reader' });
  assert.deepEqual(out.must_show, [{ what: 'export to PDF', evidence: 'the PDF opens in the reader' }]);
  assert.equal(b.must_show[0].evidence, '');
  assert.ok(!questions(out).some((x) => x.id === 'show-0'));
  assert.throws(() => applyAnswer(b, 'show-3', { words: 'x' }), /No must-show 3/);
  assert.throws(() => applyAnswer(base(), 'ref-5', { value: ['pacing'] }), /No reference 5/);
  assert.deepEqual(applyAnswer(base(), 'ref-0', { value: 'sound' }).references[0].liked_for, ['sound']);
});

test('answers: the recommended choice is the one the recommendation starts with, on a word boundary', () => {
  const voice = questions({ brand: 'demo', kind: 'launch-reel' }).find((x) => x.id === 'voice');
  assert.deepEqual(voice.choices.filter((c) => c.recommended).map((c) => c.value), ['none']);
  const other = questions({ brand: 'demo', kind: 'tutorial' }).find((x) => x.id === 'voice');
  assert.deepEqual(other.choices.filter((c) => c.recommended).map((c) => c.value), ['voice-over']);
  assert.equal(questions(base()).find((x) => x.id === 'kind').choices.some((c) => c.recommended), false);
});
