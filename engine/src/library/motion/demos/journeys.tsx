// Gallery scenes for the moves that carry the viewer through a product: depth, a cut hidden in movement, an
// element shared by two layouts, the cursor leading the camera, and the icon that is a door. Each shows its move
// once, with cues in seconds.
import type { CSSProperties, FC } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useBrand } from '../../../kit/brand';
import { useMotion } from '../../../kit/motion';
import { CursorLead, IconDoor, MomentumCut, ParallaxCamera, Pressed, SharedElement } from '../../../kit/moves';
import { alpha } from '../../../kit/tokens';
import { Button, useStage, useVh } from '../../../kit/ui';
import { Arrive, Card, Centre, Line, row, Tile } from '../parts';

const fill: CSSProperties = { position: 'absolute', inset: 0 };

// ---------------------------------------------------------------- parallax camera

const BEHIND = [
  { label: 'Invoices sent', value: '24' },
  { label: 'Customers', value: '310' },
  { label: 'Reports', value: '8' },
  { label: 'Waiting', value: '12' },
  { label: 'Packed today', value: '128' },
  { label: 'Sent', value: '96' },
];
const PARALLAX = { at: 1.1, landed: 2.0 };

/**
 * The camera travels to the right across a workspace. The month's orders are the product plane; other tiles sit
 * far behind, soft; a control in the foreground crosses fastest, below what is read. The figure's note lands
 * after the camera has stopped.
 */
export const ParallaxCameraScene: FC = () => {
  const vh = useVh();
  const { width, height } = useVideoConfig();
  return (
    <ParallaxCamera
      at={PARALLAX.at}
      by={{ x: -0.2, y: 0 }}
      far={
        <Arrive at={0.2} style={fill}>
          {BEHIND.map((tile, i) => (
            <div key={tile.label} style={{ position: 'absolute', left: width * (0.05 + 0.34 * (i % 3)), top: height * (i < 3 ? 0.08 : 0.7) }}>
              <Tile {...tile} width={40} />
            </div>
          ))}
        </Arrive>
      }
      near={
        <Button at={0.4} emphasis style={{ position: 'absolute', left: width * 0.275, top: height * 0.77, fontSize: vh(3.4), padding: `${vh(2)}px ${vh(4)}px` }}>
          New order
        </Button>
      }
    >
      <Centre>
        <Card at={0.2} width={74}>
          <Line voice="label" size={3} colour="second">
            Orders this month
          </Line>
          <Line voice="label" size={15} style={{ fontVariantNumeric: 'tabular-nums' }}>
            1,840
          </Line>
          <Line voice="label" size={3} colour="accent" at={PARALLAX.landed}>
            Up 12% on last month
          </Line>
        </Card>
      </Centre>
    </ParallaxCamera>
  );
};

// ---------------------------------------------------------------- momentum cut

const TILES = [
  { label: 'Waiting', value: '12' },
  { label: 'Packed today', value: '128' },
  { label: 'Sent', value: '96' },
];

/** The whole row for a moment, then a cut to one tile close up. Both shots are moving the same way across the cut. */
export const MomentumCutScene: FC = () => {
  const vh = useVh();
  return (
    <MomentumCut
      at={1.6}
      to="left"
      next={
        <Centre>
          <Card width={104}>
            <Line voice="label" size={5} colour="second">
              Packed today
            </Line>
            <Line voice="label" size={26} style={{ fontVariantNumeric: 'tabular-nums' }}>
              128
            </Line>
          </Card>
        </Centre>
      }
    >
      <Centre>
        <Arrive at={0.2} style={row(vh(4))}>
          {TILES.map((tile) => (
            <Tile key={tile.label} {...tile} />
          ))}
        </Arrive>
      </Centre>
    </MomentumCut>
  );
};

// ---------------------------------------------------------------- shared element

const ROWS = [
  { order: 'Order 1041', state: 'Sent' },
  { order: 'Order 1042', state: 'Packed' },
  { order: 'Order 1043', state: 'Waiting' },
];
/** The row that becomes the card. */
const OPENED = 1;
const SHARED = { at: 1.5, landed: 2.2 };

/** A row of a list becomes the card of its order. The other rows go as it leaves; the card's details land after it has. */
export const SharedElementScene: FC = () => {
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const list = { x: width * 0.09, width: vh(64), height: vh(11), gap: vh(2.4) };
  const rowAt = (i: number) => ({ x: list.x, y: height * 0.56 + (i - 1) * (list.height + list.gap) - list.height / 2, width: list.width, height: list.height });
  const card = { x: width * 0.4, y: height * 0.17, width: vh(98), height: vh(58) };
  const inRow: CSSProperties = { ...fill, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${vh(3.4)}px` };
  const face = (i: number) => (
    <div style={inRow}>
      <Line voice="label" size={3.6}>
        {ROWS[i].order}
      </Line>
      <Line voice="label" size={3} colour="second">
        {ROWS[i].state}
      </Line>
    </div>
  );
  return (
    <>
      {ROWS.map((_, i) =>
        i === OPENED ? null : (
          <Card key={i} at={0.2} out={SHARED.at} style={{ position: 'absolute', left: rowAt(i).x, top: rowAt(i).y, width: list.width, height: list.height, padding: 0 }}>
            {face(i)}
          </Card>
        ),
      )}
      <Arrive at={0.2} style={fill}>
        <SharedElement
          from={rowAt(OPENED)}
          to={card}
          at={SHARED.at}
          before={face(OPENED)}
          after={
            <div style={{ ...fill, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: vh(2), padding: `0 ${vh(7)}px` }}>
              <Line voice="label" size={3.2} colour="second">
                {ROWS[OPENED].order}
              </Line>
              <Line size={9}>Packed and ready</Line>
              <Line voice="label" size={3.2} colour="accent" at={SHARED.landed}>
                The courier collects at 4 pm
              </Line>
            </div>
          }
        />
      </Arrive>
    </>
  );
};

// ---------------------------------------------------------------- cursor lead

const CLICK = 2.3;

/** The cursor crosses to the one control on the card and presses it; the camera follows late and lands with the click. */
export const CursorLeadScene: FC = () => {
  const m = useMotion();
  const vh = useVh();
  const { width, height, fps } = useVideoConfig();
  const card = { x: width / 2 - vh(40), y: height / 2 - vh(21), width: vh(80), height: vh(42) };
  const control = { x: card.x + vh(5), y: card.y + card.height - vh(11.5) };
  const button = { width: vh(28), height: vh(6.6) };
  const target = { x: control.x + button.width * 0.8, y: control.y + button.height * 0.66 };
  // The result follows one frame after the press.
  const done = m.t >= CLICK + 1 / fps;
  return (
    <CursorLead from={{ x: width * 0.16, y: height * 0.86 }} to={target} at={CLICK} scale={1.4}>
      <Card at={0.2} style={{ position: 'absolute', left: card.x, top: card.y, width: card.width, height: card.height, padding: vh(5), gap: vh(1.4) }}>
        <Line size={5.4}>Order 1042</Line>
        <Line voice="label" size={3} colour="second">
          Two items for Leeds
        </Line>
      </Card>
      <Pressed at={CLICK} style={{ position: 'absolute', left: control.x, top: control.y, transformOrigin: `${button.width / 2}px ${button.height / 2}px` }}>
        <Button at={0.5} emphasis={done} style={{ boxSizing: 'border-box', width: button.width, height: button.height, justifyContent: 'center', padding: 0, fontSize: vh(3) }}>
          {done ? 'Packed' : 'Mark as packed'}
        </Button>
      </Pressed>
    </CursorLead>
  );
};

// ---------------------------------------------------------------- icon door

const MENU = ['Invoices', 'Orders', 'Reports'] as const;
type MenuItem = (typeof MENU)[number];
/** Line drawings, in a square of 24: a parcel, a sheet and a chart. */
const DRAWN: Record<MenuItem, string> = {
  Orders: 'M4 8 L12 4 L20 8 L20 16 L12 20 L4 16 Z M4 8 L12 12 L20 8 M12 12 L12 20',
  Invoices: 'M7 3 H17 V21 H7 Z M10 8 H14 M10 12 H14 M10 16 H13',
  Reports: 'M5 20 V11 M12 20 V5 M19 20 V14',
};
const DOOR = { at: 1.1, back: 3.2 };
const SCREEN_ROWS = [
  { order: 'Order 1041', state: 'Sent' },
  { order: 'Order 1042', state: 'Packed' },
  { order: 'Order 1043', state: 'Waiting' },
];

const Drawing: FC<{ item: MenuItem; size: number }> = ({ item, size }) => {
  const stage = useStage();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stage.ink} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d={DRAWN[item]} />
    </svg>
  );
};

/**
 * A menu of three features. The camera goes through the middle tile into its screen, which builds as it arrives,
 * and later comes back out to the menu.
 */
export const IconDoorScene: FC = () => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const side = vh(30);
  const gap = vh(7);
  const tileAt = (i: number) => ({ x: width / 2 + (i - 1) * (side + gap) - side / 2, y: height / 2 - side / 2 - vh(3), width: side, height: side });
  const door = 1;
  const name = (i: number) => (
    <Line key={`name-${i}`} voice="label" size={3} style={{ position: 'absolute', left: tileAt(i).x, top: tileAt(i).y + side + vh(2.4), width: side, textAlign: 'center' }}>
      {MENU[i]}
    </Line>
  );
  return (
    <Arrive at={0.2} style={fill}>
      <IconDoor
        at={DOOR.at}
        back={DOOR.back}
        tile={tileAt(door)}
        icon={<Drawing item={MENU[door]} size={side * 0.42} />}
        around={
          <>
            {MENU.map((item, i) =>
              i === door ? null : (
                <div
                  key={item}
                  style={{
                    position: 'absolute',
                    left: tileAt(i).x,
                    top: tileAt(i).y,
                    width: side,
                    height: side,
                    ...row(0),
                    borderRadius: vh(brand.shape.window),
                    background: stage.soft,
                    boxShadow: `0 0 0 1px ${stage.line}, 0 ${vh(1)}px ${vh(3)}px ${alpha(stage.shade, 0.25)}`,
                  }}
                >
                  <Drawing item={item} size={side * 0.42} />
                </div>
              ),
            )}
            {MENU.map((_, i) => name(i))}
          </>
        }
      >
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: vh(2.6), padding: `0 ${width * 0.2}px` }}>
          <Line size={7.5} at={0.2} style={{ marginBottom: vh(1.6) }}>
            Orders
          </Line>
          {SCREEN_ROWS.map((item, i) => (
            <Card key={item.order} at={0.32 + i * 0.1} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: `${vh(3)}px ${vh(3.4)}px` }}>
              <Line voice="label" size={3.6}>
                {item.order}
              </Line>
              <Line voice="label" size={3} colour="second">
                {item.state}
              </Line>
            </Card>
          ))}
        </AbsoluteFill>
      </IconDoor>
    </Arrive>
  );
};
