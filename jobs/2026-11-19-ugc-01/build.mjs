#!/usr/bin/env node
// Builds everything a render of this job needs, from events.json, audio/script.json and edit/grade.json. No network, no voice, no paid provider.
//   node jobs/2026-11-19-ugc-01/build.mjs [--skip-mix]
// 1 audio: silent placeholder voice, lines.json, the caption file the scenes draw, the sound cues (sfx.json) placed from events.json, the room-tone bed, mix.py, empty shared captions
// 2 grade: the three stills graded ONCE from edit/grade.json into engine/public/jobs/ugc-01/graded (the preview and the export both read these)
// 3 scaffold (through a link named ugc-01 so the engine name is ugc-01), then fps 30 and 16.0 s into film.json
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '../..');
const JOB = HERE;
const A = path.join(JOB, 'audio');
const PUB = path.join(STUDIO, 'engine/public/jobs/ugc-01');
const FF = fs.existsSync('/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg') ? '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg' : 'ffmpeg';
const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: STUDIO, ...opts }); if (r.status !== 0 && !opts.allow) { console.error(r.stdout, r.stderr); process.exit(r.status || 1); } return r; };
const events = JSON.parse(fs.readFileSync(path.join(JOB, 'events.json'), 'utf8'));
const script = JSON.parse(fs.readFileSync(path.join(A, 'script.json'), 'utf8'));
const round = (n) => Math.round(n * 1000) / 1000;
const FPS = events.fps;
// every event is a whole frame
for (const [k, v] of Object.entries(events)) if (typeof v === 'number' && k !== 'fps' && Math.abs(v * FPS - Math.round(v * FPS)) > 1e-6) { console.error(`events.${k} = ${v} is not a whole frame at ${FPS} fps`); process.exit(1); }

// ------------------------------------------------ 1 audio
const SECONDS = events.end;
const VOICE = SECONDS - 0.5; // mix.py --tail 0.5 makes the mix exactly SECONDS long
fs.mkdirSync(path.join(A, 'sfx'), { recursive: true });
sh(FF, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono`, '-t', String(VOICE), '-c:a', 'pcm_s16le', path.join(A, 'voice.wav')]);
fs.writeFileSync(path.join(A, 'lines.json'), JSON.stringify(script.map(({ id, start, end, text }) => ({ id, start, end, text })), null, 1) + '\n');

// captions the scenes draw (word times spread over the line by letters: placeholder timing, there is no voice)
const captionLines = script.filter((l) => !l.offer).map((l) => {
  const words = l.text.split(/\s+/);
  const wanted = (l.highlight || '').toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean);
  const bare = (w) => w.toLowerCase().replace(/[^a-z]/g, '');
  const at = words.findIndex((_, i) => wanted.length && wanted.every((w, k) => words[i + k] && bare(words[i + k]) === w));
  if (words.length > 7) throw new Error(`caption "${l.text}" has more than 7 words`);
  const weights = words.map((w) => w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  let t = l.start;
  const span = (l.end - l.start) * 0.8;
  return { start: l.start, end: l.end, words: words.map((text, i) => { const s = t; t += (span * weights[i]) / total; return { text, start: round(s), end: round(t), ...(at >= 0 && i >= at && i < at + wanted.length ? { highlight: true } : {}) }; }) };
});
fs.mkdirSync(PUB, { recursive: true });
fs.writeFileSync(path.join(A, 'ugc-captions.json'), JSON.stringify({ lines: captionLines }, null, 1) + '\n');
fs.writeFileSync(path.join(A, 'captions.json'), JSON.stringify({ lines: [] }) + '\n'); // the shared pill sits at 57-65% of the height; the scenes draw the 82-93% band themselves

// sound cues: each placed so its first audible sample lands on the frame of its cause
const LIB = path.join(STUDIO, 'library/sounds');
const onsetOf = (file) => { // seconds before the sound first rises above 6% of its own peak
  const r = spawnSync(FF, ['-v', 'error', '-i', file, '-ac', '1', '-ar', '48000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const s = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 2));
  let peak = 0; for (const v of s) peak = Math.max(peak, Math.abs(v));
  const i = s.findIndex((v) => Math.abs(v) > peak * 0.06);
  return i / 48000;
};
const sec = (n) => round(n);
const riserLen = 1.497;
const cues = [
  { id: 'phone-buzz', library: 'foley/phone-buzz-table-01', cause: events.commentIn, gain: 0.6, because: 'the phone buzzes as the comment card arrives (frame 0)' },
  { id: 'impact-soft', library: 'impact/thud-01', cause: events.captionHook, gain: 0.55, because: 'the first caption line lands' },
  { id: 'riser-short', library: 'riser/smooth-swell-01', cause: events.cutDemo - riserLen, gain: 0.3, because: 'the push in speeds up into the cut (ends on the cut)' },
  { id: 'finger-tap-like', library: 'click/finger-tap-glass-02', cause: events.commentLike, gain: 0.55, because: 'a finger taps the comment\'s heart' },
  { id: 'whip', library: 'swish/whip-01', cause: events.cutDemo, gain: 0.5, because: 'the hard cut to the demo' },
  { id: 'finger-tap', library: 'click/finger-tap-glass-01', cause: events.click, gain: 0.6, because: 'the tap on the sidebar item (the tap ripple opens)' },
  { id: 'small-whoosh', library: 'whoosh/air-soft-01', cause: events.cameraFollow, gain: 0.35, because: 'the camera starts to follow the pointer' },
  { id: 'toast-pop', library: 'pop/soft-pop-01', cause: events.hover, gain: 0.5, because: 'the glow opens on New' },
  { id: 'text-swish', library: 'swish/paper-soft-01', cause: events.captionProof, gain: 0.4, because: 'the proof caption arrives' },
  { id: 'success-chime', library: 'interface/success-glass-01', cause: events.ring, gain: 0.45, because: 'the ring appears on the board title' },
  { id: 'offer-sting', library: 'chime/sting-bright-synth-04', cause: events.offer, gain: 0.55, because: 'the offer line lands' },
  { id: 'logo-sting', library: 'chime/sting-warm-synth-01', cause: events.logo, gain: 0.5, because: 'the wordmark appears' },
].map((c) => {
  const onset = c.id === 'riser-short' ? 0 : onsetOf(path.join(LIB, `${c.library}.mp3`));
  return { ...c, onset: round(onset), at: sec(Math.max(0, c.cause - onset)) };
});
for (let i = 0; i < cues.length; i++) for (let j = i + 1; j < cues.length; j++) if (cues[i].library.split('/')[0] === cues[j].library.split('/')[0] && Math.abs(cues[i].cause - cues[j].cause) < 0.3) throw new Error(`two sounds of a kind within 0.3 s: ${cues[i].id}, ${cues[j].id}`);
fs.writeFileSync(path.join(A, 'sfx.json'), JSON.stringify(cues.map(({ id, library, at, gain }) => ({ id, library, at, gain })), null, 1) + '\n');
fs.writeFileSync(path.join(A, 'cues.json'), JSON.stringify(cues, null, 1) + '\n'); // with the cause of each

// the room-tone bed, exactly the film's length, as mix.py's "music" input (card: low under the whole film)
sh(FF, ['-v', 'error', '-y', '-i', path.join(LIB, 'ambience/room-clean-01.mp3'), '-t', String(SECONDS), '-c:a', 'libmp3lame', '-q:a', '2', path.join(A, 'music.mp3')]);

if (!process.argv.includes('--skip-mix')) {
  const mixArgs = (process.env.MIX_ARGS || '--tail 0.5 --ref-db -20 --under 0.3').split(/\s+/);
  const r = sh('python3', [path.join(STUDIO, 'tools/audio/mix.py'), JOB, ...mixArgs], { allow: true });
  process.stdout.write(r.stdout); process.stderr.write(r.stderr);
  if (r.status !== 0 && !/OUT OF RANGE/.test(r.stdout)) process.exit(r.status);
  // Headroom, fixed here in the mix (tools/audio/master.sh is not touched). The effects are short and sparse, so left alone
  // they sit about 20 dB above the film's average loudness; master.sh then lifts the film to -14 LUFS and its limiter has to
  // flatten them (true peak -0.8 to -1.0 dBTP, over the -1.1 this job holds itself to). So the effects stem gets a gentle
  // compressor (-26 dB, 4:1, +9 dB make-up) and a look-ahead limiter at 0.4 (-8 dBFS), and the clean room bed sits 10 dB under
  // the stem mix.py wrote, which keeps it a quiet room (about -31 LUFS once mastered) well under the effects.
  const stems = path.join(A, 'stems');
  sh(FF, ['-v', 'error', '-y', '-i', path.join(stems, 'voice.wav'), '-i', path.join(stems, 'sfx.wav'), '-i', path.join(stems, 'music.wav'), '-filter_complex',
    `[1:a]acompressor=threshold=-26dB:ratio=4:attack=3:release=90:makeup=9dB,alimiter=limit=0.4:attack=3:release=50:level=disabled[s];[2:a]volume=-10dB[m];[0:a][s][m]amix=inputs=3:normalize=0:duration=longest,atrim=0:${SECONDS}`,
    '-ar', '48000', '-c:a', 'pcm_s16le', path.join(A, 'mix.wav')]);
}

// ------------------------------------------------ 2 grade (once; preview and export both read these)
const stills = 'jobs/_tulvo-capture-test/capture/boards/take-5/marks';
const sources = { 'demo-1': `${stills}/lead-pipeline.png`, 'demo-2': `${stills}/campaign-board.png`, 'demo-3': `${stills}/campaign-board-new.png` };
const { applyGrade } = await import(path.join(STUDIO, 'tools/footage/lib/grade.mjs'));
const written = applyGrade(JOB, Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, path.join(STUDIO, v)])), path.join(PUB, 'graded'));
for (const w of written) console.log(`graded ${w.clip}: ${JSON.stringify(w.recipe)}`);
fs.copyFileSync(path.join(JOB, 'events.json'), path.join(PUB, 'events.json'));
fs.copyFileSync(path.join(A, 'ugc-captions.json'), path.join(PUB, 'ugc-captions.json'));

// ------------------------------------------------ 3 scaffold as "ugc-01", then fps 30 / 16.0 s
const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ugc-')), 'ugc-01');
fs.symlinkSync(JOB, link);
const r = sh('node', [path.join(STUDIO, 'tools/film/scaffold.mjs'), link], { allow: true });
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
if (r.status !== 0) process.exit(r.status);
// scaffold lists every folder in engine/src/jobs, including the hand-built rubik-ep1 (no `job` export); leave the shared index as it was
sh('git', ['checkout', '--', 'engine/src/jobs/index.ts']);
const filmFile = path.join(STUDIO, 'engine/src/jobs/ugc-01/film.json');
const film = JSON.parse(fs.readFileSync(filmFile, 'utf8'));
film.job = path.basename(JOB);
film.fps = FPS;
film.duration = SECONDS;
film.scenes.at(-1).end = SECONDS;
fs.writeFileSync(filmFile, JSON.stringify(film, null, 1) + '\n');
console.log(`film.json: ${film.width}x${film.height} at ${film.fps} fps, ${film.duration} s; scenes ${film.scenes.map((s) => `${s.id} ${s.start}-${s.end}`).join(', ')}`);
