// The motion library's catalogue (library/motion/index.json) against the engine's gallery: every move has one entry,
// a preview on disk and a gallery scene under the same name; the moves added by the library plan (18 Nov 2026) also
// say their sizes, their sound and their credit, and the ones the house rules ban by default say so.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const studio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const index = JSON.parse(fs.readFileSync(path.join(studio, 'library/motion/index.json'), 'utf8'));
const added = index.moves.filter((m) => m.added_on === '2026-11-18');
const SIZES = ['16:9', '9:16', '1:1', '4:5'];
const GROUPS = ['click', 'interface', 'pop', 'swish', 'whoosh', 'riser', 'impact', 'glitch', 'transition', 'ambience', 'foley', 'chime'];

test('every move has one entry, a known family and a preview on disk', () => {
  const names = index.moves.map((m) => m.name);
  assert.equal(new Set(names).size, names.length, 'a name is used twice');
  for (const m of index.moves) {
    assert.ok(index.families[m.family], `${m.name}: family "${m.family}" is not described in "families"`);
    if (m.preview) assert.ok(fs.existsSync(path.join(studio, m.preview)), `${m.name}: preview ${m.preview} is missing`);
  }
});

test('the moves added by the library plan each have a gallery scene, their sizes, a sound and a credit field', () => {
  const folder = path.join(studio, 'engine/src/library/motion');
  const demoNames = new Set();
  for (const family of ['text', 'transitions', 'openers', 'shaders'])
    for (const file of fs.readdirSync(path.join(folder, family)).filter((f) => /^batch\d+\.tsx$/.test(f)))
      for (const match of fs.readFileSync(path.join(folder, family, file), 'utf8').matchAll(/name: '([a-z0-9-]+)'/g)) demoNames.add(match[1]);
  assert.ok(added.length >= 100, `only ${added.length} moves were added`);
  for (const m of added) {
    assert.ok(demoNames.has(m.name), `${m.name}: no gallery scene`);
    assert.equal(m.composition, `move-${m.name}`, `${m.name}: composition`);
    assert.ok(Array.isArray(m.sizes) && m.sizes.length && m.sizes.every((s) => SIZES.includes(s)), `${m.name}: sizes`);
    assert.ok('sound' in m, `${m.name}: say its sound, or null for none`);
    if (m.sound) assert.ok(GROUPS.includes(m.sound.group), `${m.name}: sound group "${m.sound.group}" is not a library group`);
    assert.ok('credit' in m, `${m.name}: say its credit, or null`);
    assert.ok(fs.existsSync(path.join(studio, m.file)), `${m.name}: ${m.file} is missing`);
  }
});

test('moves the house rules ban by default are marked', () => {
  const marked = new Set(added.filter((m) => m.house_rule).map((m) => m.name));
  for (const name of ['blinds', 'invert-flash', 'glitch-cut', 'film-burn', 'glitch-in']) assert.ok(marked.has(name), `${name} needs a house_rule note`);
});

// ---- creator-style moves (19 Nov 2026) and the look-* file references
const ugc = index.moves.filter((m) => m.added_on === '2026-11-19');

test('every capture look names the file that really exports CaptureShot', () => {
  const looks = index.moves.filter((m) => m.name.startsWith('look-') && m.component === 'CaptureShot');
  assert.equal(looks.length, 8);
  for (const m of looks) {
    assert.ok(fs.existsSync(path.join(studio, m.file)), `${m.name}: ${m.file} is missing`);
    assert.match(fs.readFileSync(path.join(studio, m.file), 'utf8'), /export const CaptureShot\b/, `${m.name}: ${m.file} does not export CaptureShot`);
  }
});

test('the creator-style moves have a gallery scene, a matching preview, editable props, sizes, timing, cost and a 2D fallback', () => {
  assert.deepEqual(ugc.map((m) => m.name).sort(), ['ugc-comment-reply', 'ugc-screen-rec-tell', 'ugc-sticker-pop']);
  const demos = fs.readFileSync(path.join(studio, 'engine/src/library/motion/ugc/batch1.tsx'), 'utf8');
  for (const m of ugc) {
    assert.ok(demos.includes(`name: '${m.name}'`), `${m.name}: no gallery scene`);
    assert.equal(m.composition, `move-${m.name}`);
    assert.deepEqual([...m.sizes].sort(), ['16:9', '1:1', '4:5', '9:16']);
    assert.ok(Object.keys(m.props).length >= 5, `${m.name}: say its editable props`);
    assert.ok(m.timing && m.expected_render_cost && /no WebGL/i.test(m.device_fallback), `${m.name}: timing, render cost and 2D fallback`);
    assert.equal(m.attribution, 'original, written in-house');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(studio, m.preview))).digest('hex'), m.preview_sha256, `${m.name}: preview checksum`);
    const code = fs.readFileSync(path.join(studio, m.file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/Math\.random|Date\.now|new Date\(/.test(code), `${m.name}: nothing random or timed by the clock`);
    assert.ok(!/WebGL|three|@paper-design/i.test(code), `${m.name}: plain 2D only`);
  }
});

test('every shader move says plainly what happens without WebGL (a fallback, or "none: needs WebGL")', () => {
  const shaders = index.moves.filter((m) => m.name.startsWith('shader-'));
  assert.equal(shaders.length, 8);
  for (const m of shaders) assert.ok(typeof m.device_fallback === 'string' && /^none: needs WebGL$|static gradient|CSS/i.test(m.device_fallback), `${m.name}: device_fallback must be a real fallback or "none: needs WebGL"`);
});
