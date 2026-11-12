// Tests for tools/film/sources.mjs (proof of source). Run: node --test tools/film/tests/*.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { sourcesOf } from '../sources.mjs';

const make = () => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'p7-sources-'));
  const take = path.join(job, 'capture', 'boards', 'take-3');
  fs.mkdirSync(path.join(take, 'marks'), { recursive: true });
  fs.writeFileSync(path.join(take, 'capture.json'), JSON.stringify({ captured: '2026-11-12T14:08:06+06:00', address: 'https://app.example.com', browser: "the studio's own Chrome window", chrome: 'Chrome/157.0.8103.51', take: 3, brand: 'example' }));
  fs.writeFileSync(path.join(take, 'recording.mp4'), 'x');
  fs.writeFileSync(path.join(take, 'marks', 'board.png'), '');
  fs.writeFileSync(path.join(job, 'capture', 'boards', 'best.json'), JSON.stringify({ take: 3, folder: 'take-3' }));
  const scenesDir = path.join(job, 'engine-scenes');
  fs.mkdirSync(scenesDir);
  return { job, scenesDir };
};
const shots = (job, list) => fs.writeFileSync(path.join(job, 'shots.json'), JSON.stringify({ scenes: [{ id: 'S01', shots: list.map((c) => ({ text: '', capture: c })) }] }));

test('every product shot is listed with its take, date, address and browser', () => {
  const { job, scenesDir } = make();
  shots(job, [null, 'capture/boards', 'capture/boards/take-3/marks/board.png']);
  const r = sourcesOf(job, { scenesDir });
  assert.equal(r.pass, true);
  assert.equal(r.shots.length, 2);
  const [a, b] = r.shots;
  assert.equal(a.take, 3);
  assert.equal(a.captured, '2026-11-12T14:08:06+06:00');
  assert.equal(a.address, 'https://app.example.com');
  assert.match(a.browser, /studio's own Chrome window.*Chrome\/157/);
  assert.equal(b.take, 3);
  assert.equal(b.from, 'a still or clip taken from the take');
});

test('a shot whose capture was removed fails delivery', () => {
  const { job, scenesDir } = make();
  shots(job, ['capture/boards']);
  fs.rmSync(path.join(job, 'capture', 'boards'), { recursive: true });
  const r = sourcesOf(job, { scenesDir });
  assert.equal(r.pass, false);
  assert.equal(r.shots[0].ok, false);
  assert.match(r.shots[0].why, /not in the job folder/);
});

test('a loose screenshot with no capture behind it fails delivery', () => {
  const { job, scenesDir } = make();
  fs.mkdirSync(path.join(job, 'captures'));
  fs.writeFileSync(path.join(job, 'captures', 'board.png'), '');
  shots(job, ['captures/board.png']);
  assert.equal(sourcesOf(job, { scenesDir }).pass, false);
});

test('a capture played by the scene code is a product shot too, traced to its take', () => {
  const { job, scenesDir } = make();
  shots(job, [null]);
  fs.writeFileSync(path.join(scenesDir, 'S02.tsx'), `const src = 'jobs/${path.basename(job).replace(/^_/, '')}/capture/boards/recording.mp4';`);
  const r = sourcesOf(job, { scenesDir });
  assert.equal(r.shots.length, 1);
  assert.equal(r.shots[0].scene, 'S02');
  assert.equal(r.shots[0].ok, true);
  assert.equal(r.shots[0].take, 3);
});

test('a capture in the scene code with no take in the job fails', () => {
  const { job, scenesDir } = make();
  shots(job, [null]);
  fs.writeFileSync(path.join(scenesDir, 'S02.tsx'), `const src = 'jobs/${path.basename(job).replace(/^_/, '')}/capture/missing/recording.mp4';`);
  assert.equal(sourcesOf(job, { scenesDir }).pass, false);
});

test('a film with no product shots passes and says so', () => {
  const { job, scenesDir } = make();
  shots(job, [null, null]);
  const r = sourcesOf(job, { scenesDir });
  assert.equal(r.pass, true);
  assert.equal(r.shots.length, 0);
});
