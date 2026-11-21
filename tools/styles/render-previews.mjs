#!/usr/bin/env node
// Renders each ready picture style's preview clip (silent, at most 3 s, 480 px on the long side) with the engine,
// and builds the sound sprite. Usage:
//   node tools/styles/render-previews.mjs [--tab <id>] [--only <id>] [--force] [--dry-run] [--sprite] [--root <dir>]
//                                         [--capture <job>/<id>] [--phone-capture <job>/<id>]
// --capture names a demo-brand capture for entries whose moves play on one; any other capture is refused. Without it,
// the demo job's newest desktop take is used (jobs/_demo-previews, the demo product; engine/public/captures.json lists
// it). Entries with a phone move (relayout-phone-take ...) play on a phone-size take instead: --phone-capture, or the
// demo job's newest take whose page is taller than wide.
// Only node: modules and in-repo imports. The command runner is injected (see main), so tests can stub it.
import { readFileSync, existsSync, mkdirSync, statSync, rmSync, writeFileSync, mkdtempSync, readdirSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { TABS, loadLibrary, engineNames } from './lib/library.mjs';
import { buildSprite, spawnRun } from './lib/sprite.mjs';
import { SIZES, kebab, isCaptureMove, isPhoneMove, previewSlots } from '../../engine/src/library/styles/rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, '..', '..');
export const MAX_KB = 200;
export const TARGET_KB = 100;

export const previewSize = (size) => SIZES[size] ?? SIZES['9:16'];
export const conventionalClip = (id) => `library/styles/previews/${id}.mp4`;

const tryJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

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
  const gpu = new Set();
  const phone = new Set();
  const families = new Map();
  for (const m of tryJson(join(studio, 'library', 'motion', 'index.json'))?.moves ?? []) {
    families.set(m.name, m.family);
    if (isPhoneMove(m.name, m.does)) phone.add(m.name);
    // As tools/library/registry.mjs decides: the shader family, or a move whose text says it needs WebGL.
    if (m.family === 'shader' || /webgl|--gl=angle/i.test(m.does || '')) gpu.add(m.name);
    if (isCaptureMove(m.name, m.family)) capture.add(m.name);
  }
  return { scenes, backgrounds, capture, gpu, phone, families };
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

/** The demo brand's job whose capture the previews play on (the demo product, library/fixtures/demo-product). */
export const DEMO_JOB = '_demo-previews';

/** The capture tool names a capture after its job folder like this: "_demo-previews" gives "demo-previews". */
export const captureSlug = (folder) => String(folder).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The engine's list of published captures (engine/public/captures.json), newest first; empty when there is none. */
const listedCaptures = (root) => { const list = tryJson(join(root, 'engine', 'public', 'captures.json')); return Array.isArray(list) ? list : []; };

/** The job folders a capture's first part can mean: the folder itself, or any whose slug it is. */
function jobsNamed(root, part) {
  let folders = [];
  try { folders = readdirSync(join(root, 'jobs'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch {}
  return folders.filter((f) => f === part || captureSlug(f) === part);
}

/**
 * Can this capture be used for a preview? Only a capture of a job whose brand is `demo`. A client's capture is never used.
 * The name is "<job>/<id>" as the capture tool publishes it (the job folder's slug). Every job folder that name could
 * mean must be a demo job, and the engine's own list must not file it under another brand. Returns `{ ok, reason }`.
 */
export function captureStatus(root, capture) {
  if (!capture) return { ok: false, reason: 'no demo capture yet' };
  const parts = String(capture).split('/');
  const safe = (p) => /^[A-Za-z0-9._-]+$/.test(p) && p !== '.' && p !== '..';
  if (parts.length !== 2 || !parts.every(safe)) return { ok: false, reason: `no demo capture yet (${capture} is not a capture name, which is <job>/<id>)` };
  const jobs = jobsNamed(root, parts[0]);
  const brands = jobs.map((j) => tryJson(join(root, 'jobs', j, 'job.json'))?.brand);
  if (!jobs.length || brands.some((b) => b !== 'demo')) {
    const brand = brands.find((b) => b && b !== 'demo');
    return { ok: false, reason: `no demo capture yet (${capture} belongs to ${brand ? `the ${brand} brand` : 'a job with no brand'}; only the demo brand is used for previews)` };
  }
  const listed = listedCaptures(root).find((c) => c?.capture === capture);
  if (listed?.brand && listed.brand !== 'demo') return { ok: false, reason: `no demo capture yet (the engine lists ${capture} under the ${listed.brand} brand; only the demo brand is used for previews)` };
  return { ok: true, reason: '' };
}

/**
 * Is this published capture a phone-size take? Its cursor.json in engine/public says the page is taller than wide
 * (as the engine's isPhoneTake decides, kit/capture/relayout.ts). False when it is not published.
 */
export function isPhoneCapture(root, capture) {
  const parts = String(capture ?? '').split('/');
  if (parts.length !== 2 || !parts.every((p) => /^[A-Za-z0-9._-]+$/.test(p) && p !== '.' && p !== '..')) return false;
  const page = tryJson(join(root, 'engine', 'public', 'jobs', parts[0], 'capture', parts[1], 'cursor.json'))?.page;
  return Boolean(page && page.height > page.width * 1.2);
}

/** The demo job's newest listed capture of one shape (phone-size or not), when its job is still a demo job; else null. */
const newestDemo = (root, phone) => {
  const row = listedCaptures(root).find((c) => c?.job === `jobs/${DEMO_JOB}` && typeof c.capture === 'string' && isPhoneCapture(root, c.capture) === phone);
  return row && captureStatus(root, row.capture).ok ? row.capture : null;
};
/** The demo job's newest desktop (not phone-size) take. */
export const defaultCapture = (root) => newestDemo(root, false);
/** The demo job's newest phone-size take. */
export const defaultPhoneCapture = (root) => newestDemo(root, true);

/** captureStatus for the phone take: a demo capture, and one recorded at phone size. */
export function phoneCaptureStatus(root, capture) {
  if (!capture) return { ok: false, reason: 'no demo phone capture yet' };
  const cap = captureStatus(root, capture);
  if (!cap.ok) return { ok: false, reason: cap.reason.replace(/^no demo capture yet/, 'no demo phone capture yet') };
  if (!isPhoneCapture(root, capture)) return { ok: false, reason: `no demo phone capture yet (${capture} is not a phone-size take)` };
  return cap;
}

/**
 * What to render. Returns `{ render, skipped, attention, notes }`:
 * - `render`: jobs `{ id, tab, width, height, out, clip, moves, pointer, capture, entry }` for ready picture entries that have
 *   no clip yet (or all of them with `force`) and at least one engine item the preview can play. `moves` are the ones
 *   that take a slot (a pointer beside a capture move is a setting: `pointer`); `capture` is the take they play on,
 *   the phone take for an entry with a phone move.
 * - `skipped`: `{ id, reason }` for entries left out on purpose (made on request, sound, clip already there).
 * - `attention`: `{ id, reason }` for entries a person should look at (nothing playable, no demo capture, clip path off the convention).
 * - `notes`: one printed line for each engine item that cannot be played, or needs a capture.
 */
export function planRender(lib, { root, tab = null, only = null, force = false, capture = null, phoneCapture = null, kinds = engineKinds() } = {}) {
  const sounds = engineNames(root).sounds;
  const out = { render: [], skipped: [], attention: [], notes: [] };
  const cap = captureStatus(root, capture);
  const phoneCap = phoneCaptureStatus(root, phoneCapture);
  const familyOf = (n) => kinds.families?.get(n) ?? '';
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
      const phone = items.some((i) => kinds.phone?.has(i.name));
      const status = phone ? phoneCap : cap;
      if (onCapture.length && !status.ok) {
        out.notes.push(`${e.id}: ${onCapture.map((i) => i.raw).join(', ')} play on a ${phone ? 'phone-size ' : ''}capture`);
        out.attention.push({ id: e.id, reason: status.reason });
        continue;
      }
      const playable = items.filter((i) => i.kind);
      for (const i of items.filter((x) => !x.kind)) out.notes.push(`${e.id}: ${i.raw} has no demo scene in the motion library, skipped`);
      // A background alone is a clip of its own; a background beside moves that cannot play would be only a backdrop.
      const hasMove = playable.some((i) => i.kind !== 'background');
      const onlyBackground = playable.length > 0 && playable.length === items.length;
      if (!hasMove && !onlyBackground) { out.attention.push({ id: e.id, reason: 'nothing in its engine list has a demo scene, so it has no clip' }); continue; }
      const { width, height } = previewSize(e.filters?.sizes?.[0]);
      const names = playable.map((i) => i.name);
      const gpu = items.some((i) => kinds.gpu.has(i.name));
      const energy = e.filters.energy?.[0] ?? 'confident';
      const slots = previewSlots(playable.filter((i) => i.kind !== 'background').map((i) => i.name), { familyOf, phone: phone && onCapture.length > 0 });
      const pointer = onCapture.length ? slots.pointer : null;
      const entry = { id: e.id, energy, filters: { energy: e.filters.energy, sizes: e.filters.sizes }, engine: names, ...(pointer ? { pointer } : {}) };
      const take = onCapture.length ? (phone ? phoneCapture : capture) : null;
      out.render.push({ id: e.id, tab: t, width, height, out: join(root, clip), clip, moves: slots.moves, pointer, energy, gpu, capture: take, entry });
    }
  }
  return out;
}

/** The Remotion CLI's own script, run through node so it works the same on macOS, Windows and Linux (no .bin shim). */
export function remotionCli(studio = STUDIO) {
  const require = createRequire(join(studio, 'engine', 'package.json'));
  const pkgFile = require.resolve('@remotion/cli/package.json');
  const bin = JSON.parse(readFileSync(pkgFile, 'utf8')).bin;
  return join(dirname(pkgFile), typeof bin === 'string' ? bin : bin.remotion);
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

  const capture = opt('--capture') ?? defaultCapture(root);
  const phoneCapture = opt('--phone-capture') ?? defaultPhoneCapture(root);
  const plan = planRender(lib, { root, tab, only: opt('--only') ?? null, force: flag('--force'), capture, phoneCapture });
  for (const n of plan.notes) log(n);
  if (plan.render.some((j) => j.capture && j.capture === capture)) log(`Capture moves play on ${capture} (demo brand)`);
  if (plan.render.some((j) => j.capture && j.capture === phoneCapture)) log(`Phone moves play on ${phoneCapture} (demo brand, phone size)`);
  if (flag('--dry-run')) {
    for (const j of plan.render) log(`render ${j.id} ${j.width}x${j.height} -> ${j.clip} (${j.moves.join(', ')}${j.pointer ? `; pointer ${j.pointer}` : ''})`);
    for (const a of plan.attention) log(`needs attention: ${a.id}: ${a.reason}`);
    log(`Plan: ${plan.render.length} to render, ${plan.skipped.length} skipped, ${plan.attention.length} need attention`);
    return 0;
  }

  const work = mkdtempSync(join(tmpdir(), 'style-previews-'));
  const cli = remotionCli(studio);
  let total = 0;
  let done = 0;
  const failed = [];
  try {
    for (const job of plan.render) {
      const props = join(work, `${job.id}.json`);
      const raw = join(work, `${job.id}.mp4`);
      writeFileSync(props, JSON.stringify(job.capture ? { entry: job.entry, capture: job.capture } : { entry: job.entry }));
      mkdirSync(dirname(job.out), { recursive: true });
      // Encode beside the clip and move it into place only when it is good, so a failed re-render keeps the old clip.
      const temp = join(dirname(job.out), `${job.id}.tmp.mp4`);
      try {
        const r = await run(process.execPath, [cli, 'render', 'src/library/styles/entry.tsx', 'style-preview', raw, `--props=${props}`, '--codec=h264', '--muted', '--log=error', ...(job.gpu ? ['--gl=angle'] : [])], { cwd: join(studio, 'engine') });
        if (r.code !== 0) throw new Error(`remotion render failed: ${(r.stderr || r.stdout || '').trim().split('\n').pop()}`);
        const size = await compress(run, raw, temp);
        renameSync(temp, job.out);
        total += size;
        done += 1;
        log(`rendered ${job.id}: ${Math.round(size / 1024)} KB`);
      } catch (e) {
        failed.push(job.id);
        log(`failed ${job.id}: ${e.message}`);
        rmSync(temp, { force: true });
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
