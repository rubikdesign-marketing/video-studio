// The library's proof film (LIBRARY-PLAN phase 6; job jobs/2026-11-18-library-proof): one 15 s, 9:16 Tulvo film made
// twice with the same words. "New" uses the library: a hook opener, six new text moves, three new transitions and a
// hard cut, library sounds, and cuts on the beats of a bundled bed. "Old" uses only what the studio had before the
// library: the kit's Headline and type moves, its transitions, the brand's own eleven sounds, and cuts set by eye.
// Both play the same bed, so the comparison is about the picture and the effects, not the music.
//
// Sound files are copied into engine/public/jobs/library-proof/ by jobs/2026-11-18-library-proof/prepare.sh (the
// public jobs folder is kept out of git, like every job's media).
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Audio, Composition, Folder, interpolate, Sequence, staticFile } from 'remotion';
import { z } from 'zod';
import { BrandProvider, brandNames } from '../../../kit/brand';
import { BlurIn, DrawnMark, MomentumCut, SlideOffReveal, SwapWord, TrackingSettle, ZoomThroughSwap } from '../../../kit/moves';
import { MotionProvider, presetNames } from '../../../kit/motion';
import { PunchIn } from '../../../kit/openers';
import { IrisWipe, PanelWipe, WhipPan } from '../../../kit/transitions';
import { FadeUp, Highlighter, MaskRise, Retype, SmearIn, WordPop } from '../../../kit/type';
import { Headline, Stage, useVh, Wordmark } from '../../../kit/ui';
import { Arrive, Centre, Line } from '../parts';

export const PROOF_FPS = 30;
export const PROOF_SECONDS = 15;
const W = 1080;
const H = 1920;

export const proofSchema = z.object({ brand: z.enum(brandNames), preset: z.enum(presetNames) });
type ProofProps = z.infer<typeof proofSchema>;
const defaults: ProofProps = { brand: 'tulvo', preset: 'confident' };

/** The film's cuts in seconds. New: on beats of the bed (beats.py snap); old: where the text seemed to need them. */
export const CUTS = {
  new: [2.007, 5.007, 10.006, 12.505],
  old: [2.4, 5.4, 10.2, 12.6],
} as const;

const AUDIO = (file: string) => staticFile(`jobs/library-proof/${file}`);

/** One effect: a file, the film second it lands on (its attack), and its volume. */
type Cue = { file: string; at: number; volume: number };

/** The bed under both films: from its first beat, faded over the last second. */
const Bed: FC = () => (
  <Audio
    src={AUDIO('bed.mp3')}
    volume={(f) => 0.42 * interpolate(f, [(PROOF_SECONDS - 1.2) * PROOF_FPS, PROOF_SECONDS * PROOF_FPS], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
  />
);

const Effects: FC<{ cues: Cue[] }> = ({ cues }) => (
  <>
    {cues.map((c, i) => (
      <Sequence key={i} from={Math.max(0, Math.round(c.at * PROOF_FPS))} layout="none">
        <Audio src={AUDIO(c.file)} volume={c.volume} />
      </Sequence>
    ))}
  </>
);

const Shell: FC<ProofProps & { children: ReactNode; cues: Cue[] }> = ({ brand, preset, children, cues }) => (
  <BrandProvider brand={brand}>
    <MotionProvider preset={preset}>
      <Stage name="light">{children}</Stage>
      <Bed />
      <Effects cues={cues} />
    </MotionProvider>
  </BrandProvider>
);

/** The small wordmark that opens the film (the logo opens and closes every Tulvo film). */
const TopMark: FC<{ out?: number }> = ({ out }) => {
  const vh = useVh();
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: vh(7) }}>
      <Wordmark at={0} out={out} height={2.6} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the new film

// When each transition hands over, after its cue, at the confident preset: the whip pan 0.21 s (a `quick` length),
// the panel wipe about 0.27 s (under the full-frame panel; with its frame rounding, 8 frames at 30 fps), the iris on its cue; the old kit's momentum cut 0.21 s and
// zoom-through 0.16 s; the slide-off reveal shares its clock with the next scene. Each scene's clock starts where
// the scene before hands over, so every cut lands on the planned second.
const WHIP_LEAD = 0.21;
const N = CUTS.new;
/** Where the second scene's clock starts: the whip's join frame, half a `tick` before its swap. */
const s2Start = Math.round((N[0] - 0.05) * PROOF_FPS) / PROOF_FPS;

const NewS5: FC = () => (
  <Centre gap={5}>
    <Wordmark at={0.35} height={6} />
    <WordPop lines="Try it *free*" at={0.7} size={6.5} />
  </Centre>
);

const PANEL_LEAD = 0.267;

const NewS4: FC = () => (
  <PanelWipe at={N[3] - N[2] - PANEL_LEAD} side="up" next={<NewS5 />}>
    <Centre gap={3}>
      <FadeUp lines="Describe it." at={-0.2} size={6.5} colours={['second']} />
      <Arrive at={0.5}>
        <Highlighter lines="Tulvo *builds it.*" mark="builds it." at={0.95} size={7.5} />
      </Arrive>
    </Centre>
  </PanelWipe>
);

const NewS3: FC = () => (
  <Centre>
    <Retype text="In ten apps" to="In one place" at={0.25} size={8} />
  </Centre>
);

const NewS2: FC = () => (
  <IrisWipe at={N[1] - s2Start} page="light" next={<HardCut at={N[2] - N[1]} before={<NewS3 />} after={<NewS4 />} />}>
    <Centre gap={2}>
      <MaskRise lines="Clients here." by="word" at={0.1} size={7} />
      <SmearIn lines="Invoices *there.*" at={0.55} size={7} />
    </Centre>
  </IrisWipe>
);

/** A plain cut on a downbeat: `before` until `at`, then `after` on its own clock. */
const HardCut: FC<{ at: number; before: ReactNode; after: ReactNode }> = ({ at, before, after }) => (
  <>
    <Sequence durationInFrames={Math.round(at * PROOF_FPS)} layout="none">
      {before}
    </Sequence>
    <Sequence from={Math.round(at * PROOF_FPS)} layout="none">
      {after}
    </Sequence>
  </>
);

/** When the corrected ending starts to be typed, on the third scene's clock (read from the render). */
const RETYPE_AT = 3.1;

const newCues: Cue[] = [
  { file: 'impact-hard.mp3', at: 0.0, volume: 0.55 },
  { file: 'impact-soft.mp3', at: 0.37, volume: 0.5 },
  { file: 'whip.mp3', at: N[0] - 0.18, volume: 0.6 },
  { file: 'text-swish.mp3', at: s2Start + 0.1, volume: 0.45 },
  { file: 'swish-fast.mp3', at: s2Start + 0.55, volume: 0.45 },
  { file: 'iris-whoosh.mp3', at: N[1] - 0.15, volume: 0.55 },
  { file: 'typing.mp3', at: N[1] + 0.25, volume: 0.35 },
  { file: 'retyping.mp3', at: N[1] + RETYPE_AT, volume: 0.35 },
  { file: 'impact-soft.mp3', at: N[2], volume: 0.55 },
  { file: 'text-swish.mp3', at: N[2] + 0.05, volume: 0.4 },
  { file: 'highlight-swish.mp3', at: N[2] + 0.95, volume: 0.45 },
  { file: 'riser-into-logo.mp3', at: N[3] - 1.5, volume: 0.4 },
  { file: 'logo-sting.mp3', at: N[3], volume: 0.6 },
  { file: 'word-pop.mp3', at: N[3] + 0.7, volume: 0.45 },
];

export const LibraryProofNew: FC<ProofProps> = (props) => (
  <Shell {...props} cues={newCues}>
    <WhipPan at={N[0] - WHIP_LEAD} next={<NewS2 />}>
      <PunchIn line="Ten apps that never *talk*" at={0} />
      <TopMark />
    </WhipPan>
  </Shell>
);

// ---------------------------------------------------------------- the old film

const O = CUTS.old;

const OldS5: FC = () => (
  <Centre gap={5}>
    <Wordmark at={0.35} height={6} />
    <TrackingSettle text="Try it free" at={0.6} size={6.5} />
  </Centre>
);

const OldS4: FC = () => (
  <ZoomThroughSwap at={O[3] - O[2] - 0.16} next={<OldS5 />}>
    <Centre gap={3}>
      <BlurIn lines={['Describe it.']} at={-0.15} size={6.5} />
      <Line at={0.6} size={7.5}>
        Tulvo <DrawnMark at={1.1}>builds it.</DrawnMark>
      </Line>
    </Centre>
  </ZoomThroughSwap>
);

const OldS3: FC = () => (
  <Centre>
    <SwapWord lead="In" from="ten apps" to="one place" at={0.25} swapAt={1.8} size={8} />
  </Centre>
);

const OldS2: FC = () => (
  <SlideOffReveal
    at={O[1] - O[0]}
    next={
      // The slide-off reveal shares one clock with the next scene: start it on the reveal.
      <Sequence from={Math.round((O[1] - O[0]) * PROOF_FPS)} layout="none">
        <HardCut at={O[2] - O[1]} before={<OldS3 />} after={<OldS4 />} />
      </Sequence>
    }
  >
    <Centre>
      <Headline lines={['Clients here.', 'Invoices there.']} at={0.1} size={7} />
    </Centre>
  </SlideOffReveal>
);

// The old kit's sounds were placed by eye, as before the library: one whoosh 0.15 s before each transition.
const oldCues: Cue[] = [
  { file: 'brand-small-whoosh.mp3', at: O[0] - 0.15, volume: 0.55 },
  { file: 'brand-small-whoosh.mp3', at: O[1] - 0.15, volume: 0.5 },
  { file: 'brand-toast-pop.mp3', at: O[1] + 1.8, volume: 0.45 },
  { file: 'brand-large-whoosh.mp3', at: O[3] - 0.15, volume: 0.55 },
  { file: 'brand-success-chime.mp3', at: O[2] + 0.6, volume: 0.45 },
  { file: 'brand-logo-sting.mp3', at: O[3] + 0.3, volume: 0.6 },
];

export const LibraryProofOld: FC<ProofProps> = (props) => (
  <Shell {...props} cues={oldCues}>
    <MomentumCut at={O[0] - 0.21} next={<OldS2 />}>
      <Centre>
        <Headline lines={['Ten apps that never talk']} at={0} size={9} />
      </Centre>
      <TopMark />
    </MomentumCut>
  </Shell>
);

/** Both films, for the motion library's compositions. */
export const ProofCompositions: FC = () => (
  <Folder name="proof">
    {(
      [
        ['LibraryProof-New', LibraryProofNew],
        ['LibraryProof-Old', LibraryProofOld],
      ] as const
    ).map(([id, component]) => (
      <Composition key={id} id={id} component={component} schema={proofSchema} width={W} height={H} fps={PROOF_FPS} durationInFrames={PROOF_SECONDS * PROOF_FPS} defaultProps={defaults} />
    ))}
  </Folder>
);
