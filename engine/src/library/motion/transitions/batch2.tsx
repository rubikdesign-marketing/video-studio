// The optical and camera transitions: blur through, exposure bloom, invert flash, whip pan, zoom blur, spin whip,
// parallax push and match cut. Each demo is one change of scene on one page: a headline into a product card, or a
// number into a chart. The text of each scene is read before the change and the next one settles before it ends.
import type { CSSProperties, FC, ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { BarGrow } from '../../../kit/moves';
import { alpha } from '../../../kit/tokens';
import { BlurThrough } from '../../../kit/transitions/BlurThrough';
import { ExposureBloom } from '../../../kit/transitions/ExposureBloom';
import { InvertFlash } from '../../../kit/transitions/InvertFlash';
import { MatchCut } from '../../../kit/transitions/MatchCut';
import { ParallaxPush } from '../../../kit/transitions/ParallaxPush';
import { SpinWhip } from '../../../kit/transitions/SpinWhip';
import { WhipPan } from '../../../kit/transitions/WhipPan';
import { ZoomBlur } from '../../../kit/transitions/ZoomBlur';
import { useStage, useVh } from '../../../kit/ui';
import { Arrive, Card, Centre, Line, row } from '../parts';
import type { SizedDemo } from '../sized';

/** A width in per cent of frame height that never takes more than 80% of the frame's width (tall frames). */
const useFit = () => {
  const { width, height } = useVideoConfig();
  return (wanted: number) => Math.min(wanted, (80 * width) / height);
};

/** Labels are never smaller than this, per cent of frame height (the studio's minimum is 2.6, and a label has no capitals to spare). */
const LABEL = 3.8;

/** A small stat card: a label and a number. Like the gallery's Tile, with a label that stays legible in every size. */
const StatCard: FC<{ label: string; value: string; width: number; flat?: boolean }> = ({ label, value, width, flat }) => {
  const fit = useFit();
  return (
    <Card width={fit(width)} flat={flat}>
      <Line voice="label" size={LABEL} colour="second">
        {label}
      </Line>
      <Line voice="label" size={7.5} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Line>
    </Card>
  );
};

const HeadlineScene: FC<{ lines: [string, string] }> = ({ lines }) => (
  <Centre gap={0.4}>
    <Line at={0.2} size={7}>
      {lines[0]}
    </Line>
    <Line at={0.3} size={7} colour="second">
      {lines[1]}
    </Line>
  </Centre>
);

/** A product card: a label and a big number. */
const NumberCard: FC<{ label: string; value: string }> = ({ label, value }) => {
  const fit = useFit();
  return (
    <Centre>
      <Card width={fit(62)}>
        <Line voice="label" size={LABEL} colour="second">
          {label}
        </Line>
        <Line voice="label" size={13} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Line>
      </Card>
    </Centre>
  );
};

const BIG = { label: 'Packed today', value: '128' };
const BARS = [0.42, 0.58, 0.5, 0.74, 0.92];

/** A chart card: five bars growing, the last one in the accent. */
const ChartCard: FC<{ label: string }> = ({ label }) => {
  const fit = useFit();
  const vh = useVh();
  return (
    <Centre>
      <Card width={fit(62)}>
        <Line voice="label" size={LABEL} colour="second">
          {label}
        </Line>
        <div style={{ ...row(vh(3.4)), alignItems: 'flex-end', height: vh(26), justifyContent: 'flex-start' }}>
          {BARS.map((share, i) => (
            <BarGrow key={i} share={share} at={0.05 + i * 0.04} length={26} thickness={Math.min(6.5, fit(62) / 9)} emphasis={i === BARS.length - 1} />
          ))}
        </div>
      </Card>
    </Centre>
  );
};

const BlurThroughScene: FC = () => (
  <BlurThrough at={1.7} next={<NumberCard label="Orders today" value="1,840" />}>
    <HeadlineScene lines={['Every order,', 'in one place.']} />
  </BlurThrough>
);

const ExposureBloomScene: FC = () => (
  <ExposureBloom at={1.5} next={<ChartCard label="Packed this week" />}>
    <Centre>
      <Arrive at={0.2}>
        <StatCard label={BIG.label} value={BIG.value} width={40} />
      </Arrive>
    </Centre>
  </ExposureBloom>
);

const InvertFlashScene: FC = () => (
  <InvertFlash at={1.5} next={<NumberCard label="Shipped on time" value="98%" />}>
    <HeadlineScene lines={['Late again?', 'Not this time.']} />
  </InvertFlash>
);

const WhipPanScene: FC = () => (
  <WhipPan at={1.5} next={<ChartCard label="Packed this week" />}>
    <Centre>
      <Arrive at={0.2}>
        <StatCard label={BIG.label} value={BIG.value} width={40} />
      </Arrive>
    </Centre>
  </WhipPan>
);

const ZoomBlurScene: FC = () => (
  <ZoomBlur at={1.6} next={<NumberCard label="Orders today" value="1,840" />}>
    <HeadlineScene lines={['Ready to ship?', 'Go.']} />
  </ZoomBlur>
);

const SpinWhipScene: FC = () => (
  <SpinWhip at={1.5} next={<HeadlineScene lines={['Shipped.', 'Next order.']} />}>
    <NumberCard label="Packed today" value="128" />
  </SpinWhip>
);

/** Soft discs and a card behind and in front of the headline, so there is depth to move. */
const Disc: FC<{ x: number; y: number; size: number }> = ({ x, y, size }) => {
  const stage = useStage();
  const vh = useVh();
  const style: CSSProperties = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    width: vh(size),
    height: vh(size),
    marginLeft: -vh(size) / 2,
    marginTop: -vh(size) / 2,
    borderRadius: '50%',
    background: alpha(stage.accent, 0.1),
    boxShadow: `0 0 0 1px ${stage.line}`,
  };
  return <div style={style} />;
};

const ParallaxPushScene: FC = () => {
  return (
    <ParallaxPush
      at={1.8}
      layers={[
        <div key="back" style={{ position: 'absolute', inset: 0 }}>
          <Disc x={20} y={30} size={40} />
          <Disc x={88} y={24} size={30} />
        </div>,
        <HeadlineScene key="mid" lines={['Every order,', 'in one place.']} />,
        <div key="front" style={{ position: 'absolute', right: '9%', bottom: '14%' }}>
          <Arrive at={0.5}>
            <StatCard label="Packed" value="128" width={26} flat />
          </Arrive>
        </div>,
      ]}
      next={<ChartCard label="Packed this week" />}
    />
  );
};

/** The disc in each scene of the match cut, in pixels of the frame. */
const useDiscs = () => {
  const { width, height } = useVideoConfig();
  const vh = useVh();
  const small = vh(10);
  const big = Math.min(vh(34), width * 0.7);
  return {
    from: { x: width * 0.5 - small / 2, y: height * 0.64 - small / 2, width: small, height: small },
    to: { x: width * 0.5 - big / 2, y: height * 0.46 - big / 2, width: big, height: big },
  };
};

const Disk: FC<{ rect: { x: number; y: number; width: number; height: number }; children?: ReactNode }> = ({ rect, children }) => {
  const stage = useStage();
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderRadius: '50%',
        background: stage.accent,
        color: stage.onAccent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
};

const MatchCutScene: FC = () => {
  const vh = useVh();
  const { from, to } = useDiscs();
  const { width, height } = useVideoConfig();
  return (
    <MatchCut
      at={1.7}
      from={from}
      to={to}
      next={
        <>
          <Disk rect={to}>
            <Line voice="label" size={Math.min(9, (to.width / height) * 21)} colour="onAccent" style={{ fontVariantNumeric: 'tabular-nums' }}>
              1,840
            </Line>
          </Disk>
          <div style={{ position: 'absolute', left: 0, width, top: height * 0.46 + to.height / 2 + vh(4), display: 'flex', justifyContent: 'center' }}>
            <Line voice="label" size={LABEL} colour="second">
              orders shipped
            </Line>
          </div>
        </>
      }
    >
      <div style={{ position: 'absolute', left: 0, width, top: height * 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Line at={0.2} size={7}>
          Order placed.
        </Line>
        <Line at={0.3} size={7} colour="second">
          Now ship it.
        </Line>
      </div>
      <Arrive at={0.5} style={{ position: 'absolute', inset: 0 }}>
        <Disk rect={from} />
      </Arrive>
    </MatchCut>
  );
};

export const batch2: SizedDemo[] = [
  { name: 'blur-through', title: 'Blur through', seconds: 4, Scene: BlurThroughScene },
  { name: 'exposure-bloom', title: 'Exposure bloom', seconds: 4.2, Scene: ExposureBloomScene },
  { name: 'invert-flash', title: 'Invert flash', seconds: 3.6, Scene: InvertFlashScene },
  { name: 'whip-pan', title: 'Whip pan', seconds: 3.8, Scene: WhipPanScene },
  { name: 'zoom-blur', title: 'Zoom blur', seconds: 4, Scene: ZoomBlurScene },
  { name: 'spin-whip', title: 'Spin whip', seconds: 3.8, Scene: SpinWhipScene },
  { name: 'parallax-push', title: 'Parallax push', seconds: 4.2, Scene: ParallaxPushScene },
  { name: 'match-cut', title: 'Match cut', seconds: 4, Scene: MatchCutScene },
];
