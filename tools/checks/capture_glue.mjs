#!/usr/bin/env node
// Checks that a product animation stays glued to the real thing, on a render, frame by frame.
//
//   node tools/checks/capture_glue.mjs <render.mp4> --capture <capture folder> --target <thing> --kind outline|lift
//        --colour <the thing's own colour, #rrggbb> --brand <brand> [--clip '<json>'] [--energy confident] [--json out.json]
//
// Render the GlueProbe composition first (engine/src/capture/GlueProbe.tsx) with the same capture, target, kind and
// clip settings, at full size: it fills a 1920 x 1080 frame with the capture and one animation on one thing.
// For every frame this works out, from the engine's own plan (time map, camera) and tracks.json, where the thing
// should be in the frame, and measures two things in the picture:
//   picture  the edges of the real thing in the recording (pixels of its own colour) against where the tracks say:
//            this is how well the picture and the tracks agree (the capture's own timing, through the camera)
//   drawn    outline: the gap between the real thing's edge in the picture and the drawn line's inner edge, against
//            the designed gap; lift: the edges of the lifted layer (cut from the picture) against the thing grown 2.8%
//            and raised 0.5%
// Edges at the frame's border are skipped (the thing is cut off there). Exit code 0 when every measured edge is
// within 2 px, 1 otherwise.
import { build } from '../../engine/node_modules/esbuild/lib/main.js';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const studio = path.join(here, '..', '..');
const engine = path.join(studio, 'engine');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const video = args[0];
const folder = flag('--capture');
const target = flag('--target');
const kind = flag('--kind', 'outline');
const colour = flag('--colour');
const brandName = flag('--brand');
if (!video || !folder || !target || !colour || !brandName) {
  console.log("Usage: node tools/checks/capture_glue.mjs <render.mp4> --capture <folder> --target <thing> --kind outline|lift --colour '#rrggbb' --brand <brand> [--clip '<json>']");
  process.exit(2);
}
const clip = JSON.parse(flag('--clip', '{}'));
const energy = flag('--energy', 'confident');
const W = 1920;
const H = 1080;
const FPS = 60;
const vh = (n) => (H * n) / 100;
const LIMIT = 2;

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'capture-glue-')), 'glue.mjs');
fs.writeFileSync(out + '.entry.ts', `export { planCapture } from '${path.join(engine, 'src/kit/capture/plan.ts')}';\nexport { rectToRegion, regionView, targetRect, seenTracks } from '${path.join(engine, 'src/kit/capture/glue.ts')}';\nexport { presets, timing, easing, clamp01 } from '${path.join(engine, 'src/kit/motion.ts')}';\n`);
await build({ entryPoints: [out + '.entry.ts'], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', absWorkingDir: engine });
const { planCapture, rectToRegion, regionView, targetRect, seenTracks, presets, timing, easing, clamp01 } = await import(pathToFileURL(out).href);

const read = (name) => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
const cursor = read('cursor.json');
// Where the picture really was while the page scrolled, as the engine uses it (tools/film/seen_scroll.mjs).
const seenFile = path.join(folder, 'seen.json');
const tracks = seenTracks(read('tracks.json'), fs.existsSync(seenFile) ? read('seen.json') : null);
if (!fs.existsSync(seenFile)) console.log('No seen.json: the tracks are used as measured in the page (run tools/film/seen_scroll.mjs first).');
// The same settings CaptureClip gives the plan for this clip (planOfClip in CaptureClip.tsx), pointer hidden.
const plan = planCapture(cursor, tracks, {
  from: clip.from,
  to: clip.to,
  look: clip.look,
  overrides: { cursor: 'hidden', camera: clip.camera },
  time: clip.time,
  moves: clip.moves ?? [],
  holds: clip.holds,
  energy,
});
const brandJson = JSON.parse(fs.readFileSync(path.join(studio, 'brands', brandName, 'brand.json'), 'utf8'));
const accent = brandJson.colours.light.accent;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const thingRgb = rgb(colour);
const accentRgb = rgb(accent);
const near = (buf, i, c, d) => {
  const dr = buf[i] - c[0];
  const dg = buf[i + 1] - c[1];
  const db = buf[i + 2] - c[2];
  return dr * dr + dg * dg + db * db < d * d;
};

const k = W / cursor.page.width;
const length = presets[energy].length;
const enter = (timing.base * length) / 1000;
const expectedAt = (i) => {
  const f = i / FPS;
  const rec = plan.map.recAt(f);
  const rect = targetRect(tracks, target, rec);
  if (!rect) return null;
  const box = rectToRegion(regionView(plan.camera.at(f), k, W, H), rect);
  if (kind === 'lift') {
    const a = easing.arrive(clamp01(f / enter));
    const s = 1 + 0.028 * a;
    return { box: { x: box.x + box.width / 2 - (box.width * s) / 2, y: box.y + box.height / 2 - (box.height * s) / 2 - Math.min(vh(0.5), 0.012 * box.height) * a, width: box.width * s, height: box.height * s }, raw: box, settled: a > 0.999 };
  }
  return { box, raw: box, settled: true };
};

const results = { frames: 0, measured: 0, picture: [], drawn: [], worstPicture: 0, worstDrawn: 0, over: [] };
const frameBytes = W * H * 3;
const ff = spawn('ffmpeg', ['-v', 'error', '-i', video, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
let pending = Buffer.alloc(0);
let index = 0;

const measure = (buf, i) => {
  const e = expectedAt(i);
  results.frames += 1;
  if (!e || !e.settled) return;
  const b = e.box;
  // The thing's own pixels near where it should be.
  const x0 = Math.max(0, Math.floor(b.x - 60));
  const x1 = Math.min(W - 1, Math.ceil(b.x + b.width + 60));
  const y0 = Math.max(0, Math.floor(b.y - 60));
  const y1 = Math.min(H - 1, Math.ceil(b.y + b.height + 60));
  if (x1 - x0 < 20 || y1 - y0 < 20) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, count = 0;
  for (let y = y0; y <= y1; y += 1)
    for (let x = x0; x <= x1; x += 1) {
      if (!near(buf, (y * W + x) * 3, thingRgb, 60)) continue;
      count += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  if (count < 200) return;
  results.measured += 1;
  // Each edge to a fraction of a pixel, on the line through the middle of the thing: the last pixel that is partly
  // the thing counts by how much of it is the thing's colour against the background beyond it.
  const px = (x, y) => (y * W + x) * 3;
  const cov = (x, y, c, bg) => {
    const o = px(x, y);
    let num = 0, den = 0;
    for (let ch = 0; ch < 3; ch++) {
      num += (buf[o + ch] - bg[ch]) * (c[ch] - bg[ch]);
      den += (c[ch] - bg[ch]) ** 2;
    }
    return den ? Math.max(0, Math.min(1, num / den)) : 0;
  };
  const colourAt = (x, y) => [buf[px(x, y)], buf[px(x, y) + 1], buf[px(x, y) + 2]];
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const midY = Math.round((minY + maxY) / 2);
  const midX = Math.round((minX + maxX) / 2);
  // An edge: from the bounding box's side inwards to the first pixel of the thing on the middle line, then the
  // partial pixel just outside it. dx, dy point outwards.
  const edgeOf = (sx, sy, dx, dy) => {
    let x = sx, y = sy;
    for (let s = 0; s < 6 && inside(x, y) && !near(buf, px(x, y), thingRgb, 60); s++) { x -= dx; y -= dy; }
    if (!inside(x, y) || !near(buf, px(x, y), thingRgb, 60)) return null;
    const ox = x + dx, oy = y + dy;
    if (!inside(ox + 2 * dx, oy + 2 * dy)) return null;
    const bg = colourAt(ox + 2 * dx, oy + 2 * dy);
    const c = cov(ox, oy, thingRgb, bg);
    // The edge between the thing's last full pixel and the next, moved out by the share of the next that is the thing.
    const base = dx ? (dx < 0 ? x : x + 1) : dy < 0 ? y : y + 1;
    return { at: base + (dx || dy) * c, out: [ox, oy], bg };
  };
  const sides = {
    left: edgeOf(minX, midY, -1, 0),
    right: edgeOf(maxX, midY, 1, 0),
    top: edgeOf(midX, minY, 0, -1),
    bottom: edgeOf(midX, maxY, 0, 1),
  };
  const edges = [];
  const keep = (name, got, want, atBorder) => {
    if (atBorder || !got) return;
    edges.push({ name, error: +(got.at - want).toFixed(2) });
  };
  // A sliver of the thing at the frame's edge is narrowed by its own rounded corners: its sides are not measured then.
  const sliver = maxY - minY < 40;
  keep('left', sides.left, b.x, sliver || b.x < 2 || minX <= 0);
  keep('right', sides.right, b.x + b.width, sliver || b.x + b.width > W - 2 || maxX >= W - 1);
  keep('top', sides.top, b.y, b.y < 2 || minY <= 0);
  keep('bottom', sides.bottom, b.y + b.height, b.y + b.height > H - 2 || maxY >= H - 1);
  const pictureWorst = Math.max(0, ...edges.map((x) => Math.abs(x.error)));
  results.picture.push({ frame: i, worst: pictureWorst, edges });
  results.worstPicture = Math.max(results.worstPicture, pictureWorst);
  if (kind === 'outline') {
    // From the real thing's edge in the picture, outwards, to the drawn line's inner edge (to a fraction of a pixel):
    // the gap must be the designed one (0.7% of the frame height to the middle of the line), whatever the tracks say.
    const pad = vh(0.7);
    const inner = pad - vh(0.36) / 2;
    const drawn = [];
    const side = (name, edge, dx, dy, atBorder) => {
      if (atBorder || !edge) return;
      let [x, y] = edge.out;
      x += dx;
      y += dy;
      for (let s = 0; s < 30; s++, x += dx, y += dy) {
        if (!inside(x, y)) return;
        if (!near(buf, px(x, y), accentRgb, 90)) continue;
        // The pixel before the first one of the line's colour is partly the line: its share moves the edge inwards.
        const c = cov(x - dx, y - dy, accentRgb, edge.bg);
        const innerEdge = dx ? (dx < 0 ? x + 1 + c : x - c) : dy < 0 ? y + 1 + c : y - c;
        drawn.push({ name, error: +(Math.abs(innerEdge - edge.at) - inner).toFixed(2) });
        return;
      }
    };
    side('left', sides.left, -1, 0, sliver || minX - pad < 3);
    side('right', sides.right, 1, 0, sliver || maxX + pad > W - 3);
    side('top', sides.top, 0, -1, minY - pad < 3);
    side('bottom', sides.bottom, 0, 1, maxY + pad > H - 3);
    const worst = Math.max(0, ...drawn.map((x) => Math.abs(x.error)));
    results.drawn.push({ frame: i, worst, edges: drawn });
    results.worstDrawn = Math.max(results.worstDrawn, worst);
    if (worst > LIMIT || pictureWorst > LIMIT) results.over.push({ frame: i, picture: edges, drawn });
  } else {
    // Lift: the picture measured is the lifted layer itself, so its error is the drawn error.
    results.drawn.push({ frame: i, worst: pictureWorst, edges });
    results.worstDrawn = Math.max(results.worstDrawn, pictureWorst);
    if (pictureWorst > LIMIT) results.over.push({ frame: i, picture: edges });
  }
};

ff.stdout.on('data', (chunk) => {
  pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
  while (pending.length >= frameBytes) {
    measure(pending.subarray(0, frameBytes), index);
    index += 1;
    pending = pending.subarray(frameBytes);
  }
});
await new Promise((resolve) => ff.on('close', resolve));

const moving = (list) => list.length;
console.log(`Glue check: ${kind} on "${target}", ${results.frames} frames, ${results.measured} with the thing on screen`);
console.log(`  picture  the real thing against its tracked rectangle: worst ${results.worstPicture.toFixed(2)} px over ${moving(results.picture)} frames`);
console.log(`  drawn    the ${kind} against the real thing:              worst ${results.worstDrawn.toFixed(2)} px over ${moving(results.drawn)} frames`);
const scrollFrames = results.picture.filter((p) => {
  const rec = plan.map.recAt(p.frame / FPS);
  return cursor.events.some((e) => e.type === 'scroll' && rec >= e.t && rec <= (e.end ?? e.t));
}).length;
const zoomed = results.picture.filter((p) => {
  const v = plan.camera.at(p.frame / FPS);
  const v2 = plan.camera.at((p.frame + 1) / FPS);
  return Math.abs(v.zoom - v2.zoom) > 1e-4 || Math.abs(v.cx - v2.cx) > 0.01 || Math.abs(v.cy - v2.cy) > 0.01;
}).length;
console.log(`  of these, ${scrollFrames} frames while the page scrolls and ${zoomed} while the camera moves`);
if (results.over.length) console.log(`  ${results.over.length} frames over ${LIMIT} px, first at frame ${results.over[0].frame}: ${JSON.stringify(results.over[0])}`);
const jsonOut = flag('--json');
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ ...results, scrollFrames, cameraFrames: zoomed }, null, 1));
process.exit(results.over.length ? 1 : 0);
