#!/usr/bin/env node
// Renders each ready picture style's preview clip (silent, at most 3 s, 480 px on the long side) with the engine,
// and builds the sound sprite. Usage:
//   node tools/styles/render-previews.mjs [--tab <id>] [--only <id>] [--force] [--dry-run] [--sprite] [--root <dir>]
// Only node: modules and in-repo imports. The command runner is injected (see main), so tests can stub it.
import { readFileSync, existsSync, mkdirSync, statSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { TABS, loadLibrary, engineNames } from './lib/library.mjs';
import { buildSprite, spawnRun } from './lib/sprite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, '..', '..');
const renderable = JSON.parse(readFileSync(join(STUDIO, 'engine', 'src', 'library', 'styles', 'renderable.json'), 'utf8'));
const SIZES = { '9:16': [270, 480], '16:9': [480, 270], '1:1': [480, 480], '4:5': [384, 480] };
export const MAX_KB = 200;
export const TARGET_KB = 100;

export const previewSize = (size) => { const [width, height] = SIZES[size] ?? SIZES['9:16']; return { width, height }; };
export const conventionalClip = (id) => `library/styles/previews/${id}.mp4`;

const tryJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

/** Engine names (move names, component names, background names) to component names, from the root's own indexes. */
function aliases(root) {
  const alias = new Map();
  for (const m of tryJson(join(root, 'library', 'motion', 'index.json'))?.moves ?? []) {
    if (m?.name) alias.set(m.name, m.component || m.name);
    if (m?.component) alias.set(m.component, m.component);
  }
  for (const b of tryJson(join(root, 'library', 'backgrounds', 'index.json'))?.backgrounds ?? []) {
    if (b?.name) alias.set(b.name, b.component || b.name);
    if (b?.component) alias.set(b.component, b.component);
  }
  return alias;
}

/**
 * What to render. Returns `{ render, skipped, attention, notes }`:
 * - `render`: jobs `{ id, tab, width, height, out, clip, moves, entry }` for ready picture entries that have no clip yet
 *   (or all of them with `force`) and at least one engine item the preview can play alone.
 * - `skipped`: `{ id, reason }` for entries left out on purpose (made on request, sound, clip already there).
 * - `attention`: `{ id, reason }` for entries a person should look at (nothing playable, clip path off the convention).
 * - `notes`: one printed line for each engine item that cannot be played alone.
 */
export function planRender(lib, { root, tab = null, only = null, force = false } = {}) {
  const alias = aliases(root);
  const sounds = engineNames(root).sounds;
  const canPlay = new Set([...renderable.moves, ...renderable.backgrounds]);
  const out = { render: [], skipped: [], attention: [], notes: [] };
  for (const t of TABS) {
    if (tab && t !== tab) continue;
    for (const e of lib.tabs[t] ?? []) {
      if (only && e.id !== only) continue;
      if (e.filters?.ready !== true) { out.skipped.push({ id: e.id, reason: 'made on request' }); continue; }
      if (e.preview?.sound || t === 'sound') { out.skipped.push({ id: e.id, reason: 'sound' }); continue; }
      const clip = conventionalClip(e.id);
      if (e.preview?.clip && e.preview.clip !== clip) out.attention.push({ id: e.id, reason: `preview.clip is ${e.preview.clip}, expected ${clip}` });
      if (!force && existsSync(join(root, clip))) { out.skipped.push({ id: e.id, reason: 'has a clip' }); continue; }
      const items = (e.engine ?? []).filter((n) => !sounds.has(n));
      const playable = [];
      for (const name of items) {
        const component = alias.get(name) ?? name;
        if (canPlay.has(component)) playable.push(component);
        else out.notes.push(`${e.id}: ${name} cannot play alone in a preview, skipped`);
      }
      if (!playable.length) { out.attention.push({ id: e.id, reason: 'nothing in its engine list can play alone in a preview, so it has no clip' }); continue; }
      const { width, height } = previewSize(e.filters?.sizes?.[0]);
      const entry = { id: e.id, filters: { energy: e.filters.energy, sizes: e.filters.sizes }, timing: e.timing, engine: playable };
      out.render.push({ id: e.id, tab: t, width, height, out: join(root, clip), clip, moves: playable, entry });
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

  const plan = planRender(lib, { root, tab, only: opt('--only') ?? null, force: flag('--force') });
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
      writeFileSync(props, JSON.stringify({ entry: job.entry }));
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
