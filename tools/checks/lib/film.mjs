// What the film-level checks need to know about a job's film: its size, scene times, planned energy, captions, and
// where each product capture plays (shared by text_size.mjs, captions_clear.mjs and tools/film/sources.mjs).
// Pure file reading and geometry: no engine, no browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const rel = (p) => path.relative(process.cwd(), p) || '.';
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/**
 * The job's film: film.json (given, or the preview's copy in jobs/<job>/out/, or the engine's), shots.json and the
 * captions file. Scenes carry start, end, energy, shots and the caption position ("bottom" unless the shot list's
 * scene says "captions": "top").
 */
export function loadFilm(jobDir, { film: filmFile } = {}) {
  const job = path.resolve(jobDir);
  const name = path.basename(job);
  const candidates = [filmFile, path.join(job, 'out', 'preview.film.json'), path.join(STUDIO, 'engine', 'src', 'jobs', name.replace(/^_/, ''), 'film.json')].filter(Boolean);
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) throw new Error(`No film.json for ${rel(job)} (looked at ${candidates.map(rel).join(', ')}). Scaffold the film first: node tools/film/scaffold.mjs ${rel(job)}`);
  const film = readJson(file);
  const shotsFile = path.join(job, 'shots.json');
  const shots = fs.existsSync(shotsFile) ? readJson(shotsFile) : { scenes: [] };
  const byId = new Map((shots.scenes ?? []).map((s) => [s.id, s]));
  const captionsFile = [path.join(job, 'audio', 'captions.json')].find((f) => fs.existsSync(f));
  const scenes = (film.scenes ?? []).map((s) => {
    const planned = byId.get(s.id) ?? {};
    return { ...s, energy: planned.energy ?? s.energy ?? null, shots: planned.shots ?? [], captions: planned.captions === 'top' ? 'top' : 'bottom', title: s.title ?? planned.title };
  });
  return {
    job,
    name,
    file,
    width: film.width ?? 1920,
    height: film.height ?? 1080,
    fps: film.fps ?? 60,
    duration: film.duration ?? (scenes.at(-1)?.end ?? 0),
    scenes,
    shotsFile: fs.existsSync(shotsFile) ? shotsFile : null,
    captions: captionsFile ? readJson(captionsFile) : null,
    captionsFile: captionsFile ?? null,
  };
}

/** The scene playing at film time `t`. */
export const sceneAt = (film, t) => film.scenes.find((s) => t >= s.start && t < s.end) ?? film.scenes.at(-1);

/**
 * Where a shot's capture comes from. `shot.capture` names a file or folder inside the job: a capture
 * ("capture/<id>": its best take), one take ("capture/<id>/take-2"), or a still or clip taken from a take
 * ("capture/<id>/take-2/marks/x.png"). Returns { kind, takeDir, captureJson } or { kind: 'none', why }.
 */
export function sourceOfShot(jobDir, value) {
  if (!value) return { kind: 'none', why: 'no capture named' };
  const job = path.resolve(jobDir);
  const full = path.resolve(job, value);
  if (!full.startsWith(job + path.sep)) return { kind: 'none', why: `"${value}" is outside the job folder` };
  if (!fs.existsSync(full)) return { kind: 'none', why: `"${value}" is not in the job folder` };
  // Walk up from the named file to the take folder that holds capture.json, or the capture folder with best.json.
  for (let d = fs.statSync(full).isDirectory() ? full : path.dirname(full); d.startsWith(job + path.sep); d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'capture.json')) && /^take-\d+$|^take/.test(path.basename(d))) return { kind: 'take', takeDir: d, captureJson: path.join(d, 'capture.json') };
    const best = path.join(d, 'best.json');
    if (fs.existsSync(best)) {
      const b = readJson(best);
      const takeDir = path.join(d, b.folder ?? `take-${b.take}`);
      if (fs.existsSync(path.join(takeDir, 'capture.json'))) return { kind: 'best', takeDir, captureJson: path.join(takeDir, 'capture.json'), best: b };
      return { kind: 'none', why: `the best take named in ${rel(best)} (${b.folder ?? `take-${b.take}`}) has no capture.json` };
    }
  }
  return { kind: 'none', why: `"${value}" was not made by the capture tool (no take with a capture.json holds it)` };
}

/**
 * Every product capture playing in the film, as placements for the checks: the scene, the shot, the take folder,
 * the CaptureClip settings (`shot.clip`: from, to, look, moves, holds, things, time ...), when it starts in the film
 * (the scene's start plus `shot.clip.at`) and where its page sits in the frame (`shot.clip.place`: {x, y, width}, in
 * frame pixels; the whole frame by default).
 */
export function capturePlacements(film) {
  const out = [];
  for (const scene of film.scenes) {
    scene.shots.forEach((shot, i) => {
      if (!shot.capture) return;
      const src = sourceOfShot(film.job, shot.capture);
      if (src.kind === 'none') return;
      if (!fs.existsSync(path.join(src.takeDir, 'cursor.json'))) return; // a still with no motion data
      const clip = shot.clip ?? {};
      out.push({
        scene: scene.id,
        shot: i + 1,
        takeDir: src.takeDir,
        clip,
        start: scene.start + (clip.at ?? 0),
        end: Math.min(scene.end, clip.until !== undefined ? scene.start + clip.until : scene.end),
        place: { x: clip.place?.x ?? 0, y: clip.place?.y ?? 0, width: clip.place?.width ?? film.width },
        energy: film.energy ?? 'confident',
      });
    });
  }
  return out;
}

// ------------------------------------------------ captions

// The fixed caption design (engine/src/kit/Captions.tsx): text 4% of frame height, pill 8% tall, 3.4% padding each
// side, 6% from the bottom (or top) edge; it shows from 0.1 s before the first word to 0.4 s after the last.
export const CAPTION = { text: 4, height: 8, padding: 3.4, margin: 6, lead: 0.1, hold: 0.4 };
/**
 * Average advance of the caption face per character, as a share of the text size. Measured on the sample render
 * (12 Nov 2026, Tulvo's caption face, four lines of 20 to 41 characters): 0.44 to 0.48. Set about 10% wider than the
 * widest, so the estimated pill is never narrower than the real one and a near miss is reported.
 */
export const CHAR_EM = 0.52;

export const lineText = (line) => line.words.map((w) => w.text).join(' ');

/**
 * The caption pill's box for one line, in frame pixels: centred, at the bottom (or top) of a wide frame, or in the
 * caption slot `band` ({x, y, width, height}) of a tall one.
 */
export function captionBox(line, { width: W, height: H }, position = 'bottom', band = null) {
  const vh = H / 100;
  const text = lineText(line);
  const w = text.length * CHAR_EM * CAPTION.text * vh + 2 * CAPTION.padding * vh;
  const h = CAPTION.height * vh;
  if (band) return { x: band.x + (band.width - w) / 2, y: position === 'top' ? band.y : band.y + band.height - h, width: w, height: h };
  return { x: (W - w) / 2, y: position === 'top' ? CAPTION.margin * vh : H - CAPTION.margin * vh - h, width: w, height: h };
}

/** The caption line on screen at film time t, or null. */
export const captionAt = (captions, t) => (captions?.lines ?? []).find((l) => t >= l.start - CAPTION.lead && t <= l.end + CAPTION.hold) ?? null;

/** The overlap of two boxes ({x, y, width, height}), or null. */
export function overlap(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.width, b.x + b.width);
  const d = Math.min(a.y + a.height, b.y + b.height);
  return r > x && d > y ? { x, y, width: r - x, height: d - y } : null;
}

/** A box grown by `m` pixels on every side. */
export const grow = (b, m) => ({ x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: b.height + 2 * m });
