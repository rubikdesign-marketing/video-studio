#!/usr/bin/env node
// Measures the motion library's standalone scenes (demos/ and the sized families) for the style previews: renders
// every scene once, back to back, per energy ("style-scene-reel", src/library/styles/StylePreview.tsx), scans the
// frames with ffmpeg the way the visual check scans the preview clips, and writes each scene's timing to
// library/motion/scene-timing.json: when it is built, its cue (transitions, camera moves, controls), its empty spans
// and how wide it draws. render-previews.mjs and the preview composition start each slot from it (rules.mjs,
// slotStart, fitFrame). Run it again after a scene's timing changes.
//   node tools/styles/scene-timing.mjs [--energy calm,confident,hype] [--keep <dir> [--reuse]]
// --keep keeps the reels and scans in <dir>; --reuse measures a reel already there instead of rendering it again.
// Rendering needs Chrome (and --gl=angle for the shader scenes), so it runs outside the sandbox.
import { mkdtempSync, writeFileSync, readFileSync, renameSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnRun } from './lib/sprite.mjs';
import { remotionCli, sceneTimingFile } from './render-previews.mjs';
import { sceneList, reelOffsets, parseMetadata, analyzeScene, boxesFromColumns, mergeTimings, CUE_FAMILIES } from './lib/scene-timing.mjs';

const STUDIO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FPS = 30;
const SIZE = [480, 270];
const LEAD = 1;
/** Then this long on the empty dark page, so a scene's empty dark page counts as empty too. */
const DARK = 0.5;
const EDGES = 'edgedetect=low=0.05:high=0.15';
const COLUMNS = [120, 68];

const tryJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

async function ffmpegMeta(run, args) {
  const r = await run('ffmpeg', ['-v', 'error', ...args, '-f', 'null', '-']);
  if (r.code !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').trim().split('\n').pop()}`);
  return r.stdout;
}

/** Per-frame edge, difference from the empty page, change from the frame before, and the box of what has edges. */
async function scan(run, video, work) {
  const base = join(work, 'page.png');
  const darkBase = join(work, 'page-dark.png');
  for (const [at, file] of [[LEAD / 2, base], [LEAD + DARK / 2, darkBase]]) {
    const b = await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', video, '-frames:v', '1', file]);
    if (b.code !== 0) throw new Error(`ffmpeg failed: ${(b.stderr || '').trim().split('\n').pop()}`);
  }
  const print = 'metadata=print:file=-';
  const edges = parseMetadata(await ffmpegMeta(run, ['-i', video, '-vf', `${EDGES},signalstats,${print}`]), 'lavfi.signalstats.YAVG');
  const against = async (still) => parseMetadata(await ffmpegMeta(run, ['-i', video, '-loop', '1', '-i', still, '-filter_complex', `[0:v]format=yuv420p[a];[1:v]format=yuv420p[b];[a][b]blend=all_mode=difference:shortest=1,signalstats,${print}`]), 'lavfi.signalstats.YAVG');
  const page = await against(base);
  const dark = await against(darkBase);
  const change = parseMetadata(await ffmpegMeta(run, ['-i', video, '-vf', `tblend=all_mode=difference,signalstats,${print}`]), 'lavfi.signalstats.YAVG');
  // The box: the edge frames scaled down to 120 x 68 grey bytes; a column with edges in it is part of the content.
  const cols = join(work, 'columns.raw');
  const c = await run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `${EDGES},scale=${COLUMNS[0]}:${COLUMNS[1]}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', cols]);
  if (c.code !== 0) throw new Error(`ffmpeg failed: ${(c.stderr || '').trim().split('\n').pop()}`);
  const boxes = boxesFromColumns(readFileSync(cols), { width: COLUMNS[0], height: COLUMNS[1], scale: SIZE[0] / COLUMNS[0], threshold: 40 });
  // tblend's first output is frames 0 and 1: change[f] is the change into frame f + 1.
  const motion = [0, ...change];
  return { edges, page, dark, motion, boxes };
}

export async function main(argv, { run = spawnRun, log = console.log, studio = STUDIO } = {}) {
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const energies = (opt('--energy') ?? 'calm,confident,hype').split(',').filter(Boolean);
  const list = sceneList(join(studio, 'engine', 'src', 'library', 'motion'));
  const families = new Map((tryJson(join(studio, 'library', 'motion', 'index.json'))?.moves ?? []).map((m) => [m.name, m.family]));
  const file = sceneTimingFile(studio);
  const table = tryJson(file) ?? {};
  table.about = 'Measured by tools/styles/scene-timing.mjs: each standalone scene of the motion library, rendered once per energy at 480x270 and scanned like the preview clips.';
  table.fps = FPS;
  table.size = SIZE;
  table.scenes = table.scenes ?? {};
  const keep = opt('--keep');
  const work = keep ? resolve(keep) : mkdtempSync(join(tmpdir(), 'scene-timing-'));
  mkdirSync(work, { recursive: true });
  try {
    for (const energy of energies) {
      const props = join(work, `reel-${energy}.json`);
      const video = join(work, `reel-${energy}.mp4`);
      writeFileSync(props, JSON.stringify({ items: list.map(({ name, seconds }) => ({ name, seconds })), lead: LEAD, dark: DARK, energy }));
      if (argv.includes('--reuse') && existsSync(video)) log(`reusing ${video}`);
      else {
      log(`rendering ${list.length} scenes at ${energy} ...`);
      const r = await run(process.execPath, [remotionCli(studio), 'render', 'src/library/styles/entry.tsx', 'style-scene-reel', video, `--props=${props}`, '--codec=h264', '--crf=16', '--muted', '--log=error', '--gl=angle'], { cwd: join(studio, 'engine') });
      if (r.code !== 0) throw new Error(`remotion render failed: ${(r.stderr || r.stdout || '').trim().split('\n').pop()}`);
      }
      const frames = await scan(run, video, work);
      const measured = {};
      for (const row of reelOffsets(list, FPS, LEAD + DARK)) {
        const cut = (a) => a.slice(row.from, row.from + row.frames);
        const scene = list.find((s) => s.name === row.name);
        measured[row.name] = analyzeScene({ edges: cut(frames.edges), page: cut(frames.page), dark: cut(frames.dark), motion: cut(frames.motion), boxes: cut(frames.boxes), fps: FPS, seconds: scene.seconds, size: SIZE, cue: CUE_FAMILIES.has(families.get(row.name)), authored: scene.cue });
      }
      // Rows for scenes no longer in the library go; the other energies' rows stay.
      table.scenes = mergeTimings(table.scenes, list, energy, measured);
    }
    const sorted = Object.fromEntries(Object.keys(table.scenes).sort().map((k) => [k, table.scenes[k]]));
    const temp = `${file}.tmp`;
    writeFileSync(temp, `${JSON.stringify({ ...table, scenes: sorted }, null, 1)}\n`);
    renameSync(temp, file);
    log(`Scene timing: ${list.length} scenes at ${energies.join(', ')} -> ${file}`);
    return 0;
  } finally {
    if (!keep) rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
}
