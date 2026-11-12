// Perspective lines: a quiet floor of solid lines running to one vanishing point, with cross lines that come slowly
// towards the viewer. The floor fades out towards the horizon, where a little haze of light sits.
import type { FC } from 'react';
import { alpha } from '../tokens';
import { Fill, mix, pool, useBackdrop, type TreatmentProps } from './shared';

/** Where the horizon lies, as a share of frame height. */
const HORIZON = 0.63;
/** Lines running away from the viewer on each side of the middle one, and how far apart they are at the bottom edge, in % of frame height. */
const RUNNERS = 16;
const GAP = 17;
/** Cross lines on the floor, and how many of the gaps between them pass the bottom edge each second at "alive". */
const CROSSES = 16;
const PACE = 0.06;

export const PerspectiveLines: FC<TreatmentProps> = ({ energy = 'rest', seed = 1, over = false }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height, vh, thin, t } = b;
  const horizon = height * HORIZON;
  const floor = height - horizon;
  const middle = width / 2;

  // Cross lines are evenly spaced in depth, so they bunch up towards the horizon. As one leaves past the bottom
  // edge the next takes its place, and the farthest arrives where the floor is still faded out.
  const step = (t * PACE + b.phase(0)) % 1;
  const crosses = Array.from({ length: CROSSES }, (_, i) => horizon + floor / (i + 1 - step)).filter((y) => y < height + thin);

  // The floor is strongest at the bottom edge and gone a little before the horizon.
  const fade = `linear-gradient(to bottom, ${alpha(stage.page, 0)} ${(HORIZON + 0.02) * 100}%, ${alpha(stage.page, 0.45)} ${(HORIZON + 0.1) * 100}%, ${alpha(stage.page, 0.8)} ${(HORIZON + 0.2) * 100}%, ${stage.page} 100%)`;
  // On a light page the line colour is almost the page, so the floor is drawn a good way nearer the ink.
  const floorLine = dark ? stage.line : mix(stage.line, stage.ink, 0.24);
  const haze = dark
    ? [pool(stage.accent, 0.16, middle + b.drift(1, 8), horizon, width * 0.5, height * 0.2), pool(stage.soft, 0.8, middle + b.drift(2, 14), horizon, width * 0.7, height * 0.45)]
    : [pool(b.bright, 0.9, middle + b.drift(1, 8), horizon, width * 0.55, height * 0.3), pool(stage.soft, 0.6, middle + b.drift(2, 14), horizon + vh(6), width * 0.7, height * 0.4)];
  return (
    <Fill colour={over ? undefined : stage.page} layers={haze}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        stroke={floorLine}
        strokeWidth={thin}
        style={{ position: 'absolute', inset: 0, maskImage: fade, WebkitMaskImage: fade }}
      >
        {Array.from({ length: RUNNERS * 2 + 1 }, (_, i) => (
          <line key={i} x1={middle} y1={horizon} x2={middle + (i - RUNNERS) * vh(GAP)} y2={height} />
        ))}
        {crosses.map((y, i) => (
          <line key={i} x1={0} y1={y} x2={width} y2={y} />
        ))}
      </svg>
    </Fill>
  );
};
