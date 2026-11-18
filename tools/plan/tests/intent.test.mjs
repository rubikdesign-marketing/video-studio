// Tests for the brief (tools/plan/lib/brief.mjs) and the revision check (tools/plan/lib/revisions.mjs).
// Run: node --test tools/plan/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assumptions, questions, shotProblems, summary } from '../lib/brief.mjs';
import { diff, resolveScope, verify } from '../lib/revisions.mjs';

test('brief: an empty brief asks the size first, then the kind, at most what matters', () => {
  const q = questions({ references: [{ source: 'their reel' }] });
  assert.deepEqual(q.slice(0, 3).map((x) => x.id), ['size', 'kind', 'ref-0']);
  assert.match(q[2].question, /camera, the pacing, the presenter's delivery/);
});

test('brief: a complete brief asks nothing', () => {
  const brief = { kind: 'product-demo', viewer_should: 'try it', voice: 'none', length_cap_seconds: 20, deliver: [{ size: '9:16', master: true }], references: [{ source: 'r', liked_for: ['pacing'] }], must_show: [{ what: 'export', evidence: 'the file lands in Downloads' }] };
  assert.deepEqual(questions(brief), []);
});

test('brief: a claim with no visible evidence is asked about', () => {
  const q = questions({ deliver: [{ size: '1:1', master: true }], kind: 'promo', must_show: [{ what: 'it connects to Claude' }] });
  assert.ok(q.some((x) => x.id === 'show-0' && /what exactly should the viewer see/.test(x.question)));
});

test('brief: shots that cannot prove their point are listed', () => {
  const brief = { kind: 'ugc', must_show: [{ what: 'the cup', evidence: 'hand lifts it' }], references: [{ source: 'ref', liked_for: ['delivery'] }] };
  const shots = { scenes: [{ id: 'S01', shots: [
    { point: 'She picks up the cup', eye: 'the hand', move: 'hand picks up the cup' },
    { point: 'She talks', eye: 'face', source: 'generated' },
  ] }] };
  const p = shotProblems(brief, shots).map((x) => `${x.where}: ${x.what}`);
  assert.ok(p.includes('S01 shot 1: an action with no proof moment'));
  assert.ok(p.includes('S01 shot 2: generated, not yet tested'));
  assert.ok(p.includes('brief: nothing shows "the cup"'));
  assert.ok(p.some((x) => /liked for its delivery, and no shot borrows it/.test(x)));
  shots.scenes[0].shots[0].proof = { what: 'contact', at: 1.2 };
  shots.scenes[0].shots[0].proves = 0;
  shots.scenes[0].shots[1].borrow = [{ ref: 0, for: 'delivery' }];
  shots.scenes[0].shots[1].test = { approved: true };
  assert.deepEqual(shotProblems(brief, shots), []);
});

test('brief: the short version carries decisions and open revision notes', () => {
  const s = summary({ kind: 'promo', decisions: [{ what: 'square master', date: '2026-11-17', applies_to: 'all' }] },
    { revisions: { rounds: [{ name: 'r2', items: [{ action: 'change', aspect: 'pace', scope: ['S04'], status: 'open' }] }] } }).join('\n');
  assert.match(s, /Decided 2026-11-17: square master/);
  assert.match(s, /Revision r2: 1 notes, 1 not yet verified: change pace in S04/);
});

// ---------------------------------------------------------------- revisions

const film = (lens) => { let t = 0; return { duration: lens.reduce((a, b) => a + b, 0), scenes: lens.map((l, i) => { const s = { id: `S0${i + 1}`, start: t, end: t + l, texts: [{ at: 0, out: l }] }; t += l; return s; }) }; };
const snap = (lens, frameIds, code = {}) => ({ film: film(lens), code, frames: Object.fromEntries(frameIds.map((k) => [k, `${k}.jpg`])) });

test('revisions: scope words', () => {
  const ids = ['S01', 'S02', 'S03'];
  assert.deepEqual(resolveScope('opening', ids), ['S01']);
  assert.deepEqual(resolveScope(['ending'], ids), ['S03']);
  assert.deepEqual(resolveScope('rest', ids, { taken: ['S02'] }), ['S01', 'S03']);
  assert.throws(() => resolveScope('S09', ids), /No scene "S09"/);
});

test('revisions: keep everything I liked, slow down the demo, change the ending', () => {
  const before = snap([3, 4, 3], ['S01#1', 'S02#1', 'S03#1']);
  const after = snap([3, 5.5, 3], ['S01#1', 'S02#1', 'S03#1']);
  const changedFrames = new Set(['S02#1', 'S03#1']);
  const d = diff(before, after, (a) => (changedFrames.has(a.replace('.jpg', '')) ? 22 : Infinity));
  const round = { items: [
    { action: 'change', aspect: 'pace', scope: ['S02'], target: 'slower', says: 'slow down the demo' },
    { action: 'change', aspect: 'ending', scope: ['S03'], says: 'change the ending' },
    { action: 'keep', aspect: 'content', scope: ['rest'], says: 'keep everything I liked' },
  ] };
  const v = verify(round, d);
  assert.deepEqual(v.items.map((x) => x.status), ['verified', 'verified', 'verified']);
  assert.deepEqual(v.items[2].resolved_scope, ['S01']);
  assert.equal(v.ok, true);
});

test('revisions: a note not done and a scene changed without a note are both caught', () => {
  const before = snap([3, 4, 3], ['S01#1', 'S02#1', 'S03#1']);
  const after = snap([3, 4, 3], ['S01#1', 'S02#1', 'S03#1']);
  const d = diff(before, after, (a) => (a === 'S01#1.jpg' ? 30 : Infinity));   // S01 moved; S02 did not
  const v = verify({ items: [{ action: 'change', aspect: 'pace', scope: ['S02'], target: 'slower', says: 'slower demo' }] }, d);
  assert.equal(v.items[0].status, 'failed');
  assert.match(v.items[0].result, /S02 did not change/);
  assert.deepEqual(v.unasked.map((u) => u.scene), ['S01']);
  assert.equal(v.ok, false);
});

test('revisions: hold targets are measured from the film', () => {
  const before = snap([3, 4], ['S01#1', 'S02#1']);
  const after = snap([3, 1.5], ['S01#1', 'S02#1']);
  const d = diff(before, after, (a) => (a === 'S02#1.jpg' ? 20 : Infinity));
  const v = verify({ items: [{ action: 'change', aspect: 'pace', scope: ['S02'], target: 'hold>=2', says: 'hold the product longer' }] }, d);
  assert.equal(v.items[0].status, 'failed');
  assert.match(v.items[0].result, /S02 shot 1 is 1.5 s/);
});

test('revisions: a target the studio cannot measure goes to a person', () => {
  const s = snap([3], ['S01#1']);
  const v = verify({ items: [{ action: 'change', aspect: 'look', scope: ['S01'], target: 'warmer', says: 'warmer' }] }, diff(s, snap([3], ['S01#1']), () => 20));
  assert.equal(v.items[0].status, 'needs a person');
});

test('brief: what their own words settle is assumed, not asked', () => {
  const brief = { in_their_words: 'A short vertical reel announcing our new opening hours, no voice-over, just music', references: [] };
  assert.deepEqual(assumptions(brief).map((a) => `${a.id}=${a.value}`), ['size=9:16', 'kind=launch-reel', 'voice=none']);
  const ids = questions(brief).map((x) => x.id);
  assert.ok(!ids.includes('size') && !ids.includes('kind') && !ids.includes('voice'));
  assert.ok(ids.includes('viewer'));
});

test('revisions: a whole-film length note checks the film, not every scene', () => {
  const before = snap([3, 4], ['S01#1', 'S02#1']);
  const after = snap([3, 5], ['S01#1', 'S02#1']);
  const d = diff(before, after, (a) => (a === 'S02#1.jpg' ? 20 : Infinity));
  const v = verify({ items: [
    { action: 'change', aspect: 'pace', scope: ['S02'], target: 'slower', says: 'slower' },
    { action: 'keep', aspect: 'length', scope: ['S01', 'S02'], target: 'length<=7.5', says: 'cap' },
  ] }, d);
  assert.deepEqual(v.items.map((x) => x.status), ['verified', 'failed']);
  assert.match(v.items[1].result, /the film is 8 s/);
});

test('revisions: a copy note is not done by a timing shift, and what frames cannot settle goes to a person', () => {
  const before = snap([3, 4], ['S01#1', 'S02#1']);
  const after = snap([3, 5], ['S01#1', 'S02#1']);
  const same = () => Infinity;
  let v = verify({ items: [{ action: 'change', aspect: 'copy', scope: ['S02'], says: 'change the words' }] }, diff(before, after, same));
  assert.equal(v.items[0].status, 'failed'); assert.match(v.items[0].result, /only its timing moved/);
  v = verify({ items: [{ action: 'change', aspect: 'pace', scope: ['S02'], says: 'slower' }] }, diff(before, after, same));
  assert.equal(v.items[0].status, 'verified');
  const flat = snap([3, 4], ['S01#1', 'S02#1']);
  v = verify({ items: [{ action: 'change', aspect: 'look', scope: ['S02'], says: 'warmer' }] }, diff(before, flat, () => null));
  assert.equal(v.items[0].status, 'needs a person');
  const withCode = { ...snap([3, 4], ['S01#1', 'S02#1']), code: { 'scenes/S02.tsx': 'b' } };
  v = verify({ items: [{ action: 'keep', aspect: 'content', scope: ['S02'], says: 'keep' }] }, diff({ ...before, code: { 'scenes/S02.tsx': 'a' } }, withCode, same));
  assert.equal(v.items[0].status, 'needs a person'); assert.match(v.items[0].result, /motion between frames/);
  const shared = { ...snap([3, 4], ['S01#1', 'S02#1']), code: { 'parts.tsx': 'b' } };
  v = verify({ items: [{ action: 'change', aspect: 'copy', scope: ['S02'], says: 'new words' }, { action: 'keep', scope: ['S01'], aspect: 'content', says: 'k' }] },
    diff({ ...before, code: { 'parts.tsx': 'a' } }, shared, (a) => (a === 'S02#1.jpg' ? 20 : Infinity)));
  assert.equal(v.items[0].status, 'needs a person'); assert.match(v.items[0].result, /shared code/);
});
