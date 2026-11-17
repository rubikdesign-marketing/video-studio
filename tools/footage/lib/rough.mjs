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
import { planCut as planFraming } from './framing.mjs';
import { captionLines } from './paper.mjs';
import { captionChars, placeCaptions } from './framecheck.mjs';
import { bare, transcribe } from './transcribe.mjs';

const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
export const slugOf = (job) => path.basename(path.resolve(job)).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');

/** A clip's dialogue: its repaired voice (phase 3, voice/mix.wav) when there is one, else its sound as recorded. */
export const voiceOf = (clipDir) => (fs.existsSync(path.join(clipDir, 'voice', 'mix.wav')) ? path.join(clipDir, 'voice', 'mix.wav') : path.join(clipDir, 'sound.wav'));

/** The room-tone file for a clip's dialogue, made on first use from the same sound the dialogue uses. */
function roomtoneOf(clipDir) {
  const src = voiceOf(clipDir);
  const f = path.join(clipDir, src.endsWith('mix.wav') ? 'voice/roomtone.wav' : 'roomtone.wav');
  if (!fs.existsSync(f) || fs.statSync(f).mtimeMs < fs.statSync(src).mtimeMs) py('cutpoints', ['roomtone', src, path.join(clipDir, 'words.json'), f]);
  return f;
}

/**
 * How much room tone to lay under each clip's pieces so every cut keeps the same room (FOOTAGE-PLAN.md 7.3): the
 * noisiest clip's background is the target; a clip more than 2 dB quieter gets that clip's room tone underneath, at
 * the level that brings its background up to the target. Nothing is done when even the noisiest room is quieter than
 * -70 dBFS (not heard under dialogue), or when the room tone would need more than 12 dB of lift. Returns { clip: { bed, gainDb } }. Levels in dBFS.
 */
const INAUDIBLE = -70; // dBFS: a background quieter than this is not heard under dialogue at -20 LUFS

export function roomBeds(floors, roomLevels) {
  const clips = Object.keys(floors);
  if (clips.length < 2) return {};
  const target = clips.reduce((a, b) => (floors[b] > floors[a] ? b : a));
  const t = floors[target]; const out = {};
  if (t < INAUDIBLE) return {}; // every room is too quiet to hear in a mix: nothing to even
  for (const c of clips) {
    if (c === target || floors[c] > t - 2) continue;
    const bedDb = 10 * Math.log10(10 ** (t / 10) - 10 ** (floors[c] / 10));
    const gainDb = round(bedDb - roomLevels[target], 2);
    if (gainDb > 12) continue; // the room tone would have to be pushed up hard: leave the cut as it is
    out[c] = { bed: target, gainDb };
  }
  return out;
}

/** The dialogue: every piece from its clip's voice, crossfaded 15 ms into the next, with the room evened out. */
export function dialogue(job, cut, out) {
  const edit = path.join(job, 'edit');
  const inputs = []; const chains = []; let last = null; let n = 0;
  const clips = [...new Set(cut.pieces.map((p) => p.clip))];
  const dirOf = (c) => path.join(edit, 'clips', c);
  const floors = {}; const roomLevels = {};
  for (const c of clips) {
    floors[c] = JSON.parse(String(py('repair', ['floor', voiceOf(dirOf(c)), '--words', path.join(dirOf(c), 'words.json')])).trim().split('\n').pop()).floor_dbfs;
    roomLevels[c] = JSON.parse(String(py('repair', ['floor', roomtoneOf(dirOf(c))])).trim().split('\n').pop()).floor_dbfs;
  }
  const beds = roomBeds(floors, roomLevels);
  cut.pieces.forEach((p, i) => {
    const clipDir = dirOf(p.clip);
    const src = p.kind === 'room tone' ? roomtoneOf(clipDir) : voiceOf(clipDir);
    inputs.push('-ss', String(p.in), '-t', String(p.dur), '-i', src);
    const k = n++;
    let label = `p${i}`;
    chains.push(`[${k}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[${label}]`);
    const bed = beds[p.clip];
    if (bed) { // under speech and under room-tone fillers alike, so no stretch of the film drops to a different room
      inputs.push('-stream_loop', '-1', '-t', String(p.dur), '-i', roomtoneOf(dirOf(bed.bed)));
      const b = n++;
      chains.push(`[${b}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${bed.gainDb}dB[b${i}]`);
      chains.push(`[${label}][b${i}]amix=inputs=2:normalize=0:duration=first[m${i}]`);
      label = `m${i}`;
    }
    if (i === 0) last = label;
    else { chains.push(`[${last}][${label}]acrossfade=d=${CROSSFADE}:c1=tri:c2=tri[x${i}]`); last = `x${i}`; }
  });
  cut.room = { floors_dbfs: floors, beds };
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
export function pictures(cut, fps, srcOf, framing = null, sizeOf = () => null) {
  const starts = cut.pieces.map((p, k) => (k === 0 ? 0 : Math.round((p.at + CROSSFADE / 2) * fps)));
  const total = Math.round(cut.duration * fps);
  let lastSpeech = null; let lastKey = null;
  // A piece's crop keyframes on its own frame clock: [frame from the piece's start, x, y, w, h] (source pixels).
  const cropOf = (k, from, size) => {
    const keys = framing?.[k];
    if (!keys?.length) return null;
    return { src: size, keys: keys.map((q) => [Math.max(0, Math.round(q.t * fps) - from), q.x, q.y, q.w, q.h]) };
  };
  return cut.pieces.map((p, k) => {
    const from = starts[k]; const frames = Math.max(1, (starts[k + 1] ?? total) - from);
    if (p.kind === 'speech') {
      lastSpeech = p;
      const crop = cropOf(k, from, sizeOf(p.clip));
      if (crop) lastKey = { src: crop.src, keys: [[0, ...crop.keys.at(-1).slice(1)]] };
      return { src: srcOf(p.clip), from, frames, trim: Math.max(0, Math.round((p.in + (from / fps - p.at)) * fps)), freeze: false, ...(crop ? { crop } : {}) };
    }
    const prev = lastSpeech ?? cut.pieces.find((q) => q.kind === 'speech');
    return { src: srcOf(prev.clip), from, frames, trim: Math.max(0, Math.round((prev.out - 1 / fps) * fps)), freeze: true, ...(lastKey ? { crop: lastKey } : {}) };
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
  writeJson(path.join(edit, 'cutlist.json'), cut); // with the room levels the dialogue was made with
  py('cuts', [path.join(rough, 'dialogue.wav'), path.join(edit, 'cutlist.json'), path.join(rough, 'cuts.png')]);
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
  // The footage camera (phase 4) for every film size, from each clip's faces and who speaks.
  const info = Object.fromEntries(clips.map((c) => {
    const d = path.join(edit, 'clips', c); const cj = readJson(path.join(d, 'clip.json'));
    const v = cj.source.measured.video || { width: 1920, height: 1080 };
    return [c, { faces: readJson(path.join(d, 'faces.json'), null), speakers: readJson(path.join(d, 'speakers.json'), null), shots: readJson(path.join(d, 'shots.json'), null), steadyZoom: cj.steady?.zoom || 1, src: { w: v.width, h: v.height } }];
  }));
  const sizes = {}; const framing = {};
  for (const [name, [w, h]] of Object.entries(SIZES)) {
    const plan = planFraming(cut, info, { w, h });
    framing[name] = plan;
    // Caption lines split for this size: a tall frame holds about 17 characters a line at caption size, a wide one 42.
    // and each line moved to the top slot when a face would be under the bottom one while it shows.
    const lines = placeCaptions(name, { w, h }, cut, plan, info, captionLines(filmWords(cut, wordsOf), { max: captionChars(name, { w, h }) }));
    sizes[name] = { width: w, height: h, pictures: pictures(cut, fps, srcOf, plan, (c) => [info[c].src.w, info[c].src.h]), captions: { lines } };
  }
  writeJson(path.join(rough, 'framing.json'), { sizes: framing, clips: Object.fromEntries(Object.entries(info).map(([c, x]) => [c, { src: x.src, steadyZoom: x.steadyZoom }])) });
  const main = jobJson.size && SIZES[jobJson.size] ? jobJson.size : '16:9';
  const engineCut = { job: slug, fps, width, height, size: main, durationInFrames: Math.max(1, Math.round(cut.duration * fps)), audio: `jobs/${slug}/edit/dialogue.wav`, pictures: sizes[main].pictures, sizes, captions };
  writeJson(path.join(rough, 'cut.json'), engineCut);
  writeJson(path.join(pub, 'cut.json'), engineCut);
  const listFile = path.join(STUDIO, 'engine', 'public', 'footage-cuts.json');
  const list = (readJson(listFile, []) || []).filter((x) => x.cut !== slug);
  writeJson(listFile, [{ cut: slug, made: new Date().toISOString() }, ...list]);
  return { slug, cutJson: path.join(rough, 'cut.json'), seconds: cut.duration, fps, width, height };
}

/** Renders the rough cut with the engine (FootageCut). Needs to run outside Claude's command sandbox (the render browser). */
export function renderRough(job, slug, out, size = '') {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  run('npx', ['remotion', 'render', 'FootageCut', out, `--props=${JSON.stringify({ cut: slug, size })}`, '--log=error'], { cwd: path.join(STUDIO, 'engine') });
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
