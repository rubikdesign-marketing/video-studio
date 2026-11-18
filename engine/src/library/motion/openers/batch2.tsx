// Hook openers, batch 2: strike out, question, glitch cut, spotlight, notification drop, whip in.
import type { FC } from 'react';
import { GlitchCut, NotificationDrop, Question, Spotlight, StrikeOut, WhipIn } from '../../../kit/openers';
import { Centre, Tile } from '../parts';
import type { SizedDemo } from '../sized';

const After: FC = () => (
  <Centre>
    <Tile label="Weekly report" value="3 min" at={0.05} />
  </Centre>
);

const OUT = 3.1;

const StrikeOutScene: FC = () => <StrikeOut old="Meetings keep us aligned" line="Status meetings block *Fridays*" at={0} out={OUT} next={<After />} />;
const QuestionScene: FC = () => <Question line="Can you merge two *workspaces?*" at={0} out={OUT} next={<After />} />;
const GlitchCutScene: FC = () => <GlitchCut line="Nobody edited this by *hand*" at={0} out={OUT} next={<After />} />;
const SpotlightScene: FC = () => <Spotlight line="Everyone is missing this *detail*" at={0} out={OUT} next={<After />} />;
const NotificationDropScene: FC = () => <NotificationDrop line="Queue at zero, *Friday*" when="now" at={0} out={OUT} next={<After />} />;
const WhipInScene: FC = () => <WhipIn line="Four spreadsheets to *one* board" at={0} out={OUT} next={<After />} />;

export const batch2: SizedDemo[] = [
  { name: 'opener-strike-out', title: 'Strike out', seconds: 3.8, Scene: StrikeOutScene },
  { name: 'opener-question', title: 'Question', seconds: 3.8, Scene: QuestionScene },
  { name: 'opener-glitch-cut', title: 'Glitch cut', seconds: 3.8, Scene: GlitchCutScene },
  { name: 'opener-spotlight', title: 'Spotlight', seconds: 3.8, Scene: SpotlightScene },
  { name: 'opener-notification-drop', title: 'Notification drop', seconds: 3.8, Scene: NotificationDropScene },
  { name: 'opener-whip-in', title: 'Whip in', seconds: 3.8, Scene: WhipInScene },
];
