#!/usr/bin/env node
// Is the hook's written line readable in time? (LIBRARY-PLAN.md phase 1; knowledge/craft/15-hooks.md.) A viewer with
// the sound off must be able to read the opening line by 3 s: type at least 7.8% of the frame's short side (84 px on
// 1080) with a contrast of at least 7:1 against what is behind it. The rule is win4r/video-director's (MIT).
//
//   node tools/checks/hook_legible.mjs <render.mp4> [--expect "<the hook's on-screen line>"] [--by 3] [--min 7.8]
//        [--contrast 7] [--lang eng] [--json out.json]
//
// It reads a frame every quarter second from the start to one second past --by (tesseract, on the frame and on its
// negative, so light text on dark is read as well as dark on light), measures each line's type size from the height of
// its letters and its contrast from the frame's own pixels, and stops at the first moment a line is readable.
// With --expect, the readable text must be the hook's own line (half its words are enough: a line may wrap). Always
// give it for a real film: without it any large clear text passes (on real films a calendar's month and a word
// handwritten on a whiteboard both did).
// Text is read as English unless --lang names another tesseract language (it must be installed). Words under three
// letters are not read, so a hook of only such words ("Go AI") cannot be checked by its words.
// Reading frames is imperfect: text over a busy picture or in a display face can be missed. A failure names the
// moment and what was measured; look at that frame before changing the film.
// Exit code 0 when readable in time, 1 when not, 2 when it could not run.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { toolEnv } from '../lib/ff.mjs';
import { emOf, parseTsv } from './text_size.mjs';
import { contrast, inkAndGround, judgeHook, wordsOf } from './lib/hook_text.mjs';

const FF = toolEnv({});   // ffmpeg and ffprobe, found by setup/runtime/resolve.mjs
const FFMPEG = FF.FFMPEG || 'ffmpeg';
const FFPROBE = FF.FFPROBE || 'ffprobe';
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); const v = i >= 0 ? args[i + 1] : undefined; return v === undefined || v.startsWith('--') ? fallback : v; };
const say = (s) => process.stdout.write(`${s}\n`);
const stop = (msg) => { say(msg); process.exit(2); };

const video = args[0] && !args[0].startsWith('--') ? args[0] : null;
if (!video) stop('Usage: node tools/checks/hook_legible.mjs <render.mp4> [--expect "<on-screen line>"] [--by 3] [--min 7.8] [--contrast 7] [--json out.json]');
if (!fs.existsSync(video)) stop(`No such file: ${video}`);
if (spawnSync('tesseract', ['--version']).status !== 0) stop('tesseract is not installed (brew install tesseract).');
const by = Number(opt('by', 3)); const minShare = Number(opt('min', 7.8)); const minContrast = Number(opt('contrast', 7)); const expect = opt('expect', '');
const lang = opt('lang', 'eng'); // tesseract's language: the hook is read as English unless told otherwise
if (![by, minShare, minContrast].every((v) => Number.isFinite(v) && v > 0)) stop('--by, --min and --contrast must be numbers above 0.');
if (!/^[a-z_+]+$/i.test(lang)) stop('--lang is a tesseract language name, for example eng or deu.');
// Words under three letters are not read reliably from a frame, so a hook of only such words cannot be checked.
if (expect && !wordsOf(expect).length) stop(`"${expect}" has no word of three letters or more, so it cannot be told apart from other text. Run without --expect and look at the frame.`);

const p = spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation:format=duration', '-of', 'json', video], { encoding: 'utf8' });
let info;
try {
  const j = JSON.parse(p.stdout); const st = j.streams[0];
  // A phone clip stored sideways is turned upright when its frames are read, so its width and height swap.
  const turned = Math.abs(Number(st.side_data_list?.find((d) => d.rotation !== undefined)?.rotation || 0)) % 180 === 90;
  info = { w: turned ? st.height : st.width, h: turned ? st.width : st.height, duration: Number(j.format.duration) };
} catch { stop(`Could not read ${video} as a video.`); }
if (!Number.isFinite(info.duration) || info.duration <= 0) stop(`Could not tell how long ${video} is, so its opening was not read.`);
const shortSide = Math.min(info.w, info.h);

/** The frame at t: its pixels (rgb24) and its words, read from the frame and from its negative. */
function frameAt(t) {
  const rgb = spawnSync(FFMPEG, ['-v', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 512 * 1024 * 1024 }).stdout;
  if (!rgb || rgb.length < info.w * info.h * 3) return null;
  const up = Math.max(1, 2160 / shortSide);
  const read = (negate) => {
    const png = spawnSync(FFMPEG, ['-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${info.w}x${info.h}`, '-i', '-', '-frames:v', '1',
      '-vf', `scale=iw*${up}:ih*${up}:flags=lanczos,format=gray${negate ? ',negate' : ''}`, '-f', 'image2pipe', '-c:v', 'png', '-'], { input: rgb, maxBuffer: 512 * 1024 * 1024 }).stdout;
    if (!png?.length) return [];
    return parseTsv(spawnSync('tesseract', ['stdin', 'stdout', '--psm', '11', '-l', lang, 'tsv'], { input: png, maxBuffer: 64 * 1024 * 1024 }).stdout.toString('utf8'), up);
  };
  const a = read(false); const b = read(true);
  return { rgb, words: b.length > a.length ? b : a };
}

/** Lines of words (tesseract's own line numbers), each with its type size and its contrast in the frame. */
function linesOf({ rgb, words }) {
  const groups = new Map();
  for (const w of words) { if (!groups.has(w.line)) groups.set(w.line, []); groups.get(w.line).push(w); }
  const out = [];
  for (const ws of groups.values()) {
    const sizes = ws.map((w) => emOf(w.text, w.height)).filter(Boolean).sort((x, y) => x - y);
    if (!sizes.length) continue;
    const size = sizes[Math.floor(sizes.length / 2)];
    const x0 = Math.max(0, Math.floor(Math.min(...ws.map((w) => w.x)))); const x1 = Math.min(info.w, Math.ceil(Math.max(...ws.map((w) => w.x + w.width))));
    const y0 = Math.max(0, Math.floor(Math.min(...ws.map((w) => w.y)))); const y1 = Math.min(info.h, Math.ceil(Math.max(...ws.map((w) => w.y + w.height))));
    const px = [];
    for (let y = y0; y < y1; y++) { const row = y * info.w * 3; for (let x = x0; x < x1; x++) px.push(rgb[row + 3 * x], rgb[row + 3 * x + 1], rgb[row + 3 * x + 2]); }
    const ig = inkAndGround(px);
    out.push({ text: ws.sort((m, n) => m.x - n.x).map((w) => w.text).join(' '), share: (size / shortSide) * 100, contrast: ig ? contrast(ig.ink, ig.ground) : 1 });
  }
  return out;
}

const samples = [];
const last = Math.min(by + 1, Math.max(0, info.duration - 0.04));
for (let t = 0; t <= last + 1e-6; t += 0.25) {
  const f = frameAt(t);
  samples.push({ t: Math.round(t * 100) / 100, lines: f ? linesOf(f) : [] });
  if (judgeHook(samples, { minShare, minContrast, by, expect }).first_readable !== null) break; // readable: no need to read on
}
const r = judgeHook(samples, { minShare, minContrast, by, expect, duration: info.duration });
const report = { film: video, size: `${info.w}x${info.h}`, by, min_share: minShare, min_contrast: minContrast, expect: expect || null, checked_against_the_hook: wordsOf(expect).length > 0, language: lang, ...r, moments_read: samples.length };
if (opt('json')) fs.writeFileSync(opt('json'), `${JSON.stringify(report, null, 2)}\n`);
if (r.pass) {
  say(`Readable in time: "${r.best.text}" at ${r.first_readable} s, type ${r.best.share}% of the short side, contrast ${r.best.contrast}:1.`);
  // Without the hook's own line, any large clear text counts: a date on a calendar, a word written on a whiteboard.
  if (!expect) say('No --expect was given, so this says only that some large, clear text is up in time. Give the hook\'s on-screen line with --expect to check that it is the hook.');
}
else {
  for (const pr of r.problems) say(`${pr.what}: ${pr.detail}.`);
  if (r.best) say(`The best line read: "${r.best.text}" at ${r.best.t} s (type ${r.best.share}% of the short side, contrast ${r.best.contrast}:1).`);
  say('Look at that frame before changing the film: reading text from a picture can miss.');
}
process.exit(r.pass ? 0 : 1);
