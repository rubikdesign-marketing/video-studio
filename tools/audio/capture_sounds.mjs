#!/usr/bin/env node
// Places the brand's interface sounds on a capture clip from its event log (CAPTURE-PLAN 7.8): clicks, key presses,
// drags, jumps and scene changes, a toast and a result landing. It uses the engine's own plan
// (engine/src/kit/capture/sound.ts), so each sound lands on the film frame where its action shows.
//
//   node tools/audio/capture_sounds.mjs <capture folder> --brand <brand> [--options '<json>'] [--offset 4.2]
//        [--scenes 0,6.4] [--results 5.1] [--job jobs/<job>] [--write] [--json out.json]
//
// <capture folder>  engine/public/jobs/<job>/capture/<id> (cursor.json, tracks.json)
// --options         what the CaptureClip is given: {"look": "launch", "from": 2, "time": {...}, "emphasis": [...]}
// --offset          film seconds where the clip starts in the film
// --scenes          clip seconds of scene changes (a whoosh peaks on each); --results recording seconds of results
// --energy          calm, confident (default) or hype
//
// The sounds are the brand's sound kit: brands/<brand>/sounds/<slot>.mp3, one file per slot (the slot names are
// printed below). A slot with no file is left out and listed as missing; this tool never fetches or makes a sound.
// With --job and --write it adds the placed sounds to <job>/audio/sfx.json in the form tools/audio/mix.py reads
// ([{ "id", "at", "gain" }], files in audio/sfx/<id>.mp3), copying each slot's file there; sounds it placed before for
// the same capture are replaced, anything else in sfx.json is kept. mix.py then checks the levels.
import { build } from '../../engine/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = path.join(here, '..', '..');
const engine = path.join(studio, 'engine');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const folder = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const brand = flag('--brand');
if (!folder || !brand) {
  console.log("Usage: node tools/audio/capture_sounds.mjs <capture folder> --brand <brand> [--options '<json>'] [--offset s] [--scenes a,b] [--results r] [--energy hype] [--job jobs/<job> --write] [--json out.json]");
  process.exit(2);
}
const options = JSON.parse(flag('--options', '{}'));
const energy = flag('--energy', 'confident');
const list = (s) => (s ? s.split(',').map(Number).filter((n) => Number.isFinite(n)) : []);

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'capture-sounds-')), 'sound.mjs');
fs.writeFileSync(out + '.entry.ts', `export { planCapture } from '${path.join(engine, 'src/kit/capture/plan.ts')}';\nexport { planSounds, soundSlots, GAIN_RANGE } from '${path.join(engine, 'src/kit/capture/sound.ts')}';\nexport { withThings } from '${path.join(engine, 'src/kit/capture/glue.ts')}';\n`);
await build({ entryPoints: [out + '.entry.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', absWorkingDir: engine });
const { planCapture, planSounds, soundSlots, GAIN_RANGE, withThings } = await import(pathToFileURL(out).href);

const read = (name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
const cursor = read('cursor.json');
const tracks = withThings(cursor, fs.existsSync(path.join(folder, 'tracks.json')) ? read('tracks.json') : undefined, options.things);
const plan = planCapture(cursor, tracks, { from: options.from, to: options.to, look: options.look, time: options.time, moves: options.moves, holds: options.holds, energy, overrides: options.overrides });
const cues = planSounds(cursor, plan, { offset: Number(flag('--offset', 0)), energy, emphasis: options.emphasis, sceneChanges: list(flag('--scenes')), results: list(flag('--results')), tracks });

const kit = path.join(studio, 'brands', brand, 'sounds');
const fileOf = (slot) => path.join(kit, `${slot}.mp3`);
const used = [...new Set(cues.map((c) => c.slot))];
const missing = used.filter((slot) => !fs.existsSync(fileOf(slot)));
const placed = cues.filter((c) => !missing.includes(c.slot));
const name = `${path.basename(path.dirname(path.dirname(folder)))}/${path.basename(folder)}`;

console.log(`Sounds for ${name}, ${plan.map.duration.toFixed(2)} s of film, ${energy}`);
for (const c of cues) {
  const gainOk = c.gain >= GAIN_RANGE[0] - 1e-9 && c.gain <= GAIN_RANGE[1] + 1e-9;
  console.log(`  ${c.at.toFixed(3).padStart(7)} s  ${c.slot.padEnd(15)} ${String(Math.round(c.gain * 100)).padStart(3)}% of the voice${gainOk ? '' : ' (OUTSIDE a third to two thirds)'}  ${c.cause}${missing.includes(c.slot) ? '  (no file: not placed)' : ''}`);
}
if (!cues.length) console.log('  Nothing on screen here calls for a sound.');
if (missing.length) {
  console.log(`\nMissing from brands/${brand}/sounds/ (nothing placed for these):`);
  for (const slot of missing) console.log(`  ${slot}.mp3  ${soundSlots[slot].about}`);
  console.log('These are made with the studio\'s sound tool, a paid ElevenLabs call: ask the owner first.');
}

const job = flag('--job');
if (job && args.includes('--write')) {
  const audio = path.join(path.resolve(job), 'audio');
  fs.mkdirSync(path.join(audio, 'sfx'), { recursive: true });
  const sfxFile = path.join(audio, 'sfx.json');
  const before = fs.existsSync(sfxFile) ? JSON.parse(fs.readFileSync(sfxFile, 'utf8')) : [];
  const source = `capture ${name}`;
  const kept = before.filter((c) => c.source !== source);
  for (const slot of new Set(placed.map((c) => c.slot))) fs.copyFileSync(fileOf(slot), path.join(audio, 'sfx', `${slot}.mp3`));
  const added = placed.map((c) => ({ id: c.slot, at: c.at, gain: +c.gain.toFixed(3), source, cause: c.cause }));
  fs.writeFileSync(sfxFile, JSON.stringify([...kept, ...added].sort((a, b) => a.at - b.at), null, 1) + '\n');
  console.log(`\nWrote ${added.length} sounds to ${path.relative(studio, sfxFile)} (kept ${kept.length} others).`);
}
const jsonOut = flag('--json');
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ capture: name, energy, seconds: plan.map.duration, cues, missing }, null, 1));
process.exit(0);
