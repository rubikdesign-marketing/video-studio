// Tests for tools/film/lib/bundle.mjs. Run: node --test tools/film/tests/bundle.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fingerprint, ENGINE } from '../lib/bundle.mjs';

test('fingerprint changes when a brand.json changes', () => {
  const brand = path.join(path.dirname(ENGINE), 'brands', 'demo', 'brand.json');
  const st = fs.statSync(brand);
  try {
    const before = fingerprint();
    const t = new Date(st.mtimeMs + 5000);
    fs.utimesSync(brand, t, t);
    assert.notEqual(fingerprint(), before);
  } finally {
    fs.utimesSync(brand, st.atime, st.mtime);
  }
});
