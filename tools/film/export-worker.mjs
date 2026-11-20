#!/usr/bin/env node
// Turns the editor's export requests (jobs/<job>/review/export-NNN.json, status "requested") into files.
//
//   node tools/film/export-worker.mjs [--job <name>] [--watch]
//
// Takes one request at a time and claims it. An export is cut from the film that is already there (out/<job>.mp4 for
// full quality, out/preview.mp4 for a quick preview) and never replaces it: only when that film does not exist yet does
// the worker render it, through tools/film/render.mjs (so the shared render lock is respected). When the request asks
// for another shape or height, the film is cropped and scaled with ffmpeg. Every export needs a full ffmpeg; without one
// the request fails at once with a sentence that says how to add it. The result is out/export-NNN-<ratio>-<height>.mp4,
// written beside its destination, checked, and only then renamed into place.
// The request file is updated as it goes: running (with started_at, worker_pid, and edits_pending: the number of text
// changes saved in the editor that are not in the film yet), then done (file, source: the film it was cut from,
// source_rendered_at, finished_at) or failed (error: a plain sentence; detail: what to do or what the program said).
// A request left "running" by a worker that has died goes back to "requested".
// Without --watch it finishes every request it can find and exits; with --watch it keeps looking every few seconds.
// Environment: STUDIO_ROOT (a studio folder other than this one; the server's tests use it), EXPORT_RENDERER (a script run
// as `<script> <job folder> <preview|master>` in place of render.mjs; the tests use a stand-in).
// Every program is started with the node that is running this worker, and ffmpeg and ffprobe are found by tools/lib/ff.mjs,
// so it works the same on macOS, Linux and Windows.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ffprobeBin, runBin, tryBin } from '../lib/ff.mjs';
import { fixFor } from '../../setup/runtime/resolve.mjs';

const STUDIO = process.env.STUDIO_ROOT ? path.resolve(process.env.STUDIO_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const JOBS = path.join(STUDIO, 'jobs');
const RENDER = path.join(STUDIO, 'tools/film/render.mjs');
const FILMS = path.join(STUDIO, 'engine', 'src', 'jobs');
const REQUEST = /^export-(\d+)\.json$/;
const SIZE = { '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1] };

const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
/** Every write goes to a hidden temp file first and is renamed into place, so nobody ever reads half a file. */
function writeAtomic(file, data) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp-${process.pid}`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1)); fs.renameSync(tmp, file);
}
const alive = (pid) => { if (!Number.isInteger(pid)) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const plain = (e) => String(e?.message || e).split('\n')[0];

/** Takes a request for this worker alone: the rename succeeds for one worker only. Returns the request and a way to give the file back. */
function claim(file) {
  const mine = `${file}.claim-${process.pid}`;
  try { fs.renameSync(file, mine); } catch { return null; }
  const request = readJson(mine);
  const put = (data) => { writeAtomic(file, data); fs.rmSync(mine, { force: true }); };
  return { request, put };
}

/** Requests whose worker died go back to "requested". */
export function recoverStale(job) {
  const dir = path.join(JOBS, job, 'review'); let n = 0;
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!REQUEST.test(f)) continue;
    const peek = readJson(path.join(dir, f));
    if (peek?.status !== 'running' || alive(peek.worker_pid)) continue;
    const c = claim(path.join(dir, f)); if (!c) continue;
    if (c.request?.status === 'running' && !alive(c.request.worker_pid)) {
      const { started_at, worker_pid, ...rest } = c.request; c.put({ ...rest, status: 'requested' }); n++;
    } else c.put(c.request);
  }
  return n;
}

function run(cmd, args, onChild, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, ...opts }); onChild?.(child);
    let tail = '';
    const keep = (d) => { tail = (tail + d).slice(-2000); };
    child.stdout.on('data', keep); child.stderr.on('data', keep);
    child.on('error', (e) => resolve({ code: 1, tail: String(e.message) }));
    child.on('close', (code, signal) => resolve({ code: code ?? 1, signal, tail }));
  });
}
const probe = (file) => {
  let r;
  try { r = runBin(ffprobeBin(), ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,nb_read_packets', '-of', 'csv=p=0:s=x', path.resolve(file)]); } catch { return null; }
  const [w, h, frames] = String(r.stdout || '').trim().split('x').map(Number);
  return r.status === 0 && frames > 0 ? { w, h, frames } : null;
};

let current = null;                                           // the child process of the request being worked on

/** The film an export of this quality is cut from. */
const sourceOf = (jobDir, quality) => path.join(jobDir, 'out', quality === 'master' ? `${path.basename(jobDir)}.mp4` : 'preview.mp4');

/** A full ffmpeg, or an error that says how to add one. Every export needs it (every shape and height is cut with it). */
export function needFfmpeg() {
  const ff = tryBin('ffmpeg');
  if (ff) return ff;
  throw Object.assign(new Error('Exporting needs a full ffmpeg, which was not found on this computer, so nothing was exported. Add it, then export again.'), { detail: `To add it: ${fixFor('ffmpeg')}` });
}

/** How many text changes saved in the editor (review/edits.json) are for this film and not in it yet. Changes saved
 *  for an older version of the film (film.json has been rewritten since) do not count. */
export function editsPending(job) {
  const saved = readJson(path.join(JOBS, job, 'review', 'edits.json'));
  const n = Array.isArray(saved?.edits) ? saved.edits.length : 0;
  if (!n) return 0;
  for (const slug of fs.existsSync(FILMS) ? fs.readdirSync(FILMS) : []) {
    const file = path.join(FILMS, slug, 'film.json');
    if (readJson(file)?.job !== job) continue;
    return typeof saved.film_modified !== 'number' || saved.film_modified === fs.statSync(file).mtimeMs ? n : 0;
  }
  return n;
}

/** Renders the film when it does not exist yet (the job's first render). Never called when the file is there. */
async function render(jobDir, quality, source) {
  const custom = process.env.EXPORT_RENDERER;
  const [cmd, args] = custom ? [custom, [jobDir, quality]] : [process.execPath, [RENDER, jobDir, quality]];
  const r = await run(cmd, args, (c) => { current = c; });
  current = null;
  if (r.code !== 0) throw Object.assign(new Error(`The render did not finish${r.signal ? ' (it was stopped)' : ''}, so nothing was exported.`), { detail: r.tail.trim().split('\n').pop() });
  if (!fs.existsSync(source)) throw new Error(`The render finished but did not make ${path.basename(source)}, so nothing was exported.`);
}

async function produce(job, request) {
  const jobDir = path.join(JOBS, job); const out = path.join(jobDir, 'out');
  const ff = needFfmpeg();
  const source = sourceOf(jobDir, request.quality);
  if (!fs.existsSync(source)) await render(jobDir, request.quality, source);
  const have = probe(source);
  if (!have) throw Object.assign(new Error(`The film ${path.basename(source)} has no readable picture, so nothing was exported.`), { detail: 'Render the film again, then export again.' });
  const cutFrom = { source: `out/${path.basename(source)}`, source_rendered_at: fs.statSync(source).mtime.toISOString() };
  const [rw, rh] = SIZE[request.ratio]; const h = request.height; const w = Math.round((h * rw) / rh / 2) * 2;
  const name = `export-${String(request.export).padStart(3, '0')}-${request.ratio.replace(':', 'x')}-${h}.mp4`;
  const partial = path.join(out, `.${name.replace(/\.mp4$/, '')}.partial-${process.pid}.mp4`);
  try {
    if (have.w === w && have.h === h) fs.copyFileSync(source, partial);
    else {
      const crop = `crop='min(iw,ih*${w}/${h})':'min(ih,iw*${h}/${w})'`;      // the biggest centred piece of the wanted shape
      const r = await run(ff.path, ['-v', 'error', '-y', '-i', source, '-vf', `${crop},scale=${w}:${h}:flags=lanczos,setsar=1`,
        '-c:v', 'libx264', '-crf', request.quality === 'master' ? '16' : '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', partial], (c) => { current = c; }, { cwd: ff.cwd, env: ff.env });
      current = null;
      if (r.code !== 0) throw Object.assign(new Error(`Cropping the film to ${request.ratio} at ${h} high failed, so nothing was exported.`), { detail: r.tail.trim().split('\n').pop() });
    }
    const got = probe(partial);
    if (!got || got.h !== h || got.w !== w) throw new Error(`The ${request.ratio} file did not come out at ${w} by ${h}, so it was not kept.`);
    fs.renameSync(partial, path.join(out, name));
  } finally { fs.rmSync(partial, { force: true }); }
  return { file: name, ...cutFrom };
}

/** Works through one request. Returns false when there was nothing to take. */
async function takeOne(job) {
  const dir = path.join(JOBS, job, 'review');
  const files = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => REQUEST.test(f)).sort();
  for (const f of files) {
    const file = path.join(dir, f);
    if (readJson(file)?.status !== 'requested') continue;
    const c = claim(file); if (!c) continue;
    if (c.request?.status !== 'requested') { c.put(c.request ?? { status: 'failed', error: 'This export request could not be read.' }); continue; }
    const pending = editsPending(job);
    const { edits_pending: _before, ...asked } = c.request;     // counted again now: the editor may have saved more since
    const running = { ...asked, status: 'running', started_at: new Date().toISOString(), worker_pid: process.pid, ...(pending ? { edits_pending: pending } : {}) };
    c.put(running);
    active = { file, running };
    try {
      const made = await produce(job, running);
      const { worker_pid, ...rest } = running;
      writeAtomic(file, { ...rest, status: 'done', ...made, finished_at: new Date().toISOString() });
      console.log(`${job} export ${running.export}: wrote out/${made.file} from ${made.source}`);
    } catch (e) {
      const { worker_pid, ...rest } = running;
      writeAtomic(file, { ...rest, status: 'failed', error: plain(e), ...(e?.detail ? { detail: String(e.detail).trim().slice(0, 300) } : {}), finished_at: new Date().toISOString() });
      console.log(`${job} export ${running.export} failed: ${plain(e)}`);
    }
    active = null;
    return true;
  }
  return false;
}

let active = null;
// A stopped worker hands its request back, so the next worker takes it.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  current?.kill('SIGTERM');
  if (active) { const { started_at, worker_pid, ...rest } = active.running; try { writeAtomic(active.file, { ...rest, status: 'requested' }); } catch { /* leave it: the next worker recovers it */ } }
  process.exit(sig === 'SIGINT' ? 130 : 143);
});

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes('--job') ? args[args.indexOf('--job') + 1] : null;
  const watch = args.includes('--watch');
  const beat = () => { for (const job of jobsToLook()) { const f = path.join(JOBS, job, 'review', '.export-worker.pid'); try { if (fs.readFileSync(f, 'utf8').trim() === String(process.pid)) { const t = new Date(); fs.utimesSync(f, t, t); } } catch { /* none */ } } };
  setInterval(beat, 15000).unref();   // proof of life for the server, also while a render runs
  const jobsToLook = () => only ? [only] : (fs.existsSync(JOBS) ? fs.readdirSync(JOBS) : []);
  const drain = async () => {
    let worked = false;
    for (const job of jobsToLook()) {
      if (!fs.existsSync(path.join(JOBS, job, 'review'))) continue;
      recoverStale(job);
      while (await takeOne(job)) worked = true;
    }
    return worked;
  };
  if (watch) {
    for (;;) if (!(await drain())) await new Promise((r) => setTimeout(r, 3000));
  }
  await drain();
  // The server starts a worker only when no worker pid is alive. Give up the pid first, then look once more, so a request
  // written while this worker was finishing is taken by it or by the next one, never left waiting.
  for (const job of jobsToLook()) {
    const pidFile = path.join(JOBS, job, 'review', '.export-worker.pid');
    try { if (fs.readFileSync(pidFile, 'utf8').trim() === String(process.pid)) fs.rmSync(pidFile, { force: true }); } catch { /* none */ }
  }
  await drain();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
