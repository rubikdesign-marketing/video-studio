// Mesh gradient: four soft fields of the brand's page, soft, accent and second colours that slowly flow into one
// another. The quiet, all-purpose shader under a headline. Paper Shaders (paper-design/shaders, Apache-2.0), mesh gradient.
import type { FC } from 'react';
import { MeshGradient as PaperMeshGradient } from '@paper-design/shaders-react';
import { ShaderLayer, useShaderLook, type ShaderProps } from './core';

/**
 * A slow mesh of brand colour filling the frame. The accent stays a tint on the light page and a glow on the dark
 * one, so type in ink still reads anywhere on it. Props: `page`, `intensity`, `quiet`, `at`, `out`, `seed`.
 */
export const MeshGradient: FC<ShaderProps> = (props) => {
  const look = useShaderLook(props, 0.22);
  const { stage, dark, tone } = look;
  const colours = dark
    ? [stage.page, tone(stage.soft, 0.9), tone(stage.accent, 0.45), tone(stage.soft, 0.55)]
    : [stage.page, tone(stage.soft, 1), tone(stage.accent, 0.28), tone(stage.second, 0.22)];
  return (
    <ShaderLayer look={look}>
      {(mount) => <PaperMeshGradient {...mount} colors={colours} distortion={0.75} swirl={0.35} fit="cover" />}
    </ShaderLayer>
  );
};
