// "CapturePreview": watch a product capture with the engine's motion on it, in any brand. Leave "capture" empty for
// the newest one, or type its name ("<job>/<id>", as the run printed it). Pick a look, and override the pointer
// style or the click effect; anything else a CaptureClip takes (time effects, camera moves, reading holds, the
// pointer's name) goes in "options" as JSON, for example:
//   {"time": {"ramps": [{"from": 15, "to": 17.2, "speed": 4}], "pins": [{"event": {"click": 3}, "at": 6}]},
//    "moves": [{"move": "push-in", "to": {"click": 2}, "at": 1}], "holds": [[8, 9.5]], "cursorName": "Dani"}
import type { FC } from 'react';
import { AbsoluteFill, type CalculateMetadataFunction } from 'remotion';
import { z } from 'zod';
import { BrandProvider, brandNames, defaultBrand } from '../kit/brand';
import { CaptureClip, clipTime, type CaptureClipProps, type CaptureZoom } from '../kit/CaptureClip';
import { clicksOf, type CaptureCursor } from '../kit/capture/data';
import { clickEffects, cursorStyles, lookNames } from '../kit/capture/looks';
import { planCapture } from '../kit/capture/plan';
import { MotionProvider, presetNames, type PresetName } from '../kit/motion';
import { stageNames } from '../kit/tokens';
import { Label, Stage } from '../kit/ui';
import { loadCapture, useCapture, type LoadedCapture } from './load';

export const capturePreviewSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  page: z.enum(stageNames),
  /** "<job>/<id>"; empty means the newest capture. */
  capture: z.string(),
  /** Seconds of the recording to play. `to` 0 means to the end. */
  from: z.number().min(0),
  to: z.number().min(0),
  /** Version 1: push in on the area around the first click, and back out (turns the automatic camera off). */
  zoom: z.boolean(),
  /** One word for the pointer, click, camera and pace. */
  look: z.enum(lookNames),
  /** "look" keeps the look's own. */
  cursorStyle: z.enum(['look', ...cursorStyles]),
  click: z.enum(['look', ...clickEffects]),
  /** Anything else a CaptureClip takes, as JSON: time, moves, holds, camera, cursorName, trail, keyCaps... */
  options: z.string(),
});
type Props = z.infer<typeof capturePreviewSchema>;

export const FPS = 60;
const WIDTH = 1600;
const EMPTY_SECONDS = 3;

/** The CaptureClip settings a preview's props mean. */
const clipProps = (props: Props, loaded: LoadedCapture): Omit<CaptureClipProps, 'width'> => {
  let extra: Partial<CaptureClipProps> = {};
  try {
    extra = props.options.trim() ? (JSON.parse(props.options) as Partial<CaptureClipProps>) : {};
  } catch {
    throw new Error(`The preview's "options" are not valid JSON: ${props.options}`);
  }
  return {
    src: loaded.src,
    cursor: loaded.cursor,
    tracks: loaded.tracks,
    from: props.from,
    to: props.to > props.from ? props.to : undefined,
    look: props.look,
    cursorStyle: props.cursorStyle === 'look' ? undefined : props.cursorStyle,
    click: props.click === 'look' ? undefined : props.click,
    ...extra,
  };
};

/** The settings with version 1's zoom added, timed from where the clip really starts (after the first load). */
const withZoom = (props: Props, clip: Omit<CaptureClipProps, 'width'>): Omit<CaptureClipProps, 'width'> => {
  if (!props.zoom) return clip;
  const start = planCapture(clip.cursor, clip.tracks, { from: clip.from, to: clip.to, look: clip.look, time: clipTime(clip) }).from;
  return { ...clip, zoom: clip.zoom ?? firstClickZoom(clip.cursor, start) };
};

/** The film length of a clip, in frames, once its time effects are applied. */
export const clipFrames = (clip: Omit<CaptureClipProps, 'width'>, energy: PresetName) => {
  const plan = planCapture(clip.cursor, clip.tracks, {
    from: clip.from,
    to: clip.to,
    look: clip.look,
    overrides: { pace: clip.pace, repath: clip.repath, magnet: clip.magnet },
    time: clipTime(clip),
    energy,
  });
  return Math.max(1, Math.floor(plan.map.duration * FPS));
};

/** The length follows the part of the recording chosen and its time effects. */
export const calculateCapturePreview: CalculateMetadataFunction<Props> = async ({ props }) => {
  const loaded = await loadCapture(props.capture).catch(() => null);
  if (!loaded) return { durationInFrames: EMPTY_SECONDS * FPS, props };
  return { durationInFrames: clipFrames(clipProps(props, loaded), props.preset), props: { ...props, capture: loaded.name } };
};

/** Version 1's zoom on the first click: in a second before it, back out a little after. */
const firstClickZoom = (cursor: CaptureCursor, from: number): CaptureZoom | undefined => {
  const click = clicksOf(cursor).find((c) => c.t > from + 1);
  if (!click || click.x === undefined || click.y === undefined) return undefined;
  const width = cursor.page.width / 1.8;
  const height = (width * cursor.page.height) / cursor.page.width;
  return { to: { x: click.x - width / 2, y: click.y - height / 2, width }, at: click.t - from - 1, back: click.t - from + 1.2 };
};

export const CapturePreview: FC<Props> = (props) => {
  const loaded = useCapture(props.capture);
  return (
    <BrandProvider brand={props.brand}>
      <MotionProvider preset={props.preset}>
        <Stage name={props.page}>
          {loaded ? (
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
              <CaptureClip {...withZoom(props, clipProps(props, loaded))} width={WIDTH} style={{ position: 'relative' }} />
            </AbsoluteFill>
          ) : loaded === null ? (
            <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Label at={0}>No capture yet: record one with tools/capture/capture.mjs run</Label>
            </AbsoluteFill>
          ) : null}
        </Stage>
      </MotionProvider>
    </BrandProvider>
  );
};

export const capturePreviewDefaults: Props = {
  brand: defaultBrand,
  preset: 'confident',
  page: 'light',
  capture: '',
  from: 0,
  to: 0,
  zoom: false,
  look: 'product-demo',
  cursorStyle: 'look',
  click: 'look',
  options: '',
};
