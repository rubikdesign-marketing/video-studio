// Gallery scenes for the camera and the transitions. Each shows its move once, with cues in seconds. A scene that
// goes from one page to the other is told which page the gallery is on.
import type { CSSProperties, FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../../../kit/brand';
import { Camera, ContainerTransform, LightSweep, PushThrough, RelayScroll, SlideOffReveal, ZoomThroughSwap } from '../../../kit/moves';
import type { StageName } from '../../../kit/tokens';
import { Headline, Panel, useStage, useVh } from '../../../kit/ui';
import { Arrive, Card, Centre, Line, row, Tile } from '../parts';

type OnPage = { page: StageName };
const otherPage = (page: StageName): StageName => (page === 'light' ? 'dark' : 'light');
const fill: CSSProperties = { position: 'absolute', inset: 0 };

const TILES = [
  { label: 'Waiting', value: '12' },
  { label: 'Packed today', value: '128' },
  { label: 'Sent', value: '96' },
];
const TILE = { width: 34, gap: 4 };

/** The whole row for a moment, then one push to the tile the beat is about. */
export const CameraScene: FC = () => {
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const lastTile = { x: width / 2 + vh(TILE.width + TILE.gap), y: height / 2 };
  return (
    <Camera move="push" to={lastTile} at={1.3} scale={2.4}>
      <Centre>
        <Arrive at={0.2} style={row(vh(TILE.gap))}>
          {TILES.map((tile) => (
            <Tile key={tile.label} {...tile} width={TILE.width} />
          ))}
        </Arrive>
      </Centre>
    </Camera>
  );
};

/** A small card on the other page grows to be the frame, and its scene appears as it gets there. */
export const ContainerTransformScene: FC<OnPage> = ({ page }) => {
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const card = { width: vh(38), height: vh(20) };
  return (
    <>
      <Line at={0.3} out={1.5} size={6.5} style={{ position: 'absolute', left: 0, right: 0, top: height * 0.24, textAlign: 'center' }}>
        Pick up where you left off
      </Line>
      <ContainerTransform
        from={{ x: (width - card.width) / 2, y: height * 0.46, ...card }}
        at={1.5}
        page={otherPage(page)}
        card={
          <Line voice="label" size={3.6}>
            Orders
          </Line>
        }
      >
        <Centre>
          <Headline lines={['All your orders', 'in one view']} at={2.1} size={8} />
        </Centre>
      </ContainerTransform>
    </>
  );
};

/** A control on the other page is entered until its colour is the frame; the next scene is set on that colour. */
export const PushThroughScene: FC<OnPage> = ({ page }) => {
  const brand = useBrand();
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const size = { width: vh(40), height: vh(11) };
  const target = { x: (width - size.width) / 2, y: height * 0.56, ...size };
  const pushAt = 1.7;
  return (
    <PushThrough
      target={target}
      at={pushAt}
      page={otherPage(page)}
      next={
        <Centre>
          <Headline lines={['On its way']} at={0} size={10} />
        </Centre>
      }
    >
      <Arrive at={0.2} style={fill}>
        <Line size={6.5} style={{ position: 'absolute', left: 0, right: 0, top: height * 0.3, textAlign: 'center' }}>
          Send it in one click
        </Line>
        <Panel
          name={otherPage(page)}
          style={{ position: 'absolute', left: target.x, top: target.y, ...size, ...row(0), borderRadius: vh(brand.shape.control) }}
        >
          {/* The words go as the push begins, so what the camera enters is a plain shape. */}
          <Line voice="label" size={3.6} out={pushAt}>
            Send
          </Line>
        </Panel>
      </Arrive>
    </PushThrough>
  );
};

const Step: FC<{ number: number; title: string; at?: number }> = ({ number, title, at }) => (
  <Centre gap={2}>
    <Line voice="label" size={3} colour="second" at={at}>
      Step {number}
    </Line>
    <Line size={8} at={at}>
      {title}
    </Line>
  </Centre>
);

export const RelayScrollScene: FC = () => (
  <RelayScroll at={1.9} reach={0.62} next={<Step number={2} title="Share your link" />}>
    <Step number={1} title="Add your products" at={0.3} />
  </RelayScroll>
);

export const ZoomThroughSwapScene: FC = () => {
  const vh = useVh();
  return (
    <ZoomThroughSwap
      at={1.9}
      next={
        <Centre>
          <Card width={84}>
            <Line voice="label" size={3} colour="second">
              Orders this month
            </Line>
            <Line voice="label" size={16} style={{ fontVariantNumeric: 'tabular-nums' }}>
              1,840
            </Line>
          </Card>
        </Centre>
      }
    >
      <Centre>
        <Arrive at={0.2} style={row(vh(TILE.gap))}>
          {TILES.map((tile) => (
            <Tile key={tile.label} {...tile} width={TILE.width} />
          ))}
        </Arrive>
      </Centre>
    </ZoomThroughSwap>
  );
};

const DONE = ['Packed', 'Label printed', 'Collected by the courier'];

/** A finished order leaves to the left, and the title of the next section is already beneath it. */
export const SlideOffRevealScene: FC = () => (
  <SlideOffReveal
    at={1.9}
    next={
      <Centre>
        <Line size={8}>Next, getting paid</Line>
      </Centre>
    }
  >
    <Centre>
      <Card at={0.2} width={96}>
        <Line size={5}>Order 1042</Line>
        {DONE.map((step) => (
          <Line key={step} voice="label" size={3.2} colour="second">
            {step}
          </Line>
        ))}
      </Card>
    </Centre>
  </SlideOffReveal>
);

/** A card in the accent colour, and one band of light across it as it is revealed. */
export const LightSweepScene: FC = () => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  return (
    <Centre>
      <Arrive at={0.2}>
        <LightSweep at={0.9}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: vh(1.6),
              boxSizing: 'border-box',
              width: vh(96),
              padding: vh(5),
              borderRadius: vh(brand.shape.window),
              background: stage.accent,
            }}
          >
            <Line size={6.5} colour="onAccent">
              Your shop is live
            </Line>
            <Line voice="label" size={3.2} colour="onAccent">
              Three orders already
            </Line>
          </div>
        </LightSweep>
      </Arrive>
    </Centre>
  );
};
