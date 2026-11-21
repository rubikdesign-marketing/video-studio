// The other-sizes part of the motion library (CAPTURE-PLAN 7.7, phase 8): one composition per re-layout
// ("move-relayout-<name>", in the "capture-relayout" folder of Remotion Studio), each at its own film size (9:16,
// 1:1 or 4:5). Each plays a real take through CaptureShot, which re-lays the staging for the frame and follows the
// action with the camera of relayout.ts. "capture" names the take ("<job>/<id>", empty for the newest), "things"
// gives places for a take that tracked nothing, "options" (JSON) anything else a CaptureShot takes. The platforms'
// buttons and captions can be shown over a 9:16 preview ("safeAreas"): a preview aid only, never in a film.
import type { FC } from 'react';
import { AbsoluteFill, Composition, Folder, type CalculateMetadataFunction } from 'remotion';
import { z } from 'zod';
import { FPS } from '../../capture/CapturePreview';
import { loadCapture, useCapture, type LoadedCapture } from '../../capture/load';
import { BrandProvider, brandNames, defaultBrand } from '../../kit/brand';
import { clipTime } from '../../kit/CaptureClip';
import { withThings, type Emphasis } from '../../kit/capture/glue';
import { planJoin, splitAtClick, type JoinOptions, type JoinSource } from '../../kit/capture/joins';
import type { LookName, StagingName, TransitionName } from '../../kit/capture/looks';
import { planCapture } from '../../kit/capture/plan';
import { SIZES, type SizeName } from '../../kit/capture/relayout';
import { SafeAreaOverlay } from '../../kit/capture/safeareas';
import { CaptureShot, type CaptureShotProps, type CaptureSource } from '../../kit/capture/staging';
import { CaptureJoin } from '../../kit/capture/transitions';
import { MotionProvider, presetNames, type PresetName } from '../../kit/motion';
import { stageNames } from '../../kit/tokens';
import { Label, Stage } from '../../kit/ui';
import type { CaptureScene, SceneTiming } from './capture-scenes';
import { MoveCaption } from './parts';

const thingSchema = z.object({
  rect: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  from: z.number().optional(),
  to: z.number().optional(),
  scrolls: z.boolean().optional(),
});

export const relayoutMotionSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  page: z.enum(stageNames),
  /** "<job>/<id>"; empty means the newest capture. */
  capture: z.string(),
  /** Things with known places, for a take that tracked nothing (page pixels). */
  things: z.record(z.string(), thingSchema),
  /** JSON: anything else a CaptureShot takes ({"from": 4, "holds": [[2, 3]]}); for a join, {"join": {...}, "b": {...}}. */
  options: z.string(),
  /** Show where the platforms put their buttons and captions (9:16 previews only; never in a film). */
  safeAreas: z.enum(['none', 'all', 'instagram', 'tiktok', 'shorts']),
});
type Props = z.infer<typeof relayoutMotionSchema>;

type Entry = {
  name: string;
  title: string;
  size: SizeName;
  look: LookName;
  staging?: StagingName;
  preset: PresetName;
  /** The take joined to itself at its click, with this transition. */
  join?: TransitionName;
  /** A product animation on the thing clicked, from the pointer's arrival. */
  emphasis?: Emphasis['kind'];
  /** The same take shown again beside it (two people, montage). */
  twice?: boolean;
  safeAreas?: Props['safeAreas'];
};

export const relayoutEntries: Entry[] = [
  { name: 'vertical-follow', title: 'Re-layout: 9:16, social vertical, full bleed', size: '9:16', look: 'social-vertical', preset: 'hype' },
  { name: 'vertical-card', title: 'Re-layout: 9:16, product demo, card', size: '9:16', look: 'product-demo', preset: 'confident' },
  { name: 'vertical-browser', title: 'Re-layout: 9:16, tutorial, browser frame', size: '9:16', look: 'tutorial', preset: 'calm' },
  { name: 'vertical-phone-frame', title: 'Re-layout: 9:16, wide take in a phone frame', size: '9:16', look: 'product-demo', staging: 'phone', preset: 'confident' },
  { name: 'vertical-calm', title: 'Re-layout: 9:16, calm explainer', size: '9:16', look: 'calm-explainer', preset: 'calm' },
  { name: 'vertical-launch', title: 'Re-layout: 9:16, launch', size: '9:16', look: 'launch', preset: 'hype' },
  { name: 'vertical-documentary', title: 'Re-layout: 9:16, documentary', size: '9:16', look: 'documentary', preset: 'confident' },
  { name: 'vertical-montage', title: 'Re-layout: 9:16, feature montage', size: '9:16', look: 'feature-montage', preset: 'hype' },
  { name: 'vertical-two-people', title: 'Re-layout: 9:16, two people', size: '9:16', look: 'two-people', preset: 'confident', twice: true },
  { name: 'vertical-emphasis', title: 'Re-layout: 9:16 with an outline on the product', size: '9:16', look: 'social-vertical', preset: 'hype', emphasis: 'outline' },
  { name: 'vertical-join', title: 'Re-layout: 9:16 join, zoom through', size: '9:16', look: 'social-vertical', preset: 'hype', join: 'zoom-through' },
  { name: 'vertical-safe-areas', title: 'Re-layout: 9:16 with the platforms shown', size: '9:16', look: 'social-vertical', preset: 'hype', safeAreas: 'all' },
  { name: 'square', title: 'Re-layout: 1:1, product demo', size: '1:1', look: 'product-demo', preset: 'confident' },
  { name: 'portrait', title: 'Re-layout: 4:5, product demo', size: '4:5', look: 'product-demo', preset: 'confident' },
  { name: 'phone-take', title: 'Re-layout: phone-size take, full frame', size: '9:16', look: 'social-vertical', preset: 'hype' },
  { name: 'phone-take-framed', title: 'Re-layout: phone-size take in a phone frame', size: '9:16', look: 'product-demo', staging: 'phone', preset: 'confident' },
];

const EMPTY_FRAMES = 3 * FPS;

type Extra = Partial<CaptureShotProps> & { join?: JoinOptions; b?: Partial<JoinSource> };
const extraOf = (props: Props): Extra => {
  try {
    return props.options.trim() ? (JSON.parse(props.options) as Extra) : {};
  } catch {
    throw new Error(`The preview's "options" are not valid JSON: ${props.options}`);
  }
};

/** The shot an entry shows: the take with the entry's look, its emphasis on the clicked thing, and any extra settings. */
const sourceOf = (entry: Entry, loaded: LoadedCapture, props: Props): CaptureSource & { staging?: StagingName; others?: CaptureSource[] } => {
  const { join: _join, b: _b, ...extra } = extraOf(props);
  const base: CaptureSource = { src: loaded.src, cursor: loaded.cursor, tracks: loaded.tracks, look: entry.look, things: Object.keys(props.things).length ? props.things : undefined };
  const source: CaptureSource = { ...base, ...extra };
  if (entry.emphasis) {
    const tracks = withThings(source.cursor, source.tracks, source.things);
    const plan = planCapture(source.cursor, tracks, { from: source.from, to: source.to, look: source.look, time: clipTime(source), energy: entry.preset });
    const click = plan.pointer.clicks.find((c) => c.t >= plan.from && c.t <= plan.to);
    const thing = click && tracks ? Object.entries(tracks.frames[Math.round(click.t * tracks.fps)]?.at ?? {}).find(([, r]) => r && click.x >= r[0] && click.x <= r[0] + r[2] && click.y >= r[1] && click.y <= r[1] + r[3])?.[0] : undefined;
    if (click) source.emphasis = [{ kind: entry.emphasis, target: thing ?? { x: click.x, y: click.y, size: 40 }, at: plan.map.filmAt(click.arrive), out: plan.map.filmAt(click.up) + 1.6 }];
  }
  return { ...source, staging: entry.staging, others: entry.twice ? [base] : undefined };
};

const shotsOf = (entry: Entry, loaded: LoadedCapture, props: Props) => {
  const extra = extraOf(props);
  const source = sourceOf(entry, loaded, props);
  const split = splitAtClick(source);
  if (!split) return null;
  const b: JoinSource = { ...split.b, ...extra.b };
  return { a: split.a, b, options: { ...extra.join, transition: entry.join } as JoinOptions };
};

const metadataFor =
  (entry: Entry): CalculateMetadataFunction<Props> =>
  async ({ props }) => {
    const loaded = await loadCapture(props.capture).catch(() => null);
    if (!loaded) return { durationInFrames: EMPTY_FRAMES, props };
    const [width, height] = SIZES[entry.size];
    if (entry.join) {
      const shots = shotsOf(entry, loaded, props);
      if (!shots) return { durationInFrames: EMPTY_FRAMES, props };
      const plan = planJoin(shots.a, shots.b, shots.options, props.preset, { width, height, fps: FPS });
      return { durationInFrames: Math.max(1, Math.floor(plan.total * FPS)), props: { ...props, capture: loaded.name } };
    }
    const source = sourceOf(entry, loaded, props);
    // The time map alone sets the length; the camera (and so the frame's shape) does not change it.
    const plan = planCapture(source.cursor, withThings(source.cursor, source.tracks, source.things), { from: source.from, to: source.to, look: source.look, time: clipTime(source), energy: props.preset });
    return { durationInFrames: Math.max(1, Math.floor(plan.map.duration * FPS)), props: { ...props, capture: loaded.name } };
  };

const showFor = (entry: Entry) => {
  const Show: FC<Props> = (props) => {
    const loaded = useCapture(props.capture);
    let body = null;
    if (loaded && entry.join) {
      const shots = shotsOf(entry, loaded, props);
      body = shots ? <CaptureJoin a={shots.a} b={shots.b} {...shots.options} /> : null;
    } else if (loaded) {
      const { staging, others, ...source } = sourceOf(entry, loaded, props);
      body = <CaptureShot {...source} staging={staging} others={others} />;
    }
    const overlay = props.safeAreas !== 'none' ? props.safeAreas : null;
    return (
      <BrandProvider brand={props.brand}>
        <MotionProvider preset={props.preset}>
          <Stage name={props.page}>
            {body ??
              (loaded === null ? (
                <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Label at={0}>No capture yet: record one with tools/capture/capture.mjs run</Label>
                </AbsoluteFill>
              ) : null)}
            {overlay ? <SafeAreaOverlay platform={overlay} /> : null}
            <MoveCaption>{entry.title}</MoveCaption>
          </Stage>
        </MotionProvider>
      </BrandProvider>
    );
  };
  return Show;
};

/**
 * The scene's defining moment: a join's own moment (t0), the emphasis on the clicked thing (from the pointer's
 * arrival), or for a plain re-layout the first click or tap the camera follows. And the length, as the gallery's
 * metadata works it out.
 */
const timingOf = (entry: Entry, loaded: LoadedCapture, props: Props, preset: PresetName): SceneTiming => {
  const [width, height] = SIZES[entry.size];
  if (entry.join) {
    const shots = shotsOf(entry, loaded, props);
    if (!shots) return { cue: null, seconds: null };
    const plan = planJoin(shots.a, shots.b, shots.options, preset, { width, height, fps: FPS });
    return { cue: plan.t0, seconds: plan.total };
  }
  const source = sourceOf(entry, loaded, props);
  const plan = planCapture(source.cursor, withThings(source.cursor, source.tracks, source.things), { from: source.from, to: source.to, look: source.look, time: clipTime(source), energy: preset });
  const click = plan.pointer.clicks.find((c) => c.t >= plan.from && c.t <= plan.to);
  return { cue: source.emphasis?.[0]?.at ?? (click ? plan.map.filmAt(click.t) : null), seconds: plan.map.duration };
};

const shows = relayoutEntries.map((entry) => ({ entry, Show: showFor(entry), metadata: metadataFor(entry) }));

/** The same scenes as records ("relayout-<name>"), for previews outside Remotion Studio. Each keeps its own film size. */
export const relayoutScenes: CaptureScene[] = shows.map(({ entry, Show }) => ({
  name: `relayout-${entry.name}`,
  Show: Show as CaptureScene['Show'],
  props: { things: {}, options: '', safeAreas: entry.safeAreas ?? 'none' },
  preset: entry.preset,
  size: SIZES[entry.size],
  fit: 'contain',
  timing: (loaded, props, preset) => timingOf(entry, loaded, props as Props, preset),
}));

/** The re-layout gallery, for MotionCompositions. */
export const RelayoutMotionCompositions: FC = () => (
  <Folder name="capture-relayout">
    {shows.map(({ entry, Show, metadata }) => (
      <Composition
        key={entry.name}
        id={`move-relayout-${entry.name}`}
        component={Show}
        schema={relayoutMotionSchema}
        width={SIZES[entry.size][0]}
        height={SIZES[entry.size][1]}
        fps={FPS}
        durationInFrames={EMPTY_FRAMES}
        calculateMetadata={metadata}
        defaultProps={{ brand: defaultBrand, preset: entry.preset, page: 'light', capture: '', things: {}, options: '', safeAreas: entry.safeAreas ?? 'none' }}
      />
    ))}
  </Folder>
);
