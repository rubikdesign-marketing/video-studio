// The gallery for moves that must work in every size a film ships in: text moves, transitions, hook openers and
// shader backgrounds (LIBRARY-PLAN phases 4 and 5). Each move is one composition, "move-<name>", whose `format`
// prop sets the frame: 16:9, 9:16, 1:1 or 4:5. Each family also has a reel. The moves' own demo lists are in
// the family folders (text/, transitions/, openers/, shaders/); a move enters the library only with an entry
// there and one in library/motion/index.json, under the same name.
//
//   npx remotion render move-mask-rise ../library/motion/mask-rise.mp4
//   npx remotion render move-mask-rise out/mask-rise-9x16.mp4 --props='{"format":"9:16","fps":30}' --scale=0.5
import type { FC } from 'react';
import { Composition, Folder, Series } from 'remotion';
import { z } from 'zod';
import { BrandProvider, brandNames, defaultBrand } from '../../kit/brand';
import { MotionProvider, presetNames } from '../../kit/motion';
import { stageNames, type StageName } from '../../kit/tokens';
import { Stage } from '../../kit/ui';
import { MoveCaption } from './parts';
import { sizedFamilies } from './sized-families';

/** The four sizes every film may ship in, in pixels. */
export const formats = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
} as const;
export const formatNames = ['16:9', '9:16', '1:1', '4:5'] as const;
export type FormatName = (typeof formatNames)[number];

export const sizedSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  page: z.enum(stageNames),
  format: z.enum(formatNames),
  /** Frames a second. 60 for the previews; 30 is enough to look at the other sizes. */
  fps: z.number().int().min(24).max(60),
  /** Show the move's name bottom left. */
  caption: z.boolean(),
});
export type SizedProps = z.infer<typeof sizedSchema>;

/** One move's demo: its name in the catalogue, its caption, its length, and the scene. */
export type SizedDemo = {
  name: string;
  title: string;
  /** Seconds: 3 to 6. */
  seconds: number;
  /**
   * When its one change lands (its emphasis component's `at`), for a scene whose change the style previews' scan
   * cannot see (a thin mark): tools/styles/scene-timing.mjs takes it over the measured one. Optional.
   */
  cue?: number;
  /** The scene. It is told the page and the frame size, for moves that lay out differently in a tall frame. */
  Scene: FC<{ page: StageName; format: FormatName }>;
  /** A move that draws its own full-frame background (a shader) is shown without the stage's own page under it. */
  bare?: boolean;
};

export type SizedFamily = { id: string; title: string; demos: SizedDemo[] };

const defaults: SizedProps = { brand: defaultBrand, preset: 'confident', page: 'light', format: '16:9', fps: 60, caption: true };

/** A demo's length in frames at this frame rate. The reel adds these up, so it ends exactly where its last demo does. */
const framesOf = (demo: { seconds: number }, fps: number) => Math.round(demo.seconds * fps);

const metadata = (demos: { seconds: number }[]) => ({ props }: { props: SizedProps }) => ({
  ...formats[props.format],
  fps: props.fps,
  durationInFrames: demos.reduce((total, demo) => total + framesOf(demo, props.fps), 0),
});

const Shell: FC<{ props: SizedProps; demo: SizedDemo }> = ({ props, demo }) => (
  <BrandProvider brand={props.brand}>
    <MotionProvider preset={props.preset}>
      <Stage name={props.page}>
        <demo.Scene page={props.page} format={props.format} />
        {props.caption ? <MoveCaption>{demo.title}</MoveCaption> : null}
      </Stage>
    </MotionProvider>
  </BrandProvider>
);

const one = new Map<string, FC<SizedProps>>();
const componentFor = (demo: SizedDemo) => {
  let made = one.get(demo.name);
  if (!made) {
    made = (props: SizedProps) => <Shell props={props} demo={demo} />;
    one.set(demo.name, made);
  }
  return made;
};

const reels = new Map<string, FC<SizedProps>>();
const reelFor = (family: SizedFamily) => {
  let made = reels.get(family.id);
  if (!made) {
    made = (props: SizedProps) => (
      <Series>
        {family.demos.map((demo) => (
          <Series.Sequence key={demo.name} name={demo.title} durationInFrames={framesOf(demo, props.fps)}>
            <Shell props={props} demo={demo} />
          </Series.Sequence>
        ))}
      </Series>
    );
    reels.set(family.id, made);
  }
  return made;
};

/** Every sized family's moves and reels, for MotionCompositions. */
export const SizedCompositions: FC = () => (
  <>
    {sizedFamilies.map((family) =>
      family.demos.length === 0 ? null : (
        <Folder key={family.id} name={family.id}>
          <Composition
            id={`reel-${family.id}`}
            component={reelFor(family)}
            schema={sizedSchema}
            width={1920}
            height={1080}
            fps={60}
            durationInFrames={1}
            defaultProps={defaults}
            calculateMetadata={metadata(family.demos)}
          />
          {family.demos.map((demo) => (
            <Composition
              key={demo.name}
              id={`move-${demo.name}`}
              component={componentFor(demo)}
              schema={sizedSchema}
              width={1920}
              height={1080}
              fps={60}
              durationInFrames={1}
              defaultProps={defaults}
              calculateMetadata={metadata([demo])}
            />
          ))}
        </Folder>
      ),
    )}
  </>
);
