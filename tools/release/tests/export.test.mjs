// Runs the real export into a scratch folder (never inside the repo) and checks what ships and what does not.
// It exports the committed files plus any tracked edits (git stash create makes a commit of them without touching
// the stash stack), so the test sees the manifest you are about to commit. It needs npm and the package registry,
// as the export does (the editor build).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const git = (...a) => execFileSync('git', a, { cwd: STUDIO, encoding: 'utf8' }).trim();

test('export: library/styles/previews ships and dist does not', { timeout: 600_000 }, () => {
  const out = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'export-test-'));
  try {
    let ref = 'HEAD';
    try { ref = git('stash', 'create') || 'HEAD'; } catch { /* no write access to the index: export HEAD */ }
    const run = spawnSync(process.execPath, [path.join(STUDIO, 'tools/release/export.mjs'), '--ref', ref, '--out', path.join(out, 'rc')], { cwd: STUDIO, encoding: 'utf8', maxBuffer: 1 << 28 });
    assert.equal(run.status, 0, `the export failed:\n${run.stdout}\n${run.stderr}`);
    const rc = path.join(out, 'rc');
    const has = (p) => fs.existsSync(path.join(rc, p));
    const mp4s = fs.readdirSync(path.join(rc, 'library/styles/previews')).filter((f) => f.endsWith('.mp4'));
    assert.ok(mp4s.length > 100, `only ${mp4s.length} preview clips shipped`);
    assert.ok(has('library/styles/previews/sound-sprite.mp3') && has('library/styles/filming.json'));
    assert.ok(has('tools/styles/build-page.mjs'), 'the page builder ships');
    assert.equal(has('studio/brief-desk/dist'), false, 'dist ships');
    assert.equal(has('studio/brief-desk/index.html'), true);
    // What must stay behind.
    for (const gone of ['jobs/_demo-previews', 'library/fixtures', 'library/backgrounds/backgrounds-tulvo.mp4', 'brands/demo/product/capture.json', 'brands/demo/product/README.md']) {
      assert.equal(has(gone), false, `${gone} ships`);
    }
    assert.deepEqual(fs.readdirSync(path.join(rc, 'library/backgrounds')).filter((f) => f.endsWith('.mp4')), [], 'a background reel ships');
    // The music licence note ships exactly as it is.
    assert.equal(fs.readFileSync(path.join(rc, 'library/sounds/CREDITS.md'), 'utf8'), fs.readFileSync(path.join(STUDIO, 'library/sounds/CREDITS.md'), 'utf8'));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
