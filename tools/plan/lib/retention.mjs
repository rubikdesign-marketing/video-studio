// Reading a YouTube Studio audience-retention export against a film's beats (LIBRARY-PLAN.md phase 2; craft guide
// 16, "Reading a retention graph"). Pure.
//
// The export's layout has not been checked against a real file (no real export has been read yet). What is known: it
// is a CSV of two columns, a position in the film and the share of viewers still watching (youtube-agent-skill's
// retention.py, MIT); YouTube's Analytics API gives the position as a ratio from 0.01 to 1 and the share as a ratio
// that can pass 1 where parts are rewatched. So every plausible form is read, and anything else is refused with
// the reason: position as a percent, a ratio, seconds, or m:ss; the share as a percent or a ratio.

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const clock = (s) => { const m = String(s).trim().match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?$/); if (!m) return null; return m[3] !== undefined ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2]; };

/** One CSV line split into cells, quotes honoured ("0,995" stays one cell). */
function cellsOf(line, delim) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === delim) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * The export's points: [{ at: share of the film 0..1, retention: share of viewers (can pass 1) }]. duration: the
 * film's length in seconds (needed when positions are in seconds, and to tell seconds from percent). Returns { points,
 * position, share, column, notes } or throws an Error saying why it cannot be read.
 */
export function parseRetention(text, { duration = null } = {}) {
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const head5 = lines.slice(0, 6);
  const count = (d) => head5.reduce((a, l) => a + cellsOf(l, d).length - 1, 0);
  const delim = ['\t', ';', ','].sort((x, y) => count(y) - count(x))[0];
  const decimalComma = delim !== ',';
  const notes = [];
  const num = (c) => { if (clock(c) !== null) return { v: clock(c), clock: true }; let t = c.replace(/^"|"$/g, '').trim(); if (decimalComma) t = t.replace(',', '.'); const pct = t.endsWith('%'); t = t.replace('%', ''); const v = Number(t); return t !== '' && Number.isFinite(v) ? { v, pct } : null; };
  // A header row (no numbers) names the columns: the position is the first; viewers still watching is the column
  // called absolute (or plain "retention"), never "relative" (that compares with other videos).
  let col = 1; let header = null;
  const first = cellsOf(lines[0], delim);
  if (first.filter((c) => num(c)).length < 2) {
    header = first;
    const name = (c) => c.toLowerCase();
    const abs = first.findIndex((c, i) => i > 0 && /absolute|watch ratio|still watching/.test(name(c)));
    const plain = first.findIndex((c, i) => i > 0 && /retention|watching|viewers|audience/.test(name(c)) && !/relative|typical|average|comparison/.test(name(c)));
    if (abs > 0) col = abs; else if (plain > 0) col = plain;
    if (first.length > 2) notes.push(`the export has ${first.length} columns; read "${first[0]}" as the position and "${first[col]}" as the share still watching`);
    if (/relative|typical/i.test(first[col] || '')) throw new Error(`the only retention column is "${first[col]}", which compares with other videos; export absolute retention`);
  }
  const rows = [];
  for (const line of header ? lines.slice(1) : lines) {
    const cells = cellsOf(line, delim); const p = num(cells[0] ?? ''); const r = num(cells[col] ?? '');
    if (p && r) rows.push({ pos: p, ret: r });
    if (!header && cells.filter((c) => num(c)).length > 2 && !notes.some((n) => /more than two/.test(n))) notes.push('rows have more than two numbers and no header names them; read the first as the position and the second as the share still watching');
  }
  if (rows.length < 8) throw new Error(`only ${rows.length} rows with two numbers could be read; a retention export has about 100`);
  // Repeated positions are read once.
  const uniq = rows.filter((r, i) => i === 0 || r.pos.v !== rows[i - 1].pos.v);
  const xs = uniq.map((r) => r.pos.v); const ys = uniq.map((r) => r.ret.v);
  for (let i = 1; i < xs.length; i++) if (xs[i] < xs[i - 1]) throw new Error('the positions do not run from the start of the film to the end');
  const maxX = Math.max(...xs);
  const steps = xs.slice(1).map((x, i) => x - xs[i]).sort((a, b) => a - b);
  const even = steps.length && steps[steps.length - 1] - steps[0] <= 0.5 * steps[Math.floor(steps.length / 2)] + 1e-9;
  // A percent export ends at (about) 100 in even steps from near 0. Anything else that is not a ratio is seconds.
  const percentLike = maxX >= 98 && maxX <= 100.5 && xs[0] <= 2 && even;
  let position;
  if (uniq.some((r) => r.pos.clock)) position = 'seconds';
  else if (maxX <= 1.0001) position = 'ratio';
  else if (percentLike) position = 'percent';
  else position = 'seconds';
  if (position === 'percent' && duration && Math.abs(maxX - duration) <= 2) notes.push(`positions run to ${maxX} in even steps: read as a percent of the film, though the film is ${round(duration, 1)} s long; check the export`);
  if (position === 'seconds') {
    if (!duration) throw new Error('the positions are in seconds, so the film\'s length is needed (--duration, or the job\'s voice)');
    if (Math.abs(maxX - duration) > Math.max(2, 0.05 * duration)) throw new Error(`the export runs to ${round(maxX, 1)} s but the film is ${round(duration, 1)} s: it is for another film, or another version of it (or the film's length is wrong: pass --duration)`);
  }
  const at = (x) => (position === 'ratio' ? x : position === 'percent' ? x / 100 : x / (duration || maxX));
  const share = uniq.some((r) => r.ret.pct) || Math.max(...ys) > 3 ? 'percent' : 'ratio';
  const ret = (y) => (share === 'percent' ? y / 100 : y);
  if (ret(ys[0]) < 0.3) notes.push(`only ${round(ret(ys[0]) * 100, 1)}% are watching at the very start: check that the column read is the share still watching`);
  return { points: uniq.map((r) => ({ at: round(at(r.pos.v), 4), retention: round(ret(r.ret.v), 4) })), position, share, column: header ? header[col] : 'second', notes };
}

/**
 * What the curve says, in the film's own time, against its beats and lines. beats: [{ id, name, start, end }];
 * lines: [{ id, start, end, text }]. Returns { start, at_3s, at_30s, end, step, moments: [{ kind, from, to, change,
 * beat, lines }] }. Kinds: 'early drop' (the opening lost viewers clearly faster than the rest of the film: its first
 * 3 s, or its first 30 s when it is over a minute), 'cliff' (a sharp loss in a short stretch), 'dip' (losing viewers
 * clearly faster than the film does around it), 'spike' (more viewers than just before: rewatching or skipping to it).
 * A moment names the lines it overlaps, not one line, when the export's steps are coarser than a line.
 */
export function readRetention(points, { duration, beats = [], lines = [] } = {}) {
  const P = points.map((p) => ({ t: p.at * duration, r: p.retention })).filter((p, i, a) => i === 0 || p.t - a[i - 1].t > 1e-6);
  const at = (t) => { const k = P.findIndex((p) => p.t >= t); if (k < 0) return P.at(-1).r; if (k === 0) return P[0].r; const a = P[k - 1]; const b = P[k]; return a.r + ((b.r - a.r) * (t - a.t)) / (b.t - a.t); };
  const beatOf = (t) => beats.find((b) => t >= b.start && t < b.end)?.id ?? null;
  const overlapping = (from, to) => lines.filter((l) => l.end > from && l.start < to).map((l) => l.id);
  const step = P.length > 1 ? (P.at(-1).t - P[0].t) / (P.length - 1) : duration;
  const rates = P.slice(1).map((b, i) => ({ t: P[i].t, dt: b.t - P[i].t, d: P[i].r - b.r, rate: (P[i].r - b.r) / (b.t - P[i].t) }));
  // The film's own rate of loss around each stretch: the median of its neighbours' rates (15% of the film either side).
  const span = Math.max(3, Math.round((0.15 * duration) / Math.max(step, 1e-6)));
  const localRate = (i) => { const near = rates.slice(Math.max(0, i - span), i + span + 1).filter((_, k) => k !== Math.min(i, span)).map((x) => x.rate).sort((a, b) => a - b); return Math.max(0, near[Math.floor(near.length / 2)] || 0); };
  const all = [...rates.map((x) => x.rate)].sort((a, b) => a - b); const usual = Math.max(0, all[Math.floor(all.length / 2)] || 0);
  const moments = [];
  const early = duration >= 60 ? 30 : Math.min(3, duration * 0.2);
  const lostEarly = P[0].r - at(early);
  // An early drop only when the opening lost viewers clearly faster than the film's usual rate.
  if (lostEarly > Math.max(0.05, 2 * usual * early)) moments.push({ kind: 'early drop', from: 0, to: early, change: -lostEarly, whole: true });
  rates.forEach((x, i) => {
    let kind = null;
    if (x.d <= -0.015) kind = 'spike';
    else if (x.d >= 0.03 && x.dt <= Math.max(1, 0.03 * duration)) kind = 'cliff';
    else if (x.d > 0 && x.rate > Math.max(3 * localRate(i), 0.002)) kind = 'dip';
    if (!kind) return;
    const last = moments.at(-1); const a = x.t; const b = x.t + x.dt;
    if (last && !last.whole && last.kind === kind && Math.abs(last.to - a) < 1e-6) { last.to = b; last.change += -x.d; return; }
    // The fall back to the trend straight after a spike is the spike ending, not viewers leaving.
    if (last && last.kind === 'spike' && kind !== 'spike' && a - last.to <= Math.max(1.5, 0.03 * duration) && x.d <= last.change * 1.25) return;
    moments.push({ kind, from: a, to: b, change: -x.d });
  });
  const hasEarly = moments.some((m) => m.kind === 'early drop');
  // In a film under a minute the opening is its first 3 s: a cliff or dip inside it is the early drop itself. In a
  // longer film they stay, because they say where in the first 30 s viewers went.
  const kept = moments.filter((m) => !(hasEarly && duration < 60 && m.kind !== 'early drop' && m.kind !== 'spike' && m.to <= early + 1e-6))
    .filter((m) => m.kind === 'early drop' || m.kind === 'spike' || m.kind === 'cliff' || -m.change >= 0.02);
  return {
    start: round(P[0].r * 100, 1), at_3s: round(at(3) * 100, 1), at_30s: duration >= 30 ? round(at(30) * 100, 1) : null, end: round(P.at(-1).r * 100, 1),
    step: round(step, 2), usual_loss_per_10s: round(usual * 1000, 2),
    moments: kept.map((m) => ({ kind: m.kind, from: round(m.from, 1), to: round(m.to, 1), change: round(m.change * 100, 1), beat: m.whole && duration >= 60 ? null : beatOf((m.from + m.to) / 2), lines: m.whole && duration >= 60 ? [] : overlapping(m.from, m.to) })),
  };
}
