// Pure helpers for Episode 1 (no React, no Remotion), shared by Film.tsx, the sound plan
// (projects/rubik/video-1-edit/build/audio_events.mjs) and the checks. Tests: lib.test.ts.
export type Word = { w: string; t0: number; t1: number };
export type Cue = number | string;

const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9?.,!]/g, '');
const bare = (s: string) => lower(s).replace(/[?.,!]/g, '');

/** The word a cue names: the whole word first (punctuation compared only when the cue has some), then the first word
 *  starting with the cue, then the first word containing it. "call" no longer lands on "basically". */
export function findWord(words: Word[], cue: string): Word | undefined {
  const c = lower(cue); const cb = bare(cue); const punct = c !== cb;
  return words.find((x) => (punct ? lower(x.w) === c : bare(x.w) === cb))
    ?? words.find((x) => bare(x.w).startsWith(cb))
    ?? words.find((x) => bare(x.w).includes(cb));
}

/** A cue as seconds from the shot's start: a number as it is, a word at the moment it begins. */
export function cueTime(words: Word[], start: number, cue: Cue | undefined, dflt = 0): number {
  if (cue === undefined) return dflt;
  if (typeof cue === 'number') return cue;
  const w = findWord(words, cue);
  return w ? Math.max(0, w.t0 - start) : dflt;
}

/** A cue across a group of shots (a card that runs over several voice shots), as seconds from `first`. */
export function groupCueTime(shots: { start: number; words: Word[] }[], cue: Cue, first: number, dflt: number): number {
  if (typeof cue === 'number') return cue;
  const w = findWord(shots.flatMap((s) => s.words), cue);
  return w ? w.t0 - first : dflt;
}

// ---------------------------------------------------------------- page boxes, scroll and views
/** [x, y, w, h] in page pixels of the 1920 x 1080 capture viewport. */
export type Box = [number, number, number, number];
const VW = 1920; const VH = 1080;

/** The page's scroll y at capture time t, from a [t, y] track sampled in time order (linear between samples). */
export function scrollAt(track: [number, number][], t: number): number {
  if (!track.length) return 0;
  if (t <= track[0][0]) return track[0][1];
  const last = track[track.length - 1];
  if (t >= last[0]) return last[1];
  let lo = 0; let hi = track.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (track[m][0] <= t) lo = m; else hi = m; }
  const [t0, y0] = track[lo]; const [t1, y1] = track[hi];
  return y0 + ((y1 - y0) * (t - t0)) / Math.max(1e-9, t1 - t0);
}
/** A box seen in the viewport while the page was scrolled to markScroll, in whole-page coordinates. */
export const pageBox = (b: Box, markScroll: number): Box => [b[0], b[1] + markScroll, b[2], b[3]];
/** A whole-page box as it sits in the viewport when the page is scrolled to scrollY. */
export const viewBox = (b: Box, scrollY: number): Box => [b[0], b[1] - scrollY, b[2], b[3]];
export const contains = (o: Box, i: Box): boolean => i[0] >= o[0] - 1e-6 && i[1] >= o[1] - 1e-6 && i[0] + i[2] <= o[0] + o[2] + 1e-6 && i[1] + i[3] <= o[1] + o[3] + 1e-6;

/** The smallest 16:9 view that holds every box plus a margin, at least minW wide, inside the 1920 x 1080 viewport. */
export function fitView(boxes: Box[], { margin, minW }: { margin: number; minW: number }): Box {
  const x0 = Math.min(...boxes.map((b) => b[0])) - margin; const y0 = Math.min(...boxes.map((b) => b[1])) - margin;
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2])) + margin; const y1 = Math.max(...boxes.map((b) => b[1] + b[3])) + margin;
  let w = Math.max(minW, x1 - x0, ((y1 - y0) * VW) / VH); w = Math.min(VW, w); const h = (w * VH) / VW;
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const x = Math.min(Math.max(cx - w / 2, 0), VW - w); const y = Math.min(Math.max(cy - h / 2, 0), VH - h);
  return [x, y, w, h];
}

// ---------------------------------------------------------------- capture timing and the zoomed view
/** How a capture plays in a shot: from `from`, at the speed that reaches `to` by the shot's end (0.4–2.6x), or at
 *  `forced`; it holds its last frame after `playable` seconds. */
export type CapPlan = { rate: number; playable: number; srcEnd: number };
export function capPlan(capLen: number, from: number, to: number | undefined, len: number, forced?: number): CapPlan {
  const max = capLen - 0.1; const end = Math.min(max, to ?? max);
  const rate = forced ?? (to !== undefined ? Math.min(2.6, Math.max(0.4, (to - from) / len)) : 1);
  const playable = Math.max(0.05, Math.min(len, (end - from) / rate));
  return { rate, playable, srcEnd: from + playable * rate };
}
/** The capture's own time at shot time t. */
export const srcAt = (p: CapPlan, from: number, t: number, still: boolean): number => (still ? from : Math.min(p.srcEnd, from + Math.min(Math.max(0, t), p.playable) * p.rate));

/** cubic-bezier(0.65, 0, 0.35, 1), the film's in-out ease, solved for x by bisection. */
export function inOut(x: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bz = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0; let hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (bz(m, 0.65, 0.35) < x) lo = m; else hi = m; }
  return bz((lo + hi) / 2, 0, 1);
}
const FULL: Box = [0, 0, VW, VH];
export const lerpBox = (a: Box, b: Box, u: number): Box => [0, 1, 2, 3].map((i) => a[i] + (b[i] - a[i]) * u) as Box;
export type Zoom = { from?: Box; to: Box; over?: number };
/** The part of the page in view at shot time t: eases from `from` to `to`, starting at zAt (seconds). */
export function viewAt(zoom: Zoom | undefined, zAt: number, len: number, t: number): Box {
  const zf = zoom?.from ?? FULL; const zt = zoom?.to ?? zf;
  const over = zoom?.over ?? Math.max(0.5, len - zAt);
  return lerpBox(zf, zt, inOut((t - zAt) / over));
}
/** A box marked while the page sat at markScroll, where it is at capture time srcT. */
export const markBoxAt = (box: Box, markScroll: number, track: [number, number][], srcT: number): Box => viewBox(pageBox(box, markScroll), scrollAt(track, srcT));

// ---------------------------------------------------------------- the in-view check
type CheckRing = { at: Cue; out?: Cue; box: Box; mark?: string };
export type Focus = { at?: Cue; over?: number; margin?: number; minW?: number; from?: Box };
type CheckSite = { type: string; cap: string; from: number; to?: number; rate?: number; zoom?: Zoom & { at?: Cue }; focus?: Focus; rings?: CheckRing[]; pause?: { at: Cue; box: Box }; morph?: { at: Cue; box: Box } };
type CheckShot = { n: number; start: number; end: number; words: Word[] };
export type MarksFile = Record<string, { scroll: [number, number][]; marks: Record<string, { t: number; scroll: number }> }>;
export type CheckRow = { shot: number; kind: string; i: number; ok: boolean; cut: number; t: number };
/** Every ring, pause and morph box, checked against the zoomed view from its cue to its end, every 0.1 s.
 *  `cut` is how many page pixels of the box fall outside the view at the worst moment. */
export function checkMarks(spec: Record<number, unknown>, T: { shots: CheckShot[] }, marks: MarksFile, capLen: Record<string, number>, still: (cap: string, from: number) => boolean = () => false): CheckRow[] {
  const rows: CheckRow[] = [];
  for (const shot of T.shots) {
    const sp = spec[shot.n] as CheckSite | undefined;
    if (!sp || sp.type !== 'site') continue;
    const len = shot.end - shot.start; const cap = marks[sp.cap];
    const plan = capPlan(capLen[sp.cap], sp.from, sp.to, len, sp.rate); const st = sp.to === undefined && still(sp.cap, sp.from);
    const zoom = zoomOf(sp, shot, marks, capLen, still); const zAt = cueTime(shot.words, shot.start, zoom?.at, 0);
    const items: [string, number, CheckRing][] = [
      ...(sp.rings ?? []).map((r, i) => ['ring', i, r] as [string, number, CheckRing]),
      ...(sp.pause ? [['pause', 0, { at: sp.pause.at, box: sp.pause.box }] as [string, number, CheckRing]] : []),
      ...(sp.morph ? [['morph', 0, { at: sp.morph.at, box: sp.morph.box }] as [string, number, CheckRing]] : []),
    ];
    for (const [kind, i, r] of items) {
      const a = cueTime(shot.words, shot.start, r.at, 0); const b = r.out !== undefined ? cueTime(shot.words, shot.start, r.out, len) : len;
      let worst = 0; let wt = a;
      for (let t = a; t <= b + 1e-9; t += 0.1) {
        const v = viewAt(zoom, zAt, len, t);
        const m = r.mark && cap?.marks[r.mark];
        const box = m ? markBoxAt(r.box, m.scroll, cap.scroll, srcAt(plan, sp.from, t, st)) : r.box;
        const cut = Math.max(0, v[0] - box[0]) + Math.max(0, v[1] - box[1]) + Math.max(0, box[0] + box[2] - v[0] - v[2]) + Math.max(0, box[1] + box[3] - v[1] - v[3]);
        if (cut > worst) { worst = cut; wt = t; }
      }
      rows.push({ shot: shot.n, kind, i, ok: worst <= 1, cut: Math.round(worst), t: Math.round(wt * 10) / 10 });
    }
  }
  return rows;
}

/** The shot's zoom: its own, or with `focus`, a move to the 16:9 view that holds every highlight as it sits at its
 *  cue (margin 48, at least 720 wide, over 1.2 s, by default). */
export function zoomOf(sp: CheckSite, shot: CheckShot, marks: MarksFile, capLen: Record<string, number>, still: (cap: string, from: number) => boolean = () => false): (Zoom & { at?: Cue }) | undefined {
  if (sp.zoom || !sp.focus || !sp.rings?.length) return sp.zoom;
  const len = shot.end - shot.start; const cap = marks[sp.cap];
  const plan = capPlan(capLen[sp.cap], sp.from, sp.to, len, sp.rate); const st = sp.to === undefined && still(sp.cap, sp.from);
  const boxes = sp.rings.map((r) => { const m = r.mark && cap?.marks[r.mark]; return m ? markBoxAt(r.box, m.scroll, cap.scroll, srcAt(plan, sp.from, cueTime(shot.words, shot.start, r.at, 0), st)) : r.box; });
  const f = sp.focus;
  return { from: f.from ?? FULL, to: fitView(boxes, { margin: f.margin ?? 48, minW: f.minW ?? 720 }), at: f.at ?? 0, over: f.over ?? 1.2 };
}
