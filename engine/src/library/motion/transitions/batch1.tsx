// The wipes: push, feather, iris, clock, door split, blinds, panel and dip to colour. Each demo is one change of
// scene: an outgoing "before" on the stage's page and an incoming "after" on the brand's other page.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useBrand } from '../../../kit/brand';
import { useMotion } from '../../../kit/motion';
import type { StageName } from '../../../kit/tokens';
import { Blinds } from '../../../kit/transitions/Blinds';
import { ClockWipe } from '../../../kit/transitions/ClockWipe';
import { DipToColour } from '../../../kit/transitions/DipToColour';
import { DoorSplit } from '../../../kit/transitions/DoorSplit';
import { FeatherWipe } from '../../../kit/transitions/FeatherWipe';
import { IrisWipe } from '../../../kit/transitions/IrisWipe';
import { PanelWipe } from '../../../kit/transitions/PanelWipe';
import { PushWipe } from '../../../kit/transitions/PushWipe';
import { Panel, useVh } from '../../../kit/ui';
import { Arrive, Card, Centre, Line, row } from '../parts';
import type { FormatName, SizedDemo } from '../sized';

type Props = { page: StageName; format: FormatName };
const otherPage = (page: StageName): StageName => (page === 'light' ? 'dark' : 'light');
/** Small labels are 3.6% of the frame's height: the studio's minimum is 2.6% and a label's letters read smaller than its box. */
const LABEL = 3.6;
const tall = (format: FormatName) => format === '9:16';

/** Both scenes drift a little all the time, so neither is ever a still. Each has its own clock. */
const Drift: FC<{ children: ReactNode; way?: 1 | -1 }> = ({ children, way = 1 }) => {
  const m = useMotion();
  const vh = useVh();
  const style: CSSProperties = { translate: `${way * m.t * vh(0.7)}px 0` };
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

/** A scene: a small tag, a two-line headline and a tile with one number. `arrive` fades the outgoing one up at the start. */
const Story: FC<{ tag: string; lines: [string, string]; label: string; value: string; arrive?: boolean; format: FormatName }> = ({
  tag,
  lines,
  label,
  value,
  arrive = false,
  format,
}) => {
  const size = tall(format) ? 5.6 : 7.5;
  const at = (delay: number) => (arrive ? delay : undefined);
  return (
    <Drift>
      <Centre gap={3}>
        <Line voice="label" size={LABEL} colour="second" at={at(0.1)}>
          {tag}
        </Line>
        <Line size={size} at={at(0.25)}>
          {lines[0]}
        </Line>
        <Line size={size} colour="accent" at={at(0.35)} style={{ marginTop: `-${size * 0.4}vh` }}>
          {lines[1]}
        </Line>
        <Card at={at(0.55)} width={tall(format) ? 40 : 34}>
          <Line voice="label" size={LABEL} colour="second">
            {label}
          </Line>
          <Line voice="label" size={7.5} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Line>
        </Card>
      </Centre>
    </Drift>
  );
};

const Before: FC<{ format: FormatName }> = ({ format }) => (
  <Story tag="Before" lines={['Six tabs,', 'one order.']} label="Time to ship" value="14 min" arrive format={format} />
);
const After: FC<{ format: FormatName }> = ({ format }) => (
  <Story tag="After" lines={['One inbox,', 'all packed.']} label="Time to ship" value="3 min" format={format} />
);

const PushWipeScene: FC<Props> = ({ page, format }) => (
  <PushWipe at={2.2} side={tall(format) ? 'up' : 'left'} page={otherPage(page)} next={<After format={format} />}>
    <Before format={format} />
  </PushWipe>
);

const FeatherWipeScene: FC<Props> = ({ page, format }) => (
  <FeatherWipe at={2.2} side={tall(format) ? 'down' : 'right'} angle={18} page={otherPage(page)} next={<After format={format} />}>
    <Before format={format} />
  </FeatherWipe>
);

/** The outgoing scene has a button; the circle opens from it. */
const IrisWipeScene: FC<Props> = ({ page, format }) => {
  const brand = useBrand();
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const size = { width: vh(tall(format) ? 36 : 34), height: vh(9) };
  const target = { x: (width - size.width) / 2, y: height * (tall(format) ? 0.66 : 0.68), ...size };
  return (
    <IrisWipe
      at={2.2}
      from={{ x: target.x + size.width / 2, y: target.y + size.height / 2 }}
      page={otherPage(page)}
      next={<After format={format} />}
    >
      <Drift>
        <Centre gap={3} style={{ justifyContent: 'flex-start', paddingTop: height * (tall(format) ? 0.22 : 0.2) }}>
          <Line voice="label" size={LABEL} colour="second" at={0.1}>
            Before
          </Line>
          <Line size={tall(format) ? 5.6 : 7.5} at={0.25}>
            Six tabs,
          </Line>
          <Line size={tall(format) ? 5.6 : 7.5} colour="accent" at={0.35} style={{ marginTop: `-${(tall(format) ? 5.6 : 7.5) * 0.4}vh` }}>
            one order.
          </Line>
        </Centre>
      </Drift>
      <Arrive at={0.6} style={{ position: 'absolute', inset: 0 }}>
        <Panel
          name={otherPage(page)}
          style={{ position: 'absolute', left: target.x, top: target.y, ...size, ...row(0), borderRadius: vh(brand.shape.control) }}
        >
          <Line voice="label" size={3.8}>
            Pack it
          </Line>
        </Panel>
      </Arrive>
    </IrisWipe>
  );
};

const ClockWipeScene: FC<Props> = ({ page, format }) => (
  <ClockWipe at={2.1} page={otherPage(page)} next={<After format={format} />}>
    <Before format={format} />
  </ClockWipe>
);

const DoorSplitScene: FC<Props> = ({ page, format }) => (
  <DoorSplit at={2.2} axis={tall(format) ? 'horizontal' : 'vertical'} page={otherPage(page)} next={<After format={format} />}>
    <Before format={format} />
  </DoorSplit>
);

const BlindsScene: FC<Props> = ({ page, format }) => (
  <Blinds at={2.2} count={8} direction={tall(format) ? 'down' : 'right'} page={otherPage(page)} next={<After format={format} />}>
    <Before format={format} />
  </Blinds>
);

const PanelWipeScene: FC<Props> = ({ page, format }) => (
  <PanelWipe at={2.2} side={tall(format) ? 'up' : 'right'} trail page={otherPage(page)} next={<After format={format} />}>
    <Before format={format} />
  </PanelWipe>
);

const DipToColourScene: FC<Props> = ({ page, format }) => (
  <DipToColour at={2.2} colour="accent" page={otherPage(page)} next={<After format={format} />}>
    <Before format={format} />
  </DipToColour>
);

export const batch1: SizedDemo[] = [
  { name: 'push-wipe', title: 'Push wipe', seconds: 4.5, Scene: PushWipeScene },
  { name: 'feather-wipe', title: 'Feather wipe', seconds: 4.5, Scene: FeatherWipeScene },
  { name: 'iris-wipe', title: 'Iris wipe, from the button', seconds: 4.5, Scene: IrisWipeScene },
  { name: 'clock-wipe', title: 'Clock wipe', seconds: 4.5, Scene: ClockWipeScene },
  { name: 'door-split', title: 'Door split', seconds: 4.5, Scene: DoorSplitScene },
  { name: 'blinds', title: 'Blinds', seconds: 4.5, Scene: BlindsScene },
  { name: 'panel-wipe', title: 'Panel wipe, accent then the page', seconds: 4.5, Scene: PanelWipeScene },
  { name: 'dip-to-colour', title: 'Dip to colour', seconds: 4.5, Scene: DipToColourScene },
];


