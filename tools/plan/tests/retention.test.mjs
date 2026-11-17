// Tests for the retention reader, on made-up curves (no real export has been read yet). Run: node --test tools/plan/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRetention, readRetention } from '../lib/retention.mjs';

// A 60 s film: 100 points; loses 25 points in the first 3 s, a slow slide, a dip at 30-33 s, a rewatch spike at 45 s.
function curve({ duration = 60, n = 100 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * duration; let r = 100;
    r -= Math.min(t, 3) / 3 * 25; r -= Math.max(0, t - 3) * 0.2;
    if (t > 30) r -= Math.min(t - 30, 3) * 3; // a dip: 9 points over 3 s
    if (t >= 45 && t <= 46) r += 4; // a spike
    pts.push([i / n, r]);
  }
  return pts;
}
const csv = (rows, head = 'Video position (%),Audience retention (%)', fx = (a) => a) => [head, ...rows.map(([a, r]) => `${fx(a)},${r.toFixed(1)}`)].join('\n');

test('a percent export is read, header skipped, as shares', () => {
  const r = parseRetention(csv(curve(), undefined, (a) => (a * 100).toFixed(0)), { duration: 60 });
  assert.equal(r.position, 'percent'); assert.equal(r.share, 'percent'); assert.equal(r.points.length, 101);
  assert.equal(r.points[0].retention, 1); assert.equal(r.points.at(-1).at, 1);
});

test('positions as ratios, seconds or m:ss, and shares as ratios, are all read', () => {
  assert.equal(parseRetention(csv(curve(), 'x,y', (a) => a.toFixed(2)), { duration: 60 }).position, 'ratio');
  const s = parseRetention(csv(curve(), 'x,y', (a) => (a * 60).toFixed(1)), { duration: 60 });
  assert.equal(s.position, 'seconds'); assert.equal(s.points.at(-1).at, 1);
  const m = parseRetention(csv(curve(), 'x,y', (a) => { const t = Math.round(a * 60); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }), { duration: 60 });
  assert.equal(m.position, 'seconds');
  const ratio = parseRetention(['pos,ret', ...curve().map(([a, r]) => `${(a * 100).toFixed(0)},${(r / 100).toFixed(4)}`)].join('\n'), { duration: 60 });
  assert.equal(ratio.share, 'ratio'); assert.equal(ratio.points[0].retention, 1);
});

test('an export for another film, too few rows, or positions out of order, are refused with the reason', () => {
  assert.throws(() => parseRetention(csv(curve({ duration: 90 }), 'x,y', (a) => (a * 90).toFixed(1)), { duration: 60 }), /for another film/);
  assert.throws(() => parseRetention('a,b\n0,100\n50,60\n100,40', { duration: 60 }), /only 3 rows/);
  assert.throws(() => parseRetention(csv(curve().reverse(), 'x,y', (a) => (a * 100).toFixed(0)), { duration: 60 }), /do not run/);
  assert.throws(() => parseRetention(csv(curve(), 'x,y', (a) => (a * 60 + 30).toFixed(1))), /length is needed/);
});

test('a semicolon export with decimal commas is read', () => {
  const r = parseRetention(['Position;Retention', ...curve().map(([a, r]) => `${(a * 100).toFixed(0)};${r.toFixed(1).replace('.', ',')}`)].join('\n'), { duration: 60 });
  assert.equal(r.points[1].retention, parseRetention(csv(curve(), undefined, (a) => (a * 100).toFixed(0)), { duration: 60 }).points[1].retention);
});

test('the early drop, a dip and a spike are found at their beats and lines', () => {
  const points = parseRetention(csv(curve(), undefined, (a) => (a * 100).toFixed(0)), { duration: 60 }).points;
  const beats = [{ id: 'hook', start: 0, end: 4 }, { id: 'proof', start: 4, end: 40 }, { id: 'offer', start: 40, end: 52 }, { id: 'close', start: 52, end: 60 }];
  const lines = [{ id: '07', start: 29.5, end: 33.5, text: 'And here is the long setup nobody asked for.' }, { id: '10', start: 44.5, end: 47, text: 'Half price until Friday.' }];
  const r = readRetention(points, { duration: 60, beats, lines });
  assert.equal(r.start, 100); assert.ok(r.at_3s < 80);
  const kinds = r.moments.map((m) => m.kind);
  assert.ok(kinds.includes('early drop')); // 60 s film: the first 30 s
  const dip = r.moments.find((m) => m.kind === 'dip');
  assert.ok(dip && dip.from >= 29 && dip.to <= 34, JSON.stringify(r.moments)); assert.equal(dip.beat, 'proof'); assert.ok(dip.lines.includes('07'));
  const spike = r.moments.find((m) => m.kind === 'spike');
  assert.ok(spike && spike.from >= 44 && spike.from <= 46); assert.equal(spike.beat, 'offer'); assert.ok(spike.lines.includes('10'));
  // Falling back to the trend after the spike is not reported as viewers leaving.
  assert.ok(!r.moments.some((m) => (m.kind === 'cliff' || m.kind === 'dip') && m.from >= 45 && m.from <= 48), JSON.stringify(r.moments));
});

test('a short film\'s early drop is its first 3 s', () => {
  const pts = Array.from({ length: 31 }, (_, i) => ({ at: i / 30, retention: (100 - (i <= 3 ? i * 8 : 24 + (i - 3) * 0.5)) / 100 }));
  const r = readRetention(pts, { duration: 30, beats: [{ id: 'hook', start: 0, end: 3 }] });
  const e = r.moments.find((m) => m.kind === 'early drop'); assert.equal(e.to, 3); assert.equal(e.beat, 'hook');
  assert.ok(!r.moments.some((m) => m.kind !== 'early drop' && m.to <= 3)); // not reported twice
});

test('cliffs and spikes inside the first 30 s are found too; the early drop of a long film names no single line', () => {
  const pts = Array.from({ length: 121 }, (_, i) => { let r = 100 - i * 0.3; if (i >= 10) r -= 15; if (i >= 20 && i <= 21) r += 8; return { at: i / 120, retention: r / 100 }; });
  const r = readRetention(pts, { duration: 120, lines: [{ id: 'a', start: 0, end: 5 }, { id: 'b', start: 9, end: 11 }] });
  assert.ok(r.moments.some((m) => m.kind === 'cliff' && m.from >= 9 && m.to <= 11), JSON.stringify(r.moments));
  assert.ok(r.moments.some((m) => m.kind === 'spike' && m.from >= 19 && m.from <= 21));
  const e = r.moments.find((m) => m.kind === 'early drop'); assert.ok(e); assert.deepEqual(e.lines, []); assert.equal(e.beat, null);
});

test('a steady slope reports nothing; small jitter is not a spike; a smooth decay is not a dip', () => {
  const slope = Array.from({ length: 101 }, (_, i) => ({ at: i / 100, retention: (100 - i * 0.6) / 100 }));
  assert.deepEqual(readRetention(slope, { duration: 120 }).moments, []);
  const jitter = Array.from({ length: 101 }, (_, i) => ({ at: i / 100, retention: (100 - i * 0.4 + (i % 2 ? 0.4 : 0)) / 100 }));
  assert.deepEqual(readRetention(jitter, { duration: 45 }).moments.filter((m) => m.kind === 'spike'), []);
  const decay = Array.from({ length: 101 }, (_, i) => ({ at: i / 100, retention: 0.35 + 0.65 * Math.exp(-i / 25) }));
  assert.deepEqual(readRetention(decay, { duration: 600 }).moments.filter((m) => m.kind === 'dip'), []);
});

test('a percent export is read as a percent for films of any length near 100 s', () => {
  const rows = ['pos,ret', ...Array.from({ length: 100 }, (_, i) => `${i + 1},${(100 - i * 0.4).toFixed(1)}`)].join('\n');
  for (const d of [93, 100, 108]) assert.equal(parseRetention(rows, { duration: d }).position, 'percent', String(d));
  // Seconds in even steps for a 60 s film are seconds.
  const secs = ['pos,ret', ...Array.from({ length: 61 }, (_, i) => `${i},${(100 - i * 0.4).toFixed(1)}`)].join('\n');
  assert.equal(parseRetention(secs, { duration: 60 }).position, 'seconds');
});

test('quoted decimal commas, tabs, Windows line ends, and a header that names the absolute column', () => {
  const quoted = ['"Position","Retention"', ...Array.from({ length: 21 }, (_, i) => `"${(i / 20).toFixed(2).replace('.', ',')}";"${(1 - i * 0.01).toFixed(3).replace('.', ',')}"`)].join('\r\n');
  const q = parseRetention(quoted, { duration: 60 }); assert.equal(q.points.at(-1).at, 1); assert.equal(q.points[0].retention, 1);
  const tabs = ['pos\tret', ...Array.from({ length: 21 }, (_, i) => `${i * 5}\t${100 - i}`)].join('\n');
  assert.equal(parseRetention(tabs, { duration: 100 }).points.length, 21);
  const three = ['Video position (%),Relative retention,Absolute audience retention (%)', ...Array.from({ length: 101 }, (_, i) => `${i},0.6,${(100 - i * 0.4).toFixed(1)}`)].join('\n');
  const r = parseRetention(three, { duration: 60 }); assert.equal(r.column, 'Absolute audience retention (%)'); assert.equal(r.points[0].retention, 1);
  assert.throws(() => parseRetention(['pos,Relative retention', ...Array.from({ length: 20 }, (_, i) => `${i * 5},0.5`)].join('\n'), { duration: 95 }), /compares with other videos/);
});
