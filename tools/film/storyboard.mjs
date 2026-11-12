#!/usr/bin/env node
// Storyboard frames straight from the engine: the storyboard is made of the film's own frames.
//
//   storyboard.mjs <job_dir>
//
// For every shot in the job's shot list it renders one still from the film at the moment that shot
// is resting, and writes jobs/<job>/storyboard/frames.json with the notes that belong beside each
// frame (time, length, voice line, on-screen text, shot size, move, transition in, hand-off, sound,
// energy). The frames and notes are then laid out on a design canvas for approval.
//
// Run tools/film/scaffold.mjs first. Rendering cannot start inside the command sandbox, so this
// command has to be allowed to run outside it. It waits its turn if another render is running.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = path.join(STUDIO, 'engine');
const jobDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!jobDir) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }
const die = (m) => { console.error(m); process.exit(1); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const job = path.basename(jobDir);
const films = path.join(ENGINE, 'src', 'jobs');
const slug = fs.readdirSync(films).find((s) => fs.existsSync(path.join(films, s, 'film.json')) && readJson(path.join(films, s, 'film.json')).job === job);
if (!slug) die(`No film found for ${job}. Run: node tools/film/scaffold.mjs ${process.argv[2]}`);
const film = readJson(path.join(films, slug, 'film.json'));
const shots = readJson(path.join(jobDir, 'shots.json'));
const outDir = path.join(jobDir, 'storyboard'); fs.mkdirSync(outDir, { recursive: true });

// One render at a time: parallel bundles crash the bundler.
const lock = path.join(ENGINE, 'out', '.render.lock'); fs.mkdirSync(path.join(ENGINE, 'out'), { recursive: true });
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
while (true) { try { fs.mkdirSync(lock); break; } catch { sleep(2000); } }
const release = () => { try { fs.rmdirSync(lock); } catch {} };
process.on('exit', release); process.on('SIGINT', () => { release(); process.exit(1); });

const frames = [];
let number = 0;
for (const scene of film.scenes) {
  const plan = (shots.scenes || []).find((s) => s.id === scene.id) || {};
  const cues = scene.texts?.length ? scene.texts : [{ lines: [], at: 0, out: scene.end - scene.start }];
  cues.forEach((cue, i) => {
    number += 1;
    const shot = (plan.shots || [])[i] || {};
    const start = scene.start + cue.at;
    const end = Math.min(scene.end, scene.start + (cue.out ?? scene.end - scene.start));
    const at = start + (end - start) * 0.6;                       // well after it has landed, before it leaves
    const frame = Math.min(Math.round(at * film.fps), Math.round(film.duration * film.fps) - 1);
    const png = path.join(outDir, `shot-${String(number).padStart(2, '0')}.png`);
    const jpg = png.replace('.png', '.jpg');
    const r = spawnSync('npx', ['remotion', 'still', slug, png, `--frame=${frame}`, '--scale=0.6667', '--log=error'], { cwd: ENGINE, encoding: 'utf8' });
    if (r.status !== 0 || !fs.existsSync(png)) die(`Could not render shot ${number} (frame ${frame}).\n${(r.stderr || r.stdout || '').slice(-600)}`);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-q:v', '3', jpg]); fs.unlinkSync(png);
    const said = (scene.lines || []).filter((l) => l.start < end && l.end > start).map((l) => l.text.replace(/\[[^\]]*\]/g, '').trim());
    frames.push({
      shot: number, scene: scene.id, scene_title: scene.title, file: `storyboard/${path.basename(jpg)}`,
      start: +start.toFixed(2), length: +(end - start).toFixed(2), shown_at: +at.toFixed(2),
      voice: said, on_screen_text: (cue.lines || []).join(' / ').replace(/\*/g, ''),
      shot_size: shot.size || null, focal_point: shot.focal_point || null, move: shot.move || null, sound: shot.sound || null,
      transition_in: i === 0 && plan.transition_in ? `${plan.transition_in.number} (${plan.transition_in.name})` : null,
      hand_off: i === 0 ? plan.hand_off || null : null, energy: scene.energy ?? null, capture: shot.capture || null,
    });
    console.log(`shot ${number}: ${scene.id} at ${at.toFixed(2)} s`);
  });
}
fs.writeFileSync(path.join(outDir, 'frames.json'), JSON.stringify({ job, brand: film.brand ?? null, duration: film.duration, frames }, null, 1));
console.log(`${frames.length} frames and frames.json written to ${path.relative(STUDIO, outDir)}`);
