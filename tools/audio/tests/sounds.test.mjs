// Tests for the sound library's reader, finder, check and kit (tools/audio/lib/library.mjs). Fast: a made-up
// library in a temporary folder, no audio is decoded.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkLibrary, findSounds, loadLibrary, resolveSlot, sfxIdOf } from '../lib/library.mjs';

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const makeLibrary = (edit = (s) => s) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sounds-'));
  const sounds = {
    whoosh: [
      { id: 'whoosh/air-soft-01', name: 'Soft air whoosh', feel: ['soft', 'airy', 'short'], use_for: 'A light card crossing the frame.', seconds: 0.6, peak_db: -3 },
      { id: 'whoosh/deep-02', name: 'Deep whoosh', feel: ['deep', 'heavy', 'long'], use_for: 'A scene change in a hype film.', seconds: 1.4, peak_db: -3.1 },
    ],
    click: [{ id: 'click/mouse-01', name: 'Mouse click', feel: ['hard', 'short', 'plastic'], use_for: 'A button is pressed.', seconds: 0.1, peak_db: -3, source: 'romainsimon/uisfx' }],
  };
  for (const [group, list] of Object.entries(sounds)) {
    fs.mkdirSync(path.join(dir, group));
    const out = list.map((s, i) => {
      const bytes = Buffer.from(`${s.id}-${i}`);
      const file = `${s.id}.mp3`;
      fs.writeFileSync(path.join(dir, file), bytes);
      return edit({ source: 'studio', author: 'Video Studio', licence: 'CC0-1.0', fetched: '2026-11-18', ...s, file, sha256: sha(bytes) });
    });
    fs.writeFileSync(path.join(dir, group, 'index.json'), JSON.stringify({ group, about: group, sounds: out }));
  }
  fs.writeFileSync(path.join(dir, 'CREDITS.md'), '# Credits\n\nromainsimon/uisfx, CC0.\n');
  fs.writeFileSync(path.join(dir, 'kit.json'), JSON.stringify({ slots: { 'small-whoosh': { about: 'x', library: 'whoosh/air-soft-01' }, 'nothing-here': { about: 'y', library: 'whoosh/none' } } }));
  return dir;
};

test('reads every group manifest', () => {
  const dir = makeLibrary();
  const { sounds } = loadLibrary(dir);
  assert.equal(sounds.length, 3);
  assert.deepEqual([...new Set(sounds.map((s) => s.group))].sort(), ['click', 'whoosh']);
});

test('finds by group and feel, best match first', () => {
  const { sounds } = loadLibrary(makeLibrary());
  const found = findSounds(sounds, { group: 'whoosh', feel: ['soft', 'airy'] });
  assert.equal(found[0].sound.id, 'whoosh/air-soft-01');
  assert.equal(findSounds(sounds, { text: 'button pressed' })[0].sound.id, 'click/mouse-01');
  assert.equal(findSounds(sounds, { group: 'whoosh', longest: 1 }).length, 1);
});

test('a clean library passes the check', () => {
  const { problems, total } = checkLibrary(makeLibrary());
  assert.deepEqual(problems, []);
  assert.equal(total, 3);
});

test('the check names a changed file, a wrong licence, a wrong level, an unknown feel and an uncredited source', () => {
  const dir = makeLibrary((s) =>
    s.id === 'whoosh/deep-02' ? { ...s, licence: 'CC-BY-4.0', peak_db: -9, feel: ['spooky'] } : s.id === 'click/mouse-01' ? { ...s, source: 'someone/else' } : s,
  );
  fs.writeFileSync(path.join(dir, 'whoosh/air-soft-01.mp3'), 'changed');
  const { problems } = checkLibrary(dir);
  const text = problems.join('\n');
  assert.match(text, /air-soft-01: the file is not the one/);
  assert.match(text, /licence "CC-BY-4.0"/);
  assert.match(text, /peaks at -9/);
  assert.match(text, /unknown feel words spooky/);
  assert.match(text, /someone\/else is not in CREDITS/);
});

test('a duplicate id and a missing file are named', () => {
  const dir = makeLibrary((s) => (s.id === 'whoosh/deep-02' ? { ...s, id: 'whoosh/air-soft-01' } : s));
  fs.rmSync(path.join(dir, 'click/mouse-01.mp3'));
  const text = checkLibrary(dir).problems.join('\n');
  assert.match(text, /used twice/);
  assert.match(text, /mouse-01.mp3 is missing/);
});

test('a kit slot falls back to the library, and says so; a brand file wins', () => {
  const dir = makeLibrary();
  const studio = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-'));
  fs.mkdirSync(path.join(studio, 'brands', 'acme', 'sounds'), { recursive: true });
  const fromLibrary = resolveSlot('acme', 'small-whoosh', { dir, studio });
  assert.equal(fromLibrary.from, 'library');
  assert.equal(fromLibrary.id, 'whoosh/air-soft-01');
  assert.equal(resolveSlot('acme', 'nothing-here', { dir, studio }).from, null);
  fs.writeFileSync(path.join(studio, 'brands', 'acme', 'sounds', 'small-whoosh.mp3'), 'own');
  assert.equal(resolveSlot('acme', 'small-whoosh', { dir, studio }).from, 'brand');
});

test('library ids become file names for a job', () => {
  assert.equal(sfxIdOf('whoosh/air-soft-01'), 'whoosh--air-soft-01');
});

test('local packs: read only when asked, marked local, files resolved inside their pack', async () => {
  const { loadLocal } = await import('../lib/library.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-'));
  fs.mkdirSync(path.join(dir, 'pack', 'Whooshes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pack', 'index.json'), JSON.stringify({ pack: 'pack', licence: 'unknown', sounds: [
    { id: 'pack/whoosh/001', file: 'Whooshes/soft air.wav', name: 'soft air', group: 'whoosh', feel: ['soft', 'air'], seconds: 0.8, peak_db: -3, licence: 'unknown' }] }));
  const { sounds } = loadLocal(dir);
  assert.equal(sounds.length, 1);
  assert.equal(sounds[0].local, true);
  assert.equal(sounds[0].file, path.join('pack', 'Whooshes', 'soft air.wav'));
  assert.equal(findSounds(sounds, { group: 'whoosh', feel: ['soft'] })[0].sound.id, 'pack/whoosh/001');
  assert.equal(loadLocal(path.join(dir, 'missing')).sounds.length, 0);
});
