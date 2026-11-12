// Tests for tools/capture/freshness.mjs: comparing a mark's words and layout with today's.
// Run: node --test tools/capture/tests/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareWords, compareLayout, describeWords, describeLayout } from '../freshness.mjs';

test('words: the same labels in a different order on a row are no change', () => {
  const before = 'Tulvo AI  Approved  Campaign  Beta\nClient Roster  Campaign Launch Board';
  const after = 'Tulvo AI  Beta  Approved  Campaign\nClient Roster\nCampaign Launch Board';
  const r = compareWords(before, after);
  assert.deepEqual(r, { added: [], removed: [], renamed: [] });
});

test('words: a renamed button is reported as a rename', () => {
  const before = 'Leads  Deals\nNew lead\nMorrowby Coffee';
  const after = 'Leads  Deals\nAdd lead\nMorrowby Coffee';
  const r = compareWords(before, after);
  assert.deepEqual(r.renamed, [{ from: 'New lead', to: 'Add lead' }]);
  assert.deepEqual(r.added, []);
  assert.deepEqual(r.removed, []);
});

test('words: an unrelated new row and a removed row are not called a rename', () => {
  const before = 'Leads\nMorrowby Coffee\nHarbour Bakery';
  const after = 'Leads\nMorrowby Coffee\nZenith Partners Ltd\nQuarterly revenue';
  const r = compareWords(before, after);
  assert.deepEqual(r.renamed, []);
  assert.deepEqual(r.removed, ['Harbour Bakery']);
  assert.deepEqual(r.added.sort(), ['Quarterly revenue', 'Zenith Partners Ltd']);
});

test('words: a label that appears twice and now once is a removal', () => {
  const r = compareWords('Save\nSave\nCancel', 'Save\nCancel');
  assert.deepEqual(r.removed, ['Save']);
});

test('words: masked words are ignored', () => {
  const r = compareWords('[masked]  Leads', 'Leads');
  assert.deepEqual(r, { added: [], removed: [], renamed: [] });
});

test('words: the description says what became what', () => {
  const text = describeWords({ added: ['Export'], removed: [], renamed: [{ from: 'New lead', to: 'Add lead' }] });
  assert.match(text.join('\n'), /"New lead" became "Add lead"/);
  assert.match(text.join('\n'), /new words: "Export"/);
});

const thing = (name, box, role = 'button') => ({ name, role, box });

test('layout: things within the tolerance are no change', () => {
  const a = { things: [thing('New', [1800, 80, 80, 34])], tracked: { card: [10, 10, 300, 200] } };
  const b = { things: [thing('New', [1802, 81, 80, 34])], tracked: { card: [11, 10, 300, 201] } };
  assert.deepEqual(compareLayout(a, b, { tolerance: 3 }).changes, []);
});

test('layout: a button that moved and grew is reported with how far', () => {
  const a = { things: [thing('New', [1800, 80, 80, 34])], tracked: {} };
  const b = { things: [thing('New', [1700, 80, 96, 34])], tracked: {} };
  const [c] = compareLayout(a, b, { tolerance: 3 }).changes;
  assert.equal(c.kind, 'moved');
  assert.equal(c.name, 'New');
  assert.deepEqual([c.dx, c.dy, c.dw, c.dh], [-100, 0, 16, 0]);
});

test('layout: a thing with a new name in the same place is a rename', () => {
  const a = { things: [thing('New lead', [100, 200, 90, 32])], tracked: {} };
  const b = { things: [thing('Add lead', [100, 200, 92, 32])], tracked: {} };
  const { changes } = compareLayout(a, b, { tolerance: 3 });
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, 'renamed');
  assert.equal(changes[0].from, 'New lead');
  assert.equal(changes[0].to, 'Add lead');
});

test('layout: a tracked thing that went missing or changed size is reported', () => {
  const a = { things: [], tracked: { card: [10, 10, 300, 200], pill: [5, 5, 40, 20] } };
  const b = { things: [], tracked: { card: [10, 10, 300, 260], pill: null } };
  const { changes } = compareLayout(a, b, { tolerance: 3 });
  const byName = Object.fromEntries(changes.map((c) => [c.name, c]));
  assert.equal(byName.card.kind, 'resized');
  assert.equal(byName.card.dh, 60);
  assert.equal(byName.pill.kind, 'gone');
  assert.equal(byName.pill.tracked, true);
});

test('layout: many things moving together are one line, not one each', () => {
  const names = ['Leads', 'Deals', 'Tasks', 'Notes', 'Files'];
  const a = { things: names.map((n, i) => thing(n, [10, 100 + i * 40, 120, 30], 'link')), tracked: {} };
  const b = { things: names.map((n, i) => thing(n, [10, 140 + i * 40, 120, 30], 'link')), tracked: {} };
  const r = compareLayout(a, b, { tolerance: 3 });
  assert.equal(r.changes.length, 5);
  const lines = describeLayout(r);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /5 things moved together, 40 px down/);
});

test('layout: new and gone named things are listed', () => {
  const a = { things: [thing('Export', [10, 10, 80, 30])], tracked: {} };
  const b = { things: [thing('Share', [600, 10, 80, 30])], tracked: {} };
  const kinds = compareLayout(a, b, { tolerance: 3 }).changes.map((c) => `${c.kind}:${c.name}`).sort();
  assert.deepEqual(kinds, ['gone:Export', 'new:Share']);
});
