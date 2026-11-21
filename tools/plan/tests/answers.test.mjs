import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAnswer, assumptions, checkAnswer, HOOK_FAMILIES, preflight, questions, reopen } from '../lib/brief.mjs';
import { completeBrief } from './helpers.mjs';

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

test('reopen: clears one checklist item so its question is asked again', () => {
  const done = completeBrief();
  assert.equal(questions(done).length, 0);
  const b = reopen(done, 'look');
  assert.notEqual(b, done);
  assert.equal(done.look, 'paper');
  assert.deepEqual(questions(b).map((q) => q.id), ['look']);
  assert.equal(preflight(b).find((p) => p.id === 'look').done, false);
  const d = reopen(done, 'delivery');
  assert.deepEqual(d.deliver, [{ master: true }]);
  assert.equal(d.length_cap_seconds, undefined); assert.equal(d.voice, undefined);
  assert.deepEqual(d.ask_again, ['size', 'voice', 'length_cap_seconds']);
  assert.throws(() => reopen(done, 'colour'), /No checklist item colour/);
});

test('reopen: an item the words could fill is asked again, not re-assumed; answering clears ask_again', () => {
  const words = { ...completeBrief(), in_their_words: 'A vertical demo of the export button' };
  const b = reopen(words, 'type');
  assert.equal(b.kind, undefined); assert.equal(b.references, undefined); assert.equal(b.no_reference, undefined);
  assert.deepEqual(b.ask_again, ['kind']);
  assert.ok(!assumptions(b).some((a) => a.id === 'kind'));
  assert.ok(questions(b).some((q) => q.id === 'kind'));
  const c = applyAnswer(b, 'kind', { value: 'tutorial' });
  assert.equal(c.kind, 'tutorial'); assert.equal(c.ask_again, undefined);
  const s = reopen(words, 'delivery');
  assert.ok(questions(s).some((q) => q.id === 'size'));
  assert.deepEqual(applyAnswer(s, 'size', { value: '1:1' }).ask_again, ['voice', 'length_cap_seconds']);
});

test('reopen: look, hook and type from a saved style are changed in chat, not reopened', () => {
  const styled = { ...completeBrief(), style: 'acme/launch' };
  for (const item of ['look', 'hook', 'type']) {
    assert.throws(() => reopen(styled, item), { message: 'That comes from your saved style acme/launch. To change it, say so in a chat in the studio folder.' });
  }
  assert.equal(reopen(styled, 'audience').for, undefined);
});

test('answers: an audience card with no words, and no one named yet, asks who it is for', () => {
  assert.throws(() => applyAnswer({}, 'audience', { value: 'cold' }), /^Error: Say who it is for in a few words\.$/);
  assert.equal(applyAnswer({ for: 'agency owners' }, 'audience', { value: 'cold' }).awareness, 'cold');
  assert.equal(applyAnswer({}, 'audience', { value: 'cold', words: 'agency owners' }).for, 'agency owners');
});
