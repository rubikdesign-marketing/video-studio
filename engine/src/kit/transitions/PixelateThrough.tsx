// Pixelate through: the scene breaks into ever bigger square blocks, the blocks change to the next scene's, and
// they shrink back until the next scene is sharp. For a change in a digital, playful or retro film.
// After gl-transitions "pixelize" by gre (MIT), redrawn with an SVG filter so it works on live scenes.
import { useId, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { easing, progress, useMotion } from '../motion';

/** The biggest block, at the middle of the move, as a share of the frame's shorter side. */
const BIGGEST = 1 / 11;
/** Blocks smaller than this many pixels are not drawn: the scene is shown as it is. */
const SMALLEST = 3;
/** The two scenes swap inside the blocks over this share of the move, around its middle, while the blocks are biggest. */
const SWAP = 0.24;
/** Both scenes drift this much in scale through the move: the outgoing grows, the incoming settles. */
const DRIFT = 0.04;

/**
 * An SVG filter that turns what it is on into square blocks `size` pixels wide: it keeps one pixel in the middle
 * of each block and spreads it over the block. `size` is an odd whole number, so the blocks tile exactly.
 */
const Blocks: FC<{ id: string; size: number }> = ({ id, size }) => {
  const r = (size - 1) / 2;
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }}>
      <filter id={id} x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood x={r} y={r} width={1} height={1} floodColor="#000" floodOpacity={1} />
        <feComposite x={0} y={0} width={size} height={size} />
        <feTile result="grid" />
        <feComposite in="SourceGraphic" in2="grid" operator="in" />
        <feMorphology operator="dilate" radius={r} />
      </filter>
    </svg>
  );
};

/**
 * The children are the outgoing scene; `next` is the incoming, with its clock starting at 0 on `at`. From `at`,
 * over a `scene` and a `quick` length (about 960 ms), blocks grow from nothing to about a ninth of the frame's
 * short side, even in ratio, and shrink again. While they are biggest (the middle quarter of the move) each block
 * changes from the outgoing scene's colour to the incoming's: no frame is empty and no edge is ever a fade across
 * the whole frame. The outgoing scene grows a little as it goes and the next settles from a little larger, so
 * both move at the swap. Block sizes are whole pixels, so the size steps from frame to frame by design.
 */
export const PixelateThrough: FC<{ children: ReactNode; next: ReactNode; at: number }> = ({ children, next, at }) => {
  const m = useMotion();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const id = `px${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const length = m.seconds('scene') + m.seconds('quick');
  const startsOn = Math.round(at * fps);
  const endsOn = Math.round((at + length) * fps);
  const p = progress(m.t, at, at + length, (x) => x);
  const settle = progress(m.t, at, at + length + m.seconds('base'), easing.arrive);
  const incoming = (
    <Sequence from={startsOn} layout="none">
      <AbsoluteFill style={{ scale: `${1 + DRIFT * (1 - settle)}` }}>{next}</AbsoluteFill>
    </Sequence>
  );
  if (frame < startsOn) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (frame >= endsOn) return <AbsoluteFill>{incoming}</AbsoluteFill>;

  // The blocks grow by a constant factor, not a constant amount, and shrink the same way: up to the middle and back.
  const biggest = BIGGEST * Math.min(width, height);
  const rise = easing.travel(1 - Math.abs(1 - 2 * p));
  const raw = Math.exp(Math.log(SMALLEST) + (Math.log(biggest) - Math.log(SMALLEST)) * rise);
  const size = raw < SMALLEST ? 0 : 2 * Math.floor(raw / 2) + 1;
  const mix = progress(p, 0.5 - SWAP / 2, 0.5 + SWAP / 2, easing.travel);
  const filter = size >= SMALLEST ? `url(#${id})` : undefined;
  return (
    <AbsoluteFill style={{ filter }}>
      {size >= SMALLEST ? <Blocks id={id} size={size} /> : null}
      {mix < 1 ? (
        <AbsoluteFill style={{ opacity: 1 - mix, scale: `${1 + DRIFT * p}` }}>{children}</AbsoluteFill>
      ) : null}
      {mix > 0 ? <AbsoluteFill style={{ opacity: mix }}>{incoming}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
