// Simplex noise: soft terraces of brand colour drifting like a contour map. Calm and a little graphic: for data,
// maps and planning films. Paper Shaders (paper-design/shaders, Apache-2.0), simplex noise.
import type { FC } from 'react';
import { SimplexNoise as PaperSimplexNoise } from '@paper-design/shaders-react';
import { ShaderLayer, useShaderLook, type ShaderProps } from './core';

/**
 * Broad, softly stepped fields from the page through the soft colour to a tint of the accent, and back. The middle
 * keeps half the contrast. Props: `page`, `intensity`, `quiet`, `at`, `out`, `seed`.
 */
export const SimplexNoise: FC<ShaderProps> = (props) => {
  const look = useShaderLook(props, 0.15);
  const { stage, dark, tone } = look;
  const colours = [stage.page, tone(stage.soft, dark ? 0.8 : 0.9), tone(stage.accent, dark ? 0.4 : 0.25), tone(stage.soft, dark ? 0.5 : 0.6)];
  return (
    <ShaderLayer look={look} centre={0.5}>
      {(mount) => <PaperSimplexNoise {...mount} colors={colours} stepsPerColor={3} softness={0.12} scale={1.8} />}
    </ShaderLayer>
  );
};
