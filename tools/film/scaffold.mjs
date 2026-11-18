#!/usr/bin/env node
// Turns a job's approved shot list into a film skeleton the engine can render.
//
//   scaffold.mjs <job_dir>          build or refresh the skeleton
//   scaffold.mjs --slug <job_dir>   only print the job's name inside the engine
//
// Reads   job.json, shots.json (templates/shots.json), audio/lines.json, audio/captions.json, audio/words.json (for shots
//         that name their "word")
//         The brand is job.json "brand", else studio.json "default_brand". Brands are refreshed first (tools/brand/sync.mjs).
// Writes  engine/src/jobs/<slug>/film.json        the brand, and scene times fitted to the voice
//         engine/src/jobs/<slug>/Film.tsx         the brand, the scenes in order, the sound, the captions
//         engine/src/jobs/<slug>/scenes/S01.tsx   one placeholder per scene, ONLY if the file is not there yet
//         engine/src/jobs/index.ts                registers every scaffolded job with the engine
//         engine/public/jobs/<slug>/              audio.wav (audio/mix.wav, else audio/voice.wav) and captions.json
//
// A shot arrives with the voice line it names ("line"), else with the words it names ("word": the first words it lands on,
// timed from audio/words.json; words respelled for the voice in the brand's pronunciation.md match their real spelling),
// else with the scene's line at its position. In a scene where any shot names a word, shots naming neither share the time between.
// Run it again whenever the voice or the shot list changes: everything is refreshed except scene files.
// A scene starts LEAD before its first voice line and ends where the next one starts. Options: --lead 0.3 --tail 0.5
// A silent scene ("silent": true, "seconds": 2.5) has no voice line, such as an end card. It can only come at the
// end: it starts where the film used to end, after the sound, and adds its seconds to the film.
// A film with no voice at all (job.json "voice": "none": music and type, a footage edit, an animated short) is timed
// from each scene's "seconds" instead, end to end from 0. It needs no lines.json or captions.json; its sound is
// audio/mix.wav, else audio/music.wav, else silence of the film's length.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { brandDir, brandOfJob } from '../brand/lib.mjs';
import { syncBrands } from '../brand/sync.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE_JOBS = path.join(STUDIO, 'engine/src/jobs');
const FPS = 60;
const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
const PRESETS = ['calm', 'confident', 'hype'];
const STAGES = ['light', 'dark'];
const OLD_STAGE_NAMES = { paper: 'light', night: 'dark' }; // shot lists written before stages were named by role
const SHOT_SIZES = ['wide', 'medium', 'macro', 'abstract'];
const TEXT_CLEAR = 0.35; // on-screen text leaves this long before the next shot with other text or none, or before its scene ends
const MIN_TEXT = 0.6; // on-screen text that stays less long than this, in seconds, gets a warning
const END_CARD = [1.5, 6]; // a silent end card shorter or longer than this, in seconds, gets a warning

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? Number(args.splice(i, 2)[1]) : fallback; };
const LEAD = option('lead', 0.3); // a scene starts this long before its first voice line
const TAIL = option('tail', 0.5); // the film runs this long after the sound ends

const die = (msg) => { console.error(msg); process.exit(1); };
const warn = (msg) => console.warn('  check: ' + msg);
let VOICELESS = false; // set from job.json below; read by readScenes
const readJson = (file, hint = '') => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : die(`Missing ${file}. ${hint}`));
const round = (seconds) => Math.round(seconds * 1000) / 1000;
const stamp = (seconds) => seconds.toFixed(2);
const rel = (file) => path.relative(STUDIO, file);

/** The job's name inside the engine. Composition names allow only letters, digits and hyphens. */
function slugOf(jobDir) {
  const slug = path.basename(path.resolve(jobDir)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || die(`Cannot make an engine name from the folder "${jobDir}".`);
}

function soundLength(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const length = parseFloat(probe.stdout);
  return Number.isFinite(length) ? length : die(`Could not measure ${file} with ffprobe.`);
}

/** Technique numbers in the transitions catalogue. */
function transitionNumbers() {
  const catalogue = fs.readFileSync(path.join(STUDIO, 'knowledge/craft/03-transitions.md'), 'utf8');
  return [...catalogue.matchAll(/^\| (\d+) \|/gm)].map((row) => Number(row[1]));
}

/** A word reduced to its letters and digits, for comparing. */
const bare = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** The brand's pronunciation table as a map from the respelled word to its real spelling, both bare. */
function respellings(brand) {
  const file = path.join(brandDir(brand), 'pronunciation.md');
  if (!fs.existsSync(file)) return new Map();
  return new Map(fs.readFileSync(file, 'utf8').split('\n').map((row) => row.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 4 && cells[2] && cells[1] !== 'Word' && !/^-+$/.test(cells[1]))
    .map((cells) => [bare(cells[2]), bare(cells[1])]));
}

/** Where a phrase is first spoken in the given lines, at or after word number `from`: { index, start } or null. */
function findWords(words, phrase, lineIds, from, respell) {
  const wanted = phrase.split(/\s+/).map(bare).filter(Boolean);
  const said = (word) => { const b = bare(word.w); return [b, respell.get(b)]; };
  if (!wanted.length) return null;
  for (let i = from; i < words.length; i++) {
    const run = words.slice(i, i + wanted.length);
    if (run.length === wanted.length && run.every((word, k) => lineIds.includes(word.line) && said(word).includes(wanted[k]))) return { index: i, start: words[i].s };
  }
  return null;
}

/** Checks the shot list against the voice and returns its scenes with their voice lines attached. */
function readScenes(shots, voiceLines, jobDir, words = [], respell = new Map()) {
  if (!Array.isArray(shots.scenes) || !shots.scenes.length) die('shots.json has no scenes.');
  const known = transitionNumbers();
  const used = [];
  const scenes = shots.scenes.map((scene, i) => {
    const where = `shots.json, scene ${scene.id ?? i + 1}`;
    if (!/^S\d\d$/.test(scene.id ?? '')) die(`${where}: the id must look like S01.`);
    const silent = scene.silent === true || VOICELESS;
    if (scene.silent !== undefined && typeof scene.silent !== 'boolean') die(`${where}: "silent" must be true or false.`);
    if (silent) {
      if (scene.lines?.length) die(`${where}: a silent scene has no voice lines. Remove "lines", or remove "silent".`);
      if (typeof scene.seconds !== 'number' || !(scene.seconds > 0)) die(`${where}: a silent scene needs "seconds", how long it stays on screen, for example 2.5.`);
      if (!VOICELESS && scene.seconds < END_CARD[0]) warn(`${scene.id}: the silent end card lasts ${scene.seconds} s. Under ${END_CARD[0]} s is too quick to read a logo and a web address.`);
      if (!VOICELESS && scene.seconds > END_CARD[1]) warn(`${scene.id}: the silent end card lasts ${scene.seconds} s. Over ${END_CARD[1]} s of silence feels like the video has stalled.`);
    } else {
      if (scene.seconds !== undefined) die(`${where}: "seconds" is only for silent scenes. A scene with voice takes its length from the voice.`);
      if (!Array.isArray(scene.lines) || !scene.lines.length) die(`${where}: "lines" must name at least one voice line, or mark the scene "silent": true with "seconds".`);
    }
    if (!Number.isInteger(scene.energy) || scene.energy < 1 || scene.energy > 5) die(`${where}: "energy" must be a whole number from 1 to 5.`);
    if (!Array.isArray(scene.shots) || !scene.shots.length) die(`${where}: it needs at least one shot.`);
    const lines = (scene.lines ?? []).map((id) => voiceLines.find((line) => line.id === id) ?? die(`${where}: voice line "${id}" is not in audio/lines.json.`));
    used.push(...lines.map((line) => line.id));
    let searchFrom = 0; // a shot's words are looked for after the words of the shot before it
    for (const shot of scene.shots) {
      if (shot.word !== undefined) {
        const found = findWords(words, shot.word, shot.line ? [shot.line] : scene.lines ?? [], searchFrom, respell);
        if (!found) die(`${where}: shot ${shot.frame ?? ''} names the word "${shot.word}", which is not spoken in ${shot.line ? 'line ' + shot.line : 'the scene\'s lines'} after the shot before it (audio/words.json).`);
        shot.wordAt = found.start;
        searchFrom = found.index + 1;
      }
      if (!SHOT_SIZES.includes(shot.size)) die(`${where}: shot size "${shot.size}" must be one of ${SHOT_SIZES.join(', ')}.`);
      if (shot.line && silent) die(`${where}: a shot names voice line "${shot.line}", but the scene is silent.`);
      if (shot.line && !scene.lines.includes(shot.line)) die(`${where}: a shot names voice line "${shot.line}", which the scene does not cover.`);
      if ((shot.text ?? '').split(/\s+/).filter(Boolean).length > 7) warn(`${scene.id}: "${shot.text}" is more than seven words.`);
      if ((shot.text ?? '').split('\n').length > 2) warn(`${scene.id}: on-screen text has more than two clauses; only the first two are shown.`);
      if (shot.capture && !fs.existsSync(path.join(jobDir, shot.capture))) warn(`${scene.id}: capture file ${shot.capture} is not in the job folder.`);
    }
    const number = scene.transition_in?.number;
    if (i > 0 && !known.includes(number)) warn(`${scene.id}: transition_in needs a number from knowledge/craft/03-transitions.md.`);
    if (i > 1 && number === shots.scenes[i - 1].transition_in?.number) warn(`${scene.id}: same transition as the scene before it.`);
    return { ...scene, silent, lines };
  });
  // Silent scenes only at the end: the sound is one track that starts with the film, so a gap cannot open inside it.
  const firstSilent = scenes.findIndex((scene) => scene.silent);
  const voicedAfter = firstSilent < 0 ? -1 : scenes.findIndex((scene, i) => i > firstSilent && !scene.silent);
  if (voicedAfter >= 0) {
    die(
      `shots.json, scene ${scenes[firstSilent].id}: a silent scene can only come at the end of the film, after the last voice line, ` +
        `but ${scenes[voicedAfter].id} with voice comes after it.\n` +
        '  The film\'s sound is one track with the voice, music and effects mixed together. A pause in the middle would cut the\n' +
        '  music and push every later line out of step with the picture. Move the silent scene to the end, or for a silent\n' +
        '  beat between lines, leave a pause in the voice script itself.',
    );
  }
  // Every voice line belongs to exactly one scene, and the scenes follow the voice.
  const expected = voiceLines.map((line) => line.id);
  if (used.join() !== expected.join()) die(`The scenes must cover every voice line once, in order.\n  voice:  ${expected.join(' ')}\n  scenes: ${used.join(' ')}`);
  return scenes;
}

/**
 * When each shot arrives, in film time: with the voice line it names, else with the scene's line at the
 * same position. Shots beyond the scene's lines share the time that is left evenly.
 */
function shotTimes(scene, sceneStart, sceneEnd) {
  const byWord = scene.shots.some((shot) => shot.wordAt !== undefined);
  const times = scene.shots.map((shot, k) => shot.wordAt ?? (shot.line ? scene.lines.find((line) => line.id === shot.line) : byWord ? undefined : scene.lines[k])?.start);
  if (times[0] === undefined) times[0] = sceneStart + LEAD; // a silent scene: its first shot lands just after the scene starts
  times.forEach((time, k) => {
    if (time !== undefined) return;
    const next = times.findIndex((t, j) => j > k && t !== undefined);
    const [until, steps] = next < 0 ? [sceneEnd, times.length - k + 1] : [times[next], next - k + 1];
    times[k] = times[k - 1] + (until - times[k - 1]) / steps;
  });
  return times;
}

/**
 * Scene times from the voice: the picture is fitted to the sound, never the other way round. `soundEnd` is where the
 * film ends without silent scenes. Silent end cards start at `cardStart`, just after the voice (not after the music's
 * tail, so the music plays on under them), one after another, each for its own seconds.
 */
function timeScenes(scenes, soundEnd, cardStart = soundEnd) {
  const starts = [];
  scenes.forEach((scene, i) => {
    const before = scenes[i - 1];
    if (i === 0) starts.push(0);
    else if (!scene.silent) starts.push(Math.max(scene.lines[0].start - LEAD, before.lines.at(-1).end));
    else if (!before.silent) starts.push(cardStart);
    else starts.push(starts[i - 1] + before.seconds);
  });
  const last = scenes.at(-1);
  const filmEnd = last.silent ? starts.at(-1) + last.seconds : soundEnd;
  return scenes.map((scene, i) => {
    const [start, end] = [starts[i], starts[i + 1] ?? filmEnd];
    const holdsToEnd = scene.silent && i === scenes.length - 1; // the end card's text stays until the last frame
    const arrivals = shotTimes(scene, start, end);
    const shots = scene.shots.map((shot, k) => ({ ...shot, at: arrivals[k] }));
    // A text repeated on neighbouring shots is one text that holds across them. It leaves before the next shot that
    // shows other text or none.
    const texts = [];
    shots.forEach((shot, k) => {
      if (!shot.text || shot.text === shots[k - 1]?.text) return;
      let last = k;
      while (shots[last + 1]?.text === shot.text) last++;
      const next = shots[last + 1];
      const out = next ? next.at - TEXT_CLEAR : holdsToEnd ? end : end - TEXT_CLEAR;
      if (out - shot.at < MIN_TEXT) warn(`${scene.id}: "${shot.text.replace(/\n/g, ' / ')}" is on screen for ${stamp(Math.max(0, out - shot.at))} s, under ${MIN_TEXT} s.`);
      texts.push({ lines: shot.text.split('\n').slice(0, 2).map((clause) => clause.trim()), at: round(shot.at - start), out: round(out - start) });
    });
    return { ...scene, start: round(start), end: round(end), shots, texts };
  });
}

/** The scene's rows of the shot list, as the comment at the top of its file. */
function brief(scene, job) {
  const row = (label, value) => ` *   ${label.padEnd(15)}${value}`;
  const out = [
    '/*',
    ` * ${scene.id}: ${scene.title}`,
    ' *',
    ` * The brief for this scene, from jobs/${job}/shots.json when the file was first made.`,
    ' * Times are film time and were right on that day: the live ones are in ../film.json and reach',
    ' * this scene as the `scene` prop, so the scene keeps up when the voice is re-timed.',
    ' *',
    row('Time', `${stamp(scene.start)} to ${stamp(scene.end)} s (${stamp(scene.end - scene.start)} s long)`),
    row('Energy', `${scene.energy} of 5`),
    row('Transition in', scene.transition_in ? `${scene.transition_in.number} (${scene.transition_in.name})` : 'none (first scene)'),
    row('Hand-off', scene.hand_off || 'none'),
    ' *',
    ' * Voice',
    ...(scene.silent
      ? [VOICELESS ? ` *   None: the film has no voice. This scene lasts ${stamp(scene.end - scene.start)} s.` : ` *   None, this is a silent scene that holds for ${stamp(scene.end - scene.start)} s after the sound has ended.`]
      : scene.lines.map((line) => row(`${line.id}  ${stamp(line.start)}-${stamp(line.end)}`, line.text))),
  ];
  scene.shots.forEach((shot, k) => {
    out.push(
      ' *',
      ` * Shot ${k + 1}${shot.frame ? ` (${shot.frame})` : ''}, from ${stamp(shot.at)} s`,
      row('On-screen text', shot.text ? shot.text.replace(/\n/g, ' / ') : shot.text_held_from ? `held from ${shot.text_held_from}` : 'none'),
      ...(shot.word ? [row('Arrives on', `"${shot.word}"`)] : []),
      row('Shot size', shot.size),
      row('Shows', shot.capture || 'no capture'),
      row('Focal point', shot.focal_point || 'not given'),
      row('Move', shot.move || 'not given'),
      row('Sound', shot.sound || 'not given'),
    );
  });
  return [...out, ' */'].join('\n').replace(/\*\/(?=[\s\S])/g, '* /'); // nothing in the brief may end the comment early
}

const sceneFile = (scene, job) => `${brief(scene, job)}
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { Headline, Label, useVh } from '../../../kit/ui';
import type { SceneData } from '../../_film';

const centred = { alignItems: 'center', justifyContent: 'center' } as const;

// A placeholder: only the on-screen text, at its cue. Build the scene here from the kit (engine/README.md).
// Cues are seconds on the scene's own clock. Take them from \`scene\`, never as typed-in numbers.
export const ${scene.id}: FC<{ scene: SceneData }> = ({ scene }) => {
  const vh = useVh();
  return (
    <>
      <AbsoluteFill style={{ ...centred, justifyContent: 'flex-start', paddingTop: vh(9) }}>
        <Label>Draft of {scene.title}</Label>
      </AbsoluteFill>
      {scene.texts.map((text, i) => (
        <AbsoluteFill key={i} style={centred}>
          <Headline lines={text.lines} at={text.at} out={text.out} />
        </AbsoluteFill>
      ))}
    </>
  );
};
`;

const filmFile = (slug, job, ids) => `// Written by tools/film/scaffold.mjs from jobs/${job}, and rewritten on every run. Do not edit: build scenes in scenes/.
import type { FC } from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';
import captionsJson from '../../../public/jobs/${slug}/captions.json';
import { BrandProvider } from '../../kit/brand';
import { Captions, captionsSchema } from '../../kit/Captions';
import { MotionProvider } from '../../kit/motion';
import { Stage } from '../../kit/ui';
import { filmSpan, readFilm, sceneOf, sceneSpan, type FilmProps, type Job } from '../_film';
import filmJson from './film.json';
${ids.map((id) => `import { ${id} } from './scenes/${id}';`).join('\n')}

const film = readFilm(filmJson);
const captions = captionsSchema.parse(captionsJson);

// The whole film, in the job's brand. With \`only\`, the composition shows just that scene's time range: the film is
// slid back so the scene starts on frame 0, which keeps the stage, the sound and the captions exactly as in the full film.
const Film: FC<FilmProps> = ({ brand, preset, stage, captions: showCaptions, only }) => (
  <Sequence from={-filmSpan(film, only).from} layout="none">
    <BrandProvider brand={brand}>
      <MotionProvider preset={preset}>
        <Stage name={stage}>
${ids.map((id) => `          <Sequence {...sceneSpan(film, '${id}')}>\n            <${id} scene={sceneOf(film, '${id}')} />\n          </Sequence>`).join('\n')}
        </Stage>
        <Html5Audio src={staticFile(film.audio)} />
        <Captions data={captions} enabled={showCaptions} />
      </MotionProvider>
    </BrandProvider>
  </Sequence>
);

export const job: Job = { film, Film };
`;

/** index.ts lists every job folder in the engine that has a film, so deleting a folder and re-running removes it. */
function indexFile() {
  // Only scaffolded jobs (they have a film.json): a hand-built film in this folder registers itself in Root.tsx.
  const slugs = fs.readdirSync(ENGINE_JOBS).filter((name) => ['Film.tsx', 'film.json'].every((file) => fs.existsSync(path.join(ENGINE_JOBS, name, file)))).sort();
  const name = (slug) => 'job_' + slug.replace(/-/g, '_');
  return `// Written by tools/film/scaffold.mjs: one entry per job folder here. Do not edit; run the scaffold again.
import type { Job } from './_film';
${slugs.map((slug) => `import { job as ${name(slug)} } from './${slug}/Film';`).join('\n')}

export { JobCompositions } from './_film';
export const jobs: Job[] = [${slugs.map(name).join(', ')}];
`;
}

/** Writes a generated file and says whether anything changed. */
function write(file, content) {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (before !== content) fs.writeFileSync(file, content);
  console.log(`  ${before === null ? 'made     ' : before === content ? 'unchanged' : 'updated  '} ${rel(file)}`);
}

// ---------------------------------------------------------------- run

if (!args.length) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
if (args[0] === '--slug') { console.log(slugOf(args[1] ?? die('Give the job folder.'))); process.exit(0); }

const jobDir = path.resolve(args[0]);
const jobName = path.basename(jobDir);
const slug = slugOf(jobDir);
const job = readJson(path.join(jobDir, 'job.json'));
const shots = readJson(path.join(jobDir, 'shots.json'), 'Copy templates/shots.json and fill it from the approved shot list.');
VOICELESS = String(job.voice ?? '').toLowerCase() === 'none';
const captionsFile = path.join(jobDir, 'audio/captions.json');
let voiceLines;
let sound;
if (VOICELESS) {
  fs.mkdirSync(path.join(jobDir, 'audio'), { recursive: true });
  voiceLines = fs.existsSync(path.join(jobDir, 'audio/lines.json')) ? readJson(path.join(jobDir, 'audio/lines.json')) : [];
  if (voiceLines.length) die('job.json says "voice": "none", but audio/lines.json has voice lines. Remove one or the other.');
  if (!fs.existsSync(captionsFile)) fs.writeFileSync(captionsFile, JSON.stringify({ lines: [] }) + '\n');
  const total = (shots.scenes ?? []).reduce((a, scene) => a + (Number(scene.seconds) || 0), 0);
  sound = ['mix.wav', 'music.wav'].map((name) => path.join(jobDir, 'audio', name)).find((file) => fs.existsSync(file));
  if (!sound) {
    sound = path.join(jobDir, 'audio', 'silence.wav');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(Math.max(total, 0.1)), sound]);
    console.log(`  no music yet: ${stamp(total)} s of silence in audio/silence.wav`);
  }
} else {
  voiceLines = readJson(path.join(jobDir, 'audio/lines.json'), 'Run tools/audio/voice.mjs join first. (A film with no voice says "voice": "none" in job.json.)');
  sound = ['mix.wav', 'voice.wav'].map((name) => path.join(jobDir, 'audio', name)).find((file) => fs.existsSync(file))
    ?? die(`No sound in ${path.join(jobDir, 'audio')}: it needs mix.wav or voice.wav.`);
}
if (!Array.isArray(readJson(captionsFile, 'Run tools/film/captions.mjs first.').lines)) die(`${captionsFile} is not a captions file.`);

const [width, height] = SIZES[job.size] ?? die(`job.json: size "${job.size}" must be one of ${Object.keys(SIZES).join(', ')}.`);
const preset = PRESETS.includes(job.energy_preset) ? job.energy_preset : die(`job.json: energy_preset "${job.energy_preset}" must be one of ${PRESETS.join(', ')}.`);
const stage = OLD_STAGE_NAMES[shots.stage] ?? shots.stage ?? 'dark';
if (!STAGES.includes(stage)) die(`shots.json: stage "${shots.stage}" must be one of ${STAGES.join(', ')}.`);

// The brand: checked and copied to the engine now, so a render always uses the brand folder as it is today.
let brand;
try {
  brand = brandOfJob(job);
  console.log('Brands');
  const { ready } = syncBrands();
  if (!ready.includes(brand)) die(`The brand "${brand}" cannot be used until brands/${brand}/brand.json is fixed. Run: node tools/brand/check.mjs ${brand}`);
} catch (error) {
  die(error.message);
}

console.log(`\nScaffolding ${jobName} as "${slug}", brand ${brand}`);
// End cards come in just after the voice, whatever the mix's music tail is. mix.py reads the end cards from shots.json
// and lets the music run on under them, so the card is never in silence.
const voiceFile = path.join(jobDir, 'audio', 'voice.wav');
const cardStart = VOICELESS ? 0 : round((fs.existsSync(voiceFile) ? soundLength(voiceFile) : soundLength(sound)) + TAIL);
const wordsFile = path.join(jobDir, 'audio/words.json');
const usesWords = shots.scenes?.some((scene) => scene.shots?.some((shot) => shot.word !== undefined));
const words = usesWords ? readJson(wordsFile, 'Shots name their words, so the voice\'s word timings are needed.') : [];
// The length cap agreed at the idea stage is binding: the tail after the sound is shortened to keep the film inside it.
let tail = TAIL;
if (typeof job.length_cap_seconds === 'number' && !shots.scenes.some((scene) => scene.silent)) {
  const room = round(job.length_cap_seconds - soundLength(sound));
  if (room < 0) warn(`the sound alone runs ${stamp(soundLength(sound))} s, over the ${job.length_cap_seconds} s cap in job.json.`);
  else if (room < tail) { tail = room; console.log(`  tail after the sound shortened to ${stamp(tail)} s to stay inside the ${job.length_cap_seconds} s cap`); }
}
const scenes = timeScenes(readScenes(shots, voiceLines, jobDir, words, respellings(brand)), round(soundLength(sound) + tail), cardStart);
const duration = scenes.at(-1).end;
if (VOICELESS && typeof job.length_cap_seconds === 'number' && duration > job.length_cap_seconds + 0.01) warn(`the scenes add up to ${stamp(duration)} s, over the ${job.length_cap_seconds} s cap in job.json.`);
if (scenes.some((scene) => scene.silent) && path.basename(sound) === 'mix.wav' && soundLength(sound) < duration - 0.05) {
  warn(`the mix stops at ${stamp(soundLength(sound))} s but the end card runs to ${stamp(duration)} s, so the music cuts out under it. Run tools/audio/mix.py again, then this.`);
}
const startOf = (id) => scenes.find((scene) => scene.id === id)?.start ?? die(`shots.json: planned_instant_changes names scene "${id}", which is not in the list.`);

const film = {
  job: jobName,
  slug,
  fps: FPS,
  width,
  height,
  brand,
  preset,
  stage,
  duration,
  audio: `jobs/${slug}/audio.wav`,
  audio_from: path.basename(sound),
  // Each shot's arrival on the scene's own clock, with what it shows, for scene code to take its cues from.
  scenes: scenes.map(({ id, title, start, end, energy, lines, texts, shots: list }) => ({
    id, title, start, end, energy, lines, texts,
    shots: list.map((shot, k) => ({ id: shot.frame ?? `${id}-${k + 1}`, at: round(shot.at - start), size: shot.size, capture: shot.capture ?? null, ...(shot.background ? { background: shot.background } : {}), ...(typeof shot.label === 'string' ? { label: shot.label } : {}) })),
  })),
  // For tools/checks/smoothness.py --planned-cuts: an instant change happens where its scene starts.
  planned_instant_changes: (shots.planned_instant_changes ?? []).map((change) => ({ ...change, at: startOf(change.scene) })),
  planned_holds: shots.planned_holds ?? [],
};

const engineDir = path.join(ENGINE_JOBS, slug);
const publicDir = path.join(STUDIO, 'engine/public/jobs', slug);
fs.mkdirSync(path.join(engineDir, 'scenes'), { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

write(path.join(engineDir, 'film.json'), JSON.stringify(film, null, 1) + '\n');
write(path.join(engineDir, 'Film.tsx'), filmFile(slug, jobName, scenes.map((scene) => scene.id)));
for (const scene of scenes) {
  const file = path.join(engineDir, 'scenes', `${scene.id}.tsx`);
  if (fs.existsSync(file)) console.log(`  kept      ${rel(file)}`);
  else write(file, sceneFile(scene, jobName));
}
const orphans = fs.readdirSync(path.join(engineDir, 'scenes')).filter((name) => !scenes.some((scene) => `${scene.id}.tsx` === name));
if (orphans.length) warn(`scenes/ has files that are no longer in the shot list: ${orphans.join(', ')}. They are left alone.`);
write(path.join(ENGINE_JOBS, 'index.ts'), indexFile());
fs.copyFileSync(sound, path.join(publicDir, 'audio.wav'));
fs.copyFileSync(captionsFile, path.join(publicDir, 'captions.json'));
console.log(`  copied    audio/${path.basename(sound)} and audio/captions.json to ${rel(publicDir)}`);

console.log(`\n${width}x${height} at ${FPS} fps, brand ${brand}, ${preset}, ${stage} stage, ${stamp(duration)} s`);
for (const scene of scenes) {
  console.log(`  ${scene.id}  ${stamp(scene.start).padStart(6)} - ${stamp(scene.end).padStart(6)}  ${scene.silent ? 'silent' : 'voice ' + scene.lines.map((line) => line.id).join(' ')}  ${scene.title}`);
}
console.log(`Compositions: ${slug}, ${scenes.map((scene) => `${slug}-${scene.id}`).join(', ')}`);
