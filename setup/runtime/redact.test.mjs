import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact } from './resolve.mjs';

test('studio folder becomes . and home becomes ~', () => {
  const out = redact('/Users/ann/My Films/studio/engine/x and /Users/ann/.local/bin/demucs',
    { home: '/Users/ann', root: '/Users/ann/My Films/studio' });
  assert.equal(out, './engine/x and ~/.local/bin/demucs');
});

test('JSON-escaped Windows paths are redacted', () => {
  const json = JSON.stringify({ a: 'C:\\Users\\Zoë Ñ\\Vidéo studio\\engine\\ffprobe.exe', b: 'C:\\Users\\Zoë Ñ\\AppData\\x' });
  const out = redact(json, { home: 'C:\\Users\\Zoë Ñ', root: 'C:\\Users\\Zoë Ñ\\Vidéo studio' });
  assert.ok(!out.includes('Zoë'), out);
  assert.deepEqual(JSON.parse(out), { a: '.\\engine\\ffprobe.exe', b: '~\\AppData\\x' });
});
