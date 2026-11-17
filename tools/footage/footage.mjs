#!/usr/bin/env node
// The footage tool (FOOTAGE-PLAN.md). Phase 1: ingest and log. Phase 2: paper edit and rough cut.
//
//   node tools/footage/footage.mjs ingest jobs/<job> [--clip <name>] [--force] [--engine whisper|parakeet] [--language en]
//   node tools/footage/footage.mjs log jobs/<job>
//   node tools/footage/footage.mjs compare jobs/<job> --clip <name>      the two transcribers side by side
//   node tools/footage/footage.mjs paper jobs/<job> [--fresh] [--energy calm|confident|hype] [--target <seconds>]
//        the first paper edit (edit/paper.json) with the tool's proposals; the transcript page edits it after that
//   node tools/footage/footage.mjs cut jobs/<job>                      the cut list (edit/cutlist.json), joins checked
//   node tools/footage/footage.mjs approve jobs/<job> <join key>       a person's yes to a flagged join
//   node tools/footage/footage.mjs repair jobs/<job> [--clip <name>]    phase 3: each clip's sound repaired (voice/, sound.json)
//   node tools/footage/footage.mjs check-framing jobs/<job>            phase 4: every film size checked for faces in frame,
//        the safe area, sharpness, the eye line at punch-ins and captions clear of faces (edit/rough/framing-check.json)
//   node tools/footage/footage.mjs rough jobs/<job> [--render [--size 9:16]]  the rough cut's sound, captions and engine files;
//        --render renders it to jobs/<job>/out/rough-cut.mp4 (outside Claude's command sandbox: the render browser)
//
// ingest takes every video and sound file in jobs/<job>/footage/ and, for each clip, writes jobs/<job>/edit/clips/<clip>/:
//   clip.json     measurements, what the working copy changed, the source's fingerprint, when each step ran
//   edit.mp4      the working copy: steady frame rate, upright, normal colour, a keyframe every 10 frames
//   sound.wav     the sound on its own, 48 kHz
//   words.json    every word with its start and end, fillers marked, edges snapped to the sound
//   shots.json    shot changes inside the clip
//   quality.json  picture and sound quality per second, with plain-words findings
//   sheet.jpg     a contact sheet with the words said and the brightness and colour scopes (scopes/ has each picture)
//   faces.json    where each person's face is, frame by frame (positions only, never who they are); a shaky clip is
//                 steadied first (edit.mp4 becomes the steady copy, edit-unsteady.mp4 keeps the original)
//   speakers.json who speaks each word (the mouth that moves, or the microphone), or off camera
// then jobs/<job>/edit/log.md, the table of every clip to read before the paper edit.
// Finished steps are skipped when the source has not changed (--force does them again). The original files are
// never changed. A camera's Log LUT, when needed, goes beside the clip as <clip>.cube.
// Exit code 0 when every clip was ingested, 1 when one failed (the others are still done), 2 when it could not run.
import fs from 'node:fs';
import path from 'node:path';
import { AUDIO_ONLY, MEDIA, PYTHON, fingerprint, py, readJson, slug, writeJson } from './lib/common.mjs';
import { buildCutlist } from './lib/cut.mjs';
import { checkSize } from './lib/framecheck.mjs';
import { render } from './lib/log.mjs';
import { firstPaper, propose, runsOf, sentences } from './lib/paper.mjs';
import { measure } from './lib/probe.mjs';
import { transcribe } from './lib/transcribe.mjs';
import { linkRecorders, matchTone, repairClip } from './lib/repair.mjs';
import { listenBack, prepareRough, renderRough } from './lib/rough.mjs';
import { steady } from './lib/steady.mjs';
import { makeWorkingCopy } from './lib/workcopy.mjs';

const LONG = 20 * 60; // longer clips: picture quality waits for the paper edit (kept stretches only)
const say = (s) => process.stdout.write(`${s}\n`);

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--force', '--fresh', '--render', '--allow-flagged'].includes(a)) o[a.slice(2)] = true;
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
  // Phase 4: a shaky clip is steadied before its faces are found, so framing follows the steady picture.
  if (m.video && !clip.steady) {
    const q = readJson(path.join(dir, 'quality.json'), {});
    if ((q.picture?.flags || []).some((f) => f.what === 'shaky')) {
      say('  steadying (hand shake measured)');
      const r = steady(dir);
      clip.steady = { zoom: r.zoom, at: stamp() };
      py('picture', [path.join(dir, 'edit.mp4'), path.join(dir, 'quality.json'), '--shots', path.join(dir, 'shots.json')]);
      fs.rmSync(path.join(dir, 'faces.json'), { force: true }); fs.rmSync(path.join(dir, 'sheet.jpg'), { force: true });
      writeJson(cj, clip);
    }
  }
  // Faces are found on a copy up to 1280 wide (half the source's width, at least 720): small faces in a wide 4K shot
  // are lost at 720.
  if (m.video) step('faces', 'faces.json', () => { say('  finding faces'); py('faces', [dir, '--width', String(Math.min(1280, Math.max(720, Math.round(m.video.width / 2))))]); });
  if (m.video && m.audio) step('who speaks', 'speakers.json', () => { say('  working out who speaks'); py('speakers', [dir]); });
  if (m.video) step('contact sheet', 'sheet.jpg', () => { say('  making the contact sheet'); py('sheet', [dir]); });
  writeJson(cj, clip);
  return dir;
}

export function writeLog(job) {
  const root = path.join(job, 'edit', 'clips');
  const names = fs.existsSync(root) ? fs.readdirSync(root).filter((n) => fs.existsSync(path.join(root, n, 'clip.json'))).sort() : [];
  const clips = names.map((name) => {
    const d = path.join(root, name);
    return { name, clip: readJson(path.join(d, 'clip.json')), words: readJson(path.join(d, 'words.json'), null), shots: readJson(path.join(d, 'shots.json'), null), quality: readJson(path.join(d, 'quality.json'), null),
      faces: readJson(path.join(d, 'faces.json'), null), speakers: readJson(path.join(d, 'speakers.json'), null) };
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

/** The ingested clips that have a transcript, in name order. */
function spokenClips(job) {
  const root = path.join(job, 'edit', 'clips');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).sort()
    .filter((name) => !readJson(path.join(root, name, 'clip.json'), {}).linked_to) // a separate recorder's words are its camera clip's
    .map((name) => ({ name, words: readJson(path.join(root, name, 'words.json'), null)?.words })).filter((c) => c.words?.length);
}

/** Seconds a paper edit will run, before cut points are placed: the kept words plus a breath at each join. */
function roughLength(paper, job) {
  const cache = {};
  const wordsOf = (clip) => (cache[clip] ??= readJson(path.join(job, 'edit', 'clips', clip, 'words.json')).words);
  const runs = runsOf(paper, wordsOf);
  return runs.reduce((t, r) => t + (r.end - r.start), 0) + Math.max(0, runs.length - 1) * 0.4 + 0.65;
}

function paperCmd(job, o) {
  const file = path.join(job, 'edit', 'paper.json');
  const clips = spokenClips(job);
  if (!clips.length) throw new Error('No transcribed clips yet. Run: footage.mjs ingest <job>');
  const jobJson = readJson(path.join(job, 'job.json'), {});
  const energy = o.energy || jobJson.energy_preset || 'confident';
  let paper = readJson(file, null);
  if (!paper || o.fresh) paper = firstPaper(path.basename(job), clips, { energy, target: o.target ? Number(o.target) : jobJson.length_cap_seconds });
  else { paper.proposals = propose(clips, { energy: paper.energy }); say('Kept the paper edit as it is; refreshed the proposals only (--fresh starts again).'); }
  writeJson(file, paper);
  const kept = paper.blocks.filter((b) => b.words.length).length;
  say(`Paper edit: ${kept} of ${paper.blocks.length} sentences kept, about ${roughLength(paper, job).toFixed(1)} s${paper.target_seconds ? ` (target ${paper.target_seconds} s)` : ''}.`);
  const p = paper.proposals;
  say(`Hook ideas: ${p.hooks.map((h) => `"${h.text}" (${h.reasons.join(', ') || 'no strong signal'})`).join('; ')}`);
  for (const r of p.retakes) say(`Retake in ${r.clip}: ${r.reason}. Kept: "${r.texts[r.takes.indexOf(r.keep)]}"`);
  say(`Fillers struck: ${p.fillers.filter((f) => f.sure).length}; possible fillers left for a person: ${p.fillers.filter((f) => !f.sure).length}; long pauses to shorten: ${p.pauses.length}.`);
  say(`Written: ${file}. Open the transcript page to decide: node studio/server.mjs, then http://localhost:4317/paper`);
}

function cutCmd(job) {
  const cut = buildCutlist(job);
  const speech = cut.pieces.filter((p) => p.kind === 'speech').length;
  say(`Cut list: ${speech} piece${speech === 1 ? '' : 's'} of footage, ${cut.pieces.length - speech} of room tone, ${cut.duration.toFixed(2)} s.`);
  const kinds = cut.joins.reduce((m, j) => ({ ...m, [j.kind]: (m[j.kind] || 0) + 1 }), {});
  say(`Joins: ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ') || 'none'}.`);
  for (const j of cut.joins.filter((x) => x.flagged)) say(`${j.approved ? 'approved' : 'NEEDS A YES'}  ${j.key}: "…${j.before}" + "${j.next}…" (${j.reasons.join('; ')})`);
  if (cut.unanswered) say(`${cut.unanswered} join${cut.unanswered > 1 ? 's' : ''} need a person's yes (transcript page, or: footage.mjs approve <job> <key>) before the rough cut.`);
  return cut;
}

function approveCmd(job, k) {
  const file = path.join(job, 'edit', 'paper.json');
  const paper = readJson(file, null);
  if (!paper || !k) throw new Error('Usage: footage.mjs approve jobs/<job> <join key>');
  paper.approved_joins = [...new Set([...(paper.approved_joins || []), k])];
  writeJson(file, paper);
  say(`Approved ${k}.`);
}

function roughCmd(job, o) {
  const cut = cutCmd(job);
  if (cut.unanswered && !o['allow-flagged']) { say('Not made: answer the flagged joins first.'); process.exit(1); }
  const r = prepareRough(job, cut);
  say(`Rough cut ready for the engine: FootageCut "${r.slug}", ${r.seconds.toFixed(2)} s at ${r.fps} fps, ${r.width}×${r.height}.`);
  const beds = cut.room?.beds || {};
  if (Object.keys(beds).length) say(`Room evened at the cuts: ${Object.entries(beds).map(([c, b]) => `${c} gets ${b.bed}'s room tone at ${b.gainDb} dB`).join('; ')}.`);
  say(`The sound at every cut: ${path.join(job, 'edit', 'rough', 'cuts.png')} (look for bright vertical lines, dark gaps, or the background changing across a cut).`);
  const check = JSON.parse(py('sound', [path.join(job, 'edit', 'rough', 'dialogue.wav'), path.join(job, 'edit', 'rough', 'quality.json')]).trim().split('\n').pop());
  const clicks = check.summary.clicks || [];
  say(clicks.length ? `Clicks in the joined sound: ${clicks.join(', ')} s` : 'No clicks in the joined sound.');
  const lb = listenBack(job, cut);
  say(`Listened back: ${lb.matched} of ${lb.expected} kept words heard${lb.missing.length ? `; missing: ${lb.missing.join(' ')}` : ''}${lb.extra.length ? `; extra (a struck word that leaked in, or a mishearing): ${lb.extra.join(' ')}` : ''}.`);
  say('Framing, every size:'); checkFraming(job);
  if (o.render) {
    const out = renderRough(job, r.slug, path.join(job, 'out', `rough-cut${o.size ? `-${o.size.replace(':', 'x')}` : ''}.mp4`), o.size || '');
    say(`Rendered: ${out}`);
  } else say(`Render it with --render, or open it in Remotion Studio (FootageCut, cut "${r.slug}").`);
}

function repairCmd(job, o) {
  const root = path.join(job, 'edit', 'clips');
  const all = fs.existsSync(root) ? fs.readdirSync(root).filter((c) => fs.existsSync(path.join(root, c, 'sound.wav'))).sort() : [];
  if (!all.length) throw new Error('No ingested clips with sound. Run: footage.mjs ingest <job>');
  say('Separate recordings:');
  const links = linkRecorders(job, all, (x) => say(x));
  const linked = new Set(Object.values(links).flat().map((l) => l.recorder));
  const todo = all.filter((c) => !linked.has(c) && (!o.clip || o.clip === c));
  const docs = [];
  for (const c of todo) {
    say(`${c}:`);
    docs.push(repairClip(job, c, { links: links[c] || [], say: (x) => say(x) }));
  }
  if (!o.clip) { say('Tone across clips:'); matchTone(job, docs, (x) => say(x)); }
  const worse = docs.flatMap((d) => d.tracks.filter((t) => t.after.SIG < t.before.SIG - 0.05).map((t) => `${d.clip} ${t.name}`));
  say(`\nRepaired ${docs.length} clip${docs.length === 1 ? '' : 's'}: voice/ and sound.json in each.${worse.length ? ` The voice scores lower after repair in: ${worse.join(', ')}; listen before using it.` : ' No voice scores lower than before.'}`);
  say('A person listens to each voice/mix.wav before the rough cut is approved (the plan\'s one check by ear).');
}

export function checkFraming(job) {
  const rough = path.join(job, 'edit', 'rough');
  const fr = readJson(path.join(rough, 'framing.json'), null);
  if (!fr) throw new Error('No framing yet: make the rough cut first (footage.mjs rough <job>).');
  const cut = readJson(path.join(job, 'edit', 'cutlist.json'));
  const clips = Object.fromEntries(Object.entries(fr.clips).map(([c, x]) => [c, { ...x, faces: readJson(path.join(job, 'edit', 'clips', c, 'faces.json'), null), speakers: readJson(path.join(job, 'edit', 'clips', c, 'speakers.json'), null) }]));
  const SIZE = { '16:9': { w: 1920, h: 1080 }, '9:16': { w: 1080, h: 1920 }, '1:1': { w: 1080, h: 1080 }, '4:5': { w: 1080, h: 1350 } };
  const engineCut = readJson(path.join(rough, 'cut.json'), {});
  const results = Object.entries(fr.sizes).map(([name, plan]) => checkSize(name, SIZE[name], cut, plan, clips, { lines: (engineCut.sizes?.[name]?.captions || engineCut.captions || { lines: [] }).lines }));
  writeJson(path.join(rough, 'framing-check.json'), results);
  for (const r of results) say(`${r.size}: ${r.pass ? 'every check passes' : r.problems.map((p) => `${p.what} in ${Math.round(p.share * 100)}% of moments (first at ${p.first} s: ${p.detail})`).join('; ')}; most enlargement ${r.worst_enlargement}x.`);
  return results;
}

function main() {
  const o = args(process.argv.slice(2));
  const [cmd, jobArg] = o._;
  if (!cmd || !jobArg || !['ingest', 'log', 'compare', 'paper', 'cut', 'approve', 'repair', 'rough', 'check-framing'].includes(cmd)) {
    say('Usage: node tools/footage/footage.mjs ingest|log|compare|paper|cut|approve|repair|rough jobs/<job> (see the top of this file)');
    process.exit(2);
  }
  const job = path.resolve(jobArg);
  if (!fs.existsSync(job)) { say(`No job folder at ${jobArg}.`); process.exit(2); }
  if (cmd !== 'log' && !fs.existsSync(PYTHON)) { say("The footage tool's Python environment is missing. Run: bash setup/install.sh"); process.exit(2); }
  if (cmd === 'compare') { compare(job, o.clip); return; }
  if (cmd === 'paper') { paperCmd(job, o); return; }
  if (cmd === 'cut') { cutCmd(job); return; }
  if (cmd === 'approve') { approveCmd(job, o._[2]); return; }
  if (cmd === 'repair') { repairCmd(job, o); return; }
  if (cmd === 'rough') { roughCmd(job, o); return; }
  if (cmd === 'check-framing') { const r = checkFraming(job); process.exit(r.every((x) => x.pass) ? 0 : 1); }
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
