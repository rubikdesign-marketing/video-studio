import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TOOL = path.join(ROOT, 'tools/library/registry.mjs');
const run = (args, opts = {}) => spawnSync('node', [TOOL, ...args], { cwd: ROOT, encoding: 'utf8', ...opts });
const manifestPath = [process.env.DAMEX_RELEASE_MANIFEST, path.resolve(ROOT, '../../../release/manifest.json')].find((p) => p && fs.existsSync(p));
const mArgs = manifestPath ? ['--manifest', manifestPath] : [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-test-'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const outA = path.join(tmp, 'a.json');
const outB = path.join(tmp, 'b.json');
let built = false;
const ensureBuilt = () => {
  if (built) return;
  for (const o of [outA, outB]) {
    const r = run(['build', ...mArgs, '--out', o]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
  }
  built = true;
};
const reg = () => { ensureBuilt(); return JSON.parse(fs.readFileSync(outA, 'utf8')); };
const registryOnDisk = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'library/registry.json'), 'utf8'));

test('build is deterministic: the same sha256 twice', () => {
  ensureBuilt();
  assert.equal(sha(outA), sha(outB));
});

test('schema, counts and unique sorted ids', () => {
  const r = reg();
  assert.equal(r.schema, 'damex.registry/1');
  assert.ok(Array.isArray(r.sources) && r.sources.every((s) => s.file && /^[0-9a-f]{64}$/.test(s.sha256)));
  assert.equal(typeof r.omitted_private, 'number');
  const ids = r.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), ids);
  for (const [kind, n] of Object.entries(r.counts)) assert.equal(r.items.filter((i) => i.kind === kind).length, n);
  for (const it of r.items) {
    assert.match(it.id, /^[a-z]+:[a-z0-9-]+$/);
    assert.ok(it.summary.length > 0 && it.summary.length <= 140, it.id);
    assert.ok(it.locator.file, it.id);
    assert.equal(typeof it.availability.customer, 'boolean');
  }
  for (const k of ['preset', 'workflow', 'motion', 'background', 'hook', 'sound', 'reference', 'component']) assert.ok(r.counts[k] > 0, k);
});

test('the committed registry passes check', () => {
  const r = run(['check', ...mArgs]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('find never returns more than 5 results', () => {
  const r = run(['find', 'a', '--limit', '500']);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.split('\n').filter(Boolean);
  assert.ok(lines.length >= 1 && lines.length <= 5, `${lines.length} lines`);
  assert.ok(lines.every((l) => /^[a-z]+:/.test(l)));
  const k = run(['find', 'click', '--kind', 'sound', '--limit', '3']);
  assert.ok(k.stdout.split('\n').filter(Boolean).length <= 3);
});

test('get returns one item in full; an unknown id fails', () => {
  const item = registryOnDisk().items.find((i) => i.kind === 'motion');
  const r = run(['get', item.id]);
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), item);
  assert.notEqual(run(['get', 'motion:no-such-thing']).status, 0);
});

test('kinds gives a count and 3 examples per kind', () => {
  const out = JSON.parse(run(['kinds', '--json']).stdout);
  assert.equal(out.length, 8);
  for (const o of out) assert.ok(o.examples.length <= 3 && o.examples.length > 0 && o.count > 0);
});

test('every component locator resolves to a real export', () => {
  const r = reg();
  const comps = r.items.filter((i) => i.kind === 'component' || i.locator.export);
  assert.ok(comps.length > 100);
  for (const it of comps) {
    const text = fs.readFileSync(path.join(ROOT, it.locator.file), 'utf8');
    const n = it.locator.export;
    const re = new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?(?:function\\*?|const|let|var|class|type|interface|enum)\\s+${n}\\b|export\\s*(?:type\\s*)?\\{[^}]*\\b${n}\\b[^}]*\\}`);
    assert.ok(re.test(text), `${it.id}: ${it.locator.file} does not export ${n}`);
  }
});

test('no banned word in the output when the manifest is present', { skip: manifestPath ? false : 'no release manifest (set DAMEX_RELEASE_MANIFEST or pass one)' }, () => {
  const banned = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).banned.map((b) => new RegExp(b, 'i'));
  const text = fs.readFileSync(outA, 'utf8');
  ensureBuilt();
  for (const re of banned) assert.ok(!re.test(fs.readFileSync(outA, 'utf8')), `banned word ${re}`);
  assert.ok(text.length > 0);
});

test('start.sh --print-command prints the command and does not run it', () => {
  const sh = path.join(ROOT, 'setup/start.sh');
  assert.ok(fs.statSync(sh).mode & 0o111, 'start.sh is executable');
  const r = spawnSync(sh, ['--print-command'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), 'claude "/video-menu"');
});

test('the menu SKILL.md has parseable frontmatter with the required fields and at most 70 lines', () => {
  const text = fs.readFileSync(path.join(ROOT, '.claude/skills/video-menu/SKILL.md'), 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(m, 'frontmatter');
  const fm = {};
  for (const l of m[1].split('\n')) {
    const k = /^([a-z-]+):\s*(.*)$/.exec(l);
    assert.ok(k, `line "${l}" is not key: value`);
    fm[k[1]] = k[2].replace(/^"(.*)"$/, '$1');
  }
  assert.equal(fm.name, 'video-menu');
  assert.ok(fm.description.length > 20 && /use/i.test(fm.description));
  assert.equal(fm['argument-hint'], '[job name or a full brief]');
  assert.ok(text.split('\n').length <= 70);
});
