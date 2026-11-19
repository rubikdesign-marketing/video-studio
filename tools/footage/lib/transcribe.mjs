// Transcripts to cut on (FOOTAGE-PLAN.md section 3, "Transcribe"): every word with its start and end, fillers kept,
// never translated. Whisper large-v3-turbo with its exact word timing (DTW), then every word edge next to a pause is
// snapped onto the real sound (py/align.py). Chosen 12 Nov on the synthetic test clips: whisper's exact timing was
// steady (starts 110-210 ms late, ends 60-110 ms early) where Parakeet's ends ran up to 1.4 s late in 80 ms steps;
// neither was within 50 ms before snapping. Parakeet stays available with --engine parakeet.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FFMPEG, MODELS, STUDIO, py, round, run } from './common.mjs';

export const WHISPER_MODEL = path.join(MODELS, 'ggml-large-v3-turbo-q5_0.bin');
const WHISPER_DTW = 'large.v3.turbo';
const DTW_LATE = 0.15;
// Told to the transcriber first, so it writes fillers down instead of tidying them away.
const FILLER_PROMPT = 'Um, so, uh, I mean, like, you know, I was, I was thinking.';

/** Words that are always fillers, and words that may be (a person decides in the paper edit). */
const FILLERS = new Set(['um', 'umm', 'uh', 'uhh', 'ah', 'er', 'erm', 'hmm', 'mm', 'mhm']);
const MAYBE = new Set(['like', 'so', 'basically', 'actually', 'literally', 'right', 'okay', 'well']);
export const bare = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '');

/** Marks fillers, "you know" and "I mean", and a word said twice in a row ("I, I"). Pure. */
export function markFillers(words) {
  words.forEach((w, i) => {
    const b = bare(w.text); const next = words[i + 1] ? bare(words[i + 1].text) : '';
    if (FILLERS.has(b)) w.filler = 'yes';
    else if ((b === 'you' && next === 'know') || (b === 'i' && next === 'mean')) { w.filler = 'maybe'; if (words[i + 1]) words[i + 1].filler = 'maybe'; }
    else if (MAYBE.has(b) && /[,]$/.test(w.text)) w.filler = 'maybe';
    // A stutter ("the the", "I I"), not grammar across a comma ("try it, it only takes a minute").
    else if (i && b && b === bare(words[i - 1].text) && !/[,.;:!?…]["'’”)\]]*$/.test(words[i - 1].text) && !w.filler) w.repeat = true;
  });
  return words;
}

/** Whisper's full JSON (-ojf) to words: tokens joined into words, start from DTW, end from the token's own end. Pure. */
export function wordsFromWhisper(json) {
  const toks = [];
  for (const seg of json.transcription || []) for (const t of seg.tokens || []) if (!t.text.startsWith('[_')) toks.push(t);
  const words = [];
  for (const t of toks) {
    if (t.text.startsWith(' ') || !words.length) words.push({ text: t.text.trim(), toks: [t] });
    else { words[words.length - 1].text += t.text; words[words.length - 1].toks.push(t); }
  }
  // A word with no letters or digits (a lone "." heard in background noise) is not a word.
  const out = words.filter((w) => /[\p{L}\p{N}]/u.test(w.text)).map((w) => {
    const dtw = w.toks.map((t) => t.t_dtw).find((d) => d >= 0);
    // DTW marks a word 110-210 ms after its sound starts (measured on the test clips): moved 150 ms earlier.
    return { text: w.text, start: round(dtw >= 0 ? Math.max(0, dtw / 100 - DTW_LATE) : w.toks[0].offsets.from / 1000), end: round(w.toks[w.toks.length - 1].offsets.to / 1000), p: round(Math.min(...w.toks.map((t) => t.p ?? 1)), 2) };
  });
  out.forEach((w, i) => { if (i && w.start <= out[i - 1].start) w.start = round(out[i - 1].start + 0.02); });
  // Whisper's own word ends run early, so inside speech a word ends where the next begins. A pause after it is found
  // from the sound (py/align.py), which then ends the word where the pause starts.
  out.forEach((w, i) => { const n = out[i + 1]; if (n) w.end = n.start; if (w.end <= w.start) w.end = round(w.start + 0.04); });
  return out;
}

/** 16 kHz mono copy for the transcribers. */
function asrCopy(sound, dir) {
  const f = path.join(dir, 'asr16k.wav');
  run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', sound, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', f]);
  return f;
}

function whisper(wav, dir, { language = 'auto' } = {}) {
  if (!fs.existsSync(WHISPER_MODEL)) throw new Error(`The transcription model is missing (${path.basename(WHISPER_MODEL)}). Run: node setup/runtime/install.mjs --with transcribe`);
  const base = path.join(dir, 'whisper');
  const args = ['-m', WHISPER_MODEL, '-f', wav, '-l', language, '-ojf', '-of', base, '--dtw', WHISPER_DTW, '-nfa', '-t', String(Math.max(4, os.cpus().length - 2)), '--prompt', FILLER_PROMPT, '-np'];
  // The Mac's graphics chip is much faster; inside Claude's command sandbox it is not reachable, so fall back.
  let r = run('whisper-cli', args, { allowFail: true });
  let gpu = true;
  if (r.status !== 0 || !fs.existsSync(`${base}.json`)) { r = run('whisper-cli', [...args, '-ng'], { allowFail: true }); gpu = false; }
  if (r.status !== 0 || !fs.existsSync(`${base}.json`)) throw new Error(`whisper-cli could not transcribe.\n${(r.err || '').split('\n').slice(-4).join('\n')}`);
  const json = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8'));
  fs.rmSync(`${base}.json`, { force: true });
  return { engine: 'whisper', model: 'large-v3-turbo (q5_0) with DTW word timing', gpu, language: json.result?.language || language, words: wordsFromWhisper(json) };
}

function parakeet(wav, dir) {
  const engine = path.join(STUDIO, 'engine');
  const r = run('npx', ['--no-install', 'hyperframes', 'transcribe', wav, '--engine', 'parakeet', '--json', '-d', dir], { allowFail: true, cwd: engine });
  const f = path.join(dir, 'transcript.json');
  if (r.status !== 0 || !fs.existsSync(f)) throw new Error('Parakeet could not transcribe. Install it with: cd engine && npx hyperframes models install parakeet');
  const list = JSON.parse(fs.readFileSync(f, 'utf8'));
  fs.rmSync(f, { force: true });
  return { engine: 'parakeet', model: 'parakeet-tdt-0.6b-v3', gpu: false, language: 'detected', words: list.map((w) => ({ text: w.text, start: round(w.start), end: round(w.end) })) };
}

/** Transcribe a clip's sound.wav into words.json in its folder. */
export function transcribe(clipDir, { engine = 'whisper', language, out = 'words.json' } = {}) {
  const sound = path.join(clipDir, 'sound.wav');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'footage-asr-'));
  try {
    const wav = asrCopy(sound, work);
    const t = engine === 'parakeet' ? parakeet(wav, work) : whisper(wav, work, { language });
    t.words = t.words.filter((w) => /[\p{L}\p{N}]/u.test(w.text));
    markFillers(t.words);
    const raw = path.join(work, 'raw.json');
    fs.writeFileSync(raw, JSON.stringify({ ...t, made: new Date().toISOString() }));
    py('align', [sound, raw, path.join(clipDir, out)]);
    return JSON.parse(fs.readFileSync(path.join(clipDir, out), 'utf8'));
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
