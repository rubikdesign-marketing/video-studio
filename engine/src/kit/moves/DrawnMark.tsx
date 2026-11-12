// Drawn mark: an underline or a ring drawn around its child in the accent colour. Emphasis without adding text.
import type { CSSProperties, FC, ReactNode } from 'react';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useStage, useVh } from '../ui';

/**
 * The ring, as a hand draws one. It is squarer than an ellipse so it clears the corners of what it goes round;
 * it starts up and to the left, runs a little more than once round, and widens as it goes, so its end passes
 * outside its start and does not meet it. A slow wave keeps it from being a perfect curve.
 */
const RING = {
  /** How square the loop is: 2 is an ellipse, more is squarer. */
  square: 2.7,
  /** Where the pen starts, in turns clockwise from three o'clock. */
  start: -0.36,
  /** How far round it goes, in turns. */
  round: 1.07,
  /** How much wider the loop is by its end. */
  widen: 0.09,
  /** The wave: its height as a share of the loop, and how many there are in one turn. */
  wave: 0.012,
  waves: 2,
  /** Room between the child and the loop on each side, as a percentage of the child's width and height, plus a share of frame height. */
  room: 17,
  roomVh: 0.8,
  /** It is tipped a little. Degrees. */
  tilt: -2,
  /** Straight pieces the loop is drawn with. */
  pieces: 180,
} as const;

/** The loop in a box 100 by 100, up to `drawn` (0 to 1) of its length, as a path. Its end is cut square. */
const ringPath = (drawn: number) => {
  const last = drawn * RING.pieces;
  const point = (piece: number) => {
    const along = piece / RING.pieces;
    const angle = (RING.start + RING.round * along) * Math.PI * 2;
    const reach = 50 * (1 + RING.widen * along + RING.wave * Math.sin(along * RING.round * RING.waves * Math.PI * 2));
    const bend = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / RING.square);
    return `${(50 + reach * bend(Math.cos(angle))).toFixed(2)} ${(50 + reach * bend(Math.sin(angle))).toFixed(2)}`;
  };
  const points = Array.from({ length: Math.floor(last) + 1 }, (_, piece) => point(piece));
  if (last > Math.floor(last)) points.push(point(last));
  return `M ${points.join(' L ')}`;
};

/**
 * Wraps one word, number or control and draws a mark on it at `at`: an underline from left to right in a `quick`
 * length, or a ring in a `base` length (it is three times the stroke). `weight` is the thickness of the stroke
 * and `gap` the space between the child and an underline, both as percentages of frame height. The child itself
 * never moves.
 */
export const DrawnMark: FC<{
  children: ReactNode;
  at: number;
  out?: number;
  kind?: 'underline' | 'ring';
  weight?: number;
  gap?: number;
  style?: CSSProperties;
}> = ({ children, at, out, kind = 'underline', weight = 0.55, gap = 0.4, style }) => {
  const m = useMotion();
  const stage = useStage();
  const vh = useVh();
  const quick = m.seconds('quick');
  const drawn = progress(m.t, at, at + (kind === 'ring' ? m.seconds('base') : quick), easing.travel);
  const exit = out === undefined ? 0 : progress(m.t, out, out + quick * EXIT_SHARE, easing.leave);
  const stroke = vh(weight);
  const mark: CSSProperties = { position: 'absolute', pointerEvents: 'none', opacity: 1 - exit };
  return (
    <span style={{ position: 'relative', display: 'inline-block', ...style }}>
      {children}
      {drawn <= 0 ? null : kind === 'underline' ? (
        <span
          style={{
            ...mark,
            left: 0,
            right: 0,
            top: '100%',
            marginTop: vh(gap),
            height: stroke,
            background: stage.accent,
            clipPath: `inset(0 ${(1 - drawn) * 100}% 0 0 round ${stroke / 2}px)`,
          }}
        />
      ) : (
        // The loop is drawn in a square of 100 and stretched over the child; the stroke keeps its thickness.
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            ...mark,
            left: `calc(${-RING.room}% - ${vh(RING.roomVh)}px)`,
            top: `calc(${-RING.room}% - ${vh(RING.roomVh)}px)`,
            width: `calc(${100 + RING.room * 2}% + ${vh(RING.roomVh) * 2}px)`,
            height: `calc(${100 + RING.room * 2}% + ${vh(RING.roomVh) * 2}px)`,
            overflow: 'visible',
            rotate: `${RING.tilt}deg`,
          }}
        >
          <path
            d={ringPath(drawn)}
            fill="none"
            stroke={stage.accent}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </span>
  );
};
