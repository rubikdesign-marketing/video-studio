// The footage camera (FOOTAGE-PLAN.md section 5.2 and 5.3): for every piece of a cut and every film size, where the
// frame sits on the footage, moment by moment. Pure: the rough cut writes its keyframes into cut.json, the engine
// draws them, and the framing check measures the same numbers, so what is checked is what is drawn.
//
// A crop is { x, y, w, h } in source pixels (the steady working copy), h = w × out height / out width.
// Rules, in the order they are applied:
//   size        wide: the face (hairline to chin) is 24% of the frame's height (16:9) or 17% (taller frames); close
//               (a punch-in) is 1.22 times tighter than the wide framing as actually used; never tighter than chin to hairline with room (the face at most
//               62% of the frame's height); never enlarged more than 15% beyond what the size unavoidably needs
//               (counting the crop steadying used), never narrower than 390 source pixels
//   place       eyes a third of the way down; more room on the side the person faces (up to 10% of the width)
//   who         one person: them; two people in a wide frame: both (a two-shot); two people in a tall frame: whoever
//               is speaking (speakers.json), switching at the start of their sentence
//   stillness   the frame holds still while the face stays in a calm middle zone (12% of the width, 10% of the
//               height); when it leaves, the frame moves there over 0.8 s, eased in and out, one way
//   punch-ins   a cut inside one take (the same clip, a pause or a filler taken out) alternates wide and close, the
//               eye line kept at the same height
//   push        a slow push of 6% over the film's opening line (2.5 s or longer), once
import { round } from './common.mjs';

export const RULES = {
  wideFace: { landscape: 0.24, tall: 0.17 },
  close: 1.22,
  maxFace: 0.62,
  maxEnlarge: 1.15,
  lead: 0.1,
  calmX: 0.12,
  calmY: 0.1,
  move: 0.8,
  push: 0.06,
  step: 0.1, // seconds between keyframes
};

const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** A person's smoothed position nearest to source time t. Pure. */
export function personAt(person, t) {
  const s = person.smooth;
  if (!s?.length) return null;
  let lo = 0; let hi = s.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m].t <= t) lo = m; else hi = m; }
  const p = Math.abs(s[lo].t - t) <= Math.abs(s[hi].t - t) ? s[lo] : s[hi];
  const raw = person.frames?.find((f) => f && Math.abs(f.t - p.t) < 0.2);
  return { eyes: p.eyes, chin: p.chin, top: p.top, box: p.box, yaw: raw?.yaw ?? 0 };
}

/**
 * The crop width limits for a source and film size. The widest crop the source allows may already need enlarging
 * (a vertical film from 1080p landscape footage needs about 1.8x): that much is unavoidable; on top of it a punch-in may
 * enlarge 15% more (less the crop steadying used), and no crop is narrower than 390 source pixels (what still holds up
 * at a phone's 390 px width). Pure.
 */
export function limits(src, out, steadyZoom = 1) {
  const aspect = out.h / out.w;
  const maxW = Math.min(src.w, src.h / aspect);
  const base = Math.max(1, out.w / maxW);
  const allowed = (base * RULES.maxEnlarge) / steadyZoom;
  const minW = Math.min(maxW, Math.max(390, out.w / allowed));
  return { minW, maxW, aspect, base: round(base, 3), allowed: round(allowed, 3) };
}

/** The crop that frames a face: its size by the face's height, placed by its eyes and where it looks. Pure. */
export function frameFace(face, src, out, { close = false, steadyZoom = 1, people = [face] } = {}) {
  const { minW, maxW, aspect } = limits(src, out, steadyZoom);
  const tall = aspect > 0.75;
  const faceH = Math.max(1, face.chin[1] - face.top[1]);
  const floor = Math.max(minW, (faceH / RULES.maxFace) / aspect); // never tighter than chin to hairline, nor too enlarged
  let w = faceH / (tall ? RULES.wideFace.tall : RULES.wideFace.landscape) / aspect;
  // Two people in one frame: wide enough for both faces with room either side.
  if (people.length > 1) {
    const xs = people.flatMap((p) => [p.box[0], p.box[0] + p.box[2]]);
    w = Math.max(w, (Math.max(...xs) - Math.min(...xs)) * 1.6);
  }
  w = Math.min(maxW, Math.max(w, floor)); // the wide framing as it can really be
  const wide = w;
  if (close) w = Math.max(floor, w / RULES.close); // a punch-in: tighter than the wide framing actually used
  let h = w * aspect;
  const eyes = people.length > 1 ? [people.reduce((a, p) => a + p.eyes[0], 0) / people.length, people.reduce((a, p) => a + p.eyes[1], 0) / people.length] : face.eyes;
  const lead = people.length > 1 || tall ? 0 : Math.max(-1, Math.min(1, face.yaw * 3)) * RULES.lead * w;
  // Eyes a third of the way down; a punch-in keeps the eye line where the wide framing really has it (the wide frame
  // may sit against the picture's edge, which moves the eyes off the third), so the eyes do not jump at the cut.
  let eyeShare = 1 / 3;
  if (close) {
    const wh = wide * aspect;
    const wy = Math.min(Math.max(0, eyes[1] - wh / 3), src.h - wh);
    eyeShare = (eyes[1] - wy) / wh;
  }
  let x = eyes[0] + lead - w / 2;
  let y = eyes[1] - h * eyeShare;
  x = Math.min(Math.max(0, x), src.w - w); y = Math.min(Math.max(0, y), src.h - h);
  return { x: round(x, 1), y: round(y, 1), w: round(w, 1), h: round(h, 1) };
}

/**
 * Keyframes for one piece: [{ t (film seconds), x, y, w, h }]. tOf: film time to source time. who(t): the face to
 * frame at source time t (or the people for a two-shot). Holds still inside the calm zone; eased moves out of it.
 */
export function planPiece({ src, out, at, dur, inT, who, close, steadyZoom, push }) {
  const keys = [];
  let cur = null; let move = null;
  const n = Math.max(1, Math.round(dur / RULES.step));
  for (let k = 0; k <= n; k++) {
    const t = at + (k / n) * dur;
    const s = inT + (t - at);
    const target = who(s);
    if (!target) { if (cur) keys.push({ t: round(t, 3), ...cur }); continue; }
    const want = frameFace(target.face, src, out, { close, steadyZoom, people: target.people });
    if (!cur) cur = want;
    if (move && t >= move.end) { cur = move.to; move = null; }
    if (!move) {
      const dx = Math.abs((want.x + want.w / 2) - (cur.x + cur.w / 2)); const dy = Math.abs((want.y + want.h / 3) - (cur.y + cur.h / 3));
      const switching = target.switched;
      if (switching) { cur = want; } // a new speaker: the frame goes straight to them (a cut, at their sentence's start)
      else if (dx > RULES.calmX * cur.w || dy > RULES.calmY * cur.h || Math.abs(want.w - cur.w) > 0.12 * cur.w) move = { from: cur, to: want, start: t, end: t + RULES.move };
    }
    let f = cur;
    if (move) {
      const u = ease(Math.min(1, (t - move.start) / RULES.move));
      f = Object.fromEntries(['x', 'y', 'w', 'h'].map((kk) => [kk, round(move.from[kk] + (move.to[kk] - move.from[kk]) * u, 1)]));
    }
    // The slow push over the opening line: the frame narrows by up to 6%, around the eye line.
    if (push) {
      const u = Math.min(1, (t - at) / dur);
      const z = 1 - RULES.push * ease(u);
      const lim = limits(src, out, steadyZoom);
      const w = Math.max(lim.minW, f.w * z); const h = w * (out.h / out.w);
      f = { x: round(f.x + (f.w - w) / 2, 1), y: round(f.y + (f.h - h) / 3, 1), w: round(w, 1), h: round(h, 1) };
    }
    keys.push({ t: round(t, 3), ...f });
  }
  return keys;
}

/**
 * Framing for a whole cut, for one film size. clips: { name: { faces, speakers, steadyZoom, src: {w,h} } }.
 * Returns one keyframe list per piece (null for a room-tone piece, which holds the last frame). Pure.
 */
export function planCut(cut, clips, out) {
  const tall = out.h / out.w > 0.75;
  let lastClose = false; let lastClip = null; let pushed = false;
  return cut.pieces.map((p, k) => {
    if (p.kind !== 'speech') return null;
    const c = clips[p.clip];
    const people = c.faces?.people || [];
    if (!people.length) { // no face: the largest crop of the film's shape, centred
      const { maxW, aspect } = limits(c.src, out, c.steadyZoom || 1);
      const w = maxW; const h = w * aspect;
      return [{ t: round(p.at, 3), x: round((c.src.w - w) / 2, 1), y: round((c.src.h - h) / 2, 1), w: round(w, 1), h: round(h, 1) }];
    }
    const join = k > 0 ? cut.joins.find((j) => j.after === k - 1) : null;
    const sameTake = join && lastClip === p.clip && ['pause', 'filler', 'inside a sentence'].includes(join.kind);
    const close = sameTake ? !lastClose : false;
    lastClose = close; lastClip = p.clip;
    const sentences = c.speakers?.sentences || [];
    let prevPerson = null;
    const who = (s) => {
      const here = people.map((pp) => ({ id: pp.id, f: personAt(pp, s) })).filter((x) => x.f);
      if (!here.length) return null;
      if (here.length === 1) return { face: here[0].f, people: [here[0].f] };
      if (!tall) return { face: here[0].f, people: here.map((x) => x.f) }; // a two-shot
      const sent = sentences.find((x) => s >= x.start - 0.3 && s <= x.end + 0.3) || sentences.filter((x) => x.start <= s).at(-1);
      const id = sent?.person ?? prevPerson ?? here[0].id;
      const pick = here.find((x) => x.id === id) || here[0];
      const switched = prevPerson !== null && pick.id !== prevPerson;
      prevPerson = pick.id;
      return { face: pick.f, people: [pick.f], switched };
    };
    const push = !pushed && k === 0 && p.dur >= 2.5;
    if (push) pushed = true;
    return planPiece({ src: c.src, out, at: p.at, dur: p.dur, inT: p.in, who, close, steadyZoom: c.steadyZoom || 1, push });
  });
}
