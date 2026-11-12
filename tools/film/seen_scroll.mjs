#!/usr/bin/env node
// Where the page really was in each frame of a capture's recording while it scrolled.
//
//   node tools/film/seen_scroll.mjs <capture folder>        (engine/public/jobs/<job>/capture/<id>)
//
// tracks.json is measured in the page, and Chrome's pictures of a scroll arrive a frame or a few later, unevenly (a
// held picture, then two steps at once). Anything the engine glues to a tracked thing would then sit ahead of the
// picture while the page moves: up to 27 px on a 380 px scroll in a practice take. This tool measures, from the
// recording itself, how far the picture had really scrolled in every frame of every scroll, by sliding each frame's
// rows against a still frame from just before the scroll, and writes seen.json next to tracks.json. The engine
// (glue.ts, seenTracks) then moves every thing that scrolls with the page to where the picture shows it, so a ring
// or a lift stays on the real thing, held frames and all. Things that stay put (a fixed bar, a toast) are left alone.
//
// Run it again after every new take (the capture tool replaces tracks.json; seen.json names the tracks it was made
// for, and the engine ignores it when they no longer match). Needs only ffmpeg.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const folder = process.argv[2];
if (!folder || !fs.existsSync(path.join(folder, 'tracks.json'))) {
  console.log('Usage: node tools/film/seen_scroll.mjs <capture folder with recording.mp4 and tracks.json>');
  process.exit(2);
}
const tracks = JSON.parse(fs.readFileSync(path.join(folder, 'tracks.json'), 'utf8'));
const cursor = JSON.parse(fs.readFileSync(path.join(folder, 'cursor.json'), 'utf8'));
const rows = tracks.frames;
const page = cursor.page;

// Frames where the tracked scroll moves, widened so the picture's late frames are inside.
const LATE = 15;
const moving = rows.map((r, i) => i > 0 && (r.scroll[1] !== rows[i - 1].scroll[1]));
const spans = [];
for (let i = 0; i < rows.length; i++) {
  if (!moving[i]) continue;
  const last = spans[spans.length - 1];
  if (last && i - last[1] <= LATE) last[1] = i;
  else spans.push([i, i]);
}
if (!spans.length) {
  fs.writeFileSync(path.join(folder, 'seen.json'), JSON.stringify({ about: 'No scroll in this take.', tracks_frames: rows.length, tracks_seconds: tracks.seconds, scroll: {} }) + '\n');
  console.log('No scroll in this take: nothing to measure.');
  process.exit(0);
}

// Each frame as four strips of row brightness, at the recording's full height (half a page pixel per row).
const STRIPS = 4;
const STRIP_W = 64;
const H = page.height * (cursor.scale ?? 2);
const W = STRIPS * STRIP_W;
const frameBytes = W * H;
const profiles = [];
const ff = spawn('ffmpeg', ['-v', 'error', '-i', path.join(folder, 'recording.mp4'), '-vf', `crop=iw*0.6:ih:iw*0.22:0,scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-']);
let pending = Buffer.alloc(0);
ff.stdout.on('data', (chunk) => {
  pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
  while (pending.length >= frameBytes) {
    const p = new Float32Array(STRIPS * H);
    for (let y = 0; y < H; y++)
      for (let s = 0; s < STRIPS; s++) {
        let sum = 0;
        for (let x = 0; x < STRIP_W; x++) sum += pending[y * W + s * STRIP_W + x];
        p[s * H + y] = sum / STRIP_W;
      }
    profiles.push(p);
    pending = pending.subarray(frameBytes);
  }
});
await new Promise((resolve) => ff.on('close', resolve));

const rowsPerPx = H / page.height;
/**
 * How unlike frame a is to reference b moved by d rows (content of a at row y is b's at y + d): one minus the
 * normalised correlation of the overlapping rows, so blank areas that match anything count for nothing.
 */
const cost = (a, b, d) => {
  const y0 = Math.max(0, -d);
  const y1 = Math.min(H, H - d);
  if (y1 - y0 < H * 0.3) return Infinity;
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  for (let s = 0; s < STRIPS; s++) {
    const o = s * H;
    for (let y = y0; y < y1; y += 2) {
      const u = a[o + y];
      const v = b[o + y + d];
      sa += u; sb += v; saa += u * u; sbb += v * v; sab += u * v; n++;
    }
  }
  const va = saa / n - (sa / n) ** 2;
  const vb = sbb / n - (sb / n) ** 2;
  if (va < 1 || vb < 1) return Infinity;
  return 1 - (sab / n - (sa / n) * (sb / n)) / Math.sqrt(va * vb);
};

const seen = {};
let worstSettle = 0;
for (const [s0, s1] of spans) {
  const ref = Math.max(0, s0 - 2);
  const end = Math.min(rows.length - 1, s1 + LATE);
  const base = rows[ref].scroll[1];
  const lo = Math.min(...rows.slice(ref, end + 1).map((r) => r.scroll[1])) - base;
  const hi = Math.max(...rows.slice(ref, end + 1).map((r) => r.scroll[1])) - base;
  let previous = 0;
  for (let i = ref + 1; i <= end && i < profiles.length; i++) {
    // Coarse search over the whole span's range, then fine around the best, then a parabola for the last fraction.
    const range = [Math.floor((lo - 40) * rowsPerPx), Math.ceil((hi + 40) * rowsPerPx)];
    let best = previous;
    let bestCost = cost(profiles[i], profiles[ref], best);
    for (let d = range[0]; d <= range[1]; d += 4) {
      const c = cost(profiles[i], profiles[ref], d);
      if (c < bestCost) [best, bestCost] = [d, c];
    }
    for (let d = best - 4; d <= best + 4; d++) {
      const c = cost(profiles[i], profiles[ref], d);
      if (c < bestCost) [best, bestCost] = [d, c];
    }
    const cm = cost(profiles[i], profiles[ref], best - 1);
    const cp = cost(profiles[i], profiles[ref], best + 1);
    const curve = cm + cp - 2 * bestCost;
    const fraction = curve > 0 ? Math.max(-0.5, Math.min(0.5, (cm - cp) / (2 * curve))) : 0;
    previous = best;
    const y = base + (best + fraction) / rowsPerPx;
    seen[i] = [rows[i].scroll[0], +y.toFixed(2)];
  }
  const settled = seen[end] ? Math.abs(seen[end][1] - rows[end].scroll[1]) : 0;
  worstSettle = Math.max(worstSettle, settled);
  const lags = [];
  for (let i = s0; i <= s1; i++) if (seen[i]) lags.push(rows[i].scroll[1] - seen[i][1]);
  const most = lags.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
  console.log(`Scroll at ${rows[s0].t.toFixed(2)} to ${rows[s1].t.toFixed(2)} s (${base} to ${rows[end].scroll[1]} px): the picture was up to ${Math.abs(most).toFixed(1)} px behind the page; after it, picture and page agree within ${settled.toFixed(2)} px.`);
}

fs.writeFileSync(
  path.join(folder, 'seen.json'),
  JSON.stringify({
    about: 'Where the picture had really scrolled (page pixels), per frame of the recording, during each scroll. Made by tools/film/seen_scroll.mjs from recording.mp4; used by the engine (glue.ts, seenTracks). Valid only for the tracks.json named here.',
    tracks_frames: rows.length,
    tracks_seconds: tracks.seconds,
    scroll: seen,
  }) + '\n',
);
console.log(`Wrote seen.json: ${Object.keys(seen).length} frames measured.${worstSettle > 1 ? ' Warning: after a scroll the picture and the page disagree by more than 1 px; check the take.' : ''}`);
