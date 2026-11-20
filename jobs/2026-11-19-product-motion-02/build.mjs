#!/usr/bin/env node
// Builds what a render of this job needs: the graded recording, the sound, the public files. No network, no paid provider.
// Copied from the pattern of jobs/2026-11-19-ugc-01/build.mjs (audio from events.json cues, mix.py, a gentle compressor on the effects stem), but
// the picture is a graded VIDEO clip (tools/footage/lib/grade.mjs gradeClip after workcopy.mjs makeWorkingCopy) and not graded stills.
//   node jobs/2026-11-19-product-motion-02/build.mjs [--skip-mix]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '../..');
const JOB = HERE;
const A = path.join(JOB, 'audio');
const PUB = path.join(STUDIO, 'engine/public/jobs/product-motion-02');
const FF = fs.existsSync('/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg') ? '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg' : 'ffmpeg';
const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: STUDIO, ...opts }); if (r.status !== 0 && !opts.allow) { console.error(r.stdout, r.stderr); process.exit(r.status || 1); } return r; };
const events = JSON.parse(fs.readFileSync(path.join(JOB, 'events.json'), 'utf8'));
const round = (n) => Math.round(n * 1000) / 1000;
const FPS = events.fps;
for (const [k, v] of Object.entries(events)) if (typeof v === 'number' && k !== 'fps' && Math.abs(v * FPS - Math.round(v * FPS)) > 1e-6) { console.error(`events.${k} = ${v} is not a whole frame at ${FPS} fps`); process.exit(1); }

// ------------------------------------------------ 1 picture: working copy, then the grade, once; preview and export both read this file
const { measure } = await import(path.join(STUDIO, 'tools/footage/lib/probe.mjs'));
const { makeWorkingCopy } = await import(path.join(STUDIO, 'tools/footage/lib/workcopy.mjs'));
const { gradeClip, loadGrade, recipeFor, gradeFilter } = await import(path.join(STUDIO, 'tools/footage/lib/grade.mjs'));
const source = path.join(JOB, 'edit/recording-source.mp4');
const work = path.join(JOB, 'edit/work');
const m = measure(source);
const said = makeWorkingCopy(source, m, work);
const recipe = recipeFor(loadGrade(JOB), 'take-5');
const dest = path.join(PUB, 'capture/take-5/recording.mp4');
fs.mkdirSync(path.dirname(dest), { recursive: true });
gradeClip(path.join(work, 'edit.mp4'), dest, recipe);
console.log(`graded take-5: ${JSON.stringify(recipe)} (${gradeFilter(recipe) ? 'filter on' : 'neutral'}); working copy said: ${JSON.stringify(said)}`);
fs.copyFileSync(path.join(JOB, 'events.json'), path.join(PUB, 'events.json'));
fs.writeFileSync(path.join(PUB, 'captions.json'), JSON.stringify({ lines: [] }) + '\n');

// ------------------------------------------------ 2 sound: each effect placed so its first audible sample lands on the frame of its cause
const SECONDS = events.end;
const VOICE = SECONDS - 0.5; // mix.py --tail 0.5 makes the mix exactly SECONDS long
const LIB = path.join(STUDIO, 'library/sounds');
fs.mkdirSync(path.join(A, 'sfx'), { recursive: true });
sh(FF, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(VOICE), '-c:a', 'pcm_s16le', path.join(A, 'voice.wav')]);
// mix.py divides by the voice's speech time, so a film with no line at all stops with ZeroDivisionError (found by verifier-4): a placeholder line keeps it running. It is not shown anywhere.
fs.writeFileSync(path.join(A, 'lines.json'), JSON.stringify([{ id: '01', start: 0.3, end: 3.8, text: 'placeholder line, not shown' }], null, 1) + '\n');
const onsetOf = (file) => {
  const r = spawnSync(FF, ['-v', 'error', '-i', file, '-ac', '1', '-ar', '48000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const s = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
  let peak = 0; for (const v of s) peak = Math.max(peak, Math.abs(v));
  return s.findIndex((v) => Math.abs(v) > peak * 0.06) / 48000;
};
const cues = [
  { id: 'success-chime', library: 'interface/success-glass-01', cause: events.ringFirstFrame / FPS, gain: 0.45, because: 'the ring appears on the board title' },
].map((c) => { const onset = onsetOf(path.join(LIB, `${c.library}.mp3`)); return { ...c, onset: round(onset), at: round(Math.max(0, c.cause - onset)) }; });
fs.writeFileSync(path.join(A, 'sfx.json'), JSON.stringify(cues.map(({ id, library, at, gain }) => ({ id, library, at, gain })), null, 1) + '\n');
fs.writeFileSync(path.join(A, 'cues.json'), JSON.stringify(cues, null, 1) + '\n');
sh(FF, ['-v', 'error', '-y', '-i', path.join(LIB, 'ambience/room-clean-01.mp3'), '-t', String(SECONDS), '-c:a', 'libmp3lame', '-q:a', '2', path.join(A, 'music.mp3')]);
if (!process.argv.includes('--skip-mix')) {
  const mixArgs = (process.env.MIX_ARGS || '--tail 0.5 --ref-db -20 --under 0.3').split(/\s+/);
  const r = sh('python3', [path.join(STUDIO, 'tools/audio/mix.py'), JOB, ...mixArgs], { allow: true });
  process.stdout.write(r.stdout); process.stderr.write(r.stderr);
  if (r.status !== 0 && !/OUT OF RANGE/.test(r.stdout)) process.exit(r.status);
  const stems = path.join(A, 'stems');
  sh(FF, ['-v', 'error', '-y', '-i', path.join(stems, 'voice.wav'), '-i', path.join(stems, 'sfx.wav'), '-i', path.join(stems, 'music.wav'), '-filter_complex',
    `[1:a]acompressor=threshold=-26dB:ratio=4:attack=3:release=90:makeup=9dB,alimiter=limit=0.4:attack=3:release=50:level=disabled[s];[2:a]volume=-10dB[m];[0:a][s][m]amix=inputs=3:normalize=0:duration=longest,atrim=0:${SECONDS}`,
    '-ar', '48000', '-c:a', 'pcm_s16le', path.join(A, 'mix.wav')]);
}
fs.copyFileSync(path.join(A, 'mix.wav'), path.join(PUB, 'audio.wav'));
