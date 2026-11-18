// Soft arrivals: fade up, letter cascade, soft wipe, blur sweep, focus in, outline fill, giant crop, block reveal.
import type { FC } from 'react';
import { BlockReveal } from '../../../kit/type/BlockReveal';
import { BlurSweep } from '../../../kit/type/BlurSweep';
import { FadeUp } from '../../../kit/type/FadeUp';
import { FocusIn } from '../../../kit/type/FocusIn';
import { GiantCrop } from '../../../kit/type/GiantCrop';
import { LetterCascade } from '../../../kit/type/LetterCascade';
import { OutlineFill } from '../../../kit/type/OutlineFill';
import { SoftWipe } from '../../../kit/type/SoftWipe';
import { Centre } from '../parts';
import type { SizedDemo } from '../sized';

const FadeUpScene: FC = () => (
  <Centre>
    <FadeUp lines={['Plan the week', 'in one place']} at={0.4} out={3.4} size={8} />
  </Centre>
);

const LetterCascadeScene: FC = () => (
  <Centre>
    <LetterCascade lines="Reports in minutes" order="centre" at={0.4} out={3.2} size={10} />
  </Centre>
);

const SoftWipeScene: FC = () => (
  <Centre>
    <SoftWipe lines={['Every order,', 'in *one* place']} at={0.4} out={3.6} size={9} />
  </Centre>
);

const BlurSweepScene: FC = () => (
  <Centre>
    <BlurSweep lines="Reports in minutes" at={0.4} out={3.2} size={10} />
  </Centre>
);

const FocusInScene: FC = () => (
  <Centre>
    <FocusIn lines={['Plan the week', 'in *one* place']} at={0.4} out={3.4} size={9} />
  </Centre>
);

const OutlineFillScene: FC = () => (
  <Centre>
    <OutlineFill lines="Ship it today" at={0.4} out={4} size={12} />
  </Centre>
);

const GiantCropScene: FC = () => (
  <Centre>
    <GiantCrop lines="Minutes" at={0.2} out={4.2} colours={['accent']} />
  </Centre>
);

const BlockRevealScene: FC = () => (
  <Centre>
    <BlockReveal lines={['Every order,', 'in *one* place']} at={0.4} out={3.8} size={9} />
  </Centre>
);

export const batch1: SizedDemo[] = [
  { name: 'fade-up', title: 'Fade up', seconds: 4, Scene: FadeUpScene },
  { name: 'letter-cascade', title: 'Letter cascade, from the centre', seconds: 4, Scene: LetterCascadeScene },
  { name: 'soft-wipe', title: 'Soft wipe', seconds: 4.5, Scene: SoftWipeScene },
  { name: 'blur-sweep', title: 'Blur sweep', seconds: 4, Scene: BlurSweepScene },
  { name: 'focus-in', title: 'Focus in', seconds: 4, Scene: FocusInScene },
  { name: 'outline-fill', title: 'Outline fill', seconds: 4.8, Scene: OutlineFillScene },
  { name: 'giant-crop', title: 'Giant crop', seconds: 5, Scene: GiantCropScene },
  { name: 'block-reveal', title: 'Block reveal', seconds: 4.5, Scene: BlockRevealScene },
];
