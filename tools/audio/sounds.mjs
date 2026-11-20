#!/usr/bin/env node
// The shared sound library: find a sound, hear a group, check the files, see a brand's kit, and put a sound in a job.
//
//   sounds.mjs find [--group whoosh] [--feel soft,airy] [--text "card lands"] [--longest 1] [--max 10] [--local]
//       --local also searches packs in library/sounds-local/ (no known licence: local use only, never synced)
//   sounds.mjs list                          every group, how many sounds it has and how many the plan asked for
//   sounds.mjs check                         every file against its manifest: checksum, licence, level, credit, size
//   sounds.mjs sheet --group whoosh [--out engine/out/sheet-whoosh.mp3]
//                                            an audition sheet: the group's sounds one after another, 0.8 s apart,
//                                            with a list of when each starts, to listen to in one go
//   sounds.mjs kit <brand>                   each slot of the brand's sound kit: the brand's own file, or the library
//                                            sound used in its place (always listed in the hand-over), or nothing
//   sounds.mjs use <id> --job jobs/<job> --at 3.2 [--gain 0.45] [--cause "card lands"]
//                                            copies a library sound into the job (audio/sfx/<id>.mp3) and adds it to
//                                            audio/sfx.json, where mix.py places it
//
// The library is public domain (CC0) or made by the studio (tools/audio/synth.py); library/sounds/README.md says
// what is in it, CREDITS.md where each sound came from. Nothing here fetches, makes or uploads a sound.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { checkLibrary, findSounds, GROUPS, LIBRARY, LOCAL, loadKit, loadLibrary, loadLocal, resolveSlot, sfxIdOf, STUDIO } from './lib/library.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const positional = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !(i > 0 && all[i - 1].startsWith('--')));
const die = (message, code = 2) => {
  console.error(message);
  process.exit(code);
};
const secs = (s) => `${Number(s).toFixed(2)} s`;

const LOCAL_WARNING = 'Local pack (library/sounds-local): no known licence. Use it only in films the owner publishes on their own channels until the licence is confirmed, and never commit the file.';
const withLocal = () => (args.includes('--local') ? [...loadLibrary().sounds, ...loadLocal().sounds] : loadLibrary().sounds);
if (cmd === 'find') {
  const sounds = withLocal();
  const found = findSounds(sounds, {
    group: flag('--group'),
    feel: (flag('--feel', '') || '').split(',').filter(Boolean),
    text: flag('--text', ''),
    longest: flag('--longest') ? Number(flag('--longest')) : undefined,
    max: Number(flag('--max', 10)),
  });
  if (!found.length) die('Nothing in the library matches. Try fewer feel words, or `sounds.mjs list` to see the groups.', 1);
  for (const { sound: s } of found) console.log(`${s.id.padEnd(34)} ${secs(s.seconds).padStart(8)}  ${(s.feel || []).join(', ')}${s.local ? '  [local]' : ''}\n${''.padEnd(34)} ${s.use_for ?? s.file}`);
  if (found.some((r) => r.sound.local)) console.log(`\n${LOCAL_WARNING}`);
} else if (cmd === 'list') {
  const { counts, total, mb } = checkLibrary();
  for (const [group, asked] of Object.entries(GROUPS)) console.log(`${group.padEnd(11)} ${String(counts[group] || 0).padStart(4)} of about ${asked}`);
  console.log(`\n${total} sounds, ${mb.toFixed(1)} MB.`);
} else if (cmd === 'check') {
  const { problems, counts, total, mb } = checkLibrary();
  console.log(`${total} sounds in ${Object.keys(counts).length} groups, ${mb.toFixed(1)} MB.`);
  if (!problems.length) {
    console.log('Every file matches its manifest, is public domain or the studio\'s own, is levelled and credited.');
    process.exit(0);
  }
  console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
} else if (cmd === 'sheet') {
  const group = flag('--group') || die('Say which group: --group whoosh (sounds.mjs list shows them).');
  const { sounds } = loadLibrary();
  const chosen = sounds.filter((s) => s.group === group);
  if (!chosen.length) die(`No sounds in the group "${group}".`, 1);
  const out = path.resolve(flag('--out', path.join(STUDIO, 'engine', 'out', `sheet-${group}.mp3`)));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const GAP = 0.8;
  const LONGEST = 6;
  const inputs = [];
  const filters = [];
  let at = 0;
  const lines = [];
  chosen.forEach((s, i) => {
    inputs.push('-i', path.join(LIBRARY(), s.file));
    // A long sound (an ambience, a music bed) is heard for its first 6 s, faded out, so it never runs under the next.
    const heard = Math.min(s.seconds, LONGEST);
    const fade = s.seconds > LONGEST ? `,afade=t=out:st=${LONGEST - 0.5}:d=0.5` : '';
    filters.push(`[${i}:a]atrim=0:${heard},aresample=48000,aformat=channel_layouts=stereo${fade},adelay=${Math.round(at * 1000)}|${Math.round(at * 1000)}[a${i}]`);
    lines.push(`${at.toFixed(2).padStart(7)} s  ${s.id}  (${(s.feel || []).join(', ')})`);
    at += heard + GAP;
  });
  const mixGraph = `${filters.join(';')};${chosen.map((_, i) => `[a${i}]`).join('')}amix=inputs=${chosen.length}:normalize=0:duration=longest[out]`;
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', mixGraph, '-map', '[out]', ...(/\.mp3$/i.test(out) ? ['-c:a', 'libmp3lame', '-q:a', '3'] : []), out], { encoding: 'utf8' });
  if (r.status !== 0) die(`ffmpeg failed: ${r.stderr.slice(-600)}`, 1);
  // The list of what plays when goes beside the sheet, whatever the sheet's extension.
  fs.writeFileSync(`${out.replace(/\.[a-z0-9]+$/i, '')}.txt`, lines.join('\n') + '\n');
  console.log(`${out}\n${lines.join('\n')}`);
} else if (cmd === 'kit') {
  const brand = positional[0] || die('Say which brand: sounds.mjs kit tulvo');
  const kit = loadKit();
  const fromLibrary = [];
  for (const [slot, about] of Object.entries(kit.slots || {})) {
    const r = resolveSlot(brand, slot);
    const where = r.from === 'brand' ? 'the brand\'s own' : r.from === 'library' ? `library: ${r.id}` : 'NONE (left out wherever it is called for)';
    if (r.from === 'library') fromLibrary.push(slot);
    console.log(`${slot.padEnd(18)} ${where}\n${''.padEnd(18)} ${about.about}`);
  }
  if (fromLibrary.length) console.log(`\n${fromLibrary.length} slot${fromLibrary.length === 1 ? '' : 's'} use the shared library, not the brand's own sound: list them in the hand-over.`);
} else if (cmd === 'use') {
  const id = positional[0] || die('Say which sound: sounds.mjs use whoosh/air-soft-01 --job jobs/<job> --at 3.2');
  const job = flag('--job') || die('Say which job: --job jobs/<job>');
  const at = Number(flag('--at'));
  if (!Number.isFinite(at) || at < 0) die('Say when, in film seconds: --at 3.2');
  const gain = Number(flag('--gain', 0.45));
  if (!(gain >= 0.2 && gain <= 0.8)) die('--gain is a share of the voice, between 0.2 and 0.8 (knowledge/craft/07-sound.md).');
  const sound = withLocal().find((s) => s.id === id) || die(`No sound "${id}" in the library${args.includes('--local') ? '' : ' (add --local for packs in library/sounds-local)'}. sounds.mjs find shows ids.`, 1);
  if (sound.local) console.log(LOCAL_WARNING);
  const audio = path.join(path.resolve(job), 'audio');
  fs.mkdirSync(path.join(audio, 'sfx'), { recursive: true });
  const sfxId = sfxIdOf(id);
  fs.copyFileSync(path.join(sound.local ? LOCAL() : LIBRARY(), sound.file), path.join(audio, 'sfx', `${sfxId}.mp3`));
  const list = path.join(audio, 'sfx.json');
  const cues = fs.existsSync(list) ? JSON.parse(fs.readFileSync(list, 'utf8')) : [];
  cues.push({ id: sfxId, at, gain, source: `library/${sound.local ? 'sounds-local' : 'sounds'}/${sound.file}`, library: id, cause: flag('--cause', '') });
  cues.sort((a, b) => a.at - b.at);
  fs.writeFileSync(list, JSON.stringify(cues, null, 1));
  console.log(`Added ${id} at ${secs(at)}, ${Math.round(gain * 100)}% of the voice, to ${path.relative(STUDIO, list)}. mix.py places it.`);
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 2 : 0);
}
