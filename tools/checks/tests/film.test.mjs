// Tests for tools/checks/lib/film.mjs. Run: node --test tools/checks/tests/*.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { captionBox, captionAt, overlap, sourceOfShot, capturePlacements, loadFilm } from '../lib/film.mjs';

const line = (text, start = 1, end = 2) => ({ start, end, words: text.split(' ').map((t, i) => ({ text: t, start: start + i * 0.2, end: start + i * 0.2 + 0.18 })) });

test('caption box sits 6% above the bottom, 8% tall, centred, in a 1920 x 1080 frame', () => {
  const b = captionBox(line('Plan the week'), { width: 1920, height: 1080 });
  assert.equal(Math.round(b.height), 86);
  assert.equal(Math.round(b.y + b.height), 1015);
  assert.ok(Math.abs(b.x + b.width / 2 - 960) < 0.001);
});

test('caption box at the top for a scene that asks for it', () => {
  const b = captionBox(line('Plan the week'), { width: 1920, height: 1080 }, 'top');
  assert.equal(Math.round(b.y), 65);
});

test('a longer line makes a wider pill', () => {
  const a = captionBox(line('Hi there'), { width: 1920, height: 1080 });
  const b = captionBox(line('Three beeps stand in for three voice lines'), { width: 1920, height: 1080 });
  assert.ok(b.width > a.width * 2);
});

test('the caption shows from 0.1 s before its first word to 0.4 s after its last', () => {
  const caps = { lines: [line('One two', 1, 2)] };
  assert.equal(captionAt(caps, 0.95)?.start, 1);
  assert.equal(captionAt(caps, 2.35)?.start, 1);
  assert.equal(captionAt(caps, 2.5), null);
});

test('overlap of two boxes', () => {
  assert.deepEqual(overlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }), { x: 5, y: 5, width: 5, height: 5 });
  assert.equal(overlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 }), null);
});

const tmpJob = () => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-film-'));
  const take = path.join(job, 'capture', 'boards', 'take-2');
  fs.mkdirSync(path.join(take, 'marks'), { recursive: true });
  fs.writeFileSync(path.join(take, 'capture.json'), JSON.stringify({ captured: '2026-11-12T14:08:06+06:00', address: 'https://app.example.com', browser: "the studio's own Chrome window", chrome: 'Chrome/157', take: 2 }));
  fs.writeFileSync(path.join(take, 'cursor.json'), JSON.stringify({ page: { width: 1920, height: 1080 }, scale: 2, seconds: 5, path: [], events: [] }));
  fs.writeFileSync(path.join(take, 'marks', 'board.png'), '');
  fs.writeFileSync(path.join(job, 'capture', 'boards', 'best.json'), JSON.stringify({ take: 2, folder: 'take-2' }));
  fs.mkdirSync(path.join(job, 'captures'));
  fs.writeFileSync(path.join(job, 'captures', 'loose.png'), '');
  return job;
};

test('a shot naming a capture resolves to its best take', () => {
  const job = tmpJob();
  const s = sourceOfShot(job, 'capture/boards');
  assert.equal(s.kind, 'best');
  assert.equal(path.basename(s.takeDir), 'take-2');
});

test('a still taken from a take resolves to that take', () => {
  const job = tmpJob();
  const s = sourceOfShot(job, 'capture/boards/take-2/marks/board.png');
  assert.equal(s.kind, 'take');
  assert.equal(path.basename(s.takeDir), 'take-2');
});

test('a loose picture or a missing capture has no source', () => {
  const job = tmpJob();
  assert.equal(sourceOfShot(job, 'captures/loose.png').kind, 'none');
  assert.equal(sourceOfShot(job, 'capture/gone').kind, 'none');
  assert.equal(sourceOfShot(job, '../elsewhere.png').kind, 'none');
});

test('placements: a capture shot starts at its scene plus clip.at, on the whole frame by default', () => {
  const job = tmpJob();
  fs.mkdirSync(path.join(job, 'out'));
  fs.writeFileSync(path.join(job, 'out', 'preview.film.json'), JSON.stringify({ width: 1920, height: 1080, fps: 60, duration: 8, scenes: [{ id: 'S01', start: 0, end: 3 }, { id: 'S02', start: 3, end: 8 }] }));
  fs.writeFileSync(path.join(job, 'shots.json'), JSON.stringify({ scenes: [{ id: 'S01', energy: 2, shots: [{ capture: null }] }, { id: 'S02', energy: 4, captions: 'top', shots: [{ capture: 'capture/boards', clip: { at: 0.5, look: 'calm' } }] }] }));
  const film = loadFilm(job);
  assert.equal(film.scenes[1].captions, 'top');
  const [p] = capturePlacements(film);
  assert.equal(p.scene, 'S02');
  assert.equal(p.start, 3.5);
  assert.deepEqual(p.place, { x: 0, y: 0, width: 1920 });
});
