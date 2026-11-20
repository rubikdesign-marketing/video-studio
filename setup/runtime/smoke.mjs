// Core native smoke test. One recipe for the local run and for CI (.github/workflows/platform-smoke.yml).
//   node setup/runtime/smoke.mjs --root <studio folder>
// Steps: install, doctor, unit tests, sample twice, studio server + one saved note + a sent revision, doctor with a
// missing FFmpeg. Writes <root>/.damex/smoke.json (redacted). A step that cannot run is "skip" with the reason, never "pass".
// Programs are started with argument arrays, never a shell.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain, currentOs, npmInvocation, redact } from './resolve.mjs';
import { runLogged } from './run.mjs';

// ---------------------------------------------------------------- pure helpers (unit tested)

export function parseArgs(argv) {
  const out = { root: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = argv[++i] ?? null;
    else if (argv[i].startsWith('--root=')) out.root = argv[i].slice(7);
  }
  return out;
}

/** The core checks of a doctor report that did not pass. */
export const coreFailures = (report) => (report?.checks ?? []).filter((c) => c.tier === 'core' && c.status !== 'pass');

/** Judges the doctor run that had DAMEX_FFMPEG pointing at a missing file. Returns { ok, detail }. */
export function judgeMissingFfmpeg(report) {
  const failures = coreFailures(report);
  if (failures.length) return { ok: false, detail: `core failed: ${failures.map((c) => c.id).join(', ')}` };
  const state = report?.capabilities?.['mastering-checks'];
  if (state !== 'missing') return { ok: false, detail: `mastering-checks is "${state}", expected "missing"` };
  const c = (report.checks ?? []).find((x) => x.id === 'mastering-checks');
  if (!c || !String(c.fix ?? '').trim()) return { ok: false, detail: 'mastering-checks has no fix text' };
  return { ok: true, detail: `core passes; mastering-checks missing, fix: ${c.fix}` };
}

/** Judges what the editor's review routes gave back for one saved note and one sent revision. */
export function judgeNote({ draft, review, text }) {
  const saved = draft?.draft?.notes?.some((n) => n.text === text);
  if (!saved) return { ok: false, detail: 'the saved note was not in the draft read back' };
  const batch = review?.batches?.find((b) => b.notes?.some((n) => n.text === text));
  if (!batch) return { ok: false, detail: 'the sent revision was not in the batches read back' };
  return { ok: true, detail: `note kept in the draft, then recorded as revision batch ${batch.batch}` };
}

export const stepEntry = (id, status, ms, detail = '', extra = {}) => ({ id, status, ms: Math.round(ms), detail, ...extra });

/** pass | fail | incomplete. Skipped steps never count as pass; any fail wins. */
export function overall(steps) {
  if (steps.some((s) => s.status === 'fail')) return 'fail';
  if (steps.some((s) => s.status === 'skip')) return 'incomplete';
  return 'pass';
}

/** Stops a child and everything it started. taskkill /T on Windows (a plain kill leaves grandchildren), SIGTERM then SIGKILL elsewhere. */
export function killCommand(pid, platform = process.platform) {
  return platform === 'win32' ? { cmd: 'taskkill', args: ['/pid', String(pid), '/T', '/F'] } : null;
}
export function stopChild(child, { platform = process.platform, graceMs = 3000 } = {}) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode) return resolve();
    const done = () => { clearTimeout(timer); resolve(); };
    child.once('exit', done);
    const kill = killCommand(child.pid, platform);
    if (kill) spawn(kill.cmd, kill.args, { stdio: 'ignore', windowsHide: true }).on('error', () => child.kill());
    else child.kill('SIGTERM');
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } setTimeout(resolve, 500); }, graceMs);
  });
}

export const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.unref(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// ---------------------------------------------------------------- the run

const readJson = (p, fallback = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };

async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return true; } catch { /* not yet */ }
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function runSmoke(root) {
  const node = process.execPath;
  const rt = (name) => path.join(root, 'setup', 'runtime', name);
  const damex = path.join(root, '.damex');
  fs.mkdirSync(damex, { recursive: true });
  process.env.DAMEX_LOG_DIR = path.join(damex, 'logs');
  const steps = [];
  const started = new Date().toISOString();
  let cancelled = false;
  let server = null;
  const onSignal = () => { cancelled = true; if (server) stopChild(server); };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);

  const record = (entry) => { steps.push(entry); console.log(`[smoke] ${entry.status.toUpperCase().padEnd(4)} ${entry.id} (${(entry.ms / 1000).toFixed(1)}s) ${entry.detail}`); return entry; };
  const skip = (id, why) => record(stepEntry(id, 'skip', 0, why));
  const timed = async (id, fn) => {
    const t = Date.now();
    try { const r = await fn(); return record(stepEntry(id, r.ok ? 'pass' : 'fail', Date.now() - t, r.detail ?? '', r.log ? { log: path.relative(root, r.log) } : {})); }
    catch (e) { return record(stepEntry(id, 'fail', Date.now() - t, String(e.message ?? e))); }
  };
  const exec = async (cmd, args, logName, env) => {
    const r = await runLogged(cmd, args, { cwd: root, env: env ?? process.env, logName, quiet: true });
    return { ok: r.code === 0, detail: r.code === 0 ? '' : `exit ${r.code ?? r.signal}`, log: r.logFile, code: r.code };
  };

  const finish = async () => {
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    const result = { schema: 1, ...currentOs(), node: process.versions.node, started, finished: new Date().toISOString(), overall: overall(steps), steps };
    fs.writeFileSync(path.join(damex, 'smoke.json'), redact(JSON.stringify(result, null, 2) + '\n', { root }));
    console.log(`[smoke] ${result.overall.toUpperCase()}  wrote ${path.join('.damex', 'smoke.json')}`);
    return result;
  };

  // 1. install
  const inst = await timed('install', () => exec(node, [rt('install.mjs')], 'smoke-install'));
  if (inst.status !== 'pass') {
    for (const id of ['doctor', 'unit-tests', 'sample-1', 'sample-2', 'studio-start', 'note-save', 'note-readback', 'revision-send', 'studio-stop', 'doctor-no-ffmpeg']) skip(id, 'install failed');
    return finish();
  }

  // 2. doctor: every core check must pass
  await timed('doctor', async () => {
    const r = await exec(node, [rt('doctor.mjs'), '--json'], 'smoke-doctor');
    const report = readJson(path.join(damex, 'doctor.json'));
    if (!report) return { ok: false, detail: 'doctor.json was not written', log: r.log };
    const bad = coreFailures(report);
    return { ok: r.ok && !bad.length, detail: bad.length ? `core failed: ${bad.map((c) => c.id).join(', ')}` : `core ok; capabilities ${JSON.stringify(report.capabilities)}`, log: r.log };
  });

  // 3. unit tests (files listed here: no glob, no shell)
  await timed('unit-tests', () => {
    const files = fs.readdirSync(path.join(root, 'setup', 'runtime')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => path.join('setup', 'runtime', f));
    return files.length ? exec(node, ['--test', ...files], 'smoke-tests') : { ok: false, detail: 'no test files found' };
  });

  // 4. the sample film, twice (the second run proves a rerun over existing output)
  for (const id of ['sample-1', 'sample-2']) {
    if (cancelled) { skip(id, 'cancelled'); continue; }
    const e = await timed(id, async () => {
      const r = await exec(node, [rt('sample.mjs')], `smoke-${id}`);
      const mp4 = path.join(root, 'jobs', '_sample', 'out', 'sample-preview.mp4');
      const size = fs.existsSync(mp4) ? fs.statSync(mp4).size : 0;
      return { ok: r.ok && size > 10000, detail: r.ok ? `sample-preview.mp4 ${(size / 1048576).toFixed(2)} MB` : r.detail, log: r.log };
    });
    void e;
  }

  // 5. the studio server: save one note, read it back, send it as a revision, read that back, stop
  //    Routes: POST /api/draft (studio/server.mjs:354) keeps the note; POST /api/send (:359) writes review/batch-NNN.json; GET /api/review (:351) reads both.
  //    It runs on a scratch studio folder (STUDIO_ROOT) so the checkout's jobs are not touched.
  const scratch = path.join(damex, 'smoke-studio');
  const job = '_sample';
  fs.rmSync(scratch, { recursive: true, force: true });
  fs.mkdirSync(path.join(scratch, 'jobs', job), { recursive: true });
  fs.copyFileSync(path.join(root, 'jobs', job, 'job.json'), path.join(scratch, 'jobs', job, 'job.json'));
  fs.mkdirSync(path.join(scratch, 'engine', 'src', 'jobs', 'sample'), { recursive: true });
  fs.copyFileSync(path.join(root, 'engine', 'src', 'jobs', 'sample', 'film.json'), path.join(scratch, 'engine', 'src', 'jobs', 'sample', 'film.json'));
  const text = 'smoke note: tighten this line';
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const api = (p, data) => fetch(`${base}${p}?job=${job}`, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

  let up = false;
  await timed('studio-start', async () => {
    const log = fs.createWriteStream(path.join(damex, 'logs', 'smoke-studio.log'));
    server = spawn(node, [path.join(root, 'studio', 'server.mjs'), String(port)], { cwd: root, env: { ...process.env, STUDIO_ROOT: scratch }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
    let exited = null; server.once('exit', (c) => { exited = c; });
    up = await waitFor(async () => exited === null && (await fetch(`${base}/api/jobs`)).ok, 15000);
    return { ok: up, detail: up ? `listening on ${base}` : `the server did not answer (exit ${exited})`, log: path.join(damex, 'logs', 'smoke-studio.log') };
  });

  if (!up) {
    for (const id of ['note-save', 'note-readback', 'revision-send']) skip(id, 'the studio server did not start');
  } else {
    let draftBack = null;
    const saved = await timed('note-save', async () => {
      const r = await api('/api/draft', { notes: [{ time: 1, kind: 'change', text }], good_scenes: [] });
      return { ok: r.ok, detail: `POST /api/draft -> ${r.status}` };
    });
    await timed('note-readback', async () => {
      if (saved.status !== 'pass') return { ok: false, detail: 'the note was not saved' };
      draftBack = await (await api('/api/review')).json();
      const ok = draftBack?.draft?.notes?.some((n) => n.text === text);
      return { ok, detail: ok ? 'GET /api/review returned the saved note' : 'the saved note was not in the draft read back' };
    });
    await timed('revision-send', async () => {
      const s = await api('/api/send', { video: 'sample-preview.mp4', reviewer: 'smoke', notes: [{ time: 1, kind: 'change', text }], good_scenes: [] });
      if (!s.ok) return { ok: false, detail: `POST /api/send -> ${s.status}` };
      const review = await (await api('/api/review')).json();
      const j = judgeNote({ draft: draftBack, review, text });
      return { ok: j.ok, detail: j.detail };
    });
  }
  await timed('studio-stop', async () => {
    if (!server) return { ok: false, detail: 'there was no server to stop' };
    await stopChild(server);
    const gone = !(await fetch(`${base}/api/jobs`).then((r) => r.ok, () => false));
    return { ok: gone, detail: gone ? 'server stopped, port closed' : 'the server still answers after stop' };
  });
  server = null;

  // 6. DAMEX_FFMPEG pointing at a missing file: core must still pass, mastering must show missing with a fix
  await timed('doctor-no-ffmpeg', async () => {
    const keep = fs.readFileSync(path.join(damex, 'doctor.json'), 'utf8');
    const env = { ...process.env, DAMEX_FFMPEG: path.join(root, 'no-such-dir', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg') };
    const r = await exec(node, [rt('doctor.mjs'), '--json'], 'smoke-doctor-no-ffmpeg', env);
    const report = readJson(path.join(damex, 'doctor.json'));
    fs.writeFileSync(path.join(damex, 'doctor-no-ffmpeg.json'), fs.readFileSync(path.join(damex, 'doctor.json'), 'utf8'));
    fs.writeFileSync(path.join(damex, 'doctor.json'), keep); // the artifact doctor.json stays the normal run
    const j = judgeMissingFfmpeg(report);
    return { ok: r.ok && j.ok, detail: j.detail, log: r.log };
  });

  return finish();
}

async function main() {
  const { root } = parseArgs(process.argv.slice(2));
  if (!root) { console.error('usage: node setup/runtime/smoke.mjs --root <studio folder>'); process.exit(2); }
  const abs = path.resolve(root);
  if (!fs.existsSync(path.join(abs, 'setup', 'runtime', 'install.mjs'))) { console.error(`${abs} is not a studio folder (no setup/runtime/install.mjs).`); process.exit(2); }
  const result = await runSmoke(abs);
  process.exit(result.overall === 'pass' ? 0 : result.overall === 'fail' ? 1 : 3); // 3: nothing failed but a step could not run
}

if (isMain(import.meta.url)) await main();
