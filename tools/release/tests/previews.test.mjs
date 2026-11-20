import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stripMissingPreviews } from '../lib/previews.mjs';

test('stripMissingPreviews drops only links to missing files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'previews-'));
  try {
    fs.mkdirSync(path.join(dir, 'library/motion'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'library/motion/here.mp4'), 'x');
    const file = 'library/motion/index.json';
    const doc = {
      about: 'x',
      moves: [
        { id: 'a', does: 'kept', preview: 'library/motion/here.mp4' },
        { id: 'b', does: 'gone', tags: ['t'], preview: 'library/motion/missing.mp4' },
        { id: 'c', does: 'plain' },
      ],
    };
    fs.writeFileSync(path.join(dir, file), JSON.stringify(doc));
    const result = stripMissingPreviews(dir, [file]);
    assert.deepEqual(result, [{ file, dropped: 1 }]);
    const out = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    assert.deepEqual(out.moves[0], doc.moves[0]);
    assert.deepEqual(out.moves[1], { id: 'b', does: 'gone', tags: ['t'] });
    assert.deepEqual(out.moves[2], doc.moves[2]);
    assert.equal(out.about, 'x');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stripMissingPreviews walks a top-level array and nested arrays', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'previews-'));
  try {
    fs.writeFileSync(path.join(dir, 'i.json'), JSON.stringify([{ id: 1, preview: 'nope.mp4', sub: [{ preview: 'nope2.mp4' }] }]));
    assert.deepEqual(stripMissingPreviews(dir, ['i.json']), [{ file: 'i.json', dropped: 2 }]);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'i.json'), 'utf8')), [{ id: 1, sub: [{}] }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
