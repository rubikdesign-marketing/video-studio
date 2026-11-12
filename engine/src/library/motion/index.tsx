// The motion library's gallery: one composition per move ("move-<name>"), and "Motion", a reel that plays every
// move one after another. Root.tsx registers them all with one line: <MotionCompositions />.
// The moves themselves are in src/kit/moves; the catalogue is library/motion/index.json.
import type { FC, ReactNode } from 'react';
import { Composition, Folder, Series } from 'remotion';
import { z } from 'zod';
import { BrandProvider, brandNames, defaultBrand } from '../../kit/brand';
import { MotionProvider, presetNames } from '../../kit/motion';
import { stageNames } from '../../kit/tokens';
import { Stage } from '../../kit/ui';
import { CaptureMotionCompositions } from './capture';
import { demos, type Demo } from './demos';
import { JoinMotionCompositions } from './joins';
import { ProductMotionCompositions } from './product';
import { RelayoutMotionCompositions } from './relayout';
import { MoveCaption } from './parts';

/** Props of every gallery composition: the brand, the energy preset, and the page (light or dark). */
export const motionSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  page: z.enum(stageNames),
});
type MotionProps = z.infer<typeof motionSchema>;

const FRAME = { width: 1920, height: 1080, fps: 60 };
const framesOf = (demo: Demo) => Math.round(demo.seconds * FRAME.fps);

/** One brand, one preset and one stage around whatever plays. The stage stays outside the scenes, as in a film. */
const Shell: FC<MotionProps & { children: ReactNode }> = ({ brand, preset, page, children }) => (
  <BrandProvider brand={brand}>
    <MotionProvider preset={preset}>
      <Stage name={page}>{children}</Stage>
    </MotionProvider>
  </BrandProvider>
);

/** A move's scene with its name bottom left. */
const Shown: FC<{ demo: Demo; page: MotionProps['page'] }> = ({ demo, page }) => (
  <>
    <demo.Scene page={page} />
    <MoveCaption>{demo.title}</MoveCaption>
  </>
);

/** One composition component per move, made once. */
const gallery = demos.map((demo) => {
  const Move: FC<MotionProps> = (props) => (
    <Shell {...props}>
      <Shown demo={demo} page={props.page} />
    </Shell>
  );
  return { demo, Move };
});

/** Every move, one after another. Each starts on its own clock, so the cues of a scene are the same here as alone. */
const Reel: FC<MotionProps> = (props) => (
  <Shell {...props}>
    <Series>
      {demos.map((demo) => (
        <Series.Sequence key={demo.name} name={demo.title} durationInFrames={framesOf(demo)}>
          <Shown demo={demo} page={props.page} />
        </Series.Sequence>
      ))}
    </Series>
  </Shell>
);

const defaults: MotionProps = { brand: defaultBrand, preset: 'confident', page: 'light' };

/** The reel and the gallery, for Root.tsx. */
export const MotionCompositions: FC = () => (
  <>
    <Composition
      id="Motion"
      component={Reel}
      schema={motionSchema}
      {...FRAME}
      durationInFrames={demos.reduce((total, demo) => total + framesOf(demo), 0)}
      defaultProps={defaults}
    />
    <Folder name="moves">
      {gallery.map(({ demo, Move }) => (
        <Composition
          key={demo.name}
          id={`move-${demo.name}`}
          component={Move}
          schema={motionSchema}
          {...FRAME}
          durationInFrames={framesOf(demo)}
          defaultProps={defaults}
        />
      ))}
    </Folder>
    {/* Pointer styles, click effects, camera moves, time effects and look presets, each on a real capture. */}
    <CaptureMotionCompositions />
    {/* Stagings and animations on the product, each on a real capture. */}
    <ProductMotionCompositions />
    {/* Transitions between two captures, or two parts of one, on real takes. */}
    <JoinMotionCompositions />
    {/* The same takes re-laid out for 9:16, 1:1 and 4:5, the camera following the action. */}
    <RelayoutMotionCompositions />
  </>
);
