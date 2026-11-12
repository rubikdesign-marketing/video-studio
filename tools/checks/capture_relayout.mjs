#!/usr/bin/env node
// Checks a capture re-laid out for a 9:16, 1:1 or 4:5 frame (phase 8, engine/src/kit/capture/relayout.ts), from the
// same plan the engine draws from, and, given a render, from the render's own pixels.
//
//   node tools/checks/capture_relayout.mjs <capture folder> [--size 9:16] [--staging phone-crop] [--options '<json>']
//        [--energy hype] [--captions on|off] [--title on|off] [--text-rect x,y,w,h] [--render <mp4>] [--fps 60]
//        [--json out.json]
//
// <capture folder> holds cursor.json, tracks.json and recording.mp4 (engine/public/jobs/<job>/capture/<id>).
// --options is what the CaptureShot is given: {"look": "social-vertical", "things": {...}, "from": 4, "holds": [...]}.
// --staging defaults to the look's own. --text-rect is the page rectangle of the clicked thing's words.
//
// It reports, in plain words:
//   safe      on every frame, the least room between the safe area's edge and the acted-on thing (the thing of the
//             pointer's current stop) and the pointer (while shown), in frame pixels; the margin asked for is kept
//             inside the safe area, so any room of 0 or more passes
//   moves     each camera move: pull-back or follow, how long, how many times it turns back on itself (it should
//             not), and for a follow how far behind the pointer it runs (it should trail, never lead)
//   holds     the camera's largest step during a reading hold (it should be still)
//   sharp     the closest the camera went, in frame pixels per page pixel, against the recording's sharpness
//   text      the clicked thing's words at the click, as a share of frame height (from the recording's own pixels
//             through the plan, and measured in the render when one is given)
//   platforms for Instagram, TikTok and YouTube Shorts: the frames of key moments where the acted-on thing, the
//             pointer, the caption slot or the title slot sits under the app's own buttons or captions
//   picture   with --render: at each stop and the click, where the acted-on thing really is in the render against
//             where the plan put it (the recording's pixels found in the render, best offset in frame pixels)
// Exit code 0 when everything is inside its limits, 1 otherwise.
import { build } from '../../engine/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
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
const folder = args[0];
if (!folder || folder.startsWith('--')) {
  console.log("Usage: node tools/checks/capture_relayout.mjs <capture folder> [--size 9:16] [--staging <name>] [--options '<json>'] [--energy hype] [--captions on|off] [--title on|off] [--text-rect x,y,w,h] [--render <mp4>] [--json out.json]");
  process.exit(2);
}
const fps = Number(flag('--fps', 60));
const options = JSON.parse(flag('--options', '{}'));
const sizeName = flag('--size', '9:16');
const captionsOn = flag('--captions', 'on') !== 'off';
const titleOn = flag('--title', 'off') === 'on';
const textRect = flag('--text-rect') ? flag('--text-rect').split(',').map(Number) : null;
const render = flag('--render');
let renderScaleKnown = null;

// The engine's own pure modules, bundled for node.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-relayout-'));
const entry = path.join(dir, 'entry.ts');
fs.writeFileSync(
  entry,
  [
    `export { planCapture } from '${engine}/src/kit/capture/plan';`,
    `export { withThings } from '${engine}/src/kit/capture/glue';`,
    `export { resolveLook } from '${engine}/src/kit/capture/looks';`,
    `export { SIZES, sizedStaging, sizedLayout, zonesFor, platformNames, PLATFORM_ZONES, pointerExtent, pointerBoxOf, isPhoneTake, marginOf } from '${engine}/src/kit/capture/relayout';`,
  ].join('\n'),
);
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'm.mjs'), logLevel: 'error', absWorkingDir: engine });
const E = await import(pathToFileURL(path.join(dir, 'm.mjs')).href);

const read = (name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
const cursor = read('cursor.json');
const rawTracks = fs.existsSync(path.join(folder, 'tracks.json')) ? read('tracks.json') : undefined;
const tracks = E.withThings(cursor, rawTracks, options.things);
const [W, H] = E.SIZES[sizeName];
const energy = flag('--energy', options.look === 'social-vertical' || options.look === 'launch' || options.look === 'feature-montage' ? 'hype' : 'confident');
const staging = flag('--staging', E.resolveLook(options.look).staging);
const phone = E.isPhoneTake(cursor.page);
const look = { ...options, cursorStyle: options.cursorStyle ?? (phone ? 'touch' : undefined) };
const laid = E.sizedStaging(staging, { width: W, height: H }, { ...cursor.page, scale: cursor.scale }, { captions: captionsOn, title: titleOn });
const layout = E.sizedLayout(W, H, { captions: captionsOn, title: titleOn });
const region = laid.region;
const relayout = laid.relayout;

const planOptions = {
  from: look.from,
  to: look.to,
  look: look.look,
  overrides: { cursor: look.cursorStyle, cursorSize: look.cursorSize, pace: look.pace, repath: look.repath, magnet: look.magnet, camera: look.camera },
  time: look.trimLoads === undefined ? look.time : { ...look.time, trimLoads: look.trimLoads },
  moves: look.moves,
  holds: look.holds,
  energy,
  region: relayout,
};
const plan = E.planCapture(cursor, tracks, planOptions);
const { map, pointer, camera } = plan;
const follow = camera.follow;
if (!follow) {
  console.log('This frame and staging do not need the follow camera (the region has the page\'s own shape).');
  process.exit(0);
}
const problems = [];
const frames = Math.floor(map.duration * fps);
const k = follow.k;
const base = camera.base ?? 1;
const sx = region.width / relayout.width;
const toFrame = (v, p) => ({ x: region.x + ((p.x - v.cx) * v.zoom * k + relayout.width / 2) * sx, y: region.y + ((p.y - v.cy) * v.zoom * k + relayout.height / 2) * sx });
const rectToFrame = (v, r) => {
  const a = toFrame(v, r);
  return { x: a.x, y: a.y, width: r.width * v.zoom * k * sx, height: r.height * v.zoom * k * sx };
};
const safe = { x: region.x + relayout.safe.x, y: region.y + relayout.safe.y, width: relayout.safe.width, height: relayout.safe.height };
const margin = follow.margin;
const room = (r) => Math.min(r.x - safe.x, r.y - safe.y, safe.x + safe.width - (r.x + r.width), safe.y + safe.height - (r.y + r.height)) - margin;
const lookResolved = plan.look;
const s1 = (n) => n.toFixed(1);
const name = `${path.basename(path.dirname(path.dirname(folder)))}/${path.basename(folder)}`;
console.log(`Re-layout check: ${name}, ${sizeName} (${W} x ${H}), staging "${staging}" (${laid.kind}), look "${options.look ?? 'product-demo'}", ${energy}, ${map.duration.toFixed(2)} s of film`);
console.log(`  safe area: ${s1(safe.x)}, ${s1(safe.y)} to ${s1(safe.x + safe.width)}, ${s1(safe.y + safe.height)} (frame px), margin ${margin} px kept inside it`);

// ------------------------------------------------ every frame
const stopAt = (f) => follow.stops.find((s) => f >= s.t0 - 1e-6 && f <= s.t1 + 1e-6) ?? null;
const rows = [];
let leastThing = { room: Infinity, at: 0 };
let leastPointer = { room: Infinity, at: 0 };
const outside = [];
let sharpest = 0;
for (let i = 0; i <= frames; i++) {
  const f = i / fps;
  const v = camera.at(f);
  const rec = map.recAt(f);
  const st = pointer.at(rec);
  const scale = v.zoom * k;
  sharpest = Math.max(sharpest, scale * sx);
  const stop = stopAt(f);
  const thing = stop?.thing ? rectToFrame(v, stop.thing) : null;
  const shown = st.opacity > 0.05 && lookResolved.cursor !== 'hidden';
  const grow = Math.sqrt(v.zoom / base);
  const pointerBox = shown ? rectToFrame(v, E.pointerExtent(st, lookResolved.cursor, E.pointerBoxOf(lookResolved.cursor, lookResolved.cursorSize, H, grow), scale)) : null;
  const tip = toFrame(v, st);
  const row = { i, f, v, rec, thing, pointerBox, tip, shown, stop };
  rows.push(row);
  if (thing) {
    const r = room(thing);
    if (r < leastThing.room) leastThing = { room: r, at: f };
    if (r < -0.5) outside.push({ i, what: 'the acted-on thing', room: r });
  }
  if (pointerBox) {
    const r = room(pointerBox);
    if (r < leastPointer.room) leastPointer = { room: r, at: f };
    if (r < -0.5) outside.push({ i, what: 'the pointer', room: r });
  }
}
const ranges = (list) => {
  const out = [];
  for (const x of list) {
    const last = out[out.length - 1];
    if (last && x.i === last.to + 1 && x.what === last.what) {
      last.to = x.i;
      last.worst = Math.min(last.worst, x.room);
    } else out.push({ from: x.i, to: x.i, what: x.what, worst: x.room });
  }
  return out;
};
const thingFrames = rows.filter((r) => r.thing).length;
const pointerFrames = rows.filter((r) => r.pointerBox).length;
console.log(`  safe: ${frames + 1} frames; the acted-on thing on ${thingFrames}, least room ${s1(leastThing.room)} px (at ${leastThing.at.toFixed(2)} s); the pointer shown on ${pointerFrames}, least room ${s1(leastPointer.room)} px (at ${leastPointer.at.toFixed(2)} s)`);
for (const r of ranges(outside)) problems.push(`${r.what} leaves the safe area (with its margin) on frames ${r.from} to ${r.to} (${(r.from / fps).toFixed(2)} to ${(r.to / fps).toFixed(2)} s), by up to ${s1(-r.worst)} px`);

// ------------------------------------------------ camera moves: one direction each, trailing the pointer
const centre = (v) => ({ x: v.cx, y: v.cy, z: Math.log(v.zoom) });
const moveReports = [];
for (const m of follow.moves) {
  const i0 = Math.max(0, Math.ceil(m.t0 * fps));
  const i1 = Math.min(frames, Math.floor(m.t1 * fps));
  if (i1 - i0 < 2) continue;
  const turns = { x: 0, y: 0, z: 0 };
  const last = { x: 0, y: 0, z: 0 };
  const total = { x: centre(rows[i1].v).x - centre(rows[i0].v).x, y: centre(rows[i1].v).y - centre(rows[i0].v).y, z: centre(rows[i1].v).z - centre(rows[i0].v).z };
  for (let i = i0 + 1; i <= i1; i++) {
    const [a, b] = [centre(rows[i - 1].v), centre(rows[i].v)];
    for (const axis of ['x', 'y', 'z']) {
      const d = b[axis] - a[axis];
      // Steps under 0.05 page pixels (or 0.01% zoom) a frame are rest, not a direction.
      const tiny = axis === 'z' ? 1e-4 : 0.05;
      if (Math.abs(d) < tiny) continue;
      const sign = Math.sign(d);
      if (last[axis] && sign !== last[axis]) turns[axis] += 1;
      last[axis] = sign;
    }
  }
  const report = { kind: m.kind, from: +m.t0.toFixed(3), to: +m.t1.toFixed(3), seconds: +(m.t1 - m.t0).toFixed(3), turns, zoom: +Math.exp(total.z).toFixed(3) };
  if (m.kind === 'follow' && m.pointer) {
    // Progress along the move's longer axis: the pointer's from its start to its end, the camera's over its own move.
    const [a, e] = m.pointer;
    const pa = pointer.at(map.recAt(a));
    const pe = pointer.at(map.recAt(e));
    const axis = Math.abs(pe.x - pa.x) >= Math.abs(pe.y - pa.y) ? 'x' : 'y';
    const span = pe[axis] - pa[axis];
    const c0 = rows[i0].v[axis === 'x' ? 'cx' : 'cy'];
    const c1 = rows[i1].v[axis === 'x' ? 'cx' : 'cy'];
    let ahead = -Infinity;
    let halfPointer = null;
    let halfCamera = null;
    for (let i = Math.floor(a * fps); i <= i1; i++) {
      const p = Math.abs(span) > 1 ? (pointer.at(rows[i].rec)[axis] - pa[axis]) / span : 1;
      const c = Math.abs(c1 - c0) > 1 ? (rows[i].v[axis === 'x' ? 'cx' : 'cy'] - c0) / (c1 - c0) : 0;
      // Ahead only counts while the pointer is still on its way: once it has landed, a spring may settle past it.
      if (i >= i0 && p < 0.999) ahead = Math.max(ahead, c - p);
      if (halfPointer === null && p >= 0.5) halfPointer = i / fps;
      if (halfCamera === null && c >= 0.5 && i >= i0) halfCamera = i / fps;
    }
    report.behind_ms = halfPointer !== null && halfCamera !== null ? Math.round((halfCamera - halfPointer) * 1000) : null;
    report.most_ahead = +Math.max(0, ahead).toFixed(3);
    if (report.most_ahead > 0.02) problems.push(`the follow from ${report.from} s gets ahead of the pointer (by ${(report.most_ahead * 100).toFixed(0)}% of its way)`);
  }
  // A spring lands a little past and settles back once: one turn per direction at most, and none for other moves.
  const allowed = m.spring ? 1 : 0;
  report.spring = m.spring;
  if (turns.x > allowed || turns.y > allowed || turns.z > allowed) problems.push(`the ${m.kind} move from ${report.from} s turns back on itself (${turns.x} across, ${turns.y} up or down, ${turns.z} in or out${m.spring ? '; a spring may settle back once' : ''})`);
  moveReports.push(report);
}
for (const r of moveReports)
  console.log(`  move: ${r.kind} ${r.from} to ${r.to} s (${Math.round(r.seconds * 1000)} ms), zoom x${r.zoom}, ${r.spring ? `spring settling back ${Math.max(r.turns.x, r.turns.y, r.turns.z)} time` : `${r.turns.x + r.turns.y + r.turns.z} turns`}${r.behind_ms !== undefined ? `, half way ${r.behind_ms} ms behind the pointer, never ahead by more than ${(r.most_ahead * 100).toFixed(1)}%` : ''}`);

// ------------------------------------------------ steps (jumps), holds
const steps = [];
for (let i = 1; i <= frames; i++) {
  const [a, b] = [rows[i - 1], rows[i]];
  // How far the picture moves under the safe area's middle, in frame pixels, and the zoom's reach across the region.
  const mid = { x: (safe.x + safe.width / 2 - region.x) / sx, y: (safe.y + safe.height / 2 - region.y) / sx };
  const p = { x: (mid.x - relayout.width / 2) / (a.v.zoom * k) + a.v.cx, y: (mid.y - relayout.height / 2) / (a.v.zoom * k) + a.v.cy };
  const q = toFrame(b.v, p);
  steps[i] = { x: q.x - (region.x + mid.x * sx), y: q.y - (region.y + mid.y * sx), z: (Math.log(b.v.zoom / a.v.zoom) * relayout.width * sx) / 2 };
}
let jumps = [];
let worstOff = { off: 0, at: 0 };
const size = (v) => Math.hypot(v.x, v.y, v.z);
for (let i = 2; i < frames; i++) {
  const [a, b, c] = [steps[i - 1], steps[i], steps[i + 1]];
  const off = size({ x: b.x - (a.x + c.x) / 2, y: b.y - (a.y + c.y) / 2, z: b.z - (a.z + c.z) / 2 });
  const around = Math.max(size(a), size(c));
  if (off > worstOff.off) worstOff = { off, at: i / fps, around };
  if (off > 0.5 * around + 4) jumps.push({ at: +(i / fps).toFixed(3), off: +off.toFixed(1) });
}
const fastest = Math.max(...steps.slice(1).map(size));
console.log(`  steps: the picture moves at most ${s1(fastest)} px a frame; ${jumps.length} camera jumps (the step furthest off its neighbours: ${worstOff.off.toFixed(2)} px at ${worstOff.at.toFixed(2)} s)`);
for (const j of jumps) problems.push(`the camera jumps at ${j.at} s (${j.off} px off the steps either side)`);
for (const [h0, h1] of options.holds ?? []) {
  let most = 0;
  for (let i = Math.ceil(h0 * fps) + 1; i <= Math.min(frames, Math.floor(h1 * fps)); i++) most = Math.max(most, size(steps[i]));
  console.log(`  hold ${h0} to ${h1} s: the camera's largest step ${most.toFixed(2)} px`);
  if (most > 0.25) problems.push(`the camera moves during the reading hold ${h0} to ${h1} s (${most.toFixed(2)} px a frame)`);
}
const sharpLimit = (cursor.scale ?? 2) + 1e-6;
console.log(`  sharp: closest view ${sharpest.toFixed(3)} frame px per page px (the recording holds ${cursor.scale ?? 2})`);
if (sharpest > sharpLimit) problems.push(`the camera goes past the recording's sharpness (${sharpest.toFixed(2)} > ${cursor.scale})`);

// ------------------------------------------------ text at the click
const ffGray = (input, seek, crop, out) => {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(seek), '-i', input, '-frames:v', '1', '-vf', `crop=${crop.map(Math.round).join(':')},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${input} at ${seek} s: ${r.stderr}`);
  return { data: r.stdout, w: Math.round(crop[0]), h: Math.round(crop[1]) };
};
/** Rows of a grey crop that hold ink (pixels much darker than the crop's own background). */
const inkRows = (img) => {
  const bg = [...img.data].sort((a, b) => a - b)[Math.floor(img.data.length * 0.6)];
  const rowsWithInk = [];
  for (let y = 0; y < img.h; y++) {
    let dark = 0;
    for (let x = 0; x < img.w; x++) if (img.data[y * img.w + x] < bg - 70) dark++;
    if (dark >= 2) rowsWithInk.push(y);
  }
  return rowsWithInk.length ? { top: rowsWithInk[0], bottom: rowsWithInk[rowsWithInk.length - 1], height: rowsWithInk[rowsWithInk.length - 1] - rowsWithInk[0] + 1 } : null;
};
const report = {
  capture: name,
  size: sizeName,
  staging,
  kind: laid.kind,
  look: options.look ?? 'product-demo',
  energy,
  film_seconds: +map.duration.toFixed(3),
  frames: frames + 1,
  safe_area: { x: safe.x, y: safe.y, width: safe.width, height: safe.height, margin },
  thing_frames: thingFrames,
  thing_least_room_px: +leastThing.room.toFixed(2),
  pointer_frames: pointerFrames,
  pointer_least_room_px: +leastPointer.room.toFixed(2),
  moves: moveReports,
  camera_jumps: jumps,
  sharpest_px_per_page_px: +sharpest.toFixed(3),
};
const clicks = pointer.clicks.filter((c) => c.t >= plan.from && c.t <= plan.to);
const recording = path.join(folder, 'recording.mp4');
if (textRect && clicks.length && fs.existsSync(recording)) {
  const c = clicks[0];
  const fClick = map.filmAt(c.t);
  const row = rows[Math.round(fClick * fps)];
  const scaleRec = cursor.scale ?? 2;
  const [tx, ty, tw, th] = textRect;
  // The words' columns clear of the drawn pointer (it rests on the thing at the click), the same in both measures.
  let [x0, x1] = [tx, tx + tw];
  if (row.pointerBox) {
    const pb = { x: (row.pointerBox.x - region.x) / sx, w: row.pointerBox.width / sx };
    const left = row.v.cx + (pb.x - relayout.width / 2) / (row.v.zoom * k);
    const right = left + pb.w / (row.v.zoom * k);
    if (tx + tw - right >= 30) x0 = Math.max(x0, right + 2);
    else if (left - tx >= 30) x1 = Math.min(x1, left - 2);
  }
  const ink = inkRows(ffGray(recording, c.t, [(x1 - x0) * scaleRec, th * scaleRec, x0 * scaleRec, ty * scaleRec]));
  if (ink) {
    const inkPage = ink.height / scaleRec;
    const framePx = inkPage * row.v.zoom * k * sx;
    report.text = { at: +fClick.toFixed(3), columns: [+x0.toFixed(1), +x1.toFixed(1)], ink_page_px: +inkPage.toFixed(1), frame_px: +framePx.toFixed(1), share_of_height: +(framePx / H).toFixed(4), sharpest_share: +((inkPage * scaleRec) / H).toFixed(4) };
    console.log(`  text: at the click (${fClick.toFixed(2)} s) the clicked words (page x ${x0.toFixed(0)} to ${x1.toFixed(0)}, clear of the pointer) are ${inkPage.toFixed(1)} page px tall from their top to their lowest stroke, ${framePx.toFixed(1)} px in the frame: ${((framePx / H) * 100).toFixed(2)}% of its height (the sharpest the recording allows is ${((inkPage * scaleRec) / H * 100).toFixed(2)}%)`);
    if (render) {
      const box = rectToFrame(row.v, { x: x0, y: ty, width: x1 - x0, height: th });
      const got = inkRows(ffGray(render, (Math.round(fClick * fps) + 0.5) / fps, [box.width * renderScale(), box.height * renderScale(), box.x * renderScale(), box.y * renderScale()]));
      if (got) {
        report.text.render_frame_px = +(got.height / renderScale()).toFixed(1);
        console.log(`  text in the render: ${(got.height / renderScale()).toFixed(1)} px (${((got.height / renderScale() / H) * 100).toFixed(2)}% of frame height, measured at the render's ${renderScale()}x size)`);
      }
    }
  }
}
function renderScale() {
  if (!render) return 1;
  if (renderScaleKnown === null) {
    const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'csv=p=0', render]);
    renderScaleKnown = Number(String(r.stdout).trim()) / W;
  }
  return renderScaleKnown;
}

// ------------------------------------------------ the platforms' buttons and captions, at key moments
// A stop's key moment: from the pointer's arrival through its action (click, typing) and the proof moment after it
// (at least 1.2 s), or the whole stop when shorter.
const holdAfter = lookResolved.camera.holdAfter ?? 0.8;
const keyOf = (stop) => {
  const actions = [...pointer.clicks.map((c) => map.filmAt(c.up)), ...cursor.events.filter((e) => e.type === 'type' || e.type === 'paste').map((e) => map.filmAt(e.end ?? e.t))].filter((t) => t >= stop.t0 && t <= stop.t1);
  const end = Math.min(stop.t1, Math.max(stop.t0 + 1.2, ...actions.map((t) => t + holdAfter)));
  return [stop.t0, end];
};
const keys = follow.stops.filter((s) => s.thing).map(keyOf);
const inKey = (f) => keys.some(([a, b]) => f >= a && f <= b);
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
report.platforms = {};
for (const platform of E.platformNames) {
  const zones = E.zonesFor(platform, W, H);
  const fails = [];
  for (const row of rows) {
    if (!inKey(row.f)) continue;
    const items = [['the acted-on thing', row.thing], ['the pointer', row.pointerBox], ['the caption slot', layout.captions], ['the title slot', layout.title]];
    for (const [what, box] of items) {
      if (!box) continue;
      for (const z of zones) if (overlap(box, z.rect)) fails.push({ i: row.i, what: `${what} under ${z.name}`, room: 0 });
    }
  }
  const failRanges = ranges(fails.sort((a, b) => (a.what < b.what ? -1 : a.what > b.what ? 1 : a.i - b.i)));
  const keyFrames = rows.filter((r) => inKey(r.f)).length;
  report.platforms[platform] = { key_frames: keyFrames, failing: failRanges.map((r) => ({ frames: [r.from, r.to], seconds: [+(r.from / fps).toFixed(2), +(r.to / fps).toFixed(2)], what: r.what })) };
  if (!zones.length) console.log(`  ${E.PLATFORM_ZONES[platform].label}: nothing drawn over a ${sizeName} post`);
  else if (!failRanges.length) console.log(`  ${E.PLATFORM_ZONES[platform].label}: passes (${keyFrames} key-moment frames clear of its buttons and captions)`);
  else {
    console.log(`  ${E.PLATFORM_ZONES[platform].label}: fails`);
    for (const r of failRanges) {
      const line = `${E.PLATFORM_ZONES[platform].label}: ${r.what} on frames ${r.from} to ${r.to} (${(r.from / fps).toFixed(2)} to ${(r.to / fps).toFixed(2)} s)`;
      console.log(`    ${line}`);
      problems.push(line);
    }
  }
}

// ------------------------------------------------ the picture: is the thing where the plan says, in the render?
if (render && fs.existsSync(recording)) {
  const rs = renderScale();
  const checks = [];
  const moments = [...follow.stops.filter((s) => s.thing).map((s) => (s.t0 + s.t1) / 2), ...clicks.map((c) => map.filmAt(c.arrive) + 0.05)];
  const scaleRec = cursor.scale ?? 2;
  for (const f of moments) {
    const row = rows[Math.min(frames, Math.round(f * fps))];
    const thing = row.stop?.thing;
    if (!thing) continue;
    const box = rectToFrame(row.v, thing);
    const pad = 14;
    const w = Math.round(box.width * rs);
    const h = Math.round(box.height * rs);
    if (w < 8 || h < 8) continue;
    // The recording's own pixels of the thing, scaled to the render's size, against the render around the plan's place.
    const ref = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(row.rec), '-i', recording, '-frames:v', '1', '-vf', `crop=${Math.round(thing.width * scaleRec)}:${Math.round(thing.height * scaleRec)}:${Math.round(thing.x * scaleRec)}:${Math.round(thing.y * scaleRec)},scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 }).stdout;
    const cx = Math.max(0, Math.round((box.x - pad) * rs));
    const cy = Math.max(0, Math.round((box.y - pad) * rs));
    const cw = Math.min(Math.round(W * rs) - cx, w + 2 * Math.round(pad * rs));
    const ch = Math.min(Math.round(H * rs) - cy, h + 2 * Math.round(pad * rs));
    const got = spawnSync('ffmpeg', ['-v', 'error', '-ss', String((row.i + 0.5) / fps), '-i', render, '-frames:v', '1', '-vf', `crop=${cw}:${ch}:${cx}:${cy},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 26 }).stdout;
    let best = { score: -2, dx: 0, dy: 0 };
    // Pixels under the drawn pointer (grown a little) are left out: it rests on the thing and is not the page.
    const keep = new Uint8Array(w * h).fill(1);
    if (row.pointerBox) {
      const pb = row.pointerBox;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const fx = box.x + x / rs;
          const fy = box.y + y / rs;
          if (fx > pb.x - 10 && fx < pb.x + pb.width + 10 && fy > pb.y - 10 && fy < pb.y + pb.height + 10) keep[y * w + x] = 0;
        }
    }
    const scoreAt = (ox, oy) => {
      let n = 0;
      let sa = 0;
      let sb = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (keep[y * w + x]) {
            n++;
            sa += ref[y * w + x];
            sb += got[(oy + y) * cw + ox + x];
          }
      const [ma, mb] = [sa / n, sb / n];
      let num = 0;
      let da = 0;
      let db = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (keep[y * w + x]) {
            const u = ref[y * w + x] - ma;
            const v = got[(oy + y) * cw + ox + x] - mb;
            num += u * v;
            da += u * u;
            db += v * v;
          }
      return num / Math.sqrt(Math.max(1e-6, da * db));
    };
    const grid = [];
    let at = { ox: 0, oy: 0 };
    for (let oy = 0; oy + h <= ch; oy++) {
      grid[oy] = [];
      for (let ox = 0; ox + w <= cw; ox++) {
        const score = scoreAt(ox, oy);
        grid[oy][ox] = score;
        if (score > best.score) {
          best = { score, dx: 0, dy: 0 };
          at = { ox, oy };
        }
      }
    }
    // A parabola through the best and its neighbours gives the place to a fraction of a pixel.
    const sub = (m, c, p) => (m === undefined || p === undefined ? 0 : Math.max(-0.5, Math.min(0.5, (m - p) / (2 * (m - 2 * c + p) || 1e-9))));
    const fx = sub(grid[at.oy][at.ox - 1], best.score, grid[at.oy][at.ox + 1]);
    const fy = sub(grid[at.oy - 1]?.[at.ox], best.score, grid[at.oy + 1]?.[at.ox]);
    best.dx = (cx + at.ox + fx) / rs - box.x;
    best.dy = (cy + at.oy + fy) / rs - box.y;
    checks.push({ at: +f.toFixed(3), match: +best.score.toFixed(3), off_px: +Math.hypot(best.dx, best.dy).toFixed(1), dx: +best.dx.toFixed(1), dy: +best.dy.toFixed(1) });
  }
  report.picture = checks;
  for (const c of checks) {
    console.log(`  picture at ${c.at} s: the thing found ${c.off_px} px from where the plan put it (${c.dx} across, ${c.dy} down; match ${c.match})`);
    if (c.off_px > 3 || c.match < 0.6) problems.push(`in the render at ${c.at} s the thing is ${c.off_px} px from the plan's place (match ${c.match})`);
  }
}

report.problems = problems;
// The same plan's options, for tools/checks/capture_motion.mjs --options (its things are folded into tracks here).
report.capture_motion_options = planOptions;
const out = flag('--json');
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(problems.length ? `\n${problems.length} problem${problems.length > 1 ? 's' : ''}:\n  - ${problems.join('\n  - ')}` : '\nEverything is inside its limits.');
process.exit(problems.length ? 1 : 0);
