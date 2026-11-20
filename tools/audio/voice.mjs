#!/usr/bin/env node
// Voice for a video: generated line by line, checked, joined. Never stretched, never sliced.
//
//   voice.mjs voices [job_dir | --brand <name>]    list the named voices of a brand (default: the studio's default brand)
//   voice.mjs generate <job_dir> [--takes 3]       make takes for every line in <job_dir>/audio/script.json
//   voice.mjs choose <job_dir>                     check every take and pick the best per line
//   voice.mjs join <job_dir>                       join the chosen takes into audio/voice.wav + audio/words.json
//
// audio/script.json is a list of lines:
//   [{ "id": "01", "text": "[excited] Toolvo's sale is live!", "gap_after": 0.7 }, ...]
// "text" is what the voice reads (directions in [brackets], product words as in pronunciation.md).
// The voice comes from job.json ("voice": "Ray") looked up in brands/<the job's brand>/voices.json; mishearings come from its heard-as.json.
// The key is read from .env in the studio folder. Needs Node 22+, ffmpeg, and python3 for the checks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { brandDir, brandOfJob, rel } from '../brand/lib.mjs';
import { resolvePython } from '../../setup/runtime/resolve.mjs';
import { toolEnv } from '../lib/ff.mjs';

const PY = resolvePython().path ?? 'python3';   // python3 on macOS/Linux, python or py on Windows
const PY_ENV = toolEnv();

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Inside Claude's command sandbox the network goes through a proxy, which Node only uses when told to.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const again = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(again.status ?? 1);
}
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const [cmd, ...args] = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 1));
const die = (msg) => { console.error(msg); process.exit(1); };

// Everything about the voice that belongs to a brand: its named voices, its default, and its known mishearings.
function brandFor(job) { try { return brandOfJob(job); } catch (error) { die(error.message); } }
const voicesFile = (brand) => path.join(brandDir(brand), 'voices.json');
function voiceBook(brand) {
  const file = voicesFile(brand);
  if (!fs.existsSync(file)) die(`${rel(file)} does not exist. Copy brands/_template/voices.json there and add the brand's voices.`);
  const book = readJson(file);
  if (!Array.isArray(book.voices) || !book.voices.length) die(`${rel(file)} has no voices yet. Add a row with the voice's name and its ElevenLabs id.`);
  return book;
}
function voiceFor(job) {
  const brand = brandFor(job); const book = voiceBook(brand);
  const wanted = job.voice || book.default || die(`job.json names no voice, and ${rel(voicesFile(brand))} has no "default".`);
  const v = book.voices.find((x) => x.name.toLowerCase() === wanted.toLowerCase() || x.voice_id === wanted);
  if (!v) die(`Voice "${wanted}" is not in ${rel(voicesFile(brand))}. Add it there with its ElevenLabs id. It has: ${book.voices.map((x) => x.name).join(', ')}.`);
  return v;
}
/** The --heard-as option for voice_check.py: the brand's own list of confirmed mishearings. */
function heardAs(job) {
  const file = path.join(brandDir(brandFor(job)), 'heard-as.json');
  return fs.existsSync(file) ? ['--heard-as', file] : [];
}
function key() {
  const envFile = path.join(STUDIO, '.env');
  if (!fs.existsSync(envFile)) die('No .env file. Run: node setup/runtime/install.mjs, then paste the ElevenLabs key into .env');
  const m = fs.readFileSync(envFile, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m);
  if (!m || !m[1].trim()) die('ELEVENLABS_API_KEY is empty in .env');
  return m[1].trim();
}
function jobPaths(jobDir) {
  const dir = path.resolve(jobDir);
  const audio = path.join(dir, 'audio'); const lines = path.join(audio, 'lines');
  fs.mkdirSync(lines, { recursive: true });
  const scriptFile = path.join(audio, 'script.json');
  if (!fs.existsSync(scriptFile)) die(`Missing ${scriptFile}`);
  return { dir, audio, lines, script: readJson(scriptFile), job: readJson(path.join(dir, 'job.json')) };
}

// Character timings -> words, with [directions] removed.
function toWords(alignment) {
  const { characters: c, character_start_times_seconds: s, character_end_times_seconds: e } = alignment;
  const words = []; let cur = '', cs = 0, ce = 0, inTag = false;
  for (let i = 0; i < c.length; i++) {
    const ch = c[i];
    if (ch === '[') { inTag = true; continue; }
    if (inTag) { if (ch === ']') inTag = false; continue; }
    if (/\s/.test(ch)) { if (cur) { words.push({ w: cur, s: cs, e: ce }); cur = ''; } continue; }
    if (!cur) cs = s[i];
    cur += ch; ce = e[i];
  }
  if (cur) words.push({ w: cur, s: cs, e: ce });
  return words;
}
const spokenText = (text) => text.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat(r.stdout);
}

async function generate() {
  const { lines, script, job } = jobPaths(args[0] || die('Give the job folder.'));
  const takes = Number(flag('takes', 3)); const model = flag('model', 'eleven_v3');
  const voice = voiceFor(job); const KEY = key();
  for (const line of script) {
    for (let t = 1; t <= takes; t++) {
      const base = path.join(lines, `${line.id}-t${t}`);
      if (fs.existsSync(base + '.mp3')) continue;                       // never pay twice for the same take
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}/with-timestamps?output_format=mp3_44100_192`, {
        method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: line.text, model_id: model, voice_settings: voice.settings || {} }),
      });
      if (!r.ok) die(`ElevenLabs refused line ${line.id}: ${r.status} ${(await r.text()).slice(0, 300)}`);
      const d = await r.json();
      fs.writeFileSync(base + '.mp3', Buffer.from(d.audio_base64, 'base64'));
      writeJson(base + '.json', { text: line.text, alignment: d.alignment });
      console.log('made', path.basename(base));
    }
  }
}

function choose() {
  const { audio, lines, script, job } = jobPaths(args[0] || die('Give the job folder.'));
  const choices = {}; let failed = 0;
  for (const line of script) {
    const takes = fs.readdirSync(lines).filter((f) => f.startsWith(line.id + '-t') && f.endsWith('.mp3')).sort();
    if (!takes.length) die(`No takes for line ${line.id}. Run generate first.`);
    const txt = path.join(lines, `${line.id}.txt`); fs.writeFileSync(txt, spokenText(line.text));
    const scored = takes.map((f) => {
      const out = path.join(lines, f.replace('.mp3', '.voicecheck'));
      spawnSync(PY, ['-I', path.join(STUDIO, 'tools/audio/voice_check.py'), path.join(lines, f), '--script', txt, '--out', out, ...heardAs(job)], { env: PY_ENV });
      const rep = readJson(path.join(out, 'report.json'));
      const faults = rep.clipping.length + rep.hard_stops.length + rep.hard_starts.length + rep.dropouts.length;
      const match = rep.words && rep.words.match != null ? rep.words.match : null;
      return { take: f, faults, match, clean: faults === 0 && (match == null || match >= 0.97) };
    });
    scored.sort((a, b) => (b.clean - a.clean) || ((b.match ?? 0) - (a.match ?? 0)) || (a.faults - b.faults));
    const best = scored[0];
    choices[line.id] = { take: best.take, clean: best.clean, all: scored };
    if (!best.clean) failed++;
    console.log(`${line.id}: ${best.take} ${best.clean ? 'clean' : 'NO CLEAN TAKE (regenerate this line)'}  words ${best.match == null ? 'not checked' : (best.match * 100).toFixed(0) + '%'}`);
  }
  writeJson(path.join(audio, 'choices.json'), choices);
  console.log(failed ? `${failed} line(s) have no clean take. Delete their takes and run generate again.` : 'Every line has a clean take.');
  process.exit(failed ? 1 : 0);
}

function join() {
  const { audio, lines, script, job } = jobPaths(args[0] || die('Give the job folder.'));
  const choicesFile = path.join(audio, 'choices.json');
  if (!fs.existsSync(choicesFile)) die('Run choose first.');
  const choices = readJson(choicesFile);
  const lead = Number(flag('lead', 0.3)); const defaultGap = Number(flag('gap', 0.7));
  const inputs = []; const filters = []; const labels = []; const words = []; const lineTimes = [];
  let t = lead, n = 0;
  const silence = (secs) => { filters.push(`anullsrc=r=48000:cl=mono,atrim=0:${secs.toFixed(3)}[s${n}]`); labels.push(`[s${n}]`); n++; };
  silence(lead);                                                         // leading silence is kept, never dropped
  script.forEach((line, i) => {
    const take = choices[line.id]?.take || die(`No chosen take for line ${line.id}`);
    const file = path.join(lines, take);
    inputs.push('-i', file);
    filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=mono[a${i}]`); labels.push(`[a${i}]`);
    const len = duration(file);
    const w = toWords(readJson(file.replace('.mp3', '.json')).alignment);
    w.forEach((x) => words.push({ w: x.w, s: +(x.s + t).toFixed(3), e: +(x.e + t).toFixed(3), line: line.id }));
    lineTimes.push({ id: line.id, start: +t.toFixed(3), end: +(t + len).toFixed(3), text: spokenText(line.text) });
    t += len;
    const gap = i < script.length - 1 ? (line.gap_after ?? defaultGap) : 0.5;
    silence(gap); t += gap;
  });
  const out = path.join(audio, 'voice.wav');
  const r = spawnSync(FFMPEG, ['-v', 'error', '-y', ...inputs, '-filter_complex',
    `${filters.join(';')};${labels.join('')}concat=n=${labels.length}:v=0:a=1[out]`, '-map', '[out]', '-c:a', 'pcm_s16le', out], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(out)) die('Joining failed: ' + r.stderr);
  const got = duration(out);
  if (Math.abs(got - t) > 0.15) die(`Joined length ${got.toFixed(2)} s does not match the plan ${t.toFixed(2)} s. Do not use this file.`);
  writeJson(path.join(audio, 'words.json'), words);
  writeJson(path.join(audio, 'lines.json'), lineTimes);
  const full = path.join(audio, 'script.txt'); fs.writeFileSync(full, script.map((l) => spokenText(l.text)).join('\n'));
  const check = spawnSync(PY, ['-I', path.join(STUDIO, 'tools/audio/voice_check.py'), out, '--script', full, '--out', path.join(audio, 'voice.voicecheck'), ...heardAs(job)], { encoding: 'utf8', env: PY_ENV });
  console.log(check.stdout.trim());
  console.log(`voice.wav ${got.toFixed(2)} s, ${words.length} words, ${script.length} lines.`);
  console.log('Level jumps between lines are expected to be small; if the check lists any, regenerate the odd line.');
  process.exit(check.status === 0 ? 0 : 1);
}

if (cmd === 'voices') {
  // A job folder, --brand <name>, or nothing (the studio's default brand).
  const jobFile = args[0] && !args[0].startsWith('--') ? path.join(path.resolve(args[0]), 'job.json') : null;
  const brand = brandFor(jobFile ? readJson(jobFile) : { brand: flag('brand') });
  const book = voiceBook(brand);
  console.log(`Voices of ${brand} (default: ${book.default || 'none'})`);
  for (const v of book.voices) console.log(`${v.name.padEnd(12)} ${v.voice_id}  ${v.note || ''}`);
}
else if (cmd === 'generate') await generate();
else if (cmd === 'choose') choose();
else if (cmd === 'join') join();
else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 2 : 0); }
