// Tile reveal: the frame is a grid of tiles, and a wave runs across it from one corner, turning each tile over to
// show its piece of the next scene. For a change of set: a new collection, a new month, a new board.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import { Sheet } from './sheet';

/** A tile is about this share of the frame's shorter side; the grid has whole tiles in both directions. */
const TILE = 1 / 5.5;
/** Each tile stands this many tile-widths from the camera as it turns. */
const LENS = 5;
/** At its edge-on moment a tile is this much smaller, so the turning tiles part and the grid is seen. */
const DIP = 0.14;
/** How dark a tile is when edge-on. */
const SHADE = 0.3;
/** Both scenes drift this much in scale through the wave: the outgoing grows, the incoming settles. */
const DRIFT = 0.03;

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/**
 * The children are the outgoing scene; `next` is the incoming, with its clock starting at 0 on `at`. From `at`
 * a wave crosses the grid diagonally from `from` (top left by default) over a `scene` length; each tile turns
 * over about its upright axis in a `base` length, so the whole reveal takes about 1.15 s. A tile shows its piece
 * of the outgoing scene until it is edge-on and its piece of the next scene after. The grid is sized from the
 * frame (about five and a half tiles on the short side), so a tall frame has more rows, not taller tiles. Tiles
 * dip a little as they turn, with round corners, so the grid shows for a moment and is gone. The outgoing scene
 * grows slightly as it goes and the next one settles from slightly larger: both are moving while tiles swap.
 */
export const TileReveal: FC<{ children: ReactNode; next: ReactNode; at: number; from?: Corner }> = ({ children, next, at, from = 'top-left' }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const wave = m.seconds('scene');
  const turn = m.seconds('base');
  const startsOn = Math.round(at * fps);
  const endsOn = Math.round((at + wave + turn) * fps);
  const whole = progress(m.t, at, at + wave + turn, easing.travel);
  const settle = progress(m.t, at, at + wave + turn + m.seconds('base'), easing.arrive);
  const incoming = (
    <Sequence from={startsOn} layout="none">
      <AbsoluteFill style={{ scale: `${1 + DRIFT * (1 - settle)}` }}>{next}</AbsoluteFill>
    </Sequence>
  );
  if (frame < startsOn) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (frame >= endsOn) return <AbsoluteFill>{incoming}</AbsoluteFill>;

  const short = Math.min(width, height);
  const cols = Math.max(2, Math.round(width / (TILE * short)));
  const rows = Math.max(2, Math.round(height / (TILE * short)));
  const w = width / cols;
  const h = height / rows;
  const flipX = from.endsWith('right');
  const flipY = from.startsWith('bottom');
  const outgoing = <AbsoluteFill style={{ scale: `${1 + DRIFT * whole}` }}>{children}</AbsoluteFill>;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // How far along the wave this tile is, 0 at the starting corner and 1 at the opposite one.
      const along = ((flipX ? cols - 1 - c : c) + (flipY ? rows - 1 - r : r)) / (cols + rows - 2);
      const start = at + along * wave;
      const p = progress(m.t, start, start + turn, easing.travel);
      const angle = 180 * p;
      const front = angle < 90;
      const lifted = Math.sin(Math.PI * p);
      const scale = 1 - DIP * lifted;
      const edgeOn = Math.abs(Math.sin((angle * Math.PI) / 180));
      tiles.push(
        <Sheet
          key={`${r}-${c}`}
          cut={{ x: c * w, y: r * h, width: w + 0.5, height: h + 0.5 }}
          style={{
            transform: `perspective(${LENS * w}px) scale(${scale}) rotateY(${front ? angle : angle - 180}deg)`,
            borderRadius: vh(brand.shape.control) * 1.5 * lifted,
          }}
        >
          {front ? outgoing : incoming}
          {edgeOn > 0.01 ? <AbsoluteFill style={{ background: alpha(stage.shade, SHADE * edgeOn) }} /> : null}
        </Sheet>,
      );
    }
  }
  return <AbsoluteFill>{tiles}</AbsoluteFill>;
};
