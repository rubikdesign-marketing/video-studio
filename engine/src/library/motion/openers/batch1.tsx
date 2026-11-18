// Hook openers, batch 1: punch in, fill the frame, sudden stop, at the lens, number slam, split screen.
// Each demo opens on its hook line (a line from library/hooks/index.json) and hands over to a small product tile
// on its own clock from 0, so the hand-over is part of what is shown.
import type { FC } from 'react';
import { AtTheLens, FillFrame, NumberSlam, PunchIn, SplitScreen, SuddenStop } from '../../../kit/openers';
import { Centre, Tile } from '../parts';
import type { SizedDemo } from '../sized';

const After: FC = () => (
  <Centre>
    <Tile label="Weekly report" value="3 min" at={0.05} />
  </Centre>
);

const OUT = 3.1;

const PunchInScene: FC = () => <PunchIn line="Stop rebuilding the same *report*" at={0} out={OUT} next={<After />} />;
const FillFrameScene: FC = () => <FillFrame line="One button, *whole* report" at={0} out={OUT} next={<After />} />;
const SuddenStopScene: FC = () => <SuddenStop line="Your inbox, sorted by *Monday*" at={0} out={OUT} next={<After />} />;
const AtTheLensScene: FC = () => <AtTheLens line="Chases late payers for *you*" label="Weekly report" at={0} out={OUT} next={<After />} />;
const NumberSlamScene: FC = () => <NumberSlam from="3 hours" to="3 *minutes*" at={0} out={OUT} next={<After />} />;
const SplitScreenScene: FC = () => <SplitScreen line="Before and after, same *inbox*" before="Before" after="After" at={0} out={OUT} next={<After />} />;

export const batch1: SizedDemo[] = [
  { name: 'opener-punch-in', title: 'Punch in', seconds: 3.8, Scene: PunchInScene },
  { name: 'opener-fill-frame', title: 'Fill the frame', seconds: 3.8, Scene: FillFrameScene },
  { name: 'opener-sudden-stop', title: 'Sudden stop', seconds: 3.8, Scene: SuddenStopScene },
  { name: 'opener-at-the-lens', title: 'At the lens', seconds: 3.8, Scene: AtTheLensScene },
  { name: 'opener-number-slam', title: 'Number slam', seconds: 3.8, Scene: NumberSlamScene },
  { name: 'opener-split-screen', title: 'Split screen', seconds: 3.8, Scene: SplitScreenScene },
];
