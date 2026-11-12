#!/usr/bin/env node
// The studio's local review server. No packages; Node 22+.
//   node studio/server.mjs [port=4317]
// It serves the review page, the rendered films from jobs/<job>/out, and saves notes into the job folder.
// It listens on this computer only (127.0.0.1) and never sends anything anywhere.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JOBS = path.join(STUDIO, 'jobs');
const FILMS = path.join(STUDIO, 'engine', 'src', 'jobs');
const PAGE = path.join(STUDIO, 'studio', 'review.html');
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

function serveVideo(req, res, file) {         // with byte ranges, so the player can jump around
  const stat = fs.statSync(file); const range = req.headers.range;
  if (!range) { res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(file).pipe(res); }
  const m = /bytes=(\d*)-(\d*)/.exec(range); let start = m[1] ? Number(m[1]) : 0; let end = m[2] ? Number(m[2]) : stat.size - 1;
  if (start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
  end = Math.min(end, stat.size - 1);
  res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
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
    return { id: `b${tag}-n${i + 1}`, time: Number(x.time.toFixed(2)), scene: scene?.id || null, scene_title: scene?.title || null,
      kind: x.kind === 'keep' ? 'keep' : 'change', topic: x.topic || null, must: !!x.must,
      text: x.text.trim(), box: x.box || null, frame, resolved: false, reply: null };
  });
  const good = (payload.good_scenes || []).filter((id) => (film?.scenes || []).some((s) => s.id === id));
  if (!notes.length && !good.length && !payload.approved) return null;
  const batch = { batch: n, job, video: payload.video || null, reviewer: String(payload.reviewer || '').slice(0, 60) || null,
    sent_at: new Date().toISOString(), status: 'sent', approved: !!payload.approved, good_scenes: good, notes };
  writeJson(path.join(dir, `batch-${tag}.json`), batch);
  const log = path.join(STUDIO, 'knowledge', 'feedback-log', `${job}.jsonl`); fs.mkdirSync(path.dirname(log), { recursive: true });
  for (const note of notes) fs.appendFileSync(log, JSON.stringify({ date: batch.sent_at, job, video: batch.video, batch: n, reviewer: batch.reviewer, time: note.time, scene: note.scene, kind: note.kind, topic: note.topic, must: note.must, text: note.text }) + '\n');
  if (batch.approved) fs.appendFileSync(log, JSON.stringify({ date: batch.sent_at, job, video: batch.video, batch: n, reviewer: batch.reviewer, approved: true }) + '\n');
  writeJson(path.join(dir, 'draft.json'), { notes: [], good_scenes: [] });
  return batch;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost'); const p = url.pathname;
    if (p === '/' || p === '/index.html') return send(res, 200, fs.readFileSync(PAGE), 'text/html; charset=utf-8');
    if (p === '/api/jobs') return send(res, 200, { jobs: listJobs() });
    if (p.startsWith('/font/')) {
      const f = path.join(STUDIO, 'studio', 'fonts', path.basename(p)); // the review page's own UI font, not any brand's
      return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), 'font/woff2') : send(res, 404, { error: 'no font' });
    }
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
