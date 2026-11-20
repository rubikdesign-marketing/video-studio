// Run: node --test tools/conductor/tests/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { job, run } from './helpers.mjs';

test('short route: approve a gate, and a rerun skips it', () => {
  const dir = job({ 'idea.md': 'a video about croissants', 'brief/notes.md': 'n1' });
  assert.equal(run('gate.mjs', ['check', dir, 'idea']).code, 1);
  let r = run('dispatch.mjs', ['resume', dir]);
  assert.match(r.out, /NEXT: run stage "intake-and-idea", then ask the owner to approve "idea"/);

  r = run('gate.mjs', ['approve', dir, 'idea', '--inputs', 'idea.md,brief', '--by', 'owner']);
  assert.equal(r.code, 0, r.err);
  assert.equal(run('gate.mjs', ['check', dir, 'idea']).code, 0);

  // A new process, as after a restart: the idea gate is skipped, the next one is asked for.
  r = run('dispatch.mjs', ['resume', dir]);
  assert.match(r.out, /gates already satisfied \(skipped\): idea/);
  assert.match(r.out, /NEXT: run stage "script-and-voice", then ask the owner to approve "script_and_voice"/);
  assert.match(run('gate.mjs', ['status', dir]).out, /idea\s+OK/);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'receipts.json'), 'utf8'));
  assert.deepEqual(saved.gates.idea.inputs, ['brief', 'idea.md']);
  assert.equal(fs.readdirSync(dir).some((f) => f.includes('.tmp-')), false, 'no temp file left behind');
});

test('a changed input makes the gate stale; changing it back makes it good again', () => {
  const dir = job({ 'script.md': 'one', 'audio/a.txt': 'x' });
  run('gate.mjs', ['approve', dir, 'script_and_voice', '--inputs', 'script.md,audio']);
  fs.writeFileSync(path.join(dir, 'audio/a.txt'), 'changed');
  let r = run('gate.mjs', ['check', dir, 'script_and_voice']);
  assert.equal(r.code, 3); assert.match(r.out, /STALE/);
  assert.match(run('dispatch.mjs', ['resume', dir]).out, /NEXT: .*"idea"/); // idea itself was never approved
  fs.writeFileSync(path.join(dir, 'audio/a.txt'), 'x');
  assert.equal(run('gate.mjs', ['check', dir, 'script_and_voice']).code, 0);
  fs.writeFileSync(path.join(dir, 'audio/new.txt'), 'added');
  assert.equal(run('gate.mjs', ['check', dir, 'script_and_voice']).code, 3, 'a new file in a covered folder counts');
});

test('approve refuses a missing input and prints usage with no arguments', () => {
  const dir = job({ 'a.md': 'a' });
  const r = run('gate.mjs', ['approve', dir, 'idea', '--inputs', 'nope.md']);
  assert.equal(r.code, 2); assert.match(r.err, /not found/);
  assert.equal(run('gate.mjs', []).code, 0);
});

test('grouped mode: one brief review satisfies idea, script and moodboard; storyboard is optional', () => {
  const dir = job({ 'brief.md': 'b' });
  run('gate.mjs', ['approve', dir, 'brief_review', '--inputs', 'brief.md', '--mode', 'grouped']);
  for (const g of ['idea', 'script_and_voice', 'moodboard']) assert.equal(run('gate.mjs', ['check', dir, g]).code, 0, g);
  const r = run('dispatch.mjs', ['resume', dir]);
  assert.match(r.out, /mode grouped/);
  assert.match(r.out, /NEXT: run stage "animation", then ask the owner to approve "final_cut"/);
  fs.writeFileSync(path.join(dir, 'brief.md'), 'changed');
  assert.equal(run('gate.mjs', ['check', dir, 'idea']).code, 3);
});

test('approve accepts inputs written from the studio folder (jobs/<job>/file) or as absolute paths', () => {
  const dir = job({ 'soul-sheets.md': 'three concepts', 'look/a.png': 'x' });
  const studio = path.resolve(dir, '../..');
  let r = run('gate.mjs', ['approve', 'jobs/j1', 'idea', '--inputs', 'jobs/j1/soul-sheets.md'], {}, { cwd: studio });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'receipts.json'), 'utf8')).gates.idea.inputs, ['soul-sheets.md']);
  assert.equal(run('gate.mjs', ['check', 'jobs/j1', 'idea'], {}, { cwd: studio }).code, 0);
  r = run('gate.mjs', ['approve', dir, 'moodboard', '--inputs', path.join(dir, 'look')]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'receipts.json'), 'utf8')).gates.moodboard.inputs, ['look']);
  // A file that exists from the studio folder but sits outside the job is still refused.
  fs.writeFileSync(path.join(studio, 'outside.md'), 'not in the job');
  r = run('gate.mjs', ['approve', 'jobs/j1', 'storyboard', '--inputs', 'outside.md'], {}, { cwd: studio });
  assert.notEqual(r.code, 0);
  assert.match(r.err + r.out, /input not found: outside\.md/);
});

test("job.json with the template's approval_mode placeholder reads as guided, so status and resume still run", () => {
  const template = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../../templates/job.json'), 'utf8'));
  const dir = job({ 'job.json': JSON.stringify(template) });
  const status = run('gate.mjs', ['status', dir]);
  assert.equal(status.code, 0, status.err);
  assert.match(status.out, /guided/);
  const resume = run('dispatch.mjs', ['resume', dir]);
  assert.equal(resume.code, 0, resume.err);
  assert.match(resume.out, /mode guided/);
  const grouped = job({ 'job.json': JSON.stringify({ approval_mode: 'grouped (a brief review and a final cut review)' }) });
  assert.match(run('dispatch.mjs', ['resume', grouped]).out, /mode grouped/);
});
