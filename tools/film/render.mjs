#!/usr/bin/env node
// Render a job's film, or one scene of it. Works the same on macOS, Linux and Windows.
//
//   node tools/film/render.mjs <job_dir> preview                   whole film, half size, lower quality  -> out/preview.mp4
//   node tools/film/render.mjs <job_dir> master [--no-captions]    whole film, full quality              -> out/raw.mp4, then
//                                                                  tools/audio/master.mjs                -> out/<job>.mp4 + 720p preview
//   node tools/film/render.mjs <job_dir> scene <id>                one scene, full quality (id like S02) -> out/scenes/<id>.mp4
//   node tools/film/render.mjs <job_dir> scene <id> --splice       one scene at preview quality, swapped into out/preview.mp4
//
// --no-captions renders the version without captions; the master then goes to out/<job>-no-captions.mp4.
// --splice is for review rounds: after a change to one scene, only that scene is rendered again and put back into
//   the preview in its place. The scenes around it and the sound are not touched. It needs a preview made by this
//   tool after the last change to the voice or the shot list, and it stops if another render is running.
//   Splicing and mastering need a full ffmpeg; a plain preview, scene or raw render needs only ffprobe.
// Each run first refreshes the film skeleton (tools/film/scaffold.mjs), so times always match the voice.
// Only one render runs at a time: a second one waits, because two bundles at once crash the bundler. A lock left by a
//   render that was killed is cleared on its own.
// The last good file is never lost: each render is written beside its destination, checked (a picture, the right number
//   of frames), and only then put in place; the file it replaces moves to versions/ beside it (the last 3 are kept).
// Every run is timed into the job's runs.jsonl (tools/film/costs.mjs reads it).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquire } from './lib/lock.mjs';
import { record } from './lib/runlog.mjs';
import { replaceKeeping, checkVideo, videoFrames } from './lib/safe.mjs';
import { ffmpegBin, ffprobeBin, runBin } from '../lib/ff.mjs';
import { killTree } from '../lib/proc.mjs';
import { childEnv } from '../../setup/runtime/run.mjs';
import { npmInvocation } from '../../setup/runtime/resolve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '..', '..');
const SELF = 'node tools/film/render.mjs';

const USAGE = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
const usage = (code = 0) => { console.log(USAGE); process.exit(code); };
const say = (m) => console.log(m);
const bail = (m, code = 1) => { say(m); process.exit(code); };

const argv = process.argv.slice(2);
if (!argv.length) usage();
if (!fs.existsSync(argv[0]) || !fs.statSync(argv[0]).isDirectory()) bail(`Not a job folder: ${argv[0]}`);
const JOB = fs.realpathSync(path.resolve(argv[0]));
const MODE = argv[1] ?? '';
let SCENE = '', SUFFIX = '', SPLICE = false, PROPS = [];
for (const arg of argv.slice(2)) {
  if (arg === '--no-captions') { SUFFIX = '-no-captions'; PROPS = ['--props', '{"captions":false}']; }
  else if (arg === '--splice') SPLICE = true;
  else if (arg.startsWith('-')) { say(`Unknown option: ${arg}`); usage(2); }
  else SCENE = arg;
}
if (!['preview', 'master', 'scene'].includes(MODE)) usage(2);
if (MODE === 'scene' && !SCENE) bail(`Which scene? For example: ${SELF} ${JOB} scene S02`, 2);
if (SPLICE && MODE !== 'scene') bail(`--splice only works with one scene, for example: ${SELF} ${JOB} scene S02 --splice`, 2);

// The programs it needs, found before any time is spent: a render needs ffprobe, splicing and mastering a full ffmpeg.
let FFPROBE, FFMPEG = null;
try { FFPROBE = ffprobeBin(); } catch (e) { bail(e.message); }
if (SPLICE || MODE === 'master') { try { FFMPEG = ffmpegBin(); } catch (e) { bail(e.message); } }

const NAME = path.basename(JOB);
const slugRun = spawnSync(process.execPath, [path.join(HERE, 'scaffold.mjs'), '--slug', JOB], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
if (slugRun.status !== 0) process.exit(slugRun.status ?? 1);
const SLUG = slugRun.stdout.trim();
const OUT = path.join(JOB, 'out');
const FILM_JSON = path.join(STUDIO, 'engine', 'src', 'jobs', SLUG, 'film.json');
const PREVIEW = path.join(OUT, `preview${SUFFIX}.mp4`);
const PREVIEW_FROM = path.join(OUT, `preview${SUFFIX}.film.json`);   // the film.json the preview was rendered from, so a splice can check it
const PREVIEW_LOOK = ['--scale', '0.5', '--crf', '28', '--jpeg-quality', '70'];
const FULL = ['--crf', '16', '--jpeg-quality', '95', '--audio-bitrate', '320k'];
const sizeOf = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };

if (SPLICE && !sizeOf(PREVIEW)) bail(`There is no preview to put the scene into yet (${PREVIEW}). Render the whole preview first: ${SELF} ${JOB} preview`);

// One render at a time, shared by every render tool (tools/film/storyboard.mjs uses the same lock). The lock is a
// folder (making one either works or fails, never half) holding our process id.
const LOCK = path.join(STUDIO, 'engine', 'out', '.render.lock');
let release;
if (SPLICE) {
  release = acquire(LOCK, { tool: `render.mjs scene ${SCENE} --splice`, job: NAME, wait: false });
  if (!release) {
    let other = 'unknown'; try { other = fs.readFileSync(path.join(LOCK, 'pid'), 'utf8').trim() || 'unknown'; } catch {}
    bail(`Another render is running (process ${other}), so the scene was not swapped in. Try again when it has finished.`);
  }
} else {
  release = acquire(LOCK, { tool: `render.mjs ${MODE}${SCENE ? ` ${SCENE}` : ''}`, job: NAME });
}

let WORK = '', PARTIAL = '', CHILD = null, RESULT = false;
const STARTED = Date.now();
process.on('exit', () => {
  if (CHILD && CHILD.exitCode === null && CHILD.signalCode === null) killTree(CHILD);
  release();   // removes the lock only if it is still ours
  for (const p of [WORK, PARTIAL]) if (p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} }
  try {
    record(JOB, { tool: 'render', mode: MODE, scene: SCENE, splice: SPLICE ? 1 : '', captions: SUFFIX ? 'off' : '', seconds: Math.floor((Date.now() - STARTED) / 1000), ok: RESULT });
  } catch {}
});
// Node skips 'exit' handlers when a signal ends it (bash's EXIT trap did not), so turn Ctrl-C and kill into a normal
// exit: the lock is released, the partial file removed, and the child stopped (killTree covers Windows too).
for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(sig, () => process.exit(code));

// How to run Remotion without a shell: its own entry file under node, else npx.
function remotionCommand() {
  const cli = path.join(STUDIO, 'engine', 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
  if (fs.existsSync(cli)) return { cmd: process.execPath, prefix: [cli] };
  const n = npmInvocation('npx');
  return { cmd: n.cmd, prefix: [...n.prefix, 'remotion'] };
}

function runLive(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    CHILD = spawn(cmd, args, { stdio: 'inherit', windowsHide: true, ...opts });
    CHILD.on('error', (e) => { say(`Could not start ${cmd}: ${e.message}`); resolve(127); });
    CHILD.on('close', (code) => { CHILD = null; resolve(code ?? 1); });
  });
}

const scaffold = spawnSync(process.execPath, [path.join(HERE, 'scaffold.mjs'), JOB], { stdio: 'inherit' });
if (scaffold.status !== 0) process.exit(scaffold.status ?? 1);
say('');

// render(composition, output file, expected frames, remotion options): renders beside the output, checks the
// picture and its length in frames, then puts it in place, keeping the file it replaces in versions/.
async function render(composition, file, want, ...extra) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const ext = path.extname(file);
  PARTIAL = path.join(path.dirname(file), `.${path.basename(file, ext)}.partial-${process.pid}.mp4`);
  fs.rmSync(PARTIAL, { force: true });
  const r = remotionCommand();
  const code = await runLive(r.cmd, [...r.prefix, 'render', composition, PARTIAL, ...PROPS, ...extra.flat()], { cwd: path.join(STUDIO, 'engine'), env: childEnv(process.env) });
  if (code !== 0) process.exit(code);   // set -e: the failing render's exit status is ours
  const problem = checkVideo(PARTIAL, want);
  if (problem) { say(problem); bail(`Nothing was replaced: the previous ${path.basename(file)} is unchanged.`); }
  replaceKeeping(PARTIAL, file); PARTIAL = '';
  const d = runBin(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  say(`wrote ${file}: ${String(d.stdout).trim()} s`);
}

// film.json: "total" = the film's frame count; "starts" = the first frame of every scene but the first; scene(id) = the scene's first
// frame, the frame after its last, the film's frame count, and the frame rate. Frames are counted the way engine/src/jobs/_film.tsx does.
const filmJson = () => JSON.parse(fs.readFileSync(FILM_JSON, 'utf8'));
const frameAt = (film, seconds) => Math.round(seconds * film.fps);
const filmTotal = () => { const f = filmJson(); return frameAt(f, f.duration); };
const filmStarts = () => { const f = filmJson(); return f.scenes.slice(1).map((s) => frameAt(f, s.start)).join(','); };
function filmScene(id) {
  const f = filmJson();
  const scene = f.scenes.find((s) => s.id === id);
  if (!scene) { console.error(`The film has no scene ${id}. Its scenes are ${f.scenes.map((s) => s.id).join(', ')}.`); process.exit(1); }
  return { start: frameAt(f, scene.start), end: frameAt(f, scene.end), total: frameAt(f, f.duration), fps: f.fps };
}

// The picture settings a spliced scene must share with the preview, one line per setting.
const picture = (file) => String(runBin(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,profile,level,pix_fmt,width,height,r_frame_rate,has_b_frames', '-of', 'default=nw=1', file]).stdout).trim();
const ff = (args) => { const r = runBin(FFMPEG, ['-v', 'error', ...args]); if (r.status !== 0) { say(String(r.stderr).trim()); process.exit(1); } };

// Puts the scene into the preview in its place. Every frame outside the scene is copied as it is, never re-encoded:
// the preview is rendered with a fresh starting frame where each scene begins, so the cut falls exactly there.
async function splice() {
  const again = `Render the whole preview again: ${SELF} ${JOB} preview`;
  if (!sizeOf(PREVIEW_FROM)) bail(`The preview was not made by this version of the tool, so it cannot take a single scene. ${again}`);
  if (!fs.readFileSync(FILM_JSON).equals(fs.readFileSync(PREVIEW_FROM))) {
    say('The film has changed since the preview was rendered (the voice, the shot list or the scene times moved),');
    bail(`so a single scene would no longer line up. ${again}`);
  }
  const { start, end, total, fps } = filmScene(SCENE);
  if (String(videoFrames(PREVIEW)) !== String(total)) bail(`The preview is not the length film.json says. ${again}`);
  const probe = String(runBin(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags', '-of', 'csv=p=0', PREVIEW]).stdout);
  const starts = new Set(probe.split('\n').map((l) => l.split(',')).filter((c) => c[1] && c[1].includes('K')).map((c) => Math.floor(Number(c[0]) * fps + 0.5)));
  for (const f of [start, end]) {
    if (f !== total && !starts.has(f)) bail(`The preview has no clean cut where ${SCENE} begins or ends (frame ${f}). ${again}`);
  }

  WORK = fs.mkdtempSync(path.join(OUT, '.splice.'));
  const w = (n) => path.join(WORK, n);
  await render(`${SLUG}-${SCENE}`, w('scene.mp4'), end - start, PREVIEW_LOOK);
  if (picture(w('scene.mp4')) !== picture(PREVIEW)) bail(`The new ${SCENE} does not match the preview's picture settings, so it was not swapped in. The preview is unchanged.`);
  if (String(videoFrames(w('scene.mp4'))) !== String(end - start)) bail(`The new ${SCENE} is not ${end - start} frames long, so it was not swapped in. The preview is unchanged.`);

  // Cut the preview's picture into before, scene, after (stream copy, at the scene's starting frames), then join
  // before + new scene + after, and lay the preview's own sound track back on unchanged.
  const cuts = [start, end].filter((f) => f > 0 && f < total).join(',');
  if (cuts) ff(['-i', PREVIEW, '-map', '0:v:0', '-c', 'copy', '-f', 'segment', '-segment_frames', cuts, '-reset_timestamps', '1', w('part%d.mp4')]);
  else ff(['-i', PREVIEW, '-map', '0:v:0', '-c', 'copy', w('part0.mp4')]);
  // The scene's own sound runs a little past its last frame, so only its picture is joined, and every piece is given
  // its exact length in frames: otherwise the scenes after it would slide late.
  ff(['-i', w('scene.mp4'), '-map', '0:v:0', '-c', 'copy', w('scene-picture.mp4')]);
  const seconds = (f) => (f / fps).toFixed(6);
  let n = 0, join = '';
  if (start > 0) { join += `file 'part0.mp4'\nduration ${seconds(start)}\n`; n = 1; }
  join += `file 'scene-picture.mp4'\nduration ${seconds(end - start)}\n`;
  if (end < total) join += `file 'part${n + 1}.mp4'\n`;
  fs.writeFileSync(w('join.txt'), join);
  ff(['-f', 'concat', '-safe', '0', '-i', w('join.txt'), '-i', PREVIEW, '-map', '0:v:0', '-map', '1:a:0?', '-c', 'copy', '-video_track_timescale', '90000', '-movflags', '+faststart', w('spliced.mp4')]);

  if (String(videoFrames(w('spliced.mp4'))) !== String(total)) bail('The joined preview came out the wrong length, so it was not kept. The preview is unchanged.');
  replaceKeeping(w('spliced.mp4'), PREVIEW);
  say(`Swapped the new ${SCENE} into ${PREVIEW} (frames ${start} to ${end - 1} of ${total}). Everything else in the preview, and the sound, is unchanged.`);
}

const TOTAL = filmTotal();
if (MODE === 'preview') {
  process.env.KEYFRAMES_AT = filmStarts();   // fresh frames where scenes begin, for --splice
  await render(SLUG, PREVIEW, TOTAL, PREVIEW_LOOK);
  fs.copyFileSync(FILM_JSON, PREVIEW_FROM);
} else if (MODE === 'scene') {
  if (SPLICE) await splice();
  else { const s = filmScene(SCENE); await render(`${SLUG}-${SCENE}`, path.join(OUT, 'scenes', `${SCENE}${SUFFIX}.mp4`), s.end - s.start, FULL); }
} else {
  await render(SLUG, path.join(OUT, `raw${SUFFIX}.mp4`), TOTAL, FULL);
  const code = await runLive(process.execPath, [path.join(STUDIO, 'tools', 'audio', 'master.mjs'), path.join(OUT, `raw${SUFFIX}.mp4`), path.join(OUT, `${NAME}${SUFFIX}`)]);
  if (code !== 0) process.exit(code);
}
RESULT = true;
