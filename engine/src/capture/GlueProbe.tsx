// A measuring composition, not a film piece: one capture filling the frame, the pointer hidden, hand-set camera moves
// and one product animation on one tracked thing. tools/checks/capture_glue.mjs renders it and compares, frame by
// frame, where the real thing is in the picture and where the animation was drawn with where tracks.json says.
import type { FC } from 'react';
import { AbsoluteFill, type CalculateMetadataFunction } from 'remotion';
import { z } from 'zod';
import { BrandProvider, brandNames, defaultBrand } from '../kit/brand';
import { CaptureClip, type CaptureClipProps } from '../kit/CaptureClip';
import { emphasisKinds } from '../kit/capture/glue';
import { MotionProvider, presetNames } from '../kit/motion';
import { Stage } from '../kit/ui';
import { clipFrames, FPS } from './CapturePreview';
import { loadCapture, useCapture } from './load';

export const glueProbeSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  capture: z.string(),
  target: z.string(),
  kind: z.enum(emphasisKinds),
  /** The clip's other settings as JSON: from, to, moves, look, camera. */
  clip: z.string(),
});
type Props = z.infer<typeof glueProbeSchema>;

const settingsOf = (props: Props): Omit<CaptureClipProps, 'src' | 'cursor' | 'tracks' | 'width'> => ({
  pointer: false,
  ...(JSON.parse(props.clip || '{}') as object),
  emphasis: [{ kind: props.kind, target: props.target, at: 0, out: 1e6 }],
});

export const calculateGlueProbe: CalculateMetadataFunction<Props> = async ({ props }) => {
  const loaded = await loadCapture(props.capture).catch(() => null);
  if (!loaded) return { durationInFrames: FPS, props };
  return { durationInFrames: clipFrames({ src: loaded.src, cursor: loaded.cursor, tracks: loaded.tracks, ...settingsOf(props) }, props.preset), props };
};

export const GlueProbe: FC<Props> = (props) => {
  const loaded = useCapture(props.capture);
  return (
    <BrandProvider brand={props.brand}>
      <MotionProvider preset={props.preset}>
        <Stage name="light">
          {loaded ? (
            <AbsoluteFill>
              <CaptureClip src={loaded.src} cursor={loaded.cursor} tracks={loaded.tracks} {...settingsOf(props)} width={1920} window={false} style={{ left: 0, top: 0 }} />
            </AbsoluteFill>
          ) : null}
        </Stage>
      </MotionProvider>
    </BrandProvider>
  );
};

export const glueProbeDefaults: Props = { brand: defaultBrand, preset: 'confident', capture: '', target: '', kind: 'outline', clip: '{}' };
