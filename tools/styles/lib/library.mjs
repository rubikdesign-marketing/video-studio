// The style library: loading, reading engine names, the expert prompt text and the checks.
// Pure reading and checking; nothing here writes. Only node: modules and in-repo imports.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOOKS, VOICES, KINDS, SIZES } from '../../plan/lib/brief.mjs';

export const TABS = ['filming', 'motion', 'animation', 'product-ui', 'sound'];
export const TAB_LABELS = { filming: 'Filming', motion: 'Motion', animation: 'Animation', 'product-ui': 'Product UI', sound: 'Sound' };
export const ENERGIES = ['calm', 'confident', 'hype'];
// Motion is the studio's typical motion value (inclusive range). Still time is a percent; the upper bound is exclusive
// for confident and hype, inclusive for calm.
export const ENERGY_TARGETS = {
  calm: { motion: [0.5, 0.9], still: [13, 15] },
  confident: { motion: [1.2, 1.7], still: [0, 10] },
  hype: { motion: [4.4, 6.5], still: [0, 10] },
};
export const SETTLES_VALUES = { look: LOOKS, voice: VOICES, kind: KINDS, size: SIZES };

const HERE = dirname(fileURLToPath(import.meta.url));
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const sketchFile = join(HERE, '..', '..', '..', 'library', 'styles', 'sketches.json');
export const SKETCHES = existsSync(sketchFile) ? readJson(sketchFile).map((s) => s.id) : [];

const stylesDir = (root) => join(root, 'library', 'styles');

export function loadLibrary(root) {
  const tabs = {};
  const byId = new Map();
  const notes = [];
  for (const tab of TABS) {
    tabs[tab] = [];
    const file = join(stylesDir(root), `${tab}.json`);
    try {
      const list = readJson(file);
      if (!Array.isArray(list)) throw new Error('the file is not a list of entries');
      tabs[tab] = list;
    } catch (e) {
      const reason = e.code === 'ENOENT' ? 'the file is missing' : e.message;
      notes.push(`The ${TAB_LABELS[tab]} styles could not be read: ${reason}`);
    }
    for (const entry of tabs[tab]) if (entry && entry.id !== undefined && !byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return { tabs, byId, notes };
}

const tryJson = (file) => { try { return readJson(file); } catch { return null; } };

export function engineNames(root) {
  const moves = new Set();
  const registry = new Set();
  const backgrounds = new Set();
  const sounds = new Set();
  const motion = tryJson(join(root, 'library', 'motion', 'index.json'));
  for (const m of motion?.moves || []) if (m?.name) moves.add(m.name);
  const reg = tryJson(join(root, 'library', 'registry.json'));
  for (const i of reg?.items || []) {
    if (i?.name) registry.add(i.name);
    if (i?.id) registry.add(i.id);
  }
  const bg = tryJson(join(root, 'library', 'backgrounds', 'index.json'));
  for (const b of bg?.backgrounds || []) if (b?.name) backgrounds.add(b.name);
  // Sounds: each group's index.json, the studio-made logo stings (synth-stings.json, catalogued apart from the group's
  // index, in the group folder or at the top of library/sounds), and as a fallback any file in a group folder.
  // Names that come only from library/sounds/glitch are kept apart too: the check refuses them (house rule).
  const soundsDir = join(root, 'library', 'sounds');
  const byGroup = new Map();
  const add = (group, name) => { sounds.add(name); if (!byGroup.has(name)) byGroup.set(name, new Set()); byGroup.get(name).add(group); };
  const notes = [];
  // A catalogue's sounds; a stings file that is there but cannot be read gives a note (the other sounds still load).
  const catalogue = (group, file, { strict = false } = {}) => {
    if (!existsSync(file)) return;
    const list = tryJson(file)?.sounds;
    if (!Array.isArray(list)) {
      if (strict) notes.push(`${file.slice(root.length + 1)} could not be read as a list of sounds, so its stings are not known`);
      return;
    }
    for (const s of list) {
      if (!s || typeof s !== 'object') continue;
      const named = String(s.id || s.file || '');
      const g = named.includes('/') ? named.split('/')[0] : group;
      if (typeof s.id === 'string' && s.id) { add(g, s.id); add(g, basename(s.id)); }
      if (typeof s.file === 'string' && s.file) { add(g, s.file); add(g, basename(s.file, extname(s.file))); }
    }
  };
  if (existsSync(soundsDir)) {
    catalogue('', join(soundsDir, 'synth-stings.json'), { strict: true });
    for (const group of readdirSync(soundsDir, { withFileTypes: true })) {
      if (!group.isDirectory()) continue;
      catalogue(group.name, join(soundsDir, group.name, 'index.json'));
      catalogue(group.name, join(soundsDir, group.name, 'synth-stings.json'), { strict: true });
      for (const f of readdirSync(join(soundsDir, group.name))) {
        if (f !== 'index.json') { add(group.name, `${group.name}/${f}`); add(group.name, basename(f, extname(f))); }
      }
    }
  }
  const glitch = new Set([...byGroup].filter(([, groups]) => groups.size === 1 && groups.has('glitch')).map(([n]) => n));
  return { moves, registry, backgrounds, sounds, glitch, notes };
}

// The expert prompt lives in an import-free module the brief page loads too.
export { promptText } from './prompt.mjs';

const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const RUN = 8;
function runs(text) {
  const w = words(text);
  const out = new Set();
  for (let i = 0; i + RUN <= w.length; i++) out.add(w.slice(i, i + RUN).join(' '));
  return out;
}
function corpusTexts(corpus) {
  const texts = [];
  for (const rec of corpus || []) {
    if (typeof rec === 'string') { texts.push(rec); continue; }
    if (typeof rec?.prompt === 'string') { texts.push(rec.prompt); continue; }
    for (const v of Object.values(rec || {})) if (typeof v === 'string' && v.length > 40) texts.push(v);
  }
  return texts;
}

const VISUAL = new Set(['filming', 'motion', 'animation', 'product-ui']);
const REQUIRED = ['id', 'tab', 'name', 'line', 'family', 'filters', 'prompt', 'engine', 'preview'];
const SOUND_EXT = ['', '.mp3', '.wav', '.ogg', '.m4a', '.flac'];
// The sound's file as the real layout has it: library/sounds/<group>/<name>.<ext>, named with or without the extension.
function soundFileExists(root, name) {
  if (!root || !name) return false;
  return SOUND_EXT.some((ext) => { const f = join(root, 'library', 'sounds', name + ext); return extname(name + ext) !== '' && existsSync(f) && statSync(f).isFile(); });
}
const inRange = (v, [lo, hi], hiExclusive) => typeof v === 'number' && v >= lo && (hiExclusive ? v < hi : v <= hi);
const isEntry = (e) => e !== null && typeof e === 'object' && !Array.isArray(e);
const isObj = isEntry;

export function checkLibrary(lib, { names, root, clips = true, corpus = null, banned = [], tab = null, min = 100 } = {}) {
  const problems = [];
  const tabs = tab ? [tab] : TABS;
  const allNames = new Set([...(names?.moves || []), ...(names?.registry || []), ...(names?.backgrounds || []), ...(names?.sounds || [])]);
  const bannedRes = banned.map((b) => new RegExp(b, 'i'));
  const corpusRuns = corpus ? new Set(corpusTexts(corpus).flatMap((t) => [...runs(t)])) : null;
  const isGlitchSound = (n) => /^glitch\//i.test(n) || Boolean(names?.glitch?.has(n));
  const seen = new Map();
  for (const t of TABS) for (const e of lib.tabs[t] || []) if (isEntry(e)) seen.set(e.id, (seen.get(e.id) || 0) + 1);
  const known = new Set(seen.keys());

  for (const t of tabs) {
    const list = lib.tabs[t] || [];
    if (list.length < min) problems.push(`${TAB_LABELS[t]}: ${list.length} entries, at least ${min} are needed`);
    for (const [i, e] of list.entries()) {
      // null, a number or loose words in the list: named by its place, and nothing else about it is checked.
      if (!isEntry(e)) { problems.push(`${TAB_LABELS[t]}: entry #${i + 1} is not an entry`); continue; }
      const id = e.id;
      const say = (m) => problems.push(`${id}: ${m}`);
      for (const f of REQUIRED) if (e[f] === undefined) say(`is missing ${f}`);
      for (const f of ['filters', 'prompt', 'preview', 'timing', 'settles']) if (e[f] !== undefined && !isObj(e[f])) say(`${f} must be an object`);
      for (const f of ['engine', 'pairs_with', 'avoid_with']) if (e[f] !== undefined && !Array.isArray(e[f])) say(`${f} must be a list`);
      if (seen.get(id) > 1) say(`id is used more than once`);
      if (e.tab !== undefined && e.tab !== t) say(`says tab ${e.tab} but is in the ${t} file`);
      const f = isObj(e.filters) ? e.filters : {};
      const energies = Array.isArray(f.energy) ? f.energy : [];
      for (const en of energies) if (!ENERGIES.includes(en)) say(`has an unknown energy ${en}`);
      const isSound = t === 'sound';
      const ready = f.ready === true;
      if (e.filters !== undefined) {
        if (typeof f.ready !== 'boolean') say('filters.ready must be true or false');
        for (const [key, allowed] of [['energy', ENERGIES], ['kinds', KINDS], ['sizes', SIZES]]) {
          if (!Array.isArray(f[key]) || f[key].length === 0) say(`filters.${key} must be a list with at least one value`);
          else if (key !== 'energy') for (const v of f[key]) if (!allowed.includes(v)) say(`filters.${key} has ${v}, which the brief does not know`);
        }
      }

      // timing per energy, inside the studio's targets
      for (const en of energies.filter((x) => ENERGIES.includes(x))) {
        const tm = isObj(e.timing) ? e.timing[en] : undefined;
        if (!tm) { say(`has no timing for ${en}`); continue; }
        const tgt = ENERGY_TARGETS[en];
        if (!isSound) {
          for (const k of ['beat_s', 'ease', 'overshoot', 'hold_s', 'motion', 'still_pct']) if (tm[k] === undefined) say(`${en} timing is missing ${k}`);
          if (tm.motion !== undefined && !inRange(tm.motion, tgt.motion, false)) say(`${en} motion ${tm.motion} is outside ${tgt.motion[0]} to ${tgt.motion[1]}`);
        } else {
          for (const k of ['bpm', 'hit_s', 'duck_db', 'still_pct']) if (tm[k] === undefined) say(`${en} timing is missing ${k}`);
        }
        if (tm.still_pct !== undefined && !inRange(tm.still_pct, tgt.still, en !== 'calm')) say(`${en} still_pct ${tm.still_pct} is outside ${tgt.still[0]} to ${tgt.still[1]}${en === 'calm' ? '' : ' (under)'}`);
      }

      // engine names
      for (const n of Array.isArray(e.engine) ? e.engine : []) {
        if (/glitch|rgb-split/i.test(n)) say(`uses ${n}, which breaks the house rules`);
        else if (names?.glitch?.has(n)) say(`uses ${n}, a sound from library/sounds/glitch, which breaks the house rules`);
        if (ready && !allNames.has(n)) say(`ready entry uses ${n}, which the engine does not have`);
      }

      // previews
      const pv = isObj(e.preview) ? e.preview : {};
      if (ready) {
        if (isSound) {
          if (!pv.sound) say('ready sound entry has no preview sound');
          else if (isGlitchSound(pv.sound)) say(`preview sound ${pv.sound} is from library/sounds/glitch, which breaks the house rules`);
          else if (!soundFileExists(root, pv.sound)) say(`preview sound ${pv.sound} has no file under library/sounds`);
        } else if (clips) {
          if (!pv.clip) say('ready entry has no preview clip set');
          else if (!(root && existsSync(join(root, pv.clip)))) say(`ready entry has no clip file at ${pv.clip}`);
        }
      } else {
        if (!e.nearest) say('is made on request but names no nearest ready style');
        else {
          const n = lib.byId.get(e.nearest);
          if (!n) say(`nearest ${e.nearest} does not exist`);
          else if (n.tab !== t) say(`nearest ${e.nearest} is not in the same tab`);
          else if (n.filters?.ready !== true) say(`nearest ${e.nearest} is not ready`);
        }
      }
      if (!(ready && isSound) && pv.sound && isGlitchSound(pv.sound)) say(`preview sound ${pv.sound} is from library/sounds/glitch, which breaks the house rules`);
      if (pv.sketch !== undefined && !SKETCHES.includes(pv.sketch)) say(`sketch ${pv.sketch} is not in sketches.json`);

      // settles
      for (const [k, v] of Object.entries(isObj(e.settles) ? e.settles : {})) {
        if (!SETTLES_VALUES[k]) say(`settles ${k}, which the brief does not have`);
        else if (!SETTLES_VALUES[k].includes(v)) say(`settles ${k}: ${v}, which the brief does not allow`);
      }
      for (const k of ['pairs_with', 'avoid_with']) for (const other of Array.isArray(e[k]) ? e[k] : []) if (!known.has(other)) say(`${k} names ${other}, which does not exist`);

      // house rules and banned words
      const p = isObj(e.prompt) ? e.prompt : {};
      if (/mesh[\s-]+blob/i.test(`${p.what || ''} ${p.when || ''} ${e.line || ''}`)) say('describes a mesh blob, which breaks the house rules');
      const flat = JSON.stringify(e);
      for (const re of bannedRes) if (re.test(flat)) say(`contains the banned word ${re.source}`);

      // corpus
      if (corpusRuns) {
        for (const field of ['what', 'when', 'avoid']) {
          for (const r of runs(p[field] || '')) if (corpusRuns.has(r)) { say(`prompt.${field} shares eight words with a study record ("${r}")`); break; }
        }
      }
    }
  }
  return { problems };
}
