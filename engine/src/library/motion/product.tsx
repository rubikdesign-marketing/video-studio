// The staging and product-animation part of the motion library (CAPTURE-PLAN 7.6, 7.4 and the 7.9 lists): one
// composition per staging ("move-stage-<name>") and per animation on the product ("move-product-<name>"), in the
// "capture-staging" and "capture-product" folders of Remotion Studio. Each plays a real capture: the newest, or the
// one named in "capture", and "second" for a staging that shows two takes. The things an animation is glued to are
// found by role (the main card, the thing clicked, the field typed in, the message that pops up...) from the take's
// tracks, or named in "roles"; a take that tracked nothing can be given "things" with their places (page pixels).
import { useEffect, useState, type FC } from 'react';
import { AbsoluteFill, cancelRender, Composition, continueRender, delayRender, Folder, type CalculateMetadataFunction } from 'remotion';
import { z } from 'zod';
import { clipFrames, FPS } from '../../capture/CapturePreview';
import { loadCapture, useCapture, type LoadedCapture } from '../../capture/load';
import { BrandProvider, brandNames, defaultBrand, useBrand } from '../../kit/brand';
import { typingTarget } from '../../kit/capture/camera';
import { clicksOf, rectAt, thingAt, union, type CaptureCursor, type CaptureTracks, type Rect } from '../../kit/capture/data';
import { withThings, type Emphasis } from '../../kit/capture/glue';
import type { StagingName } from '../../kit/capture/looks';
import { planPointer } from '../../kit/capture/pointer';
import { CaptureShot, type CaptureShotProps, type CaptureSource } from '../../kit/capture/staging';
import { MotionProvider, presetNames, type PresetName } from '../../kit/motion';
import { alpha, stageNames } from '../../kit/tokens';
import { Label, Stage, useStage, useVh } from '../../kit/ui';
import type { CaptureScene } from './capture-scenes';
import { MoveCaption, useMoveCaptions } from './parts';

const thingSchema = z.object({
  rect: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  from: z.number().optional(),
  to: z.number().optional(),
  scrolls: z.boolean().optional(),
});

export const productMotionSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  page: z.enum(stageNames),
  /** "<job>/<id>"; empty means the newest capture. */
  capture: z.string(),
  /** A second take for split, picture in picture, before and after and the grid ("<job>/<id>"); empty: none. */
  second: z.string(),
  /** Things with known places, for a take that tracked nothing. */
  things: z.record(z.string(), thingSchema),
  /** Which tracked thing plays which part: main, second, link, field, toast, list, detail, text, button. */
  roles: z.record(z.string(), z.string()),
  /** The address in a browser frame (from the take's capture.json). */
  address: z.string(),
});
type Props = z.infer<typeof productMotionSchema>;

type Role = 'main' | 'second' | 'link' | 'field' | 'toast' | 'list' | 'detail' | 'text' | 'button';

type Ctx = {
  cursor: CaptureCursor;
  tracks: CaptureTracks | undefined;
  role: (r: Role) => string | null;
  /** The first recording time a thing is on the page. */
  appears: (name: string) => number | null;
};

type Made = { source?: Partial<CaptureSource>; shot?: Partial<CaptureShotProps>; emphasis?: Emphasis[] };
type Entry = { name: string; title: string; preset?: PresetName; staging?: StagingName; two?: boolean; make: (ctx: Ctx) => Made };

// ---------------------------------------------------------------- finding the things

const area = (b: [number, number, number, number] | null | undefined) => (b ? b[2] * b[3] : 0);

const contextOf = (loaded: LoadedCapture, props: Props): Ctx => {
  const { cursor } = loaded;
  const tracks = withThings(cursor, loaded.tracks, props.things);
  const names = [...Object.keys(props.things), ...Object.keys(tracks?.things ?? {}).filter((n) => !(n in props.things))];
  const appears = (name: string) => tracks?.frames.find((r) => r.at[name])?.t ?? null;
  const largest = (pick: (a: number, b: number) => boolean) => {
    let best: string | null = null;
    let size = 0;
    for (const n of names) {
      const t = appears(n);
      const s = t === null ? 0 : area(tracks?.frames[Math.round(t * (tracks?.fps ?? 60))]?.at[n]);
      if (s && (best === null || pick(s, size))) [best, size] = [n, s];
    }
    return best;
  };
  const firstClick = clicksOf(cursor)[0];
  const typing = cursor.events.find((e) => e.type === 'type');
  const pointer = planPointer(cursor, 0, {});
  const guess: Record<Role, () => string | null> = {
    main: () => names[0] ?? null,
    second: () => names[1] ?? names[0] ?? null,
    link: () => (firstClick ? thingAt(tracks, { x: firstClick.x!, y: firstClick.y! }, firstClick.t)?.name ?? null : null),
    field: () => (typing ? typingTarget(cursor, tracks, pointer.clicks, typing) ?? null : null),
    toast: () => names.find((n) => (appears(n) ?? 0) > 0.6 + (tracks?.frames.find((r) => Object.values(r.at).some(Boolean))?.t ?? 0)) ?? null,
    list: () => largest((a, b) => a > b),
    detail: () => largest((a, b) => a < b),
    text: () => names[0] ?? null,
    button: () => null,
  };
  const role = (r: Role): string | null => props.roles[r] ?? guess[r]() ?? (r === 'button' ? role('link') : null);
  return { cursor, tracks, role, appears };
};

/** A stretch of about six seconds that starts just before a thing appears, so it is on screen from the first second. */
const around = (ctx: Ctx, name: string | null, length = 6) => {
  const t = name ? ctx.appears(name) ?? 0 : 0;
  const from = Math.max(0.6, t - 0.6);
  return { from, to: Math.min(ctx.cursor.seconds, from + length) };
};

const CUE = 1.3;
const OUT = 4.2;

/**
 * The camera frames the things before the animation starts (a still shot, so the push in is not a second emphasis
 * during the animation's beat): it settles on them from 0.2 s and holds.
 */
const framing = (ctx: Ctx, names: string[], at: number): Partial<CaptureSource> => {
  let box: Rect | null = null;
  for (const n of names) {
    const t = ctx.appears(n);
    const r = t === null ? null : rectAt(ctx.tracks, n, t + 0.05);
    if (r) box = box ? union(box, r) : r;
  }
  if (!box) return { camera: { auto: false } };
  // As close as leaves a fifth of the view round the things, never past 1.8 (the recording's sharpness is 2).
  const page = ctx.cursor.page;
  const zoom = Math.max(1, Math.min(1.8, page.width / (box.width * 1.4), page.height / (box.height * 1.6)));
  return { camera: { auto: false }, moves: [{ move: 'key', to: box, at, over: 'scene', zoom }] };
};

const one = (kind: Emphasis['kind'], r: Role, more: Partial<Emphasis> = {}) => (ctx: Ctx): Made => {
  const target = ctx.role(r);
  if (!target) return {};
  const window = around(ctx, target);
  const visible = Math.max(0, (ctx.appears(target) ?? 0) - window.from);
  return { source: { ...window, ...framing(ctx, [target], visible + 0.1) }, emphasis: [{ kind, target, at: Math.max(CUE, visible + 0.9), out: Math.max(OUT, visible + 3.8), ...more }] };
};

// ---------------------------------------------------------------- the entries

const stage = (name: StagingName, title: string, more: Partial<Entry> = {}): Entry => ({ name: `stage-${name}`, title, staging: name, make: () => ({}), ...more });

export const productEntries: Entry[] = [
  // Staging
  stage('card', 'Staging: flat card'),
  stage('browser', 'Staging: browser frame'),
  stage('browser-dark', 'Staging: browser frame, dark'),
  stage('frameless', 'Staging: full screen'),
  stage('float', 'Staging: floating screen', { preset: 'hype' }),
  stage('isometric', 'Staging: isometric'),
  stage('laptop', 'Staging: laptop'),
  stage('monitor', 'Staging: desktop monitor'),
  stage('tablet', 'Staging: tablet'),
  stage('phone', 'Staging: phone'),
  stage('phone-crop', 'Staging: tall crop of the action'),
  stage('stacked', 'Staging: stacked windows'),
  stage('split', 'Staging: two takes side by side', { two: true }),
  stage('split-three', 'Staging: three takes side by side', { two: true }),
  stage('pip', 'Staging: picture in picture', { two: true }),
  stage('grid', 'Staging: grid of screens', { preset: 'hype' }),
  stage('wall', 'Staging: wall of screens', { two: true }),
  stage('before-after', 'Staging: before and after', { two: true }),
  stage('email', 'Staging: mail window'),
  stage('terminal', 'Staging: terminal window'),
  // Animations on the product
  { name: 'product-lift', title: 'Product: lift', make: one('lift', 'main') },
  { name: 'product-isolate', title: 'Product: isolate', make: one('isolate', 'main') },
  { name: 'product-fly-out', title: 'Product: fly out', make: one('fly-out', 'main') },
  { name: 'product-focus', title: 'Product: focus pull', make: one('focus', 'main') },
  { name: 'product-outline', title: 'Product: outline trace', make: one('outline', 'second') },
  { name: 'product-underline', title: 'Product: underline', make: one('underline', 'text') },
  { name: 'product-ring', title: 'Product: ring', make: one('ring', 'detail') },
  { name: 'product-sweep', title: 'Product: highlight sweep', make: one('sweep', 'main') },
  { name: 'product-magnifier', title: 'Product: magnifier', make: one('magnifier', 'detail') },
  { name: 'product-callout', title: 'Product: callout', make: one('callout', 'second', { label: 'Each one on its own card', side: 'below' }) },
  {
    name: 'product-arrow',
    title: 'Product: arrow',
    make: (ctx) => {
      const [from, to] = [ctx.role('button'), ctx.role('second')];
      if (!from || !to || from === to) return {};
      const window = around(ctx, to);
      const visible = Math.max(0, (ctx.appears(to) ?? 0) - window.from);
      return { source: { ...window, ...framing(ctx, [from, to], visible + 0.1) }, emphasis: [{ kind: 'arrow', target: from, to, at: Math.max(CUE, visible + 0.9), out: OUT + 0.6 }] };
    },
  },
  {
    name: 'product-connect',
    title: 'Product: connection line',
    make: (ctx) => {
      const [from, to] = [ctx.role('field'), ctx.role('list')];
      if (!from || !to) return {};
      return { source: { ...around(ctx, ctx.role('toast') ?? to, 6), ...framing(ctx, [from, to], 0.2) }, emphasis: [{ kind: 'connect', target: from, to, at: CUE, out: OUT + 0.8 }] };
    },
  },
  {
    name: 'product-steps',
    title: 'Product: step badges',
    make: (ctx) => {
      const list = [ctx.role('link'), ctx.role('main'), ctx.role('second')].filter((n, i, a): n is string => !!n && a.indexOf(n) === i);
      if (!list.length) return {};
      const window = around(ctx, list[list.length - 1]);
      const visible = Math.max(0, (ctx.appears(list[list.length - 1]) ?? 0) - window.from);
      return { source: { ...window, ...framing(ctx, list, visible + 0.1) }, emphasis: list.map((target, i) => ({ kind: 'steps' as const, target, at: Math.max(CUE, visible + 0.9) + i * 0.7, number: i + 1 })) };
    },
  },
  {
    name: 'product-retype',
    title: 'Product: typed again',
    make: (ctx) => {
      const field = ctx.role('field');
      const typing = ctx.cursor.events.find((e) => e.type === 'type');
      if (!field || !typing) return {};
      const from = (typing.end ?? typing.t) + 0.3;
      return { source: { from, to: Math.min(ctx.cursor.seconds, from + 4.2), ...framing(ctx, [field], 0.1) }, emphasis: [{ kind: 'retype', target: field, at: 1.1, speed: 1.4 }] };
    },
  },
  {
    name: 'product-toast',
    title: 'Product: toast pop',
    make: (ctx) => {
      const toast = ctx.role('toast');
      const at = toast ? ctx.appears(toast) : null;
      if (!toast || at === null) return {};
      const field = ctx.role('field');
      return { source: { from: Math.max(0.6, at - 1.4), to: Math.min(ctx.cursor.seconds, at + 2.6), ...framing(ctx, field ? [toast, field] : [toast], 0.1) }, emphasis: [{ kind: 'toast', target: toast, at: -1 }] };
    },
  },
  { name: 'product-success', title: 'Product: success moment', preset: 'hype', make: one('success', 'main') },
  { name: 'product-blur-reveal', title: 'Product: blur reveal', make: one('blur-reveal', 'main') },
  {
    name: 'product-privacy',
    title: 'Product: privacy blur that follows',
    make: (ctx) => {
      const list = ctx.role('list');
      if (!list) return {};
      const scroll = ctx.cursor.events.find((e) => e.type === 'scroll');
      const from = scroll ? Math.max(0.6, scroll.t - 1) : around(ctx, list).from;
      return { source: { from, to: Math.min(ctx.cursor.seconds, from + 4.5), camera: { auto: false } }, emphasis: [{ kind: 'privacy', target: list, at: 0 }] };
    },
  },
];

// ---------------------------------------------------------------- compositions

const EMPTY_FRAMES = 3 * FPS;

const sourceOf = (loaded: LoadedCapture, props: Props): CaptureSource => ({ src: loaded.src, cursor: loaded.cursor, tracks: loaded.tracks, things: props.things });

const shotOf = (entry: Entry, loaded: LoadedCapture, second: LoadedCapture | null, props: Props): CaptureShotProps => {
  const made = entry.make(contextOf(loaded, props));
  const base = sourceOf(loaded, props);
  const others: CaptureSource[] = [];
  if (entry.two && second) {
    others.push({ src: second.src, cursor: second.cursor, tracks: second.tracks });
    if (entry.staging === 'split-three') others.push({ ...base });
  }
  return {
    ...base,
    ...made.source,
    emphasis: made.emphasis,
    staging: entry.staging ?? 'card',
    others,
    align: 'marks',
    address: props.address || null,
    ...(entry.staging === 'pip' ? { others: [second ? { src: second.src, cursor: second.cursor, tracks: second.tracks } : base] } : {}),
    ...made.shot,
  };
};

const metadataFor =
  (entry: Entry): CalculateMetadataFunction<Props> =>
  async ({ props }) => {
    const loaded = await loadCapture(props.capture).catch(() => null);
    if (!loaded) return { durationInFrames: EMPTY_FRAMES, props };
    const shot = shotOf(entry, loaded, null, props);
    return { durationInFrames: clipFrames(shot, props.preset), props: { ...props, capture: loaded.name } };
  };

/** A second take when one is named; null straight away when none is. */
const useSecond = (name: string) => {
  const [state, setState] = useState<LoadedCapture | null | undefined>(name ? undefined : null);
  const [handle] = useState(() => (name ? delayRender('Loading the second take') : null));
  useEffect(() => {
    if (!name || handle === null) return;
    loadCapture(name)
      .then((loaded) => {
        setState(loaded);
        continueRender(handle);
      })
      .catch((error: unknown) => cancelRender(error));
  }, [name, handle]);
  return state;
};

const showFor = (entry: Entry) => {
  const Show: FC<Props> = (props) => {
    const loaded = useCapture(props.capture);
    const second = useSecond(entry.two ? props.second : '');
    const ready = loaded && second !== undefined;
    return (
      <BrandProvider brand={props.brand}>
        <MotionProvider preset={props.preset}>
          <Stage name={props.page}>
            {loaded && ready ? (
              <CaptureShot {...shotOf(entry, loaded, second ?? null, props)} />
            ) : loaded === null ? (
              <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Label at={0}>No capture yet: record one with tools/capture/capture.mjs run</Label>
              </AbsoluteFill>
            ) : null}
            {entry.staging === 'frameless' || entry.staging === 'wall' ? <BackedCaption>{entry.title}</BackedCaption> : <MoveCaption>{entry.title}</MoveCaption>}
          </Stage>
        </MotionProvider>
      </BrandProvider>
    );
  };
  return Show;
};

/** The name of the move on a soft backing, for the stagings that fill the frame. */
const BackedCaption: FC<{ children: string }> = ({ children }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  if (!useMoveCaptions()) return null;
  return (
    <div style={{ position: 'absolute', left: vh(4.6), bottom: vh(4.6), padding: `${vh(0.8)}px ${vh(1.4)}px`, borderRadius: vh(brand.shape.pill), background: alpha(stage.page, 0.94), boxShadow: `0 ${vh(0.4)}px ${vh(1.6)}px ${alpha(stage.shade, 0.2)}` }}>
      <Label size={2.6}>{children}</Label>
    </div>
  );
};

const shows = productEntries.map((entry) => ({ entry, Show: showFor(entry), metadata: metadataFor(entry) }));

/** The same scenes as records, for previews outside Remotion Studio. */
export const productScenes: CaptureScene[] = shows.map(({ entry, Show }) => ({
  name: entry.name,
  Show: Show as CaptureScene['Show'],
  props: { second: '', things: {}, roles: {}, address: '' },
  preset: entry.preset ?? 'confident',
  size: [1920, 1080],
  fit: 'fill',
}));

const defaults = (entry: Entry): Props => ({ brand: defaultBrand, preset: entry.preset ?? 'confident', page: 'light', capture: '', second: '', things: {}, roles: {}, address: '' });

/** The staging and product-animation gallery, for MotionCompositions. */
export const ProductMotionCompositions: FC = () => (
  <>
    {(['capture-staging', 'capture-product'] as const).map((folder) => (
      <Folder key={folder} name={folder}>
        {shows
          .filter(({ entry }) => (folder === 'capture-staging') === Boolean(entry.staging))
          .map(({ entry, Show, metadata }) => (
            <Composition
              key={entry.name}
              id={`move-${entry.name}`}
              component={Show}
              schema={productMotionSchema}
              width={1920}
              height={1080}
              fps={FPS}
              durationInFrames={EMPTY_FRAMES}
              calculateMetadata={metadata}
              defaultProps={defaults(entry)}
            />
          ))}
      </Folder>
    ))}
  </>
);

