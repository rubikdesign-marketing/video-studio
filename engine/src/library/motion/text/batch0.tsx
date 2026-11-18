// The reference batch: the mask rise in its three units. Builders copy this file's shape for their own batch.
import type { FC } from 'react';
import { MaskRise } from '../../../kit/type';
import type { SizedDemo } from '../sized';
import { Centre } from '../parts';

const MaskRiseScene: FC = () => (
  <Centre>
    <MaskRise lines={['Every order,', 'in *one* place']} by="word" at={0.4} out={3.2} size={9} />
  </Centre>
);

const MaskRiseLettersScene: FC = () => (
  <Centre>
    <MaskRise lines="Ship it today" by="letter" order="centre" at={0.4} out={3.2} size={11} />
  </Centre>
);

const MaskRiseLinesScene: FC = () => (
  <Centre>
    <MaskRise lines={['Plan the week.', 'Ship the work.', 'Go home on time.']} by="line" at={0.4} out={3.6} size={7} />
  </Centre>
);

export const batch0: SizedDemo[] = [
  { name: 'mask-rise', title: 'Mask rise, word by word', seconds: 4, Scene: MaskRiseScene },
  { name: 'mask-rise-letters', title: 'Mask rise, letters from the centre', seconds: 4, Scene: MaskRiseLettersScene },
  { name: 'mask-rise-lines', title: 'Mask rise, line by line', seconds: 4.5, Scene: MaskRiseLinesScene },
];
