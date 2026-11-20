import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { coreFailures, freePort, judgeMissingFfmpeg, judgeNote, killCommand, overall, parseArgs, stepEntry, stopChild } from './smoke.mjs';

const core = (status = 'pass') => ({ id: 'node', tier: 'core', status });
const mastering = (fix) => ({ id: 'mastering-checks', tier: 'capability', status: 'skip', fix });

test('parseArgs reads --root in both forms, including spaces and accents', () => {
  assert.equal(parseArgs(['--root', '/tmp/Vidéo studio']).root, '/tmp/Vidéo studio');
  assert.equal(parseArgs(['--root=C:\\Users\\Zoë\\Vidéo studio']).root, 'C:\\Users\\Zoë\\Vidéo studio');
  assert.equal(parseArgs([]).root, null);
});

test('coreFailures ignores capabilities', () => {
  assert.equal(coreFailures({ checks: [core(), mastering('x')] }).length, 0);
  assert.deepEqual(coreFailures({ checks: [core('fail')] }).map((c) => c.id), ['node']);
});

test('judgeMissingFfmpeg: needs core pass, missing capability and a fix text', () => {
  const ok = { checks: [core(), mastering('brew install ffmpeg-full')], capabilities: { 'mastering-checks': 'missing' } };
  assert.equal(judgeMissingFfmpeg(ok).ok, true);
  assert.equal(judgeMissingFfmpeg({ ...ok, checks: [core('fail'), mastering('x')] }).ok, false);
  assert.equal(judgeMissingFfmpeg({ ...ok, capabilities: { 'mastering-checks': 'ready' } }).ok, false);
  assert.equal(judgeMissingFfmpeg({ ...ok, checks: [core(), mastering('  ')] }).ok, false);
  assert.equal(judgeMissingFfmpeg(null).ok, false);
});

test('judgeNote needs the note in the draft and in a sent batch', () => {
  const draft = { draft: { notes: [{ text: 'a' }] } };
  const review = { batches: [{ batch: 1, notes: [{ text: 'a' }] }] };
  assert.equal(judgeNote({ draft, review, text: 'a' }).ok, true);
  assert.equal(judgeNote({ draft: { draft: { notes: [] } }, review, text: 'a' }).ok, false);
  assert.equal(judgeNote({ draft, review: { batches: [] }, text: 'a' }).ok, false);
});

test('overall: fail beats skip beats pass; skip is never pass', () => {
  const s = (status) => stepEntry('x', status, 1);
  assert.equal(overall([s('pass'), s('pass')]), 'pass');
  assert.equal(overall([s('pass'), s('skip')]), 'incomplete');
  assert.equal(overall([s('skip'), s('fail')]), 'fail');
});

test('killCommand uses taskkill /T /F on win32 only', () => {
  assert.deepEqual(killCommand(42, 'win32'), { cmd: 'taskkill', args: ['/pid', '42', '/T', '/F'] });
  assert.equal(killCommand(42, 'linux'), null);
});

test('freePort gives a usable port and stopChild ends a child', async () => {
  assert.ok((await freePort()) > 0);
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  await stopChild(child);
  assert.ok(child.exitCode !== null || child.signalCode);
});
