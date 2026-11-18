// Eight shader backgrounds on Paper Shaders, each full frame under one short line of film type to show it reads.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { GodRays } from '../../../kit/shaders/GodRays';
import { GrainGradient } from '../../../kit/shaders/GrainGradient';
import { MeshGradient } from '../../../kit/shaders/MeshGradient';
import { NeuroNoise } from '../../../kit/shaders/NeuroNoise';
import { SimplexNoise } from '../../../kit/shaders/SimplexNoise';
import { SmokeRing } from '../../../kit/shaders/SmokeRing';
import { Swirl } from '../../../kit/shaders/Swirl';
import { Warp } from '../../../kit/shaders/Warp';
import type { ShaderProps } from '../../../kit/shaders/core';
import { useFitSize } from '../../../kit/type/split';
import { Headline } from '../../../kit/ui';
import type { SizedDemo } from '../sized';
import { Centre } from '../parts';

/** One short line over the shader, fitted to the frame's width, held long enough to read. */
const Over: FC<{ lines: [string] | [string, string]; share: number }> = ({ lines, share }) => {
  const { height } = useVideoConfig();
  const size = (useFitSize(lines, 8, share) / height) * 100;
  return (
    <Centre>
      <Headline lines={lines} at={0.6} out={4.1} size={size} />
    </Centre>
  );
};

const scene =
  (Shader: FC<ShaderProps>, lines: [string] | [string, string], share = 0.8): SizedDemo['Scene'] =>
  ({ page }) => (
    <>
      <Shader page={page} />
      <Over lines={lines} share={share} />
    </>
  );

export const batch1: SizedDemo[] = [
  { name: 'shader-mesh-gradient', title: 'Mesh gradient shader', seconds: 5, Scene: scene(MeshGradient, ['Every order, in one place']), bare: true },
  { name: 'shader-grain-gradient', title: 'Grain gradient shader', seconds: 5, Scene: scene(GrainGradient, ['Shipped by noon, every day']), bare: true },
  { name: 'shader-god-rays', title: 'God rays shader', seconds: 5, Scene: scene(GodRays, ['Meet the new dashboard']), bare: true },
  { name: 'shader-warp', title: 'Warp shader', seconds: 5, Scene: scene(Warp, ['Plan less. Ship more.']), bare: true },
  { name: 'shader-smoke-ring', title: 'Smoke ring shader', seconds: 5, Scene: scene(SmokeRing, ['40% faster'], 0.34), bare: true },
  { name: 'shader-neuro-noise', title: 'Neuro noise shader', seconds: 5, Scene: scene(NeuroNoise, ['Answers in seconds']), bare: true },
  { name: 'shader-swirl', title: 'Swirl shader', seconds: 5, Scene: scene(Swirl, ['Every tool, one screen']), bare: true },
  { name: 'shader-simplex-noise', title: 'Simplex noise shader', seconds: 5, Scene: scene(SimplexNoise, ['See the whole quarter']), bare: true },
];
