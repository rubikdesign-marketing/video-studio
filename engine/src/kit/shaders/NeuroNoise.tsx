// Neuro noise: fine glowing filaments of brand light drifting like a network, quietened in the middle. For AI, data
// and "how it works" films. Paper Shaders (paper-design/shaders, Apache-2.0), neuro noise.
import type { FC } from 'react';
import { NeuroNoise as PaperNeuroNoise } from '@paper-design/shaders-react';
import { ShaderLayer, useShaderLook, type ShaderProps } from './core';

/**
 * Threads of the accent and second colours on the page. The middle keeps a third of the strength, so a headline
 * sits on near page colour. Props: `page`, `intensity`, `quiet`, `at`, `out`, `seed`.
 */
export const NeuroNoise: FC<ShaderProps> = (props) => {
  const look = useShaderLook(props, 0.2);
  const { stage, dark, tone } = look;
  return (
    <ShaderLayer look={look} centre={0.35}>
      {(mount) => (
        <PaperNeuroNoise
          {...mount}
          colorBack={stage.page}
          colorMid={dark ? tone(stage.accent, 0.6) : tone(stage.accent, 0.35)}
          colorFront={dark ? tone(stage.second, 0.7) : tone(stage.accent, 0.6)}
          brightness={0.04}
          contrast={0.3}
          scale={0.9}
        />
      )}
    </ShaderLayer>
  );
};
