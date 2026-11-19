#!/usr/bin/env node
// Contact sheets for studying a video.
//
//   node tools/study/sheets.mjs overview <video> <out_dir> [frames_per_second=2] [cols=6] [rows=4]
//       The whole film as numbered sheets, each frame stamped with its time.
//   node tools/study/sheets.mjs window <video> <out.jpg> <start_s> <end_s> [cols=6]
//       Every frame between two times on one sheet: use it on a transition.
//
// Needs an ffmpeg with drawtext (a full build: Homebrew "ffmpeg-full", Gyan.FFmpeg on Windows, apt ffmpeg on Linux).
// Set FFMPEG to override.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ffmpegBin, ffprobeBin, runBin } from '../lib/ff.mjs';

const [mode, videoArg, ...rest] = process.argv.slice(2);
const USAGE = 'usage: node tools/study/sheets.mjs overview <video> <out_dir> [fps=2] [cols=6] [rows=4]\n       node tools/study/sheets.mjs window <video> <out.jpg> <start_s> <end_s> [cols=6]';
if (!mode || !videoArg) { console.log(USAGE); process.exit(2); }
if (mode !== 'overview' && mode !== 'window') { console.log(`unknown mode ${mode}`); process.exit(1); }
const need = (v, what) => { if (v === undefined || v === '') { console.log(`${what} is needed.\n${USAGE}`); process.exit(2); } return v; };

let FF, FP;
try { FF = ffmpegBin(); } catch (e) { console.log(e.message); process.exit(1); }
const video = path.resolve(videoArg);

// drawtext needs a font file on Windows and on Linux without fontconfig; macOS finds its own.
function fontOption() {
  const list = process.platform === 'win32'
    ? [path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf')]
    : process.platform === 'linux'
      ? ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf', '/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/liberation/LiberationSans-Regular.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf']
      : [];
  const f = list.find((c) => fs.existsSync(c));
  if (!f) return '';
  return `fontfile='${f.replace(/\\/g, '/').replace(/:/g, '\\:')}':`;
}
const STAMP = `drawtext=${fontOption()}text='%{pts\\:hms}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4`;
const ff = (args) => {
  const r = runBin(FF, ['-v', 'error', ...args]);
  if (r.status !== 0) { console.log(String(r.stderr).trim() || 'ffmpeg failed.'); process.exit(1); }
};

if (mode === 'overview') {
  const out = path.resolve(need(rest[0], 'out_dir')), fps = rest[1] ?? '2', cols = rest[2] ?? '6', rows = rest[3] ?? '4';
  fs.mkdirSync(out, { recursive: true });
  ff(['-y', '-i', video, '-an', '-vf', `fps=${fps},scale=400:-2,${STAMP},tile=${cols}x${rows}:padding=4:color=white`, '-q:v', '4', path.join(out, 'sheet_%02d.jpg')]);
  console.log('sheets written:', fs.readdirSync(out).filter((f) => /^sheet_.*\.jpg$/.test(f)).length);
} else {
  const out = path.resolve(need(rest[0], 'out.jpg')), a = Number(need(rest[1], 'start')), b = Number(need(rest[2], 'end')), cols = Number(rest[3] ?? 6);
  try { FP = ffprobeBin(); } catch (e) { console.log(e.message); process.exit(1); }
  const [num, den = '1'] = String(runBin(FP, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', video]).stdout).trim().split('/');
  const f = Number(num) / Number(den);
  const n = Math.max(1, Math.ceil((b - a) * f));
  const rows = Math.ceil(n / cols);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  ff(['-y', '-ss', String(rest[1]), '-t', String(b - a), '-i', video, '-an', '-vf', `scale=400:-2,${STAMP},tile=${cols}x${rows}:padding=4:color=white`, '-frames:v', '1', '-q:v', '4', out]);
  console.log(`${out} (${n} frames, starts at ${rest[1]}s)`);
}
