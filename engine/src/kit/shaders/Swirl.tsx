// Swirl: broad soft bands of brand colour turning slowly round the middle of the frame, like stirred paint. For a
// launch or a title that wants a little pull towards the centre. Paper Shaders (paper-design/shaders, Apache-2.0), swirl.
import type { FC } from 'react';
import { Swirl as PaperSwirl } from '@paper-design/shaders-react';
import { ShaderLayer, useShaderLook, type ShaderProps } from './core';

/**
 * Soft bands of the soft and accent colours twisting round the centre, with no hard edge anywhere. The middle keeps
 * half the contrast. Props: `page`, `intensity`, `quiet`, `at`, `out`, `seed`.
 */
export const Swirl: FC<ShaderProps> = (props) => {
  const look = useShaderLook(props, 0.1);
  const { stage, dark, tone } = look;
  const colours = dark
    ? [tone(stage.soft, 1), tone(stage.accent, 0.5), tone(stage.soft, 0.6)]
    : [tone(stage.soft, 1), tone(stage.accent, 0.3), tone(stage.soft, 0.6)];
  return (
    <ShaderLayer look={look} centre={0.5}>
      {(mount) => (
        <PaperSwirl
          {...mount}
          colorBack={stage.page}
          colors={colours}
          bandCount={3}
          twist={0.15}
          center={0.25}
          proportion={0.5}
          softness={1}
          noiseFrequency={0.3}
          noise={0.15}
          fit="cover"
        />
      )}
    </ShaderLayer>
  );
};
