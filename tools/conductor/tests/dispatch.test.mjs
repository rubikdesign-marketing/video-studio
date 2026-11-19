import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { claim, job, run, settings } from './helpers.mjs';

const release = (dir, id, status) => run('dispatch.mjs', ['release', dir, id, '--status', status]);

// A fake worker: writes its output files, as a subagent would, and does nothing else.
const fakeWorker = (dir, ...files) => files.forEach((f) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), 'partial'); });

test('interrupted resume: partial work is kept, one retry is allowed, the second is stopped', () => {
  const dir = job();
  const a = claim(dir, { task: 's1', writes: 'scenes/s1.tsx' });
  assert.equal(a.out, 'ALLOW c1');
  fakeWorker(dir, 'scenes/s1.tsx');                       // the process ends here: no release was ever written

  const r = run('dispatch.mjs', ['resume', dir]);         // a new process
  assert.equal(r.code, 0);
  assert.match(r.out, /interrupted c1 stage=animation task=s1 worker=scene-builder; partial work preserved at: scenes\/s1.tsx; retries left: 1/);
  assert.equal(fs.readFileSync(path.join(dir, 'scenes/s1.tsx'), 'utf8'), 'partial');
  assert.match(run('dispatch.mjs', ['resume', dir]).out, /interrupted: none/, 'resume is idempotent');

  const retry = claim(dir, { task: 's1', writes: 'scenes/s1.tsx' });
  assert.equal(retry.out, 'ALLOW c2');                    // the one retry
  assert.equal(release(dir, 'c2', 'partial').code, 0);    // partial keeps outputs and counts
  const third = claim(dir, { task: 's1', writes: 'scenes/s1.tsx' });
  assert.equal(third.code, 4); assert.match(third.out, /^STOP retry cap/);
  assert.equal(fs.existsSync(path.join(dir, 'scenes/s1.tsx')), true);
  // another task is unaffected
  assert.equal(claim(dir, { task: 's2', writes: 'scenes/s2.tsx' }).code, 0);
});

test('a done task starts clean; a failed one counts', () => {
  const dir = job();
  claim(dir, { task: 't', writes: 'a' }); release(dir, 'c1', 'done');
  assert.equal(claim(dir, { task: 't', writes: 'a' }).out, 'ALLOW c2');
  release(dir, 'c2', 'failed');
  assert.equal(claim(dir, { task: 't', writes: 'a' }).out, 'ALLOW c3');
  release(dir, 'c3', 'failed');
  assert.equal(claim(dir, { task: 't', writes: 'a' }).code, 4);
});

test('caps: at most 2 active workers', () => {
  const dir = job();
  assert.equal(claim(dir, { task: 'a', writes: 'a' }).code, 0);
  assert.equal(claim(dir, { task: 'b', writes: 'b' }).code, 0);
  const r = claim(dir, { task: 'c', writes: 'c' });
  assert.equal(r.code, 4); assert.match(r.out, /^STOP active cap: 2 of 2/);
  release(dir, 'c1', 'done');
  assert.equal(claim(dir, { task: 'c', writes: 'c' }).out, 'ALLOW c3');
});

test('caps: 3 dispatches per stage, 6 in animation', () => {
  const dir = job();
  for (const t of ['a', 'b', 'c']) { const r = claim(dir, { stage: 'moodboard', task: t, worker: 'frame-critic' }); assert.equal(r.code, 0); release(dir, r.out.split(' ')[1], 'done'); }
  const r = claim(dir, { stage: 'moodboard', task: 'd', worker: 'frame-critic' });
  assert.equal(r.code, 4); assert.match(r.out, /^STOP stage cap: 3 of 3 .*"moodboard"/);
  for (let i = 0; i < 6; i++) { const x = claim(dir, { stage: 'animation', task: `s${i}`, writes: `s${i}` }); assert.equal(x.code, 0, `animation ${i}`); release(dir, x.out.split(' ')[1], 'done'); }
  const seventh = claim(dir, { stage: 'animation', task: 's7', writes: 's7' });
  assert.equal(seventh.code, 4); assert.match(seventh.out, /6 of 6/);
});

test('an overlapping write set with an active claim is stopped', () => {
  const dir = job();
  assert.equal(claim(dir, { task: 'a', writes: 'engine/src/jobs/j1/scenes' }).code, 0);
  for (const w of ['engine/src/jobs/j1/scenes/s1.tsx', 'engine/src/jobs/j1', 'engine/src/jobs/j1/scenes/']) {
    const r = claim(dir, { task: 'b', writes: w });
    assert.equal(r.code, 4, w); assert.match(r.out, /^STOP write overlap/);
  }
  assert.equal(claim(dir, { task: 'b', writes: 'engine/src/jobs/j1/scenes2/x.tsx' }).code, 0, 'a sibling name is not an overlap');
  release(dir, 'c1', 'done');
  assert.equal(claim(dir, { task: 'c', writes: 'engine/src/jobs/j1/scenes/s1.tsx' }).code, 0, 'free once the holder is released');
});

test('a blocked model is surfaced, never switched', () => {
  const dir = job();
  const env = { CONDUCTOR_SETTINGS_FILES: settings({ availableModels: ['sonnet', 'opus'], model: 'opus' }) };
  const r = claim(dir, { task: 'x', worker: 'checker', model: 'haiku' }, env);
  assert.equal(r.code, 4);
  assert.match(r.out, /^STOP model "haiku" is blocked: not in availableModels/);
  assert.match(r.out, /Not switched/); assert.match(r.out, /lead session/);
  assert.equal(fs.existsSync(path.join(dir, 'dispatch.jsonl')), false, 'nothing was recorded');
  assert.equal(claim(dir, { task: 'x', worker: 'scene-builder', model: 'sonnet' }, env).code, 0);

  const m = run('models.mjs', [], env);
  assert.match(m.out, /lead model: opus/); assert.match(m.out, /haiku\s+BLOCKED/); assert.match(m.out, /sonnet\s+allowed/);
  // full model ids match their family; a managed list narrows further
  const env2 = { CONDUCTOR_SETTINGS_FILES: [settings({ availableModels: ['claude-sonnet-5-5', 'claude-haiku-4-5'] }), settings({ availableModels: ['claude-haiku-4-5'] }, true)].join('|') };
  assert.match(run('models.mjs', [], env2).out, /sonnet\s+BLOCKED  not in availableModels \[claude-haiku-4-5\]/);
  assert.match(run('models.mjs', [], env2).out, /haiku\s+allowed/);
});

test('paid work is stopped without an approval, allowed with a valid one, stopped again when stale', () => {
  const dir = job({ 'spend.md': 'up to $5 on kling' });
  const r = claim(dir, { task: 'gen', worker: 'capture-runner', paid: true });
  assert.equal(r.code, 4); assert.match(r.out, /^STOP paid work needs a recorded approval/);
  assert.equal(claim(dir, { task: 'gen', paid: false, writes: 'x' }).code, 0, 'unpaid work is not blocked');
  release(dir, 'c1', 'done');
  run('gate.mjs', ['approve', dir, 'paid_usage', '--inputs', 'spend.md']);
  assert.equal(claim(dir, { task: 'gen', paid: true, writes: 'g' }).code, 0);
  release(dir, 'c2', 'done');
  fs.writeFileSync(path.join(dir, 'spend.md'), 'up to $50');
  assert.match(claim(dir, { task: 'gen2', paid: true }).out, /paid_usage\) is stale|is stale/);
});

test('usage prints claims per stage and model, and tokens only when supplied', () => {
  const dir = job();
  claim(dir, { task: 'a', writes: 'a' }); claim(dir, { task: 'b', writes: 'b', model: 'sonnet' });
  run('dispatch.mjs', ['release', dir, 'c1', '--status', 'done', '--tokens', '1000:200']);
  release(dir, 'c2', 'failed');
  let u = run('dispatch.mjs', ['usage', dir]).out;
  assert.match(u, /animation\s+sonnet\s+claims 2 \(done 1, failed 1/);
  assert.match(u, /tokens 1200 \(recorded for 1 of 2\)/);
  const dir2 = job(); claim(dir2, { task: 'a', writes: 'a' });
  assert.match(run('dispatch.mjs', ['usage', dir2]).out, /tokens not recorded/);
});

test('route prints the route and rejects an unknown class', () => {
  assert.match(run('route.mjs', ['run_checks']).out, /run_checks: haiku \(worker: checker\)/);
  assert.match(run('route.mjs', ['render']).out, /render: script/);
  assert.match(run('route.mjs', ['integration']).out, /integration: lead/);
  assert.match(run('route.mjs', ['scene_code']).out, /sonnet \(worker: scene-builder\)/);
  assert.equal(run('route.mjs', ['nonsense']).code, 2);
});

test('a claim after a torn last ledger line is kept (a killed writer left no newline)', () => {
  const j = job();
  const a = run('dispatch.mjs', ['claim', j, '--stage', 'animation', '--task', 't1', '--worker', 'scene-builder', '--model', 'sonnet', '--writes', 'scenes/S01.tsx']);
  assert.equal(a.code, 0, a.out);
  fs.appendFileSync(path.join(j, 'dispatch.jsonl'), '{"event":"claim","id":"torn');
  const b = run('dispatch.mjs', ['claim', j, '--stage', 'animation', '--task', 't2', '--worker', 'scene-builder', '--model', 'sonnet', '--writes', 'scenes/S02.tsx']);
  assert.equal(b.code, 0, b.out);
  const id = b.out.split(/\s+/)[1];
  const lines = fs.readFileSync(path.join(j, 'dispatch.jsonl'), 'utf8').split('\n').filter(Boolean);
  assert.ok(lines.some((l) => { try { return JSON.parse(l).id === id; } catch { return false; } }), 'the new claim must parse as its own line');
});
