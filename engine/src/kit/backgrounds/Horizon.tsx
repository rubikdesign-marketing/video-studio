// Horizon: an arc of light rising from the bottom edge, like the rim of a planet. Good for endings. Animate `rise`
// from 0 to 1 to bring it up; left alone it stays risen and breathes.
import type { FC } from 'react';
import { alpha } from '../tokens';
import { Fill, mix, pool, px, useBackdrop, type TreatmentProps } from './shared';

/** How high the top of the arc stands when fully risen, and the radius of the arc, as shares of the frame. */
const HEIGHT = 0.18;
const RADIUS = 1.35;

export const Horizon: FC<
  TreatmentProps & {
    /** 0 is below the bottom edge, 1 is fully risen. */
    rise?: number;
  }
> = ({ energy = 'rest', seed = 1, over = false, rise = 1 }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height, vh } = b;
  const radius = width * RADIUS;
  // The rim is a sharp line, so it hardly moves; the light behind it does the moving.
  const top = height * (1.04 - (HEIGHT + 0.04) * rise) + b.drift(0, 1.2);
  const x = width / 2 + b.drift(1, 3);
  const glow = rise * (1 + 0.07 * b.sway(2) * b.reach);
  // The brightest part of the glow glides along the rim, like the sun behind a planet.
  const sun = x + b.drift(3, 30);

  // The ground below the rim hides the light behind it; above the rim the light falls away into the page.
  const ground = dark ? stage.page : mix(stage.page, stage.soft, 0.5);
  const rim = dark ? b.bright : stage.accent;
  const halo = [
    [0.5, dark ? 0.5 : 0.24],
    [4, dark ? 0.3 : 0.13],
    [14, dark ? 0.12 : 0.05],
    [38, 0],
  ].map(([above, strength]) => `${alpha(stage.accent, strength * glow)} ${px(radius + vh(above))}`);
  const arc = `radial-gradient(circle at ${px(x)} ${px(top + radius)}, ${ground} ${px(radius - 1.5)}, ${alpha(rim, (dark ? 0.9 : 0.55) * glow)} ${px(radius)}, ${halo.join(', ')})`;

  const layers = [
    arc,
    pool(b.bright, (dark ? 0.14 : 0.6) * glow, sun, top, width * 0.28, height * 0.16),
    pool(stage.accent, (dark ? 0.34 : 0.12) * glow, (x + sun) / 2, top + vh(4), width * 0.62, height * 0.42),
  ];
  return <Fill colour={over ? undefined : stage.page} layers={layers} />;
};
