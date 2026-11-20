#!/usr/bin/env node
// Claude's ears (earshot, github.com/Leonxlnx/earshot, MIT): turns a film's or a sound's audio into numbers and one
// picture Claude can read, so nothing is said about how something sounds without a measurement behind it.
//
//   node tools/audio/listen.mjs <film.mp4 | sound.wav> [--job jobs/<job>] [--cues cues.json] [--out <folder>]
//        [--critique] [--detail low|normal|high] [--quick]
//
// It writes, in --out (default: beside the film, in listen/<name>/):
//   measure.json    loudness (LUFS, true peak, loudness range), noise floor, dynamic range, clipping, stereo width,
//                   tone balance in seven bands, onsets, tempo, beats and key
//   timeline.json   second by second: events and how far each rises over the bed, sections with mood, the loudness
//                   curve, the beat grid, and how well each cue lands on its picture moment (with the score random
//                   timing would get, so a good score means something)
//   sheet.png       the same on one picture: frames, events, spectrogram, waveform, loudness, sync marks. Look at it.
//   critique.json   (--critique) the film scored against seven professional launch films, with fixes and timestamps
//   cues.json       the moments the sound should hit, from the job: scene starts (film.json), voice line starts
//                   (audio/lines.json), placed sounds (audio/sfx.json entries with a time), and footage cuts
//                   (edit/cutlist.json). earshot also finds picture cuts in the frames by itself.
// and prints a short report in plain words.
//
// earshot runs on this computer only (CPU), offline once its models are fetched (node setup/runtime/install.mjs --with earshot). Its models live in
// tools/audio/.earshot/. The first call loads them (20-40 s); --quick skips the model passes (measure only).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { earshotBin } from './earshot.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const EARSHOT_HOME = path.join(STUDIO, 'tools', 'audio', '.earshot');
const say = (s) => process.stdout.write(`${s}\n`);
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };


function earshot(args) {
  const bin = earshotBin();
  if (!bin) throw new Error('earshot is not installed. Run: node setup/runtime/install.mjs --with earshot');
  // Caches go inside earshot's own folder: its install is read-only inside Claude's command sandbox.
  const env = { ...process.env, EARSHOT_HOME, EARSHOT_OFFLINE: '1', HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1', TOKENIZERS_PARALLELISM: 'false', NUMBA_CACHE_DIR: path.join(EARSHOT_HOME, 'numba'), MPLCONFIGDIR: path.join(EARSHOT_HOME, 'matplotlib') };
  return execFileSync(bin, args, { env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** The engine's timing file for a job (engine/src/jobs/<slug>/film.json whose "job" is the job's folder name). */
function filmJsonFor(jobName) {
  const root = path.join(STUDIO, 'engine', 'src', 'jobs');
  if (!fs.existsSync(root)) return null;
  for (const slug of fs.readdirSync(root)) {
    const f = readJson(path.join(root, slug, 'film.json'));
    if (f && f.job === jobName) return f;
  }
  return null;
}

/** Cues from what a job knows about its film. Pure apart from reading the job's files. */
export function cuesFor(job) {
  const events = [];
  const add = (t, kind, id) => { if (Number.isFinite(t) && t >= 0) events.push({ t: Math.round(t * 1000) / 1000, kind, id: String(id) }); };
  const film = filmJsonFor(path.basename(path.resolve(job)));
  for (const s of film?.scenes || []) if (s.start > 0) add(s.start, 'cut', s.id);
  // The same moment from two sources is one cue.
  for (const l of readJson(path.join(job, 'audio', 'lines.json'), []) || []) add(l.start, 'line', l.id);
  // Placed sounds: audio/cues.json (a job's own placements) and audio/sfx.json entries that carry a time.
  for (const f of ['cues.json', 'sfx.json']) {
    const list = readJson(path.join(job, 'audio', f), []);
    for (const x of Array.isArray(list) ? list : []) if (typeof x.at === 'number') add(x.at, 'sfx', x.id);
  }
  const cut = readJson(path.join(job, 'edit', 'cutlist.json'));
  for (const p of cut?.pieces?.slice(1) || []) add(p.at + (cut.crossfade || 0) / 2, 'cut', `${p.clip}@${p.in}`);
  events.sort((a, b) => a.t - b.t);
  const once = events.filter((e, i) => !events.slice(0, i).some((x) => x.kind === e.kind && Math.abs(x.t - e.t) < 0.02));
  return { fps: film?.fps || 30, events: once };
}

const fmt = (n, d = 1) => (n === null || n === undefined || Number.isNaN(n) ? '?' : Number(n).toFixed(d));
const pick = (o, ...keys) => { for (const k of keys) { const v = k.split('.').reduce((x, p) => (x == null ? x : x[p]), o); if (v !== undefined && v !== null) return v; } return undefined; };

function main() {
  const a = process.argv.slice(2);
  const opt = (k) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : undefined; };
  const file = a.find((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--') && !['--critique', '--quick'].includes(a[i - 1])));
  if (!file || !fs.existsSync(file)) { say(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 25).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(file ? 2 : 0); }
  const isVideo = /\.(mp4|mov|m4v|mkv|webm)$/i.test(file);
  const out = path.resolve(opt('out') || path.join(path.dirname(file), 'listen', path.basename(file).replace(/\.[^.]+$/, '')));
  fs.mkdirSync(out, { recursive: true });
  const job = opt('job');
  let cuesFile = opt('cues');
  if (!cuesFile && job) {
    const c = cuesFor(job);
    if (c.events.length) { cuesFile = path.join(out, 'cues.json'); fs.writeFileSync(cuesFile, `${JSON.stringify(c, null, 1)}\n`); }
  }
  const quick = a.includes('--quick');
  say(`Listening to ${path.basename(file)}${cuesFile ? ` with ${readJson(cuesFile)?.events?.length ?? '?'} cues` : ''}...`);

  earshot(['measure', file, '--music', '--json', '--out', path.join(out, 'measure.json')]);
  const m = readJson(path.join(out, 'measure.json'));
  const mm = Array.isArray(m) ? m[0] : (m?.results?.[0] ?? m);
  if (!quick) {
    const detail = opt('detail') || 'normal';
    earshot(['timeline', file, ...(cuesFile ? ['--cues', cuesFile] : []), '--detail', detail, '--json', '--out', path.join(out, 'timeline.json')]);
    if (isVideo || cuesFile) earshot(['sheet', file, '-o', path.join(out, 'sheet.png'), ...(cuesFile ? ['--cues', cuesFile] : [])]);
    if (a.includes('--critique')) earshot(['critique', file, '--json', '--out', path.join(out, 'critique.json')]);
  }

  // The report: the numbers that matter, in words.
  say(`Loudness ${fmt(mm.lufs)} LUFS (delivery: -14), true peak ${fmt(mm.true_peak_dbtp)} dBTP (ceiling: -1), loudness range ${fmt(mm.lra_lu)} LU; noise floor ${fmt(mm.noise_floor_dbfs)} dBFS; ${mm.clipped_samples ? `${mm.clipped_samples} clipped samples` : 'no clipping'}.`);
  if (mm.bands_db) say(`Tone balance (dB against the loudest band): ${Object.entries(mm.bands_db).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}.`);
  if (mm.tempo) say(`Music: about ${fmt(mm.tempo, 0)} BPM${Array.isArray(mm.key) ? `, key probably ${mm.key[0]?.key ?? mm.key[0]}${mm.key[1]?.key ? ` (or ${mm.key[1].key})` : ''}` : ''}; ${fmt(mm.onsets_per_s, 2)} hits a second.`);
  const tl = readJson(path.join(out, 'timeline.json'));
  for (const [group, sync] of Object.entries(tl?.sync || {})) {
    const st = sync.stats || {};
    if (!st.n) continue;
    const pc = (x) => `${Math.round((x || 0) * 100)}%`;
    say(`Sound on picture (${group}, ${st.n}): ${pc(st.hit_within_1_frame)} land within a frame (random timing: ${pc(st.chance_within_1_frame)}), ${pc(st.hit_within_100ms)} within 100 ms; typical offset ${fmt(st.median_abs_offset_ms, 0)} ms${st.on_beat !== undefined ? `; ${pc(st.on_beat)} on the beat (random: ${pc(st.on_beat_chance)})` : ''}${st.no_sound?.length ? `; no sound at ${st.no_sound.map((x) => `${fmt(x, 2)} s`).join(', ')}` : ''}.`);
    const missed = (sync.items || []).filter((i) => i.status !== 'OK');
    if (missed.length) say(`  Off or silent: ${missed.slice(0, 8).map((i) => `${fmt(i.t, 2)} s (${i.status}${Number.isFinite(i.offset_ms) ? `, ${i.offset_ms > 0 ? '+' : ''}${fmt(i.offset_ms, 0)} ms` : ''})`).join('; ')}`);
  }
  const cr = readJson(path.join(out, 'critique.json'));
  if (cr) {
    say(`Against ${cr.profile_n ?? 7} professional launch films: ${cr.verdict} (${Math.round((cr.score || 0) * 100)}% of the weighted measures in range).`);
    for (const x of (cr.actions || []).slice(0, 6)) say(`  - [${x.weight}] ${x.action}`);
  }
  say(`Written: ${out}${fs.existsSync(path.join(out, 'sheet.png')) ? ' (open sheet.png and look at it)' : ''}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (e) { say(String(e.stderr || e.message).trim().split('\n').slice(-6).join('\n')); process.exit(1); }
}
