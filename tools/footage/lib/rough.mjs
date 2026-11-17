// The rough cut (FOOTAGE-PLAN.md section 4, "First animation" approval): the cut list played with captions.
// The sound is made here, not in the engine: the engine sets volume once a frame, too coarse for a 15 ms crossfade,
// so the dialogue is one track joined sample by sample (ffmpeg), and the engine plays the pictures over it.
//
// Writes jobs/<job>/edit/rough/: dialogue.wav, captions.json, cut.json (what the engine plays), and copies them with
// each clip's working copy to engine/public/jobs/<slug>/edit/ for the FootageCut composition.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FFMPEG, STUDIO, py, readJson, round, run, writeJson } from './common.mjs';
import { CROSSFADE } from './cut.mjs';
import { captionLines } from './paper.mjs';
import { bare, transcribe } from './transcribe.mjs';

const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
export const slugOf = (job) => path.basename(path.resolve(job)).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');

/** The dialogue: every piece from its clip's sound, crossfaded 15 ms into the next. */
export function dialogue(job, cut, out) {
  const edit = path.join(job, 'edit');
  const inputs = []; const chains = []; let last = null;
  cut.pieces.forEach((p, i) => {
    const clipDir = path.join(edit, 'clips', p.clip);
    let src = path.join(clipDir, 'sound.wav');
    if (p.kind === 'room tone') {
      src = path.join(clipDir, 'roomtone.wav');
      if (!fs.existsSync(src)) py('cutpoints', ['roomtone', path.join(clipDir, 'sound.wav'), path.join(clipDir, 'words.json'), src]);
    }
    inputs.push('-ss', String(p.in), '-t', String(p.dur), '-i', src);
    chains.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`);
    if (i === 0) last = 'a0';
    else { chains.push(`[${last}][a${i}]acrossfade=d=${CROSSFADE}:c1=tri:c2=tri[x${i}]`); last = `x${i}`; }
  });
  const script = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'footage-mix-')), 'graph.txt');
  fs.writeFileSync(script, chains.join(';\n'));
  try {
    run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', ...inputs, '-/filter_complex', script, '-map', `[${last}]`, '-c:a', 'pcm_s24le', '-ar', '48000', out]);
  } finally { fs.rmSync(path.dirname(script), { recursive: true, force: true }); }
}

/** The film's words, on the film's clock. Pure. */
export function filmWords(cut, wordsOf) {
  const out = [];
  for (const p of cut.pieces) {
    if (p.kind !== 'speech') continue;
    const w = wordsOf(p.clip);
    for (const i of p.words) out.push({ text: w[i].text, start: round(p.at + Math.max(0, w[i].start - p.in), 3), end: round(p.at + Math.min(p.dur, w[i].end - p.in), 3) });
  }
  return out;
}

/**
 * What the engine plays: each piece's picture as a stretch of film frames, switching in the middle of each sound
 * crossfade; a room-tone piece holds the last frame before it. Pure.
 */
export function pictures(cut, fps, srcOf) {
  const starts = cut.pieces.map((p, k) => (k === 0 ? 0 : Math.round((p.at + CROSSFADE / 2) * fps)));
  const total = Math.round(cut.duration * fps);
  let lastSpeech = null;
  return cut.pieces.map((p, k) => {
    const from = starts[k]; const frames = Math.max(1, (starts[k + 1] ?? total) - from);
    if (p.kind === 'speech') {
      lastSpeech = p;
      return { src: srcOf(p.clip), from, frames, trim: Math.max(0, Math.round((p.in + (from / fps - p.at)) * fps)), freeze: false };
    }
    const prev = lastSpeech ?? cut.pieces.find((q) => q.kind === 'speech');
    return { src: srcOf(prev.clip), from, frames, trim: Math.max(0, Math.round((prev.out - 1 / fps) * fps)), freeze: true };
  });
}

const place = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.rmSync(to, { force: true }); try { fs.linkSync(from, to); } catch { fs.copyFileSync(from, to); } };

/** Builds the rough cut's files and hands them to the engine. Returns { slug, cutJson, seconds }. */
export function prepareRough(job, cut) {
  const edit = path.join(job, 'edit'); const rough = path.join(edit, 'rough');
  fs.mkdirSync(rough, { recursive: true });
  const cache = {};
  const wordsOf = (clip) => (cache[clip] ??= readJson(path.join(edit, 'clips', clip, 'words.json')).words);
  dialogue(job, cut, path.join(rough, 'dialogue.wav'));
  const captions = { lines: captionLines(filmWords(cut, wordsOf)) };
  writeJson(path.join(rough, 'captions.json'), captions);
  const clips = [...new Set(cut.pieces.map((p) => p.clip))];
  const rates = clips.map((c) => Number(readJson(path.join(edit, 'clips', c, 'clip.json')).source.measured.video?.target || 30));
  const fps = rates.every((r) => r === rates[0]) ? rates[0] : 30;
  const jobJson = readJson(path.join(job, 'job.json'), {});
  const [width, height] = SIZES[jobJson.size] || SIZES['16:9'];
  const slug = slugOf(job);
  const pub = path.join(STUDIO, 'engine', 'public', 'jobs', slug, 'edit');
  const srcOf = (clip) => `jobs/${slug}/edit/${clip}.mp4`;
  for (const c of clips) place(path.join(edit, 'clips', c, 'edit.mp4'), path.join(pub, `${c}.mp4`));
  place(path.join(rough, 'dialogue.wav'), path.join(pub, 'dialogue.wav'));
  const engineCut = { job: slug, fps, width, height, durationInFrames: Math.max(1, Math.round(cut.duration * fps)), audio: `jobs/${slug}/edit/dialogue.wav`, pictures: pictures(cut, fps, srcOf), captions };
  writeJson(path.join(rough, 'cut.json'), engineCut);
  writeJson(path.join(pub, 'cut.json'), engineCut);
  const listFile = path.join(STUDIO, 'engine', 'public', 'footage-cuts.json');
  const list = (readJson(listFile, []) || []).filter((x) => x.cut !== slug);
  writeJson(listFile, [{ cut: slug, made: new Date().toISOString() }, ...list]);
  return { slug, cutJson: path.join(rough, 'cut.json'), seconds: cut.duration, fps, width, height };
}

/** Renders the rough cut with the engine (FootageCut). Needs to run outside Claude's command sandbox (the render browser). */
export function renderRough(job, slug, out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run('npx', ['remotion', 'render', 'FootageCut', out, `--props=${JSON.stringify({ cut: slug })}`, '--log=error'], { cwd: path.join(STUDIO, 'engine') });
  return out;
}

/** The words a paper edit keeps against the words heard in the joined sound: what is missing and what is extra. Pure. */
export function compareWords(expected, heard) {
  const a = expected.map(bare).filter(Boolean); const b = heard.map(bare).filter(Boolean);
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const missing = []; const extra = []; let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) missing.push(a[i++]); else extra.push(b[j++]);
  }
  missing.push(...a.slice(i)); extra.push(...b.slice(j));
  return { expected: a.length, heard: b.length, matched: L[0][0], missing, extra };
}

/** Listens back: transcribes the joined dialogue and compares it with the kept words. */
export function listenBack(job, cut) {
  const edit = path.join(job, 'edit');
  const cache = {};
  const wordsOf = (clip) => (cache[clip] ??= readJson(path.join(edit, 'clips', clip, 'words.json')).words);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'footage-listen-'));
  try {
    fs.copyFileSync(path.join(edit, 'rough', 'dialogue.wav'), path.join(tmp, 'sound.wav'));
    const heard = transcribe(tmp).words.map((w) => w.text);
    const expected = filmWords(cut, wordsOf).map((w) => w.text);
    const r = compareWords(expected, heard);
    writeJson(path.join(edit, 'rough', 'listen-back.json'), { ...r, heard: heard.join(' '), expected_text: expected.join(' ') });
    return r;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
