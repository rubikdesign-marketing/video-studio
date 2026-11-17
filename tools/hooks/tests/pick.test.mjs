// Tests for choosing and measuring hooks. Run: node --test tools/hooks/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { find, measure, usedByBrand } from '../lib/pick.mjs';

const f = (id, family, suits = {}) => ({ id, family, suits: { types: ['promo', 'demo'], platforms: ['reels', 'youtube'], awareness: ['cold'], ...suits } });
const lib = { formulas: [f('a1', 'a'), f('a2', 'a'), f('b1', 'b'), f('c1', 'c'), f('d1', 'd'), f('e1', 'e'), f('e2', 'e', { types: ['tutorial'] }), f('f1', 'f', { platforms: ['linkedin'] })] };

test('five picks come from five different families, the same every time', () => {
  const r = find(lib, { type: 'promo', platform: 'reels', awareness: 'cold', n: 5 });
  assert.equal(new Set(r.picks.map((p) => p.family)).size, 5);
  assert.deepEqual(r.picks.map((p) => p.id), find(lib, { type: 'promo', platform: 'reels', awareness: 'cold', n: 5 }).picks.map((p) => p.id));
  assert.equal(r.matched, 6); // e2 is tutorial only, f1 is linkedin only
});

test('excluded formulas are left out; a second round fills from the same families', () => {
  const r = find(lib, { type: 'promo', exclude: ['a1', 'b1'], n: 6 });
  assert.ok(!r.picks.some((p) => ['a1', 'b1'].includes(p.id)));
  assert.ok(r.picks.some((p) => p.id === 'a2'));
});

test('fewer matches than asked for: what there is, and both numbers', () => {
  const r = find(lib, { platform: 'linkedin', n: 5 });
  assert.equal(r.picks.length, 1); assert.equal(r.asked, 5); assert.equal(r.matched, 1);
  assert.deepEqual(find(lib, { type: 'ad' }), { picks: [], asked: 5, matched: 0 });
});

test('a brand\'s recent formulas come from its ledger; an empty or missing ledger gives none', () => {
  assert.deepEqual(usedByBrand([{ hook: 'x' }, { hook_formula: 'a1' }, { hook_formula: 'b1' }]), ['a1', 'b1']);
  assert.deepEqual(usedByBrand([{ hook_formula: 'old' }, {}, {}, {}, {}, {}]), []);
  assert.deepEqual(usedByBrand([]), []); assert.deepEqual(usedByBrand(undefined), []);
});

test('measure counts words, speaking time and the time to the first claim', () => {
  const m = measure('Your invoices go out late, and clients notice');
  assert.equal(m.words, 8); assert.equal(m.seconds, 3.2); assert.equal(m.first_claim_seconds, 2); assert.deepEqual(m.notes, []);
  // A name called out is not the claim: the count runs on to the next clause.
  assert.equal(measure('Founders, your site can be live today').first_claim_seconds, 2.8);
  const late = measure('If you have ever spent a whole afternoon chasing invoices that never arrive, watch this');
  assert.ok(late.first_claim_seconds > 3); assert.ok(late.notes.some((n) => /claim lands after 3 s/.test(n)));
});

test('measure reports an opener to avoid, a long on-screen line, and an on-screen line that only repeats', () => {
  const avoid = [{ pattern: '^hey guys', why: 'a greeting spends the first second on nothing' }];
  const m = measure('Hey guys, today we look at invoices', { avoid, onScreen: 'one two three four five six seven eight' });
  assert.equal(m.avoid_hits.length, 1); assert.ok(m.notes.some((n) => /greeting/.test(n))); assert.ok(m.notes.some((n) => /8 words/.test(n)));
  assert.ok(measure('Send the invoice', { onScreen: 'send the invoice' }).notes.some((n) => /repeats/.test(n)));
});

test('the avoid list catches curly apostrophes and "I\'m", and leaves innocent words alone', async () => {
  const { loadLibrary } = await import('../lib/library.mjs');
  const avoid = loadLibrary().avoid;
  const hits = (line) => measure(line, { avoid }).avoid_hits.length;
  for (const bad of ["Today I'm going to show you", 'Today we\u2019re going to show you', 'Let\u2019s talk about invoices', 'In today\u2019s video', 'You won\u2019t believe this', 'Nobody\u2019s telling you this', 'Hey guys, quick one', 'Hi, quick one', 'We just launched a new plan', 'This one secret hack']) assert.ok(hits(bad) > 0, bad);
  for (const fine of ['Hackathon winners built this in a day', 'The secretary quit and left a note', 'Hi-vis jackets saved my morning', 'Hey Siri, stop', 'I just launched a store and it sold out', 'The world in your pocket', 'Insane as it sounds is not here', 'Your invoices go out late']) {
    if (fine.startsWith('Insane')) continue; // "insane" itself is on the list on purpose
    assert.equal(hits(fine), 0, fine);
  }
});
