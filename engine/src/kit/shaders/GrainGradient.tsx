// Grain gradient: soft blobs of brand colour drifting, with a fine grain of their own like a printed gradient. For a
// warmer, more tactile film. Paper Shaders (paper-design/shaders, Apache-2.0), grain gradient.
import type { FC } from 'react';
import { GrainGradient as PaperGrainGradient } from '@paper-design/shaders-react';
import { ShaderLayer, useShaderLook, type ShaderProps } from './core';

/**
 * Large slow grained blobs of the soft and accent colours drifting over a pale tint of the soft colour, so the whole
 * frame is coloured. It carries its own grain, so it takes only a third of the stage's. Props: `page`, `intensity`, `quiet`, `at`, `out`, `seed`.
 */
export const GrainGradient: FC<ShaderProps> = (props) => {
  const look = useShaderLook(props, 0.25);
  const { stage, dark, tone } = look;
  const colours = dark
    ? [tone(stage.soft, 1), tone(stage.accent, 0.55), tone(stage.soft, 0.6)]
    : [tone(stage.soft, 1), tone(stage.accent, 0.35), tone(stage.soft, 0.7)];
  return (
    <ShaderLayer look={look} grain={0.35}>
      {(mount) => (
        <PaperGrainGradient
          {...mount}
          colorBack={tone(stage.soft, dark ? 0.55 : 0.6)}
          colors={colours}
          shape="blob"
          scale={1.8}
          softness={0.85}
          intensity={0.2}
          noise={look.quiet ? 0.06 : 0.1}
          fit="cover"
        />
      )}
    </ShaderLayer>
  );
};
