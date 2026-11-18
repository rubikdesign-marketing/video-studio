// God rays: soft beams of brand light falling from above the frame, slowly turning. For an opening, a reveal or a
// "big moment" title. Paper Shaders (paper-design/shaders, Apache-2.0), god rays.
import type { FC } from 'react';
import { GodRays as PaperGodRays } from '@paper-design/shaders-react';
import { ShaderLayer, useShaderLook, type ShaderProps } from './core';

/**
 * Beams of the accent, soft and second colours from a light just above the top edge, with a gentle bloom. The beams
 * fade before the middle of the frame, where the type sits. Props: `page`, `intensity`, `quiet`, `at`, `out`, `seed`.
 */
export const GodRays: FC<ShaderProps> = (props) => {
  const look = useShaderLook(props, 0.2);
  const { stage, dark, tone } = look;
  const colours = dark
    ? [tone(stage.accent, 0.5), tone(stage.soft, 1), tone(stage.second, 0.35)]
    : [tone(stage.accent, 0.75), tone(stage.accent, 0.5), tone(stage.soft, 1)];
  return (
    <ShaderLayer look={look}>
      {(mount) => (
        <PaperGodRays
          {...mount}
          colorBack={stage.page}
          colorBloom={tone(stage.soft, 1)}
          colors={colours}
          offsetY={-0.62}
          density={0.25}
          spotty={0.2}
          midIntensity={0.25}
          midSize={0.25}
          intensity={(look.quiet ? 0.35 : 0.55) * (dark ? 1 : 1.3)}
          bloom={0.3}
          fit="cover"
        />
      )}
    </ShaderLayer>
  );
};
