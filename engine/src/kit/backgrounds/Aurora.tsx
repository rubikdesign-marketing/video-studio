// Aurora: slow drifting ribbons of the accent and second colours across the top and the foot of the frame, with the
// middle left clear. All the ribbons sit in one layer and share a single blur.
import { useId, type FC } from 'react';
import { alpha } from '../tokens';
import { Fill, pool, px, useBackdrop, type TreatmentProps } from './shared';

/**
 * Each ribbon: its colour role, where it lies and how thick it is as shares of frame height, and its strength on a dark and a
 * light page. With their rise and fall they keep to the top quarter and the bottom fifth of the frame, clear of a headline.
 */
const RIBBONS = [
  { role: 'accent', y: 0.09, thick: 0.16, dark: 0.6, light: 0.3 },
  { role: 'second', y: 0.16, thick: 0.07, dark: 0.3, light: 0.24 },
  { role: 'accent', y: 0.93, thick: 0.14, dark: 0.45, light: 0.22 },
] as const;

/** How a ribbon's strength changes along its length: it fades in, dips once and fades out. Share of the width, then strength. */
const ALONG: [number, number][] = [
  [0, 0],
  [0.24, 1],
  [0.58, 0.55],
  [0.84, 0.9],
  [1, 0],
];

const STEPS = 40;
const TURN = Math.PI * 2;

export const Aurora: FC<TreatmentProps> = ({ energy = 'rest', seed = 1, over = false }) => {
  const b = useBackdrop(energy, seed);
  // Names the gradients of this one background, so two on the same page do not share them.
  const id = useId();
  const { stage, dark, width, height, vh, t } = b;
  // The ribbons run past both sides of the frame, so their ends are never seen.
  const from = -width * 0.1;
  const span = width * 1.2;

  const ribbons = RIBBONS.map((ribbon, i) => {
    const upper: string[] = [];
    const lower: string[] = [];
    for (let step = 0; step <= STEPS; step++) {
      const u = step / STEPS;
      // Two waves travel along the ribbon in opposite directions at different paces, so its shape never comes round again.
      const middle =
        ribbon.y + 0.042 * Math.sin(u * TURN * 0.9 + t * 0.3 + b.phase(i * 3)) + 0.022 * Math.sin(u * TURN * 1.7 - t * 0.22 + b.phase(i * 3 + 1));
      const half = (ribbon.thick / 2) * (0.65 + 0.35 * Math.sin(u * TURN * 1.3 + t * 0.25 + b.phase(i * 3 + 2)));
      const x = Math.round(from + span * u);
      upper.push(`${x} ${Math.round((middle - half) * height * 100) / 100}`);
      lower.unshift(`${x} ${Math.round((middle + half) * height * 100) / 100}`);
    }
    return { ...ribbon, d: `M${[...upper, ...lower].join(' L')} Z` };
  });

  // A broad wash of the soft fill behind the upper ribbons gives them something to sit in.
  const wash = pool(stage.soft, dark ? 0.55 : 0.4, width * 0.5 + b.drift(12, 16), 0, width * 0.75, height * 0.7);
  return (
    <Fill colour={over ? undefined : stage.page} layers={[wash]}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: `blur(${px(vh(3.4))})` }}>
        <defs>
          {ribbons.map((ribbon, i) => (
            <linearGradient key={i} id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1={from} y1={0} x2={from + span} y2={0}>
              {ALONG.map(([at, strength]) => (
                <stop key={at} offset={at} stopColor={alpha(stage[ribbon.role], (dark ? ribbon.dark : ribbon.light) * strength)} />
              ))}
            </linearGradient>
          ))}
        </defs>
        {ribbons.map((ribbon, i) => (
          <path key={i} d={ribbon.d} fill={`url(#${id}-${i})`} />
        ))}
      </svg>
    </Fill>
  );
};
