#!/usr/bin/env node
// Master a rendered film's sound to the delivery level, and make a light preview.
//   node tools/audio/master.mjs <rendered.mp4> <out_base>      -> <out_base>.mp4 and <out_base>-preview-720p.mp4
// Two-pass loudness normalisation to -14 LUFS with peaks under -1 dBTP. The picture is copied untouched.
// It measures the result and fails loudly if the output is missing or off target. The new master is written beside the
// old one and replaces it only once it has passed; the old one moves to versions/ (the last 3 are kept).
// The review copy fits the film's shape at 720p: 1280x720 landscape, 720x1280 portrait, 720x720 square, never enlarged.
// Needs a full ffmpeg (set FFMPEG or DAMEX_FFMPEG, or install one: see node setup/runtime/install.mjs --with ffmpeg).
import fs from 'node:fs';
import path from 'node:path';
import { replaceKeeping } from '../film/lib/safe.mjs';
import { ffmpegBin, ffprobeBin, runBin } from '../lib/ff.mjs';

const [inArg, outArg] = process.argv.slice(2);
if (!inArg || !outArg) {
  console.log('usage: node tools/audio/master.mjs <rendered.mp4> <out_base_without_extension>');
  process.exit(2);
}
const IN = path.resolve(inArg), OUT = path.resolve(outArg);
const dir = path.dirname(OUT), base = path.basename(OUT);
const NEW = path.join(dir, `.${base}.partial-${process.pid}.mp4`);
const NEWP = path.join(dir, `.${base}-preview.partial-${process.pid}.mp4`);
process.on('exit', () => { for (const f of [NEW, NEWP]) { try { fs.rmSync(f, { force: true }); } catch {} } });
// Ctrl-C or kill must also clean up: Node skips 'exit' handlers on a signal unless the signal is handled.
for (const [sig, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) process.on(sig, () => process.exit(code));

let FF, FP;
try { FF = ffmpegBin(); FP = ffprobeBin(); } catch (e) { console.log(e.message); process.exit(1); }
const TARGET = -14, PEAK = -1, RANGE = 11;
// The limiter works on sample peaks; the AAC encode and the peaks between samples add a little on top, so it sits
// 0.5 dB under the true-peak ceiling (0.84 = -1.5 dBFS). At 0.89 (-1.0 dBFS) a film came out at -0.92 dBTP.
const LIMIT = 0.84;
fs.mkdirSync(dir, { recursive: true });

const fail = (m) => { console.log(m); process.exit(1); };

// The loudnorm JSON for a file, or null.
function measure(file) {
  const r = runBin(FF, ['-hide_banner', '-nostats', '-i', file, '-af', `loudnorm=I=${TARGET}:TP=${PEAK}:LRA=${RANGE}:print_format=json`, '-f', 'null', '-']);
  const m = /^\{[\s\S]*?^\}/m.exec(String(r.stderr ?? ''));
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
const duration = (file) => parseFloat(String(runBin(FP, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).stdout).trim());

const j = measure(IN);
if (!j) fail(`Could not measure the sound of ${IN}. Does it have an audio track?`);
console.log(`before: ${j.input_i} LUFS, peak ${j.input_tp} dBTP`);

const enc = runBin(FF, ['-v', 'error', '-y', '-i', IN, '-c:v', 'copy',
  '-af', `loudnorm=I=${TARGET}:TP=${PEAK}:LRA=${RANGE}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,alimiter=limit=${LIMIT}:attack=2:release=60:level=false,aresample=48000`,
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', NEW]);
if (enc.stderr) process.stderr.write(enc.stderr);
if (!fs.existsSync(NEW) || fs.statSync(NEW).size === 0) fail('The mastered file was not written. The previous master is unchanged.');

const j2 = measure(NEW);
if (!j2) fail(`Could not measure the sound of ${NEW}. The previous master is unchanged.`);
const oi = parseFloat(j2.input_i), otp = parseFloat(j2.input_tp);
console.log(`after:  ${j2.input_i} LUFS, peak ${j2.input_tp} dBTP`);
const bad = [];
if (!(Math.abs(oi - TARGET) <= 1.0)) bad.push(`loudness ${oi} LUFS is more than 1 away from -14`);
if (!(otp <= -1.0)) bad.push(`peak ${otp} dBTP is above the -1 dBTP ceiling`);
if (bad.length) fail(`OFF TARGET: ${bad.join('; ')}. The previous master is unchanged.`);
console.log('on target');

const din = duration(IN), dout = duration(NEW);
if (!(Math.abs(din - dout) < 0.1)) fail(`Length changed: ${din.toFixed(2)} s -> ${dout.toFixed(2)} s`);

replaceKeeping(NEW, `${OUT}.mp4`);

const dim = String(runBin(FP, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', `${OUT}.mp4`]).stdout).trim().split('x').map(Number);
const [W, H] = dim;
const [BW, BH] = W > H ? [1280, 720] : H > W ? [720, 1280] : [720, 720];
runBin(FF, ['-v', 'error', '-y', '-i', `${OUT}.mp4`, '-vf', `scale='min(${BW},iw)':'min(${BH},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
  '-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', NEWP]);
if (!fs.existsSync(NEWP) || fs.statSync(NEWP).size === 0) fail('The preview was not written.');
replaceKeeping(NEWP, `${OUT}-preview-720p.mp4`, 0);
console.log(`wrote ${OUT}.mp4 and ${OUT}-preview-720p.mp4`);
