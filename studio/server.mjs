#!/usr/bin/env node
// The studio's local review server. No packages; Node 22+.
//   node studio/server.mjs [port=4317]
// It serves the review page, the rendered films from jobs/<job>/out, and saves notes into the job folder.
// /paper is the transcript page for an edit of raw footage (FOOTAGE-PLAN.md section 4.1): it reads and writes
// jobs/<job>/edit/paper.json and plays each clip's working copy.
// /editor is the editor (studio/app, built once with `npm run build`). It reads the film with its on-screen text, keeps
// direct text changes beside the film in jobs/<job>/review/edits.json (the film itself is never written here),
// takes export requests as review/export-NNN.json, and tells the page live when something changed (/api/events).
// It listens on this computer only (127.0.0.1) and never sends anything anywhere.
import http from 'node:http';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planCut } from '../tools/footage/lib/cut.mjs';
import { guard, joinKey, key, runsOf, sentences } from '../tools/footage/lib/paper.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Where the jobs, the films' timing files and the feedback log live. It is this studio folder unless STUDIO_ROOT
// names another one, which the server's own tests use (studio/tests/) so they never touch real jobs.
const ROOT = process.env.STUDIO_ROOT ? path.resolve(process.env.STUDIO_ROOT) : STUDIO;
const JOBS = path.join(ROOT, 'jobs');
const FILMS = path.join(ROOT, 'engine', 'src', 'jobs');
const PAGE = path.join(STUDIO, 'studio', 'review.html');
const PAPER_PAGE = path.join(STUDIO, 'studio', 'paper.html');
const PORT = Number(process.argv[2] || process.env.PORT || 4317);

const readJson = (p, fallback = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };
const writeJson = (p, d) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(d, null, 1)); };
const safeName = (s) => /^[A-Za-z0-9._-]+$/.test(s) && !s.includes('..');
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

function filmFor(job) {                      // the timing file the scaffold wrote for this job
  if (!fs.existsSync(FILMS)) return null;
  for (const slug of fs.readdirSync(FILMS)) {
    const film = readJson(path.join(FILMS, slug, 'film.json'));
    if (film && film.job === job) return film;
  }
  return null;
}
function videosFor(job) {
  const out = path.join(JOBS, job, 'out');
  if (!fs.existsSync(out)) return [];
  return fs.readdirSync(out).filter((f) => f.endsWith('.mp4') && f !== 'raw.mp4')
    .map((f) => ({ file: f, modified: fs.statSync(path.join(out, f)).mtimeMs }))
    .sort((a, b) => b.modified - a.modified);
}
function batchesFor(job) {
  const dir = path.join(JOBS, job, 'review');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^batch-\d+\.json$/.test(f)).sort().map((f) => readJson(path.join(dir, f))).filter(Boolean);
}
function listJobs() {
  if (!fs.existsSync(JOBS)) return [];
  return fs.readdirSync(JOBS).filter((j) => safeName(j) && fs.existsSync(path.join(JOBS, j, 'job.json'))).map((j) => {
    const film = filmFor(j); const job = readJson(path.join(JOBS, j, 'job.json'), {});
    return { job: j, name: job.name || j, type: job.type || '', stage_next: job.stage_next || '', videos: videosFor(j),
      duration: film?.duration ?? null, scenes: (film?.scenes || []).map((s) => ({ id: s.id, title: s.title, start: s.start, end: s.end, energy: s.energy,
        lines: (s.lines || []).map((l) => ({ start: l.start, end: l.end, text: String(l.text || '').replace(/\[[^\]]*\]/g, '').replace(/\bToolvo/g, 'Tulvo').trim() })) })) };
  }).filter((j) => j.videos.length);
}

function serveVideo(req, res, file, type = 'video/mp4') {         // with byte ranges, so the player can jump around
  const stat = fs.statSync(file); const range = req.headers.range;
  if (!range) { res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(file).pipe(res); }
  const m = /bytes=(\d*)-(\d*)/.exec(range); let start = m[1] ? Number(m[1]) : 0; let end = m[2] ? Number(m[2]) : stat.size - 1;
  if (start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
  end = Math.min(end, stat.size - 1);
  res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
  fs.createReadStream(file, { start, end }).pipe(res);
}
function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 40e6) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
  });
}

// Send: the notes become a numbered batch in the job folder, each with the frame it points at,
// and every note is added to the studio's feedback log. A waiting Claude session picks the batch up.
function sendBatch(job, payload) {
  const dir = path.join(JOBS, job, 'review'); fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });
  const n = batchesFor(job).length + 1; const tag = String(n).padStart(3, '0');
  const film = filmFor(job);
  const notes = (payload.notes || []).filter((x) => x.text && x.text.trim()).map((x, i) => {
    const scene = (film?.scenes || []).find((s) => x.time >= s.start && x.time < s.end) || null;
    let frame = null;
    if (typeof x.frame === 'string' && x.frame.startsWith('data:image/jpeg;base64,')) {
      frame = `review/frames/b${tag}-n${i + 1}.jpg`;
      fs.writeFileSync(path.join(JOBS, job, frame), Buffer.from(x.frame.split(',')[1], 'base64'));
    }
    // A note can cover a stretch: `end` is kept only when it is a real time after `time` (EDITOR-V2-PLAN.md, phase B3).
    const end = typeof x.end === 'number' && Number.isFinite(x.end) && x.end > x.time ? { end: Number(x.end.toFixed(2)) } : {};
    return { id: `b${tag}-n${i + 1}`, time: Number(x.time.toFixed(2)), ...end, scene: scene?.id || null, scene_title: scene?.title || null,
      kind: x.kind === 'keep' ? 'keep' : 'change', topic: x.topic || null, must: !!x.must,
      text: x.text.trim(), box: x.box || null, frame, resolved: false, reply: null };
  });
  const good = (payload.good_scenes || []).filter((id) => (film?.scenes || []).some((s) => s.id === id));
  if (!notes.length && !good.length && !payload.approved) return null;
  const batch = { batch: n, job, video: payload.video || null, reviewer: String(payload.reviewer || '').slice(0, 60) || null,
    sent_at: new Date().toISOString(), status: 'sent', approved: !!payload.approved, good_scenes: good, notes };
  writeJson(path.join(dir, `batch-${tag}.json`), batch);
  const log = path.join(ROOT, 'knowledge', 'feedback-log', `${job}.jsonl`); fs.mkdirSync(path.dirname(log), { recursive: true });
  for (const note of notes) fs.appendFileSync(log, JSON.stringify({ date: batch.sent_at, job, video: batch.video, batch: n, reviewer: batch.reviewer, time: note.time, ...(note.end ? { end: note.end } : {}), scene: note.scene, kind: note.kind, topic: note.topic, must: note.must, text: note.text }) + '\n');
  if (batch.approved) fs.appendFileSync(log, JSON.stringify({ date: batch.sent_at, job, video: batch.video, batch: n, reviewer: batch.reviewer, approved: true }) + '\n');
  writeJson(path.join(dir, 'draft.json'), { notes: [], good_scenes: [] });
  return batch;
}

// ---------------------------------------------------------------- the transcript page (paper edit)
const editDir = (job) => path.join(JOBS, job, 'edit');
function paperJobs() {
  if (!fs.existsSync(JOBS)) return [];
  return fs.readdirSync(JOBS).filter((j) => safeName(j) && fs.existsSync(path.join(editDir(j), 'paper.json')))
    .map((j) => { const p = readJson(path.join(editDir(j), 'paper.json'), {}); return { job: j, name: readJson(path.join(JOBS, j, 'job.json'), {}).name || j, status: p.status || 'draft' }; });
}
const wordsOf = (job) => { const cache = {}; return (clip) => (cache[clip] ??= readJson(path.join(editDir(job), 'clips', clip, 'words.json'), { words: [] }).words); };
/** The edit's runs, length and joins as the cut list will see them (before cut points are placed). */
function paperCheck(job, paper) {
  const w = wordsOf(job);
  const runs = runsOf(paper, w);
  const approved = new Set(paper.approved_joins || []);
  const joins = runs.slice(1).map((r, k) => {
    const g = guard(runs[k], r, w);
    const jk = joinKey(key(runs[k].clip, runs[k].words.at(-1)), key(r.clip, r.words[0]));
    return { key: jk, after: key(runs[k].clip, runs[k].words.at(-1)), kind: g.kind, flagged: g.flagged, reasons: g.reasons, approved: !g.flagged || approved.has(jk) };
  });
  let seconds = runs.reduce((t, r) => t + (r.end - r.start), 0) + Math.max(0, runs.length - 1) * 0.4 + 0.65;
  // The exact cut points, placed on the sound as the cut list will place them, so "Play the edit" plays what the
  // rough cut will hold. Without them (no runs, or the footage tool's Python missing) the page plays word times.
  let play = runs.map((r) => ({ clip: r.clip, start: r.start - 0.08, end: r.end + 0.1 }));
  try {
    if (runs.length) {
      const cut = planCut(path.join(JOBS, job), paper);
      play = cut.pieces.filter((x) => x.kind === 'speech').map((x) => ({ clip: x.clip, start: x.in, end: x.out }));
      seconds = cut.duration;
    }
  } catch { /* keep the estimate */ }
  return { runs: play, joins, seconds: Math.round(seconds * 10) / 10 };
}
function paperData(job) {
  const paper = readJson(path.join(editDir(job), 'paper.json'));
  if (!paper) return null;
  const clipsDir = path.join(editDir(job), 'clips');
  const names = [...new Set(paper.blocks.map((b) => b.clip))];
  const clips = names.map((name) => {
    const words = wordsOf(job)(name); const info = readJson(path.join(clipsDir, name, 'clip.json'), {});
    return { name, words, sentences: sentences(words), duration: info.source?.measured?.duration ?? null, video: !!info.source?.measured?.video };
  });
  return { paper, clips, check: paperCheck(job, paper), job: readJson(path.join(JOBS, job, 'job.json'), {}) };
}
/** Saves what a person changed. Only these fields come from the page; the proposals stay as the tool wrote them. */
function paperSave(job, d, send) {
  const file = path.join(editDir(job), 'paper.json');
  const paper = readJson(file);
  const known = new Set(paper.blocks.map((b) => `${b.clip}#${b.sentence}`));
  const words = wordsOf(job);
  if (Array.isArray(d.blocks)) {
    const blocks = d.blocks.filter((b) => b && known.has(`${b.clip}#${b.sentence}`)).map((b) => ({ clip: b.clip, sentence: b.sentence, words: (b.words || []).filter((i) => Number.isInteger(i) && i >= 0 && i < words(b.clip).length) }));
    if (blocks.length === paper.blocks.length) paper.blocks = blocks;
  }
  if (Array.isArray(d.keep_pauses)) paper.keep_pauses = d.keep_pauses.filter((x) => typeof x === 'string').slice(0, 2000);
  if (Array.isArray(d.approved_joins)) paper.approved_joins = d.approved_joins.filter((x) => typeof x === 'string').slice(0, 2000);
  if (typeof d.note === 'string') paper.note = d.note.slice(0, 4000);
  if (typeof d.reviewer === 'string') paper.reviewer = d.reviewer.slice(0, 60);
  if (send) { paper.status = 'sent'; paper.approved = !!d.approved; paper.sent_at = new Date().toISOString(); }
  else if (paper.status !== 'sent') paper.status = 'draft';
  paper.saved_at = new Date().toISOString();
  writeJson(file, paper);
  return { ok: true, check: paperCheck(job, paper), status: paper.status };
}

// ---------------------------------------------------------------- the editor (/editor)
const APP = process.env.STUDIO_APP_DIST ? path.resolve(process.env.STUDIO_APP_DIST) : path.join(STUDIO, 'studio', 'app', 'dist');
const RENDER_LOCK = path.join(ROOT, 'engine', 'out', '.render.lock');     // made by tools/film/render.sh and storyboard.mjs while they render
const EVENTS_MS = Number(process.env.STUDIO_EVENTS_MS) || 1000;           // how often the job folder is looked at for changes
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const NOT_BUILT = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Editor not ready</title>
<style>@font-face{font-family:"Instrument Sans";src:url(/font/InstrumentSans-var.woff2) format("woff2");font-weight:400 700}
body{font-family:"Instrument Sans",system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 24px;line-height:1.5}</style>
<h1>The editor is not ready on this computer yet</h1>
<p>It has to be built once. In the studio folder, run: cd studio/app, then npm install, then npm run build. After that, reload this page.</p>
<p>The review page still works as before: <a href="/">open the review page</a>.</p></html>`;

/** Serves the built app. Any address that is not a file gets the app's page, so a reload deep in the app still works. */
function serveApp(res, p) {
  if (!fs.existsSync(path.join(APP, 'index.html'))) return send(res, 503, NOT_BUILT, 'text/html; charset=utf-8');
  let rel;
  try { rel = decodeURIComponent(p.slice('/editor'.length)).replace(/^\/+/, ''); } catch { return send(res, 404, { error: 'not found' }); }
  let file = path.resolve(APP, rel);
  if (rel.includes('\0') || (file !== APP && !file.startsWith(APP + path.sep))) return send(res, 404, { error: 'not found' });   // never outside the app folder
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(rel)) return send(res, 404, { error: 'not found' });
    file = path.join(APP, 'index.html');
  }
  const real = fs.realpathSync(file); const root = fs.realpathSync(APP);
  if (real !== root && !real.startsWith(root + path.sep)) return send(res, 404, { error: 'not found' });
  return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
}

const cleanLine = (t) => String(t || '').replace(/\[[^\]]*\]/g, '').replace(/\bToolvo/g, 'Tulvo').trim();
/** The film as the editor reads it: scenes with voice lines and on-screen texts, and when film.json last changed. */
function editorFilm(job) {
  if (!fs.existsSync(FILMS)) return null;
  for (const slug of fs.readdirSync(FILMS)) {
    const file = path.join(FILMS, slug, 'film.json'); const f = readJson(file);
    if (!f || f.job !== job) continue;
    const film = { job, slug: f.slug || slug, fps: f.fps, width: f.width, height: f.height, brand: f.brand || '', stage: f.stage === 'light' ? 'light' : 'dark', duration: f.duration,
      scenes: (f.scenes || []).map((s) => ({ id: s.id, title: s.title, start: s.start, end: s.end, energy: s.energy,
        lines: (s.lines || []).map((l, i) => ({ id: String(l.id ?? i + 1), start: l.start, end: l.end, text: cleanLine(l.text) })),
        texts: (s.texts || []).map((t) => ({ lines: (t.lines || []).map(String), at: t.at, out: t.out })) })) };
    return { film, film_modified: fs.statSync(file).mtimeMs };
  }
  return null;
}

const MAX_WORDS = 7;
const wordCount = (lines) => lines.join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const secs = (n) => `${Math.round(n * 100) / 100}s`;
/** Checks one direct change against the film. Returns the change with only its known fields, or a plain sentence naming what is wrong. */
function checkEdit(film, e, i) {
  const name = `Change ${i + 1}`;
  if (!e || typeof e !== 'object' || (e.op !== 'text.words' && e.op !== 'text.time')) return { problem: `${name} is of a kind this studio does not know. Only the words and the timing of on-screen text can be changed here.` };
  const scene = film.scenes.find((s) => s.id === e.scene);
  if (!scene) return { problem: `${name} points at scene "${String(e.scene).slice(0, 40)}", which is not in this film.` };
  if (!Number.isInteger(e.cue) || e.cue < 0 || e.cue >= scene.texts.length) {
    const has = scene.texts.length === 0 ? 'no on-screen text' : scene.texts.length === 1 ? 'only 1 on-screen text' : `only ${scene.texts.length} on-screen texts`;
    return { problem: `${name} points at on-screen text ${Number.isInteger(e.cue) ? e.cue + 1 : String(e.cue).slice(0, 20)} in scene ${scene.id}, which has ${has}.` };
  }
  if (e.op === 'text.words') {
    if (!Array.isArray(e.lines) || !e.lines.length || e.lines.some((l) => typeof l !== 'string')) return { problem: `${name} has no lines of text for scene ${scene.id}.` };
    const lines = e.lines.map((l) => l.trim()); const words = wordCount(lines);
    if (!words) return { problem: `${name} leaves the text in scene ${scene.id} with no words.` };
    if (words > MAX_WORDS) return { problem: `${name} puts ${words} words on screen in scene ${scene.id}. On-screen text can have at most seven words.` };
    if (lines.join('').length > 400) return { problem: `${name} is too long for on-screen text in scene ${scene.id}.` };
    return { edit: { op: 'text.words', scene: scene.id, cue: e.cue, lines } };
  }
  const length = scene.end - scene.start;
  if (!Number.isFinite(e.at) || !Number.isFinite(e.out)) return { problem: `${name} needs a start and an end time, in seconds from the start of scene ${scene.id}.` };
  if (e.at < 0) return { problem: `${name} starts the text before scene ${scene.id} begins.` };
  if (e.out <= e.at) return { problem: `${name} ends the text in scene ${scene.id} before it starts (start ${secs(e.at)}, end ${secs(e.out)}).` };
  if (e.out > length + 1e-6) return { problem: `${name} ends the text at ${secs(e.out)}, but scene ${scene.id} is only ${secs(length)} long.` };
  return { edit: { op: 'text.time', scene: scene.id, cue: e.cue, at: e.at, out: Math.min(e.out, length) } };
}
const editsFile = (job) => path.join(JOBS, job, 'review', 'edits.json');
/** Saves the list of direct changes beside the film. Returns [status, answer]. */
function saveEdits(job, d) {
  const found = editorFilm(job);
  if (!found) return [404, { error: 'This job has no film yet, so there is nothing to change.' }];
  if (!d || typeof d.film_modified !== 'number' || !Array.isArray(d.edits)) return [400, { error: 'The changes did not arrive in a shape this studio can read.' }];
  if (d.film_modified !== found.film_modified) return [409, { error: 'The film has changed since these changes were made, so they were not saved. Reload the film to carry on.', film_modified: found.film_modified }];
  if (d.edits.length > 2000) return [400, { error: 'That is more changes than a film can take.' }];
  const checked = d.edits.map((e, i) => checkEdit(found.film, e, i));
  const problems = checked.filter((c) => c.problem).map((c) => c.problem);
  if (problems.length) return [400, { error: problems[0], problems }];
  const list = { film_modified: found.film_modified, edits: checked.map((c) => c.edit) };
  writeJson(editsFile(job), list);
  return [200, { ok: true, ...list }];
}

const EXPORT = { ratio: ['16:9', '9:16', '1:1'], height: [720, 1080, 2160], quality: ['preview', 'master'] };
/** An export request is a numbered file in the review folder, picked up by Claude like a batch of notes. */
function requestExport(job, d) {
  if (!d || !EXPORT.ratio.includes(d.ratio) || !EXPORT.height.includes(d.height) || !EXPORT.quality.includes(d.quality)) {
    return [400, { error: 'An export needs a shape (16:9, 9:16 or 1:1), a height (720, 1080 or 2160) and a quality (preview or master).' }];
  }
  const dir = path.join(JOBS, job, 'review'); fs.mkdirSync(dir, { recursive: true });
  const taken = fs.readdirSync(dir).map((f) => /^export-(\d+)\.json$/.exec(f)).filter(Boolean).map((m) => Number(m[1]));
  const n = Math.max(0, ...taken) + 1;
  const request = { export: n, job, requested_at: new Date().toISOString(), status: 'requested', ratio: d.ratio, height: d.height, quality: d.quality };
  writeJson(path.join(dir, `export-${String(n).padStart(3, '0')}.json`), request);
  return [200, { ok: true, export: request }];
}

// Live events. While a page is listening, its job folder is looked at once a second (no file watcher: they miss
// folders that do not exist yet). The render tools record no scene-by-scene progress, only the lock folder they
// hold while rendering, so the page is told "rendering" with the time so far, not "scene 4 of 9".
const hubs = new Map();
let lockSeen = null;                          // { started, job }: job is undefined until the process has been asked
function renderState() {
  let stat = null;
  try { stat = fs.statSync(path.join(RENDER_LOCK, 'pid')); } catch { try { stat = fs.statSync(RENDER_LOCK); } catch { /* no render */ } }
  if (!stat) { const was = lockSeen; lockSeen = null; return was ? { active: false, started: was.started, job: was.job ?? null } : null; }
  if (!lockSeen || lockSeen.started !== stat.mtimeMs) {
    const seen = lockSeen = { started: stat.mtimeMs, job: undefined };
    const pid = (() => { try { return fs.readFileSync(path.join(RENDER_LOCK, 'pid'), 'utf8').trim(); } catch { return ''; } })();
    if (/^\d+$/.test(pid)) execFile('ps', ['-o', 'args=', '-p', pid], (err, out) => { seen.job = /(?:^|[\s/])jobs\/([A-Za-z0-9._-]+)/.exec(err ? '' : out)?.[1] ?? null; });   // which job the render is for
    else seen.job = null;
  }
  return { active: true, started: lockSeen.started, job: lockSeen.job ?? null };
}
function lookAt(job) {
  const sig = (f) => { try { const s = fs.statSync(f); return `${s.mtimeMs}:${s.size}`; } catch { return null; } };
  const list = (dir, keep) => { try { return fs.readdirSync(dir).filter(keep); } catch { return []; } };
  const out = path.join(JOBS, job, 'out'); const review = path.join(JOBS, job, 'review');
  return { videos: new Map(list(out, (f) => f.endsWith('.mp4') && f !== 'raw.mp4').map((f) => [f, sig(path.join(out, f))])),
    batches: new Map(list(review, (f) => /^batch-\d+\.json$/.test(f)).map((f) => [f, sig(path.join(review, f))])) };
}
function hubFor(job) {
  if (hubs.has(job)) return hubs.get(job);
  const hub = { clients: new Set(), known: lookAt(job), settling: new Map(), rendering: false, beats: 0 };
  const emit = (event) => { for (const res of hub.clients) res.write(`data: ${JSON.stringify(event)}\n\n`); };
  hub.timer = setInterval(() => {
    const now = lookAt(job);
    for (const [file, s] of now.videos) {                   // a film counts as new once it has stopped growing
      if (!s || hub.known.videos.get(file) === s) { hub.settling.delete(file); continue; }
      if (hub.settling.get(file) !== s) { hub.settling.set(file, s); continue; }
      hub.settling.delete(file); hub.known.videos.set(file, s); emit({ type: 'version', file });
    }
    for (const file of hub.known.videos.keys()) if (!now.videos.has(file)) hub.known.videos.delete(file);
    for (const [file, s] of now.batches) {
      if (!s || hub.known.batches.get(file) === s) continue;
      const batch = readJson(path.join(JOBS, job, 'review', file));
      if (!batch) continue;                                 // still being written: next time
      hub.known.batches.set(file, s); emit({ type: 'batch', n: batch.batch ?? Number(/\d+/.exec(file)[0]), status: batch.status || 'sent' });
    }
    const r = renderState();
    if (r?.active && (r.job === null || r.job === job)) { hub.rendering = true; emit({ type: 'rendering', active: true, elapsed: Math.max(0, Math.round((Date.now() - r.started) / 1000)) }); }
    else if (hub.rendering) { hub.rendering = false; emit({ type: 'rendering', active: false, elapsed: 0 }); }
    if (++hub.beats % 20 === 0) for (const res of hub.clients) res.write(': still here\n\n');
  }, EVENTS_MS);
  hubs.set(job, hub);
  return hub;
}
function serveEvents(req, res, job) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  res.write('retry: 2000\n\n');
  const hub = hubFor(job); hub.clients.add(res);
  req.on('close', () => { hub.clients.delete(res); if (!hub.clients.size) { clearInterval(hub.timer); hubs.delete(job); } });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'); const p = url.pathname;
    if (p === '/' || p === '/index.html') return send(res, 200, fs.readFileSync(PAGE), 'text/html; charset=utf-8');
    if (p === '/api/jobs') return send(res, 200, { jobs: listJobs() });
    if (p === '/paper' || p === '/paper.html') return send(res, 200, fs.readFileSync(PAPER_PAGE), 'text/html; charset=utf-8');
    if (p === '/api/paper/jobs') return send(res, 200, { jobs: paperJobs() });
    if (p.startsWith('/font/')) {
      const f = path.join(STUDIO, 'studio', 'fonts', path.basename(p)); // the review page's own UI font, not any brand's
      return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), 'font/woff2') : send(res, 404, { error: 'no font' });
    }
    if (p === '/editor' || p.startsWith('/editor/')) return serveApp(res, p);
    const job = url.searchParams.get('job') || '';
    if (p.startsWith('/api/') && !(safeName(job) && fs.existsSync(path.join(JOBS, job, 'job.json')))) return send(res, 404, { error: 'unknown job' });
    if (p === '/api/review' && req.method === 'GET') {
      return send(res, 200, { draft: readJson(path.join(JOBS, job, 'review', 'draft.json'), { notes: [], good_scenes: [] }), batches: batchesFor(job) });
    }
    if (p === '/api/draft' && req.method === 'POST') {
      const d = await body(req);
      writeJson(path.join(JOBS, job, 'review', 'draft.json'), { notes: (d.notes || []).map(({ frame, ...keep }) => keep), good_scenes: d.good_scenes || [] });   // frames are sent only with the batch
      return send(res, 200, { ok: true });
    }
    if (p === '/api/send' && req.method === 'POST') {
      const batch = sendBatch(job, await body(req));
      return batch ? send(res, 200, { ok: true, batch }) : send(res, 400, { error: 'nothing to send' });
    }
    if (p === '/api/film' && req.method === 'GET') {
      const found = editorFilm(job);
      return found ? send(res, 200, { film: found.film, videos: videosFor(job), film_modified: found.film_modified }) : send(res, 404, { error: 'This job has no film yet.' });
    }
    if (p === '/api/edits' && req.method === 'GET') {
      return send(res, 200, readJson(editsFile(job)) || { film_modified: editorFilm(job)?.film_modified ?? 0, edits: [] });
    }
    if (p === '/api/edits' && req.method === 'POST') { const [code, answer] = saveEdits(job, await body(req).catch(() => null)); return send(res, code, answer); }
    if (p === '/api/export' && req.method === 'POST') { const [code, answer] = requestExport(job, await body(req).catch(() => null)); return send(res, code, answer); }
    if (p === '/api/events' && req.method === 'GET') return serveEvents(req, res, job);
    if (p === '/api/paper' && req.method === 'GET') {
      const data = paperData(job);
      return data ? send(res, 200, data) : send(res, 404, { error: 'no paper edit for this job yet' });
    }
    if ((p === '/api/paper/save' || p === '/api/paper/send') && req.method === 'POST') {
      if (!fs.existsSync(path.join(editDir(job), 'paper.json'))) return send(res, 404, { error: 'no paper edit for this job yet' });
      return send(res, 200, paperSave(job, await body(req), p.endsWith('/send')));
    }
    if (p.startsWith('/clip-media/')) {                   // a clip's working copy, or its sound when it has no picture
      const [, , j, c] = p.split('/').map(decodeURIComponent);
      if (!safeName(j || '') || !safeName(c || '')) return send(res, 404, { error: 'no such clip' });
      const dir = path.join(editDir(j), 'clips', c);
      const file = fs.existsSync(path.join(dir, 'edit.mp4')) ? path.join(dir, 'edit.mp4') : path.join(dir, 'sound.wav');
      if (!fs.existsSync(file)) return send(res, 404, { error: 'no such clip' });
      return serveVideo(req, res, file, file.endsWith('.wav') ? 'audio/wav' : 'video/mp4');
    }
    if (p.startsWith('/media/')) {
      const [, , j, f] = p.split('/').map(decodeURIComponent);
      const file = path.join(JOBS, j || '', 'out', f || '');
      if (!safeName(j || '') || !safeName(f || '') || !f.endsWith('.mp4') || !fs.existsSync(file)) return send(res, 404, { error: 'no such film' });
      return serveVideo(req, res, file);
    }
    if (p.startsWith('/frames/')) {
      const [, , j, f] = p.split('/').map(decodeURIComponent);
      const file = path.join(JOBS, j || '', 'review', 'frames', f || '');
      if (!safeName(j || '') || !safeName(f || '') || !fs.existsSync(file)) return send(res, 404, { error: 'no such frame' });
      return send(res, 200, fs.readFileSync(file), 'image/jpeg');
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => console.log(`Tulvo review page: http://localhost:${PORT}`));
