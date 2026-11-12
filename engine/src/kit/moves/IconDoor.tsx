// Icon door: an icon tile sits in front of a miniature of a screen; the camera pushes through as the tile slides
// away, and the miniature is the screen. Run backwards, the screen shrinks to a card and the tile slides back
// over it. For entering and leaving an app or a feature.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, lerp, progress, useMotion } from '../motion';
import { alpha, type StageName } from '../tokens';
import { Panel, useStage, useVh } from '../ui';
import { centreOf, MotionBlur, useTravel, type Rect } from './core';

/** How far the tile slides, in tile widths: far enough to clear the frame by the time the screen fills it. */
const SLIDE = 1.2;
/** On the way back the tile waits for this share of the move, until the screen is a card again, before it slides in. */
const RETURNS = 0.35;
/** The shadow under the tile and the miniature: drop and blur as percentages of frame height, then strength. */
const SHADOW = { drop: 1, blur: 3, strength: 0.25 } as const;

/**
 * `tile` is where the icon tile sits (pixels in the frame) and `icon` is what it shows, in the middle of it. The
 * children are the screen behind the door: they are laid out at full size from the start and shown small, the
 * width of the tile, hidden behind it; nothing is swapped. Their clock starts at 0 on `at`, so the screen builds
 * while the camera travels.
 *
 * From `at` the camera pushes through over a `base` and a `quick` (about 600 ms): the tile slides off to the
 * right, speeding up, as the miniature grows to fill the frame and loses its round corners. With `back`, the
 * camera pulls out again from that time over a `scene` and a `tick` (about 850 ms): the screen shrinks to a card,
 * then to the tile's size, and the tile slides back over it and slows into place.
 *
 * `around` is the rest of the menu the tile belongs to. The camera passes it on the way in, and it is gone
 * within a `quick` length, before the push has enlarged it; on the way back it returns from the edges of the
 * frame. `page` paints the screen in the brand's other page if the feature lives there.
 */
export const IconDoor: FC<{
  children: ReactNode;
  icon: ReactNode;
  tile: Rect;
  at: number;
  back?: number;
  around?: ReactNode;
  page?: StageName;
}> = ({ children, icon, tile, at, back, around, page }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const travel = useTravel();
  const { width, height, fps } = useVideoConfig();
  const opens = m.seconds('base') + m.seconds('quick');
  const closes = m.seconds('scene') + m.seconds('tick');
  const returned = (t: number) => (back === undefined ? 0 : progress(t, back, back + closes, easing.travel));
  // How far through the door the camera is: 0 at the menu, 1 inside the screen.
  const through = (t: number) => progress(t, at, at + opens, easing.travel) * (1 - returned(t));
  // The tile slides away speeding up. It comes back slowing down, and only once the screen has shrunk to a card.
  const slid = (t: number) =>
    back !== undefined && t >= back ? 1 - progress(t, back + closes * RETURNS, back + closes) : progress(t, at, at + opens, easing.leave);

  const small = tile.width / width;
  const home = centreOf(tile);
  const middle = { x: width / 2, y: height / 2 };
  const p = through(m.t);
  // The camera's push grows by a constant factor, not a constant amount: one steady move inwards.
  const zoomAt = (t: number) => small ** -through(t);
  const zoom = zoomAt(m.t);
  const centre = { x: lerp(home.x, middle.x, p), y: lerp(home.y, middle.y, p) };
  const shown = small * zoom;
  const round = vh(brand.shape.window);
  const shadow = (strength: number, size: number) =>
    `0 ${vh(SHADOW.drop) / size}px ${vh(SHADOW.blur) / size}px ${alpha(stage.shade, SHADOW.strength * strength)}`;

  const tileLeftAt = (t: number) => slid(t) * SLIDE * tile.width * zoomAt(t);
  const gone = progress(m.t, at, at + m.seconds('quick'), easing.leave);
  const cameBack = back === undefined ? 0 : progress(m.t, back + closes - m.seconds('base'), back + closes, easing.travel);
  const aroundShown = Math.max(1 - gone, cameBack);
  const startsOn = Math.round(at * fps);
  const screen = (
    <Sequence from={startsOn} layout="none">
      {children}
    </Sequence>
  );
  return (
    <>
      {around && aroundShown > 0 ? (
        <AbsoluteFill
          style={{ transformOrigin: `${home.x}px ${home.y}px`, translate: `${centre.x - home.x}px ${centre.y - home.y}px`, scale: `${zoom}`, opacity: aroundShown }}
        >
          {around}
        </AbsoluteFill>
      ) : null}
      {m.t >= at ? (
        // The screen, at full size and shown small: it is drawn once and only its scale changes.
        <div
          style={{
            position: 'absolute',
            left: centre.x - width / 2,
            top: centre.y - height / 2,
            width,
            height,
            scale: `${shown}`,
            overflow: 'hidden',
            borderRadius: (round * (1 - p)) / shown,
            background: stage.page,
            boxShadow: p < 1 ? `0 0 0 ${1 / shown}px ${stage.line}, ${shadow(1 - p, shown)}` : undefined,
          }}
        >
          {page ? (
            <Panel name={page} style={{ position: 'absolute', inset: 0 }}>
              {screen}
            </Panel>
          ) : (
            screen
          )}
        </div>
      ) : null}
      {slid(m.t) < 1 ? (
        <MotionBlur fill x={travel(tileLeftAt)}>
          <div
            style={{
              position: 'absolute',
              left: centre.x - tile.width / 2 + tileLeftAt(m.t),
              top: centre.y - tile.height / 2,
              width: tile.width,
              height: tile.height,
              scale: `${zoom}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: round,
              background: stage.soft,
              boxShadow: `0 0 0 1px ${stage.line}, ${shadow(1, 1)}`,
            }}
          >
            {icon}
          </div>
        </MotionBlur>
      ) : null}
    </>
  );
};
