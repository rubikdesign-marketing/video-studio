// The shared sound library (library/sounds/): reading its manifests, finding a sound, checking every file, and the
// brand kit's slots with their library fallbacks. Pure Node, no packages. The command line is tools/audio/sounds.mjs.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const LIBRARY = () => process.env.SOUNDS_DIR || path.join(STUDIO, 'library', 'sounds');

/** The groups, in the order the plan lists them, with how many sounds the plan asked for. */
export const GROUPS = {
  click: 20, interface: 40, pop: 15, swish: 15, whoosh: 25, riser: 15, impact: 25, glitch: 15, transition: 20, ambience: 15, foley: 20, chime: 15, music: 6,
};

/** The words a sound's `feel` may use, so a search for "soft" finds every soft sound. */
export const FEELS = [
  'soft', 'hard', 'bright', 'dark', 'warm', 'cold', 'airy', 'heavy', 'light', 'short', 'long', 'tight', 'wide', 'deep', 'high', 'low', 'clean',
  'gritty', 'digital', 'organic', 'metallic', 'glassy', 'wooden', 'paper', 'plastic', 'subtle', 'bold', 'playful', 'premium', 'calm', 'tense',
  'fast', 'slow', 'rising', 'falling', 'rhythmic',
];

/** Licences a file in the library may have. Anything else is refused by the check. */
export const LICENCES = ['CC0-1.0', 'PDM-1.0'];
/** The ceiling for the whole folder, from the plan ("Files in the repository"). */
export const CEILING_MB = 30;
/** Every effect is levelled to peak at -3 dBFS; music beds at -1. Allowed slack either way, in dB. */
export const PEAK = { sound: -3, music: -1, slack: 0.6 };

const REQUIRED = ['id', 'file', 'name', 'feel', 'use_for', 'seconds', 'peak_db', 'source', 'author', 'licence', 'fetched', 'sha256'];

/** Every manifest in the library: `<group>/index.json`, plus extra manifests a builder left beside it (`*.json` with a "sounds" list). */
export const loadLibrary = (dir = LIBRARY()) => {
  const sounds = [];
  const manifests = [];
  if (!fs.existsSync(dir)) return { dir, sounds, manifests };
  for (const group of fs.readdirSync(dir).sort()) {
    const folder = path.join(dir, group);
    if (!fs.statSync(folder).isDirectory() || group.startsWith('_')) continue;
    for (const name of fs.readdirSync(folder).filter((f) => f.endsWith('.json') && !f.endsWith('.beats.json')).sort()) {
      const file = path.join(folder, name);
      let json;
      try {
        json = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        manifests.push({ file, group, error: `cannot be read: ${e.message}` });
        continue;
      }
      if (!Array.isArray(json.sounds)) continue;
      manifests.push({ file, group, about: json.about });
      for (const s of json.sounds) sounds.push({ ...s, group: s.group || group, manifest: path.relative(dir, file) });
    }
  }
  return { dir, sounds, manifests };
};

const words = (text) => String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];

/**
 * Sounds ranked for a request: the group must match when given; each wanted feel word found adds 2, each word of
 * `text` found in the sound's name, use or feel adds 1; `longest`/`shortest` (seconds) filter by length.
 */
export const findSounds = (sounds, { group, feel = [], text = '', longest, shortest, max = 10 } = {}) => {
  const wanted = feel.map((f) => f.toLowerCase());
  const asked = words(text);
  return sounds
    .filter((s) => !group || s.group === group)
    .filter((s) => (longest === undefined || s.seconds <= longest) && (shortest === undefined || s.seconds >= shortest))
    .map((s) => {
      const has = new Set([...(s.feel || []).map((f) => f.toLowerCase()), ...words(s.name), ...words(s.use_for), ...words(s.id)]);
      const score = wanted.filter((f) => (s.feel || []).includes(f)).length * 2 + asked.filter((w) => has.has(w)).length;
      return { sound: s, score };
    })
    .filter((r) => r.score > 0 || (wanted.length === 0 && asked.length === 0))
    .sort((a, b) => b.score - a.score || a.sound.id.localeCompare(b.sound.id))
    .slice(0, max);
};

export const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const folderBytes = (dir) => {
  let total = 0;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    total += st.isDirectory() ? folderBytes(p) : st.size;
  }
  return total;
};

/**
 * Checks every sound: the fields are there, the file exists and is the file the manifest describes (checksum), the
 * licence is one the library allows, the level is the library's, the ids are unique, the feel words are known,
 * the source is credited, and the folder is under its ceiling. Returns problems (each a sentence) and counts.
 */
export const checkLibrary = (dir = LIBRARY()) => {
  const { sounds, manifests } = loadLibrary(dir);
  const problems = [];
  for (const m of manifests) if (m.error) problems.push(`${path.relative(dir, m.file)} ${m.error}`);
  const seen = new Map();
  const credits = fs.existsSync(path.join(dir, 'CREDITS.md')) ? fs.readFileSync(path.join(dir, 'CREDITS.md'), 'utf8') : '';
  for (const s of sounds) {
    const where = s.id || s.file || '(a sound with no id)';
    const missing = REQUIRED.filter((k) => s[k] === undefined || s[k] === '');
    if (missing.length) problems.push(`${where}: missing ${missing.join(', ')}`);
    if (s.id) {
      if (seen.has(s.id)) problems.push(`${where}: the id is used twice (${seen.get(s.id)} and ${s.manifest})`);
      seen.set(s.id, s.manifest);
    }
    if (s.licence && !LICENCES.includes(s.licence)) problems.push(`${where}: licence "${s.licence}" is not one the library allows (${LICENCES.join(', ')})`);
    const bad = (s.feel || []).filter((f) => !FEELS.includes(f));
    if (bad.length) problems.push(`${where}: unknown feel words ${bad.join(', ')}`);
    if (s.source && s.source !== 'studio' && credits && !credits.includes(s.source)) problems.push(`${where}: its source ${s.source} is not in CREDITS.md`);
    if (!s.file) continue;
    const file = path.join(dir, s.file);
    if (!fs.existsSync(file)) {
      problems.push(`${where}: the file ${s.file} is missing`);
      continue;
    }
    if (s.sha256 && sha256(file) !== s.sha256) problems.push(`${where}: the file is not the one the manifest describes (checksum differs)`);
    const target = s.group === 'music' ? PEAK.music : PEAK.sound;
    if (typeof s.peak_db === 'number' && Math.abs(s.peak_db - target) > PEAK.slack) problems.push(`${where}: peaks at ${s.peak_db} dBFS where the library levels to ${target}`);
    if (!/\.mp3$/i.test(s.file)) problems.push(`${where}: not an MP3 (the library keeps compressed files only)`);
  }
  if (!credits) problems.push('CREDITS.md is missing');
  const counts = {};
  for (const s of sounds) counts[s.group] = (counts[s.group] || 0) + 1;
  const mb = fs.existsSync(dir) ? folderBytes(dir) / 1e6 : 0;
  if (mb > CEILING_MB) problems.push(`the library is ${mb.toFixed(1)} MB, over its ${CEILING_MB} MB ceiling`);
  return { problems, counts, total: sounds.length, mb };
};

// ---------------------------------------------------------------- the brand kit

/** The kit's slots and their library fallbacks: library/sounds/kit.json. */
export const loadKit = (dir = LIBRARY()) => {
  const file = path.join(dir, 'kit.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { slots: {} };
};

/**
 * Where a slot's sound comes from for a brand: the brand's own file wins (brands/<brand>/sounds/<slot>.mp3);
 * without one, the slot's library sound, named so the hand-over can list it; without either, nothing.
 */
export const resolveSlot = (brand, slot, { dir = LIBRARY(), studio = STUDIO } = {}) => {
  const own = path.join(studio, 'brands', brand, 'sounds', `${slot}.mp3`);
  if (fs.existsSync(own)) return { slot, from: 'brand', file: own };
  const kit = loadKit(dir);
  const id = kit.slots?.[slot]?.library;
  if (id) {
    const sound = loadLibrary(dir).sounds.find((s) => s.id === id);
    if (sound && fs.existsSync(path.join(dir, sound.file))) return { slot, from: 'library', id, file: path.join(dir, sound.file) };
  }
  return { slot, from: null, file: null };
};

/** A library id as a file name for a job's audio/sfx folder: "whoosh/air-soft-01" is "whoosh--air-soft-01". */
export const sfxIdOf = (id) => id.replace(/\//g, '--');
