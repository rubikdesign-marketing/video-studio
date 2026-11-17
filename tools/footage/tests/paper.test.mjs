// Tests for the paper edit, cut rules and rough-cut parts (FOOTAGE-PLAN.md phase 2). Fast: no ffmpeg, no transcriber.
// Run: node --test tools/footage/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CROSSFADE, bounds, lay } from '../lib/cut.mjs';
import { captionLines, firstPaper, guard, hookScore, likeness, propose, retakes, runsOf, sentences } from '../lib/paper.mjs';
import { compareWords, filmWords, pictures } from '../lib/rough.mjs';

/** Words from "text@start-end" with fillers marked as the transcriber marks them. */
const W = (spec) => spec.split(' | ').map((s) => { const [text, t] = s.split('@'); const [a, b] = t.split('-').map(Number); return { text, start: a, end: b }; });
const talk = () => {
  const w = W('Um,@0.6-0.9 | so@1.2-1.4 | today@1.4-1.7 | boards@1.7-2.1 | work.@2.1-2.5 | Every@3.4-3.6 | project@3.6-3.9 | starts.@3.9-4.3 | Every@5.0-5.2 | project@5.2-5.5 | starts,@5.5-5.9 | uh,@6.2-6.5 | with@6.8-7.0 | a@7.0-7.1 | board.@7.1-7.6 | You@9.8-10.0 | do@10.0-10.2 | not@10.2-10.4 | wait.@10.4-10.9');
  w[0].filler = 'yes'; w[11].filler = 'yes';
  return w;
};

test('sentences split at . ? ! or a long pause', () => {
  const w = talk();
  assert.deepEqual(sentences(w).map((s) => s.length), [5, 3, 7, 4]);
  const noPunct = W('one@0-0.2 | two@0.2-0.4 | three@2-2.2');
  assert.deepEqual(sentences(noPunct), [[0, 1], [2]]);
});

test('retakes and false starts are found, and the last complete take is proposed', () => {
  const w = talk();
  const s = sentences(w);
  assert.ok(likeness(['every', 'project', 'starts'], ['every', 'project', 'starts', 'with', 'a', 'board']) < 0.75);
  const r = retakes(w, s);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].takes, [1, 2]); // "Every project starts." is the opening of the next sentence
  assert.equal(r[0].keep, 2);
});

test('opening-line ideas give reasons, and a line that leans on what came before scores low', () => {
  const w = W('You@0-0.2 | can@0.2-0.4 | ship@0.4-0.6 | 3@0.6-0.8 | times@0.8-1 | faster?@1-1.4');
  const good = hookScore(w, [0, 1, 2, 3, 4, 5]);
  assert.ok(good.score >= 5);
  assert.ok(good.reasons.includes('speaks to the viewer') && good.reasons.includes('has a number') && good.reasons.includes('asks a question'));
  const back = W('It@0-0.2 | does@0.2-0.4 | that@0.4-0.6 | for@0.6-0.8 | you.@0.8-1');
  assert.ok(hookScore(back, [0, 1, 2, 3, 4]).reasons.includes('leans on something said before'));
});

test('the first paper edit strikes fillers and the set-aside take, and lists long pauses', () => {
  const w = talk();
  const p = firstPaper('job', [{ name: 'a', words: w }], { energy: 'confident' });
  assert.deepEqual(p.blocks.map((b) => b.words.length), [4, 0, 6, 4]);
  assert.ok(!p.blocks[0].words.includes(0)); // "Um," struck
  assert.ok(!p.blocks[2].words.includes(11)); // "uh," struck
  assert.ok(p.proposals.pauses.some((x) => x.after === 14)); // 2.2 s after "board."
  assert.equal(propose([{ name: 'a', words: w }], { energy: 'hype' }).breath, 0.25);
});

test('runs: words said together form one run; a long pause inside is shortened; struck words break a run', () => {
  const w = talk();
  const p = firstPaper('job', [{ name: 'a', words: w }]);
  const runs = runsOf(p, () => w);
  assert.deepEqual(runs.map((r) => r.words), [[1, 2, 3, 4], [8, 9, 10], [12, 13, 14], [15, 16, 17, 18]]);
  const one = { energy: 'confident', blocks: [{ clip: 'a', sentence: 0, words: [5, 6, 7, 8, 9, 10] }], keep_pauses: [] };
  const r2 = runsOf(one, () => w);
  assert.equal(r2.length, 2); // the 0.7 s pause after "starts." is longer than a sentence breath: shortened
  assert.equal(r2[1].pauseCut.after, 0.5);
  assert.equal(runsOf({ ...one, keep_pauses: ['a:7'] }, () => w).length, 1); // unless it is kept
});

test('the meaning guard passes fillers, pauses and whole sentences, and flags words joined inside a sentence', () => {
  const w = talk();
  const of = () => w;
  const run = (words) => ({ clip: 'a', words });
  assert.equal(guard(run([8, 9, 10]), run([12, 13, 14]), of).kind, 'filler');
  assert.equal(guard(run([8, 9, 10]), run([11, 12]), of).kind, 'pause');
  assert.equal(guard(run([1, 2, 3, 4]), run([8, 9]), of).flagged, false); // a sentence dropped
  const notLost = guard(run([15, 16]), run([18]), of); // "You do … wait." loses "not"
  assert.equal(notLost.flagged, true);
  assert.ok(notLost.reasons.some((r) => r.includes('"not"')));
  const takes = guard(run([8, 9]), { clip: 'b', words: [3] }, (c) => (c === 'a' ? w : W('x@0-1 | y@1-2 | z@2-3 | board.@3-4')));
  assert.ok(takes.reasons[0].includes('different takes'));
});

test('cut points stay out of struck words, and a breath is filled with room tone only when the footage is short of quiet', () => {
  const w = talk();
  const p = firstPaper('job', [{ name: 'a', words: w }]);
  const runs = runsOf(p, () => w);
  const b = bounds(runs, () => w, { durations: { a: 12 } });
  assert.ok(b[0].inLo >= w[0].start); // the struck "Um," touches nothing: the cut may start after it
  assert.ok(b[1].outHi <= w[11].start + 0.4 * (w[11].end - w[11].start) + 1e-9); // never far into the struck "uh,"
  const placed = b.map((x) => ({ ...x, in: x.inT, out: x.outT }));
  const laid = lay(runs, placed, () => w, p);
  assert.equal(laid.unanswered, 0);
  assert.ok(laid.pieces.every((x, i) => i === 0 || Math.abs(x.at - (laid.pieces[i - 1].at + laid.pieces[i - 1].dur - CROSSFADE)) < 1e-6));
  assert.ok(Math.abs(laid.duration - (laid.pieces.at(-1).at + laid.pieces.at(-1).dur)) < 0.002);
});

test('captions break at clauses within 42 characters; the film\'s words land on the film clock', () => {
  const words = 'This is a fairly long sentence, with a clause, that keeps going on and on.'.split(' ').map((t, i) => ({ text: t, start: i * 0.3, end: i * 0.3 + 0.25 }));
  const lines = captionLines(words);
  assert.ok(lines.length >= 2 && lines.every((l) => l.words.map((x) => x.text).join(' ').length <= 42));
  const cut = { duration: 2, pieces: [{ kind: 'speech', clip: 'a', in: 1, out: 2, at: 0, dur: 1, words: [0] }, { kind: 'speech', clip: 'a', in: 5, out: 6, at: 0.985, dur: 1, words: [1] }] };
  const fw = filmWords(cut, () => [{ text: 'one', start: 1.2, end: 1.6 }, { text: 'two', start: 5.1, end: 5.5 }]);
  assert.deepEqual(fw.map((x) => x.start), [0.2, 1.085]);
});

test('pictures switch mid-crossfade and a room-tone gap holds the last frame', () => {
  const cut = { duration: 2.97, pieces: [
    { kind: 'speech', clip: 'a', in: 1, out: 2, at: 0, dur: 1 },
    { kind: 'room tone', clip: 'a', in: 0, out: 0.5, at: 0.985, dur: 0.5 },
    { kind: 'speech', clip: 'a', in: 4, out: 5.5, at: 1.47, dur: 1.5 },
  ] };
  const p = pictures(cut, 30, (c) => `jobs/x/edit/${c}.mp4`);
  assert.deepEqual(p.map((x) => x.from), [0, 30, 44]);
  assert.equal(p[0].trim, 30);
  assert.equal(p[1].freeze, true);
  assert.equal(p[1].trim, 59); // the last frame of the first piece
  assert.equal(p.reduce((n, x) => n + x.frames, 0), Math.round(2.97 * 30));
});

test('listening back finds a struck word that leaked in and a kept word that went missing', () => {
  const r = compareWords(['so', 'today', 'boards', 'work.'], ['so', 'uh', 'today', 'work']);
  assert.deepEqual(r.missing, ['boards']);
  assert.deepEqual(r.extra, ['uh']);
  assert.equal(r.matched, 3);
});
