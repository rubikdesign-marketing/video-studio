// Choosing and measuring hooks (LIBRARY-PLAN.md phase 1). Pure. Judging a hook (is it confusing, is it relevant) is
// done by a person or by Claude from the rubric in knowledge/craft/15-hooks.md; this file only filters and measures.
import { wordCount } from './library.mjs';

/**
 * Formulas that suit a brief, one per family where possible. Filters by suits (a filter left out matches everything),
 * drops the excluded ids, then deals families in rotation in a fixed order, so the same brief gives the same answer.
 */
export function find(lib, { type, platform, awareness, exclude = [], n = 5 } = {}) {
  const ok = (list, want) => !want || (list || []).includes(want);
  const matched = lib.formulas.filter((f) => !exclude.includes(f.id) && ok(f.suits?.types, type) && ok(f.suits?.platforms, platform) && ok(f.suits?.awareness, awareness))
    .sort((a, b) => a.id.localeCompare(b.id));
  const byFamily = new Map();
  for (const f of matched) { if (!byFamily.has(f.family)) byFamily.set(f.family, []); byFamily.get(f.family).push(f); }
  const families = [...byFamily.keys()].sort();
  const picks = [];
  for (let round = 0; picks.length < n && round < matched.length; round++) {
    for (const fam of families) { const f = byFamily.get(fam)[round]; if (f && picks.length < n) picks.push(f); }
  }
  return { picks, asked: n, matched: matched.length };
}

/** The hook formulas a brand used in its last few films (ledger.json records with "hook_formula"). */
export function usedByBrand(ledger, last = 5) {
  return (Array.isArray(ledger) ? ledger : []).slice(-last).map((r) => r.hook_formula).filter(Boolean);
}

/**
 * What can be measured about a written hook: its length, how long it takes to say at wps words a second, how long
 * before its first claim is out (the end of its first clause of three words or more), and any opener on the avoid list.
 */
export function measure(spoken, { onScreen = '', avoid = [], wps = 2.5 } = {}) {
  const words = wordCount(spoken);
  // The first claim: the first clause of at least three words (a name called out, "Founders," is not a claim yet).
  let firstClause = '';
  for (const part of String(spoken).split(/[,.?!:;]|\s[–—-]\s/)) { firstClause = `${firstClause} ${part}`.trim(); if (wordCount(firstClause) >= 3) break; }
  const round = (v) => Math.round(v * 10) / 10;
  const out = {
    words, seconds: round(words / wps), on_screen_words: wordCount(onScreen), first_claim_seconds: round(wordCount(firstClause) / wps),
    // Curly apostrophes are read as straight ones, so "we’re" and "we're" are the same opener.
    avoid_hits: avoid.filter((a) => typeof a.pattern === 'string' && a.pattern.trim() && new RegExp(a.pattern, 'i').test(String(spoken).replace(/[\u2018\u2019\u02BC]/g, "'"))).map(({ pattern, why }) => ({ pattern, why })), notes: [],
  };
  if (out.first_claim_seconds > 3) out.notes.push(`the claim lands after 3 s (${out.first_claim_seconds} s at ${wps} words a second): shorten the first clause`);
  if (out.seconds > 5) out.notes.push(`the whole line takes ${out.seconds} s to say: a hook is said inside 3 to 5 s`);
  if (out.on_screen_words > 7) out.notes.push(`the on-screen line has ${out.on_screen_words} words: 7 at most`);
  if (onScreen && onScreen.trim().toLowerCase() === String(spoken).trim().toLowerCase()) out.notes.push('the on-screen line repeats the spoken line word for word: let it add or sharpen instead');
  for (const h of out.avoid_hits) out.notes.push(`opens in a way to avoid: ${h.why}`);
  return out;
}
