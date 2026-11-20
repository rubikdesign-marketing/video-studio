// Gallery scenes for the moves where one thing becomes the next: a shape morph, an interface component through its
// states, an object carried through every scene, particles that re-form, live controls, and a flood from a control.
// Each shows its move once, with cues in seconds. Colours and type come from the brand; the words are plain.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { useBrand } from '../../../kit/brand';
import { Carrier, Flood, MorphChain, ParticleForm, ShapeMorph, SliderDrag, TabIndicator, ToggleFlip, toggleKnob, useFullStop } from '../../../kit/moves';
import { voiceStyle } from '../../../kit/moves/core';
import { rng } from '../../../kit/motion';
import type { StageName } from '../../../kit/tokens';
import { Cursor, useStage, useVh } from '../../../kit/ui';
import { Arrive, Centre, Line } from '../parts';

const useFrame = () => {
  const { width, height } = useVideoConfig();
  const vh = useVh();
  const box = (cx: number, cy: number, w: number, h: number) => ({ x: cx - w / 2, y: cy - h / 2, width: w, height: h });
  return { width, height, vh, box, cx: width / 2, cy: height / 2 };
};

/** A plain line of text that takes its colour from what it sits on (the inside of a morphing component). */
const Inside: FC<{ children: ReactNode; size?: number; style?: CSSProperties }> = ({ children, size = 3.4, style }) => {
  const brand = useBrand();
  const vh = useVh();
  return <div style={{ ...voiceStyle(brand.fonts.label, vh(size)), whiteSpace: 'pre', ...style }}>{children}</div>;
};

// ---------------------------------------------------------------- shape morph

/** A square becomes a line, a star, a hexagon and a rounded tile: each morph 0.4 s, each hold about 0.4 s. */
export const ShapeMorphScene: FC = () => {
  const { vh, box, cx, cy } = useFrame();
  const brand = useBrand();
  return (
    <ShapeMorph
      keys={[
        { at: 0.3, shape: { kind: 'square', rect: box(cx, cy, vh(24), vh(24)) } },
        { at: 1.1, shape: { kind: 'pill', rect: box(cx, cy, vh(70), vh(5)) } },
        { at: 1.9, shape: { kind: 'star', rect: box(cx, cy, vh(36), vh(36)) }, fill: 'ink' },
        { at: 2.7, shape: { kind: 'polygon', sides: 6, rect: box(cx, cy, vh(32), vh(32)) }, fill: 'ink' },
        { at: 3.5, shape: { kind: 'rect', radius: vh(brand.shape.window), rect: box(cx, cy, vh(44), vh(28)) } },
      ]}
    />
  );
};

// ---------------------------------------------------------------- morph chain

const CHAIN = { search: 0.3, results: 1.4, sent: 2.5, tracking: 3.6, loop: 4.7 };

/** One box through four states, each change caused by a click, and back to the first so the film loops. */
export const MorphChainScene: FC = () => {
  const { vh, cx, cy } = useFrame();
  const brand = useBrand();
  const stage = useStage();
  const row = (text: string, sub: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', width: vh(78), padding: `${vh(1.8)}px 0`, borderBottom: `1px solid ${stage.line}` }}>
      <Inside size={4.4}>{text}</Inside>
      <Inside size={4.4} style={{ color: stage.second }}>
        {sub}
      </Inside>
    </div>
  );
  return (
    <>
      <MorphChain
        loop={CHAIN.loop}
        states={[
          { at: CHAIN.search, width: 60, height: 15, fill: 'ink', content: <Inside size={5}>Find order 1042</Inside> },
          {
            at: CHAIN.results,
            width: 92,
            height: 50,
            radius: brand.shape.window,
            fill: 'soft',
            click: true,
            content: (
              <div>
                {row('Order 1042', 'Packed')}
                {row('Bowls, set of 4', '2 items')}
                {row('Send today', 'By 4 pm')}
              </div>
            ),
          },
          { at: CHAIN.sent, width: 44, height: 15, fill: 'accent', click: true, content: <Inside size={5}>Order sent</Inside> },
          { at: CHAIN.tracking, width: 80, height: 15, fill: 'ink', content: <Inside size={5}>On its way, arriving Friday</Inside> },
        ]}
      />
      <Cursor
        from={{ x: cx + vh(70), y: cy + vh(40) }}
        moves={[
          { to: { x: cx + vh(18), y: cy + vh(2) }, at: CHAIN.results, click: true },
          { to: { x: cx + vh(28), y: cy + vh(16) }, at: CHAIN.sent, click: true },
        ]}
        out={CHAIN.tracking}
      />
    </>
  );
};

// ---------------------------------------------------------------- carrier

const SCENES = { one: 0, two: 1.5, three: 3.0, four: 4.4 };
const CLOSING = 'Carried through.';
const CLOSING_SIZE = 11;

/**
 * Four scenes with hard cuts between them, and one accent square carried through all of them: it arrives beside a
 * line, becomes the knob of a toggle (and flips with it), becomes the highlighted bar of a chart, and lands as the
 * full stop of the closing line, measured from that line's own type.
 */
export const CarrierScene: FC = () => {
  const { vh, box, cx, cy } = useFrame();
  const brand = useBrand();
  const { fps } = useVideoConfig();
  const knobH = vh(9);
  const toggle = { x: cx, y: cy + vh(6) };
  const bars = [0.45, 0.7, 0.95, 0.6];
  const barW = vh(9);
  const barsLeft = cx - (bars.length * barW + (bars.length - 1) * vh(4)) / 2;
  const barRect = (i: number) => ({ x: barsLeft + i * (barW + vh(4)), y: cy + vh(22) - vh(40) * bars[i], width: barW, height: vh(40) * bars[i] });
  const size = vh(CLOSING_SIZE);
  const top = cy - (size * (brand.fonts.headline.lineHeight ?? 1.2)) / 2;
  const closing = useFullStop(CLOSING, 'headline', size, cx, top, 'center');
  const scene = (from: number, to: number, children: ReactNode) => (
    <Sequence from={Math.round(from * fps)} durationInFrames={Math.round((to - from) * fps)}>
      {children}
    </Sequence>
  );
  const anchors = {
    start: box(cx + vh(40), cy, vh(10), vh(10)),
    knobOff: toggleKnob(toggle.x, toggle.y, knobH, false),
    knobOn: toggleKnob(toggle.x, toggle.y, knobH, true),
    bar: barRect(2),
    stop: closing?.stop ?? box(cx, cy, vh(2), vh(2)),
  };
  const knobRadius = Math.min(knobH / 2, vh(brand.shape.pill)) * 0.76;
  return (
    <>
      {scene(SCENES.one, SCENES.two, (
        <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: vh(22) }}>
          <Line at={0.1} size={9}>
            One idea
          </Line>
        </AbsoluteFill>
      ))}
      {scene(SCENES.two, SCENES.three, (
        <>
          <Centre style={{ paddingBottom: vh(24) }}>
            <Line at={0.05} voice="label" size={4} colour="second">
              Switch it on
            </Line>
          </Centre>
          <ToggleFlip x={toggle.x} y={toggle.y} size={9} flips={[0.82]} hideKnob />
        </>
      ))}
      {scene(SCENES.three, SCENES.four, (
        <>
          {bars.map((_, i) =>
            i === 2 ? null : (
              <Arrive key={i} at={0.05} style={{ position: 'absolute', left: barRect(i).x, top: barRect(i).y, width: barW, height: barRect(i).height }}>
                <BarFill />
              </Arrive>
            ),
          )}
          <Centre style={{ paddingTop: vh(62) }}>
            <Line at={0.1} voice="label" size={3.4} colour="second">
              The week it took off
            </Line>
          </Centre>
        </>
      ))}
      {scene(SCENES.four, 6, (
        <div style={{ position: 'absolute', left: closing?.left ?? cx, top }}>
          <Line at={0.05} size={CLOSING_SIZE}>
            Carried through<span style={{ color: 'transparent' }}>.</span>
          </Line>
        </div>
      ))}
      <Carrier
        anchors={anchors}
        keys={[
          { at: 0.35, anchor: 'start', shape: { kind: 'square' } },
          { at: SCENES.two + 0.15, anchor: 'knobOff', shape: { kind: 'rect', radius: knobRadius }, fill: 'page' },
          { at: SCENES.two + 0.82 + 0.18, anchor: 'knobOn', shape: { kind: 'rect', radius: knobRadius }, fill: 'page', join: 0.18 },
          { at: SCENES.three + 0.15, anchor: 'bar', shape: { kind: 'rect', radius: vh(0.6) } },
          { at: SCENES.four + 0.15, anchor: 'stop', shape: { kind: 'square' }, fill: 'ink' },
        ]}
      />
    </>
  );
};

/** A bar of the chart, in the stage's line colour. */
const BarFill: FC = () => {
  const stage = useStage();
  const vh = useVh();
  return <div style={{ position: 'absolute', inset: 0, background: stage.line, borderRadius: vh(0.6) }} />;
};

// ---------------------------------------------------------------- particle form

/** The same 900 orders as units, then as places, then as the total, then as the four weeks of the month. */
export const ParticleFormScene: FC = () => {
  const { vh, box, cx, cy } = useFrame();
  const r = rng(11);
  const places = Array.from({ length: 25 }, () => ({ x: cx + (r() - 0.5) * vh(140), y: cy + (r() - 0.5) * vh(56) }));
  const weeks = [0.5, 0.75, 1, 0.65];
  const bw = vh(12);
  const gap = vh(5);
  const left = cx - (weeks.length * bw + (weeks.length - 1) * gap) / 2;
  const d = weeks.map((h, i) => `M ${left + i * (bw + gap)} ${cy + vh(20)} h ${bw} v ${-vh(44) * h} h ${-bw} Z`).join(' ');
  return (
    <>
      <ParticleForm
        means="900 orders: as units, by place, as the month's total, then by week"
        count={900}
        size={0.8}
        forms={[
          { at: 0.2, form: { kind: 'grid', rect: box(cx, cy, vh(62), vh(62)), cols: 30, rows: 30 } },
          { at: 1.6, form: { kind: 'points', points: places } },
          { at: 3.0, form: { kind: 'text', text: '900', size: 34 } },
          { at: 4.6, form: { kind: 'path', d, rect: box(cx, cy, vh(63), vh(44)) } },
        ]}
      />
      <Centre style={{ paddingTop: vh(78) }}>
        <Line at={0.3} out={1.5} voice="label" size={3.2} colour="second">
          Orders this month
        </Line>
      </Centre>
      <Centre style={{ paddingTop: vh(78) }}>
        <Line at={3.9} voice="label" size={3.2} colour="second">
          {'Orders this month, by week'}
        </Line>
      </Centre>
    </>
  );
};

// ---------------------------------------------------------------- live controls

/** A toggle clicked twice: the knob crosses in 0.18 s and the track fills with the accent as it goes. */
export const ToggleFlipScene: FC = () => {
  const { vh, cx, cy } = useFrame();
  return (
    <>
      <Centre style={{ paddingBottom: vh(34) }}>
        <Line at={0.1} voice="label" size={5} colour="second">
          Save as you type
        </Line>
      </Centre>
      <ToggleFlip x={cx} y={cy + vh(6)} size={20} flips={[1.2, 2.5]} at={0.1} />
      <Cursor
        from={{ x: cx + vh(60), y: cy + vh(36) }}
        moves={[
          { to: { x: cx + vh(4), y: cy + vh(9) }, at: 1.2, click: true },
          { to: { x: cx + vh(8), y: cy + vh(11) }, at: 2.5, click: true },
        ]}
      />
    </>
  );
};

/** A slider dragged to the middle, then past its end: the thumb stretches, the hand lets go, the thumb springs back. */
export const SliderDragScene: FC = () => {
  const { vh, cx, cy } = useFrame();
  return (
    <>
      <Centre style={{ paddingBottom: vh(30) }}>
        <Line at={0.1} voice="label" size={5} colour="second">
          Volume
        </Line>
      </Centre>
      <SliderDrag x={cx - vh(55)} y={cy + vh(8)} length={110} size={1.6} start={0.15} at={0.1} keys={[{ at: 1.5, value: 0.55 }, { at: 2.7, value: 1.3 }]} />
    </>
  );
};

/** A tab indicator that stretches towards each new tab and then catches up. */
export const TabIndicatorScene: FC = () => {
  const { cx, cy } = useFrame();
  return (
    <TabIndicator
      tabs={['Day', 'Week', 'Month', 'Year']}
      x={cx}
      y={cy}
      tabWidth={30}
      height={11}
      at={0.1}
      keys={[
        { at: 0.1, index: 0 },
        { at: 1.0, index: 2 },
        { at: 2.0, index: 1 },
        { at: 2.9, index: 3 },
      ]}
    />
  );
};

// ---------------------------------------------------------------- flood

const FLOOD = { click: 1.1, flood: 1.3, contract: 3.5 };

/** A toggle is clicked; its knob floods the frame with the other page; the next line arrives; the page contracts into a card. */
export const FloodScene: FC<{ page: StageName }> = ({ page }) => {
  const { vh, cx, cy, box } = useFrame();
  const { fps } = useVideoConfig();
  const other: StageName = page === 'light' ? 'dark' : 'light';
  const toggle = { x: cx, y: cy + vh(4), size: 12 };
  return (
    <>
      <Sequence durationInFrames={Math.round((FLOOD.flood + 0.4) * fps)}>
        <Centre style={{ paddingBottom: vh(26) }}>
          <Line at={0.1} voice="label" size={4} colour="second">
            Night shift
          </Line>
        </Centre>
        <ToggleFlip x={toggle.x} y={toggle.y} size={toggle.size} flips={[FLOOD.click]} at={0.1} />
        <Cursor from={{ x: cx + vh(60), y: cy + vh(36) }} moves={[{ to: { x: cx + vh(2), y: cy + vh(6) }, at: FLOOD.click, click: true }]} />
      </Sequence>
      <Flood from={toggleKnob(toggle.x, toggle.y, vh(toggle.size), true)} at={FLOOD.flood} page={other} contract={{ at: FLOOD.contract, to: box(cx, cy, vh(80), vh(45)), radius: 3 }}>
        <Centre>
          <Line at={0} size={10}>
            Same film, new page.
          </Line>
        </Centre>
      </Flood>
    </>
  );
};
