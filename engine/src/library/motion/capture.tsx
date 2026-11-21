// The capture part of the motion library: one composition per pointer style, click and hover effect, camera move,
// time effect and look preset ("move-<name>", in the "capture" folder of Remotion Studio). Each plays a short,
// fitting stretch of a real capture (the newest one, or the one named in "capture"), found from its own events,
// so the previews work on any brand's capture. The catalogue entries are in library/motion/index.json.
import type { FC } from 'react';
import { AbsoluteFill, Composition, Folder, type CalculateMetadataFunction } from 'remotion';
import { z } from 'zod';
import { clipFrames, FPS } from '../../capture/CapturePreview';
import { loadCapture, useCapture, type LoadedCapture } from '../../capture/load';
import { BrandProvider, brandNames, defaultBrand } from '../../kit/brand';
import { CaptureClip, type CaptureClipProps } from '../../kit/CaptureClip';
import { planOfClip } from '../../kit/capture/clipplan';
import { withThings } from '../../kit/capture/glue';
import { CaptureShot } from '../../kit/capture/staging';
import type { CaptureCursor, CaptureEvent } from '../../kit/capture/data';
import { MotionProvider, presetNames, type PresetName } from '../../kit/motion';
import { stageNames } from '../../kit/tokens';
import { Label, Stage } from '../../kit/ui';
import type { CaptureScene, SceneTiming } from './capture-scenes';
import { MoveCaption } from './parts';

export const captureMotionSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  page: z.enum(stageNames),
  /** "<job>/<id>"; empty means the newest capture. */
  capture: z.string(),
  /** Look previews: a second take, for the looks that show two (two people); empty for none. */
  second: z.string().optional(),
});
type Props = z.infer<typeof captureMotionSchema>;

const WIDTH = 1500;

type Setting = Omit<CaptureClipProps, 'src' | 'cursor' | 'tracks' | 'width'>;

/** A stretch of the capture that shows the item, found from its events, and the clip settings. */
type Entry = { name: string; title: string; preset?: PresetName; make: (cursor: CaptureCursor) => Setting };

// ---------------------------------------------------------------- stretches of a capture

const clicks = (c: CaptureCursor) => c.events.filter((e) => e.type === 'click');
const first = (c: CaptureCursor, type: string, test: (e: CaptureEvent) => boolean = () => true) => c.events.find((e) => e.type === type && test(e));
const clamp = (c: CaptureCursor, from: number, to: number) => ({ from: Math.max(0, from), to: Math.min(c.seconds, to) });

/** Two clicks and the start of typing: the pointer travelling, arriving and clicking. */
const aroundClicks = (c: CaptureCursor) => {
  const [a] = clicks(c);
  return clamp(c, (a?.t ?? 1) - 1.3, (a?.t ?? 1) + 3.4);
};
/** The first typing, from the click into the field. */
const aroundTyping = (c: CaptureCursor) => {
  const e = first(c, 'type');
  return e ? clamp(c, e.t - 1.2, Math.min(e.end ?? e.t, e.t + 2.4) + 0.8) : aroundClicks(c);
};
const aroundShortcut = (c: CaptureCursor) => {
  const e = first(c, 'press', (x) => Boolean(x.shortcut));
  return e ? clamp(c, e.t - 1, e.t + 2.6) : aroundClicks(c);
};
/** A wait the engine may speed up, after the first click when there is one: the opening load is trimmed off by default. */
const firstWait = (c: CaptureCursor) => {
  const click = clicks(c)[0];
  return first(c, 'wait', (x) => Boolean(x.speed_up) && (!click || x.t > click.t)) ?? first(c, 'wait', (x) => Boolean(x.speed_up));
};
const aroundWait = (c: CaptureCursor) => {
  const e = firstWait(c);
  return e ? clamp(c, e.t - 1.6, (e.end ?? e.t) + 1.2) : aroundClicks(c);
};
const aroundDrag = (c: CaptureCursor) => {
  const e = first(c, 'drag');
  return e ? clamp(c, e.t - 1.2, (e.end ?? e.t) + 1) : aroundClicks(c);
};
/** A short story: the first four clicks, with what happens between them. */
const story = (c: CaptureCursor) => {
  const list = clicks(c);
  const last = list[Math.min(3, list.length - 1)];
  return clamp(c, (list[0]?.t ?? 1) - 1.3, (last?.up ?? last?.t ?? c.seconds) + 1.3);
};
const nthClick = (c: CaptureCursor, from: number) => clicks(c).findIndex((e) => e.t > from) + 1;

// ---------------------------------------------------------------- the entries

const pointerEntry = (name: string, title: string, style: Setting['cursorStyle'], more: Setting = {}): Entry => ({
  name: `cursor-${name}`,
  title,
  make: (c) => ({ ...aroundClicks(c), cursorStyle: style, ...more }),
});

export const captureEntries: Entry[] = [
  // Pointer styles
  pointerEntry('classic', 'Pointer: classic arrow', 'classic'),
  pointerEntry('brand', 'Pointer: brand arrow', 'brand'),
  pointerEntry('dot', 'Pointer: minimal dot', 'dot'),
  { name: 'cursor-halo', title: 'Pointer: halo', make: (c) => ({ ...aroundClicks(c), cursorStyle: 'halo' }) },
  pointerEntry('spotlight', 'Pointer: spotlight', 'spotlight', { camera: { auto: false } }),
  pointerEntry('presenter', 'Pointer: presenter', 'presenter'),
  pointerEntry('named', 'Pointer: named', 'named', { cursorName: 'Dani' }),
  { name: 'cursor-touch', title: 'Pointer: touch', make: (c) => ({ ...aroundDrag(c), cursorStyle: 'touch', click: 'ring' }) },
  pointerEntry('hidden', 'Pointer: hidden', 'hidden'),
  // Click, hover and typing effects
  { name: 'click-ring', title: 'Click: ring', make: (c) => ({ ...aroundClicks(c), click: 'ring' }) },
  { name: 'click-pulse', title: 'Click: pulse fill', make: (c) => ({ ...aroundClicks(c), click: 'pulse' }) },
  { name: 'click-burst', title: 'Click: line burst', preset: 'hype', make: (c) => ({ ...aroundClicks(c), click: 'burst' }) },
  { name: 'click-squish', title: 'Click: squish', make: (c) => ({ ...aroundClicks(c), click: 'squish' }) },
  { name: 'hover-magnet', title: 'Hover: magnet', make: (c) => ({ ...aroundClicks(c), magnet: true, camera: { auto: false } }) },
  { name: 'hover-glow', title: 'Hover: soft glow', make: (c) => ({ ...story(c), glow: true }) },
  { name: 'typing-caret-glow', title: 'Typing: the field glows', make: (c) => ({ ...aroundTyping(c), caretGlow: true }) },
  { name: 'typing-key-caps', title: 'Typing: key caps', make: (c) => ({ ...aroundShortcut(c), keyCaps: 'shortcuts' }) },
  // Camera
  { name: 'camera-auto-zoom', title: 'Camera: auto-zoom', make: (c) => ({ ...story(c), camera: { auto: true, follow: false } }) },
  { name: 'camera-follow', title: 'Camera: follow', make: (c) => ({ ...story(c), camera: { auto: true, follow: true } }) },
  { name: 'camera-push-in', title: 'Camera: push in', make: (c) => ({ ...aroundClicks(c), camera: { auto: false }, moves: [{ move: 'push-in', to: { click: Math.max(1, nthClick(c, aroundClicks(c).from)) }, at: 0.4, over: 'hero' }] }) },
  { name: 'camera-pull-out', title: 'Camera: pull out', make: (c) => ({ ...aroundClicks(c), camera: { auto: false }, moves: [{ move: 'pull-out', from: { click: Math.max(1, nthClick(c, aroundClicks(c).from)) }, at: 2.2, over: 'hero' }] }) },
  { name: 'camera-snap-zoom', title: 'Camera: snap zoom', preset: 'hype', make: (c) => ({ ...aroundClicks(c), camera: { auto: false }, moves: [{ move: 'snap-zoom', to: { click: Math.max(1, nthClick(c, aroundClicks(c).from)) }, at: 0.9 }] }) },
  { name: 'camera-dolly-tilt', title: 'Camera: dolly and tilt', make: (c) => ({ ...aroundClicks(c), camera: { auto: false }, moves: [{ move: 'dolly-tilt', at: 0.3, over: 'hero', turn: 9 }] }) },
  { name: 'camera-float', title: 'Camera: float', make: (c) => ({ ...aroundClicks(c), camera: { auto: false, float: true } }) },
  { name: 'camera-crane-reveal', title: 'Camera: crane reveal', make: (c) => ({ ...aroundClicks(c), camera: { auto: false }, moves: [{ move: 'crane-reveal', from: { click: Math.max(1, nthClick(c, aroundClicks(c).from)) }, at: 0.8, over: 'hero' }] }) },
  { name: 'camera-orbit', title: 'Camera: orbit', make: (c) => ({ ...aroundClicks(c), camera: { auto: false, float: true }, moves: [{ move: 'orbit', at: 0.2, over: 'hero' }] }) },
  {
    name: 'camera-rack-focus',
    title: 'Camera: rack focus',
    make: (c) => {
      const n = Math.max(1, nthClick(c, aroundClicks(c).from));
      return { ...aroundClicks(c), camera: { auto: false }, moves: [{ move: 'rack-focus', from: { click: n }, to: { click: n + 1 }, at: 1.4 }] };
    },
  },
  {
    name: 'camera-pan-across',
    title: 'Camera: pan across',
    make: (c) => {
      const n = Math.max(1, nthClick(c, aroundClicks(c).from));
      return { ...aroundClicks(c), camera: { auto: false }, moves: [{ move: 'pan-across', from: { click: n }, to: { click: n + 1 }, at: 0.6, zoom: 1.6 }] };
    },
  },
  // Time
  { name: 'time-speed-ramp', title: 'Time: speed ramp', make: (c) => ({ ...aroundWait(c), time: { speedUp: { waits: true } } }) },
  {
    name: 'time-freeze',
    title: 'Time: freeze with a slow push',
    make: (c) => {
      const w = aroundClicks(c);
      const click = clicks(c).find((e) => e.t > w.from);
      return { ...w, time: { freezes: [{ at: (click?.up ?? w.from + 1) + 0.25, hold: 1.4 }] } };
    },
  },
  {
    name: 'time-jump',
    title: 'Time: clean jump',
    make: (c) => {
      const w = aroundWait(c);
      const e = firstWait(c);
      return { ...w, time: { speedUp: { waits: false }, jumps: e ? [{ from: e.t + 0.15, to: (e.end ?? e.t) - 0.15 }] : [] } };
    },
  },
  {
    name: 'time-rewind',
    title: 'Time: short rewind',
    make: (c) => {
      const w = aroundTyping(c);
      return { ...w, time: { speedUp: { typing: false }, rewinds: [{ at: w.to - 0.4, back: 1.6, speed: 2.5, then: 'resume' }] } };
    },
  },
  {
    name: 'time-pin',
    title: 'Time: pin a click to a moment',
    make: (c) => {
      const w = story(c);
      // The third click of the stretch lands a little earlier than it really happened: the pauses before it close up.
      const n = Math.max(1, nthClick(c, w.from));
      const click = clicks(c)[n + 1];
      return { ...w, time: { pins: [{ event: { click: n + 2 }, at: +(((click?.t ?? w.from + 4) - w.from) * 0.88).toFixed(2) }] } };
    },
  },
  { name: 'time-loop', title: 'Time: loopable end', make: (c) => ({ ...aroundClicks(c), time: { loop: true } }) },
  // Look presets
  { name: 'look-calm-explainer', title: 'Look: calm explainer', preset: 'calm', make: (c) => ({ ...story(c), look: 'calm-explainer' }) },
  { name: 'look-product-demo', title: 'Look: product demo', make: (c) => ({ ...story(c), look: 'product-demo' }) },
  { name: 'look-launch', title: 'Look: launch', preset: 'hype', make: (c) => ({ ...story(c), look: 'launch' }) },
  { name: 'look-tutorial', title: 'Look: tutorial', preset: 'calm', make: (c) => ({ ...story(c), look: 'tutorial' }) },
  { name: 'look-social-vertical', title: 'Look: social vertical', preset: 'hype', make: (c) => ({ ...story(c), look: 'social-vertical' }) },
  { name: 'look-feature-montage', title: 'Look: feature montage', preset: 'hype', make: (c) => ({ ...story(c), look: 'feature-montage' }) },
  { name: 'look-documentary', title: 'Look: documentary', make: (c) => ({ ...story(c), look: 'documentary' }) },
  { name: 'look-two-people', title: 'Look: two people', make: (c) => ({ ...story(c), look: 'two-people', cursorName: 'Dani' }) },
];

// ---------------------------------------------------------------- compositions

const clipOf = (entry: Entry, loaded: LoadedCapture) => ({ src: loaded.src, cursor: loaded.cursor, tracks: loaded.tracks, ...entry.make(loaded.cursor) });

const EMPTY_FRAMES = 3 * FPS;

const metadataFor =
  (entry: Entry): CalculateMetadataFunction<Props> =>
  async ({ props }) => {
    const loaded = await loadCapture(props.capture).catch(() => null);
    if (!loaded) return { durationInFrames: EMPTY_FRAMES, props };
    return { durationInFrames: clipFrames(clipOf(entry, loaded), props.preset), props: { ...props, capture: loaded.name } };
  };

const showFor = (entry: Entry) => {
  const Show: FC<Props> = ({ brand, preset, page, capture, second }) => {
    const loaded = useCapture(capture);
    // A look sets where the screen sits too, so its preview is staged (CaptureShot); the rest are a plain card.
    const staged = entry.name.startsWith('look-');
    const other = useCapture(staged && second ? second : capture);
    return (
      <BrandProvider brand={brand}>
        <MotionProvider preset={preset}>
          <Stage name={page}>
            {loaded && staged ? (
              other !== undefined ? (
                <CaptureShot {...clipOf(entry, loaded)} others={other && second ? [{ src: other.src, cursor: other.cursor, tracks: other.tracks, look: entry.make(loaded.cursor).look, cursorName: 'Ana' }] : []} align="marks" />
              ) : null
            ) : loaded ? (
              <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                <CaptureClip {...clipOf(entry, loaded)} width={WIDTH} style={{ position: 'relative' }} />
              </AbsoluteFill>
            ) : loaded === null ? (
              <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Label at={0}>No capture yet: record one with tools/capture/capture.mjs run</Label>
              </AbsoluteFill>
            ) : null}
            <MoveCaption>{entry.title}</MoveCaption>
          </Stage>
        </MotionProvider>
      </BrandProvider>
    );
  };
  return Show;
};

/** The kinds of event a stretch is found around: its first one in the stretch is the moment the scene shows. */
const ACTIONS = new Set(['click', 'type', 'press', 'drag']);

/**
 * The scene's defining moment on the clip's clock: its first hand-set camera move's cue; else its first freeze,
 * rewind or jump; else the first click, typing, key or drag in its stretch (the stretches start about 1.3 s before
 * it). And the clip's length, from the same plan the clip draws from.
 */
const timingOf = (entry: Entry, loaded: LoadedCapture, preset: PresetName): SceneTiming => {
  const clip = clipOf(entry, loaded);
  const plan = planOfClip(clip, withThings(clip.cursor, clip.tracks, clip.things), preset);
  const from = clip.from ?? 0;
  const time = clip.time;
  const rec = time?.freezes?.[0]?.at ?? time?.rewinds?.[0]?.at ?? time?.jumps?.[0]?.from ?? loaded.cursor.events.find((e) => ACTIONS.has(e.type) && e.t >= from - 1e-6)?.t;
  const cue = clip.moves?.length ? clip.moves[0].at : rec === undefined ? null : plan.map.filmAt(rec);
  return { cue, seconds: plan.map.duration };
};

const shows = captureEntries.map((entry) => ({ entry, Show: showFor(entry), metadata: metadataFor(entry) }));

/** The same scenes as records, for previews outside Remotion Studio. A look is staged (CaptureShot); the rest draw a fixed-size card. */
export const captureScenes: CaptureScene[] = shows.map(({ entry, Show }) => ({
  name: entry.name,
  Show: Show as CaptureScene['Show'],
  props: { second: '' },
  preset: entry.preset ?? 'confident',
  size: [1920, 1080],
  fit: entry.name.startsWith('look-') ? 'fill' : 'contain',
  timing: (loaded, _props, preset) => timingOf(entry, loaded, preset),
}));

/** The capture gallery, for MotionCompositions. */
export const CaptureMotionCompositions: FC = () => (
  <Folder name="capture">
    {shows.map(({ entry, Show, metadata }) => (
      <Composition
        key={entry.name}
        id={`move-${entry.name}`}
        component={Show}
        schema={captureMotionSchema}
        width={1920}
        height={1080}
        fps={FPS}
        durationInFrames={EMPTY_FRAMES}
        calculateMetadata={metadata}
        defaultProps={{ brand: defaultBrand, preset: entry.preset ?? 'confident', page: 'light', capture: '', second: '' }}
      />
    ))}
  </Folder>
);
