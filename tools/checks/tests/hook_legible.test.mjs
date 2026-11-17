// Tests for the hook readability check. Run: node --test tools/checks/tests/hook_legible.test.mjs
// The last test makes four short clips with ffmpeg and runs the whole tool on them (it needs ffmpeg and tesseract).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { contrast, inkAndGround, judgeHook, wordsOf } from '../lib/hook_text.mjs';

const line = (share, c, text = 'Plan your week in one board') => ({ text, share, contrast: c });
const at = (t, ...lines) => ({ t, lines });

test('contrast is 21 for white on black and near 1 for two close greys', () => {
  assert.ok(Math.abs(contrast([255, 255, 255], [0, 0, 0]) - 21) < 0.01);
  assert.ok(contrast([119, 119, 119], [136, 136, 136]) < 1.5);
  assert.equal(contrast([10, 20, 30], [10, 20, 30]), 1);
});

test('the letters are the smaller group of pixels in a line\'s box', () => {
  const px = []; for (let i = 0; i < 100; i++) px.push(...(i < 25 ? [250, 250, 250] : [10, 10, 10]));
  const r = inkAndGround(px);
  assert.ok(r.ink[0] > 200 && r.ground[0] < 50);
  assert.equal(inkAndGround(new Array(300).fill(128)), null); // one flat colour
});

test('large, clear text by 3 s passes; the time it was first readable is reported', () => {
  const r = judgeHook([at(0, line(9, 15)), at(0.25, line(9, 15))]);
  assert.equal(r.pass, true); assert.equal(r.first_readable, 0); assert.deepEqual(r.problems, []);
});

test('each way of failing is named', () => {
  const what = (samples, o) => judgeHook(samples, o).problems.map((p) => p.what);
  assert.deepEqual(what([at(0, line(3.7, 15)), at(1, line(3.7, 15))]), ['too small']);
  assert.deepEqual(what([at(0, line(9, 1.3))]), ['low contrast']);
  const late = judgeHook([at(0), at(3, ), at(3.5, line(9, 15)), at(4, line(9, 15))]);
  assert.equal(late.pass, false); assert.equal(late.first_readable, 3.5); assert.deepEqual(late.problems.map((p) => p.what), ['late']);
  assert.deepEqual(what([at(0), at(1), at(4)]), ['no text']);
  assert.deepEqual(what([at(0, line(9, 15, 'Subscribe for more tips'))], { expect: 'Plan your week in one board' }), ['not the hook']);
});

test('a hook that arrives one word at a time is added up over time', () => {
  const r = judgeHook([at(0.5, line(40, 18, 'ARE')), at(1.25, line(40, 18, 'YOU')), at(2, line(40, 18, 'READY?'))], { expect: 'Are you ready' });
  assert.equal(r.pass, true); assert.equal(r.first_readable, 1.25); // two of its three words by then
});

test('with the hook given, the reason is about the hook\'s own words, not other text on screen', () => {
  // A big calendar label is up, but the hook's own line is small (a real film did this).
  const small = judgeHook([at(0.5, line(7.9, 15, 'November'), line(3.1, 16, 'Tulvo is launching on Product Hunt'))], { expect: 'Tulvo is launching on Product Hunt' });
  assert.deepEqual(small.problems.map((p) => p.what), ['too small']); assert.match(small.problems[0].detail, /the hook's line/);
  // Two of three words are too faint (blue on white), one is clear.
  const faint = judgeHook([at(0.5, line(40, 5.2, 'ARE')), at(1.25, line(40, 18, 'YOU')), at(2, line(40, 5.2, 'READY?'))], { expect: 'Are you ready' });
  assert.deepEqual(faint.problems.map((p) => p.what), ['low contrast']);
  const late = judgeHook([at(0.5, line(9, 15, 'November')), at(3.5, line(9, 15, 'Plan your week in one board'))], { expect: 'Plan your week in one board' });
  assert.deepEqual(late.problems.map((p) => p.what), ['late']);
});

test('with the hook\'s written line given, half its words on screen is enough (a line may wrap)', () => {
  assert.equal(judgeHook([at(0.5, line(9, 15, 'Plan your week'), line(9, 15, 'in one board'))], { expect: 'Plan your week in one board' }).pass, true);
});

test('a film shorter than 3 s is judged on what it has, and says so when it fails', () => {
  assert.equal(judgeHook([at(0, line(9, 15)), at(2, line(9, 15))], { duration: 2.2 }).pass, true);
  assert.match(judgeHook([at(0), at(2)], { duration: 2.2 }).problems[0].detail, /only 2.2 s long/);
});

test('words that can be matched: three letters or more, in any script', () => {
  assert.deepEqual(wordsOf('Why AI?'), ['why']); assert.deepEqual(wordsOf('Go AI'), []);
  assert.equal(wordsOf('\u09ac\u09be\u0982\u09b2\u09be \u09ad\u09bf\u09a1\u09bf\u0993').length, 2); // two Bengali words stay whole
});

test('the whole tool on four made clips: clear passes; small, faint and late fail by name', { skip: spawnSync('tesseract', ['--version']).status !== 0 && 'tesseract is not installed' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-'));
  const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'hook_legible.mjs');
  const ffmpeg = fs.existsSync('/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg') ? '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg' : 'ffmpeg';
  const make = (name, { size, colour = 'white', ground = 'black', from = 0 }) => {
    const out = path.join(dir, `${name}.mp4`);
    const r = spawnSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${ground}:s=1080x1920:r=30:d=4.5`,
      '-vf', `drawtext=text='Plan your week':fontsize=${size}:fontcolor=${colour}:x=(w-text_w)/2:y=600:enable='gte(t,${from})',drawtext=text='in one board':fontsize=${size}:fontcolor=${colour}:x=(w-text_w)/2:y=${600 + Math.round(size * 1.3)}:enable='gte(t,${from})'`,
      '-pix_fmt', 'yuv420p', out], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return out;
  };
  const run = (file) => { const j = path.join(dir, 'r.json'); const r = spawnSync('node', [tool, file, '--json', j], { encoding: 'utf8' }); return { code: r.status, ...JSON.parse(fs.readFileSync(j, 'utf8')) }; };
  const good = run(make('good', { size: 110 }));
  assert.equal(good.code, 0, JSON.stringify(good)); assert.equal(good.pass, true); assert.ok(good.first_readable <= 0.25);
  const small = run(make('small', { size: 40 }));
  assert.equal(small.code, 1); assert.deepEqual(small.problems.map((p) => p.what), ['too small']);
  const faint = run(make('faint', { size: 110, colour: '0x8a8a8a', ground: '0x6a6a6a' }));
  assert.equal(faint.code, 1); assert.deepEqual(faint.problems.map((p) => p.what), ['low contrast']);
  // A hook of only short words cannot be checked by its words: the tool says so instead of passing on other text.
  const cannot = spawnSync('node', [tool, path.join(dir, 'good.mp4'), '--expect', 'Go AI'], { encoding: 'utf8' });
  assert.equal(cannot.status, 2); assert.match(cannot.stdout, /no word of three letters/);
  assert.equal(spawnSync('node', [tool, path.join(dir, 'good.mp4'), '--by', 'abc']).status, 2);
  const late = run(make('late', { size: 110, from: 3.5 }));
  assert.equal(late.code, 1); assert.deepEqual(late.problems.map((p) => p.what), ['late']); assert.ok(Math.abs(late.first_readable - 3.5) <= 0.25);
  fs.rmSync(dir, { recursive: true, force: true });
});
