import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractStartPrompt, buildReleaseJson, uploadPlan } from '../lib/publish.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '../../..');
const PUBLISH = path.join(STUDIO, 'tools/release/publish.mjs');
const NOT_FOUND = 'The start prompt was not found under step 3 of ONBOARDING.md, so nothing was published.';

test('extractStartPrompt finds the block in release/overrides/ONBOARDING.md', () => {
  const md = fs.readFileSync(path.join(STUDIO, 'release/overrides/ONBOARDING.md'), 'utf8');
  const prompt = extractStartPrompt(md);
  assert.match(prompt, /^Start the studio\./);
  assert.match(prompt, /setup\\start\.ps1/);
  assert.doesNotMatch(prompt, /```/);
  assert.doesNotMatch(prompt, /^\s/);
});

test('extractStartPrompt throws the sentence when step 3 has no block', () => {
  const md = '1. **Download** it.\n3. **Start it.** Open the app.\n\n   no block here\n4. **Next.**\n';
  assert.throws(() => extractStartPrompt(md), (e) => e.message === NOT_FOUND);
  assert.throws(() => extractStartPrompt('nothing at all'), (e) => e.message === NOT_FOUND);
});

test('buildReleaseJson orders guides ONBOARDING, README, LICENSE', () => {
  const onboarding = '3. **Start it.** Go.\n\n   ```text\n   Start now.\n   ```\n';
  const r = buildReleaseJson({
    version: '0.1.0-rc6', file: 'damex-video-engine-0.1.0-rc6.zip', bytes: 12, sha256: 'ab'.repeat(32),
    released: '2026-11-20', onboarding, readme: 'R', license: 'L',
  });
  assert.deepEqual(r, {
    version: '0.1.0-rc6', file: 'damex-video-engine-0.1.0-rc6.zip', bytes: 12, sha256: 'ab'.repeat(32),
    released: '2026-11-20', prompt: 'Start now.',
    guides: [{ name: 'ONBOARDING', markdown: onboarding }, { name: 'README', markdown: 'R' }, { name: 'LICENSE', markdown: 'L' }],
  });
});

test('uploadPlan writes current.json last', () => {
  const plan = uploadPlan('1.2.3', 'damex-video-engine-1.2.3.zip');
  assert.deepEqual(plan, [
    { key: 'releases/1.2.3/damex-video-engine-1.2.3.zip', source: 'zip' },
    { key: 'releases/1.2.3/release.json', source: 'json' },
    { key: 'current.json', source: 'json' },
  ]);
});

// A fake wrangler: records each call's arguments, and fails the call numbers listed in STUB_FAIL_ON.
function fixture({ shaOk = true } = {}) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'publish-test-'));
  const from = path.join(dir, 'release');
  fs.mkdirSync(from);
  fs.copyFileSync(path.join(STUDIO, 'release/overrides/ONBOARDING.md'), path.join(from, 'ONBOARDING.md'));
  fs.writeFileSync(path.join(from, 'README.md'), 'readme');
  fs.writeFileSync(path.join(from, 'LICENSE.md'), 'licence');
  const zipName = 'damex-video-engine-9.9.9.zip';
  const zip = path.join(dir, zipName);
  fs.writeFileSync(zip, 'not really a zip');
  const sha = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  fs.writeFileSync(`${zip}.sha256`, `${shaOk ? sha : 'f'.repeat(64)}  ${zipName}\n`);
  const log = path.join(dir, 'calls.log');
  const stub = path.join(dir, 'wrangler-stub.mjs');
  fs.writeFileSync(stub, `#!/usr/bin/env node
import fs from 'node:fs';
const log = ${JSON.stringify(log)};
const prev = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\\n').filter(Boolean) : [];
const n = prev.length + 1;
const args = process.argv.slice(2);
fs.appendFileSync(log, JSON.stringify(args) + '\\n');
const fail = (process.env.STUB_FAIL_ON || '').split(',').filter(Boolean).map(Number);
if (fail.includes(n)) { console.error('stub failure'); process.exit(1); }
// A put reads its file, as the real one does.
const f = args.indexOf('--file');
if (args[2] === 'put' && f >= 0) fs.readFileSync(args[f + 1]);
`);
  fs.chmodSync(stub, 0o755);
  const calls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const run = (extra = [], env = {}) => spawnSync(process.execPath, [PUBLISH, '--version', '9.9.9', '--from', from, '--zip', zip, '--local', '--persist-to', path.join(dir, 'persist'), ...extra], {
    encoding: 'utf8', env: { ...process.env, WRANGLER: stub, ...env },
  });
  return { dir, run, calls };
}

test('publish uploads the zip, release.json, then current.json', () => {
  const t = fixture();
  const r = t.run();
  assert.equal(r.status, 0, r.stderr);
  const calls = t.calls();
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((a) => a[3]), [
    'damex-ve-releases/releases/9.9.9/damex-video-engine-9.9.9.zip',
    'damex-ve-releases/releases/9.9.9/release.json',
    'damex-ve-releases/current.json',
  ]);
  assert.deepEqual(calls[0].slice(0, 3), ['r2', 'object', 'put']);
  assert.ok(calls.every((a) => a.includes('--local') && a.includes('--persist-to')));
  assert.ok(calls.every((a) => !a.includes('--remote')));
});

test('publish stops before current.json when an upload fails', () => {
  const t = fixture();
  const r = t.run([], { STUB_FAIL_ON: '2' });
  assert.notEqual(r.status, 0);
  const calls = t.calls();
  assert.equal(calls.length, 2);
  assert.ok(!calls.some((a) => a[3].endsWith('current.json')));
  assert.match(r.stderr, /releases\/9\.9\.9\/release\.json/);
  assert.match(r.stderr, /current\.json was not written/);
});

test('sha mismatch stops with a sentence and no upload', () => {
  const t = fixture({ shaOk: false });
  const r = t.run();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /does not match its \.sha256, so nothing was published\./);
  assert.equal(t.calls().length, 0);
});

test('--current checks that the release exists, then rewrites only current.json', () => {
  const missing = fixture();
  const r1 = missing.run(['--current', '9.9.8'], { STUB_FAIL_ON: '1' });
  assert.notEqual(r1.status, 0);
  assert.match(r1.stderr, /Version 9\.9\.8 is not in the bucket/);
  assert.equal(missing.calls().length, 1);
  assert.equal(missing.calls()[0][2], 'get');

  const ok = fixture();
  const r2 = ok.run(['--current', '9.9.8']);
  assert.equal(r2.status, 0, r2.stderr);
  const calls = ok.calls();
  assert.deepEqual(calls.map((a) => a[2]), ['get', 'put']);
  assert.equal(calls[0][3], 'damex-ve-releases/releases/9.9.8/release.json');
  assert.equal(calls[1][3], 'damex-ve-releases/current.json');
});
