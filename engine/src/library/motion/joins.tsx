// The transitions part of the motion library (CAPTURE-PLAN 7.5 and the 7.9 transitions table): one composition per
// transition ("move-join-<name>", in the "capture-transition" folder of Remotion Studio). Each joins two parts of a
// real take at the click that opens its next page (splitAtClick in joins.ts), or, with "second", the first part of
// one take to the second part of another take of the same script. "options" (JSON) gives anything else a CaptureJoin
// takes, and settings for either shot: {"join": {"from": {...}, "to": {...}}, "a": {...}, "b": {"moves": [...]}}.
import { useEffect, useState, type FC } from 'react';
import { AbsoluteFill, cancelRender, Composition, continueRender, delayRender, Folder, type CalculateMetadataFunction } from 'remotion';
import { z } from 'zod';
import { FPS } from '../../capture/CapturePreview';
import { loadCapture, useCapture, type LoadedCapture } from '../../capture/load';
import { BrandProvider, brandNames, defaultBrand } from '../../kit/brand';
import { planJoin, splitAtClick, type JoinOptions, type JoinSource } from '../../kit/capture/joins';
import { transitionNames, type TransitionName } from '../../kit/capture/looks';
import { CaptureJoin } from '../../kit/capture/transitions';
import { MotionProvider, presetNames, type PresetName } from '../../kit/motion';
import { stageNames } from '../../kit/tokens';
import { Label, Stage } from '../../kit/ui';
import { MoveCaption } from './parts';

export const joinMotionSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  page: z.enum(stageNames),
  /** "<job>/<id>"; empty means the newest capture. */
  capture: z.string(),
  /** Another take of the same script for the second part ("<job>/<id>"); empty: the same take. */
  second: z.string(),
  /** JSON: {"join": {...JoinOptions}, "a": {...}, "b": {...}}. */
  options: z.string(),
});
type Props = z.infer<typeof joinMotionSchema>;

const titles: Record<TransitionName, string> = {
  cut: 'Transition: straight cut',
  'match-cut': 'Transition: match cut on the click',
  'snap-cut': 'Transition: snap cut',
  'zoom-through': 'Transition: zoom through',
  'shared-element': 'Transition: shared element',
  'container-grow': 'Transition: container grow',
  push: 'Transition: push',
  slide: 'Transition: soft slide',
  'depth-push': 'Transition: depth push',
  'circle-reveal': 'Transition: circle reveal',
  'card-flip': 'Transition: card flip',
  'stack-shuffle': 'Transition: stack shuffle',
  'grid-zoom': 'Transition: grid zoom',
  'scroll-relay': 'Transition: scroll relay',
  'cursor-drag': 'Transition: cursor drag',
  whip: 'Transition: whip',
  'window-split': 'Transition: window split',
  'device-swap': 'Transition: device swap',
  'blur-dissolve': 'Transition: blur dissolve',
  'cross-dissolve': 'Transition: cross-dissolve',
};

/** The energy each preview is made in: whip and snap cut are for hype films only. */
const presetOf = (name: TransitionName): PresetName => (name === 'whip' || name === 'snap-cut' || name === 'grid-zoom' || name === 'stack-shuffle' ? 'hype' : 'confident');

/** The second part plays this long in a preview. */
const B_SECONDS = 2.6;
const EMPTY_FRAMES = 3 * FPS;
const FRAME = { width: 1920, height: 1080, fps: FPS };

type Extra = { join?: JoinOptions; a?: Partial<JoinSource>; b?: Partial<JoinSource> };
const extraOf = (props: Props): Extra => {
  try {
    return props.options.trim() ? (JSON.parse(props.options) as Extra) : {};
  } catch {
    throw new Error(`The preview's "options" are not valid JSON: ${props.options}`);
  }
};

/** The two shots of a preview: the take split at its click, the second part from the other take when one is named. */
const shotsOf = (name: TransitionName, loaded: LoadedCapture, second: LoadedCapture | null, props: Props) => {
  const extra = extraOf(props);
  const source: JoinSource = { src: loaded.src, cursor: loaded.cursor, tracks: loaded.tracks, look: 'product-demo' };
  const split = splitAtClick(source);
  if (!split) return null;
  let b = split.b;
  if (second) {
    const other = splitAtClick({ src: second.src, cursor: second.cursor, tracks: second.tracks, look: 'product-demo' });
    if (other) b = other.b;
  }
  const a: JoinSource = { ...split.a, ...extra.a };
  b = { ...b, ...extra.b };
  b = { ...b, to: extra.b?.to ?? Math.min(b.cursor.seconds, (b.from ?? 0) + B_SECONDS) };
  const options: JoinOptions = { ...extra.join, transition: name };
  return { a, b, options };
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

const metadataFor =
  (name: TransitionName): CalculateMetadataFunction<Props> =>
  async ({ props }) => {
    const loaded = await loadCapture(props.capture).catch(() => null);
    const second = props.second ? await loadCapture(props.second).catch(() => null) : null;
    const shots = loaded ? shotsOf(name, loaded, second, props) : null;
    if (!loaded || !shots) return { durationInFrames: EMPTY_FRAMES, props };
    const plan = planJoin(shots.a, shots.b, shots.options, props.preset, FRAME);
    return { durationInFrames: Math.max(1, Math.floor(plan.total * FPS)), props: { ...props, capture: loaded.name } };
  };

const showFor = (name: TransitionName) => {
  const Show: FC<Props> = (props) => {
    const loaded = useCapture(props.capture);
    const second = useSecond(props.second);
    const shots = loaded && second !== undefined ? shotsOf(name, loaded, second, props) : null;
    return (
      <BrandProvider brand={props.brand}>
        <MotionProvider preset={props.preset}>
          <Stage name={props.page}>
            {shots ? (
              <CaptureJoin a={shots.a} b={shots.b} {...shots.options} />
            ) : loaded === null || (loaded && second !== undefined) ? (
              <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Label at={0}>No capture with a click yet: record one with tools/capture/capture.mjs run</Label>
              </AbsoluteFill>
            ) : null}
            <MoveCaption>{titles[name]}</MoveCaption>
          </Stage>
        </MotionProvider>
      </BrandProvider>
    );
  };
  return Show;
};

const shows = transitionNames.map((name) => ({ name, Show: showFor(name), metadata: metadataFor(name) }));

/** The transitions gallery, for MotionCompositions. */
export const JoinMotionCompositions: FC = () => (
  <Folder name="capture-transition">
    {shows.map(({ name, Show, metadata }) => (
      <Composition
        key={name}
        id={`move-join-${name}`}
        component={Show}
        schema={joinMotionSchema}
        width={FRAME.width}
        height={FRAME.height}
        fps={FPS}
        durationInFrames={EMPTY_FRAMES}
        calculateMetadata={metadata}
        defaultProps={{ brand: defaultBrand, preset: presetOf(name), page: 'light', capture: '', second: '', options: '' }}
      />
    ))}
  </Folder>
);
