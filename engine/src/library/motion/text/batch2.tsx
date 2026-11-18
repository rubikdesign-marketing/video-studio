// Text batch 2: energetic arrivals for hype and confident films. One demo each, a short realistic product line.
import type { FC } from 'react';
import { ArcSwing } from '../../../kit/type/ArcSwing';
import { DropBounce } from '../../../kit/type/DropBounce';
import { FlipUp } from '../../../kit/type/FlipUp';
import { FromLens } from '../../../kit/type/FromLens';
import { ScatterAssemble } from '../../../kit/type/ScatterAssemble';
import { Slam } from '../../../kit/type/Slam';
import { SmearIn } from '../../../kit/type/SmearIn';
import { WordPop } from '../../../kit/type/WordPop';
import type { SizedDemo } from '../sized';
import { Centre } from '../parts';

const SlamScene: FC = () => (
  <Centre>
    <Slam lines="Launch day" at={0.4} out={2.8} size={15} />
  </Centre>
);
const WordPopScene: FC = () => (
  <Centre>
    <WordPop lines={['Ship it', '*today*']} at={0.4} out={3} size={11} />
  </Centre>
);
const DropBounceScene: FC = () => (
  <Centre>
    <DropBounce lines="Faster than ever" at={0.4} out={3.4} size={10} />
  </Centre>
);
const FlipUpScene: FC = () => (
  <Centre>
    <FlipUp lines={['Plan it.', 'Build it.', 'Ship *it*.']} at={0.4} out={3.6} size={9} />
  </Centre>
);
const ArcSwingScene: FC = () => (
  <Centre>
    <ArcSwing lines={['Every order,', 'in *one* place']} at={0.4} out={3.4} size={9} />
  </Centre>
);
const ScatterAssembleScene: FC = () => (
  <Centre>
    <ScatterAssemble lines="Ship it today" at={0.3} out={3.6} size={11} />
  </Centre>
);
const FromLensScene: FC = () => (
  <Centre>
    <FromLens lines={['Meet the', '*new* standard']} at={0.3} out={3.4} size={10} />
  </Centre>
);
const SmearInScene: FC = () => (
  <Centre>
    <SmearIn lines={['Go live', 'in *minutes*']} from="alternate" at={0.4} out={3.2} size={10} />
  </Centre>
);

export const batch2: SizedDemo[] = [
  { name: 'slam', title: 'Slam, dropped in from oversize', seconds: 3.5, Scene: SlamScene },
  { name: 'word-pop', title: 'Word pop, one by one', seconds: 4, Scene: WordPopScene },
  { name: 'drop-bounce', title: 'Drop and bounce, letters', seconds: 4.5, Scene: DropBounceScene },
  { name: 'flip-up', title: 'Flip up, words standing up', seconds: 4.5, Scene: FlipUpScene },
  { name: 'arc-swing', title: 'Arc swing, words about their baseline', seconds: 4.5, Scene: ArcSwingScene },
  { name: 'scatter-assemble', title: 'Scatter assemble, letters fly into the line', seconds: 4.5, Scene: ScatterAssembleScene },
  { name: 'from-lens', title: 'From the lens, depth arrival', seconds: 4.5, Scene: FromLensScene },
  { name: 'smear-in', title: 'Smear in, whip-pan words', seconds: 4, Scene: SmearInScene },
];
