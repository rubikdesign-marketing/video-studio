// Exports end to end: a request written by the server is taken by tools/film/export-worker.mjs (which the server
// starts itself), rendered (here by a stand-in for render.mjs, EXPORT_RENDERER), cropped to the wanted shape, and reported back through the request file,
// /api/exports and /api/events.   node --test "studio/tests/*.test.mjs"   (needs ffmpeg)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { makeRoot, startServer } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(HERE, '../../tools/film/export-worker.mjs');
const STUB = path.join(HERE, 'stub-export-render.mjs');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) throw new Error('Timed out waiting.'); await pause(60); } };
const deadPid = () => spawnSync(process.execPath, ['-e', 'process.pid']).pid;

function listen(server, job) {
  const events = [];
  const request = http.get(`${server.base}/api/events?job=${job}`, (res) => {
    let text = ''; res.setEncoding('utf8');
    res.on('data', (c) => { text += c; let cut; while ((cut = text.indexOf('\n\n')) >= 0) { const b = text.slice(0, cut); text = text.slice(cut + 2); const d = b.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join(''); if (d) events.push(JSON.parse(d)); } });
  });
  return { events, close: () => request.destroy() };
}

describe('exports', () => {
  let root; let server;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-'));
  const worker = (env = {}, args = ['--job', 'demo']) => {
    const child = spawn(process.execPath, [WORKER, ...args], { env: { ...process.env, STUDIO_ROOT: root.root, EXPORT_RENDERER: STUB, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.done = new Promise((r) => child.on('exit', (code) => r(code)));
    return child;
  };
  // These tests start the worker by hand, so a request is written straight to the review folder (the server would start a worker of its own).
  let next = 0;
  const request = async (d) => { const n = ++next; root.write(`jobs/demo/review/export-${String(n).padStart(3, '0')}.json`, { export: n, job: 'demo', requested_at: new Date().toISOString(), status: 'requested', ...d }); return { export: n }; };
  const file = (n) => root.path(`jobs/demo/review/export-${String(n).padStart(3, '0')}.json`);
  const status = (n) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return null; } };
  const size = (f) => String(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', f]).stdout).trim();
  before(async () => { root = makeRoot(); server = await startServer(root.root); });
  after(async () => { await server.stop(); root.remove(); fs.rmSync(tmp, { recursive: true, force: true }); });

  it('goes requested, running, done; the file is the right size; the page is told; no half-written file is ever listed', async () => {
    const live = listen(server, 'demo'); await pause(200);
    const gate = path.join(tmp, 'gate1');
    const r = await request({ ratio: '9:16', height: 720, quality: 'preview' });
    assert.equal(status(r.export).status, 'requested');
    const w = worker({ STUB_GATE: gate });
    const running = await until(() => status(r.export)?.status === 'running' && status(r.export));
    assert.equal(running.worker_pid, w.pid); assert.ok(running.started_at);
    assert.equal((await (await server.get('/api/exports?job=demo')).json()).exports[0].status, 'running');
    fs.writeFileSync(gate, '');
    assert.equal(await w.done, 0);
    const done = status(r.export);
    assert.equal(done.status, 'done'); assert.equal(done.file, 'export-001-9x16-720.mp4'); assert.ok(done.finished_at); assert.equal(done.worker_pid, undefined);
    assert.equal(size(root.path('jobs/demo/out/' + done.file)), '406x720');
    assert.deepEqual(fs.readdirSync(root.path('jobs/demo/out')).filter((f) => f.startsWith('.')), [], 'no hidden partial files left');
    await until(() => live.events.some((e) => e.type === 'export' && e.status === 'done'));
    assert.deepEqual(live.events.find((e) => e.status === 'done'), { type: 'export', n: 1, status: 'done', file: 'export-001-9x16-720.mp4' });
    assert.equal((await server.get('/media/demo/' + done.file)).status, 200);
    const films = (await (await server.get('/api/film?job=demo')).json()).videos.map((v) => v.file);
    assert.ok(!films.some((f) => f.startsWith('export-')), 'exports are not film versions');
    live.close();
  });

  it('a 16:9 export at the render height is copied as it is', async () => {
    const r = await request({ ratio: '16:9', height: 720, quality: 'master' });
    assert.equal(await worker().done, 0);
    const d = status(r.export);
    assert.equal(d.status, 'done'); assert.equal(size(root.path('jobs/demo/out/' + d.file)), '1280x720');
  });

  it('a render that fails ends as failed with a plain sentence, and the page is told', async () => {
    const live = listen(server, 'demo'); await pause(200);
    const r = await request({ ratio: '1:1', height: 1080, quality: 'preview' });
    assert.equal(await worker({ STUB_FAIL: '1' }).done, 0);
    const d = status(r.export);
    assert.equal(d.status, 'failed'); assert.match(d.error, /^The render did not finish, so nothing was exported\./); assert.match(d.error, /Chrome could not start/);
    assert.equal(d.file, undefined);
    await until(() => live.events.some((e) => e.type === 'export' && e.status === 'failed' && e.error));
    assert.deepEqual(fs.readdirSync(root.path('jobs/demo/out')).filter((f) => f.includes(`export-${String(r.export).padStart(3, '0')}`)), []);
    live.close();
  });

  it('a worker killed part-way leaves a running request that the next worker takes back and finishes', async () => {
    const gate = path.join(tmp, 'gate-never'); const pidfile = path.join(tmp, 'stub.pid');
    const r = await request({ ratio: '9:16', height: 1080, quality: 'preview' });
    const w = worker({ STUB_GATE: gate, STUB_PIDFILE: pidfile });
    await until(() => status(r.export)?.status === 'running' && fs.existsSync(pidfile));
    w.kill('SIGKILL'); await w.done;
    try { process.kill(Number(fs.readFileSync(pidfile, 'utf8'))); } catch { /* already gone */ }
    assert.equal(status(r.export).status, 'running');                       // nobody has noticed yet
    assert.equal(await worker().done, 0);
    assert.equal(status(r.export).status, 'done');
    assert.equal(size(root.path('jobs/demo/out/' + status(r.export).file)), '608x1080');
  });

  it('a running request whose worker has died goes back to requested (and a live one is left alone)', async () => {
    root.write('jobs/demo/review/export-050.json', { export: 50, job: 'demo', status: 'running', started_at: 'x', worker_pid: deadPid(), ratio: '16:9', height: 720, quality: 'preview' });
    root.write('jobs/demo/review/export-051.json', { export: 51, job: 'demo', status: 'running', started_at: 'x', worker_pid: process.pid, ratio: '16:9', height: 720, quality: 'preview' });
    assert.equal(await worker({ STUB_FAIL: '1' }).done, 0);
    assert.equal(status(50).status, 'failed');                              // recovered, then taken (the stand-in render failed)
    assert.equal(status(51).status, 'running');
  });

  it('two workers at once never take the same request', async () => {
    const log = path.join(tmp, 'log');
    const ns = [(await request({ ratio: '1:1', height: 720, quality: 'preview' })).export, (await request({ ratio: '1:1', height: 1080, quality: 'preview' })).export];
    const a = worker({ STUB_LOG: log }); const b = worker({ STUB_LOG: log });
    await Promise.all([a.done, b.done]);
    for (const n of ns) assert.equal(status(n).status, 'done', `export ${n}`);
    assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 2, 'each request was rendered once');
  });
});

describe('the server runs the worker', () => {
  let root; let server;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'export-auto-'));
  const file = (n) => root.path(`jobs/demo/review/export-${String(n).padStart(3, '0')}.json`);
  const status = (n) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return null; } };
  const post = async (d) => (await (await server.post('/api/export?job=demo', d)).json()).export;
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  before(async () => { root = makeRoot(); server = await startServer(root.root, { EXPORT_RENDERER: STUB }); });
  after(async () => { await server.stop(); root.remove(); fs.rmSync(tmp, { recursive: true, force: true }); });

  it('server starts a worker when a request is written', async () => {
    const r = await post({ ratio: '9:16', height: 720, quality: 'preview' });
    const done = await until(() => status(r.export)?.status === 'done' && status(r.export), 10000);
    assert.equal(done.file, 'export-001-9x16-720.mp4');
    assert.ok(fs.existsSync(root.path('jobs/demo/out/export-001-9x16-720.mp4')));
  });

  it('a second request while one runs starts no second worker', async () => {
    const gate = path.join(tmp, 'gate');
    // The stand-in render waits at the gate, so the first request is still running when the second arrives.
    const held = await startServer(root.root, { EXPORT_RENDERER: STUB, STUB_GATE: gate });
    try {
      const a = (await (await held.post('/api/export?job=demo', { ratio: '1:1', height: 720, quality: 'preview' })).json()).export;
      await pause(50);
      const b = (await (await held.post('/api/export?job=demo', { ratio: '16:9', height: 720, quality: 'preview' })).json()).export;
      const pidFile = root.path('jobs/demo/review/.export-worker.pid');
      const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
      assert.ok(alive(pid), 'the one worker is alive');
      await pause(300);
      assert.equal(Number(fs.readFileSync(pidFile, 'utf8').trim()), pid, 'still the same worker');
      fs.writeFileSync(gate, '');
      await until(() => status(a.export)?.status === 'done' && status(b.export)?.status === 'done', 15000);
      assert.equal(status(a.export).worker_pid, undefined);
    } finally { fs.writeFileSync(gate, ''); await held.stop(); }
  });

  it('uses render.mjs through process.execPath', async () => {
    const fixture = makeRoot(); const record = path.join(tmp, 'argv.json');
    try {
      fixture.write('tools/film/render.mjs', `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify(process.argv0 === process.execPath ? [process.execPath, ...process.argv.slice(1)] : process.argv));\n`);
      fixture.write('jobs/demo/review/export-001.json', { export: 1, job: 'demo', status: 'requested', ratio: '16:9', height: 720, quality: 'preview' });
      const child = spawn(process.execPath, [WORKER, '--job', 'demo'], { env: { ...process.env, STUDIO_ROOT: fixture.root, EXPORT_RENDERER: '' }, stdio: 'ignore' });
      await new Promise((r) => child.on('exit', r));
      const argv = JSON.parse(fs.readFileSync(record, 'utf8'));
      assert.equal(argv[0], process.execPath);
      assert.ok(argv[1].replaceAll('\\', '/').endsWith('tools/film/render.mjs'), argv[1]);
    } finally { fixture.remove(); }
  });

  it('a failed render ends failed with one sentence', async () => {
    const failing = makeRoot();
    try {
      failing.write('jobs/demo/review/export-001.json', { export: 1, job: 'demo', status: 'requested', ratio: '16:9', height: 720, quality: 'preview' });
      const child = spawn(process.execPath, [WORKER, '--job', 'demo'], { env: { ...process.env, STUDIO_ROOT: failing.root, EXPORT_RENDERER: STUB, STUB_FAIL: '1' }, stdio: 'ignore' });
      await new Promise((r) => child.on('exit', r));
      const d = failing.read('jobs/demo/review/export-001.json');
      assert.equal(d.status, 'failed'); assert.match(d.error, /nothing was exported/); assert.ok(!d.error.includes('\n'));
    } finally { failing.remove(); }
  });

  it("a dead worker's request goes back to requested", async () => {
    const stale = makeRoot(); const was = process.env.STUDIO_ROOT;
    try {
      process.env.STUDIO_ROOT = stale.root;
      const { recoverStale } = await import(`../../tools/film/export-worker.mjs?stale=${Date.now()}`);
      stale.write('jobs/demo/review/export-001.json', { export: 1, job: 'demo', status: 'running', started_at: 'x', worker_pid: 999999, ratio: '16:9', height: 720, quality: 'preview' });
      assert.equal(recoverStale('demo'), 1);
      const d = stale.read('jobs/demo/review/export-001.json');
      assert.equal(d.status, 'requested'); assert.equal(d.worker_pid, undefined);
    } finally { if (was === undefined) delete process.env.STUDIO_ROOT; else process.env.STUDIO_ROOT = was; stale.remove(); }
  });
});
