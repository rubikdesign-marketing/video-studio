// Warp: broad bands of brand colour folding slowly through one another, like silk. For a product film that wants
// more movement than a gradient but nothing busy. Paper Shaders (paper-design/shaders, Apache-2.0), warp.
import type { FC } from 'react';
import { Warp as PaperWarp } from '@paper-design/shaders-react';
import { ShaderLayer, useShaderLook, type ShaderProps } from './core';

/**
 * Soft folded bands of the page, soft and accent colours. The middle of the frame keeps under half the contrast of the
 * edges. Props: `page`, `intensity`, `quiet`, `at`, `out`, `seed`.
 */
export const Warp: FC<ShaderProps> = (props) => {
  const look = useShaderLook(props, 0.4);
  const { stage, dark, tone } = look;
  const colours = dark
    ? [stage.page, tone(stage.soft, 1), stage.page, tone(stage.accent, 0.45)]
    : [stage.page, tone(stage.soft, 1), stage.page, tone(stage.accent, 0.3)];
  return (
    <ShaderLayer look={look} centre={0.45}>
      {(mount) => (
        <PaperWarp
          {...mount}
          colors={colours}
          shape="stripes"
          proportion={0.45}
          softness={1}
          distortion={0.12}
          swirl={0.4}
          swirlIterations={6}
          shapeScale={0.12}
          scale={1.8}
          rotation={-20}
        />
      )}
    </ShaderLayer>
  );
};
