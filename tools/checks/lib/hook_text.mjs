// Judging a film's opening text (LIBRARY-PLAN.md phase 1; knowledge/craft/15-hooks.md "The written line"). Pure: the
// tool (tools/checks/hook_legible.mjs) reads the frames and hands the lines here.
//
// The rule (from win4r/video-director, MIT): a viewer with the sound off must be able to read the hook's written line
// by 3.0 s. That takes type of at least 84 px on a frame whose short side is 1080 (7.8% of the short side) and a
// contrast of at least 7:1 between the letters and what is behind them.

const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
/** Relative luminance of an [r, g, b] colour (0 to 255 each), as WCAG defines it. */
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
/** The WCAG contrast ratio between two colours: 1 (the same) to 21 (black on white). */
export function contrast(ink, ground) {
  const a = luminance(ink); const b = luminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The letters' colour and the colour behind them, from the pixels of a line's box ([r, g, b, r, g, b, ...]). The
 * pixels are split at the middle of their brightness range; the smaller group is the letters. Null when the box is
 * one flat colour.
 */
export function inkAndGround(rgb) {
  const n = rgb.length / 3; if (n < 8) return null;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.2126 * rgb[3 * i] + 0.7152 * rgb[3 * i + 1] + 0.0722 * rgb[3 * i + 2];
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(0.02 * (n - 1))]; const hi = sorted[Math.floor(0.98 * (n - 1))];
  if (hi - lo < 6) return null;
  const mid = (lo + hi) / 2;
  const sum = [[0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < n; i++) { const g = sum[lum[i] > mid ? 1 : 0]; g[0] += rgb[3 * i]; g[1] += rgb[3 * i + 1]; g[2] += rgb[3 * i + 2]; g[3]++; }
  const mean = (g) => [g[0] / g[3], g[1] / g[3], g[2] / g[3]];
  const [dark, light] = sum;
  if (!dark[3] || !light[3]) return null;
  return dark[3] <= light[3] ? { ink: mean(dark), ground: mean(light) } : { ink: mean(light), ground: mean(dark) };
}

/** The words of a line that can be matched: three letters or figures or more (shorter ones are not read reliably from a frame). */
export const wordsOf = (s) => String(s).toLowerCase().normalize('NFC').match(/[\p{L}\p{M}\p{N}]{3,}/gu) || [];

/**
 * Judges the opening. samples: [{ t, lines: [{ text, share (type size as % of the frame's short side), contrast }] }]
 * in time order. A line counts when it is big enough and contrasty enough.
 *
 * Without `expect`: passes when a moment at or before `by` seconds has a counting line (any large clear text).
 * With `expect` (the hook's written line): its words are added up over time, because a hook may arrive one word at a
 * time or wrap over lines; it passes when at least half of them have been on screen in counting lines by `by`. When
 * it fails, the reason is about the hook's own words: never seen, seen too late, too small, or too faint.
 */
export function judgeHook(samples, { minShare = 7.8, minContrast = 7, by = 3.0, expect = '', duration = null } = {}) {
  const want = [...new Set(wordsOf(expect))];
  const need = Math.ceil(want.length / 2);
  const counts = (l) => l.share >= minShare && l.contrast >= minContrast;
  const round = (v) => Math.round(v * 100) / 100;
  const flat = samples.flatMap((s) => s.lines.map((l) => ({ t: s.t, ...l })));
  const holds = (l) => want.some((w) => wordsOf(l.text).includes(w));
  let first = null; let firstLine = null;
  if (want.length) {
    const got = new Set();
    for (const s of samples) {
      for (const l of s.lines.filter(counts)) for (const w of wordsOf(l.text)) if (want.includes(w)) got.add(w);
      if (got.size >= need) { first = s.t; firstLine = [...got].join(' '); break; }
    }
  } else {
    const s = samples.find((x) => x.lines.some(counts));
    if (s) { first = s.t; firstLine = s.lines.filter(counts)[0].text; }
  }
  const pool = want.length && flat.some(holds) ? flat.filter(holds) : flat;
  const best = [...pool].sort((a, b) => (counts(b) - counts(a)) || b.share - a.share)[0] || null;
  const out = { pass: first !== null && first <= by + 1e-6, first_readable: first, problems: [], best: best && { t: best.t, text: best.text, share: round(best.share), contrast: round(best.contrast) } };
  if (out.pass) return out;
  const short = duration !== null && duration < by ? ` (the film is only ${round(duration)} s long)` : '';
  const early = (list) => list.filter((l) => l.t <= by + 1e-6);
  const reasons = (lines, what) => {
    const big = lines.filter((l) => l.share >= minShare);
    if (!big.length) return { what: 'too small', detail: `${what} is ${round(Math.max(...lines.map((l) => l.share)))}% of the frame's short side at its largest by ${by} s; it needs ${minShare}% (84 px on 1080)` };
    return { what: 'low contrast', detail: `${what} has a contrast of ${round(Math.max(...big.map((l) => l.contrast)))}:1 at best against what is behind it; it needs ${minContrast}:1` };
  };
  if (!flat.length) out.problems.push({ what: 'no text', detail: `no words could be read in the first ${round(samples.at(-1)?.t ?? by)} s${short}` });
  else if (first !== null) out.problems.push({ what: 'late', detail: `the first readable line ("${firstLine}") is up at ${round(first)} s; it must be up by ${by} s` });
  else if (want.length) {
    const mine = flat.filter(holds);
    if (!mine.length) out.problems.push({ what: 'not the hook', detail: `"${expect}" was not read anywhere in the first ${round(samples.at(-1).t)} s${early(flat).some(counts) ? '; other large, clear text is up' : ''}` });
    else if (!early(mine).length) out.problems.push({ what: 'late', detail: `the hook's words first appear at ${round(mine[0].t)} s; they must be up by ${by} s` });
    else {
      // The hook's words are there in time: which of them fall short, and why.
      const weak = early(mine).filter((l) => !counts(l));
      out.problems.push(weak.length ? reasons(weak, `the hook's line ("${weak.sort((a, b) => a.share - b.share)[0].text}")`) : { what: 'not the hook', detail: `fewer than half the words of "${expect}" were readable by ${by} s` });
    }
  } else if (!early(flat).length) out.problems.push({ what: 'late', detail: `no words before ${by} s; the first are at ${round(flat[0].t)} s and are too small or too faint as well` });
  else out.problems.push(reasons(early(flat), 'the largest text'));
  return out;
}
