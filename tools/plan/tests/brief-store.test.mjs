// Tests for the brief store (tools/plan/lib/brief-store.mjs) and the CLI that uses it.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { confirmPlan, customerBrands, jobFolderName, loadJob, saveBrief, startBrief, studioContext, writePlan } from '../lib/brief-store.mjs';
import { completeBrief, scratchStudio } from './helpers.mjs';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../brief.mjs');
const fresh = () => { const root = scratchStudio(); return { root, jobDir: path.join(root, 'jobs', '2026-11-21-demo') }; };

test('store: jobFolderName makes a short dated folder name', () => {
  assert.equal(jobFolderName('A vertical demo of the new export button for agencies', '2026-11-21'), '2026-11-21-vertical-demo-new-export-button');
  assert.equal(jobFolderName('!!!', '2026-11-21'), '2026-11-21-video');
});

test('store: customerBrands leaves out demo', () => {
  const { root } = fresh();
  assert.deepEqual(customerBrands(studioContext(root)), ['acme']);
});

test('store: a bad brief.json is a plain error naming the job', () => {
  const { jobDir } = fresh();
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(path.join(jobDir, 'brief.json'), '{ nope');
  assert.throws(() => loadJob(jobDir), /brief\.json cannot be read/);
});

test('store: startBrief refuses to overwrite', () => {
  const { root, jobDir } = fresh();
  assert.equal(startBrief(root, jobDir, 'a demo').in_their_words, 'a demo');
  assert.throws(() => startBrief(root, jobDir, 'again'), /exists already/);
});

test('store: confirmPlan refuses before the plan, then makes job.json at the Idea stage', () => {
  const { root, jobDir } = fresh();
  startBrief(root, jobDir, 'a demo');
  assert.throws(() => confirmPlan(root, jobDir), /plan/);
  saveBrief(jobDir, completeBrief());
  assert.ok(writePlan(root, jobDir).md.startsWith('# The plan, in brief'));
  const job = confirmPlan(root, jobDir);
  assert.equal(job.stage_next, 'idea'); assert.equal(job.type, 'demo'); assert.equal(job.brand, 'acme');
  assert.equal(job.size, '9:16'); assert.equal(job.length_cap_seconds, 20);
  assert.ok(loadJob(jobDir).brief.decisions.some((d) => d.what === 'plan confirmed'));
});

test('store: an existing job.json is kept, with a note', () => {
  const { root, jobDir } = fresh();
  startBrief(root, jobDir, 'a demo'); saveBrief(jobDir, completeBrief()); writePlan(root, jobDir);
  fs.writeFileSync(path.join(jobDir, 'job.json'), JSON.stringify({ name: 'old', brand: 'acme', stage_next: 'moodboard' }));
  const job = confirmPlan(root, jobDir);
  assert.equal(job.stage_next, 'moodboard'); assert.equal(job.notes.length, 1);
});

test('cli: new then check still works', () => {
  const { jobDir } = fresh();
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });
  assert.equal(run('new', jobDir, 'a vertical demo').status, 0);
  const r = run('check', jobDir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Pre-flight: /);
});

test('store: confirmPlan takes an assumed brand, and a second call changes nothing', () => {
  const { root, jobDir } = fresh();
  startBrief(root, jobDir, 'an acme demo');
  const b = completeBrief(); delete b.brand; b.in_their_words = 'an acme demo';
  saveBrief(jobDir, b);
  assert.ok(writePlan(root, jobDir));
  assert.equal(confirmPlan(root, jobDir).brand, 'acme');
  confirmPlan(root, jobDir);
  assert.equal(loadJob(jobDir).brief.decisions.filter((d) => d.what === 'plan confirmed').length, 1);
  assert.equal(loadJob(jobDir).job.brand, 'acme');
});

test('store: a caller context decides the brand and completeness', () => {
  const { root, jobDir } = fresh();
  startBrief(root, jobDir, 'a demo');
  const b = completeBrief(); delete b.brand; saveBrief(jobDir, b);
  const ctx = { ...studioContext(root), defaultBrand: undefined };
  assert.equal(writePlan(root, jobDir, { ctx }), null);
});

test('store: confirmPlan on an existing job.json notes once', () => {
  const { root, jobDir } = fresh();
  startBrief(root, jobDir, 'a demo'); saveBrief(jobDir, completeBrief()); writePlan(root, jobDir);
  fs.writeFileSync(path.join(jobDir, 'job.json'), JSON.stringify({ name: 'old' }));
  confirmPlan(root, jobDir); confirmPlan(root, jobDir);
  assert.equal(loadJob(jobDir).job.notes.length, 1);
});

test('cli: a bad job.json with no brief still says no brief yet', () => {
  const { jobDir } = fresh();
  fs.mkdirSync(jobDir, { recursive: true }); fs.writeFileSync(path.join(jobDir, 'job.json'), '{ nope');
  const r = spawnSync(process.execPath, [CLI, 'check', jobDir], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stdout, /No brief yet/);
});

test('store: confirmPlan refuses a plan that changed since it was shown, and a confirmed plan can be confirmed again', () => {
  const { root, jobDir } = fresh();
  startBrief(root, jobDir, 'a demo'); saveBrief(jobDir, completeBrief()); writePlan(root, jobDir);
  saveBrief(jobDir, { ...completeBrief(), length_cap_seconds: 30 });
  assert.throws(() => confirmPlan(root, jobDir), /^Error: The plan changed since it was shown; show it again\.$/);
  assert.ok(!fs.existsSync(path.join(jobDir, 'job.json')));
  writePlan(root, jobDir);
  assert.equal(confirmPlan(root, jobDir).length_cap_seconds, 30);
  assert.equal(confirmPlan(root, jobDir).length_cap_seconds, 30);
});
