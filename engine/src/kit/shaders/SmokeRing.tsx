// Smoke ring: a slow ring of brand-coloured smoke around the middle of the frame, with the page clear inside it. Made
// for one centred word, a logo or a number. Paper Shaders (paper-design/shaders, Apache-2.0), smoke ring.
import type { FC } from 'react';
import { SmokeRing as PaperSmokeRing } from '@paper-design/shaders-react';
import { ShaderLayer, useShaderLook, type ShaderProps } from './core';

/**
 * A ring of accent and soft smoke, sized to the shorter side of the frame so it fits every size, with the type in
 * its clear centre. Props: `page`, `intensity`, `quiet`, `at`, `out`, `seed`.
 */
export const SmokeRing: FC<ShaderProps> = (props) => {
  const look = useShaderLook(props, 0.2);
  const { stage, dark, tone } = look;
  const colours = dark ? [tone(stage.accent, 0.7), tone(stage.second, 0.4)] : [tone(stage.accent, 0.45), tone(stage.soft, 1)];
  return (
    <ShaderLayer look={look}>
      {(mount) => (
        <PaperSmokeRing
          {...mount}
          colorBack={stage.page}
          colors={colours}
          noiseScale={2.4}
          noiseIterations={6}
          radius={0.4}
          thickness={0.16}
          innerShape={0.85}
          scale={0.85}
          fit="contain"
        />
      )}
    </ShaderLayer>
  );
};
