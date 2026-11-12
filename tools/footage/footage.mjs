#!/usr/bin/env node
// The footage tool (FOOTAGE-PLAN.md). Phase 1: ingest and log.
//
//   node tools/footage/footage.mjs ingest jobs/<job> [--clip <name>] [--force] [--engine whisper|parakeet] [--language en]
//   node tools/footage/footage.mjs log jobs/<job>
//   node tools/footage/footage.mjs compare jobs/<job> --clip <name>      the two transcribers side by side
//
// ingest takes every video and sound file in jobs/<job>/footage/ and, for each clip, writes jobs/<job>/edit/clips/<clip>/:
//   clip.json     measurements, what the working copy changed, the source's fingerprint, when each step ran
//   edit.mp4      the working copy: steady frame rate, upright, normal colour, a keyframe every 10 frames
//   sound.wav     the sound on its own, 48 kHz
//   words.json    every word with its start and end, fillers marked, edges snapped to the sound
//   shots.json    shot changes inside the clip
//   quality.json  picture and sound quality per second, with plain-words findings
//   sheet.jpg     a contact sheet with the words said and the brightness and colour scopes (scopes/ has each picture)
// then jobs/<job>/edit/log.md, the table of every clip to read before the paper edit.
// Finished steps are skipped when the source has not changed (--force does them again). The original files are
// never changed. A camera's Log LUT, when needed, goes beside the clip as <clip>.cube.
// Exit code 0 when every clip was ingested, 1 when one failed (the others are still done), 2 when it could not run.
import fs from 'node:fs';
import path from 'node:path';
import { AUDIO_ONLY, MEDIA, PYTHON, fingerprint, py, readJson, slug, writeJson } from './lib/common.mjs';
import { render } from './lib/log.mjs';
import { measure } from './lib/probe.mjs';
import { transcribe } from './lib/transcribe.mjs';
import { makeWorkingCopy } from './lib/workcopy.mjs';

const LONG = 20 * 60; // longer clips: picture quality waits for the paper edit (kept stretches only)
const say = (s) => process.stdout.write(`${s}\n`);

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') o.force = true;
    else if (a.startsWith('--')) o[a.slice(2)] = argv[++i];
    else o._.push(a);
  }
  return o;
}

export function clipsOf(job) {
  const dir = path.join(job, 'footage');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => MEDIA.test(f) && !f.startsWith('.')).sort().map((f) => ({ file: path.join(dir, f), name: slug(f) }));
}

/** Ingest one clip. Returns its folder. */
export function ingestClip(job, { file, name }, opts = {}) {
  const dir = path.join(job, 'edit', 'clips', name);
  const cj = path.join(dir, 'clip.json');
  const fp = fingerprint(file);
  let clip = readJson(cj, null);
  const changed = !clip || clip.source.fingerprint !== fp;
  const redo = opts.force || changed;
  if (redo && fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const stamp = () => new Date().toISOString();
  if (redo || !clip) {
    say(`  measuring`);
    const m = measure(file);
    clip = { name, source: { file: path.relative(job, file), fingerprint: fp, measured: m }, working: { said: [] }, steps: { measured: stamp() }, skipped: {} };
    writeJson(cj, clip);
  }
  const m = clip.source.measured;
  const step = (key, out, fn) => {
    if (!redo && clip.steps[key] && (!out || fs.existsSync(path.join(dir, out)))) return;
    fn();
    clip.steps[key] = stamp();
    writeJson(cj, clip);
  };
  step('working copy', m.video ? 'edit.mp4' : 'sound.wav', () => {
    say('  making the working copy');
    const lut = file.replace(/\.[^.]+$/, '.cube');
    clip.working.said = makeWorkingCopy(file, m, dir, { logLut: fs.existsSync(lut) ? lut : undefined });
  });
  if (m.audio) {
    step('words', 'words.json', () => {
      say('  transcribing');
      const w = transcribe(dir, { engine: opts.engine || 'whisper', language: opts.language });
      clip.transcript = { engine: w.engine, model: w.model, language: w.language, words: w.words.length, gpu: w.gpu, alignment: w.alignment };
    });
  }
  if (m.video) step('shots', 'shots.json', () => { say('  finding shot changes'); py('shots', [path.join(dir, 'edit.mp4'), path.join(dir, 'shots.json')]); });
  if (m.video) {
    if (m.duration > LONG) clip.skipped.picture = 'measured after the paper edit, on the kept stretches only (a long clip)';
    else step('picture quality', null, () => { say('  measuring the picture'); py('picture', [path.join(dir, 'edit.mp4'), path.join(dir, 'quality.json'), '--shots', path.join(dir, 'shots.json')]); });
  }
  if (m.audio) step('sound quality', null, () => { say('  measuring the sound'); py('sound', [path.join(dir, 'sound.wav'), path.join(dir, 'quality.json'), '--words', path.join(dir, 'words.json')]); });
  if (m.video) step('contact sheet', 'sheet.jpg', () => { say('  making the contact sheet'); py('sheet', [dir]); });
  writeJson(cj, clip);
  return dir;
}

export function writeLog(job) {
  const root = path.join(job, 'edit', 'clips');
  const names = fs.existsSync(root) ? fs.readdirSync(root).filter((n) => fs.existsSync(path.join(root, n, 'clip.json'))).sort() : [];
  const clips = names.map((name) => {
    const d = path.join(root, name);
    return { name, clip: readJson(path.join(d, 'clip.json')), words: readJson(path.join(d, 'words.json'), null), shots: readJson(path.join(d, 'shots.json'), null), quality: readJson(path.join(d, 'quality.json'), null) };
  });
  const out = path.join(job, 'edit', 'log.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(path.basename(path.resolve(job)), clips));
  return { out, clips: clips.length };
}

function compare(job, name) {
  const dir = path.join(job, 'edit', 'clips', name);
  if (!fs.existsSync(path.join(dir, 'sound.wav'))) throw new Error(`Ingest ${name} first.`);
  const a = transcribe(dir, { engine: 'whisper', out: 'words.whisper.json' });
  const b = transcribe(dir, { engine: 'parakeet', out: 'words.parakeet.json' });
  const bare = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '');
  const ta = a.words.map((w) => bare(w.text)); const tb = b.words.map((w) => bare(w.text));
  const same = ta.filter((t, i) => tb.includes(t)).length;
  say(`whisper: ${a.words.length} words, ${a.alignment.edges_snapped} edges snapped to the sound`);
  say(`parakeet: ${b.words.length} words, ${b.alignment.edges_snapped} edges snapped to the sound`);
  say(`${Math.round((same / Math.max(1, ta.length)) * 100)}% of whisper's words also in parakeet's. Both saved beside words.json for a person to compare.`);
}

function main() {
  const o = args(process.argv.slice(2));
  const [cmd, jobArg] = o._;
  if (!cmd || !jobArg || !['ingest', 'log', 'compare'].includes(cmd)) {
    say('Usage: node tools/footage/footage.mjs ingest|log|compare jobs/<job> [--clip <name>] [--force] [--engine whisper|parakeet]');
    process.exit(2);
  }
  const job = path.resolve(jobArg);
  if (!fs.existsSync(job)) { say(`No job folder at ${jobArg}.`); process.exit(2); }
  if (cmd !== 'log' && !fs.existsSync(PYTHON)) { say("The footage tool's Python environment is missing. Run: bash setup/install.sh"); process.exit(2); }
  if (cmd === 'compare') { compare(job, o.clip); return; }
  if (cmd === 'ingest') {
    let list = clipsOf(job);
    if (o.clip) list = list.filter((c) => c.name === o.clip || path.basename(c.file) === o.clip);
    if (!list.length) { say(`No footage found in ${path.join(jobArg, 'footage')}${o.clip ? ` named ${o.clip}` : ''}. Put the clips there first.`); process.exit(2); }
    const names = new Map();
    for (const c of list) {
      if (names.has(c.name)) { say(`Two clips would share the folder name "${c.name}" (${path.basename(names.get(c.name))} and ${path.basename(c.file)}). Rename one.`); process.exit(2); }
      names.set(c.name, c.file);
    }
    let failed = 0;
    for (const c of list) {
      say(`${path.basename(c.file)}${AUDIO_ONLY.test(c.file) ? ' (sound only)' : ''}`);
      try { ingestClip(job, c, o); } catch (e) { failed++; const lines = e.message.split('\n').filter(Boolean); say(`  could not finish: ${lines[0]}${lines.length > 1 ? ` (${lines[lines.length - 1].trim()})` : ''}`); }
    }
    const r = writeLog(job);
    say(`\nLog written: ${r.out} (${r.clips} clip${r.clips === 1 ? '' : 's'}).${failed ? ` ${failed} clip${failed > 1 ? 's' : ''} could not be finished; see above.` : ''}`);
    process.exit(failed ? 1 : 0);
  }
  const r = writeLog(job);
  say(`Log written: ${r.out} (${r.clips} clips).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (e) { say(e.message); process.exit(2); }
}
