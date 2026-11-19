// Tests for the dependability pieces: the render lock, the paid-generation ledger (against a stand-in Kling server, so
// nothing is charged), keeping the last good file, and the run log.
// Run: node --test tools/film/tests/*.test.mjs   (the Kling tests open a local port; outside Claude's sandbox)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { test } from 'node:test';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acquire, holder } from '../lib/lock.mjs';
import { decide, requestKey, update, load } from '../lib/ledger.mjs';
import { record, read } from '../lib/runlog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const deadPid = () => { const r = spawnSync(process.execPath, ['-e', 'process.pid']); return r.pid; };

test('lock: a second taker is refused while the first holds it, and gets it once released', () => {
  const lock = path.join(tmp('lock-'), '.render.lock');
  const release = acquire(lock, { tool: 't', job: 'j', log: () => {} });
  assert.equal(acquire(lock, { wait: false, log: () => {} }), null);
  assert.equal(JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'), 'utf8')).tool, 't');
  release();
  assert.equal(fs.existsSync(lock), false);
  const again = acquire(lock, { wait: false, log: () => {} });
  assert.equal(typeof again, 'function'); again();
});

test('lock: a lock whose process has ended is cleared', () => {
  const lock = path.join(tmp('lock-'), '.render.lock');
  fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'pid'), String(deadPid()));
  assert.equal(holder(lock).stale, true);
  const lines = [];
  const release = acquire(lock, { wait: false, log: (m) => lines.push(m) });
  assert.equal(typeof release, 'function'); release();
  assert.match(lines.join('\n'), /left behind/);
});

test('lock: a lock held by a live process for over six hours is a reused process id, and is cleared', () => {
  const lock = path.join(tmp('lock-'), '.render.lock');
  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, 'pid'), String(process.pid));
  fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, started: new Date(Date.now() - 7 * 3600e3).toISOString() }));
  assert.equal(holder(lock).stale, true);
  const release = acquire(lock, { wait: false, log: () => {} });
  assert.equal(typeof release, 'function'); release();
});

test('lock: an empty lock is left alone while young and cleared once old', () => {
  const lock = path.join(tmp('lock-'), '.render.lock');
  fs.mkdirSync(lock);
  assert.equal(acquire(lock, { wait: false, log: () => {} }), null);
  const old = new Date(Date.now() - 120_000); fs.utimesSync(lock, old, old);
  const release = acquire(lock, { wait: false, log: () => {} });
  assert.equal(typeof release, 'function'); release();
});

test('ledger: what may be sent again', () => {
  assert.equal(decide(null).send, true);
  assert.equal(decide({ status: 'failed' }).send, true);
  assert.equal(decide({ status: 'refused', message: 'balance' }).send, true);
  assert.equal(decide({ status: 'sending', sent_at: 'x', external_id: 'vs-1' }).send, false);
  const s = decide({ status: 'succeeded', task_id: 'T1' });
  assert.equal(s.send, false); assert.equal(s.task_id, 'T1');
});

test('ledger: the key ignores key order and changes with the take', () => {
  const a = requestKey({ provider: 'kling', route: '/r', body: { a: 1, b: { c: 2, d: 3 } } });
  const b = requestKey({ provider: 'kling', route: '/r', body: { b: { d: 3, c: 2 }, a: 1 } });
  assert.equal(a, b);
  assert.notEqual(a, requestKey({ provider: 'kling', route: '/r', body: { a: 1, b: { c: 2, d: 3 } }, take: 2 }));
  const file = path.join(tmp('ledger-'), 'ledger.json');
  update(file, a, { status: 'sending' }); update(file, a, { status: 'submitted', task_id: 'T' });
  assert.deepEqual([load(file).requests[a].status, load(file).requests[a].task_id], ['submitted', 'T']);
});

// ---------------------------------------------------------------- Kling client against a stand-in server

async function standIn(behaviour) {
  const posts = [];
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.method === 'POST') posts.push({ url: req.url, body: JSON.parse(body) });
      behaviour(req, res, posts);
    });
  });
  // Where local ports are not allowed (Claude's command sandbox), the Kling tests skip instead of failing.
  const ok = await new Promise((r) => { server.once('error', () => r(false)); server.listen(0, '127.0.0.1', () => r(true)); });
  if (!ok) return null;
  return { url: `http://127.0.0.1:${server.address().port}`, posts, close: () => new Promise((r) => server.close(r)) };
}
const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

function kling(server, ledger, ...args) {
  const env = { ...process.env, KLING_BASE_URL: server.url, KLING_API_KEY: 'test', VIDEO_STUDIO_LEDGER: ledger };
  delete env.HTTPS_PROXY; delete env.https_proxy; delete env.HTTP_PROXY; delete env.http_proxy;
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [path.join(HERE, '..', 'kling.mjs'), ...args], { env });
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });
}

test('kling: the same request twice is paid once; a new take is paid again', async (t) => {
  let n = 0;
  const server = await standIn((req, res) => {
    if (req.method === 'POST') return json(res, 200, { code: 0, data: { id: `T${++n}`, status: 'submitted' } });
    json(res, 200, { code: 0, data: [{ id: 'T1', status: 'succeeded', outputs: [] }] });
  });
  if (!server) return t.skip('no local port allowed here');
  const ledger = path.join(tmp('ledger-'), 'ledger.json');
  try {
    const first = await kling(server, ledger, 't2v', 'a hand picks up a cup', '--duration', '5', '--job', '/x/jobs/demo');
    assert.equal(first.code, 0, first.out); assert.match(first.out, /video task T1/);
    const again = await kling(server, ledger, 't2v', 'a hand picks up a cup', '--duration', '5');
    assert.equal(again.code, 0, again.out); assert.match(again.out, /Not sent: the same request is already submitted as task T1/);
    assert.equal(server.posts.length, 1);
    assert.match(server.posts[0].body.options.external_task_id, /^vs-[0-9a-f]{16}-1$/);
    const take2 = await kling(server, ledger, 't2v', 'a hand picks up a cup', '--duration', '5', '--take', '2');
    assert.match(take2.out, /video task T2/); assert.equal(server.posts.length, 2);
    const e = Object.values(load(ledger).requests).find((x) => x.task_id === 'T1');
    assert.equal(e.job, 'demo'); assert.deepEqual(e.units, { seconds: 5, resolution: '1080p', model: 'kling-2.6', audio: 'off' });
  } finally { await server.close(); }
});

test('kling: a refused request may be sent again; a request with no answer is never re-sent on its own', async (t) => {
  let mode = 'refuse';
  const server = await standIn((req, res) => {
    if (mode === 'refuse') return json(res, 429, { code: 1102, message: 'Account balance not enough' });
    if (mode === 'drop') return req.socket.destroy();
    json(res, 200, { code: 0, data: { id: 'T9', status: 'submitted' } });
  });
  if (!server) return t.skip('no local port allowed here');
  const ledger = path.join(tmp('ledger-'), 'ledger.json');
  try {
    const refused = await kling(server, ledger, 't2v', 'x');
    assert.equal(refused.code, 1); assert.equal(Object.values(load(ledger).requests)[0].status, 'refused');
    mode = 'drop';
    const dropped = await kling(server, ledger, 't2v', 'x');
    assert.notEqual(dropped.code, 0); assert.match(dropped.out, /Sending again: the last attempt was refused/);
    assert.equal(Object.values(load(ledger).requests)[0].status, 'sending');
    mode = 'ok';
    const blocked = await kling(server, ledger, 't2v', 'x');
    assert.match(blocked.out, /Not sent: .*may have been charged/); assert.equal(server.posts.length, 2);
    const resent = await kling(server, ledger, 't2v', 'x', '--resend');
    assert.match(resent.out, /video task T9/); assert.equal(server.posts.length, 3);
    const list = await kling(server, ledger, 'ledger');
    assert.match(list.out, /submitted .* T9/);
  } finally { await server.close(); }
});

test('kling: wait records the finished task in the ledger', async (t) => {
  const server = await standIn((req, res) => {
    if (req.method === 'POST') return json(res, 200, { code: 0, data: { id: 'T5', status: 'submitted' } });
    if (req.url.startsWith('/tasks')) return json(res, 200, { code: 0, data: [{ id: 'T5', status: 'succeeded', outputs: [] }] });
    json(res, 404, {});
  });
  if (!server) return t.skip('no local port allowed here');
  const dir = tmp('ledger-'); const ledger = path.join(dir, 'ledger.json');
  try {
    await kling(server, ledger, 't2v', 'y');
    const w = await kling(server, ledger, 'wait', 'T5', '--out', path.join(dir, 'clips'), '--every', '0');
    assert.equal(w.code, 0, w.out);
    assert.equal(Object.values(load(ledger).requests)[0].status, 'succeeded');
  } finally { await server.close(); }
});

// ---------------------------------------------------------------- keeping the last good file, the run log

test('replace_keeping keeps the last three versions and puts the new file in place', () => {
  const dir = tmp('keep-');
  const safe = path.join(HERE, '..', 'lib', 'safe.sh');
  for (let i = 1; i <= 5; i++) {
    fs.writeFileSync(path.join(dir, 'new.mp4'), `v${i}`);
    const r = spawnSync('bash', ['-c', `source "${safe}"; replace_keeping "${dir}/new.mp4" "${dir}/preview.mp4"; sleep 1.05`]);
    assert.equal(r.status, 0, String(r.stderr));
  }
  assert.equal(fs.readFileSync(path.join(dir, 'preview.mp4'), 'utf8'), 'v5');
  const kept = fs.readdirSync(path.join(dir, 'versions')).sort();
  assert.equal(kept.length, 3);
  assert.deepEqual(kept.map((f) => fs.readFileSync(path.join(dir, 'versions', f), 'utf8')), ['v2', 'v3', 'v4']);
});

test('run log: entries are appended with time and machine, and read back', () => {
  const dir = tmp('runs-');
  record(dir, { tool: 'render', mode: 'preview', seconds: 12.5, ok: true });
  const r = spawnSync(process.execPath, [path.join(HERE, '..', 'lib', 'runlog.mjs'), 'add', dir, 'tool=storyboard', 'frames=19', 'ok=true']);
  assert.equal(r.status, 0);
  const runs = read(dir);
  assert.equal(runs.length, 2); assert.equal(runs[1].frames, 19); assert.equal(runs[1].ok, true);
  assert.ok(runs[0].at && runs[0].machine && !runs[0].machine.includes(os.hostname()));
});

test('kling: lip-sync run twice asks for the face once and pays once', async (t) => {
  const server = await standIn((req, res) => {
    if (req.url.includes('identify-face')) return json(res, 200, { code: 0, data: { session_id: `sess-${Math.random()}`, face_data: [{ face_id: '0', start_time: 0, end_time: 3000 }] } });
    if (req.url.includes('advanced-lip-sync')) return json(res, 200, { code: 0, data: { task_id: 'L1', task_status: 'submitted' } });
    json(res, 404, {});
  });
  if (!server) return t.skip('no local port allowed here');
  const dir = tmp('ledger-'); const ledger = path.join(dir, 'ledger.json');
  const sound = path.join(dir, 'line.mp3'); fs.writeFileSync(sound, 'not really audio');
  try {
    const a = await kling(server, ledger, 'lipsync', 'https://example.test/v.mp4', sound, '--end', '3000');
    assert.equal(a.code, 0, a.out); assert.match(a.out, /lip-sync task L1/);
    const b = await kling(server, ledger, 'lipsync', 'https://example.test/v.mp4', sound, '--end', '3000');
    assert.match(b.out, /Not sent: the same request is already submitted as task L1/);
    assert.equal(server.posts.filter((p) => p.url.includes('identify-face')).length, 1);
    assert.equal(server.posts.filter((p) => p.url.includes('advanced-lip-sync')).length, 1);
  } finally { await server.close(); }
});

test('kling: the same request started twice at the same moment is paid once', async (t) => {
  const server = await standIn((req, res) => { setTimeout(() => json(res, 200, { code: 0, data: { id: 'T7', status: 'submitted' } }), 150); });
  if (!server) return t.skip('no local port allowed here');
  const ledger = path.join(tmp('ledger-'), 'ledger.json');
  try {
    const [a, b] = await Promise.all([kling(server, ledger, 't2v', 'same'), kling(server, ledger, 't2v', 'same')]);
    assert.equal(server.posts.length, 1, a.out + b.out);
    assert.ok(/Not sent/.test(a.out + b.out));
  } finally { await server.close(); }
});

test('kling: a retry after a refusal uses a new id in the task list', async (t) => {
  let n = 0;
  const server = await standIn((req, res) => (++n === 1 ? json(res, 429, { code: 1102, message: 'balance' }) : json(res, 200, { code: 0, data: { id: 'T8', status: 'submitted' } })));
  if (!server) return t.skip('no local port allowed here');
  const ledger = path.join(tmp('ledger-'), 'ledger.json');
  try {
    await kling(server, ledger, 't2v', 'z'); await kling(server, ledger, 't2v', 'z');
    const ids = server.posts.map((p) => p.body.options.external_task_id);
    assert.notEqual(ids[0], ids[1]); assert.match(ids[1], /-2$/);
  } finally { await server.close(); }
});
