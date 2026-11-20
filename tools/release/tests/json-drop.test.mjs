import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyJsonDrop } from '../lib/json-drop.mjs';

const stage = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-drop-'));
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify([
    { id: 1, brand: 'Dokan' }, { id: 2, brand: 'Rubik (brief)' }, { id: 3, brand: 'Acme' },
  ]));
  return dir;
};
const read = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));

test('one match object drops its entries (the old form)', () => {
  const dir = stage();
  const problems = applyJsonDrop(dir, { 'index.json': { brand: 'Dokan' } });
  assert.deepEqual(problems, []);
  assert.deepEqual(read(dir).map((x) => x.id), [2, 3]);
});

test('an array of match objects drops entries matching any of them', () => {
  const dir = stage();
  const problems = applyJsonDrop(dir, { 'index.json': [{ brand: 'Dokan' }, { brand: 'Rubik (brief)' }] });
  assert.deepEqual(problems, []);
  assert.deepEqual(read(dir).map((x) => x.id), [3]);
});

test('each match object that matches nothing is a problem of its own', () => {
  const dir = stage();
  const problems = applyJsonDrop(dir, { 'index.json': [{ brand: 'Dokan' }, { brand: 'Nobody' }] });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /nothing matched .*Nobody.* in index\.json/);
  assert.deepEqual(read(dir).map((x) => x.id), [2, 3]);
});
