// Gallery scenes for emphasis on a product screen and for data. Each shows its move once, with cues in seconds.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../../../kit/brand';
import { useMotion } from '../../../kit/motion';
import { BarGrow, Count, CountWithBar, FocusPull, Lift, LineDraw, RingSweep, Stagger } from '../../../kit/moves';
import { voiceStyle } from '../../../kit/moves/core';
import { useStage, useVh } from '../../../kit/ui';
import { Arrive, Card, Centre, Line, row, Tile } from '../parts';

const TILES = [
  { label: 'Waiting', value: '12' },
  { label: 'Packed today', value: '128' },
  { label: 'Sent', value: '96' },
];

export const FocusPullScene: FC = () => {
  const vh = useVh();
  return (
    <Centre>
      <FocusPull keep={1} at={1.3} out={3.3} style={row(vh(4))}>
        {TILES.map((tile) => (
          <Tile key={tile.label} {...tile} at={0.2} />
        ))}
      </FocusPull>
    </Centre>
  );
};

export const LiftScene: FC = () => {
  const vh = useVh();
  return (
    <Centre>
      <Arrive at={0.2} style={row(vh(4))}>
        <Tile {...TILES[0]} />
        <Lift at={1.2} out={3}>
          <Tile {...TILES[1]} flat />
        </Lift>
        <Tile {...TILES[2]} />
      </Arrive>
    </Centre>
  );
};

const VIEWS = ['Orders', 'Customers', 'Invoices', 'Reports', 'Tasks', 'Files', 'Notes', 'Team'];

/** The views of an app arriving from the left, a column at a time. */
export const StaggerScene: FC = () => {
  const vh = useVh();
  return (
    <Centre>
      <Stagger at={0.5} out={3.6} from="left" columns={4} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: vh(3) }}>
        {VIEWS.map((view) => (
          <Card key={view} width={30}>
            <Line voice="label" size={3.2}>
              {view}
            </Line>
          </Card>
        ))}
      </Stagger>
    </Centre>
  );
};

export const CountWithBarScene: FC = () => (
  <Centre>
    <CountWithBar label="Orders packed today" value={128} max={160} at={0.4} width={72} size={18} />
  </Centre>
);

const DAYS = [
  { day: 'Mon', share: 0.34 },
  { day: 'Tue', share: 0.52 },
  { day: 'Wed', share: 0.44 },
  { day: 'Thu', share: 0.9 },
  { day: 'Fri', share: 0.62 },
];
/** The day the chart is about. */
const BEST_DAY = 'Thu';

/** A week of orders: the baseline is there first, the bars grow one after another, and the best day is in the accent. */
export const BarGrowScene: FC = () => {
  const m = useMotion();
  const stage = useStage();
  const vh = useVh();
  return (
    <Centre gap={5}>
      <Line voice="label" size={3} colour="second" at={0.2}>
        Orders this week
      </Line>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: vh(5), padding: `0 ${vh(4)}px`, borderBottom: `1px solid ${stage.line}` }}>
        {DAYS.map(({ day, share }, i) => (
          <BarGrow key={day} share={share} at={0.7 + i * m.stagger} length={42} thickness={9} emphasis={day === BEST_DAY} />
        ))}
      </div>
      <div style={row(vh(5))}>
        {DAYS.map(({ day }) => (
          <Line key={day} voice="label" size={2.8} colour="second" at={0.3} style={{ width: vh(9), textAlign: 'center' }}>
            {day}
          </Line>
        ))}
      </div>
    </Centre>
  );
};

/** How high each week sits in the chart, 0 at the baseline and 1 at the top. */
const WEEKS = [0.18, 0.3, 0.26, 0.48, 0.62, 0.86];

/** Six weeks of orders as one line. The baseline is there first; the value appears when the line arrives. */
export const LineDrawScene: FC = () => {
  const stage = useStage();
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const chart = { left: width * 0.24, right: width * 0.76, top: height * 0.3, bottom: height * 0.72 };
  const points = WEEKS.map((level, i) => ({
    x: chart.left + ((chart.right - chart.left) * i) / (WEEKS.length - 1),
    y: chart.bottom - (chart.bottom - chart.top) * level,
  }));
  const [first, second, ...rest] = points;
  return (
    <>
      <Line voice="label" size={3} colour="second" at={0.2} style={{ position: 'absolute', left: chart.left, top: chart.top - vh(11) }}>
        Orders, last six weeks
      </Line>
      <div style={{ position: 'absolute', left: chart.left, top: chart.bottom, width: chart.right - chart.left, borderTop: `1px solid ${stage.line}` }} />
      <LineDraw points={[first, second, ...rest]} at={0.7} curve label="480" />
    </>
  );
};

export const RingSweepScene: FC = () => {
  const { label } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  return (
    <Centre>
      <RingSweep share={0.72} at={0.6} size={44}>
        <div style={{ ...voiceStyle(label, vh(11)), lineHeight: 1, color: stage.ink }}>
          <Count value={72} at={0.6} />
          <span style={{ fontSize: '0.6em' }}>%</span>
        </div>
      </RingSweep>
      <Line voice="label" size={3} colour="second" at={0.2}>
        Invoices paid on time
      </Line>
    </Centre>
  );
};
