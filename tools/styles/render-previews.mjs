#!/usr/bin/env node
// Renders each ready picture style's preview clip (silent, at most 3 s, 480 px on the long side) with the engine,
// and builds the sound sprite. Usage:
//   node tools/styles/render-previews.mjs [--tab <id>] [--only <id>] [--force] [--dry-run] [--sprite] [--root <dir>]
//                                         [--capture <job>/<id>]
// --capture names a demo-brand capture for entries whose moves play on one; any other capture is refused.
// Only node: modules and in-repo imports. The command runner is injected (see main), so tests can stub it.
import { readFileSync, existsSync, mkdirSync, statSync, rmSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { TABS, loadLibrary, engineNames } from './lib/library.mjs';
import { buildSprite, spawnRun } from './lib/sprite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, '..', '..');
const SIZES = { '9:16': [270, 480], '16:9': [480, 270], '1:1': [480, 480], '4:5': [384, 480] };
export const MAX_KB = 200;
export const TARGET_KB = 100;

export const previewSize = (size) => { const [width, height] = SIZES[size] ?? SIZES['9:16']; return { width, height }; };
export const conventionalClip = (id) => `library/styles/previews/${id}.mp4`;

const tryJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const MOTION_DIR = join(STUDIO, 'engine', 'src', 'library', 'motion');
// These four files hold the moves that play on a real capture; their entries are not standalone scenes.
const CAPTURE_FILES = new Set(['capture.tsx', 'product.tsx', 'joins.tsx', 'relayout.tsx']);

/** Names of the moves that have a standalone demo scene in the motion library, read from its own scene lists. */
export function sceneNames(motionDir = MOTION_DIR) {
  const names = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      if (f.isDirectory()) { walk(join(dir, f.name)); continue; }
      if (!/\.tsx?$/.test(f.name) || CAPTURE_FILES.has(f.name)) continue;
      for (const m of readFileSync(join(dir, f.name), 'utf8').matchAll(/name: '([a-z0-9-]+)',\s*title:/g)) names.add(m[1]);
    }
  };
  walk(motionDir);
  return names;
}

/** What the engine itself knows: scene moves, background names, and which moves need a capture (from the studio's indexes). */
function engineKinds(studio = STUDIO) {
  const scenes = sceneNames(join(studio, 'engine', 'src', 'library', 'motion'));
  const backgrounds = new Set();
  for (const b of tryJson(join(studio, 'library', 'backgrounds', 'index.json'))?.backgrounds ?? []) { backgrounds.add(b.name); if (b.component) backgrounds.add(b.component); }
  const capture = new Set();
  for (const m of tryJson(join(studio, 'library', 'motion', 'index.json'))?.moves ?? []) {
    if (String(m.family).startsWith('capture-') || /^(join|stage|product|relayout)-/.test(m.name)) capture.add(m.name);
  }
  return { scenes, backgrounds, capture };
}

/** Which kind of engine item a name is: 'scene', 'background', 'capture', or null. Names may be kebab or component names. */
export function classify(name, kinds = engineKinds()) {
  for (const n of [name, kebab(name)]) {
    if (kinds.scenes.has(n)) return { kind: 'scene', name: n };
    if (kinds.capture.has(n)) return { kind: 'capture', name: n };
    if (kinds.backgrounds.has(n)) return { kind: 'background', name: n };
  }
  return { kind: null, name };
}

/**
 * Can this capture be used for a preview? Only a capture of a job whose brand is `demo`. A client's capture is never used.
 * Returns `{ ok, reason }`.
 */
export function captureStatus(root, capture) {
  if (!capture) return { ok: false, reason: 'no demo capture yet' };
  const job = String(capture).split('/')[0];
  if (!job || job.includes('..')) return { ok: false, reason: `no demo capture yet (${capture} is not a capture name)` };
  const brand = tryJson(join(root, 'jobs', job, 'job.json'))?.brand;
  if (brand !== 'demo') return { ok: false, reason: `no demo capture yet (${capture} belongs to ${brand ? `the ${brand} brand` : 'a job with no brand'}; only the demo brand is used for previews)` };
  return { ok: true, reason: '' };
}

/**
 * What to render. Returns `{ render, skipped, attention, notes }`:
 * - `render`: jobs `{ id, tab, width, height, out, clip, moves, capture, entry }` for ready picture entries that have no clip yet
 *   (or all of them with `force`) and at least one engine item the preview can play.
 * - `skipped`: `{ id, reason }` for entries left out on purpose (made on request, sound, clip already there).
 * - `attention`: `{ id, reason }` for entries a person should look at (nothing playable, no demo capture, clip path off the convention).
 * - `notes`: one printed line for each engine item that cannot be played, or needs a capture.
 */
export function planRender(lib, { root, tab = null, only = null, force = false, capture = null, kinds = engineKinds() } = {}) {
  const sounds = engineNames(root).sounds;
  const out = { render: [], skipped: [], attention: [], notes: [] };
  const cap = captureStatus(root, capture);
  for (const t of TABS) {
    if (tab && t !== tab) continue;
    for (const e of lib.tabs[t] ?? []) {
      if (only && e.id !== only) continue;
      if (e.filters?.ready !== true) { out.skipped.push({ id: e.id, reason: 'made on request' }); continue; }
      if (e.preview?.sound || t === 'sound') { out.skipped.push({ id: e.id, reason: 'sound' }); continue; }
      const clip = conventionalClip(e.id);
      if (e.preview?.clip && e.preview.clip !== clip) out.attention.push({ id: e.id, reason: `preview.clip is ${e.preview.clip}, expected ${clip}` });
      if (!force && existsSync(join(root, clip))) { out.skipped.push({ id: e.id, reason: 'has a clip' }); continue; }
      const items = (e.engine ?? []).filter((n) => !sounds.has(n)).map((n) => ({ raw: n, ...classify(n, kinds) }));
      const onCapture = items.filter((i) => i.kind === 'capture');
      if (onCapture.length && !cap.ok) {
        out.notes.push(`${e.id}: ${onCapture.map((i) => i.raw).join(', ')} play on a capture`);
        out.attention.push({ id: e.id, reason: cap.reason });
        continue;
      }
      const playable = items.filter((i) => i.kind);
      for (const i of items.filter((x) => !x.kind)) out.notes.push(`${e.id}: ${i.raw} has no demo scene in the motion library, skipped`);
      if (!playable.length) { out.attention.push({ id: e.id, reason: 'nothing in its engine list has a demo scene, so it has no clip' }); continue; }
      const { width, height } = previewSize(e.filters?.sizes?.[0]);
      const names = playable.map((i) => i.name);
      const entry = { id: e.id, filters: { energy: e.filters.energy, sizes: e.filters.sizes }, timing: e.timing, engine: names };
      out.render.push({ id: e.id, tab: t, width, height, out: join(root, clip), clip, moves: names, capture: onCapture.length ? capture : null, entry });
    }
  }
  return out;
}

/** Re-encodes a render to H.264 without audio, raising the CRF until it is small enough. Returns the final size in bytes. */
async function compress(run, src, dest) {
  let size = Infinity;
  for (let crf = 28; crf <= 45; crf += 3) {
    const r = await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-t', '3', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest]);
    if (r.code !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').trim().split('\n').pop()}`);
    size = statSync(dest).size;
    if (size <= TARGET_KB * 1024) break;
  }
  if (size > MAX_KB * 1024) throw new Error(`the clip is ${Math.round(size / 1024)} KB, over the ${MAX_KB} KB limit`);
  return size;
}

export async function main(argv, { run = spawnRun, log = console.log, studio = STUDIO } = {}) {
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const flag = (name) => argv.includes(name);
  const root = resolve(opt('--root') ?? studio);
  const tab = opt('--tab') ?? null;
  if (tab && !TABS.includes(tab)) { log(`Unknown tab ${tab}. Tabs: ${TABS.join(', ')}`); return 2; }
  const lib = loadLibrary(root);
  for (const n of lib.notes) log(n);

  if (flag('--sprite')) {
    const entries = (tab ? [tab] : TABS).flatMap((t) => lib.tabs[t] ?? []).filter((e) => e.filters?.ready === true && e.preview?.sound);
    if (flag('--dry-run')) { log(`Sprite plan: ${entries.length} sounds, at most 4 s each`); return 0; }
    const { file, map, notes } = await buildSprite(entries, root, { run });
    for (const n of notes) log(n);
    log(`Sound sprite: ${Object.keys(map).length} sounds in ${file}`);
    return 0;
  }

  const plan = planRender(lib, { root, tab, only: opt('--only') ?? null, force: flag('--force'), capture: opt('--capture') ?? null });
  for (const n of plan.notes) log(n);
  if (flag('--dry-run')) {
    for (const j of plan.render) log(`render ${j.id} ${j.width}x${j.height} -> ${j.clip} (${j.moves.join(', ')})`);
    for (const a of plan.attention) log(`needs attention: ${a.id}: ${a.reason}`);
    log(`Plan: ${plan.render.length} to render, ${plan.skipped.length} skipped, ${plan.attention.length} need attention`);
    return 0;
  }

  const work = mkdtempSync(join(tmpdir(), 'style-previews-'));
  const bin = join(studio, 'engine', 'node_modules', '.bin', 'remotion');
  let total = 0;
  let done = 0;
  const failed = [];
  try {
    for (const job of plan.render) {
      const props = join(work, `${job.id}.json`);
      const raw = join(work, `${job.id}.mp4`);
      writeFileSync(props, JSON.stringify(job.capture ? { entry: job.entry, capture: job.capture } : { entry: job.entry }));
      mkdirSync(dirname(job.out), { recursive: true });
      try {
        const r = await run(bin, ['render', 'src/library/styles/entry.tsx', 'style-preview', raw, `--props=${props}`, '--codec=h264', '--muted', '--log=error'], { cwd: join(studio, 'engine') });
        if (r.code !== 0) throw new Error(`remotion render failed: ${(r.stderr || r.stdout || '').trim().split('\n').pop()}`);
        const size = await compress(run, raw, job.out);
        total += size;
        done += 1;
        log(`rendered ${job.id}: ${Math.round(size / 1024)} KB`);
      } catch (e) {
        failed.push(job.id);
        log(`failed ${job.id}: ${e.message}`);
        rmSync(job.out, { force: true });
      }
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
  for (const a of plan.attention) log(`needs attention: ${a.id}: ${a.reason}`);
  log(`Previews: ${done} rendered, ${plan.skipped.length} skipped, ${plan.attention.length} need attention, ${failed.length} failed, ${(total / 1024).toFixed(0)} KB in all`);
  return failed.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
