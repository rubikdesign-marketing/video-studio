// Text emphasis moves, batch 4: a word or phrase in a line that is already on screen is picked out at its own cue.
// Each demo fades the line in plainly, lets it be read, then lands the emphasis.
import type { FC, ReactNode } from 'react';
import { ColourFront } from '../../../kit/type/ColourFront';
import { GradientInk } from '../../../kit/type/GradientInk';
import { Highlighter } from '../../../kit/type/Highlighter';
import { LetterWave } from '../../../kit/type/LetterWave';
import { MarkWord } from '../../../kit/type/MarkWord';
import { PayoffPunch } from '../../../kit/type/PayoffPunch';
import { Shimmer } from '../../../kit/type/Shimmer';
import { VoiceSwap } from '../../../kit/type/VoiceSwap';
import { WeightWave } from '../../../kit/type/WeightWave';
import { Arrive, Centre } from '../parts';
import type { SizedDemo } from '../sized';

/** The plain line arrives and leaves; the move under test is the only other thing that happens. */
const Plain: FC<{ children: ReactNode; leave?: number }> = ({ children, leave = 4.1 }) => (
  <Centre>
    <Arrive at={0.3} out={leave}>
      {children}
    </Arrive>
  </Centre>
);

const BOTH: ('ink' | 'second')[] = ['ink', 'ink'];

const HighlighterScene: FC = () => (
  <Plain>
    <Highlighter lines={['Invoices that', 'chase themselves']} mark="chase themselves" colours={BOTH} at={1.4} out={3.9} size={9} />
  </Plain>
);

const MarkBoxScene: FC = () => (
  <Plain>
    <MarkWord lines={['Your whole team,', 'one shared inbox']} mark="shared" kind="box" colours={BOTH} at={1.4} out={3.9} size={9} />
  </Plain>
);

const MarkStrikeScene: FC = () => (
  <Plain>
    <MarkWord lines={['Was $49 a month,', 'now just $19']} mark="$49" kind="strike" colours={BOTH} at={1.4} out={3.9} size={9} />
  </Plain>
);

const MarkBracketScene: FC = () => (
  <Plain>
    <MarkWord lines={['Month-end reports in', 'under 3 minutes']} mark="3 minutes" kind="bracket" colours={BOTH} at={1.4} out={3.9} size={9} />
  </Plain>
);

const MarkUnderlineScene: FC = () => (
  <Plain>
    <MarkWord lines={['Support that answers', 'before you ask']} mark="before you ask" kind="underline" colours={BOTH} at={1.4} out={3.9} size={9} />
  </Plain>
);

const ShimmerScene: FC = () => (
  <Plain leave={4.3}>
    <Shimmer lines={['Introducing the', 'Studio plan']} mark="Studio plan" colours={BOTH} at={1.3} size={9} />
  </Plain>
);

const ColourFrontScene: FC = () => (
  <Plain>
    <ColourFront lines={['Built for teams', 'that ship every week']} mark="ship every week" colours={BOTH} at={1.3} out={3.7} size={9} />
  </Plain>
);

const GradientInkScene: FC = () => (
  <Plain leave={4.4}>
    <GradientInk lines={['Analytics that feel', 'effortless']} mark="effortless" colours={BOTH} at={1.2} size={10} />
  </Plain>
);

const PayoffPunchScene: FC = () => (
  <Plain>
    <PayoffPunch lines={['Plan the week.', 'Ship by Friday.']} mark="Friday." colours={BOTH} at={1.5} out={3.8} size={9} />
  </Plain>
);

const WeightShiftScene: FC = () => (
  <Plain>
    <WeightWave lines={['Fast. Simple.', 'Entirely yours.']} mark="Entirely" mode="shift" colours={BOTH} at={1.4} out={3.7} size={9} />
  </Plain>
);

const WeightRippleScene: FC = () => (
  <Plain>
    <WeightWave lines={['Everything you need,', 'nothing you do not']} mark="Everything" mode="wave" colours={BOTH} at={1.4} out={3.7} size={9} />
  </Plain>
);

const LetterWaveScene: FC = () => (
  <Plain>
    <LetterWave lines={['Say hello to', 'faster checkout']} mark="faster" colours={BOTH} at={1.5} out={3.4} size={9} />
  </Plain>
);

const VoiceSwapScene: FC = () => (
  <Plain leave={4.2}>
    <VoiceSwap lines={['Finance, made', '*simple*']} colours={BOTH} at={1.5} out={3.6} size={10} />
  </Plain>
);

export const batch4: SizedDemo[] = [
  { name: 'highlighter', title: 'Highlighter, marker sweep', seconds: 4.6, Scene: HighlighterScene },
  { name: 'mark-word', title: 'Mark word, box', seconds: 4.6, Scene: MarkBoxScene },
  { name: 'mark-word-strike', title: 'Mark word, strike', seconds: 4.6, Scene: MarkStrikeScene },
  { name: 'mark-word-bracket', title: 'Mark word, brackets', seconds: 4.6, Scene: MarkBracketScene },
  { name: 'mark-word-underline', title: 'Mark word, underline', seconds: 4.6, Scene: MarkUnderlineScene },
  { name: 'shimmer', title: 'Shimmer, one pass', seconds: 4.6, Scene: ShimmerScene },
  { name: 'colour-front', title: 'Colour front, letter wave', seconds: 4.6, Scene: ColourFrontScene },
  { name: 'gradient-ink', title: 'Gradient ink, slow drift', seconds: 4.8, Scene: GradientInkScene },
  { name: 'payoff-punch', title: 'Payoff punch', seconds: 4.6, Scene: PayoffPunchScene },
  { name: 'weight-wave', title: 'Weight wave, shift to heavy', seconds: 4.6, Scene: WeightShiftScene },
  { name: 'weight-wave-ripple', title: 'Weight wave, ripple', seconds: 4.6, Scene: WeightRippleScene },
  { name: 'letter-wave', title: 'Letter wave, nudge', seconds: 4.4, Scene: LetterWaveScene },
  { name: 'voice-swap', title: 'Voice swap', seconds: 4.6, Scene: VoiceSwapScene },
];
