// Night: the dark page with slow pools of the brand's soft fill and its accent, like light in a dark room.
// Night is the stage of the dark page; its partner on the light page is Paper. Put on a light page it still draws
// (a pale wash of the same colours), so a film never breaks, but the catalogue lists it for the dark page only.
import type { FC } from 'react';
import { Fill, pool, useBackdrop, type BackgroundProps } from './shared';

/** Each pool: where it rests as a share of the frame, its radius as a share of frame height, its strength on a dark and a light page, and how far it wanders in % of frame height. */
const POOLS = [
  { role: 'soft', x: 0.2, y: 0.14, radius: 0.95, dark: 0.9, light: 0.85, travel: 13 },
  { role: 'soft', x: 0.86, y: 0.94, radius: 0.8, dark: 0.7, light: 0.6, travel: 13 },
  { role: 'accent', x: 0.76, y: 0.16, radius: 0.55, dark: 0.24, light: 0.1, travel: 16 },
  { role: 'accent', x: 0.08, y: 0.98, radius: 0.5, dark: 0.14, light: 0.06, travel: 16 },
] as const;

export const Night: FC<BackgroundProps> = ({ energy = 'rest', seed = 1 }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height } = b;
  const layers = POOLS.map((p, i) => {
    // The accent pools also grow and fade a little, far too slowly to read as a pulse; the soft ones only drift.
    const breath = p.role === 'accent' ? 1 + 0.1 * b.sway(i + 8) * b.reach : 1;
    return pool(
      stage[p.role],
      (dark ? p.dark : p.light) * breath,
      width * p.x + b.drift(i * 2, p.travel),
      height * p.y + b.drift(i * 2 + 1, p.travel * 0.7),
      height * p.radius * (1 + 0.05 * b.sway(i + 4) * b.reach),
    );
  });
  // The accent pools are listed last and must sit on top.
  return <Fill colour={stage.page} layers={layers.reverse()} />;
};
