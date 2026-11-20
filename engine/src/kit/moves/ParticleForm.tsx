// Particle form: many small squares that hold one form and re-form into the next (a grid of places becomes a word,
// a number, a ring), the way the best data reels in the motion study carry one count through without a cut.
// Every particle's place is a pure function of time: a seeded start, a delay of up to a quarter of the move, a path
// that curls a little, and a landing with no overshoot. A dissolve takes about 0.7 s and a re-form about 0.9 s.
//
// House rules (knowledge/craft/04-type-and-captions.md, 13-design-styles.md): dots are out everywhere, so the
// particles are squares and cannot be drawn round. A particle field as background decoration is part of the cheap
// kit the study warns about, so the move asks what the form means and refuses a film of scatter alone.
import { useMemo, type CSSProperties, type FC } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useBrand, useFontsLoaded } from '../brand';
import { easing, EXIT_SHARE, lerp, progress, rng, useMotion, type Point } from '../motion';
import { useStage, useVh } from '../ui';
import type { Rect } from './core';
import type { FillRole } from './shape';

/** Measured lengths, seconds: a dissolve 0.6 to 0.8 s, a re-form 0.8 to 1.0 s. */
const DISSOLVE = 0.7;
const REFORM = 0.9;
/** Each particle sets off at most this share of the move late, so the form loosens and gathers rather than jumps. */
const LATEST = 0.25;
/** How far a path curls sideways, as a share of the distance it covers. */
const CURL = 0.18;
/** Most particles a form may have: more is a texture, not a form. */
const MOST = 2400;

/**
 * A form the particles can take. Sizes are pixels of the frame unless they say otherwise.
 * - text: the words set in one of the brand's voices at `size` (% of frame height), centred on `x`, `y`.
 * - path: the inside of a closed SVG path (its own units), fitted into `rect`; `evenOdd` for rings and holes.
 * - grid: `cols` x `rows` cells across `rect`, filled in reading order: one particle a place or a unit.
 * - points: one particle on each point (data), going round again if there are more particles than points.
 * - scatter: loose in `rect`, seeded. A step between forms, never the whole film.
 */
export type ParticleTarget =
  | { kind: 'text'; text: string; size: number; voice?: 'headline' | 'label' | 'product'; x?: number; y?: number }
  | { kind: 'path'; d: string; rect: Rect; evenOdd?: boolean }
  | { kind: 'grid'; rect: Rect; cols: number; rows: number }
  | { kind: 'points'; points: Point[] }
  | { kind: 'scatter'; rect: Rect; seed?: number };

/**
 * The particles hold `form` from `at`; a later key moves them there over `length` seconds (measured by default).
 * `size` is a particle's side in this form (% of frame height); a grid's particles fill most of their cell by
 * default, so a grid reads as units, never as a dotted pattern.
 */
export type ParticleKey = { at: number; form: ParticleTarget; length?: number; size?: number };

/** A grid cell's particle fills this share of the cell: a unit chart with thin gaps, not a field of specks. */
const CELL_FILL = 0.8;
/** Particles that share a place pack into a square tile at this pitch (a share of their side). */
const TILE_PITCH = 1.15;

// ---------------------------------------------------------------- sampling

/** Place along a Hilbert curve on a 256 x 256 grid: neighbours on the curve are neighbours in the frame. */
const hilbert = (x: number, y: number) => {
  let d = 0;
  for (let s = 128; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) [x, y] = [255 - x, 255 - y];
      [x, y] = [y, x];
    }
  }
  return d;
};

/** The points in the order of a Hilbert curve over their own bounds. Two sets in this order pair up by place. */
const byPlace = (pts: Point[]) => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0, 1);
  const key = (p: Point) => hilbert(Math.min(255, Math.floor(((p.x - x0) / span) * 255)), Math.min(255, Math.floor(((p.y - y0) / span) * 255)));
  return pts.map((p) => ({ p, k: key(p) })).sort((a, b) => a.k - b.k).map((e) => e.p);
};

/** `count` points spread evenly over the filled pixels of a canvas drawing. */
const fromCanvas = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, count: number, origin: Point): Point[] => {
  if (typeof document === 'undefined') throw new Error('Text and path forms are sampled in the browser: render them, do not plan with them.');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  draw(ctx);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const step = 2;
  const filled: Point[] = [];
  for (let y = 0; y < canvas.height; y += step) for (let x = 0; x < canvas.width; x += step) if (data[(y * canvas.width + x) * 4 + 3] > 128) filled.push({ x: origin.x + x, y: origin.y + y });
  if (!filled.length) return [];
  const ordered = byPlace(filled);
  return Array.from({ length: count }, (_, i) => ordered[Math.floor(((i + 0.5) / count) * ordered.length)]);
};

// ---------------------------------------------------------------- the move

/**
 * `count` square particles through `forms`. The first key is the form they arrive in (each fades up after its own
 * small delay); each later key moves them into its form, a dissolve into scatter in about 0.7 s and any other
 * re-form in about 0.9 s unless `length` says. `means` names what the forms show ("orders by city, then the
 * total"): a form that means nothing is decoration, and the move refuses it, as it refuses forms that are all
 * scatter. `size` is a particle's side as a percentage of frame height (a key may set its own); `fill` a stage colour by role. `out` fades
 * them away. Particles pair with the nearest place in the next form, so the move reads as a gathering, not a swarm.
 */
export const ParticleForm: FC<{
  forms: [ParticleKey, ...ParticleKey[]];
  means: string;
  count: number;
  seed?: number;
  size?: number;
  fill?: FillRole;
  out?: number;
  style?: CSSProperties;
}> = ({ forms, means, count, seed = 7, size = 0.7, fill = 'accent', out, style }) => {
  if (!means.trim()) throw new Error('ParticleForm: say what the forms mean (means). Particles as decoration are not allowed.');
  if (forms.every((f) => f.form.kind === 'scatter')) throw new Error('ParticleForm: every form is scatter. Particles must form something: text, a path, a grid or data.');
  if (count < 1 || count > MOST) throw new Error(`ParticleForm: count must be 1 to ${MOST}.`);
  const m = useMotion();
  const brand = useBrand();
  const loaded = useFontsLoaded();
  const stage = useStage();
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const scale = m.preset.length;

  const key = JSON.stringify({ forms, count, seed, size, width, height });
  /** A particle's side in each form, % of frame height. */
  const sizeOf = (i: number) => {
    const f = forms[i];
    if (f.size !== undefined) return f.size;
    if (f.form.kind !== 'grid') return size;
    const pitch = Math.min(f.form.rect.width / f.form.cols, f.form.rect.height / f.form.rows);
    return ((pitch * CELL_FILL) / height) * 100;
  };
  const places = useMemo(() => {
    const sample = (form: ParticleTarget, i: number): Point[] => {
      switch (form.kind) {
        case 'text': {
          if (!loaded) return [];
          const voice = brand.fonts[form.voice ?? 'headline'];
          const px = (height * form.size) / 100;
          const font = `${voice.style} ${voice.weight} ${px}px ${voice.css}`;
          const probe = document.createElement('canvas').getContext('2d');
          if (!probe) return [];
          probe.font = font;
          const w = probe.measureText(form.text).width + px * 0.2;
          const h = px * 1.4;
          const cx = form.x ?? width / 2;
          const cy = form.y ?? height / 2;
          return fromCanvas(w, h, (ctx) => {
            ctx.font = font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(form.text, w / 2, h / 2);
          }, count, { x: cx - w / 2, y: cy - h / 2 });
        }
        case 'path': {
          const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', form.d);
          el.appendChild(path);
          document.body.appendChild(el);
          const box = path.getBBox();
          el.remove();
          const s = Math.min(form.rect.width / (box.width || 1), form.rect.height / (box.height || 1));
          const [w, h] = [box.width * s, box.height * s];
          return fromCanvas(w, h, (ctx) => {
            ctx.setTransform(s, 0, 0, s, -box.x * s, -box.y * s);
            ctx.fill(new Path2D(form.d), form.evenOdd ? 'evenodd' : 'nonzero');
          }, count, { x: form.rect.x + (form.rect.width - w) / 2, y: form.rect.y + (form.rect.height - h) / 2 });
        }
        case 'grid': {
          const cells = form.cols * form.rows;
          return Array.from({ length: count }, (_, n) => {
            const c = n % cells;
            return { x: form.rect.x + ((c % form.cols) + 0.5) * (form.rect.width / form.cols), y: form.rect.y + (Math.floor(c / form.cols) + 0.5) * (form.rect.height / form.rows) };
          });
        }
        case 'points': {
          // Particles on the same place pack into one square tile round it, so each place reads as a tile sized by
          // its share, not as a speck. Its particles fill the tile from the middle out.
          const side = (height * sizeOf(i)) / 100 * TILE_PITCH;
          const per = Math.ceil(count / form.points.length);
          const across = Math.ceil(Math.sqrt(per));
          return Array.from({ length: count }, (_, n) => {
            const p = form.points[n % form.points.length];
            const k = Math.floor(n / form.points.length);
            const [col, row] = [k % across, Math.floor(k / across)];
            return { x: p.x + (col - (across - 1) / 2) * side, y: p.y + (row - (across - 1) / 2) * side };
          });
        }
        case 'scatter': {
          const r = rng((form.seed ?? seed) * 7919 + i);
          return Array.from({ length: count }, () => ({ x: form.rect.x + r() * form.rect.width, y: form.rect.y + r() * form.rect.height }));
        }
      }
    };
    const sets = forms.map((f, i) => sample(f.form, i));
    if (sets.some((s) => s.length === 0)) return null;
    // Pair every particle with a near place in each form: every set in Hilbert order, matched by rank.
    const ordered = sets.map(byPlace);
    const r = rng(seed);
    const quirks = Array.from({ length: count }, () => ({ late: r() * LATEST, curl: (r() - 0.5) * 2 * CURL }));
    return { ordered, quirks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, loaded, brand]);

  if (!places || m.t < forms[0].at) return null;
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  if (exit >= 1) return null;
  const colour = stage[fill];
  // The key whose move is running or last ran.
  let k = 0;
  while (k + 1 < forms.length && m.t >= forms[k + 1].at) k++;
  const lengthOf = (i: number) => (forms[i].length ?? (forms[i].form.kind === 'scatter' ? DISSOLVE : REFORM)) * scale;

  const rects = places.quirks.map((q, n) => {
    let p: Point;
    let shown = 1;
    let side = vh(sizeOf(k));
    if (k === 0) {
      p = places.ordered[0][n];
      shown = progress(m.t, forms[0].at + q.late * m.seconds('base'), forms[0].at + q.late * m.seconds('base') + m.seconds('quick'));
    } else {
      const [a, b] = [places.ordered[k - 1][n], places.ordered[k][n]];
      const L = lengthOf(k);
      const start = forms[k].at + q.late * L;
      const u = progress(m.t, start, start + (1 - LATEST) * L, easing.travel);
      const curl = Math.sin(Math.PI * u) * q.curl;
      side = vh(lerp(sizeOf(k - 1), sizeOf(k), u));
      p = { x: lerp(a.x, b.x, u) - (b.y - a.y) * curl, y: lerp(a.y, b.y, u) + (b.x - a.x) * curl };
    }
    return <rect key={n} x={p.x - side / 2} y={p.y - side / 2} width={side} height={side} fill={colour} opacity={shown} />;
  });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: 1 - exit, ...style }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {rects}
      </svg>
    </AbsoluteFill>
  );
};
