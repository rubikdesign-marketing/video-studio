#!/usr/bin/env node
// Readable after zoom (DESIGN.md section 14 item 12; CAPTURE-PLAN.md section 8): measures the size of the text a
// viewer must read in the finished frame, at the moments that matter, as a share of frame height.
//
//   node tools/checks/text_size.mjs <render.mp4> --job jobs/<job> [--film <film.json>] [--at 2.5,7.1]
//        [--capture <take folder> --clip '<json>' --start <s> --place x,y,width] [--ui-floor 4] [--also 3]
//        [--min 2.6] [--frames <folder>] [--json out.json]
//
// Moments: every click, hover, mark and reading hold of each product capture in the film (shots.json "capture" and
// "clip", placed through the engine's own plan: tools/checks/lib/capture_place.mjs), the middle of every on-screen
// text's hold (film.json "texts"), and any --at times. At each it reads the frame with tesseract and measures each
// word's type size from the height of its ink (capitals and tall letters, descenders, or x-height only, each in its
// own share of the type size), then sorts the words:
//   at the action   product words on or next to the thing clicked, hovered or marked: the words being read. They must
//                   be at least --ui-floor % of frame height (default 4, CAPTURE-PLAN 8). The owner has not chosen
//                   between 4% and about 3% for product screens, so each is also reported against --also (3).
//   film text       words outside the product and the caption: titles, labels. Each line at least --min % (2.6,
//                   craft file 04); 2.0 to 2.6% is allowed only for legal lines and "Sped up", and is reported.
//   caption         the caption's words (fixed at 4%), reported.
//   other UI        product words away from the action: reported, never failed (a product shows small text).
// Text size is measured after every camera move, in the frame itself, so zooms, scales and stagings are included.
// Reading frames is imperfect: a moment where no word could be read at the action says so; look at that frame.
// Exit code 0 when every measured line passes, 1 when one is too small, 2 when it could not run.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { captionAt, captionBox, capturePlacements, grow, loadFilm, rel } from './lib/film.mjs';

// The ink height of a word as a share of its type size, by the letters it has (a sans like Inter or Instrument Sans:
// capitals 0.73, x-height 0.55, descenders 0.21 below the line). Checked on type set at known sizes in Chrome.
const TALL = /[A-Z0-9bdfhklt]/;
const LOW = /[gjpqy]/;
export function emOf(text, inkHeight) {
  const t = String(text).replace(/[^\p{L}\p{N}]/gu, '');
  if (t.length < 2) return null;
  const tall = TALL.test(t);
  const low = LOW.test(t);
  const share = tall && low ? 0.95 : tall ? 0.74 : low ? 0.75 : 0.55;
  return inkHeight / share;
}

/** Words from tesseract's TSV, in the frame's own pixels (the frame was read `scale` times larger). */
export function parseTsv(tsv, scale = 1) {
  const out = [];
  for (const row of String(tsv).split('\n').slice(1)) {
    const c = row.split('\t');
    if (c.length < 12 || c[0] !== '5') continue;
    const text = c[11].trim();
    const conf = Number(c[10]);
    // A word has three letters or figures, at least one a letter, and is not one character repeated: icons are
    // often read as "88", "oo" or "000", and two-letter scraps are measured badly.
    const alnum = text.match(/[\p{L}\p{N}]/gu) ?? [];
    if (conf < 60 || alnum.length < 3 || !/\p{L}/u.test(text) || new Set(alnum.map((c) => c.toLowerCase())).size < 2) continue;
    out.push({ text, conf, x: Number(c[6]) / scale, y: Number(c[7]) / scale, width: Number(c[8]) / scale, height: Number(c[9]) / scale, line: `${c[2]}.${c[3]}.${c[4]}` });
  }
  return out;
}

const inside = (w, b) => {
  const cx = w.x + w.width / 2;
  const cy = w.y + w.height / 2;
  return b && cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
};
const median = (list) => {
  const s = [...list].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
/** Words in rows: a word joins a row when its middle is within half its height of the row's. */
const rows = (words) => {
  const out = [];
  for (const w of [...words].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const cy = w.y + w.height / 2;
    const r = out.find((o) => Math.abs(o.cy - cy) < Math.max(w.height, o.h) / 2);
    if (r) r.words.push(w);
    else out.push({ cy, h: w.height, words: [w] });
  }
  return out;
};

/**
 * Sorts one moment's words and judges them. `words`: [{text, x, y, width, height}] in frame pixels; `focus`: the box
 * of the thing acted on (or null); `caption`: the caption pill's box (or null); `regions`: the product's areas.
 */
export function judgeMoment({ words, focus, caption, regions }, { height, floor = 4, also = 3, min = 2.6, legal = 2.0 }) {
  const pct = (px) => (px / height) * 100;
  const sized = words.map((w) => ({ ...w, em: emOf(w.text, w.height) })).filter((w) => w.em);
  const zone = focus ? grow(focus, Math.max(8, 0.25 * Math.min(focus.width, focus.height))) : null;
  const inCaption = sized.filter((w) => inside(w, caption));
  const rest = sized.filter((w) => !inside(w, caption));
  const atAction = zone ? rest.filter((w) => inside(w, zone)) : [];
  const inProduct = rest.filter((w) => !atAction.includes(w) && regions.some((r) => inside(w, r)));
  const film = rest.filter((w) => !atAction.includes(w) && !inProduct.includes(w));
  const result = {};
  if (focus) {
    const share = atAction.length ? pct(median(atAction.map((w) => w.em))) : null;
    result.focus = { read: atAction.length > 0, share, pass: share !== null && share >= floor, passAlso: share !== null && share >= also, words: atAction.map((w) => w.text) };
  }
  if (inCaption.length) result.caption = { share: pct(median(inCaption.map((w) => w.em))), words: inCaption.map((w) => w.text) };
  if (film.length) {
    const lines = rows(film).map((r) => ({ text: r.words.map((w) => w.text).join(' '), share: pct(median(r.words.map((w) => w.em))) }));
    const small = lines.filter((l) => l.share < min);
    result.film = { lines, pass: small.every((l) => l.share >= legal), legalOnly: small.filter((l) => l.share >= legal), tooSmall: small.filter((l) => l.share < legal), smallest: Math.min(...lines.map((l) => l.share)) };
  }
  if (inProduct.length) result.ui = { share: pct(median(inProduct.map((w) => w.em))), smallest: pct(Math.min(...inProduct.map((w) => w.em))) };
  return result;
}

// ------------------------------------------------ frames

const probe = (video) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout);
  return { width: j.streams[0].width, height: j.streams[0].height, duration: Number(j.format.duration) };
};

/** The words in the frame at time t, in film-frame pixels (W wide). The frame is read at 3840 px wide or more. */
export function wordsAt(video, t, { videoWidth, W, keep }) {
  const up = Math.max(1, 3840 / videoWidth);
  const png = spawnSync('ffmpeg', ['-v', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', '-vf', `scale=iw*${up}:ih*${up}:flags=lanczos,format=gray`, '-f', 'image2pipe', '-c:v', 'png', '-'], { maxBuffer: 256 * 1024 * 1024 }).stdout;
  if (!png?.length) return null;
  if (keep) fs.writeFileSync(path.join(keep, `${t.toFixed(2)}.png`), png);
  const tsv = spawnSync('tesseract', ['stdin', 'stdout', '--psm', '11', '-l', 'eng', 'tsv'], { input: png, maxBuffer: 64 * 1024 * 1024 }).stdout.toString('utf8');
  return parseTsv(tsv, (up * videoWidth) / W);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const video = args[0] && !args[0].startsWith('--') ? args[0] : null;
  const jobDir = flag('--job');
  if (!video || !jobDir) {
    console.log("Usage: node tools/checks/text_size.mjs <render.mp4> --job jobs/<job> [--film <film.json>] [--at 2.5,7.1] [--capture <take> --clip '<json>' --start <s> --place x,y,width] [--ui-floor 4] [--also 3] [--min 2.6] [--frames <folder>] [--json out.json]");
    process.exit(2);
  }
  const floor = Number(flag('--ui-floor', 4));
  const also = Number(flag('--also', 3));
  const min = Number(flag('--min', 2.6));
  let film;
  try {
    film = loadFilm(jobDir, { film: flag('--film') });
  } catch (e) {
    console.log(e.message);
    process.exit(2);
  }
  const v = probe(video);
  const keep = flag('--frames');
  if (keep) fs.mkdirSync(keep, { recursive: true });
  const wanted = capturePlacements(film);
  if (flag('--capture')) {
    const [x, y, width] = (flag('--place') ?? `0,0,${film.width}`).split(',').map(Number);
    const start = Number(flag('--start', 0));
    wanted.push({ scene: film.scenes.find((s) => start >= s.start && start < s.end)?.id ?? '?', shot: 1, takeDir: path.resolve(flag('--capture')), clip: JSON.parse(flag('--clip', '{}')), start, place: { x, y, width } });
  }
  const placements = [];
  if (wanted.length) {
    const { placeCapture } = await import('./lib/capture_place.mjs');
    for (const w of wanted) placements.push({ ...(await placeCapture(w, film)), scene: w.scene });
  }
  // The moments to measure.
  const moments = [];
  for (const p of placements) for (const m of p.moments) moments.push({ t: m.t, what: `${m.kind} ${m.kind === 'mark' || m.kind === 'hold' ? `"${m.name}"` : `on "${m.name}"`}`, focus: m.focus, focusName: m.focusName, zoom: m.scale, scene: p.scene });
  for (const s of film.scenes)
    for (const tx of s.texts ?? []) {
      const t = s.start + (tx.at + Math.min(tx.out, s.end - s.start)) / 2;
      moments.push({ t, what: `on-screen text "${tx.lines.join(' ').replace(/\*/g, '')}"`, focus: null, scene: s.id });
    }
  for (const t of (flag('--at') ?? '').split(',').filter(Boolean).map(Number)) moments.push({ t, what: 'asked for', focus: null, scene: film.scenes.find((s) => t >= s.start && t < s.end)?.id ?? '?' });
  moments.sort((a, b) => a.t - b.t);
  const inRange = moments.filter((m) => m.t >= 0 && m.t < v.duration - 0.02);
  console.log(`Readable after zoom: ${rel(video)} (${v.width} x ${v.height}), film ${film.width} x ${film.height}, ${inRange.length} moments; product text at the action at least ${floor}% of frame height (also shown against ${also}%), film text at least ${min}%`);
  const results = [];
  let failures = 0;
  const f1 = (n) => (n === null || n === undefined ? '-' : `${n.toFixed(2)}%`);
  for (const m of inRange) {
    const words = wordsAt(video, m.t, { videoWidth: v.width, W: film.width, keep });
    if (!words) {
      console.log(`  ${m.t.toFixed(2)} s: could not read the frame`);
      continue;
    }
    const line = captionAt(film.captions, m.t);
    const caption = line ? captionBox(line, film, film.scenes.find((s) => m.t >= s.start && m.t < s.end)?.captions ?? 'bottom') : null;
    const regions = placements.filter((p) => m.t >= p.start && m.t <= p.end).map((p) => p.region);
    const r = judgeMoment({ words, focus: m.focus, caption, regions }, { height: film.height, floor, also, min });
    const parts = [];
    let bad = false;
    if (r.focus) {
      if (!r.focus.read) parts.push(`at the action ("${m.focusName}"): no words read; look at the frame (an icon, or text too small to read)`);
      else {
        parts.push(`at the action ("${m.focusName}"): ${f1(r.focus.share)} ${r.focus.pass ? 'pass' : `UNDER ${floor}%`}${r.focus.pass ? '' : r.focus.passAlso ? ` (passes ${also}%)` : ` (also under ${also}%)`}, zoom ${m.zoom?.toFixed(2)} frame px per page px, read "${r.focus.words.slice(0, 5).join(' ')}"`);
        if (!r.focus.pass) bad = true;
      }
    }
    if (r.film) {
      const small = [...r.film.tooSmall, ...r.film.legalOnly];
      parts.push(`film text: smallest ${f1(r.film.smallest)}${small.length ? `; ${r.film.tooSmall.length ? 'TOO SMALL' : 'small (only legal lines and "Sped up" may be)'}: ${small.map((l) => `"${l.text.slice(0, 40)}" ${f1(l.share)}`).join(', ')}` : ', pass'}`);
      if (!r.film.pass) bad = true;
    }
    if (r.caption) parts.push(`caption ${f1(r.caption.share)}`);
    if (r.ui) parts.push(`other product text ${f1(r.ui.share)} (smallest ${f1(r.ui.smallest)})`);
    if (!parts.length) parts.push('no words read');
    if (bad) failures++;
    console.log(`  ${m.t.toFixed(2)} s ${m.scene} ${m.what}: ${parts.join('; ')}`);
    results.push({ ...m, result: r, fail: bad });
  }
  if (flag('--json')) fs.writeFileSync(flag('--json'), JSON.stringify({ video: rel(video), floor, also, min, results }, null, 1));
  if (failures) {
    console.log(`Fail: ${failures} of ${results.length} moments have text a viewer needs that is too small. Push in closer or crop tighter on the action (never past the recording's sharpness), or set it larger.`);
    process.exit(1);
  }
  console.log(`Pass: every measured moment is readable (${results.length} moments).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
