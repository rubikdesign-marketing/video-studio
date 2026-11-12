// Registers the gallery of backgrounds: the "Backgrounds" reel and one "bg-<name>" composition per background.
// The default energy here is "alive", so the movement shows in a preview; a background's own default is "rest".
import type { FC } from 'react';
import { Composition, Folder } from 'remotion';
import { defaultBrand } from '../../kit/brand';
import { BackgroundsReel, FPS, PREVIEW, PREVIEW_FRAMES, REEL_FRAMES, reelSchema, shotSchema, shots } from './Gallery';

const frame = { width: 1920, height: 1080, fps: FPS };

export const BackgroundCompositions: FC = () => (
  <Folder name="backgrounds">
    <Composition id="Backgrounds" component={BackgroundsReel} schema={reelSchema} {...frame} durationInFrames={REEL_FRAMES} defaultProps={{ brand: defaultBrand, energy: 'alive' }} />
    {shots.map(({ entry, Component }) => (
      <Composition
        key={entry.name}
        id={`bg-${entry.name}`}
        component={Component}
        schema={shotSchema}
        {...frame}
        durationInFrames={PREVIEW_FRAMES}
        defaultProps={{ brand: defaultBrand, page: entry.page, energy: 'alive' }}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.round((props.seconds ?? PREVIEW) * FPS) })}
      />
    ))}
  </Folder>
);
