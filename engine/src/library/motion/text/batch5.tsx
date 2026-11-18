// Text batch 5: the two short-form caption styles and eight layout and exit moves.
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { useBrand } from '../../../kit/brand';
import { CaptionBox, type SpokenWord } from '../../../kit/type/CaptionBox';
import { CaptionPop } from '../../../kit/type/CaptionPop';
import { ExitSet } from '../../../kit/type/ExitSet';
import { MakeRoom } from '../../../kit/type/MakeRoom';
import { OneWordStack } from '../../../kit/type/OneWordStack';
import { OnPath } from '../../../kit/type/OnPath';
import { RecentreBuild } from '../../../kit/type/RecentreBuild';
import { TextWindow } from '../../../kit/type/TextWindow';
import { Ticker } from '../../../kit/type/Ticker';
import { WordMorph } from '../../../kit/type/WordMorph';
import { alpha } from '../../../kit/tokens';
import { useStage } from '../../../kit/ui';
import type { SizedDemo } from '../sized';
import { Centre } from '../parts';

/** Words at an even pace from `from`, each lasting most of its slot: a stand-in for a transcript's timings. */
const spoken = (text: string, from: number, pace = 0.3): SpokenWord[] =>
  text.split(' ').map((word, i) => ({ text: word, start: from + i * pace, end: from + i * pace + pace * 0.85 }));

/** A dark picture standing in for footage, so captions are shown on what they are made for. */
const Footage: FC = () => {
  const { captions } = useBrand();
  return <AbsoluteFill style={{ background: `linear-gradient(160deg, ${captions.glassTop}, ${captions.glassBottom})` }} />;
};

const CaptionBoxScene: FC = () => (
  <>
    <Footage />
    <CaptionBox words={spoken('Send your first invoice in under a minute', 0.4)} out={3.9} />
  </>
);

const CaptionPopScene: FC = () => (
  <>
    <Footage />
    <CaptionPop words={spoken('Send your first invoice in under a minute', 0.4)} out={3.9} />
  </>
);

const OneWordScene: FC = () => (
  <OneWordStack lines="Pay *less* tax this year" at={0.4} out={2.6} size={17} pace={0.42} />
);

const RecentreScene: FC = () => (
  <Centre>
    <RecentreBuild lines={['Quotes, invoices and', '*payments* in one place']} at={0.3} out={3.7} size={7.5} />
  </Centre>
);

const MakeRoomScene: FC = () => (
  <Centre>
    <MakeRoom lines="Your team ships *twice* as fast" insert={3} at={0.3} insertAt={1.2} out={3.6} size={8} />
  </Centre>
);

const TickerScene: FC = () => (
  <Ticker lines={['Launch day', 'Free setup this week']} at={0.2} out={3.7} size={6.5} />
);

const OnPathScene: FC = () => (
  <OnPath lines="Made by hand in *Lisbon*" at={0.3} out={3.9} size={9} />
);

/** A picture made in the engine: a rich brand gradient, big soft shapes and a rising bar chart across the whole frame. */
const Picture: FC = () => {
  const stage = useStage();
  const bars = [0.3, 0.42, 0.36, 0.55, 0.48, 0.62, 0.57, 0.74, 0.68, 0.82, 0.9];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${stage.ink} 0%, ${stage.accent} 55%, ${stage.warm} 115%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '-25%', top: '-15%', width: '85%', aspectRatio: '1', borderRadius: '50%', background: alpha(stage.second, 0.55) }} />
      <div style={{ position: 'absolute', right: '-25%', bottom: '-10%', width: '90%', aspectRatio: '1', borderRadius: '50%', background: alpha(stage.warm, 0.8) }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '78%', display: 'flex', alignItems: 'flex-end', gap: '1.2%', padding: '0 3%' }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h * 100}%`, borderRadius: '12% 12% 0 0', background: alpha(stage.page, i === bars.length - 1 ? 0.95 : 0.6) }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const TextWindowScene: FC = () => (
  <TextWindow lines="OPEN" at={0.2} open={2.2} size={30}>
    <Picture />
  </TextWindow>
);

const WordMorphScene: FC = () => (
  <Centre>
    <WordMorph before="Reports in" lines={['*seconds*', 'minutes']} after="." at={0.3} swaps={[1.9]} out={3.7} size={9} />
  </Centre>
);

const ExitSetScene: FC = () => (
  <Centre gap={3}>
    <ExitSet kind="drop" lines="Sale ends tonight" at={0.2} out={1.9} size={8} />
    <ExitSet kind="wipe" lines="Free delivery on every order" at={0.5} out={3.1} size={6} colours={['second']} />
  </Centre>
);

export const batch5: SizedDemo[] = [
  { name: 'caption-box', title: 'Caption box, highlight moves word to word', seconds: 5, Scene: CaptionBoxScene },
  { name: 'caption-pop', title: 'Caption pop, the spoken word enlarged', seconds: 5, Scene: CaptionPopScene },
  { name: 'one-word-stack', title: 'One word stack', seconds: 4, Scene: OneWordScene },
  { name: 'recentre-build', title: 'Recentre build', seconds: 5, Scene: RecentreScene },
  { name: 'make-room', title: 'Make room', seconds: 4.5, Scene: MakeRoomScene },
  { name: 'ticker', title: 'Ticker', seconds: 4.5, Scene: TickerScene },
  { name: 'on-path', title: 'Text on a path', seconds: 4.5, Scene: OnPathScene },
  { name: 'text-window', title: 'Text window, then it opens', seconds: 5, Scene: TextWindowScene },
  { name: 'word-morph', title: 'Word morph', seconds: 4.5, Scene: WordMorphScene },
  { name: 'exit-set', title: 'Exit set: drop, then wipe', seconds: 4, Scene: ExitSetScene },
];
