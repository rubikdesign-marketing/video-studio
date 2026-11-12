// Spotlight: one soft light on the page, with the page falling into shade around it. Give it a `point` and it
// follows; a scene moves the point with its own cues. Left alone it rests a little above the middle and wanders.
// On a dark page the light is the accent in the dark. On a light page it is the brightest colour the brand has,
// ringed by the soft fill, and the page beyond it is shaded towards the ink, so the light is plainly there.
import type { FC } from 'react';
import type { Point } from '../motion';
import { Fill, pool, surround, useBackdrop, type TreatmentProps } from './shared';

export const Spotlight: FC<
  TreatmentProps & {
    /** Where the light points, in frame pixels (the same places a Cursor uses). Left out, a little above the middle. */
    point?: Point;
    /** How far the light reaches, as a share of frame height. */
    size?: number;
  }
> = ({ energy = 'rest', seed = 1, over = false, point, size = 0.75 }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height } = b;
  const x = (point?.x ?? width * 0.5) + b.drift(0, 5);
  const y = (point?.y ?? height * 0.46) + b.drift(1, 3.5);
  const reach = height * size * (1 + 0.04 * b.sway(2) * b.reach);
  const layers = dark
    ? [pool(b.bright, 0.06, x, y, reach * 0.5), pool(stage.accent, 0.3, x, y, reach), pool(stage.soft, 0.9, x, y, reach * 1.6)]
    : [
        pool(b.bright, 0.95, x, y, reach * 0.95),
        // The shade: nothing under the light, deepest at the corners of the frame.
        surround(stage.shade, 0.11, x, y, reach * 0.45, reach * 1.55),
        surround(stage.soft, 0.8, x, y, reach * 0.3, reach * 1.25),
      ];
  return <Fill colour={over ? undefined : stage.page} layers={layers} />;
};
