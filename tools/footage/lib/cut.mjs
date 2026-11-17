// The cut list (FOOTAGE-PLAN.md section 4.3): the paper edit turned into pieces of footage with exact in and out
// points, a breath between them, the clip's own room tone where a breath needs more quiet than the footage has, and
// the meaning guard's verdict on every join.
//
// cutlist.json: { version, job, made, energy, crossfade, duration, pieces, joins, unanswered }
//   pieces: [{ kind: "speech" | "room tone", clip, in, out, at, dur, words: [i...] }]   in/out: the clip's seconds;
//           at: where it starts in the film (pieces overlap by the crossfade)
//   joins:  [{ after, key, kind, flagged, reasons, dropped, before, next, approved }]
import fs from 'node:fs';
import path from 'node:path';
import { py, readJson, round } from './common.mjs';
import { BREATH, SENTENCE_BREATH, guard, joinKey, key, runsOf } from './paper.mjs';

export const CROSSFADE = 0.015;   // every sound cut fades across 15 ms, so it never clicks
const PAD_IN = 0.08;              // room before the first sound of a word
const PAD_OUT = 0.1;              // room after the last sound of a word
const NOISY_EXTRA = 0.06;         // in noise a word's quiet tail is lost to the transcriber: more room after it
const LEAD = 0.25;                // before the film's first word
const TAIL = 0.4;                 // after its last word
const ENDS = /[.?!…]["'’”)\]]*$/;

/**
 * Where each run's in and out points should go, before they are placed on the quietest moment nearby, and the
 * breath wanted after each run. Pure.
 */
export function bounds(runs, wordsOf, { energy = 'confident', noisy = new Set(), durations = {} } = {}) {
  const breath = BREATH[energy] ?? BREATH.confident;
  // The breath wanted at each join: a sentence's breath between sentences, a short one inside a sentence (where only
  // fillers went); a shortened pause brings its own (runsOf decided it).
  const joined = runs.map((r, k) => { const n = runs[k + 1]; return !!n && n.clip === r.clip && n.words[0] === r.words.at(-1) + 1; });
  const want = runs.map((r, k) => (runs[k + 1] && !joined[k] ? (ENDS.test(wordsOf(r.clip)[r.words.at(-1)].text) ? breath + SENTENCE_BREATH : 0.14) : 0));
  return runs.map((r, k) => {
    const w = wordsOf(r.clip);
    const first = r.words[0]; const last = r.words.at(-1);
    const pw = first > 0 ? w[first - 1] : null; // the word said just before, which is not in this piece
    const nw = last + 1 < w.length ? w[last + 1] : null; // the word said just after
    const prevSrcEnd = pw ? pw.end : 0;
    const nextSrcStart = nw ? nw.start : durations[r.clip] ?? r.end + 2;
    const prev = runs[k - 1]; const next = runs[k + 1];
    const padOut = PAD_OUT + (noisy.has(r.clip) ? NOISY_EXTRA : 0);
    // Where a struck word runs straight into a kept one, the transcript cannot say exactly where one ends: the cut is
    // placed on the quiet dip between them, searched from the middle of the struck word.
    const touchingBefore = pw && r.start - pw.end < 0.06;
    const touchingAfter = nw && nw.start - r.end < 0.06;
    let inT; let inLo; let inHi;
    if (prev && joined[k - 1]) { const half = r.pauseCut.after / 2; inT = r.start - half; inLo = r.start - half - 0.04; inHi = r.start - 0.03; }
    else {
      const room = !prev ? LEAD : Math.max(PAD_IN, want[k - 1] / 2);
      inT = r.start - room;
      inLo = touchingBefore ? pw.start + 0.6 * (pw.end - pw.start) : Math.max(prevSrcEnd + 0.01, inT - 0.05);
      inHi = touchingBefore ? r.start + 0.05 : r.start - 0.02;
    }
    let outT; let outLo; let outHi;
    if (next && joined[k]) { const half = next.pauseCut.after / 2; outT = r.end + half; outLo = r.end + 0.04; outHi = r.end + half + 0.04; }
    else {
      const room = !next ? TAIL : Math.max(padOut, want[k] / 2);
      outT = r.end + room;
      if (touchingAfter) { outLo = r.words.length > 1 ? r.end - 0.4 * (r.end - w[last].start) : r.end - 0.02; outHi = nw.start + 0.4 * (nw.end - nw.start); }
      else { outLo = r.end + Math.min(padOut, room) - 0.03; outHi = Math.min(nextSrcStart - 0.01, outT + 0.06); }
    }
    if (!touchingBefore) { inLo = Math.max(inLo, prevSrcEnd + 0.005); }
    inHi = Math.max(inHi, inLo); inT = Math.min(Math.max(inT, inLo), inHi);
    if (!touchingAfter) outHi = Math.min(outHi, nextSrcStart - 0.005);
    outLo = Math.min(outLo, outHi); outT = Math.min(Math.max(outT, outLo), outHi);
    return { inT: round(inT, 4), inLo: round(Math.max(0, inLo), 4), inHi: round(inHi, 4), outT: round(outT, 4), outLo: round(outLo, 4), outHi: round(outHi, 4), wantBreath: want[k], joinedAfter: joined[k],
      touchingBefore: !!touchingBefore && !(prev && joined[k - 1]), touchingAfter: !!touchingAfter && !(next && joined[k]), padOut };
  });
}

/** Lays pieces end to end with the crossfade, adds room tone where a breath is short, and lists the joins. Pure. */
export function lay(runs, placed, wordsOf, paper) {
  const pieces = []; const joins = [];
  let at = 0;
  const approved = new Set(paper.approved_joins || []);
  const push = (p) => { const dur = round(p.out - p.in, 4); pieces.push({ ...p, at: round(at, 4), dur }); at += dur - CROSSFADE; };
  runs.forEach((r, k) => {
    const pl = placed[k];
    push({ kind: 'speech', clip: r.clip, in: pl.in, out: pl.out, words: r.words });
    const next = runs[k + 1];
    if (!next) return;
    const w = wordsOf(r.clip); const wn = wordsOf(next.clip);
    const g = guard(r, next, wordsOf);
    const jk = joinKey(key(r.clip, r.words.at(-1)), key(next.clip, next.words[0]));
    joins.push({ after: pieces.length - 1, key: jk, kind: g.kind, flagged: g.flagged, reasons: g.reasons, dropped: g.dropped,
      before: r.words.slice(-6).map((i) => w[i].text).join(' '), next: next.words.slice(0, 6).map((i) => wn[i].text).join(' '), approved: g.flagged ? approved.has(jk) : true });
    // The quiet kept on each side. Where a struck word touched the kept one, the transcript's edge is not to be
    // trusted: the cut sits a pad's width into the dip, so that is the quiet kept.
    const have = (pl.touchingAfter ? pl.padOut : pl.out - r.end) + (placed[k + 1].touchingBefore ? PAD_IN : next.start - placed[k + 1].in);
    const short = pl.wantBreath - have;
    if (!pl.joinedAfter && short > 0.03) push({ kind: 'room tone', clip: r.clip, in: 0, out: round(short + CROSSFADE * 2, 4), words: [] });
  });
  const duration = round(at + CROSSFADE, 3);
  return { pieces, joins, duration, unanswered: joins.filter((j) => j.flagged && !j.approved).length };
}

/** Builds jobs/<job>/edit/cutlist.json from paper.json. Returns the cut list. */
export function buildCutlist(job) {
  const edit = path.join(job, 'edit');
  const paper = readJson(path.join(edit, 'paper.json'), null);
  if (!paper) throw new Error('There is no paper edit yet (edit/paper.json). Run: footage.mjs paper <job>');
  const cut = planCut(job, paper);
  fs.writeFileSync(path.join(edit, 'cutlist.json'), `${JSON.stringify(cut, null, 1)}\n`);
  return cut;
}

/** The cut list for a paper edit, without writing it (the transcript page plays these exact cut points). */
export function planCut(job, paper) {
  const edit = path.join(job, 'edit');
  const cache = {};
  const wordsOf = (clip) => (cache[clip] ??= readJson(path.join(edit, 'clips', clip, 'words.json')).words);
  const clipInfo = (clip) => readJson(path.join(edit, 'clips', clip, 'clip.json'));
  const quality = (clip) => readJson(path.join(edit, 'clips', clip, 'quality.json'), {});
  const runs = runsOf(paper, wordsOf);
  if (!runs.length) throw new Error('The paper edit keeps no words.');
  const clips = [...new Set(runs.map((r) => r.clip))];
  const noisy = new Set(clips.filter((c) => { const s = quality(c).sound; return s?.flags?.some((f) => f.what === 'noisy' || f.what === 'music under speech') || (s?.summary?.clarity_db ?? 99) < 30; }));
  const durations = Object.fromEntries(clips.map((c) => [c, clipInfo(c).source.measured.duration]));
  const b = bounds(runs, wordsOf, { energy: paper.energy, noisy, durations });
  // Place every in and out point on the quietest moment of its window, one call per clip.
  const placed = b.map((x) => ({ ...x }));
  for (const clip of clips) {
    const idx = runs.map((r, k) => (r.clip === clip ? k : -1)).filter((k) => k >= 0);
    const reqs = idx.flatMap((k) => [
      { t: b[k].inT, lo: b[k].inLo, hi: b[k].inHi, ...(b[k].touchingBefore ? { side: 'in', pad: PAD_IN } : {}) },
      { t: b[k].outT, lo: b[k].outLo, hi: b[k].outHi, ...(b[k].touchingAfter ? { side: 'out', pad: b[k].padOut } : {}) },
    ]);
    const got = JSON.parse(py('cutpoints', ['points', path.join(edit, 'clips', clip, 'sound.wav')], { input: JSON.stringify(reqs) }));
    idx.forEach((k, n) => { placed[k].in = got[2 * n]; placed[k].out = got[2 * n + 1]; });
  }
  const laid = lay(runs, placed, wordsOf, paper);
  return { version: 1, job: path.basename(path.resolve(job)), made: new Date().toISOString(), energy: paper.energy, crossfade: CROSSFADE, ...laid };
}
