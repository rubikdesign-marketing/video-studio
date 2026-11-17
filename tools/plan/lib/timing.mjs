// When each script line is said (LIBRARY-PLAN.md phase 2). From the voice's own timings (audio/lines.json) when the
// voice has been made, otherwise estimated at the studio's speaking pace (2.5 words a second, stage 2) with each
// line's pause after it. Pure.

/** The words a line says: [directions] taken out. */
export const spoken = (text) => String(text).replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
export const wordCount = (s) => spoken(s).split(' ').filter(Boolean).length;
const round = (v) => Math.round(v * 100) / 100;

/**
 * script: [{ id, text, gap_after?, beat?, energy? }] (audio/script.json). lines: [{ id, start, end }] (audio/lines.json)
 * or null. Returns { measured, estimated: ids estimated though lines were given, lines: [{ id, start, end, text,
 * words, beat, energy }] }.
 */
export function lineTimes(script, { lines = null, wps = 2.5, defaultGap = 0.5, lead = 0.3 } = {}) {
  const real = new Map((lines || []).map((l) => [String(l.id), l]));
  const out = []; const estimated = [];
  let t = lead;
  script.forEach((l, i) => {
    const text = spoken(l.text); const words = wordCount(l.text);
    const m = real.get(String(l.id));
    let start; let end;
    if (m && Number.isFinite(m.start) && Number.isFinite(m.end)) { start = m.start; end = m.end; }
    else { start = t; end = t + words / wps; if (lines) estimated.push(String(l.id)); }
    out.push({ id: String(l.id), start: round(start), end: round(end), text, words, beat: l.beat ?? null, energy: Number.isFinite(l.energy) ? l.energy : null });
    t = end + (i < script.length - 1 ? (l.gap_after ?? defaultGap) : 0);
  });
  return { measured: Boolean(lines) && estimated.length < script.length, estimated, lines: out };
}
