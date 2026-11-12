#!/usr/bin/env node
// Checks the engine's motion for a capture, by measuring the same plan the engine draws from
// (engine/src/kit/capture/plan.ts): the pointer, the time map and the camera.
//
//   node tools/checks/capture_motion.mjs <capture folder> [--options '<json>'] [--fps 60] [--json out.json]
//
// <capture folder> holds cursor.json and tracks.json (engine/public/jobs/<job>/capture/<id>). --options is what a
// CaptureClip is given: {"look": "launch", "time": {...}, "moves": [...], "holds": [...], "from": 0, "to": 12}, plus
// "things" and, for a re-laid frame, "region" (tools/checks/capture_relayout.mjs prints the options it measured).
//
// It reports, in plain words:
//   clicks    when the pointer arrived before each click (craft file 05: 100 to 150 ms) and that it was still at
//             the click's place from then until the button came up
//   moves     how long each pointer move took (350 to 600 ms), and moves the recording left too little room for
//   steps     jumps: a change of the pointer's or the camera's speed in one frame far bigger than the changes a few
//             frames either side (a pop, a held or doubled frame), outside the planned cuts
//   shots     for each automatic zoom, the least room left between the tracked thing and the edge of the view, at
//             every frame of the shot, and the zoom used (never past 2)
//   pins      for each pinned event, where it lands against where it was pinned, in frames
// Where a thing sits closer to the page's edge than the room asked for, the page's edge is all the room there is.
// Exit code 0 when everything is inside its limits, 1 otherwise.
import { build } from '../../engine/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const engine = path.join(here, '..', '..', 'engine');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const folder = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!folder) {
  console.log('Usage: node tools/checks/capture_motion.mjs <capture folder> [--options <json>] [--fps 60] [--json out.json]');
  process.exit(2);
}
const fps = Number(flag('--fps', 60));
const options = JSON.parse(flag('--options', '{}'));

// Bundle the engine's pure capture modules for node.
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'capture-motion-')), 'plan.mjs');
await build({
  stdin: { contents: `export { planCapture } from './src/kit/capture/plan';\nexport { withThings } from './src/kit/capture/glue';`, resolveDir: engine, loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: out,
  logLevel: 'error',
  absWorkingDir: engine,
});
const { planCapture, withThings } = await import(pathToFileURL(out).href);
/** The room the camera keeps around the thing it is on, as a share of the view (KEEP_ROOM in camera.ts). */
const KEEP_ROOM = 0.06;

const read = (name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
const cursor = read('cursor.json');
// "things" (fixed places for a take that tracked nothing, as a CaptureClip takes them) are folded into the tracks.
const tracks = withThings(cursor, fs.existsSync(path.join(folder, 'tracks.json')) ? read('tracks.json') : undefined, options.things);
let plan;
try {
  plan = planCapture(cursor, tracks, options);
} catch (error) {
  console.log(`The engine refuses these settings: ${error.message}`);
  process.exit(1);
}
const { pointer, map, camera, look } = plan;
const page = cursor.page;
const ms = (s) => `${Math.round(s * 1000)} ms`;
const problems = [];
const report = { look: options.look ?? 'product-demo', film_seconds: +map.duration.toFixed(3), clicks: [], moves: {}, steps: {}, shots: [], pins: [] };

console.log(`Capture motion check: ${path.basename(path.dirname(path.dirname(folder)))}/${path.basename(folder)}, look "${report.look}", ${map.duration.toFixed(2)} s of film`);

// ------------------------------------------------ clicks
const inClip = (t) => t >= plan.from && t <= plan.to;
for (const c of pointer.clicks.filter((c) => inClip(c.t))) {
  let drift = 0;
  for (let r = c.arrive; r <= c.up; r += 1 / 480) {
    const p = pointer.at(r);
    drift = Math.max(drift, Math.hypot(p.x - c.x, p.y - c.y));
  }
  const ok = look.repath ? c.hover || (c.lead >= 0.1 - 1e-6 && c.lead <= 0.15 + 1e-6) : true;
  report.clicks.push({ at: +c.t.toFixed(3), lead_ms: Math.round(c.lead * 1000), still_px: +drift.toFixed(2), after_hover: c.hover });
  if (!ok) problems.push(`the pointer arrived ${ms(c.lead)} before the click at ${c.t.toFixed(2)} s (should be 100 to 150 ms)`);
  if (drift > 0.5 && look.repath) problems.push(`the pointer moved ${drift.toFixed(1)} px between arriving and the button coming up at ${c.t.toFixed(2)} s`);
}
const leads = report.clicks.filter((c) => !c.after_hover).map((c) => c.lead_ms);
console.log(`  clicks: ${report.clicks.length}; arrived ${Math.min(...leads)} to ${Math.max(...leads)} ms before the button${report.clicks.some((c) => c.after_hover) ? ` (plus ${report.clicks.filter((c) => c.after_hover).length} after a hover)` : ''}; still at the click within ${Math.max(...report.clicks.map((c) => c.still_px)).toFixed(2)} px`);

// ------------------------------------------------ moves
const arcs = pointer.moves.filter((m) => !m.route && m.end >= plan.from && m.start <= plan.to && Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y) > 40);
const lengths = arcs.map((m) => m.end - m.start);
report.moves = { count: arcs.length, shortest_ms: Math.round(Math.min(...lengths) * 1000), longest_ms: Math.round(Math.max(...lengths) * 1000), rushed: pointer.rushed };
console.log(`  moves: ${arcs.length} drawn arcs, ${report.moves.shortest_ms} to ${report.moves.longest_ms} ms each${pointer.rushed.length ? `; ${pointer.rushed.length} had less room in the recording` : ''}`);
if (look.repath) for (const m of arcs) if (m.end - m.start < 0.35 - 1e-6 || m.end - m.start > 0.6 + 1e-6) problems.push(`a pointer move at ${m.start.toFixed(2)} s took ${ms(m.end - m.start)}`);

// ------------------------------------------------ steps, frame by frame
const frames = Math.floor(map.duration * fps);
const at = (k) => {
  const f = k / fps;
  const r = map.recAt(f);
  const p = pointer.at(r);
  const v = camera.at(f);
  // Where the pointer is drawn, in page pixels of the frame (after the camera): (p - c) * zoom + half the page.
  return { f, r, p, v, x: (p.x - v.cx) * v.zoom + page.width / 2, y: (p.y - v.cy) * v.zoom + page.height / 2 };
};
const rows = Array.from({ length: frames + 1 }, (_, k) => at(k));
const cutFrames = new Set(map.cuts.map((c) => Math.round(c * fps)));
// For every frame: how far the pointer is drawn from where it was a frame ago, and how far the picture moves under
// the camera (the middle of the view plus the reach of the zoom at the frame's edge), in page pixels of the frame.
const pointerStep = [];
const cameraStep = [];
for (let k = 1; k <= frames; k++) {
  const [b, c] = [rows[k - 1], rows[k]];
  const shown = c.p.opacity > 0.05 && b.p.opacity > 0.05;
  pointerStep[k] = shown ? { x: c.x - b.x, y: c.y - b.y } : null;
  cameraStep[k] = { x: (c.v.cx - b.v.cx) * c.v.zoom + (page.width / 2) * (c.v.zoom - b.v.zoom), y: (c.v.cy - b.v.cy) * c.v.zoom };
}
// A jump is a frame whose step is far from the steps either side of it: a pop (one big step), a held frame (no
// step between two moving ones) or a doubled one. A move that speeds up and slows down never shows one, however fast.
const pops = (steps, what) => {
  const size = (v) => Math.hypot(v.x, v.y);
  let worst = { change: 0, around: 0, at: 0 };
  const found = [];
  for (let k = 2; k < frames; k++) {
    if ([k - 1, k, k + 1].some((j) => cutFrames.has(j))) continue;
    const [a, b, c] = [steps[k - 1], steps[k], steps[k + 1]];
    if (!a || !b || !c) continue;
    const off = size({ x: b.x - (a.x + c.x) / 2, y: b.y - (a.y + c.y) / 2 });
    const around = Math.max(size(a), size(c));
    if (off > worst.change) worst = { change: off, around, at: k / fps };
    if (off > 0.5 * around + 4) found.push({ at: +(k / fps).toFixed(3), change: +off.toFixed(1), around: +around.toFixed(1) });
  }
  for (const p of found) problems.push(`the ${what} jumps at ${p.at} s: that frame's step is ${p.change} px off the steps either side (${p.around} px)`);
  return { worst, found };
};
const pointerPops = pops(pointerStep, 'pointer');
const cameraPops = pops(cameraStep, 'camera');
const fastest = Math.max(...pointerStep.filter(Boolean).map((s) => Math.hypot(s.x, s.y)));
report.steps = {
  pointer_fastest_px_per_frame: +fastest.toFixed(1),
  pointer_step_most_off_px: +pointerPops.worst.change.toFixed(2),
  pointer_step_most_off_at: +pointerPops.worst.at.toFixed(3),
  pointer_jumps: pointerPops.found,
  camera_step_most_off_px: +cameraPops.worst.change.toFixed(2),
  camera_step_most_off_at: +cameraPops.worst.at.toFixed(3),
  camera_jumps: cameraPops.found,
  planned_cuts: map.cuts.map((c) => +c.toFixed(3)),
};
console.log(`  steps: pointer at most ${fastest.toFixed(1)} px a frame; ${pointerPops.found.length} pointer jumps and ${cameraPops.found.length} camera jumps (the step furthest off its neighbours: pointer ${pointerPops.worst.change.toFixed(1)} px at ${pointerPops.worst.at.toFixed(2)} s, beside steps of ${pointerPops.worst.around.toFixed(1)} px; camera ${cameraPops.worst.change.toFixed(1)} px at ${cameraPops.worst.at.toFixed(2)} s, beside ${cameraPops.worst.around.toFixed(1)} px)`);

// ------------------------------------------------ shots
for (const shot of camera.shots) {
  let least = Infinity;
  let leastAt = 0;
  let most = 1;
  const k0 = Math.max(0, Math.ceil(shot.inEnd * fps));
  const k1 = Math.min(frames, Math.floor(shot.holdEnd * fps));
  for (let k = k0; k <= k1; k++) {
    const { r, v } = rows[k];
    most = Math.max(most, v.zoom);
    const halfW = page.width / (2 * v.zoom);
    const halfH = page.height / (2 * v.zoom);
    const boxes = shot.things.length ? shot.things.map((name) => tracks?.frames[Math.min(tracks.frames.length - 1, Math.round(r * tracks.fps))]?.at[name]).filter(Boolean).map((b) => ({ x: b[0], y: b[1], width: b[2], height: b[3] })) : [shot.rect];
    for (const b of boxes) {
      // Room on each side, as a share of the view's width or height. Where the thing sits closer to the page's own
      // edge than that, the page's edge is all the room there is, and the check asks only for that.
      const side = (gap, edgeGap, size) => (edgeGap < KEEP_ROOM * size - 0.5 ? (gap >= edgeGap - 0.5 ? KEEP_ROOM : gap / size) : gap / size);
      const room = Math.min(
        side(b.x - (v.cx - halfW), b.x, 2 * halfW),
        side(v.cx + halfW - (b.x + b.width), page.width - (b.x + b.width), 2 * halfW),
        side(b.y - (v.cy - halfH), b.y, 2 * halfH),
        side(v.cy + halfH - (b.y + b.height), page.height - (b.y + b.height), 2 * halfH),
      );
      if (room < least) {
        least = room;
        leastAt = k / fps;
      }
    }
  }
  report.shots.push({ from: +shot.inStart.toFixed(2), held_from: +shot.inEnd.toFixed(2), held_to: +shot.holdEnd.toFixed(2), to: +shot.outEnd.toFixed(2), on: shot.things.join(', ') || 'the click', zoom: +most.toFixed(2), least_room: +least.toFixed(3), least_room_at: +leastAt.toFixed(2) });
  if (least < KEEP_ROOM - 0.005) problems.push(`the zoom held ${shot.inEnd.toFixed(2)} to ${shot.holdEnd.toFixed(2)} s left only ${(least * 100).toFixed(1)}% room around ${shot.things.join(', ') || 'the click'} at ${leastAt.toFixed(2)} s`);
  if (most > 2 + 1e-6) problems.push(`the camera went to ${most.toFixed(2)}x, past 2x`);
}
console.log(`  shots: ${report.shots.length} automatic zooms; ${report.shots.map((s) => `${s.on} ${s.zoom}x, least room ${(s.least_room * 100).toFixed(1)}%`).join('; ') || 'none'}`);

// ------------------------------------------------ pins
for (const pin of options.time?.pins ?? []) {
  const ref = pin.event;
  const r = 't' in ref ? ref.t : 'click' in ref ? pointer.clicks[ref.click - 1].t : 'mark' in ref ? cursor.events.find((e) => e.type === 'mark' && e.name === ref.mark).t : cursor.events.find((e) => e.step === ref.step).t;
  const lands = map.filmAt(r);
  const frameOff = Math.round(lands * fps) - Math.round(pin.at * fps);
  report.pins.push({ event: ref, pinned: pin.at, lands: +lands.toFixed(4), off_frames: frameOff });
  if (Math.abs(frameOff) > 1) problems.push(`${JSON.stringify(ref)} was pinned to ${pin.at} s but lands at ${lands.toFixed(3)} s`);
}
if (report.pins.length) console.log(`  pins: ${report.pins.map((p) => `${JSON.stringify(p.event)} pinned to ${p.pinned} s lands at ${p.lands} s (${p.off_frames} frames off)`).join('; ')}`);

const json = flag('--json');
if (json) fs.writeFileSync(json, JSON.stringify({ ...report, problems }, null, 1) + '\n');
if (problems.length) {
  console.log(`\n${problems.length} problem${problems.length > 1 ? 's' : ''}:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('\nEverything is inside its limits.');
