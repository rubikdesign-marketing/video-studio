#!/usr/bin/env node
// Checks phase 3 (sound repair and dialogue) on the synthetic test job (FOOTAGE-PLAN.md phase 3 test).
//
//   node tools/footage/tests/make_clips.mjs <job>        (outside Claude's command sandbox: the Mac's voice)
//   node tools/footage/footage.mjs ingest <job>
//   node tools/footage/footage.mjs repair <job>
//   node tools/footage/footage.mjs paper <job> --fresh && node tools/footage/footage.mjs rough <job>
//   node tools/footage/tests/check_repair.mjs <job>
//
// What it checks against the clips' known contents: the separate recorder found and lined up to the millisecond and
// used for its speaker; the two microphones split and each word on the right one; the two speakers brought to the
// same loudness; the noisy clip's clipping, clicks, hum and music gone and its scores up; the echoey room's tail
// shorter; the clean clip left alone; no voice's score lowered; and the rough cut from the repaired voices whole.
import path from 'node:path';
import { FFMPEG, PYTHON, STUDIO, readJson, run } from '../lib/common.mjs';

const job = path.resolve(process.argv[2] || '');
const truth = readJson(path.join(job, 'truth.json'), null);
if (!truth) { console.log(`No truth.json in ${job}.`); process.exit(2); }
const dir = (c) => path.join(job, 'edit', 'clips', c);
const sj = (c) => readJson(path.join(dir(c), 'sound.json'), null);
let bad = 0;
const check = (ok, what, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`); };
const py = (script, args) => JSON.parse(String(run(PYTHON, ['-I', path.join(STUDIO, 'tools', 'footage', 'py', script), ...args])).trim().split('\n').pop());
const lufs = (f) => Number((run(FFMPEG, ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128', '-f', 'null', '-'], { allowFail: true }).err.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)[0]);

// The separate recorder
{
  const lav = readJson(path.join(dir('interview-lav'), 'clip.json')).linked_to;
  check(lav?.clip === 'interview' && Math.abs(lav.lead_seconds - truth['interview-lav'].leadSeconds) < 0.001, 'the separate recorder is found and lined up within 1 ms', lav ? `${lav.lead_seconds} s against ${truth['interview-lav'].leadSeconds} s` : 'not linked');
  const ch1 = sj('interview').tracks.find((t) => t.name === 'ch1');
  check(ch1?.recorder === 'interview-lav', 'the recorder is used for its speaker (the left microphone)');
}
// Two microphones
{
  const d = sj('interview');
  check(d.layout.kind === 'two microphones', 'two microphones found in the interview', d.layout.kind);
  const a = readJson(path.join(dir('interview'), 'voice', 'ch1-words.json')).words.map((w) => w.text).join(' ').toLowerCase();
  const b = readJson(path.join(dir('interview'), 'voice', 'ch2-words.json')).words.map((w) => w.text).join(' ').toLowerCase();
  check(a.includes('thanks for joining') && b.includes('changed how we plan') && !a.includes('changed how') && !b.includes('thanks for'), 'each speaker\'s words are on their own microphone');
  const la = lufs(path.join(dir('interview'), 'voice', 'ch1.wav')); const lb = lufs(path.join(dir('interview'), 'voice', 'ch2.wav'));
  check(Math.abs(la - lb) < 1, `the two speakers brought to one loudness (they were ${truth.interview.levelGapDb} dB apart)`, `${la} and ${lb} LUFS`);
}
// The noisy clip
{
  const d = sj('noisy'); const t = d.tracks[0];
  const steps = t.steps.filter((s) => !s.skipped).map((s) => s.step);
  for (const s of ['rebuild clipping', 'remove clicks', 'remove hum', 'separate music', 'remove noise']) check(steps.includes(s), `noisy: ${s}`);
  const q = path.join(job, 'edit', '.check-noisy.json');
  py('sound.py', [path.join(dir('noisy'), 'voice', 'mix.wav'), q, '--words', path.join(dir('noisy'), 'words.json')]);
  const after = readJson(q).sound;
  const left = after.flags.map((f) => f.what).filter((w) => ['clipping', 'clicks', 'hum', 'music under speech', 'noisy'].includes(w));
  check(!left.length, 'noisy: none of its sound problems measured after repair', left.join(', ') || 'none left');
  check(t.after.OVRL >= t.before.OVRL + 0.3 && t.after.BAK >= t.before.BAK + 0.5, 'noisy: overall and background scores clearly up', `overall ${t.before.OVRL}→${t.after.OVRL}, background ${t.before.BAK}→${t.after.BAK}`);
}
// The echoey room
{
  const t = sj('echo').tracks[0];
  check(t.steps.some((s) => s.step === 'reduce echo' && !s.skipped), 'echo: the room\'s echo reduced');
  const td = t.steps.find((x) => x.step === 'reduce echo')?.tail_drop_db || {};
  const before = td.before ?? 0; const after = td.after ?? 0;
  check(after - before >= 3, 'echo: the echo step leaves the tail 0.25 s after each sentence at least 3 dB quieter', `${before.toFixed(1)} → ${after.toFixed(1)} dB below the last syllable`);
}
// The clean clip, and the guard everywhere
{
  const t = sj('talking').tracks[0];
  check(!t.steps.some((s) => ['separate music', 'remove noise', 'reduce echo'].includes(s.step) && !s.skipped), 'talking (clean): no heavy repair applied');
  const lowered = ['echo', 'interview', 'noisy', 'talking'].flatMap((c) => sj(c).tracks.filter((x) => x.after.SIG < x.before.SIG - 0.05).map((x) => `${c} ${x.name}`));
  check(!lowered.length, 'no voice scores lower after repair', lowered.join(', ') || 'none');
}
// The rough cut from the repaired voices
{
  const lb = readJson(path.join(job, 'edit', 'rough', 'listen-back.json'), null);
  check(lb && !lb.missing.length && !lb.extra.length, 'the rough cut from the repaired voices: every kept word heard, nothing struck heard', lb ? `${lb.matched} of ${lb.expected}` : 'no rough cut');
  const q = readJson(path.join(job, 'edit', 'rough', 'quality.json'), null);
  check(q && !q.sound.summary.clicks.length, 'no clicks in the joined sound');
  const cut = readJson(path.join(job, 'edit', 'cutlist.json'));
  check(Object.values(cut.room?.beds || {}).every((b) => Math.abs(b.gainDb) <= 12), 'the room evened at the cuts within 12 dB', JSON.stringify(cut.room?.floors_dbfs));
}
console.log(bad ? `\n${bad} check${bad > 1 ? 's' : ''} failed.` : '\nAll checks passed.');
process.exit(bad ? 1 : 0);
