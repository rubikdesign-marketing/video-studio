// Tests for "make the next one in this style". Run: node --test tools/plan/tests/*.test.mjs
// The jobs are made in a temporary folder. style.mjs puts a job's scene files in engine/src/jobs/<name>/scenes, so each
// test uses a name nobody else has and removes that folder afterwards; the incomplete style is removed the same way.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const STYLE = path.join(STUDIO, 'tools/plan/style.mjs');
const run = (...args) => { const r = spawnSync(process.execPath, [STYLE, ...args], { encoding: 'utf8' }); return { code: r.status, out: r.stdout, err: r.stderr }; };
const unique = (what) => `style-test-${what}-${process.pid}-${Date.now()}`;
const engineDir = (name) => path.join(STUDIO, 'engine/src/jobs', name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

test('the shipped UGC preset is listed in plain words', () => {
  const r = run('list', 'demo');
  assert.equal(r.code, 0, r.err);
  const line = r.out.split('\n').find((l) => l.startsWith('demo/ugc-phone-take:'));
  assert.ok(line, r.out);
  assert.doesNotMatch(line, /undefined/);
  assert.match(line, /9:16 ugc, 4 scenes/);
});

test('a new job starts from the shipped UGC preset without an error', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'style-new-'));
  const name = unique('ugc'); const jobDir = path.join(tmp, name); const engine = engineDir(name);
  assert.ok(!fs.existsSync(engine), 'the engine folder is free');
  try {
    const r = run('new', jobDir, '--style', 'demo/ugc-phone-take', 'how to share a board');
    assert.equal(r.code, 0, r.err);
    assert.doesNotMatch(r.out + r.err, /undefined|TypeError/);
    const job = JSON.parse(fs.readFileSync(path.join(jobDir, 'job.json'), 'utf8'));
    assert.equal(job.size, '9:16'); assert.equal(job.type, 'ugc'); assert.equal(job.approval_mode, 'guided');
    assert.doesNotMatch(job.notes[0], /undefined/);
    const brief = JSON.parse(fs.readFileSync(path.join(jobDir, 'brief.json'), 'utf8'));
    assert.equal(brief.in_their_words, 'how to share a board'); assert.equal(brief.kind, 'ugc');
    assert.ok(brief.decisions.some((d) => /Try it today/.test(d.what)));
    const shots = JSON.parse(fs.readFileSync(path.join(jobDir, 'shots.json'), 'utf8'));
    assert.equal(shots.scenes.length, 4);
    for (const s of shots.scenes) for (const sh of s.shots) { assert.equal(sh.text, ''); assert.ok(sh._last_time); }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(engine, { recursive: true, force: true });
  }
});

test('a style that is missing what an episode needs stops before anything is written', () => {
  const styleName = unique('incomplete');
  const styleDir = path.join(STUDIO, 'brands/demo/styles', styleName);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'style-new-'));
  const name = unique('job'); const jobDir = path.join(tmp, name); const engine = engineDir(name);
  try {
    fs.mkdirSync(styleDir, { recursive: true });
    fs.writeFileSync(path.join(styleDir, 'style.json'), JSON.stringify({ name: styleName, kind: 'ugc', type: 'ugc', brand: 'demo', structure: [{ id: 'hook', start: 0, end: 2.5 }] }));
    const r = run('new', jobDir, '--style', `demo/${styleName}`, 'anything');
    assert.equal(r.code, 1);
    assert.doesNotMatch(r.err, /TypeError|at .*\.mjs/);
    assert.match(r.err, /cannot start an episode because it has .*no size.*no shots for hook.*so nothing was written\./);
    assert.equal(r.err.trim().split('\n').length, 1, 'one plain sentence');
    assert.ok(!fs.existsSync(jobDir), 'no job folder was made');
    assert.ok(!fs.existsSync(engine), 'no engine folder was made');
  } finally {
    fs.rmSync(styleDir, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(engine, { recursive: true, force: true });
  }
});
