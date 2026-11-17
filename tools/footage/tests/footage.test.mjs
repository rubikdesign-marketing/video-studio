// Tests for the footage tool's pure parts (FOOTAGE-PLAN.md phase 1). Fast: no ffmpeg, no transcriber.
// Run: node --test tools/footage/tests/*.test.mjs
// The end-to-end check against real (synthetic) clips is tests/check_truth.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { render, row } from '../lib/log.mjs';
import { channelNote, colourOf, rotationOf, standardRate, steadiness } from '../lib/probe.mjs';
import { markFillers, wordsFromWhisper } from '../lib/transcribe.mjs';
import { pictureChain, rateArg, soundChain } from '../lib/workcopy.mjs';

test('frame rates snap to the nearest standard rate', () => {
  assert.equal(standardRate(29.97).label, '29.97');
  assert.equal(standardRate(30.14).label, '30');
  assert.equal(standardRate(59.7).label, '59.94');
  assert.equal(standardRate(24.1).label, '24');
  assert.equal(standardRate(0).label, '30');
  assert.equal(rateArg('29.97'), '30000/1001');
  assert.equal(rateArg('25'), '25');
});

test('an uneven frame rate is found, a steady one is not', () => {
  const steady = Array.from({ length: 300 }, (_, i) => i / 30);
  assert.equal(steadiness(steady).variable, false);
  const uneven = steady.map((t, i) => (i % 5 === 4 ? t + 0.015 : t));
  assert.equal(steadiness(uneven).variable, true);
  assert.equal(steadiness([0, 0.1]).variable, false); // too few frames to judge
});

test('rotation and colour are read the way players read them', () => {
  assert.equal(rotationOf({ side_data_list: [{ rotation: -90 }] }), 270);
  assert.equal(rotationOf({ tags: { rotate: '90' } }), 90);
  assert.equal(rotationOf({}), 0);
  assert.equal(colourOf({ color_transfer: 'arib-std-b67', pix_fmt: 'yuv420p10le' }).kind, 'hdr-hlg');
  assert.equal(colourOf({ color_transfer: 'arib-std-b67', pix_fmt: 'yuv420p10le' }).bits, 10);
  assert.equal(colourOf({ color_transfer: 'smpte2084' }).kind, 'hdr-pq');
  assert.equal(colourOf({ color_transfer: 'bt709' }, { 'com.apple.proapps.cameraLog': 'Apple Log' }).kind, 'log');
  assert.equal(colourOf({ color_transfer: 'bt709' }).kind, 'normal');
});

test('a microphone on one side is found and copied to both', () => {
  const one = { perChannel: [{ channel: 1, rms: -20 }, { channel: 2, rms: -Infinity }] };
  assert.equal(channelNote(one).kind, 'one-side');
  assert.equal(channelNote({ perChannel: [{ channel: 1, rms: -20 }, { channel: 2, rms: -22 }] }).kind, 'stereo');
  assert.equal(channelNote({ perChannel: [{ channel: 1, rms: -20 }] }).kind, 'mono');
  const flipped = { perChannel: [{ channel: 1, rms: -Infinity }, { channel: 2, rms: -18 }] };
  assert.equal(soundChain({ ...flipped, layoutNote: channelNote(flipped) }).chain, 'pan=stereo|c0=c1|c1=c1');
  assert.equal(soundChain({ ...one, layoutNote: { kind: 'stereo' } }).chain, null);
});

test('the picture chain converts HDR with the measured curve and says what it did', () => {
  const hdr = pictureChain({ colour: { kind: 'hdr-hlg' }, rotation: 90, width: 1080, height: 1920, variable: true, target: '30', fps: 30.1 });
  assert.match(hdr.chain, /tin=arib-std-b67.*npl=203.*tonemap=mobius:param=0.5/);
  assert.ok(hdr.said.some((s) => s.includes('HDR')));
  assert.ok(hdr.said.some((s) => s.includes('upright')));
  assert.ok(hdr.said.some((s) => s.includes('steady')));
  const log = pictureChain({ colour: { kind: 'log' }, rotation: 0, width: 1920, height: 1080, variable: false, target: '25', fps: 25 });
  assert.ok(!log.chain.includes('lut3d'));
  assert.ok(log.said[0].includes('no conversion LUT'));
  assert.match(pictureChain({ colour: { kind: 'log' }, rotation: 0, width: 1920, height: 1080, variable: false, target: '25', fps: 25 }, { logLut: '/x/cam.cube' }).chain, /lut3d=file='\/x\/cam.cube'/);
  const plain = pictureChain({ colour: { kind: 'normal' }, rotation: 0, width: 1920, height: 1080, variable: false, target: '30', fps: 30 });
  assert.equal(plain.said.length, 0);
});

test('whisper tokens become words: DTW starts moved earlier, ends at the next word, punctuation-only dropped', () => {
  const tok = (text, from, to, dtw) => ({ text, offsets: { from, to }, t_dtw: dtw, p: 0.9 });
  const json = { transcription: [{ tokens: [tok('[_BEG_]', 0, 0, -1), tok(' Um', 0, 170, 80), tok(',', 170, 510, 106), tok(' so', 510, 600, 132), tok(' to', 600, 700, 164), tok('day', 700, 900, 170), tok(' .', 900, 1000, 190)] }] };
  const w = wordsFromWhisper(json);
  assert.deepEqual(w.map((x) => x.text), ['Um,', 'so', 'today']);
  assert.equal(w[0].start, 0.65);
  assert.equal(w[0].end, w[1].start);
  assert.equal(w[2].start, 1.49);
});

test('fillers, possible fillers and repeated words are marked', () => {
  const w = markFillers(['Um,', 'so,', 'I', 'I', 'mean', 'you', 'know', 'it', 'works.'].map((text, i) => ({ text, start: i, end: i + 1 })));
  assert.equal(w[0].filler, 'yes');
  assert.equal(w[1].filler, 'maybe');
  assert.equal(w[3].filler, 'maybe'); // "I mean"
  assert.equal(w[5].filler, 'maybe'); // "you know"
  assert.equal(w[6].filler, 'maybe');
  assert.equal(w[7].filler, undefined);
  const r = markFillers(['the', 'the', 'board'].map((text, i) => ({ text, start: i, end: i + 1 })));
  assert.equal(r[1].repeat, true);
  const g = markFillers(['try', 'it,', 'it', 'only'].map((text, i) => ({ text, start: i, end: i + 1 })));
  assert.equal(g[2].repeat, undefined); // grammar across a comma, not a stutter
});

test('the log says what is in each clip and the repair for each finding', () => {
  const clip = {
    source: { measured: { duration: 9.4, video: { width: 1920, height: 1080, target: '25', colour: { kind: 'normal' }, rotation: 0, variable: false }, audio: { layoutNote: { kind: 'mono' } } } },
    working: { said: [] },
  };
  const quality = {
    picture: { flags: [{ what: 'flicker', from: 0, to: 9 }] },
    sound: { flags: [{ what: 'hum', from: 0, to: 9.4 }, { what: 'clicks', from: 1.2, to: 8.8 }], summary: { hum: { base_hz: 50 }, clicks: [1.25, 2.9], clarity_db: 26 } },
  };
  const r = row({ name: 'booth', clip, words: { words: [{ text: 'Um,', filler: 'yes' }, { text: 'hello' }] }, shots: { cuts: [], shots: [{}] }, quality });
  assert.match(r, /flicker \(throughout\)/);
  assert.match(r, /hum at 50 Hz/);
  assert.match(r, /2 clicks at 0:01, 0:03/);
  assert.match(r, /deflicker \(phase 5\)/);
  assert.match(r, /hum removal \(phase 3\)/);
  assert.match(r, /2 words, 1 filler/);
  const md = render('demo', [{ name: 'booth', clip, words: null, shots: null, quality: null }], { made: new Date('2026-11-12T10:00:00Z') });
  assert.match(md, /# Footage log: demo/);
  assert.match(md, /Faces, who speaks/);
});
