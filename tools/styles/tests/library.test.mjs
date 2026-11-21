import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABS, TAB_LABELS, ENERGY_TARGETS, SKETCHES, loadLibrary, engineNames, promptText, checkLibrary } from '../lib/library.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'lib');
const names = engineNames(FIX);
const fresh = () => loadLibrary(FIX);
const run = (lib, o = {}) => checkLibrary(lib, { names, root: FIX, clips: false, min: 2, ...o }).problems;
const entry = (lib, id) => lib.byId.get(id);
const mentions = (problems, id) => problems.some((p) => p.includes(id));

test('shape: constants and fixture names', () => {
  assert.deepEqual(TABS, ['filming', 'motion', 'animation', 'product-ui', 'sound']);
  assert.equal(TAB_LABELS['product-ui'], 'Product UI');
  assert.deepEqual(ENERGY_TARGETS.calm.still, [13, 15]);
  assert.equal(SKETCHES.length, 8);
  assert.ok(names.moves.has('BlurIn') && names.registry.has('WordRise') && names.backgrounds.has('Paper') && names.sounds.has('click/soft-tap-01'));
});

test('check: a clean fixture library has no problems (clips off)', () => {
  const lib = fresh();
  assert.deepEqual(lib.notes, []);
  assert.deepEqual(run(lib), []);
});

test('check: names each fixture defect', () => {
  // fewer than 100 entries in a tab
  assert.ok(run(fresh(), { min: 100 }).some((p) => p.includes('Motion') && p.includes('100')));

  // a repeated id
  let lib = fresh();
  lib.tabs.motion[1].id = 'demo-soft-arrive';
  assert.ok(mentions(run(lib), 'demo-soft-arrive'));

  // a ready entry with an unknown move
  lib = fresh();
  entry(lib, 'demo-snappy').engine = ['NoSuchMove'];
  assert.ok(run(lib).some((p) => p.includes('demo-snappy') && p.includes('NoSuchMove')));

  // a ready entry with no clip (clips on)
  assert.ok(run(fresh(), { clips: true }).some((p) => p.includes('demo-snappy') && /no clip/.test(p)));
  // sound entries do not need a clip, only their sound file
  assert.ok(!mentions(run(fresh(), { clips: true }), 'acme-soft-tap'));
  lib = fresh();
  entry(lib, 'acme-soft-tap').preview.sound = 'click/missing-01';
  assert.ok(mentions(run(lib), 'acme-soft-tap'));

  // made on request with no nearest, or a nearest that is not ready
  lib = fresh();
  delete entry(lib, 'demo-clay-hero').nearest;
  assert.ok(run(lib).some((p) => p.includes('demo-clay-hero') && /nearest/.test(p)));
  lib = fresh();
  entry(lib, 'demo-clay-hero').nearest = 'demo-clay-hero';
  assert.ok(run(lib).some((p) => p.includes('demo-clay-hero') && /not ready/.test(p)));

  // a missing timing for a listed energy
  lib = fresh();
  delete entry(lib, 'demo-snappy').timing.hype;
  assert.ok(run(lib).some((p) => p.includes('demo-snappy') && p.includes('hype')));

  // confident motion 2.0
  lib = fresh();
  entry(lib, 'demo-snappy').timing.confident.motion = 2.0;
  assert.ok(run(lib).some((p) => p.includes('demo-snappy') && p.includes('motion')));

  // calm still_pct 20
  lib = fresh();
  entry(lib, 'demo-soft-arrive').timing.calm.still_pct = 20;
  assert.ok(run(lib).some((p) => p.includes('demo-soft-arrive') && p.includes('still')));

  // "mesh blob" in what is a problem, in avoid it is allowed
  lib = fresh();
  entry(lib, 'demo-soft-arrive').prompt.what = 'A soft mesh blob drifts behind the words.';
  assert.ok(run(lib).some((p) => p.includes('demo-soft-arrive') && p.includes('mesh blob')));
  lib = fresh();
  entry(lib, 'demo-soft-arrive').prompt.avoid = 'A mesh blob behind the words.';
  assert.deepEqual(run(lib), []);

  // glitch or rgb-split in an engine name
  lib = fresh();
  entry(lib, 'demo-quick-cut').engine = ['rgb-split-cut'];
  assert.ok(run(lib).some((p) => p.includes('demo-quick-cut') && p.includes('rgb-split')));

  // a banned word
  lib = fresh();
  entry(lib, 'demo-held-wide').line = 'Made for Initech launches.';
  assert.ok(run(lib, { banned: ['initech'] }).some((p) => p.includes('demo-held-wide') && p.includes('initech')));

  // a settles value the brief does not allow
  lib = fresh();
  entry(lib, 'demo-soft-arrive').settles = { look: 'neon' };
  assert.ok(run(lib).some((p) => p.includes('demo-soft-arrive') && p.includes('neon')));

  // a sketch id that is not in sketches.json
  lib = fresh();
  entry(lib, 'demo-clay-hero').preview.sketch = 'no-such-sketch';
  assert.ok(run(lib).some((p) => p.includes('demo-clay-hero') && p.includes('no-such-sketch')));

  // a pairs_with id that does not exist
  lib = fresh();
  entry(lib, 'demo-soft-arrive').pairs_with = ['demo-nothing'];
  assert.ok(run(lib).some((p) => p.includes('demo-soft-arrive') && p.includes('demo-nothing')));
});

test('check: an eight-word run shared with a corpus record fails, seven does not', () => {
  const corpus = JSON.parse(readFileSync(join(FIX, 'corpus.json'), 'utf8'));
  const sentence = corpus[0].prompt; // "Make a quiet film where the demo screen opens slowly and ..."
  const w = sentence.split(' ');
  let lib = fresh();
  entry(lib, 'demo-held-wide').prompt.when = `${w.slice(0, 8).join(' ').toUpperCase()}, and nothing else.`;
  assert.ok(run(lib, { corpus }).some((p) => p.includes('demo-held-wide') && p.includes('eight words')));
  lib = fresh();
  entry(lib, 'demo-held-wide').prompt.when = `${w.slice(0, 7).join(' ')} then stop.`;
  assert.deepEqual(run(lib, { corpus }), []);
  // a record with no prompt field falls back to its long string fields
  const other = [{ title: 'x', body: sentence }];
  lib = fresh();
  entry(lib, 'demo-held-wide').prompt.when = w.slice(2, 10).join(' ');
  assert.ok(mentions(run(lib, { corpus: other }), 'demo-held-wide'));
});

test('load: a tab file that is not JSON gives a note and the other tabs load', () => {
  const root = mkdtempSync(join(tmpdir(), 'styles-'));
  cpSync(FIX, root, { recursive: true });
  writeFileSync(join(root, 'library', 'styles', 'motion.json'), '{ not json');
  const lib = loadLibrary(root);
  assert.equal(lib.notes.length, 1);
  assert.match(lib.notes[0], /^The Motion styles could not be read: /);
  assert.deepEqual(lib.tabs.motion, []);
  assert.equal(lib.tabs.filming.length, 2);
  assert.ok(lib.byId.has('demo-slow-push') && !lib.byId.has('demo-snappy'));
});

test('load: a missing tab file gives a note too', () => {
  const lib = loadLibrary(join(FIX, 'library', 'sounds'));
  assert.equal(lib.notes.length, 5);
});

test('promptText: includes one line per energy with its numbers, and the avoid line last', () => {
  const lib = fresh();
  const e = entry(lib, 'demo-snappy');
  const lines = promptText(e).split('\n');
  assert.equal(lines.length, 4); // what and when, confident, hype, avoid
  assert.match(lines[1], /^Confident: .*0\.5 s.*out-quart.*1\.4.*8%/);
  assert.match(lines[2], /^Hype: .*0\.25 s.*out-back.*5\.2.*5%/);
  assert.ok(lines[3].startsWith('Avoid: ') && lines[3].includes(e.prompt.avoid));
  const s = promptText(entry(lib, 'acme-soft-tap')).split('\n');
  assert.match(s[1], /^Calm: 80 bpm.*-6 dB.*14%/);
});
