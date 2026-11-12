#!/usr/bin/env node
// Checks an ingested synthetic test job against what its clips really hold (FOOTAGE-PLAN.md phase 1 test).
//
//   node tools/footage/tests/make_clips.mjs <job>        (outside Claude's command sandbox: it uses the Mac's voice)
//   node tools/footage/footage.mjs ingest <job>
//   node tools/footage/tests/check_truth.mjs <job>
//
// Prints one line per check, "ok" or "FAIL", and exits 1 when any fails.
import fs from 'node:fs';
import path from 'node:path';
import { FFMPEG, FFPROBE, readJson, run } from '../lib/common.mjs';

const job = path.resolve(process.argv[2] || '');
const truth = readJson(path.join(job, 'truth.json'), null);
if (!truth) { console.log(`No truth.json in ${job}. Make the test job with tests/make_clips.mjs first.`); process.exit(2); }
const clip = (n, f) => readJson(path.join(job, 'edit', 'clips', n, f), null);
let bad = 0;
const check = (ok, what, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`); };
const bare = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

/** Each phrase's first-word start and last-word end against the truth, in ms. */
function edges(name) {
  const words = clip(name, 'words.json').words;
  const out = []; let i = 0;
  for (const p of truth[name].phrases) {
    const pw = p.text.split(/\s+/).map(bare);
    while (i < words.length && bare(words[i].text) !== pw[0]) i++;
    if (i >= words.length) { out.push(null); break; }
    const s = words[i].start; let j = i + pw.length - 1;
    while (j < words.length && bare(words[j].text) !== pw[pw.length - 1]) j++;
    const e = words[Math.min(j, words.length - 1)].end; i = j + 1;
    out.push([Math.round((s - p.start) * 1000), Math.round((e - p.end) * 1000)]);
  }
  return out;
}
const flags = (name, part) => (clip(name, 'quality.json')?.[part]?.flags || []);
const has = (name, part, what) => flags(name, part).find((f) => f.what === what);

// Transcripts
for (const name of ['talking', 'phone-hdr']) {
  const e = edges(name);
  check(e.every((x) => x && Math.abs(x[0]) <= 50 && Math.abs(x[1]) <= 50), `${name}: every phrase starts and ends within 50 ms of its sound`, JSON.stringify(e));
}
{
  const e = edges('noisy');
  check(e.every((x) => x && Math.abs(x[0]) <= 50) && e.every((x) => x && Math.abs(x[1]) <= 100), 'noisy: phrase starts within 50 ms, ends within 100 ms (a quiet tail is lost in the noise)', JSON.stringify(e));
}
{
  const w = clip('talking', 'words.json').words;
  const fill = w.filter((x) => x.filler === 'yes').map((x) => bare(x.text));
  check(fill.includes('um') && fill.includes('uh'), 'talking: "um" and "uh" kept and marked as fillers', fill.join(', '));
  check(w.some((x) => bare(x.text) === 'like' && x.filler === 'maybe'), 'talking: "like," marked as a possible filler');
}
check((clip('twoshots', 'words.json')?.words || []).length === 0, 'twoshots: no words invented from background noise');

// Measuring and the working copy
{
  const m = clip('phone-hdr', 'clip.json').source.measured;
  check(m.video.colour.kind === 'hdr-hlg', 'phone: HDR (HLG) found');
  check(m.video.rotation === 90 && m.video.width === 1080 && m.video.height === 1920, 'phone: recorded sideways, shown 1080x1920');
  check(m.video.variable === true, 'phone: uneven frame rate found');
  check(m.audio.layoutNote.kind === 'one-side', 'phone: microphone on one side found');
  const f = path.join(job, 'edit', 'clips', 'phone-hdr', 'edit.mp4');
  const s = JSON.parse(run(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate,color_transfer,channels', '-of', 'json', f])).streams;
  const v = s.find((x) => x.codec_type === 'video'); const a = s.find((x) => x.codec_type === 'audio');
  check(v.width === 1080 && v.height === 1920 && v.r_frame_rate === '30/1' && v.color_transfer === 'bt709', 'phone working copy: upright, steady 30 fps, normal colour', `${v.width}x${v.height} ${v.r_frame_rate} ${v.color_transfer}`);
  const times = run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', f]).split('\n').filter((l) => l.trim()).map(Number).filter(Number.isFinite).sort((x, y) => x - y);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  check(gaps.every((g) => Math.abs(g - 1 / 30) < 0.002), 'phone working copy: every frame 1/30 s apart');
  const lv = run(FFMPEG, ['-hide_banner', '-nostats', '-i', f, '-map', '0:a', '-af', 'astats=measure_overall=none:measure_perchannel=RMS_level', '-f', 'null', '-'], { allowFail: true }).err.match(/RMS level dB: (-?[\d.]+)/g) || [];
  check(a.channels === 2 && lv.length === 2 && new Set(lv).size === 1, 'phone working copy: the voice on both sides', lv.join(' / '));
  // Brightness: the working copy against the same test picture made directly in normal colour.
  const got = Number(run(FFMPEG, ['-hide_banner', '-v', 'error', '-ss', '2', '-i', f, '-frames:v', '1', '-vf', 'scale=270:480,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']).match(/YAVG=([\d.]+)/)?.[1]);
  const want = Number(run(FFMPEG, ['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30:d=3', '-ss', '2', '-frames:v', '1', '-vf', 'transpose=2,scale=270:480,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']).match(/YAVG=([\d.]+)/)?.[1]);
  check(Math.abs(got - want) / want < 0.15, 'phone working copy: brightness within 15% of the original picture', `${got.toFixed(1)} against ${want.toFixed(1)}`);
}

// Shots and picture
{
  const s = clip('twoshots', 'shots.json');
  check(s.cuts.length === 1 && Math.abs(s.cuts[0] - 4.0) <= 0.1, 'twoshots: one cut, at 4.0 s', s.cuts.join(', '));
  const sh = flags('twoshots', 'picture').filter((f) => f.what === 'shaky');
  check(sh.length === 1 && sh[0].from >= 3.5 && sh[0].from <= 4.5 && sh[0].to >= 7.5, 'twoshots: shaky from 4 s to the end only', JSON.stringify(sh.map((f) => [f.from, f.to])));
  for (const w of ['soft focus', 'grainy', 'too dark', 'flicker']) check(!!has('noisy', 'picture', w), `noisy: ${w} found`);
  for (const n of ['talking', 'phone-hdr']) check(flags(n, 'picture').length === 0, `${n}: no picture problems reported`, flags(n, 'picture').map((f) => f.what).join(', '));
}

// Sound
{
  const t = truth.noisy;
  const cl = has('noisy', 'sound', 'clipping');
  check(cl && cl.from <= t.clipped[0] + 1 && cl.to >= t.clipped[1], 'noisy: clipping found where it is', cl ? `${cl.from}-${cl.to} s, truth ${t.clipped.map((x) => x.toFixed(2)).join('-')} s` : 'none');
  const found = clip('noisy', 'quality.json').sound.summary.clicks;
  check(found.length === t.clicks.length && t.clicks.every((c) => found.some((x) => Math.abs(x - c) < 0.02)), 'noisy: exactly the three clicks, at the right times', found.join(', '));
  check(clip('noisy', 'quality.json').sound.summary.hum?.base_hz === t.hum, 'noisy: 50 Hz hum found');
  check(!!has('noisy', 'sound', 'music under speech'), 'noisy: music under speech found');
  check(!has('noisy', 'sound', 'rumble') && !has('noisy', 'sound', 'wind'), 'noisy: no rumble or wind reported (there is none)');
  for (const n of ['talking', 'phone-hdr']) check(flags(n, 'sound').length === 0, `${n}: no sound problems reported`, flags(n, 'sound').map((f) => f.what).join(', '));
}

// The log
{
  const log = fs.readFileSync(path.join(job, 'edit', 'log.md'), 'utf8');
  check(['noisy', 'phone-hdr', 'talking', 'twoshots'].every((n) => log.includes(`| ${n} |`)), 'log: one row per clip');
  check(fs.existsSync(path.join(job, 'edit', 'clips', 'talking', 'sheet.jpg')), 'contact sheet made');
}
console.log(bad ? `\n${bad} check${bad > 1 ? 's' : ''} failed.` : '\nAll checks passed.');
process.exit(bad ? 1 : 0);
