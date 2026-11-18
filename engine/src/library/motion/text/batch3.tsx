// Text batch 3: typing and decoding. Letters that are typed, retyped, streamed, scrambled, flipped, rolled, pixelated,
// glitched or shuffled into place.
import type { FC } from 'react';
import { Anagram } from '../../../kit/type/Anagram';
import { DrumRoll } from '../../../kit/type/DrumRoll';
import { GlitchIn } from '../../../kit/type/GlitchIn';
import { HumanType } from '../../../kit/type/HumanType';
import { PixelDecode } from '../../../kit/type/PixelDecode';
import { Retype } from '../../../kit/type/Retype';
import { ScrambleLock } from '../../../kit/type/ScrambleLock';
import { SplitFlap } from '../../../kit/type/SplitFlap';
import { StreamAnswer } from '../../../kit/type/StreamAnswer';
import type { SizedDemo } from '../sized';
import { Centre } from '../parts';

const HumanTypeScene: FC = () => (
  <Centre>
    <HumanType lines={['Plan your week', 'in a *minute*']} at={0.4} out={4.6} size={9} />
  </Centre>
);

const RetypeScene: FC = () => (
  <Centre>
    <Retype text="Reports in hours" to="Reports in minutes" at={0.4} out={5.3} size={9} />
  </Centre>
);

const StreamAnswerScene: FC = () => (
  <Centre>
    <StreamAnswer lines={['Three invoices are overdue, worth $12,400. Two are more than 30 days late.', 'Want me to send *reminders*?']} at={0.5} out={5.4} size={4.6} />
  </Centre>
);

const ScrambleLockScene: FC = () => (
  <Centre>
    <ScrambleLock lines={['Every deal,', '*decoded*']} order="centre" at={0.4} out={4} size={10} />
  </Centre>
);

const SplitFlapScene: FC = () => (
  <Centre>
    <SplitFlap lines={['Ships by Friday']} at={0.4} out={4} size={11} />
  </Centre>
);

const DrumRollScene: FC = () => (
  <Centre>
    <DrumRoll lines={['Find your *rhythm*']} at={0.4} out={4} size={10} />
  </Centre>
);

const PixelDecodeScene: FC = () => (
  <Centre>
    <PixelDecode lines={['Every number,', 'in *focus*']} at={0.4} out={3.6} size={10} />
  </Centre>
);

const GlitchInScene: FC = () => (
  <Centre>
    <GlitchIn lines={['Break the', '*routine*']} at={0.4} out={3.6} size={11} />
  </Centre>
);

const AnagramScene: FC = () => (
  <Centre>
    <Anagram text="Ship faster" at={0.4} out={4.6} size={11} />
  </Centre>
);

export const batch3: SizedDemo[] = [
  { name: 'human-type', title: 'Human type', seconds: 5.5, Scene: HumanTypeScene },
  { name: 'retype', title: 'Retype', seconds: 6, Scene: RetypeScene },
  { name: 'stream-answer', title: 'Stream answer', seconds: 6, Scene: StreamAnswerScene },
  { name: 'scramble-lock', title: 'Scramble lock, from the centre', seconds: 4.5, Scene: ScrambleLockScene },
  { name: 'split-flap', title: 'Split flap', seconds: 4.5, Scene: SplitFlapScene },
  { name: 'drum-roll', title: 'Drum roll', seconds: 4.5, Scene: DrumRollScene },
  { name: 'pixel-decode', title: 'Pixel decode', seconds: 4, Scene: PixelDecodeScene },
  { name: 'glitch-in', title: 'Glitch in', seconds: 4, Scene: GlitchInScene },
  { name: 'anagram', title: 'Anagram', seconds: 5.2, Scene: AnagramScene },
];
