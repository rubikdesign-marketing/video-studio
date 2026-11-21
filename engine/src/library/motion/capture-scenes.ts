// The capture-based scenes of the motion library as plain records, so something other than Remotion Studio can play
// one (the style library's preview clips, src/library/styles/StylePreview.tsx). Each of capture.tsx, product.tsx,
// joins.tsx and relayout.tsx lists its own; nothing here registers a composition.
import type { FC } from 'react';
import type { LoadedCapture } from '../../capture/load';
import type { PresetName } from '../../kit/motion';
import type { StageName } from '../../kit/tokens';

export type CaptureScene = {
  /** The move's name in library/motion/index.json, like "cursor-classic" or "join-whip". */
  name: string;
  /** The scene, with its own brand, preset and stage around it, as in Remotion Studio. */
  Show: FC<{ brand: 'demo'; preset: PresetName; page: StageName; capture: string } & Record<string, unknown>>;
  /** Everything else the scene's props need, at their gallery defaults. */
  props: Record<string, unknown>;
  /** The energy the gallery shows it in. */
  preset: PresetName;
  /** The frame it is made for in the gallery. */
  size: readonly [number, number];
  /**
   * How it takes another frame shape: "contain" keeps at least its own frame (it draws at fixed sizes), "fill" is
   * given the new shape outright (it lays itself out for 9:16, 1:1 and 4:5).
   */
  fit: 'contain' | 'fill';
  /**
   * When the scene's defining moment comes (a click, a mark on the product, a join), in seconds on its own clock,
   * and how long it runs, for this take at this energy in a frame of this size: the values the scene itself works
   * out to draw and time it. `cue` is null when the scene has no one moment; `seconds` null when unknown.
   */
  timing?: (loaded: LoadedCapture, props: Record<string, unknown>, preset: PresetName, frame: { width: number; height: number }) => SceneTiming;
};

export type SceneTiming = { cue: number | null; seconds: number | null };
