// Sound repair and dialogue (FOOTAGE-PLAN.md phase 3, sections 7.1 to 7.3 and 7.8).
//
// For each clip: its tracks (one microphone, or two on left and right, or a separate recorder lined up to the
// sample), then for each track a recipe made from what was measured, run in this order:
//   rebuild clipping, remove clicks, notch the hum, cut rumble or wind below the voice, soften pops, separate the
//   music, remove noise, reduce echo, lower breaths, soften harsh "s" sounds, even the level, one loudness.
// Separating music, removing noise and reducing echo can make a voice sound processed, so each is guarded by the
// speech-quality score (DNSMOS): tried at full strength, then lighter, and left out if every strength lowers the
// voice's score. After every clip: each voice's tone matched across clips, and a mix of the tracks.
//
// Writes edit/clips/<clip>/voice/<track>.wav, voice/mix.wav and sound.json (the recipe, each step's reason and
// result, the scores before and after). Never changes sound.wav or the original.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FFMPEG, TOOL, py, readJson, round, run, writeJson } from './common.mjs';

const DEEP_FILTER = path.join(TOOL, 'bin', process.platform === 'win32' ? 'deep-filter.exe' : 'deep-filter');
const DEMUCS = path.join(os.homedir(), '.local', 'bin', 'demucs');
export const DIALOGUE_LUFS = -20;
const GUARD = 0.05; // a repair may lower the voice's score (SIG) or the overall score by at most this much

const J = (s) => JSON.parse(String(s).trim().split('\n').pop());
const ff = (...a) => run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', ...a]);
const step = (name, args) => J(py('repair', [name, ...args]));

/** Speech stretches for the score: sentences from the words, a little room each side. Pure. */
export function speechSegments(words, gap = 0.6) {
  const out = []; let cur = null;
  for (const w of words) {
    if (cur && w.start - cur.end < gap && !/[.?!]$/.test(cur.lastText)) { cur.end = w.end; cur.lastText = w.text; continue; }
    if (cur) out.push(cur);
    cur = { start: w.start, end: w.end, lastText: w.text };
  }
  if (cur) out.push(cur);
  return out.map((s, i) => ({ id: i + 1, start: round(Math.max(0, s.start - 0.1), 3), end: round(s.end + 0.2, 3) }));
}

function score(file, segFile) {
  const r = J(py('dnsmos', [file, ...(segFile ? ['--segments', segFile] : [])]));
  const segs = r.segments?.length ? r.segments : [r.whole];
  const mean = (k) => round(segs.reduce((a, s) => a + s[k], 0) / segs.length, 3);
  return { SIG: mean('SIG'), BAK: mean('BAK'), OVRL: mean('OVRL') };
}

/** True when the repair kept the voice: its voice score and overall score did not drop by more than GUARD. Pure. */
export const kept = (before, after) => after.SIG >= before.SIG - GUARD && after.OVRL >= before.OVRL - GUARD;

function loudness(inp, out, target = DIALOGUE_LUFS) {
  const m = run(FFMPEG, ['-hide_banner', '-nostats', '-i', inp, '-af', `loudnorm=I=${target}:TP=-3:LRA=15:print_format=json`, '-f', 'null', '-'], { allowFail: true }).err;
  const j = JSON.parse(m.slice(m.lastIndexOf('{'), m.lastIndexOf('}') + 1));
  ff('-i', inp, '-af', `loudnorm=I=${target}:TP=-3:LRA=15:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s24le', out);
  return { from_lufs: Number(j.input_i), to_lufs: target };
}

/** The sound-only clips that are separate recordings of a camera clip, lined up to the sample. */
export function linkRecorders(job, clips, say = () => {}) {
  const dir = (c) => path.join(job, 'edit', 'clips', c);
  const info = Object.fromEntries(clips.map((c) => [c, readJson(path.join(dir(c), 'clip.json'))]));
  const cams = clips.filter((c) => info[c].source.measured.video && info[c].source.measured.audio);
  const recs = clips.filter((c) => !info[c].source.measured.video && info[c].source.measured.audio);
  const links = {};
  for (const r of recs) {
    let best = null;
    for (const c of cams) {
      const s = step('sync', [path.join(dir(c), 'sound.wav'), path.join(dir(r), 'sound.wav')]);
      if (!best || s.match > best.match) best = { camera: c, ...s };
    }
    // match: how alike the two sound envelopes are once lined up (1 = the same). 0.5 or more is the same moment.
    if (best && best.match >= 0.5) {
      (links[best.camera] ??= []).push({ recorder: r, lead_seconds: best.lead_seconds, match: best.match, channel: best.channel || 1, polarity: best.polarity });
      // Its words are the camera clip's words: it stays out of the paper edit.
      writeJson(path.join(dir(r), 'clip.json'), { ...info[r], linked_to: { clip: best.camera, lead_seconds: best.lead_seconds, match: best.match } });
      say(`  ${r} is a separate recording of ${best.camera}: it starts ${Math.abs(best.lead_seconds).toFixed(4)} s ${best.lead_seconds >= 0 ? 'before' : 'after'} the camera (match ${best.match})`);
    } else if (best) say(`  ${r} matches no camera clip well enough (best: ${best.camera}, match ${best.match}); repaired on its own`);
  }
  return links;
}

/** Runs one track's recipe. Returns the steps done, with their reasons and results. */
function repairTrack(t, ctx) {
  const { tmp, say } = ctx;
  const wordsFile = t.words || ctx.wordsFile;
  const words = readJson(wordsFile, { words: [] }).words;
  const segFile = path.join(tmp, `${t.name}-segments.json`);
  writeJson(segFile, speechSegments(words).length ? speechSegments(words) : readJson(ctx.segFile));
  const steps = [];
  let cur = t.source; let n = 0;
  const next = () => path.join(tmp, `${t.name}-${++n}.wav`);
  py('sound', [cur, path.join(tmp, `${t.name}-q.json`), '--words', wordsFile]);
  const q = readJson(path.join(tmp, `${t.name}-q.json`)).sound;
  const flags = new Set(q.flags.map((f) => f.what));
  const did = (name, why, result) => { steps.push({ step: name, why, ...result }); say(`    ${name}: ${why}`); };
  const before = score(cur, segFile);

  if (flags.has('clipping')) { const o = next(); ff('-i', cur, '-af', 'adeclip=window=55:overlap=75:arorder=8:threshold=10:hsize=1000:method=s', o); cur = o; did('rebuild clipping', `${q.summary.clipped_runs} flattened peaks`, {}); }
  if (flags.has('clicks')) { const o = next(); ff('-i', cur, '-af', 'adeclick=window=55:overlap=75:arorder=2:threshold=2:burst=2:method=s', o); cur = o; did('remove clicks', `${q.summary.clicks.length} clicks at ${q.summary.clicks.map((x) => `${x} s`).join(', ')}`, {}); }
  if (q.summary.hum) { const o = next(); const r = step('hum', [cur, o, String(q.summary.hum.base_hz)]); cur = o; did('remove hum', `mains hum at ${q.summary.hum.base_hz} Hz`, r); }
  { const o = next(); const r = step('lowcut', [cur, o, '--words', wordsFile, ...(flags.has('wind') ? ['--wind'] : [])]); cur = o; did('cut rumble', `below the voice's lowest notes (${r.voice_low_hz ?? '?'} Hz): cut at ${r.cut_hz} Hz${r.wind ? ', stronger for wind' : ''}`, r); }
  { const o = next(); const r = step('pops', [cur, o, '--words', wordsFile]); if (r.pops) { cur = o; did('soften pops', `${r.pops} bursts of air on "p" and "b"`, r); } }

  // Guarded repairs: each kept only if the voice still scores as well.
  const guarded = (name, why, attempts) => {
    const base = score(cur, segFile);
    for (const a of attempts) {
      const o = next();
      try { a.make(cur, o); } catch (e) { did(name, `not done: ${String(e.message).split('\n')[0]}`, { skipped: true }); return; }
      const s = score(o, segFile);
      if (kept(base, s)) { cur = o; did(name, `${why} (${a.label}; voice ${base.SIG}→${s.SIG}, background ${base.BAK}→${s.BAK}, overall ${base.OVRL}→${s.OVRL})`, { strength: a.label, before: base, after: s }); return; }
      say(`    ${name} at ${a.label} lowered the voice (${base.SIG}→${s.SIG}, overall ${base.OVRL}→${s.OVRL}): trying lighter`);
    }
    did(name, `left out: every strength lowered the voice's score`, { skipped: true, before: base });
  };
  if (flags.has('music under speech')) {
    if (!fs.existsSync(DEMUCS)) did('separate music', 'not done: Demucs is not installed (node setup/runtime/install.mjs --with demucs)', { skipped: true });
    else guarded('separate music', 'music under the voice taken out (Demucs); its rights still need checking', [{ label: 'voice only', make: (i, o) => {
      const out = path.join(tmp, `demucs-${t.name}`);
      run(DEMUCS, ['--two-stems=vocals', '-n', 'htdemucs', '-o', out, i], { env: { HF_HUB_DISABLE_TELEMETRY: '1' } });
      const v = path.join(out, 'htdemucs', path.basename(i, '.wav'), 'vocals.wav');
      ff('-i', v, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s24le', o);
    } }]);
  }
  const noisy = flags.has('noisy') || flags.has('music under speech') || (q.summary.noise_floor_db ?? -99) > -55 || before.BAK < 3.6;
  if (noisy) {
    const deep = (lim) => (i, o) => {
      // DeepFilterNet reads 16-bit or floating-point WAV, not 24-bit.
      const out = path.join(tmp, `df-${t.name}-${lim}`); fs.mkdirSync(out, { recursive: true });
      const f32 = path.join(out, 'in.wav'); ff('-i', i, '-c:a', 'pcm_f32le', f32);
      const res = path.join(out, 'res'); fs.mkdirSync(res, { recursive: true });
      run(DEEP_FILTER, ['--compensate-delay', '--atten-lim-db', String(lim), '-o', res, f32]);
      ff('-i', path.join(res, 'in.wav'), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s24le', o);
    };
    const start = (q.summary.clarity_db ?? 40) < 20 ? [100, 30, 18, 12] : (q.summary.clarity_db ?? 40) < 30 ? [30, 18, 12] : [18, 12];
    guarded('remove noise', `background ${q.summary.noise_floor_db} dBFS, voice ${q.summary.clarity_db ?? '?'} dB above it (DeepFilterNet)`, start.map((lim) => ({ label: `up to ${lim} dB quieter`, make: deep(lim) })));
  }
  if ((q.summary.echo_rt60_s ?? 0) >= 0.6) {
    let tail = null;
    guarded('reduce echo', `the room rings for about ${q.summary.echo_rt60_s} s (WPE)`, [1, 0.6, 0.35].map((s) => ({ label: `strength ${s}`, make: (i, o) => { tail = step('echo', [i, o, '--strength', String(s), '--words', wordsFile]).tail_drop_db; } })));
    const last = steps.at(-1);
    if (last?.step === 'reduce echo' && !last.skipped && tail) { last.tail_drop_db = { before: tail[0], after: tail[1] }; say(`      the tail 0.25 s after each sentence: ${tail[0]} → ${tail[1]} dB below the last syllable`); }
  }
  { const o = next(); const r = step('breaths', [cur, o, '--words', wordsFile, '--db', '8']); if (r.breaths) { cur = o; did('lower breaths', `${r.breaths} breaths lowered by 8 dB (never removed)`, r); } }
  { const sib = step('sibilance', [cur, '--words', wordsFile]); if (sib.sibilance_db > 4) { const o = next(); ff('-i', cur, '-af', 'deesser=i=0.35:m=0.5:f=0.5:s=o', o); cur = o; did('soften "s" sounds', `harsh "s" sounds (${sib.sibilance_db} dB)`, sib); } }
  const spread = step('spread', [cur, '--words', wordsFile]);
  { const o = next(); const level = spread.spread_db > 6 ? 'dynaudnorm=f=300:g=15:p=0.9:m=8,' : ''; ff('-i', cur, '-af', `${level}acompressor=threshold=-24dB:ratio=2:attack=10:release=150:makeup=1`, o); cur = o; did('even the level', spread.spread_db > 6 ? `sentences ${spread.spread_db} dB apart: quiet words lifted, then gentle compression` : 'gentle compression (2:1)', spread); }
  return { cur, steps, before, flags: [...flags] };
}

/** Repairs one clip. Returns its sound.json. */
export function repairClip(job, clip, { links = [], say = () => {} } = {}) {
  const dir = path.join(job, 'edit', 'clips', clip);
  const sound = path.join(dir, 'sound.wav');
  const wordsFile = path.join(dir, 'words.json');
  const words = readJson(wordsFile, { words: [] }).words;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `repair-${clip}-`));
  const segFile = path.join(tmp, 'segments.json');
  writeJson(segFile, speechSegments(words));
  const voice = path.join(dir, 'voice'); fs.rmSync(voice, { recursive: true, force: true }); fs.mkdirSync(voice, { recursive: true });
  try {
    const layout = step('tracks', [sound]);
    say(`  ${layout.kind}${layout.correlation !== undefined ? ` (left and right ${layout.correlation} alike)` : ''}`);
    let tracks;
    if (layout.tracks.length === 2) { step('split', [sound, tmp]); tracks = [{ name: 'ch1', source: path.join(tmp, 'ch1.wav') }, { name: 'ch2', source: path.join(tmp, 'ch2.wav') }]; }
    else { const m = path.join(tmp, 'main.wav'); ff('-i', sound, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s24le', m); tracks = [{ name: 'main', source: m }]; }
    const duration = readJson(path.join(dir, 'clip.json')).source.measured.duration;
    const notes = [];
    // Two microphones: each one's pickup of the other person is turned down.
    if (tracks.length === 2) {
      const [a, b] = tracks;
      const oa = path.join(tmp, 'ch1-bleed.wav'); const ob = path.join(tmp, 'ch2-bleed.wav');
      const ra = step('bleed', [a.source, b.source, oa]); const rb = step('bleed', [b.source, a.source, ob]);
      a.source = oa; b.source = ob;
      notes.push(`each microphone's pickup of the other voice turned down ${ra.reduced_db} dB where only the other person speaks`);
      // Each word belongs to the microphone that is louder for it: each track is measured on its own speaker.
      a.words = path.join(tmp, 'ch1-words.json'); b.words = path.join(tmp, 'ch2-words.json');
      const asg = step('assign', [a.source, b.source, wordsFile, a.words, b.words]);
      notes.push(`words by microphone: ${asg.ch1_words} on ch1, ${asg.ch2_words} on ch2`);
    }
    // A separate recorder replaces the camera microphone it was matched to (by channel), when it scores at least as
    // well on that speaker's own words.
    for (const l of links) {
      const aligned = path.join(tmp, `${l.recorder}-aligned.wav`);
      step('align', [path.join(job, 'edit', 'clips', l.recorder, 'sound.wav'), aligned, String(l.lead_seconds), String(duration)]);
      if (l.polarity === 'inverted') { const inv = path.join(tmp, `${l.recorder}-inv.wav`); ff('-i', aligned, '-af', 'volume=-1', inv); fs.renameSync(inv, aligned); }
      const target = tracks.length === 2 ? tracks[(l.channel || 1) - 1] : tracks[0];
      const own = path.join(tmp, `${target.name}-own-segments.json`);
      writeJson(own, speechSegments(readJson(target.words || wordsFile, { words: [] }).words));
      const a = score(aligned, own); const b = score(target.source, own);
      if (a.OVRL >= b.OVRL - GUARD) { notes.push(`${l.recorder} (lined up to the sample: ${l.lead_seconds} s) replaces the camera's ${target.name} microphone, scored on that speaker's words: overall ${b.OVRL}→${a.OVRL}`); target.source = aligned; target.recorder = l.recorder; }
      else notes.push(`${l.recorder} kept aside: on its speaker's words it scored lower than the camera's ${target.name} microphone (${a.OVRL} against ${b.OVRL})`);
    }
    notes.forEach((x) => say(`  ${x}`));
    const results = [];
    for (const t of tracks) {
      say(`  track ${t.name}${t.recorder ? ` (from ${t.recorder})` : ''}:`);
      const r = repairTrack(t, { tmp, wordsFile, segFile, say });
      const out = path.join(voice, `${t.name}.wav`);
      const loud = loudness(r.cur, out);
      const after = score(out, path.join(tmp, `${t.name}-segments.json`));
      if (t.words) fs.copyFileSync(t.words, path.join(voice, `${t.name}-words.json`));
      results.push({ name: t.name, recorder: t.recorder || null, flags: r.flags, steps: r.steps, loudness: loud, before: r.before, after, file: path.relative(dir, out) });
      say(`    one loudness: ${round(loud.from_lufs, 1)} → ${DIALOGUE_LUFS} LUFS. Score: voice ${r.before.SIG}→${after.SIG}, background ${r.before.BAK}→${after.BAK}, overall ${r.before.OVRL}→${after.OVRL}`);
    }
    const mix = mixTracks(dir, results.map((r) => path.join(dir, r.file)));
    const heard = hearDifference(sound, mix);
    if (heard) say(`  earshot, before and after: ${heard}`);
    const doc = { version: 1, made: new Date().toISOString(), clip, layout, notes, tracks: results, mix: 'voice/mix.wav', dialogue_lufs: DIALOGUE_LUFS, heard };
    writeJson(path.join(dir, 'sound.json'), doc);
    return doc;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

/** earshot's words for how the repaired sound differs from the original (louder, darker, cleaner...). Null without earshot. */
export function hearDifference(before, after) {
  const sh = path.join(TOOL, '..', 'audio', 'earshot.mjs');
  const r = run(process.execPath, [sh, 'ab', before, after], { allowFail: true });
  if (r.status !== 0) return null;
  const line = String(r.out).split('\n').find((l) => l.startsWith('A = '));
  if (!line) return null;
  const b = line.indexOf('B = '); const end = line.indexOf('. ', b); // file names have dots: cut after "B = <name>. "
  return (end > 0 ? line.slice(end + 2) : line).trim();
}

/** voice/mix.wav: the tracks together, at the dialogue loudness. */
export function mixTracks(dir, files) {
  const mix = path.join(dir, 'voice', 'mix.wav');
  if (files.length === 1) { fs.copyFileSync(files[0], mix); return mix; }
  const tmp = `${mix}.sum.wav`;
  ff(...files.flatMap((f) => ['-i', f]), '-filter_complex', `${files.map((_, i) => `[${i}:a]`).join('')}amix=inputs=${files.length}:normalize=0[a]`, '-map', '[a]', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s24le', tmp);
  loudness(tmp, mix); fs.rmSync(tmp, { force: true });
  return mix;
}

/**
 * Tone matching across clips (FOOTAGE-PLAN.md 7.2): clips recorded with one microphone each are taken to be the same
 * voice; each is brought to the tone of the one that scores best, when it differs by more than 1.5 dB somewhere.
 * Two-microphone clips keep their own tone per person (who is who across clips arrives with face tracking).
 */
export function matchTone(job, docs, say = () => {}) {
  const dir = (c) => path.join(job, 'edit', 'clips', c);
  const single = docs.filter((d) => d.tracks.length === 1);
  if (single.length < 2) return [];
  const ref = single.reduce((a, b) => (b.tracks[0].after.OVRL > a.tracks[0].after.OVRL ? b : a));
  const done = [];
  for (const d of single) {
    if (d === ref) continue;
    const f = path.join(dir(d.clip), d.tracks[0].file);
    const t = step('tone', [path.join(dir(ref.clip), ref.tracks[0].file), f, '--ref-words', path.join(dir(ref.clip), 'words.json'), '--words', path.join(dir(d.clip), 'words.json')]);
    if (!t.same_voice) { say(`  ${d.clip}: a different voice from ${ref.clip} (lowest notes ${t.voice_low_hz.join(' and ')} Hz), so its tone is left as it is`); continue; }
    if (t.max_change_db < 1.5) { say(`  ${d.clip}: tone already matches ${ref.clip} (within ${t.max_change_db} dB)`); continue; }
    const tmp = `${f}.eq.wav`;
    ff('-i', f, '-af', `firequalizer=gain_entry='${t.gain_entry}':gain='cubic_interpolate(f)'`, tmp);
    loudness(tmp, f); fs.rmSync(tmp, { force: true });
    d.tracks[0].tone_match = { reference: ref.clip, max_change_db: t.max_change_db, bands_db: t.bands_db };
    mixTracks(dir(d.clip), [f]);
    writeJson(path.join(dir(d.clip), 'sound.json'), d);
    say(`  ${d.clip}: tone matched to ${ref.clip} (largest change ${t.max_change_db} dB)`);
    done.push(d.clip);
  }
  return done;
}
