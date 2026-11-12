#!/usr/bin/env node
// Captions clear of UI (DESIGN.md section 14 item 12; CAPTURE-PLAN.md section 8): no caption pill covers a tracked
// product thing, or the thing clicked, hovered or marked at its key moment.
//
//   node tools/checks/captions_clear.mjs jobs/<job> [--film <film.json>] [--captions <captions.json>]
//        [--capture <take folder> --clip '<json>' --start <s> --place x,y,width] [--margin 0.5] [--json out.json]
//
// It reads the film's scene times (film.json), the captions file (jobs/<job>/audio/captions.json), and every shot in
// shots.json whose "capture" is a take (with "clip": the CaptureClip settings, "at" and "place" in the frame). Or give
// one capture by hand with --capture. The caption pill is placed as the engine places it (engine/src/kit/Captions.tsx:
// bottom of a wide frame, or the top for a scene with "captions": "top" in shots.json; the caption slot in a tall
// frame), its width estimated from its letters (a little wider than the real pill, so a near miss is reported).
// Each product thing's box comes from the engine's own plan (tools/checks/lib/capture_place.mjs), grown by --margin
// (% of frame height, default 0.5) so a caption that only touches it counts.
//
// It reports, in plain words, each caption that covers a thing: when, which caption, which thing, by how much.
// Exit code 0 when every caption is clear, 1 when one covers product UI, 2 when it could not run.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { captionAt, captionBox, grow, lineText, loadFilm, overlap, capturePlacements, rel } from './lib/film.mjs';

const STEP = 0.1; // seconds between looks at tracked things while a caption is up

/**
 * Every caption that covers product UI. `film`: { width, height, captions, scenes: [{ id, start, end, captions }] };
 * `placements`: [{ scene, moments: [{ kind, name, t, focus, focusName }], thingsAt(t), start, end }]; `band`: the
 * caption slot of a tall frame. Returns [{ t, until, moment, what, caption, scene, box, cover }].
 */
export function captionClashes(film, placements, { margin = 0.5, band = null } = {}) {
  const size = { width: film.width, height: film.height };
  const m = (margin * film.height) / 100;
  const sceneOf = (t) => film.scenes.find((s) => t >= s.start && t < s.end) ?? film.scenes.at(-1);
  const pillAt = (t) => {
    const line = captionAt(film.captions, t);
    if (!line) return null;
    return { line, box: captionBox(line, size, sceneOf(t)?.captions ?? 'bottom', band) };
  };
  const out = [];
  for (const p of placements) {
    // Key moments: the acted-on thing.
    for (const mo of p.moments) {
      if (!mo.focus) continue;
      const pill = pillAt(mo.t);
      if (!pill) continue;
      const cover = overlap(pill.box, grow(mo.focus, m));
      if (cover) out.push({ t: mo.t, until: mo.t, moment: mo.kind, what: mo.focusName ?? mo.name, caption: lineText(pill.line), scene: p.scene, box: mo.focus, pill: pill.box, cover });
    }
    // Tracked things, all the while a caption is up.
    const spans = new Map();
    for (const line of film.captions?.lines ?? []) {
      for (let t = Math.max(p.start, line.start - 0.1); t <= Math.min(p.end, line.end + 0.4); t += STEP) {
        const pill = pillAt(t);
        if (!pill) continue;
        for (const thing of p.thingsAt(t).filter((x) => x.tracked)) {
          const cover = overlap(pill.box, grow(thing.box, m));
          if (!cover) continue;
          const key = `${thing.name}\u0000${lineText(pill.line)}`;
          const s = spans.get(key);
          if (s && t - s.until <= STEP * 1.5) s.until = t;
          else if (!s) spans.set(key, { t, until: t, moment: 'tracked', what: thing.name, caption: lineText(pill.line), scene: p.scene, box: thing.box, pill: pill.box, cover });
        }
      }
    }
    out.push(...spans.values());
  }
  return out.sort((a, b) => a.t - b.t);
}

const MOMENT_WORDS = { click: 'the click on', hover: 'the pointer resting on', mark: 'the marked moment after', hold: 'the reading hold on', tracked: 'the tracked thing' };

async function main() {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const jobDir = args[0] && !args[0].startsWith('--') ? args[0] : null;
  if (!jobDir) {
    console.log("Usage: node tools/checks/captions_clear.mjs jobs/<job> [--film <film.json>] [--captions <file>] [--capture <take> --clip '<json>' --start <s> --place x,y,width] [--margin 0.5] [--json out.json]");
    process.exit(2);
  }
  let film;
  try {
    film = loadFilm(jobDir, { film: flag('--film') });
  } catch (e) {
    console.log(e.message);
    process.exit(2);
  }
  if (flag('--captions')) film.captions = JSON.parse(fs.readFileSync(flag('--captions'), 'utf8'));
  if (!film.captions?.lines?.length) {
    console.log(`No captions file for ${rel(film.job)} (audio/captions.json), so there is nothing to check. Make it with tools/film/captions.mjs.`);
    process.exit(2);
  }
  const { placeCapture, engineModules } = await import('./lib/capture_place.mjs');
  const M = await engineModules();
  const band = M.isWide(film.width, film.height) ? null : M.sizedLayout(film.width, film.height).band;
  const wanted = capturePlacements(film);
  if (flag('--capture')) {
    const [x, y, width] = (flag('--place') ?? `0,0,${film.width}`).split(',').map(Number);
    const start = Number(flag('--start', 0));
    const scene = film.scenes.find((s) => start >= s.start && start < s.end);
    wanted.push({ scene: scene?.id ?? '?', shot: 1, takeDir: path.resolve(flag('--capture')), clip: JSON.parse(flag('--clip', '{}')), start, place: { x, y, width } });
  }
  console.log(`Captions clear of UI: ${rel(film.job)}, ${film.width} x ${film.height}, ${film.captions.lines.length} caption lines, ${wanted.length} product capture${wanted.length === 1 ? '' : 's'}`);
  if (!wanted.length) {
    console.log('  No shot plays a product capture (shots.json "capture" naming a take), so no caption can cover product UI.');
    console.log('Pass (nothing to check).');
    process.exit(0);
  }
  const placements = [];
  for (const w of wanted) {
    const p = await placeCapture({ ...w, energy: w.energy }, film);
    placements.push({ ...p, scene: w.scene, start: p.start, end: Math.min(p.end, w.end ?? p.end) });
    console.log(`  ${w.scene} shot ${w.shot}: ${rel(w.takeDir)}, ${p.start.toFixed(2)} to ${p.end.toFixed(2)} s, ${p.moments.length} key moments`);
  }
  const clashes = captionClashes(film, placements, { margin: Number(flag('--margin', 0.5)), band });
  const r1 = (n) => Math.round(n);
  for (const c of clashes) {
    const when = c.until > c.t ? `${c.t.toFixed(2)} to ${c.until.toFixed(2)} s` : `${c.t.toFixed(2)} s`;
    console.log(`  COVERED at ${when} (${c.scene}): the caption "${c.caption}" sits over ${MOMENT_WORDS[c.moment] ?? ''} "${c.what}" (${r1(c.cover.width)} x ${r1(c.cover.height)} px of it; the thing is at ${r1(c.box.x)}, ${r1(c.box.y)}, ${r1(c.box.width)} x ${r1(c.box.height)}; the caption ${r1(c.pill.x)}, ${r1(c.pill.y)}, ${r1(c.pill.width)} x ${r1(c.pill.height)})`);
  }
  if (flag('--json')) fs.writeFileSync(flag('--json'), JSON.stringify({ film: rel(film.file), clashes }, null, 1));
  if (clashes.length) {
    console.log(`Fail: ${clashes.length} caption${clashes.length === 1 ? '' : 's'} over product UI. Move the captions to the other edge for that scene ("captions": "top" or "bottom" in shots.json), or frame the product so the thing sits clear of the caption band.`);
    process.exit(1);
  }
  console.log(`Pass: every caption is clear of the product's tracked and acted-on things at every key moment.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
