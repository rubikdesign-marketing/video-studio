import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratchStudio, completeBrief } from '../../plan/tests/helpers.mjs';
import { safePath, studioMemory } from '../lib/memory.mjs';

const put = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), typeof text === 'string' ? text : JSON.stringify(text)); };
const job = (root, name, brief) => put(root, `jobs/${name}/brief.json`, brief);

test('memory: refuses the keys file, captures and renders', () => {
  const root = scratchStudio();
  for (const rel of ['.env', '.capture/acme/state.json', 'jobs/x/out/film.mp4', 'jobs/../.env', '../outside.json', '/etc/passwd', 'jobs/a/b/brief.json', 'jobs/x/footage.mov']) assert.throws(() => safePath(root, rel), /Not allowed/, rel);
  assert.ok(safePath(root, 'jobs/x/brief.json').endsWith(path.join('jobs', 'x', 'brief.json')));
  for (const rel of ['studio.json', 'brands/acme/brand.json', 'knowledge/craft/a.md', 'library/references/index.json', 'jobs/x/plan.md']) assert.ok(safePath(root, rel));
});

test('memory: last five films and newest lessons per customer brand, demo left out', () => {
  const root = scratchStudio();
  const films = Array.from({ length: 7 }, (_, i) => ({ name: `f${i}`, type: 'promo', date: `2026-11-0${i + 1}`, hook: `h${i}`, look: `l${i}` }));
  put(root, 'brands/acme/ledger.json', [films[3], films[0], films[6], films[1], films[5], films[2], { name: 'bare' }, films[4]].slice(0, 8));
  put(root, 'brands/acme/lessons/2026-11-01-a.md', '# First lesson\n\nx');
  put(root, 'brands/acme/lessons/2026-11-09-b.md', '# Second lesson\n');
  put(root, 'brands/acme/lessons/README.md', '# Lessons\n');
  put(root, 'brands/acme/styles/calm/style.json', { size: '9:16', kind: 'ugc', structure: [{}, {}], from_job: 'j1' });
  put(root, 'brands/demo/styles/ugc-preset/style.json', { size: '9:16', kind: 'ugc', structure: [{}] });
  const m = studioMemory(root);
  assert.deepEqual(m.brands.map((b) => b.name), ['acme']);
  assert.equal(m.brands[0].discovery, true);
  assert.equal(m.brands[0].last_films.length, 5);
  assert.equal(m.brands[0].last_films[0].name, 'f6');
  assert.deepEqual(m.brands[0].lessons, [{ date: '2026-11-09', title: 'Second lesson' }, { date: '2026-11-01', title: 'First lesson' }]);
  assert.deepEqual(m.styles, [{ ref: 'acme/calm', size: '9:16', kind: 'ugc', scenes: 2, from_job: 'j1' }]); // the demo brand's presets are not "your saved" styles
  assert.equal(m.parked, false);
});

test('memory: the most recently confirmed brief comes first, a broken one is skipped', () => {
  const root = scratchStudio();
  const mk = (date) => ({ ...completeBrief(), in_their_words: 'x'.repeat(200), decisions: [{ what: 'plan confirmed', date }] });
  job(root, 'A', mk('2026-11-20'));
  job(root, 'B', mk('2026-11-21'));
  job(root, 'C', '{ nope');
  job(root, '_old', mk('2026-11-22'));
  put(root, 'jobs/D/brief.json', { ...completeBrief(), parked: true });
  const briefs = studioMemory(root).briefs;
  assert.deepEqual(briefs.map((b) => b.job), ['B', 'A', 'D']);
  assert.equal(briefs[0].words.length, 120);
  assert.equal(briefs[0].confirmed, '2026-11-21');
  assert.equal(briefs[0].stage, 'brief');
  assert.equal(briefs[2].confirmed, null);
  assert.equal(briefs[2].parked, true);
  assert.equal(typeof briefs[0].open, 'number');
});

test('memory: a studio with only the demo brand is parked', () => {
  const root = scratchStudio();
  fs.rmSync(path.join(root, 'brands/acme'), { recursive: true });
  assert.equal(studioMemory(root).parked, true);
});

test('memory: a jobs/<x> or brands/<x> link that leads outside the studio is refused', () => {
  const root = scratchStudio();
  const outside = fs.mkdtempSync(path.join(path.dirname(root), 'outside-'));
  fs.writeFileSync(path.join(outside, 'brief.json'), JSON.stringify(completeBrief()));
  fs.writeFileSync(path.join(outside, 'brand.json'), '{}');
  fs.mkdirSync(path.join(root, 'jobs'), { recursive: true });
  fs.symlinkSync(outside, path.join(root, 'jobs', 'away'), 'dir');
  fs.symlinkSync(outside, path.join(root, 'brands', 'away'), 'dir');
  for (const rel of ['jobs/away/brief.json', 'jobs/away/plan.md', 'brands/away/brand.json', 'brands/away/product/discovery.md']) assert.throws(() => safePath(root, rel), /Not allowed/, rel);
  assert.ok(!studioMemory(root).briefs.some((b) => b.job === 'away'));
});
