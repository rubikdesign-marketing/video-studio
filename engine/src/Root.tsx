import type { FC } from 'react';
import { Composition, Still } from 'remotion';
import { calculateCapturePreview, CapturePreview, capturePreviewDefaults, capturePreviewSchema, FPS as CAPTURE_FPS } from './capture/CapturePreview';
import { calculateGlueProbe, GlueProbe, glueProbeDefaults, glueProbeSchema } from './capture/GlueProbe';
import { calculateFootageCut, FootageCut, footageCutDefaults, footageCutSchema } from './footage/FootageCut';
import { JobCompositions, jobs } from './jobs';
import { defaultBrand } from './kit/brand';
import { BackgroundCompositions } from './library/backgrounds';
import { MotionCompositions } from './library/motion';
import { ProductCompositions } from './products';
import { BrandSheet, brandSheetSchema } from './sheet/BrandSheet';
import { Smoke, smokeSchema } from './smoke/Smoke';

// Fonts are loaded by <BrandProvider> for the brand a composition is given; every render waits for them.
export const RemotionRoot: FC = () => (
  <>
    <Composition
      id="Smoke"
      component={Smoke}
      schema={smokeSchema}
      width={1920}
      height={1080}
      fps={60}
      durationInFrames={360}
      defaultProps={{ brand: defaultBrand, preset: 'confident', stage: 'dark', captions: true }}
    />
    {/* One still frame for approving a brand: palette, logo, type, controls and captions on both pages. */}
    <Still id="BrandSheet" component={BrandSheet} schema={brandSheetSchema} width={1920} height={1080} defaultProps={{ brand: defaultBrand }} />
    {/* Every job scaffolded by tools/film/scaffold.mjs: one composition per film and one per scene. */}
    <JobCompositions jobs={jobs} />
    {/* The library of backgrounds: the "Backgrounds" reel and one "bg-<name>" composition each. */}
    <BackgroundCompositions />
    {/* The library of animations: the "Motion" reel and one "move-<name>" composition each. */}
    <MotionCompositions />
    {/* A product capture from tools/capture/capture.mjs, played with its pointer drawn: the newest one, or the one named. */}
    <Composition
      id="CapturePreview"
      component={CapturePreview}
      schema={capturePreviewSchema}
      width={1920}
      height={1080}
      fps={CAPTURE_FPS}
      durationInFrames={CAPTURE_FPS * 3}
      calculateMetadata={calculateCapturePreview}
      defaultProps={capturePreviewDefaults}
    />
    {/* Measuring only: a capture with one product animation, for tools/checks/capture_glue.mjs. */}
    <Composition
      id="GlueProbe"
      component={GlueProbe}
      schema={glueProbeSchema}
      width={1920}
      height={1080}
      fps={CAPTURE_FPS}
      durationInFrames={CAPTURE_FPS}
      calculateMetadata={calculateGlueProbe}
      defaultProps={glueProbeDefaults}
    />
    {/* An edit of raw footage from tools/footage/footage.mjs rough: the newest one, or the job named. */}
    <Composition
      id="FootageCut"
      component={FootageCut}
      schema={footageCutSchema}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={90}
      calculateMetadata={calculateFootageCut}
      defaultProps={footageCutDefaults}
    />
    {/* Product screens rebuilt from real captures: one "TulvoUi-<id>" composition per screen (src/products). */}
    <ProductCompositions />
  </>
);
