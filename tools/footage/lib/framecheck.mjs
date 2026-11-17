// The framing check (FOOTAGE-PLAN.md section 10, "Face framing", "Captions clear of faces", "Sharpness"): every film
// size, ten times a second, from the same keyframes the engine draws (edit/rough/framing.json) and the faces
// ingest found. Pure apart from reading the job's files.
//
//   faces in frame   the framed person's hairline and chin are inside the frame (never tighter than chin to hairline)
//   safe area        their face is inside the size's safe area (tall sizes leave room for the platform's own buttons
//                    and the captions at the bottom)
//   sharpness        no frame enlarges the source more than the size allows (framing.mjs limits)
//   eye line         across a punch-in (a cut inside one take) the eyes stay within 3% of the frame's height
//   captions         while a caption shows, its slot (captionSlot: where the engine places it, bottom or moved to
//                    the top by placeCaptions) never covers a framed face from brows to chin, and every caption line fits
//                    across it
import { limits, personAt } from './framing.mjs';

const SAFE = { // shares of the frame: left/right, top, bottom
  '16:9': { side: 0.03, top: 0.04, bottom: 0.04 },
  '9:16': { side: 0.06, top: 0.1, bottom: 0.25 },
  '1:1': { side: 0.05, top: 0.06, bottom: 0.18 },
  '4:5': { side: 0.05, top: 0.06, bottom: 0.18 },
};
/**
 * Where the caption pill sits, as shares of the frame (engine/src/kit/Captions.tsx with capture/relayout.ts). At the
 * bottom: in a wide frame 6% up from the bottom, 8% tall; in 9:16 at the bottom of the band all three platforms leave
 * free (269 to 1248 of 1920, 65 to 950 of 1080 across); in 1:1 and 4:5 at the bottom of a 5% margin. At the top
 * (a line moved off a face): the same distance from the top. Pure.
 */
export function captionSlot(name, where = 'bottom') {
  if (name === '9:16') {
    const band = { top: 269 / 1920, bottom: 1248 / 1920, left: 65 / 1080, right: 950 / 1080 };
    return where === 'top' ? { from: band.top, to: band.top + 0.08, left: band.left, right: band.right } : { from: band.bottom - 0.08, to: band.bottom, left: band.left, right: band.right };
  }
  const edge = name === '16:9' ? 0.06 : 0.05;
  return where === 'top' ? { from: edge, to: edge + 0.08, left: 0.05, right: 0.95 } : { from: 1 - edge - 0.08, to: 1 - edge, left: 0.05, right: 0.95 };
}

/**
 * The most characters a caption line may hold in a film size, so the pill (type 4% of the height, side padding 3.4%
 * each side) fits across its slot. Glyphs are taken as 0.55 of the type size wide on average, a little wider than
 * most headline faces. Never more than 42. Pure.
 */
export function captionChars(name, out) {
  const slot = captionSlot(name);
  const room = (slot.right - slot.left) * out.w - 2 * 0.034 * out.h;
  return Math.max(12, Math.min(42, Math.floor(room / (0.55 * 0.04 * out.h))));
}

/** The crop at film time t from a piece's keyframes (straight lines between them). Pure. */
export function cropAt(keys, t) {
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1]; const b = keys[i]; const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, w: a.w + (b.w - a.w) * u, h: a.h + (b.h - a.h) * u };
    }
  }
  return keys.at(-1);
}

/**
 * The faces the viewer sees at film time t in piece k, in film pixels (top is the hairline). In a tall frame with two
 * people only the one being followed (the speaker, by speakers.json) counts. Pure.
 */
export function framedFaces(out, p, keys, c, t) {
  const cr = cropAt(keys, t); const s = out.w / cr.w; const srcT = p.in + (t - p.at);
  const tall = out.h / out.w > 0.75;
  let framed = (c.faces?.people || []).map((pp) => ({ id: pp.id, f: personAt(pp, srcT) })).filter((x) => x.f);
  if (tall && framed.length > 1) {
    const sent = (c.speakers?.sentences || []).find((x) => srcT >= x.start - 0.3 && srcT <= x.end + 0.3);
    const inFrame = framed.filter((x) => x.f.eyes[0] >= cr.x && x.f.eyes[0] <= cr.x + cr.w);
    framed = sent ? inFrame.filter((x) => x.id === sent.person) : inFrame.slice(0, 1);
  }
  const ox = (v) => (v - cr.x) * s; const oy = (v) => (v - cr.y) * s;
  return { crop: cr, scale: s, faces: framed.map(({ id, f }) => ({ id, top: oy(f.top[1]), chin: oy(f.chin[1]), left: ox(f.box[0]), right: ox(f.box[0] + f.box[2]), eyeY: oy(f.eyes[1]) })) };
}

/**
 * Whether a caption slot covers a face (film pixels): its features, from the brows (an eighth of the face above the
 * eyes) to the chin. A caption over the hair is allowed, as editors do in tall close-ups. Pure.
 */
const covers = (slot, out, f) => {
  const brow = f.eyeY - 0.125 * (f.chin - f.top);
  return f.chin > slot.from * out.h && brow < slot.to * out.h && f.right > slot.left * out.w && f.left < slot.right * out.w;
};

/** The caption line showing at film time t, if any (Captions.tsx: up to 0.1 s early, 0.4 s held after). */
const lineAt = (lines, t) => lines.find((l) => t >= l.start - 0.1 && t <= l.end + 0.4);

/**
 * Each caption line placed clear of faces: kept at the bottom unless a framed face would sit under it at any moment
 * while it shows and the top slot is clear for the whole line; then moved to the top. A line with faces under both
 * slots stays at the bottom (the check reports it). Pure.
 */
export function placeCaptions(name, out, cut, plan, clips, lines) {
  const bottom = captionSlot(name, 'bottom'); const top = captionSlot(name, 'top');
  // The moments the check looks at: every piece from its start, ten times a second.
  const moments = [];
  cut.pieces.forEach((p, k) => {
    if (p.kind !== 'speech' || !plan[k]?.length) return;
    for (let t = p.at; t <= p.at + p.dur + 1e-6; t += 0.1) moments.push([t, k]);
  });
  return lines.map((ln) => {
    let hitBottom = false; let hitTop = false;
    for (const [t, k] of moments) {
      if (t < ln.start - 0.1 || t > ln.end + 0.4) continue;
      const p = cut.pieces[k];
      const { faces } = framedFaces(out, p, plan[k], clips[p.clip], t);
      if (faces.some((f) => covers(bottom, out, f))) hitBottom = true;
      if (faces.some((f) => covers(top, out, f))) hitTop = true;
    }
    return hitBottom && !hitTop ? { ...ln, position: 'top' } : ln;
  });
}

/**
 * Checks one size. cut: cutlist.json; plan: framing keyframes per piece; clips: { name: { faces, speakers, src,
 * steadyZoom } }; lines: the size's caption lines (with their positions). Without lines, the bottom slot is checked
 * all the time.
 */
export function checkSize(name, out, cut, plan, clips, { captions = true, lines = [] } = {}) {
  const safe = SAFE[name] || SAFE['16:9'];
  const issues = []; let samples = 0; let worstEnlarge = 0;
  const lastEyes = {};
  cut.pieces.forEach((p, k) => {
    const keys = plan[k];
    if (!keys?.length || p.kind !== 'speech') return;
    const c = clips[p.clip];
    const lim = limits(c.src, out, c.steadyZoom || 1);
    for (let t = p.at; t <= p.at + p.dur + 1e-6; t += 0.1) {
      samples++;
      const { scale: enlarge, faces } = framedFaces(out, p, keys, c, t);
      worstEnlarge = Math.max(worstEnlarge, enlarge);
      if (enlarge > lim.allowed * 1.005) issues.push({ size: name, t, what: 'sharpness', detail: `enlarged ${enlarge.toFixed(2)}x, the most this size allows is ${lim.allowed}x` });
      const line = lines.length ? lineAt(lines, t) : { position: 'bottom' };
      const slot = line ? captionSlot(name, line.position || 'bottom') : null;
      for (const f of faces) {
        if (f.top < 0 || f.chin > out.h) issues.push({ size: name, t, what: 'face cut off', detail: `person ${f.id}: ${f.top < 0 ? 'hairline above the frame' : 'chin below the frame'}` });
        else if (f.left < safe.side * out.w || f.right > (1 - safe.side) * out.w || f.top < safe.top * out.h || f.chin > (1 - safe.bottom) * out.h) issues.push({ size: name, t, what: 'outside the safe area', detail: `person ${f.id}` });
        if (captions && slot && covers(slot, out, f)) issues.push({ size: name, t, what: 'caption over a face', detail: `person ${f.id}, caption at the ${line.position || 'bottom'}` });
      }
      if (t === p.at && faces.length === 1) {
        const prev = lastEyes[`${p.clip}:${faces[0].id}`]; // the same person: a speaker switch is not a punch-in
        const join = cut.joins.find((j) => j.after === k - 1);
        if (prev && join && ['pause', 'filler', 'inside a sentence'].includes(join.kind) && prev.k === k - 1 && Math.abs(prev.y - faces[0].eyeY) > 0.03 * out.h) {
          issues.push({ size: name, t, what: 'eye line jumps at a punch-in', detail: `${Math.round(Math.abs(prev.y - faces[0].eyeY))} px` });
        }
      }
      if (faces.length === 1) lastEyes[`${p.clip}:${faces[0].id}`] = { k, y: faces[0].eyeY };
    }
  });
  // Every caption line fits across its slot (the same width estimate as captionChars).
  if (captions) {
    for (const ln of lines) {
      const slot = captionSlot(name, ln.position || 'bottom');
      const room = (slot.right - slot.left) * out.w - 2 * 0.034 * out.h;
      const chars = ln.words.map((w) => w.text).join(' ').length;
      if (chars * 0.55 * 0.04 * out.h > room) issues.push({ size: name, t: ln.start, what: 'caption wider than the frame', detail: `${chars} characters, room for ${captionChars(name, out)}` });
    }
  }
  // One line per kind of problem, with how often and when it first happened.
  const kinds = {};
  for (const i of issues) (kinds[i.what] ??= []).push(i);
  return { size: name, samples, worst_enlargement: Number(worstEnlarge.toFixed(3)), pass: !issues.length,
    captions_moved_up: lines.filter((l) => l.position === 'top').length,
    problems: Object.entries(kinds).map(([what, list]) => ({ what, count: list.length, share: Number((list.length / samples).toFixed(3)), first: Number(list[0].t.toFixed(2)), detail: list[0].detail })) };
}
