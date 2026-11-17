// Tests for the timed beat sheet. Run: node --test tools/plan/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowed, assignBeats, beatSheet, energyProblems, expectedWindows, textHolds } from '../lib/beats.mjs';

// The promo playbook's shape.
const promo = { id: 'studio-promo', beats: [
  { id: 'hook', name: 'Hook', job: 'the offer or a tension', size: null, seconds: [3, 5], required: true },
  { id: 'turn', name: 'Turn', job: 'why now', size: [0.05, 0.1], seconds: null, required: false },
  { id: 'proof', name: 'Proof', job: 'three moments', size: [0.5, 0.6], seconds: null, required: true },
  { id: 'peak', name: 'Peak', job: 'the signature moment', size: [0.05, 0.08], seconds: null, required: false },
  { id: 'offer', name: 'Offer', job: 'price or promise', size: [0.1, 0.15], seconds: null, required: true },
  { id: 'close', name: 'Close', job: 'call to action, logo', size: null, seconds: [4, 6], required: true },
] };
const L = (id, start, end, beat = null, energy = null) => ({ id, start, end, text: 'x', words: 3, beat, energy });
// A sound 30 s promo: hook 0-4, turn 4-6.5, proof 6.5-23, peak 23-25, offer 25-28.5 ... close follows.
const good = [L('01', 0.3, 3.6, 'hook', 4), L('02', 4, 6, 'turn', 2), L('03', 6.5, 11, 'proof', 3), L('04', 11.5, 16, 'proof', 3), L('05', 16.5, 21.5, 'proof', 4), L('06', 22, 24, 'peak', 1),
  L('07', 24.5, 27.5, 'offer', 5), L('08', 28, 30, 'close', 4)];

test('what a beat is allowed: its share of the film, within its seconds', () => {
  assert.deepEqual(allowed(promo.beats[0], 30), [3, 5]);
  assert.deepEqual(allowed(promo.beats[2], 30), [15, 18]);
  assert.deepEqual(allowed(promo.beats[5], 3), [3, 3]); // a film shorter than a beat's minimum
  const w = expectedWindows(promo, 30); assert.equal(w[0].start, 0); assert.equal(w.at(-1).end, 30);
});

test('a sound script passes, with its beats given', () => {
  const r = beatSheet({ lines: good, framework: promo, duration: 34, cap: 35 });
  assert.deepEqual(r.problems, [], JSON.stringify(r.problems)); assert.equal(r.guessed, false);
  assert.deepEqual(r.beats.find((b) => b.id === 'proof').lines, ['03', '04', '05']);
});

test('lines with no beat are placed by time, and the sheet says the beats were guessed', () => {
  const r = beatSheet({ lines: good.map((l) => ({ ...l, beat: null })), framework: promo, duration: 34 });
  assert.equal(r.guessed, true); assert.equal(r.lines[0].beat, 'hook'); assert.equal(r.lines[0].how, 'by time');
  assert.deepEqual(assignBeats([L('a', 0.3, 3), L('x', 20, 21), L('z', 29, 31)], promo, 34).map((l) => l.beat), ['hook', 'proof', 'close']); // first and last open and close
});

test('each kind of problem is named', () => {
  const what = (lines, o = {}) => beatSheet({ lines, framework: promo, duration: 34, ...o }).problems.map((p) => p.what);
  assert.ok(what([L('01', 0.3, 6.2, 'hook', 4), ...good.slice(1)]).includes('hook late'));
  assert.ok(what(good, { platform: 'reels' }).includes('hook late')); // 3.6 s is late for a short-form feed
  assert.ok(what(good.filter((l) => l.beat !== 'offer')).includes('beat missing'));
  assert.ok(what([...good.slice(0, 6), L('07', 24.5, 27.5, 'close', 5), L('08', 28, 30, 'offer', 4)]).includes('out of order'));
  assert.ok(what([...good.slice(0, 7), L('08', 28, 30, 'outro', 4)]).includes('unknown beat'));
  assert.ok(what([good[0], L('02', 4, 6, 'proof', 2), L('03', 6.5, 8, 'turn', 3), ...good.slice(3)]).includes('beat split'));
  assert.ok(what(good, { cap: 30 }).includes('over the cap'));
  assert.ok(what([L('01', 0.3, 3.6, 'hook', 4), L('02', 4, 11, 'turn', 2), ...good.slice(2)]).includes('line long'));
  const short = [good[0], good[1], L('03', 6.5, 9, 'proof', 3), L('06', 9.5, 24, 'peak', 1), ...good.slice(6)];
  assert.ok(what(short).includes('beat short')); assert.ok(what(short).includes('beat long'));
});

test('the energy map\'s five rules', () => {
  assert.deepEqual(energyProblems([4, 2, 3, 3, 4, 1, 5, 4]), []);
  assert.deepEqual(energyProblems([1, 5, 4]), []); // open at 1 and jump
  assert.ok(energyProblems([1, 2, 1, 5, 4]).some((p) => p.what === 'energy opens at 1 without the jump'));
  assert.ok(energyProblems([2, 4, 1, 5, 4]).some((p) => p.what === 'energy opens at 2'));
  assert.ok(energyProblems([4, 2, 1, 5]).some((p) => p.what === 'ending not one below the peak')); // the peak last
  assert.deepEqual(energyProblems([3, 2, 4, 1, 5, 4]).map((p) => p.what), ['energy opens at 3']);
  assert.ok(energyProblems([4, 3, 3, 3, 3, 1, 5, 4]).some((p) => p.what === 'energy flat'));
  assert.ok(energyProblems([4, 1, 5, 2, 5, 4]).some((p) => p.what === 'more than one peak'));
  assert.ok(energyProblems([4, 2, 4, 5, 4]).some((p) => p.what === 'no rest before the peak'));
  assert.ok(energyProblems([4, 2, 1, 5, 2]).some((p) => p.what === 'ending not one below the peak'));
  assert.deepEqual(energyProblems([4, null, 5]), []); // too few to judge
});

test('on-screen text needs words ÷ 3 + 0.4 s', () => {
  assert.deepEqual(textHolds([{ id: 'S01', seconds: 4, shots: [{ text: 'Plan your week' }, { text: 'in *one* place' }] }]), []);
  const p = textHolds([{ id: 'S02', seconds: 2.4, shots: [{ text: 'Every task' }, { text: 'every person, every date' }] }]);
  assert.equal(p.length, 1); assert.match(p[0].detail, /S02 shot 2/);
  // The same text over three shots in a row is one hold of their time together.
  assert.deepEqual(textHolds([{ id: 'S03', seconds: 3.6, shots: [{ text: '3 tools. 3 bills.' }, { text: '3 tools. 3 bills.' }, { text: '3 tools. 3 bills.' }] }]), []);
  // Words the voice says at the same time are read along with it.
  assert.deepEqual(textHolds([{ id: 'S04', seconds: 1, shots: [{ text: 'One workspace, already connected' }], said: 'Tulvo puts all three in one workspace, already connected.' }]), []);
  assert.equal(textHolds([{ id: 'S05', seconds: 1, shots: [{ text: 'Half price ends Friday' }], said: 'Plug in the AI you already use.' }]).length, 1);
});

test('a scene\'s beat is checked against its lines; spanning beats is judged only on beats the script gives', async () => {
  const { sceneBeats } = await import('../lib/beats.mjs');
  const placed = [{ id: '01', beat: 'hook', how: 'given', start: 0.3, end: 3, text: 'a' }, { id: '02', beat: 'turn', how: 'given', start: 3.5, end: 6, text: 'b' }, { id: '03', beat: 'proof', how: 'by time', start: 6.5, end: 9, text: 'c' }, { id: '04', beat: 'peak', how: 'by time', start: 9.5, end: 11, text: 'd' }];
  const r = sceneBeats([{ id: 'S01', beat: 'turn', lines: ['01'] }, { id: 'S02', lines: ['02', '03'] }, { id: 'S03', lines: ['04'] }, { id: 'S04', silent: true, seconds: 2.5 }], placed, 14);
  assert.deepEqual(r.problems.map((p) => p.what), ['scene beat differs']); // S02 mixes a given beat with a guessed one: not judged
  assert.deepEqual(r.scenes.map((s) => s.seconds), [3.2, 6, 1.5, 2.5]); // S03 ends with the voice, before the silent end card
});

test('a script whose beats belong to another framework is placed by time, with one finding', () => {
  const other = { id: 'energy-curve', beats: [{ id: 'hook', name: 'Hook', job: 'j', size: null, seconds: [0, 2], required: true }, { id: 'build', name: 'Build', job: 'j', size: [0.25, 0.5], seconds: null, required: true },
    { id: 'apex', name: 'Apex', job: 'j', size: [0.2, 0.33], seconds: null, required: true }, { id: 'cta', name: 'CTA', job: 'j', size: [0.1, 0.2], seconds: null, required: true }] };
  const r = beatSheet({ lines: good, framework: other, duration: 34 });
  assert.deepEqual(r.problems.filter((p) => p.what === 'unknown beat'), []);
  assert.ok(r.problems.some((p) => p.what === 'beats from another framework')); assert.equal(r.guessed, true);
});

test('energy is one value per beat: lines of one beat count once', async () => {
  const { perBeat } = await import('../lib/beats.mjs');
  assert.deepEqual(perBeat([{ beat: 'hook', energy: 4 }, { beat: 'turn', energy: 2 }, { beat: 'proof', energy: 3 }, { beat: 'proof', energy: 3 }, { beat: 'proof', energy: 4 }]), [4, 2, 4]);
  const r = beatSheet({ lines: [L('01', 0.3, 3, 'hook', 4), L('02', 3.5, 6, 'turn', 1), L('03', 6.5, 11, 'proof', 3), L('04', 11.5, 16, 'proof', 3), L('05', 16.5, 21, 'proof', 3), L('06', 21.5, 25, 'proof', 3), L('07', 25.5, 28, 'offer', 5), L('08', 28.5, 31, 'close', 4)], framework: promo, duration: 34 });
  assert.ok(!r.problems.some((p) => p.what === 'energy flat'), JSON.stringify(r.problems)); // four proof lines at 3 are one beat at 3
});

test('a beat whose next beat is absent is measured on its own lines, not the gap', () => {
  const lines = [L('01', 0.3, 3.5, 'hook', 4), L('03', 12, 26, 'proof', 3), L('07', 26.5, 29.5, 'offer', 5), L('08', 30, 32, 'close', 4)];
  const r = beatSheet({ lines, framework: promo, duration: 34 });
  const hook = r.beats.find((b) => b.id === 'hook');
  assert.equal(hook.verdict, 'fits'); assert.match(hook.measured, /own lines/);
});

test('the hook deadline applies only to a hook', () => {
  const pain = { id: 'pain-reframe-promise', beats: [{ id: 'pain', name: 'Pain', job: 'j', size: [0.2, 0.34], seconds: null, required: true }, { id: 'reframe', name: 'Reframe', job: 'j', size: [0.35, 0.58], seconds: null, required: true }, { id: 'promise', name: 'Promise', job: 'j', size: [0.2, 0.34], seconds: null, required: true }] };
  const r = beatSheet({ lines: [L('01', 0.3, 5, 'pain'), L('02', 6, 9, 'pain'), L('03', 10, 21, 'reframe'), L('04', 22, 29, 'promise')], framework: pain, duration: 30, platform: 'reels' });
  assert.ok(!r.problems.some((p) => p.what === 'hook late'));
});
