// Tests for the Openverse search and earshot's cue builder. Fast: no network, no earshot run.
// Run: node --test tools/media/tests/*.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { cuesFor } from '../../audio/listen.mjs';
import { allowed, record, searchUrl } from '../openverse.mjs';

test('Openverse searches only licences a brand film can use, unless share-alike is allowed on purpose', () => {
  assert.deepEqual(allowed(), ['cc0', 'pdm', 'by']);
  assert.ok(allowed({ allow: 'by-sa' }).includes('by-sa'));
  const u = new URL(searchUrl('audio', 'mouse click', { length: 'shortest', n: 50 }));
  assert.equal(u.pathname, '/v1/audio/');
  assert.equal(u.searchParams.get('license'), 'cc0,pdm,by');
  assert.equal(u.searchParams.get('length'), 'shortest');
  assert.equal(u.searchParams.get('page_size'), '20'); // capped
  assert.equal(new URL(searchUrl('image', 'desk', { aspect: 'wide' })).searchParams.get('aspect_ratio'), 'wide');
});

test('a result keeps its licence, credit line and whether a credit is needed', () => {
  const r = record('audio', { id: 'x', title: 'Deep Whoosh', creator: 'K', license: 'by', license_version: '4.0', source: 'freesound', url: 'https://a/b.mp3', duration: 3155, attribution: '"Deep Whoosh" by K is licensed under CC BY 4.0.' });
  assert.equal(r.needs_credit, true);
  assert.equal(r.seconds, 3.2);
  assert.equal(r.filetype, 'mp3');
  assert.equal(record('audio', { id: 'y', license: 'cc0', url: 'u.wav' }).needs_credit, false);
});

test('cues come from the job: voice lines, placed sounds and footage cuts, each moment once', () => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'cues-'));
  fs.mkdirSync(path.join(job, 'audio')); fs.mkdirSync(path.join(job, 'edit'));
  fs.writeFileSync(path.join(job, 'audio', 'lines.json'), JSON.stringify([{ id: 'L1', start: 0.1 }, { id: 'L2', start: 4.4 }]));
  fs.writeFileSync(path.join(job, 'audio', 'cues.json'), JSON.stringify([{ at: 0.3, id: 'boom' }, { at: 1.167, id: 'boom-b' }]));
  fs.writeFileSync(path.join(job, 'audio', 'sfx.json'), JSON.stringify([{ id: 'boom', prompt: 'a boom', seconds: 1.5 }, { id: 'boom', at: 0.3 }]));
  fs.writeFileSync(path.join(job, 'edit', 'cutlist.json'), JSON.stringify({ crossfade: 0.015, pieces: [{ at: 0, clip: 'a', in: 1 }, { at: 2.5, clip: 'a', in: 6.5 }] }));
  const c = cuesFor(job);
  assert.deepEqual(c.events.map((e) => [e.t, e.kind]), [[0.1, 'line'], [0.3, 'sfx'], [1.167, 'sfx'], [2.508, 'cut'], [4.4, 'line']]);
  assert.equal(c.fps, 30);
});
