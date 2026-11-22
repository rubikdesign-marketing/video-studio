import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readFileSync, existsSync, openSync, ftruncateSync, closeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPage } from '../build-page.mjs';
import { TABS } from '../lib/library.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL = join(HERE, '..', '..', '..');
const FIX = join(HERE, 'fixtures', 'lib');

// A throwaway root: the fixture library plus the page, the two modules and the director notes.
function studio({ version = 2, extraClips = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'build-page-'));
  cpSync(FIX, root, { recursive: true });
  mkdirSync(join(root, 'studio', 'brief-desk'), { recursive: true });
  writeFileSync(join(root, 'studio', 'brief-desk', 'index.html'), `<title>Video brief</title>\n<meta name="brief-page-version" content="${version}">\n`);
  for (const f of ['tools/plan/lib/brief.mjs', 'tools/styles/lib/suggest.mjs', 'tools/styles/lib/prompt.mjs']) {
    mkdirSync(join(root, dirname(f)), { recursive: true });
    cpSync(join(REAL, f), join(root, f));
  }
  writeFileSync(join(root, 'library', 'styles', 'director.md'), '# Director\n');
  const pv = join(root, 'library', 'styles', 'previews');
  writeFileSync(join(pv, 'sound-sprite.mp3'), 'x');
  writeFileSync(join(pv, 'sound-sprite.json'), JSON.stringify({ 'acme-soft-tap': [0, 0.3] }));
  for (let i = 0; i < extraClips; i++) writeFileSync(join(pv, `stub-${i}.mp4`), '');
  return root;
}
const build = (root, o = {}) => buildPage(root, { min: 2, ...o });

test('build: the shared prompt module imports nothing, so the page can load it as it is', () => {
  const src = readFileSync(join(REAL, 'tools', 'styles', 'lib', 'prompt.mjs'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\b|\bimport\s*\(|\brequire\(/m);
  assert.match(src, /export function promptText\(/);
});

test('build: copies the modules byte for byte', () => {
  const root = studio();
  const r = build(root);
  for (const [src, dest] of [['tools/plan/lib/brief.mjs', 'lib/brief.mjs'], ['tools/styles/lib/suggest.mjs', 'lib/suggest.mjs'], ['tools/styles/lib/prompt.mjs', 'lib/prompt.mjs']]) {
    assert.ok(readFileSync(join(REAL, src)).equals(readFileSync(join(r.out, dest))));
  }
  assert.ok(readFileSync(join(root, 'studio/brief-desk/index.html')).equals(readFileSync(join(r.out, 'index.html'))));
  assert.ok(existsSync(join(r.out, 'styles', 'director.md')) && existsSync(join(r.out, 'previews', 'sound-sprite.mp3')));
});

test('build: page data keeps every page field and carries engine names only as engine_names', () => {
  const root = studio();
  const r = build(root);
  let sawEngine = false;
  for (const tab of TABS) {
    const src = JSON.parse(readFileSync(join(root, 'library', 'styles', `${tab}.json`), 'utf8'));
    const out = JSON.parse(readFileSync(join(r.out, 'styles', `${tab}.json`), 'utf8'));
    assert.equal(out.length, src.length);
    src.forEach((e, i) => {
      assert.ok(!('engine' in out[i]));
      for (const k of Object.keys(e)) if (k !== 'engine') assert.deepEqual(out[i][k], e[k], `${e.id}.${k}`);
      if ('engine' in e) { sawEngine = true; assert.deepEqual(out[i].engine_names, e.engine); }
    });
  }
  assert.ok(sawEngine);
  const meta = JSON.parse(readFileSync(join(r.out, 'styles', 'meta.json'), 'utf8'));
  assert.ok(meta.counts.motion.total > 0 && meta.built_at && Array.isArray(meta.sketches) && Array.isArray(meta.notes));
  assert.equal(meta.sound_slices['acme-soft-tap'], 0.3);
});

test('build: batches are at most 250 files with index.html in the first', () => {
  const root = studio({ extraClips: 300 });
  const r = build(root);
  assert.ok(r.batches.length >= 2);
  for (const b of r.batches) assert.ok(b.length <= 250);
  assert.equal(r.batches[0][0], 'index.html');
  assert.ok(r.batches[0].every((p) => !p.endsWith('.mp4')));
  assert.equal(r.batches.flat().length, r.files.length);
  const pub = JSON.parse(readFileSync(join(r.out, 'publish.json'), 'utf8'));
  assert.deepEqual(pub.batches, r.batches);
  assert.ok(pub.batches.flat().every((p) => !p.includes('\\')));
});

test('build: 501 clips refused with a plain message', () => {
  const root = studio({ extraClips: 501 - 9 });
  assert.throws(() => build(root), (e) => e.plain === true && /501/.test(e.message));
});

test('build: version comes from the page\'s brief-page-version tag', () => {
  const r = build(studio({ version: 7 }));
  assert.equal(r.version, 7);
  assert.equal(JSON.parse(readFileSync(join(r.out, 'publish.json'), 'utf8')).version, 7);
});

test('build: refuses an out folder outside the root or the root itself, deleting nothing', () => {
  const root = studio();
  const outside = mkdtempSync(join(tmpdir(), 'build-outside-'));
  writeFileSync(join(outside, 'keep.txt'), 'x');
  for (const out of [outside, '.', '', join('..', 'elsewhere')]) {
    assert.throws(() => build(root, { out }), (e) => e.plain === true && /folder/.test(e.message), `out=${out}`);
  }
  assert.ok(existsSync(join(outside, 'keep.txt')));
  assert.ok(existsSync(join(root, 'studio', 'brief-desk', 'index.html')));
});

test('build: refuses a page version that is not an integer', () => {
  for (const v of ['3.5', 'two', '', '-1', '1e2']) {
    assert.throws(() => build(studio({ version: v })), (e) => e.plain === true && /version/.test(e.message), `v=${v}`);
  }
});

test('build: a stale file from a previous build is gone after a build', () => {
  const root = studio();
  const r = build(root);
  writeFileSync(join(r.out, 'stale.txt'), 'old');
  mkdirSync(join(r.out, 'previews'), { recursive: true });
  writeFileSync(join(r.out, 'previews', 'gone.mp4'), '');
  build(root);
  assert.ok(!existsSync(join(r.out, 'stale.txt')) && !existsSync(join(r.out, 'previews', 'gone.mp4')));
});

/* ---------- final review fixes ---------- */

test('build: a publish set over 40 MB is refused with a plain message, and nothing is built', () => {
  const root = studio();
  // A sparse stub: its size counts, no disk is spent.
  const fd = openSync(join(root, 'library', 'styles', 'previews', 'sound-sprite.mp3'), 'w');
  ftruncateSync(fd, 41 * 1024 * 1024);
  closeSync(fd);
  assert.throws(() => build(root), (e) => e.plain === true && /is 41\.\d MB and the limit is 40 MB\. Nothing was built\./.test(e.message));
  assert.ok(!existsSync(join(root, 'studio', 'brief-desk', 'dist')));
});

test('build: a corpus that is not JSON is a plain message, not a stack trace', () => {
  const root = studio();
  mkdirSync(join(root, '.damex', 'motion-study'), { recursive: true });
  writeFileSync(join(root, '.damex', 'motion-study', 'corpus.json'), '{ nope');
  assert.throws(() => build(root), (e) => e.plain === true && /corpus/.test(e.message) && /cannot be read/.test(e.message));
});

test('build: a null library entry is a plain refusal naming it, not a crash', () => {
  const root = studio();
  const file = join(root, 'library', 'styles', 'motion.json');
  writeFileSync(file, JSON.stringify([null, ...JSON.parse(readFileSync(file, 'utf8'))]));
  assert.throws(() => build(root), (e) => e.plain === true && /Motion: entry #1 is not an entry/.test(e.message));
});

const CHECK = join(HERE, '..', 'check.mjs');
const check = (...a) => spawnSync(process.execPath, [CHECK, ...a], { encoding: 'utf8' });

test('check.mjs: a --corpus that does not exist fails with a plain message', () => {
  const r = check('--corpus', join(tmpdir(), 'no-such-corpus-here.json'));
  assert.equal(r.status, 2);
  assert.match(r.stdout + r.stderr, /There is no corpus file at .*no-such-corpus-here\.json/);
  assert.doesNotMatch(r.stderr, /at .*\.mjs:\d+/);
});

test('check.mjs: a corpus that is not JSON fails with a plain message', () => {
  const f = join(mkdtempSync(join(tmpdir(), 'corpus-')), 'corpus.json');
  writeFileSync(f, '{ nope');
  const r = check('--corpus', f);
  assert.equal(r.status, 2);
  assert.match(r.stdout + r.stderr, /cannot be read as JSON/);
  assert.doesNotMatch(r.stderr, /at .*\.mjs:\d+/);
});

test('check.mjs: --min that is not a whole number fails with a plain message', () => {
  for (const v of ['abc', '2.5', '-1']) {
    const r = check('--min', v);
    assert.equal(r.status, 2, v);
    assert.match(r.stdout + r.stderr, /--min needs a whole number/);
  }
});
