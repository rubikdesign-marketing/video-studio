// Paper: the calm light page. One soft light from the upper left, a faint cool bounce from the opposite corner, and
// almost nothing else. The fine grain is the Stage's own, laid over the top.
// Paper is the stage of the light page; its partner on the dark page is Night. Put on a dark page it still draws
// (one soft light, no accent), so a film never breaks, but the catalogue lists it for the light page only.
import type { FC } from 'react';
import { alpha } from '../tokens';
import { Fill, pool, useBackdrop, type BackgroundProps } from './shared';

export const Paper: FC<BackgroundProps> = ({ energy = 'rest', seed = 1 }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height } = b;
  const light = pool(
    dark ? stage.soft : b.bright,
    dark ? 0.75 : 0.9,
    width * 0.15 + b.drift(0, 12),
    height * 0.05 + b.drift(1, 9),
    height * (1.05 + 0.04 * b.sway(2) * b.reach),
  );
  const bounce = pool(stage.soft, dark ? 0.3 : 0.55, width * 0.92 + b.drift(3, 12), height + b.drift(4, 8), height * 0.75);
  // The side away from the light is a touch deeper. On a dark page the shade is the page, so this adds nothing.
  const away = `linear-gradient(135deg, ${alpha(stage.shade, 0)} 45%, ${alpha(stage.shade, 0.05)} 100%)`;
  return <Fill colour={stage.page} layers={[light, bounce, away]} />;
};
