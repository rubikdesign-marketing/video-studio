#!/usr/bin/env node
// Storyboard frames straight from the engine: the storyboard is made of the film's own frames.
//
//   storyboard.mjs <job_dir> [--only S03,S05] [--out <dir>] [--scale 0.6667] [--parallel 2]
//
// For every shot in the job's shot list it renders one still at the moment that shot is resting (60% of its text
// cue), plus a still at every moment the shot names in shots.json:
//   "keyframes": [{ "at": 1.4, "label": "contact" }]     seconds from the scene's start, or "at": "70%" of the shot
//   "proof": { "what": "the row lands in Notion", "at": 2.1 }   the moment that proves the shot's point
// and writes jobs/<job>/storyboard/frames.json with the notes that belong beside each frame (time, length, voice line,
// on-screen text, point, eye, shot size, move, transition in, hand-off, sound, energy, and the extra moments).
//
// --only re-renders the named scenes and keeps every other frame as it was (for a revision of one or two shots).
// The engine is bundled once and reused until its code changes (tools/film/lib/bundle.mjs), and all frames are drawn in
// one browser, straight to JPEG. Run tools/film/scaffold.mjs first. Rendering cannot start inside the command sandbox,
// so this command has to be allowed to run outside it. It waits its turn if another render is running.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { acquire } from './lib/lock.mjs';
import { ensureBundle, ENGINE } from './lib/bundle.mjs';
import { record } from './lib/runlog.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : dflt; };
const jobArg = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
if (!jobArg) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }
const die = (m) => { console.error(m); process.exit(1); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const jobDir = path.resolve(jobArg);
const job = path.basename(jobDir);
const films = path.join(ENGINE, 'src', 'jobs');
const slug = fs.readdirSync(films).find((s) => fs.existsSync(path.join(films, s, 'film.json')) && readJson(path.join(films, s, 'film.json')).job === job);
if (!slug) die(`No film found for ${job}. Run: node tools/film/scaffold.mjs ${jobArg}`);
const film = readJson(path.join(films, slug, 'film.json'));
const shots = readJson(path.join(jobDir, 'shots.json'));
const outDir = path.resolve(flag('out', path.join(jobDir, 'storyboard')));
const only = flag('only') ? new Set(flag('only').split(',').map((s) => s.trim())) : null;
const scale = Number(flag('scale', 0.6667));
const parallel = Math.max(1, Number(flag('parallel', 2)));
fs.mkdirSync(outDir, { recursive: true });

/** A shot's named moment: seconds from scene start, or "NN%" of the shot's own span. */
function momentAt(at, sceneStart, start, end) {
  if (typeof at === 'string' && at.trim().endsWith('%')) return start + (end - start) * (parseFloat(at) / 100);
  const n = Number(at);
  if (!Number.isFinite(n)) return null;
  return sceneStart + n;
}

// Plan every frame first, then render.
const lastFrame = Math.round(film.duration * film.fps) - 1;
const toFrame = (t) => Math.max(0, Math.min(Math.round(t * film.fps), lastFrame));
const frames = [];
const jobs = [];   // { frame, file }
let number = 0;
for (const scene of film.scenes) {
  const plan = (shots.scenes || []).find((s) => s.id === scene.id) || {};
  const cues = scene.texts?.length ? scene.texts : [{ lines: [], at: 0, out: scene.end - scene.start }];
  cues.forEach((cue, i) => {
    number += 1;
    const shot = (plan.shots || [])[i] || {};
    const start = scene.start + cue.at;
    const end = Math.min(scene.end, scene.start + (cue.out ?? scene.end - scene.start));
    const at = start + (end - start) * 0.6;                       // well after it has landed, before it leaves
    const name = `shot-${String(number).padStart(2, '0')}`;
    const moments = [...(shot.keyframes || [])];
    if (shot.proof?.at !== undefined) moments.push({ at: shot.proof.at, label: 'proof' });
    const extra = moments.map((m, k) => {
      const t = momentAt(m.at, scene.start, start, end);
      if (t === null) return null;
      const label = String(m.label || `moment-${k + 1}`).replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
      return { label, at: +t.toFixed(2), frame: toFrame(t), file: `${name}-${label}.jpg` };
    }).filter(Boolean);
    const said = (scene.lines || []).filter((l) => l.start < end && l.end > start).map((l) => l.text.replace(/\[[^\]]*\]/g, '').trim());
    const entry = {
      shot: number, scene: scene.id, scene_title: scene.title, file: `${path.relative(jobDir, outDir) || '.'}/${name}.jpg`,
      start: +start.toFixed(2), length: +(end - start).toFixed(2), shown_at: +at.toFixed(2),
      voice: said, on_screen_text: (cue.lines || []).join(' / ').replace(/\*/g, ''),
      point: shot.point || shot.purpose || null, eye: shot.eye || null, proof: shot.proof?.what || null,
      shot_size: shot.size || null, focal_point: shot.focal_point || null, move: shot.move || null, sound: shot.sound || null,
      transition_in: i === 0 && plan.transition_in ? `${plan.transition_in.number} (${plan.transition_in.name})` : null,
      hand_off: i === 0 ? plan.hand_off || null : null, energy: scene.energy ?? null, capture: shot.capture || null,
      moments: extra.map(({ label, at: t, file }) => ({ label, at: t, file: `${path.relative(jobDir, outDir) || '.'}/${file}` })),
    };
    frames.push(entry);
    if (!only || only.has(scene.id)) {
      jobs.push({ frame: toFrame(at), file: path.join(outDir, `${name}.jpg`), label: `shot ${number}: ${scene.id} at ${at.toFixed(2)} s` });
      for (const x of extra) jobs.push({ frame: x.frame, file: path.join(outDir, x.file), label: `shot ${number}: ${scene.id} ${x.label} at ${x.at} s` });
    }
  });
}
if (only) {
  const unknown = [...only].filter((id) => !film.scenes.some((s) => s.id === id));
  if (unknown.length) die(`The film has no scene ${unknown.join(', ')}. Its scenes are ${film.scenes.map((s) => s.id).join(', ')}.`);
  // The kept frames are numbered by their place in the film: if shots were added or removed anywhere, the old files
  // would sit beside the wrong notes. Then only a whole board is safe.
  const prev = path.join(outDir, 'frames.json');
  const was = fs.existsSync(prev) ? (readJson(prev).frames || []).map((f) => f.scene).join(',') : null;
  if (was !== frames.map((f) => f.scene).join(',')) die(`Shots were added or removed since the last board${was === null ? ' (or there is none yet)' : ''}, so the other frames would no longer match their notes. Render the whole board: node tools/film/storyboard.mjs ${jobArg}`);
}

const release = acquire(path.join(ENGINE, 'out', '.render.lock'), { tool: 'storyboard.mjs', job });
// Remotion finds its browser from the working folder; from anywhere else it downloads a second copy (459 MB).
process.chdir(ENGINE);
const t0 = Date.now();
const require = createRequire(path.join(ENGINE, 'package.json'));
const { openBrowser, selectComposition, renderStill } = await import(require.resolve('@remotion/renderer'));
const chromiumOptions = { gl: 'angle' };   // as engine/remotion.config.ts: WebGL backgrounds need it
let bundled = 0;
const serveUrl = await ensureBundle({ log: (m) => { bundled = 1; console.log(m); } });
const tBundle = Date.now();
const browser = await openBrowser('chrome', { chromiumOptions });
let ok = false;
try {
  const composition = await selectComposition({ serveUrl, id: slug, puppeteerInstance: browser, chromiumOptions });
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      const tmp = `${j.file}.partial.jpg`;
      await renderStill({ serveUrl, composition, frame: j.frame, output: tmp, imageFormat: 'jpeg', jpegQuality: 85, scale, puppeteerInstance: browser, chromiumOptions, overwrite: true, logLevel: 'error' });
      fs.renameSync(tmp, j.file);
      console.log(j.label);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, jobs.length) }, worker));
  ok = true;
} finally {
  await browser.close({ silent: true }).catch(() => {});
  release();
  const seconds = (Date.now() - t0) / 1000;
  // A storyboard drawn outside the job (a benchmark or a test) is not the job's cost.
  if (outDir.startsWith(jobDir + path.sep)) record(jobDir, { tool: 'storyboard', frames: jobs.length, only: only ? [...only].join(',') : undefined, bundled: !!bundled, bundle_seconds: +((tBundle - t0) / 1000).toFixed(1), seconds: +seconds.toFixed(1), parallel, ok });
  if (ok) console.log(`${jobs.length} frames in ${seconds.toFixed(1)} s (${bundled ? `bundling took ${((tBundle - t0) / 1000).toFixed(1)} s` : 'bundle reused'}).`);
}

// frames.json: with --only, the other scenes' entries are kept from the last run (they were not re-rendered).
const out = path.join(outDir, 'frames.json');
let list = frames;
if (only && fs.existsSync(out)) {
  const before = readJson(out).frames || [];
  list = frames.map((f) => (only.has(f.scene) ? f : before.find((b) => b.shot === f.shot && b.scene === f.scene) || f));
}
fs.writeFileSync(out, JSON.stringify({ job, brand: film.brand ?? null, duration: film.duration, frames: list }, null, 1));
console.log(`${list.length} shots and frames.json written to ${path.relative(STUDIO, outDir)}`);
