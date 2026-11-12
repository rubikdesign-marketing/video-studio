// Where a product capture's things sit in the finished frame, from the same plan the engine draws from
// (engine/src/kit/capture/clipplan.ts: planOfClip; the camera and the time map). For the checks that look at
// product UI in a film: text_size.mjs (readable after zoom) and captions_clear.mjs (captions clear of UI).
//
// A placement is { takeDir, clip, start, place }: the take folder (cursor.json, tracks.json, capture.json), the
// CaptureClip settings, the film time the clip starts, and where the clip's page sits in the frame ({x, y, width}
// in frame pixels, the window's own bar not counted). The engine's pure modules are bundled once with esbuild.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { STUDIO } from './film.mjs';

const engine = path.join(STUDIO, 'engine');
let E = null;

/** The engine's plan, glue and relayout modules, bundled for node (read only: nothing in engine/ changes). */
export async function engineModules() {
  if (E) return E;
  const { build } = await import(pathToFileURL(path.join(engine, 'node_modules/esbuild/lib/main.js')).href);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-checks-'));
  const entry = path.join(dir, 'entry.ts');
  fs.writeFileSync(
    entry,
    [
      `export { planOfClip } from '${engine}/src/kit/capture/clipplan';`,
      `export { withThings, seenTracks, regionView, rectToRegion } from '${engine}/src/kit/capture/glue';`,
      `export { sizedLayout, isWide } from '${engine}/src/kit/capture/relayout';`,
    ].join('\n'),
  );
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: path.join(dir, 'm.mjs'), logLevel: 'error', absWorkingDir: engine });
  E = await import(pathToFileURL(path.join(dir, 'm.mjs')).href);
  return E;
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const rectOf = (t) => ({ x: t.x, y: t.y, width: t.w, height: t.h });
const NAVIGATES = ['click', 'double-click', 'open', 'back', 'reload', 'switch', 'as'];

/** The words a step acted on ("Campaign Launch Board" for {"click": "Campaign Launch Board"}). */
const stepName = (step) => {
  for (const k of ['click', 'double-click', 'right-click', 'hover', 'type', 'paste', 'select', 'check', 'toggle', 'drag', 'upload', 'scroll'])
    if (typeof step[k] === 'string') return k === 'type' || k === 'paste' ? step.into ?? step[k] : step[k];
  return null;
};

/**
 * Plans one placement and returns: moments (clicks, hovers, marks and reading holds in film time, each with the
 * acted-on thing's box in the frame as `focus` and the frame pixels per page pixel as `scale`), thingsAt(t) (the
 * tracked things and the step targets on screen at film time t, in frame pixels), region (the clip's page area in
 * the frame) and the film times it plays.
 */
export async function placeCapture({ takeDir, clip = {}, start = 0, place = {}, energy = 'confident' }, { width: W, height: H }) {
  const M = await engineModules();
  const cursor = readJson(path.join(takeDir, 'cursor.json'));
  const rawTracks = fs.existsSync(path.join(takeDir, 'tracks.json')) ? readJson(path.join(takeDir, 'tracks.json')) : undefined;
  const seen = fs.existsSync(path.join(takeDir, 'seen.json')) ? readJson(path.join(takeDir, 'seen.json')) : null;
  const tracks = M.withThings(cursor, M.seenTracks(rawTracks, seen), clip.things);
  const capture = fs.existsSync(path.join(takeDir, 'capture.json')) ? readJson(path.join(takeDir, 'capture.json')) : { steps: [] };
  const plan = M.planOfClip({ ...clip, cursor, tracks, src: '' }, tracks, energy);
  const page = cursor.page;
  const pw = place.width ?? W;
  const ph = (pw * page.height) / page.width;
  const k = pw / page.width;
  const region = { x: place.x ?? 0, y: place.y ?? 0, width: pw, height: ph };
  const duration = plan.map.duration;
  const viewAt = (t) => M.regionView(plan.camera.at(Math.min(Math.max(0, t - start), duration)), k, pw, ph);
  const toFrame = (t, rect) => {
    const b = M.rectToRegion(viewAt(t), rect);
    return { x: region.x + b.x, y: region.y + b.y, width: b.width, height: b.height };
  };
  const scaleAt = (t) => viewAt(t).zoom * k;
  const inClip = (r) => r >= plan.from - 1e-6 && r <= plan.to + 1e-6;
  const filmOf = (r) => start + plan.map.filmAt(r);

  // Step targets: each is on screen from its step's start until the next step that may change the page.
  const steps = capture.steps ?? [];
  const targets = steps
    .filter((s) => s.target && stepName(s.step))
    .map((s) => {
      const next = steps.find((o) => o.n > s.n && NAVIGATES.some((kind) => o.step[kind] !== undefined) && o.start !== undefined);
      return { name: stepName(s.step), n: s.n, kind: Object.keys(s.step)[0], rect: rectOf(s.target), from: s.start ?? 0, to: next ? Math.max(next.start, (s.end ?? s.start) + 0.3) : Infinity, end: s.end ?? s.start };
    });
  const targetOfStep = (n) => targets.find((t) => t.n === n) ?? null;
  const lastTargetBefore = (n) => [...targets].reverse().find((t) => t.n < n) ?? null;

  const moments = [];
  const add = (kind, name, rec, target) => {
    if (!inClip(rec)) return;
    const t = filmOf(rec);
    moments.push({ kind, name, t, rec, focus: target ? toFrame(t, target.rect) : null, focusName: target?.name ?? null, scale: scaleAt(t) });
  };
  for (const e of cursor.events ?? []) {
    if (e.type === 'click') {
      const target = targetOfStep(e.step) ?? { name: 'the click', rect: { x: e.x - 80, y: e.y - 24, width: 160, height: 48 } };
      add('click', target.name, e.t, target);
    } else if (e.type === 'mark') add('mark', e.name, e.t, lastTargetBefore(e.step));
  }
  for (const s of targets.filter((x) => x.kind === 'hover')) add('hover', s.name, s.end, s);
  for (const [a, b] of clip.holds ?? []) {
    const t = start + (a + b) / 2;
    const rec = plan.map.recAt((a + b) / 2);
    const target = [...targets].reverse().find((x) => x.from <= rec) ?? null;
    moments.push({ kind: 'hold', name: `${a}-${b} s`, t, rec, focus: target ? toFrame(t, target.rect) : null, focusName: target?.name ?? null, scale: scaleAt(t) });
  }
  moments.sort((a, b) => a.t - b.t);

  /** Tracked things and step targets on screen at film time t, in frame pixels. */
  const thingsAt = (t) => {
    if (t < start || t > start + duration) return [];
    const rec = plan.map.recAt(t - start);
    const out = [];
    const frames = tracks?.frames ?? [];
    if (frames.length) {
      const i = Math.min(frames.length - 1, Math.max(0, Math.round(rec * (tracks.fps ?? 60))));
      for (const [name, at] of Object.entries(frames[i].at ?? {})) if (at) out.push({ name, tracked: true, box: toFrame(t, { x: at[0], y: at[1], width: at[2], height: at[3] }) });
    }
    for (const s of targets) if (rec >= s.from && rec < s.to) out.push({ name: s.name, tracked: false, box: toFrame(t, s.rect) });
    return out;
  };

  return { moments, thingsAt, region, start, end: start + duration, plan, scaleAt, toFrame, capture, takeDir };
}
