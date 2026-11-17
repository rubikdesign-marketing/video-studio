// The paper edit (FOOTAGE-PLAN.md section 4): sentences, what the tool proposes before a person decides, and the
// paper edit itself (paper.json). Pure: no files, no programs.
//
// A word is named "<clip>:<index>" (its place in that clip's words.json). paper.json holds the film as blocks in
// film order, each block a run of one clip's words that are kept:
//   { version: 1, job, status: "draft" | "sent", approved, target_seconds, energy,
//     blocks: [{ clip, sentence, words: [i, ...] }], keep_pauses: ["clip:i"], approved_joins: ["clip:i>clip:j"],
//     proposals: {...}, note }
// A block is one sentence, so reordering moves whole sentences. A struck word is simply missing from its block.
import { bare } from './transcribe.mjs';

const ENDS = /[.?!…]["'’”)\]]*$/;
const CLAUSE = /[,;:—–-]["'’”)\]]*$/;
/** Words that change meaning when lost from inside a sentence. */
const RISKY = new Set(['not', 'no', 'never', 'none', 'nothing', 'only', 'without', 'dont', "don't", 'cant', "can't", 'wont', "won't", 'isnt', "isn't", 'doesnt', "doesn't", 'didnt', "didn't", 'wasnt', "wasn't", 'arent', "aren't", 'shouldnt', "shouldn't", 'except', 'unless', 'but']);
const STARTS_WEAK = new Set(['and', 'so', 'but', 'because', 'which', 'or', 'then', 'also', 'um', 'uh', 'like', 'well', 'yeah', 'okay']);
const REFERS_BACK = new Set(['it', 'this', 'that', 'they', 'he', 'she', 'these', 'those', 'there', 'them']);

export const key = (clip, i) => `${clip}:${i}`;
export const joinKey = (a, b) => `${a}>${b}`;

/** Breath kept between words when a pause is shortened, by energy preset (FOOTAGE-PLAN.md 4.2). */
export const BREATH = { hype: 0.25, confident: 0.35, calm: 0.45 };
/** A little more breath between sentences than inside one. */
export const SENTENCE_BREATH = 0.15;

/** Splits a clip's words into sentences: at . ? ! or, failing punctuation, at a pause of 1.2 s or more. Pure. */
export function sentences(words) {
  const out = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(i);
    const next = words[i + 1];
    if (!next || ENDS.test(w.text) || next.start - w.end >= 1.2) { out.push(cur); cur = []; }
  });
  return out;
}

const textOf = (words, idx) => idx.map((i) => words[i].text).join(' ');
const contentTokens = (words, idx) => idx.filter((i) => words[i].filler !== 'yes').map((i) => bare(words[i].text)).filter(Boolean);

/** How alike two token lists are: shared tokens over the longer list (order ignored). Pure. */
export function likeness(a, b) {
  if (!a.length || !b.length) return 0;
  const pool = [...b];
  let same = 0;
  for (const t of a) { const k = pool.indexOf(t); if (k >= 0) { same++; pool.splice(k, 1); } }
  return same / Math.max(a.length, b.length);
}

/**
 * Retakes: the same sentence said more than once in a clip (75% or more of its words alike, within two minutes), and
 * false starts (a sentence that is the opening of the next one). For each group, the last complete take is proposed.
 * Returns [{ takes: [sentenceIndex...], keep: sentenceIndex, reason }]. Pure.
 */
export function retakes(words, sents) {
  const groups = [];
  const used = new Set();
  sents.forEach((s, a) => {
    if (used.has(a)) return;
    const ta = contentTokens(words, s);
    if (ta.length < 3) return;
    const takes = [a];
    for (let b = a + 1; b < sents.length; b++) {
      const sb = sents[b];
      if (words[sb[0]].start - words[s.at(-1)].end > 120) break;
      const tb = contentTokens(words, sb);
      const alike = likeness(ta, tb) >= 0.75;
      const falseStart = ta.length < tb.length && tb.slice(0, ta.length).join(' ') === ta.join(' ');
      if (alike || falseStart) { takes.push(b); used.add(b); }
    }
    if (takes.length > 1) {
      const complete = takes.filter((t) => ENDS.test(words[sents[t].at(-1)].text));
      const longest = Math.max(...takes.map((t) => contentTokens(words, sents[t]).length));
      const full = complete.filter((t) => contentTokens(words, sents[t]).length >= longest * 0.9);
      const keep = (full.length ? full : complete.length ? complete : takes).at(-1);
      groups.push({ takes, keep, reason: `said ${takes.length} times; the last complete take is proposed` });
    }
  });
  return groups;
}

/** How good a sentence would be as the film's first line, with its reasons. Pure. */
export function hookScore(words, idx) {
  const list = idx.map((i) => words[i]);
  const content = list.filter((w) => w.filler !== 'yes');
  const n = content.length;
  const reasons = [];
  let score = 0;
  if (n < 4) return { score: -10, reasons: ['too short to stand alone'] };
  if (n <= 14) { score += 1; reasons.push('short'); } else if (n > 25) { score -= 2; reasons.push('long'); }
  const first = bare(content[0].text);
  if (STARTS_WEAK.has(first)) { score -= 2; reasons.push(`starts with "${content[0].text.replace(/[,.]$/, '')}"`); }
  if (REFERS_BACK.has(first)) { score -= 3; reasons.push('leans on something said before'); }
  const toks = content.map((w) => bare(w.text));
  if (toks.some((t) => t === 'you' || t === 'your' || t === "you're")) { score += 2; reasons.push('speaks to the viewer'); }
  if (content.some((w) => /\d/.test(w.text) || /^(one|two|three|four|five|ten|twenty|hundred|thousand|million|half|double|twice)$/i.test(bare(w.text)))) { score += 2; reasons.push('has a number'); }
  if (/\?["'’”)\]]*$/.test(content.at(-1).text)) { score += 2; reasons.push('asks a question'); }
  if (toks.some((t) => ['new', 'never', 'stop', 'finally', 'without', 'every', 'instantly', 'fastest', 'easiest', 'only', 'secret', 'mistake'].includes(t))) { score += 1; reasons.push('makes a claim'); }
  const fillers = list.filter((w) => w.filler === 'yes').length;
  if (fillers) { score -= fillers; reasons.push(`${fillers} filler${fillers > 1 ? 's' : ''} to cut`); }
  return { score, reasons };
}

/**
 * What the tool proposes before a person decides (FOOTAGE-PLAN.md 4.2), for every clip:
 * hook candidates, retakes, fillers and dead air. clips: [{ name, words }]. Pure.
 */
export function propose(clips, { energy = 'confident' } = {}) {
  const breath = BREATH[energy] ?? BREATH.confident;
  const hooks = [];
  const retakeList = [];
  const fillers = [];
  const pauses = [];
  for (const { name, words } of clips) {
    const sents = sentences(words);
    sents.forEach((s, si) => {
      const h = hookScore(words, s);
      hooks.push({ clip: name, sentence: si, text: textOf(words, s), score: h.score, reasons: h.reasons });
    });
    for (const g of retakes(words, sents)) retakeList.push({ clip: name, ...g, texts: g.takes.map((t) => textOf(words, sents[t])) });
    words.forEach((w, i) => {
      if (w.filler === 'yes' || w.repeat) fillers.push({ clip: name, word: i, text: w.text, sure: true });
      else if (w.filler === 'maybe') fillers.push({ clip: name, word: i, text: w.text, sure: false });
      const next = words[i + 1];
      if (next) {
        const gap = next.start - w.end;
        const between = ENDS.test(w.text);
        const allowed = breath + (between ? SENTENCE_BREATH : 0);
        if (gap > allowed + 0.15) pauses.push({ clip: name, after: i, seconds: Math.round(gap * 100) / 100, to: Math.round(allowed * 100) / 100 });
      }
    });
  }
  hooks.sort((a, b) => b.score - a.score);
  return { hooks: hooks.slice(0, 3), retakes: retakeList, fillers, pauses, breath };
}

/** The first paper edit: every sentence in clip order, fillers struck, retakes but the proposed one struck. Pure. */
export function firstPaper(job, clips, { energy = 'confident', target } = {}) {
  const proposals = propose(clips, { energy });
  const blocks = [];
  for (const { name, words } of clips) {
    const sents = sentences(words);
    const dropped = new Set(proposals.retakes.filter((r) => r.clip === name).flatMap((r) => r.takes.filter((t) => t !== r.keep)));
    sents.forEach((s, si) => {
      if (dropped.has(si)) { blocks.push({ clip: name, sentence: si, words: [], struck: 'retake' }); return; }
      blocks.push({ clip: name, sentence: si, words: s.filter((i) => words[i].filler !== 'yes' && !words[i].repeat) });
    });
  }
  return { version: 1, job, status: 'draft', approved: false, target_seconds: target ?? null, energy, blocks, keep_pauses: [], approved_joins: [], proposals, note: '' };
}

/**
 * The film's pieces from a paper edit (FOOTAGE-PLAN.md 4.3): each run of words said together becomes a piece, and a
 * pause inside a run longer than the breath allows is shortened (a cut inside the same take). Times are in the
 * clip's own seconds; cut points are placed later on the sound (padding and the quietest moment nearby).
 * Returns [{ clip, words: [i...], start, end }] in film order. Pure.
 */
export function runsOf(paper, wordsOf) {
  const breath = BREATH[paper.energy] ?? BREATH.confident;
  const keepPause = new Set(paper.keep_pauses || []);
  const runs = [];
  for (const b of paper.blocks) {
    const words = wordsOf(b.clip);
    let cur = null;
    for (const i of b.words) {
      const prev = cur?.words.at(-1);
      const together = cur && i === prev + 1;
      const gap = together ? words[i].start - words[prev].end : 0;
      const allowed = breath + (ENDS.test(words[prev ?? i].text) ? SENTENCE_BREATH : 0);
      const shorten = together && gap > allowed + 0.05 && !keepPause.has(key(b.clip, prev));
      if (!cur || !together || shorten) {
        if (cur) runs.push(cur);
        cur = { clip: b.clip, words: [i], pauseCut: shorten ? { before: Math.round(gap * 1000) / 1000, after: allowed } : null };
      } else cur.words.push(i);
    }
    if (cur) runs.push(cur);
  }
  // Two blocks that continue each other in the same clip (one sentence after the next, nothing between) are one run.
  const merged = [];
  for (const r of runs) {
    const last = merged.at(-1);
    if (last && last.clip === r.clip && r.words[0] === last.words.at(-1) + 1 && !r.pauseCut) {
      const words = wordsOf(r.clip);
      const gap = words[r.words[0]].start - words[last.words.at(-1)].end;
      const allowed = breath + SENTENCE_BREATH;
      if (gap <= allowed + 0.05 || keepPause.has(key(r.clip, last.words.at(-1)))) { last.words.push(...r.words); continue; }
      merged.push({ ...r, pauseCut: { before: Math.round(gap * 1000) / 1000, after: allowed } });
      continue;
    }
    merged.push(r);
  }
  return merged.map((r) => { const w = wordsOf(r.clip); return { ...r, start: w[r.words[0]].start, end: w[r.words.at(-1)].end }; });
}

/**
 * The meaning guard (FOOTAGE-PLAN.md 4.3) for the join between two runs. Clean: a shortened pause, or only fillers
 * and repeats dropped, or whole sentences dropped or moved. Flagged: words said apart joined inside a sentence (with
 * any "not", number or name lost), or two takes joined inside a sentence. Returns { kind, flagged, reasons, dropped }. Pure.
 */
export function guard(a, b, wordsOf) {
  const wa = wordsOf(a.clip); const wb = wordsOf(b.clip);
  const last = a.words.at(-1); const first = b.words[0];
  const before = wa[last]; const after = wb[first];
  // Fillers struck at a sentence's start or end do not make a join "inside" it: look past them.
  const isFiller = (w) => w.filler === 'yes' || w.filler === 'maybe' || w.repeat;
  let fa = last; while (fa + 1 < wa.length && isFiller(wa[fa + 1]) && !ENDS.test(wa[fa].text)) fa++;
  const endsSentence = ENDS.test(before.text) || (fa > last && ENDS.test(wa[fa].text)) || fa + 1 >= wa.length;
  const boundary = (i) => i === 0 || ENDS.test(wb[i - 1].text) || wb[i].start - wb[i - 1].end >= 1.2;
  let sb = first; while (!boundary(sb) && isFiller(wb[sb - 1])) sb--;
  const startsSentence = boundary(sb);
  const inside = !endsSentence || !startsSentence;
  if (a.clip === b.clip && first === last + 1) return { kind: 'pause', flagged: false, reasons: [], dropped: [] };
  const dropped = a.clip === b.clip && first > last ? wa.slice(last + 1, first).map((w, k) => ({ ...w, i: last + 1 + k })) : [];
  const onlyFillers = a.clip === b.clip && first > last && dropped.every((w) => w.filler === 'yes' || w.filler === 'maybe' || w.repeat);
  if (onlyFillers) return { kind: 'filler', flagged: false, reasons: [], dropped: dropped.map((w) => w.text) };
  if (!inside) return { kind: a.clip === b.clip && first > last ? 'sentences dropped' : 'moved', flagged: false, reasons: [], dropped: dropped.map((w) => w.text) };
  const reasons = [];
  if (a.clip !== b.clip || first < last) reasons.push('joins words from different takes inside a sentence');
  else reasons.push('joins words said apart inside a sentence');
  const lost = dropped.filter((w) => RISKY.has(bare(w.text)) || /\d/.test(w.text) || (/^[A-Z]/.test(w.text) && w.i > 0 && !ENDS.test(wa[w.i - 1].text) && bare(w.text) !== 'i'));
  if (lost.length) reasons.push(`drops ${lost.map((w) => `"${w.text.replace(/[,.;:!?]+$/, '')}"`).join(', ')}`);
  return { kind: 'inside a sentence', flagged: true, reasons, dropped: dropped.map((w) => w.text) };
}

/** Caption lines from the film's words (same rules as tools/film/captions.mjs: 42 characters, breaks at clauses and pauses). Pure. */
export function captionLines(words, { max = 42, pause = 0.25, bonus = 14 } = {}) {
  const len = (ws) => ws.map((w) => w.text).join(' ').length;
  const split = (ws) => {
    const length = len(ws);
    if (length <= max || ws.length < 4) return [ws];
    const lines = Math.ceil(length / max);
    const target = (length * Math.floor(lines / 2)) / lines;
    let best = 2; let bestCost = Infinity;
    for (let i = 2; i <= ws.length - 2; i++) {
      const natural = ENDS.test(ws[i - 1].text) || CLAUSE.test(ws[i - 1].text) || ws[i].start - ws[i - 1].end >= pause;
      const cost = Math.abs(len(ws.slice(0, i)) - target) - (natural ? bonus : 0);
      if (cost < bestCost) [best, bestCost] = [i, cost];
    }
    return [...split(ws.slice(0, best)), ...split(ws.slice(best))];
  };
  // Phrases end at a sentence end or a pause of 0.6 s; each phrase is split into lines.
  const phrases = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const n = words[i + 1];
    if (!n || ENDS.test(w.text) || n.start - w.end >= 0.6) { phrases.push(cur); cur = []; }
  });
  return phrases.flatMap(split).map((ws) => ({ start: ws[0].start, end: ws.at(-1).end, words: ws.map(({ text, start, end }) => ({ text, start, end })) }));
}
