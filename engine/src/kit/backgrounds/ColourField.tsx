// Colour field: the accent colour edge to edge. Two slow tones of the same colour move under it, one deeper and one
// lighter, and one large soft round shape rises from the lower right. Type on it takes the stage's onAccent colour.
import type { FC } from 'react';
import { alpha } from '../tokens';
import { useGrainShare } from '../ui';
import { Fill, mix, pool, px, useBackdrop, type BackgroundProps } from './shared';

// The light page's grain is set for a near-white page. Over the accent colour it is several times stronger and
// alone measured as movement, so this background takes only this share of it there. The dark page's grain is
// already fine for a mid-tone and is left alone.
const LIGHT_PAGE_GRAIN_SHARE = 0.2;

export const ColourField: FC<BackgroundProps> = ({ energy = 'rest', seed = 1 }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height, vh } = b;
  useGrainShare(dark ? 1 : LIGHT_PAGE_GRAIN_SHARE);
  // The accent of a dark page is already a light colour, so there its lighter tones are held back.
  const deeper = mix(stage.accent, stage.shade, 0.3);
  const lighter = mix(stage.accent, b.bright, dark ? 0.16 : 0.25);
  const shapeTone = mix(stage.accent, b.bright, dark ? 0.3 : 0.42);

  // The shape: flat inside, with an edge that falls away over the last third of its radius. It keeps to its
  // corner, clear of the middle of the frame, and moves less than the tones because it has an edge.
  const radius = vh(46) * (1 + 0.03 * b.sway(6) * b.reach);
  const centre = `${px(width * 0.93 + b.drift(4, 4))} ${px(height * 1.06 + b.drift(5, 3))}`;
  const edge = [
    [0.66, 0.5],
    [0.74, 0.45],
    [0.82, 0.31],
    [0.9, 0.14],
    [0.96, 0.04],
    [1, 0],
  ].map(([at, strength]) => `${alpha(shapeTone, strength)} ${px(radius * at)}`);
  const shape = `radial-gradient(circle at ${centre}, ${alpha(shapeTone, 0.5)} 0px, ${edge.join(', ')})`;

  const tones = [
    pool(lighter, 0.4, width * 0.78 + b.drift(0, 18), height * 0.06 + b.drift(1, 12), height * 0.95),
    pool(deeper, 0.75, width * 0.1 + b.drift(2, 18), height * 0.96 + b.drift(3, 12), height * 1.05),
  ];
  return <Fill colour={stage.accent} layers={[shape, ...tones]} />;
};
