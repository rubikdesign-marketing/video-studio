// One scene for a picture and the marks on it: a staging (product.tsx), a re-layout (relayout.tsx) or a camera move
// (capture.tsx), with product animations (product.tsx) and click, hover and typing effects (capture.tsx) on the same
// take, at their own moments. Nothing new is drawn: the scene is the same CaptureShot the gallery scenes use, given
// the picture's settings and the marks' settings together. Used by the style library's previews
// (src/library/styles/StylePreview.tsx) for an entry that names such a pairing: it passes the pairing's members
// (rules.mjs composeMoves names the slot "stage-laptop+typing-caret-glow"); nothing here registers a composition.
//
// Who sets what: the mark sets the moment (the stretch of the take, and when it lands), the picture sets where the
// screen sits. A staging keeps the mark's own framing (the camera settles on the marked thing inside the staging); a
// re-layout keeps its own camera (it is made for its frame); a camera move keeps its camera, moved to land on the
// marked thing just before the mark (the camera scenes and the marks both put their moment 1.3 s into the stretch).
import { CaptureShot, type CaptureShotProps, type CaptureSource } from '../../kit/capture/staging';
import { clipFrames, FPS } from '../../capture/CapturePreview';
import { useCapture, type LoadedCapture } from '../../capture/load';
import { BrandProvider } from '../../kit/brand';
import type { CameraMove, Target } from '../../kit/capture/camera';
import { planOfClip } from '../../kit/capture/clipplan';
import { withThings, type Emphasis } from '../../kit/capture/glue';
import { SIZES } from '../../kit/capture/relayout';
import { MotionProvider, type PresetName } from '../../kit/motion';
import { Stage } from '../../kit/ui';
import { ACTIONS, captureEntries, type CaptureEntry } from './capture';
import type { CaptureScene, SceneTiming } from './capture-scenes';
import { CUE, productContext, productEntries, type ProductEntry } from './product';
import { relayoutEntries, type RelayoutEntry } from './relayout';

type Picture = { kind: 'stage'; entry: ProductEntry } | { kind: 'relayout'; entry: RelayoutEntry };
type Mark = { kind: 'product'; entry: ProductEntry } | { kind: 'effect'; entry: CaptureEntry };
type Parts = { name: string; picture?: Picture; camera?: CaptureEntry; marks: Mark[] };

const EFFECTS = /^(click|hover|typing)-/;

/** The members, found in the gallery lists; an Error names the first one that is not a picture, camera or mark. */
const partsOf = (members: string[]): Parts => {
  const name = members.join(' + ');
  const parts: Parts = { name, marks: [] };
  for (const m of members) {
    const product = productEntries.find((e) => e.name === m);
    const relayout = relayoutEntries.find((e) => `relayout-${e.name}` === m);
    const capture = captureEntries.find((e) => e.name === m);
    if (product?.staging && !parts.picture) parts.picture = { kind: 'stage', entry: product };
    else if (relayout && !parts.picture) parts.picture = { kind: 'relayout', entry: relayout };
    else if (capture && m.startsWith('camera-') && !parts.camera) parts.camera = capture;
    else if (product && !product.staging) parts.marks.push({ kind: 'product', entry: product });
    else if (capture && EFFECTS.test(m)) parts.marks.push({ kind: 'effect', entry: capture });
    else throw new Error(`${name}: ${m} is not a staging, re-layout, camera move or mark the motion library can compose`);
  }
  if (!parts.marks.length) throw new Error(`${name}: no mark to put on the take`);
  if (parts.picture?.kind === 'relayout' && parts.camera) throw new Error(`${name}: staging and mark cannot compose: a re-layout moves its own camera`);
  return parts;
};

/** A camera target on a click of the take becomes the marked thing. */
const onThing = (target: Target, thing: string): Target => (typeof target === 'object' && 'click' in target ? { thing } : target);
/** The camera move, landing on the marked thing at the mark's moment instead of on the stretch's click. */
const retarget = (move: CameraMove, thing: string | null, shift: number): CameraMove => {
  const out = { ...move, at: Math.max(0.2, move.at + shift) } as CameraMove & { to?: Target; from?: Target };
  if (thing && 'to' in move && move.to) out.to = onThing(move.to, thing);
  if (thing && 'from' in move && move.from) out.from = onThing(move.from, thing);
  return out;
};

type Built = { shot: CaptureShotProps; size: readonly [number, number]; fit: CaptureScene['fit'] };

/** The one shot: the picture's settings and every mark's, on this take. Throws when a mark finds nothing to mark. */
const build = (parts: Parts, loaded: LoadedCapture): Built => {
  const take: CaptureSource = { src: loaded.src, cursor: loaded.cursor, tracks: loaded.tracks };
  const ctx = productContext(loaded);
  let window: { from?: number; to?: number } = {};
  let camera: Partial<CaptureSource> = {};
  if (parts.camera) {
    const { from, to, ...rest } = parts.camera.make(loaded.cursor);
    window = { from, to };
    camera = rest;
  }
  const emphasis: Emphasis[] = [];
  let effects: Partial<CaptureSource> = {};
  let moment: { from: number } | null = null;
  for (const mark of parts.marks) {
    if (mark.kind === 'product') {
      const made = mark.entry.make(ctx);
      if (!made.emphasis?.length) throw new Error(`${parts.name}: staging and mark cannot compose: ${mark.entry.name} finds nothing to mark on this take`);
      const from = made.source?.from ?? 0;
      if (!moment) {
        moment = { from };
        window = { from: made.source?.from, to: made.source?.to };
        const first = made.emphasis[0];
        if (parts.camera) {
          // The camera's moment is 1.3 s into its stretch, as the mark's is (CUE): it keeps its distance to the mark.
          const thing = typeof first.target === 'string' ? first.target : null;
          camera = { ...camera, moves: camera.moves?.map((m) => retarget(m, thing, (first.at >= 0 ? first.at : CUE) - CUE)) };
        } else if (parts.picture?.kind !== 'relayout') {
          camera = { camera: made.source?.camera, moves: made.source?.moves };
        }
      }
      // A later mark's cues move to the first mark's stretch.
      emphasis.push(...made.emphasis.map((e) => (e.at >= 0 ? { ...e, at: e.at + from - moment!.from, out: e.out === undefined ? undefined : e.out + from - moment!.from } : e)));
    } else {
      const { from, to, camera: own, moves: _moves, time: _time, ...flags } = mark.entry.make(loaded.cursor);
      effects = { ...effects, ...flags, ...(own && !parts.camera && !moment ? { camera: own } : {}) };
      if (!moment && !parts.camera && window.from === undefined) window = { from, to };
    }
  }
  const source: CaptureSource = { ...take, ...window, ...camera, ...effects, emphasis: emphasis.length ? emphasis : undefined };
  if (parts.picture?.kind === 'relayout') {
    const entry = parts.picture.entry;
    return {
      shot: { ...source, look: entry.look, staging: entry.staging, others: entry.twice ? [take] : undefined },
      size: SIZES[entry.size],
      fit: 'contain',
    };
  }
  const staging = parts.picture?.entry.staging ?? 'card';
  // The extra take of a three-way split or a picture in picture plays the same stretch, unmarked, as the gallery's do.
  const others = staging === 'split-three' || staging === 'pip' ? [{ ...take, ...window }] : [];
  return { shot: { ...source, staging, others, align: 'marks' }, size: [1920, 1080], fit: 'fill' };
};

/** The moment the scene opens on: its first mark, camera move or (effects only) first action, on the clip's clock. */
const timingOf = (parts: Parts, loaded: LoadedCapture, preset: PresetName): SceneTiming => {
  const { shot } = build(parts, loaded);
  const tracks = withThings(shot.cursor, shot.tracks, shot.things);
  const plan = planOfClip(shot, tracks, preset);
  const ctx = productContext(loaded);
  const cues: number[] = [];
  for (const e of shot.emphasis ?? []) {
    if (e.at >= 0) cues.push(e.at);
    else if (typeof e.target === 'string') {
      const appears = ctx.appears(e.target);
      if (appears !== null) cues.push(plan.map.filmAt(appears));
    }
  }
  // A camera move named in the entry is a moment of its own; a staging's framing (the camera settling on the thing) is not.
  if (parts.camera && shot.moves?.length) cues.push(shot.moves[0].at);
  if (!cues.length) {
    const from = shot.from ?? 0;
    const to = shot.to ?? loaded.cursor.seconds;
    const first = loaded.cursor.events.find((e) => ACTIONS.has(e.type) && e.t >= from - 1e-6 && e.t <= to + 1e-6);
    if (first) cues.push(plan.map.filmAt(first.t));
  }
  return { cue: cues.length ? Math.min(...cues) : null, seconds: clipFrames(shot, preset) / FPS };
};

const showFor = (parts: Parts): CaptureScene['Show'] => {
  const Show: CaptureScene['Show'] = ({ brand, preset, page, capture }) => {
    const loaded = useCapture(capture);
    return (
      <BrandProvider brand={brand}>
        <MotionProvider preset={preset}>
          <Stage name={page}>{loaded ? <CaptureShot {...build(parts, loaded).shot} /> : null}</Stage>
        </MotionProvider>
      </BrandProvider>
    );
  };
  return Show;
};

const made = new Map<string, CaptureScene>();

/**
 * The scene for a picture and its marks, by their move names (["stage-split", "product-ring"]), made once. Throws
 * when a member is not a picture, camera or mark of the motion library, or the pairing cannot share one take.
 */
export const composedScene = (members: string[]): CaptureScene => {
  const name = members.join(' + ');
  const known = made.get(name);
  if (known) return known;
  const parts = partsOf(members);
  const size: readonly [number, number] = parts.picture?.kind === 'relayout' ? SIZES[parts.picture.entry.size] : [1920, 1080];
  const scene: CaptureScene = {
    name,
    Show: showFor(parts),
    props: {},
    preset: 'confident',
    size,
    fit: parts.picture?.kind === 'relayout' ? 'contain' : 'fill',
    timing: (loaded, _props, preset) => timingOf(parts, loaded, preset),
  };
  made.set(name, scene);
  return scene;
};

/** For checks: the shot a composed name gives on a take (the same one the scene draws). */
export const composedShot = (members: string[], loaded: LoadedCapture): Built => build(partsOf(members), loaded);
