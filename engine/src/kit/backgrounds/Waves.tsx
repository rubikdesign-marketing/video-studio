// Waves: a few soft flowing lines across the foot of the frame, in the accent and second colours. Each is one solid
// line with a wide faint line under it for softness; there is no blur.
import { useId, type FC } from 'react';
import { alpha } from '../tokens';
import { Fill, pool, smoothPath, useBackdrop, type TreatmentProps } from './shared';

const LINES = 5;
const STEPS = 48;
const TURN = Math.PI * 2;

/** How a line's strength changes along its length: it fades in from one side and out at the other. Share of the width, then strength. */
const ALONG: [number, number][] = [
  [0, 0],
  [0.18, 1],
  [0.8, 1],
  [1, 0],
];

export const Waves: FC<TreatmentProps> = ({ energy = 'rest', seed = 1, over = false }) => {
  const b = useBackdrop(energy, seed);
  // Names the gradients of this one background, so two on the same page do not share them.
  const id = useId();
  const { stage, dark, width, height, vh, t } = b;
  const lines = Array.from({ length: LINES }, (_, i) => {
    const rest = height * (0.815 + 0.037 * i);
    const swing = vh(3 + 0.5 * i);
    const length = width * (1.1 + 0.16 * i);
    // Each line has its own pace, and even the quickest takes more than ten seconds to rise and fall once at "peak".
    const pace = 0.28 + 0.025 * i;
    const points = Array.from({ length: STEPS + 1 }, (_unused, step) => {
      const x = width * (-0.02 + (1.04 * step) / STEPS);
      const turn = (x / length) * TURN;
      return { x, y: rest + swing * (Math.sin(turn + t * pace + b.phase(i * 2)) + 0.35 * Math.sin(turn * 2.3 - t * pace * 0.7 + b.phase(i * 2 + 1))) };
    });
    // The accent and the second colour take turns; the lines nearer the foot of the frame are fainter.
    const colour = i % 2 === 0 ? stage.accent : stage.second;
    return { d: smoothPath(points), colour, strength: (dark ? 0.6 : 0.45) * (1 - 0.12 * i) };
  });

  const glow = pool(stage.soft, dark ? 0.7 : 0.5, width * 0.5 + b.drift(10, 16), height * 1.05, width * 0.7, height * 0.55);
  return (
    <Fill colour={over ? undefined : stage.page} layers={[glow]}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {lines.map((line, i) => (
            <linearGradient key={i} id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={width} y2={0}>
              {ALONG.map(([at, strength]) => (
                <stop key={at} offset={at} stopColor={alpha(line.colour, line.strength * strength)} />
              ))}
            </linearGradient>
          ))}
        </defs>
        {lines.map((line, i) => (
          <g key={i} stroke={`url(#${id}-${i})`}>
            <path d={line.d} strokeWidth={vh(1.5)} opacity={0.16} />
            <path d={line.d} strokeWidth={vh(0.2)} />
          </g>
        ))}
      </svg>
    </Fill>
  );
};
