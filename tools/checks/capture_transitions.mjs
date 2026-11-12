#!/usr/bin/env node
// Checks the transitions between captures by measuring the same plan the engine draws from
// (engine/src/kit/capture/joins.ts): where the pointer and the clicked thing are on screen in every frame around the
// join, and how long the join lasts for the film's energy.
//
//   node tools/checks/capture_transitions.mjs <capture folder> [--second <capture folder>] [--transition <name>|all]
//        [--preset calm|confident|hype] [--options '<json>'] [--size 16:9|9:16|1:1|4:5] [--json out.json]
//
// <capture folder> is engine/public/jobs/<job>/capture/<id>. The take is split at the click that opens its next page
// (splitAtClick), as the library previews do; --second takes the second part from another take of the same script.
// --options is what the previews take: {"join": {...}, "a": {...}, "b": {...}}.
//
// It reports, in plain words, for each transition:
//   length    the join's length against knowledge/craft/03-transitions.md (the scene token, 600 to 900 ms; a cut is
//             one frame), and the cursor drag's pointer moves either side of it
//   pointer   the jump of the pointer on screen at the cut (or at each end of the join, and at the swap of a zoom
//             through), in frame pixels at 1920 x 1080, and the largest step from one frame to the next inside the
//             join against the largest in the half second before it
//   thing     the jump of the clicked thing's centre where one shot hands over to the other
// Exit code 0 when the pointer and the clicked thing stay within 2 px across zoom through, shared element and match
// cut, and every length is inside its limits; 1 otherwise.
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
  console.log('Usage: node tools/checks/capture_transitions.mjs <capture folder> [--second <folder>] [--transition <name>|all] [--preset confident] [--options <json>] [--json out.json]');
  process.exit(2);
}
const preset = flag('--preset', null);
const which = flag('--transition', 'all');
const extra = JSON.parse(flag('--options', '{}'));
const secondFolder = flag('--second', null);

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'capture-joins-')), 'joins.mjs');
await build({ entryPoints: [path.join(engine, 'src/kit/capture/joins.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', absWorkingDir: engine });
const { planJoin, splitAtClick, transitionSpecs, transitionSeconds, rectThroughLayer, throughLayer } = await import(pathToFileURL(out).href);
const { transitionNames } = await import(pathToFileURL(out).href).then(async () => {
  const o2 = path.join(path.dirname(out), 'looks.mjs');
  await build({ entryPoints: [path.join(engine, 'src/kit/capture/looks.ts')], bundle: true, platform: 'node', format: 'esm', outfile: o2, logLevel: 'error', absWorkingDir: engine });
  return import(pathToFileURL(o2).href);
});

const load = (dir) => {
  const read = (n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
  return { src: path.join(dir, 'recording.mp4'), cursor: read('cursor.json'), tracks: fs.existsSync(path.join(dir, 'tracks.json')) ? read('tracks.json') : undefined, look: 'product-demo' };
};
const first = load(folder);
const split = splitAtClick(first);
if (!split) {
  console.log('This take has no click to split it at.');
  process.exit(1);
}
let bBase = split.b;
if (secondFolder) {
  const other = splitAtClick(load(secondFolder));
  if (other) bBase = other.b;
}
const fps = 60;
// --size 9:16, 1:1 or 4:5 checks the join re-laid out for that frame (phase 8); the default is 16:9.
const SIZE = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] }[flag('--size', '16:9')];
if (!SIZE) {
  console.log('--size must be 16:9, 9:16, 1:1 or 4:5.');
  process.exit(2);
}
const frame = { width: SIZE[0], height: SIZE[1], fps };
const strict = ['zoom-through', 'shared-element', 'match-cut'];
const names = which === 'all' ? transitionNames : which.split(',');
const presetOf = (n) => preset ?? (n === 'whip' || n === 'snap-cut' || n === 'grid-zoom' || n === 'stack-shuffle' ? 'hype' : 'confident');
const px = (v) => `${v.toFixed(2)} px`;
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const centre = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const report = [];
let failed = false;

console.log(`Transition check: ${path.basename(path.dirname(path.dirname(folder)))}/${path.basename(folder)}${secondFolder ? ` into ${path.basename(path.dirname(path.dirname(secondFolder)))}/${path.basename(secondFolder)}` : ''}, at ${frame.width} x ${frame.height}`);
for (const name of names) {
  const energy = presetOf(name);
  const a = { ...split.a, ...extra.a };
  const merged = { ...bBase, ...extra.b };
  const b = { ...merged, to: extra.b?.to ?? Math.min(merged.cursor.seconds, (merged.from ?? 0) + 2.6) };
  let plan;
  try {
    plan = planJoin(a, b, { ...extra.join, transition: name }, energy, frame);
  } catch (error) {
    console.log(`  ${name}: the engine refuses it: ${error.message}`);
    failed = true;
    continue;
  }
  const f = (t) => Math.round(t * fps) / fps;
  const spec = transitionSpecs[plan.name];
  const L = plan.length;

  // What the viewer sees of the pointer at a moment: the strongest of the pointers drawn.
  const seen = (t) => {
    const drawn = [];
    for (const w of ['a', 'b']) {
      const l = plan.layer(w, t);
      if (!l.visible || l.opacity < 0.05 || !plan.drawsOwn(w, t)) continue;
      if (w === 'a' && t >= plan.durA) continue;
      const p = plan.ownPointer(w, t);
      drawn.push({ tip: throughLayer(l, p.tip), opacity: p.opacity * l.opacity });
    }
    for (const p of plan.pointers(t)) drawn.push({ tip: p.tip, opacity: p.opacity });
    drawn.sort((x, y) => y.opacity - x.opacity);
    return drawn[0] && drawn[0].opacity > 0.05 ? drawn[0] : null;
  };
  const thingOf = (w, t) => {
    const page = w === 'a' ? plan.thingA : plan.thingBAt(t);
    if (!page) return null;
    return centre(rectThroughLayer(plan.layer(w, t), plan.rectToFrame(w, page, t)));
  };

  // Length.
  const wanted = spec.cut ? 0 : transitionSeconds(energy);
  const lengthOk = spec.cut ? L === 0 : Math.abs(L - wanted) < 1e-6 && L >= 0.6 - 1e-6 && L <= 0.9 + 1e-6;
  // The pointer at the hand-overs.
  const handovers = spec.cut ? [plan.t0] : plan.name === 'zoom-through' ? [plan.t0, plan.bStart, f(plan.swap), plan.t1] : [plan.t0, plan.t1];
  // The jump at a hand-over is the gap between what was drawn just before it and what is drawn from it, at the
  // same instant (so the pointer's own motion in that frame is not counted). A cut is one frame: A's pointer as A
  // had it on the cut frame against B's on that frame.
  const jumps = handovers.map((t) => {
    if (spec.cut) {
      const pa = plan.ownPointer('a', f(t));
      const pb = plan.ownPointer('b', f(t));
      return dist(throughLayer(plan.layer('a', f(t) - 1 / fps), pa.tip), throughLayer(plan.layer('b', f(t)), pb.tip));
    }
    const before = seen(t - 1e-5);
    const now = seen(t);
    return before && now ? dist(before.tip, now.tip) : null;
  });
  const pointerJump = Math.max(0, ...jumps.filter((j) => j !== null));
  let stepIn = 0;
  let stepBefore = 0;
  let prev = null;
  for (let t = f(plan.t0 - 0.5); t <= plan.t1 + 1e-6; t += 1 / fps) {
    const now = seen(t);
    if (prev && now) {
      const s = dist(prev.tip, now.tip);
      if (t < plan.t0) stepBefore = Math.max(stepBefore, s);
      else stepIn = Math.max(stepIn, s);
    }
    prev = now;
  }
  // The clicked thing where one shot hands over to the other.
  let thingJump = null;
  if (plan.thingA) {
    if (spec.cut) {
      const x = centre(plan.rectToFrame('a', plan.thingA, f(plan.t0)));
      const y = thingOf('b', f(plan.t0));
      if (x && y) thingJump = dist(x, y);
    } else if (plan.name === 'zoom-through') {
      // Both pictures show through the dissolve: the thing must lie on itself in every frame of it.
      thingJump = 0;
      for (let t = plan.bStart; t <= plan.t1; t += 1 / fps) {
        if (!plan.layer('a', t).visible || !plan.layer('b', t).visible) continue;
        const x = thingOf('a', t);
        const y = thingOf('b', t);
        if (x && y) thingJump = Math.max(thingJump, dist(x, y));
      }
    } else if (plan.name === 'shared-element') {
      const startPiece = plan.pieces(f(plan.t0))[0];
      const endPiece = plan.pieces(f(plan.t1) - 1 / fps)[1];
      const atStart = dist(centre(startPiece.dst), centre(plan.rectToFrame('a', plan.thingA, f(plan.t0))));
      const landed = plan.thingBAt(f(plan.t1));
      const atEnd = dist(centre(endPiece.dst), centre(plan.rectToFrame('b', landed, f(plan.t1))));
      thingJump = Math.max(atStart, atEnd);
      // Its size at either end, too: the piece is the thing's own pixels at the thing's own size.
      const s0 = plan.rectToFrame('a', plan.thingA, f(plan.t0));
      const s1 = plan.rectToFrame('b', landed, f(plan.t1));
      thingJump = Math.max(thingJump, Math.abs(startPiece.dst.width - s0.width), Math.abs(endPiece.dst.width - s1.width));
    }
  }
  const row = {
    transition: plan.name,
    asked: name,
    energy,
    length_s: +L.toFixed(3),
    wanted_s: +wanted.toFixed(3),
    pointer_moves_s: plan.name === 'cursor-drag' ? [+plan.approach.toFixed(3), +plan.settleBack.toFixed(3)] : undefined,
    join_at_s: +plan.t0.toFixed(3),
    join_end_s: +plan.t1.toFixed(3),
    b_start_s: +plan.bStart.toFixed(3),
    total_s: +plan.total.toFixed(3),
    planned_cuts_s: plan.plannedCuts.map((c) => +c.toFixed(4)),
    pointer_jump_px: +pointerJump.toFixed(2),
    pointer_step_inside_px: +stepIn.toFixed(2),
    pointer_step_before_px: +stepBefore.toFixed(2),
    thing_jump_px: thingJump === null ? null : +thingJump.toFixed(2),
    pointer_mode: plan.pointerMode,
    note: plan.note,
  };
  report.push(row);
  const bad = !lengthOk || (strict.includes(plan.name) && (pointerJump > 2 || (thingJump ?? 0) > 2));
  if (bad) failed = true;
  const len = spec.cut ? 'a cut (one frame)' : `${Math.round(L * 1000)} ms (scene for ${energy}: ${Math.round(wanted * 1000)} ms)`;
  const extraMoves = plan.name === 'cursor-drag' ? `, plus pointer moves of ${Math.round(plan.approach * 1000)} ms before and ${Math.round(plan.settleBack * 1000)} ms after` : '';
  console.log(
    `  ${bad ? 'CHECK' : 'ok   '} ${name}${plan.note ? ` (${plan.note})` : ''}: ${len}${extraMoves}; pointer jump at the hand-over ${px(pointerJump)} ` +
      `(largest step inside ${px(stepIn)}, before ${px(stepBefore)}; ${plan.pointerMode})${thingJump === null ? '' : `; clicked thing ${px(thingJump)}`}`,
  );
}
const outFile = flag('--json', null);
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
process.exit(failed ? 1 : 0);
