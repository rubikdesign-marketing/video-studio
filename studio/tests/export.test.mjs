// Exports end to end: a request written by the server is taken by tools/film/export-worker.mjs (which the server
// starts itself), cut from the film already rendered or, when there is none yet, rendered (here by a stand-in for
// render.mjs, EXPORT_RENDERER), cropped to the wanted shape, and reported back through the request file,
// /api/exports and /api/events.   node --test "studio/tests/*.test.mjs"   (needs ffmpeg)
// makeRoot() writes a pretend out/preview.mp4 that is not a real film; these tests start without it (freshRoot), so the
// first export of a quality renders it, as a job's first render does.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
const freshRoot = () => { const r = makeRoot(); fs.rmSync(r.path('jobs/demo/out/preview.mp4')); return r; };
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const logLines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean) : []);
// No full ffmpeg anywhere: DAMEX_FFMPEG points at nothing (tools/lib/ff.mjs then reports it missing, with how to add it).
const NO_FFMPEG = { FFMPEG: '', DAMEX_FFMPEG: path.join(os.tmpdir(), 'no-such-ffmpeg') };

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
    child.out = ''; child.stdout.on('data', (d) => { child.out += d; });
    child.done = new Promise((r) => child.on('exit', (code) => r(code)));
    return child;
  };
  // These tests start the worker by hand, so a request is written straight to the review folder (the server would start a worker of its own).
  let next = 0;
  const request = async (d) => { const n = ++next; root.write(`jobs/demo/review/export-${String(n).padStart(3, '0')}.json`, { export: n, job: 'demo', requested_at: new Date().toISOString(), status: 'requested', ...d }); return { export: n }; };
  const file = (n) => root.path(`jobs/demo/review/export-${String(n).padStart(3, '0')}.json`);
  const status = (n) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return null; } };
  const size = (f) => String(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', f]).stdout).trim();
  before(async () => { root = freshRoot(); server = await startServer(root.root); });
  after(async () => { await server.stop(); root.remove(); fs.rmSync(tmp, { recursive: true, force: true }); });
  const preview = () => root.path('jobs/demo/out/preview.mp4');

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
    assert.equal(done.source, 'out/preview.mp4'); assert.equal(done.source_rendered_at, fs.statSync(preview()).mtime.toISOString());
    assert.equal(size(root.path('jobs/demo/out/' + done.file)), '406x720');
    assert.deepEqual(fs.readdirSync(root.path('jobs/demo/out')).filter((f) => f.startsWith('.')), [], 'no hidden partial files left');
    await until(() => live.events.some((e) => e.type === 'export' && e.status === 'done'));
    assert.deepEqual(live.events.find((e) => e.status === 'done'), { type: 'export', n: 1, status: 'done', file: 'export-001-9x16-720.mp4', source: 'out/preview.mp4', source_rendered_at: done.source_rendered_at });
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

  it('an existing film is cut from as it is: the renderer is not run and the film is not changed', async () => {
    const log = path.join(tmp, 'log-existing');
    const before = sha(preview()); const mtime = fs.statSync(preview()).mtimeMs;
    const r = await request({ ratio: '1:1', height: 720, quality: 'preview' });
    assert.equal(await worker({ STUB_LOG: log }).done, 0);
    const d = status(r.export);
    assert.equal(d.status, 'done', JSON.stringify(d)); assert.equal(size(root.path('jobs/demo/out/' + d.file)), '720x720');
    assert.deepEqual(logLines(log), [], 'the renderer was not called');
    assert.equal(sha(preview()), before, 'the film is byte for byte the same'); assert.equal(fs.statSync(preview()).mtimeMs, mtime);
    assert.equal(d.source, 'out/preview.mp4'); assert.equal(d.source_rendered_at, fs.statSync(preview()).mtime.toISOString());
  });

  it('an approved master is never rendered over: a full-quality export is cut from out/<job>.mp4 and raw.mp4 is left alone', async () => {
    const log = path.join(tmp, 'log-master'); const master = root.path('jobs/demo/out/demo.mp4'); const raw = root.path('jobs/demo/out/raw.mp4');
    const before = sha(master); const rawBefore = sha(raw);
    const r = await request({ ratio: '9:16', height: 720, quality: 'master' });
    assert.equal(await worker({ STUB_LOG: log }).done, 0);
    const d = status(r.export);
    assert.equal(d.status, 'done'); assert.equal(d.source, 'out/demo.mp4');
    assert.deepEqual(logLines(log), []); assert.equal(sha(master), before); assert.equal(sha(raw), rawBefore);
  });

  it('with no film yet the renderer is run once, then the export is cut from what it made', async () => {
    fs.rmSync(preview()); const log = path.join(tmp, 'log-first');
    const r = await request({ ratio: '16:9', height: 720, quality: 'preview' });
    assert.equal(await worker({ STUB_LOG: log }).done, 0);
    assert.equal(status(r.export).status, 'done');
    assert.deepEqual(logLines(log), ['demo preview'], 'rendered once');
    assert.ok(fs.existsSync(preview()));
  });

  it('with no full ffmpeg the export fails at once with one sentence that says how to fix it', async () => {
    const log = path.join(tmp, 'log-noff');
    const r = await request({ ratio: '9:16', height: 1080, quality: 'preview' });
    assert.equal(await worker({ ...NO_FFMPEG, STUB_LOG: log }).done, 0);
    const d = status(r.export);
    assert.equal(d.status, 'failed');
    assert.equal(d.error, 'Exporting needs a full ffmpeg, which was not found on this computer, so nothing was exported. Add it, then export again.');
    assert.ok(!d.error.includes('\n'));
    assert.match(d.detail, /^To add it: \S/); assert.ok(d.detail.length > 15);
    assert.deepEqual(logLines(log), [], 'nothing was rendered');
  });

  it('text changes saved in the editor and not in the film yet are counted on the request', async () => {
    const film = root.path('engine/src/jobs/demo/film.json');
    root.write('jobs/demo/review/edits.json', { film_modified: fs.statSync(film).mtimeMs, edits: [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['New words.'] }, { op: 'text.time', scene: 'S02', cue: 1, at: 2.6, out: 4.4 }] });
    const a = await request({ ratio: '16:9', height: 720, quality: 'preview' });
    assert.equal(await worker().done, 0);
    assert.equal(status(a.export).status, 'done'); assert.equal(status(a.export).edits_pending, 2);
    root.write('jobs/demo/review/edits.json', { film_modified: 1, edits: [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['Old.'] }] });   // saved for an older film
    const b = await request({ ratio: '16:9', height: 720, quality: 'preview' });
    assert.equal(await worker().done, 0);
    assert.equal(status(b.export).edits_pending, undefined);
    fs.rmSync(root.path('jobs/demo/review/edits.json'));
  });

  it('a render that fails ends as failed with a plain sentence, and the page is told', async () => {
    fs.rmSync(preview());                                                   // so the worker has to render
    const live = listen(server, 'demo'); await pause(200);
    const r = await request({ ratio: '1:1', height: 1080, quality: 'preview' });
    assert.equal(await worker({ STUB_FAIL: '1' }).done, 0);
    const d = status(r.export);
    assert.equal(d.status, 'failed'); assert.equal(d.error, 'The render did not finish, so nothing was exported.'); assert.ok(!d.error.includes('\n') && d.error.endsWith('.')); assert.match(d.detail, /Chrome could not start/);
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
    fs.rmSync(preview());                                                   // so the stand-in render runs (and fails)
    root.write('jobs/demo/review/export-050.json', { export: 50, job: 'demo', status: 'running', started_at: 'x', worker_pid: deadPid(), ratio: '16:9', height: 720, quality: 'preview' });
    root.write('jobs/demo/review/export-051.json', { export: 51, job: 'demo', status: 'running', started_at: 'x', worker_pid: process.pid, ratio: '16:9', height: 720, quality: 'preview' });
    assert.equal(await worker({ STUB_FAIL: '1' }).done, 0);
    assert.equal(status(50).status, 'failed');                              // recovered, then taken (the stand-in render failed)
    assert.equal(status(51).status, 'running');
  });

  it('two workers at once never take the same request', async () => {
    const log = path.join(tmp, 'log');
    const ns = [(await request({ ratio: '1:1', height: 720, quality: 'preview' })).export, (await request({ ratio: '1:1', height: 1080, quality: 'preview' })).export];
    const a = worker(); const b = worker();
    await Promise.all([a.done, b.done]);
    for (const n of ns) assert.equal(status(n).status, 'done', `export ${n}`);
    const made = (a.out + b.out).split('\n').filter((l) => / wrote out\//.test(l));
    for (const n of ns) assert.equal(made.filter((l) => l.startsWith(`demo export ${n}:`)).length, 1, `export ${n} was made once`);
  });
});

describe('the server runs the worker', () => {
  let root; let server;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'export-auto-'));
  const file = (n) => root.path(`jobs/demo/review/export-${String(n).padStart(3, '0')}.json`);
  const status = (n) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return null; } };
  const post = async (d) => (await (await server.post('/api/export?job=demo', d)).json()).export;
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  before(async () => { root = freshRoot(); server = await startServer(root.root, { EXPORT_RENDERER: STUB }); });
  after(async () => { await server.stop(); root.remove(); fs.rmSync(tmp, { recursive: true, force: true }); });

  it('server starts a worker when a request is written', async () => {
    const r = await post({ ratio: '9:16', height: 720, quality: 'preview' });
    const done = await until(() => status(r.export)?.status === 'done' && status(r.export), 10000);
    assert.equal(done.file, 'export-001-9x16-720.mp4');
    assert.ok(fs.existsSync(root.path('jobs/demo/out/export-001-9x16-720.mp4')));
  });

  it('a second request while one runs starts no second worker', async () => {
    const gate = path.join(tmp, 'gate');
    fs.rmSync(root.path('jobs/demo/out/preview.mp4'), { force: true });    // so the first request renders
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

  it('a pid file naming a live process that is not a worker, with an old mtime, does not stop a new worker', async () => {
    const stale = freshRoot();
    const srv = await startServer(stale.root, { EXPORT_RENDERER: STUB });
    try {
      const pidFile = stale.write('jobs/demo/review/.export-worker.pid', String(process.pid));   // alive, but not a worker
      const old = new Date(Date.now() - 10 * 60 * 1000); fs.utimesSync(pidFile, old, old);
      const r = (await (await srv.post('/api/export?job=demo', { ratio: '16:9', height: 720, quality: 'preview' })).json()).export;
      await until(() => { try { return JSON.parse(fs.readFileSync(stale.path('jobs/demo/review/export-001.json'), 'utf8')).status === 'done'; } catch { return false; } }, 10000);
      assert.equal(r.export, 1);
    } finally { await srv.stop(); stale.remove(); }
  });

  it('a request already waiting is picked up when the exports are asked for, with no new request', async () => {
    const waiting = freshRoot();
    waiting.write('jobs/demo/review/export-001.json', { export: 1, job: 'demo', status: 'requested', ratio: '16:9', height: 720, quality: 'preview' });
    waiting.write('jobs/demo/review/export-002.json', { export: 2, job: 'demo', status: 'running', worker_pid: 999999, ratio: '1:1', height: 720, quality: 'preview' });
    const srv = await startServer(waiting.root, { EXPORT_RENDERER: STUB });
    try {
      await pause(300);
      assert.equal(waiting.read('jobs/demo/review/export-001.json').status, 'requested', 'nothing starts on its own');
      await srv.get('/api/exports?job=demo');
      await until(() => ['export-001', 'export-002'].every((n) => { try { return JSON.parse(fs.readFileSync(waiting.path(`jobs/demo/review/${n}.json`), 'utf8')).status === 'done'; } catch { return false; } }), 15000);
    } finally { await srv.stop(); waiting.remove(); }
  });

  it('uses render.mjs through process.execPath', async () => {
    const fixture = freshRoot(); const record = path.join(tmp, 'argv.json');
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
    const failing = freshRoot();
    try {
      failing.write('jobs/demo/review/export-001.json', { export: 1, job: 'demo', status: 'requested', ratio: '16:9', height: 720, quality: 'preview' });
      const child = spawn(process.execPath, [WORKER, '--job', 'demo'], { env: { ...process.env, STUDIO_ROOT: failing.root, EXPORT_RENDERER: STUB, STUB_FAIL: '1' }, stdio: 'ignore' });
      await new Promise((r) => child.on('exit', r));
      const d = failing.read('jobs/demo/review/export-001.json');
      assert.equal(d.status, 'failed'); assert.match(d.error, /nothing was exported/); assert.ok(!d.error.includes('\n'));
    } finally { failing.remove(); }
  });

  it("a dead worker's request goes back to requested", async () => {
    const stale = freshRoot(); const was = process.env.STUDIO_ROOT;
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
