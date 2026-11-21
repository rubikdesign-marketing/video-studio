// One short silent loop for a style in the library: the entry's own moves, one after another, each played by its
// own demo scene from the motion library (src/library/motion: demos/ and the sized families), at the entry's size,
// on the entry's background. 30 fps, 90 frames. Nothing here is registered twice: the scenes are only imported.
// Capture-family moves play their own gallery scene (capture.tsx, product.tsx, joins.tsx, relayout.tsx) on the
// demo-brand capture named in the "capture" prop (tools/styles/render-previews.mjs only passes a demo one).
import type { FC } from 'react';
import { Composition, Sequence, Series, useVideoConfig } from 'remotion';
import { useCapture } from '../../capture/load';
import { BrandProvider } from '../../kit/brand';
import * as Backgrounds from '../../kit/backgrounds';
import { MotionProvider, type PresetName } from '../../kit/motion';
import type { StageName } from '../../kit/tokens';
import { Stage } from '../../kit/ui';
import backgroundIndex from '../../../../library/backgrounds/index.json';
import motionIndex from '../../../../library/motion/index.json';
import { captureScenes } from '../motion/capture';
import type { CaptureScene } from '../motion/capture-scenes';
import { demos } from '../motion/demos';
import { joinScenes } from '../motion/joins';
import { MoveCaptions } from '../motion/parts';
import { productScenes } from '../motion/product';
import { relayoutScenes } from '../motion/relayout';
import type { FormatName, SizedDemo } from '../motion/sized';
import { sizedFamilies } from '../motion/sized-families';
import { CAPTURE_STANDS_IN, isCaptureMove, kebab, SIZES } from './rules.mjs';

export const FPS = 30;
export const FRAMES = 90;
/** At most this many moves are played in one clip; each gets an equal share of the frames. */
export const MAX_MOVES = 3;

type Energy = 'calm' | 'confident' | 'hype';
/** The part of a library entry the preview reads. `engine` holds motion-library move names (or background names). */
export type PreviewEntry = {
  id: string;
  /** The energy the preview plays at: filters.energy[0]. */
  energy?: Energy;
  filters: { energy: Energy[]; sizes: string[] };
  engine: string[];
};
/** `capture` is "<job>/<id>", a demo-brand capture, for entries whose moves play on one. */
export type StylePreviewProps = { entry: PreviewEntry; capture?: string };

export { SIZES };

type Scene = FC<{ page: StageName; format: FormatName }>;
type Known = { Scene: Scene };
/** Every move with a standalone demo scene: the gallery scenes, then the sized families (text, transitions, openers, shaders, ugc). */
const scenes = new Map<string, Known>();
for (const d of demos) scenes.set(d.name, { Scene: d.Scene as Scene });
for (const family of sizedFamilies) for (const d of family.demos as SizedDemo[]) scenes.set(d.name, { Scene: d.Scene });

type Named = { name: string; component: string; best_page?: string };
const backgrounds = new Map<string, Named>();
for (const b of (backgroundIndex as { backgrounds: Named[] }).backgrounds) { backgrounds.set(b.name, b); backgrounds.set(b.component, b); }
type Backdrop = FC<{ energy?: 'rest' | 'alive' | 'peak'; seed?: number }>;
const backdrops = Backgrounds as unknown as Record<string, Backdrop>;

const sceneOf = (name: string) => scenes.get(name) ?? scenes.get(kebab(name));
const backgroundOf = (name: string) => { const b = backgrounds.get(name) ?? backgrounds.get(kebab(name)); return b && backdrops[b.component] ? b : undefined; };

/** Moves that play on a real capture: the capture- families, and the join-, stage-, product- and relayout- ones. */
const captureMoves = new Set<string>();
for (const m of (motionIndex as { moves: { name: string; family: string }[] }).moves) {
  if (isCaptureMove(m.name, m.family)) captureMoves.add(m.name);
}
export const needsCapture = (name: string) => captureMoves.has(name) || captureMoves.has(kebab(name));

/** The energy the preview plays at: the first one the entry lists. */
export const energyOf = (entry: PreviewEntry): Energy => entry.energy ?? entry.filters.energy[0] ?? 'confident';
const backdropEnergy = { calm: 'rest', confident: 'alive', hype: 'peak' } as const;
const formatOf = (entry: PreviewEntry): FormatName => (entry.filters.sizes[0] in SIZES ? entry.filters.sizes[0] : '9:16') as FormatName;

/** Every capture-based gallery scene by move name. */
const captureShows = new Map<string, CaptureScene>();
for (const scene of [...captureScenes, ...productScenes, ...joinScenes, ...relayoutScenes]) captureShows.set(scene.name, scene);
/** Capture moves with no gallery scene of their own play the scene named in CAPTURE_STANDS_IN (rules.mjs). */
const STANDS_IN = CAPTURE_STANDS_IN;
export const captureSceneOf = (name: string) => captureShows.get(STANDS_IN[name] ?? name) ?? captureShows.get(STANDS_IN[kebab(name)] ?? kebab(name));

/** A frame of the preview's shape for a scene: its long side 1920, or (contain) at least the scene's own frame. */
export const sceneFrame = (scene: Pick<CaptureScene, 'size' | 'fit'>, width: number, height: number): [number, number] => {
  const scale = scene.fit === 'contain' ? Math.max(scene.size[0] / width, scene.size[1] / height) : 1920 / Math.max(width, height);
  return [Math.round(width * scale), Math.round(height * scale)];
};

/**
 * A capture move: its gallery scene, drawn at a frame of its own size (scaled down to the clip) with the move's name
 * left off, on the named capture. A missing capture or scene fails the render, so the plan reports the entry.
 */
const CaptureMove: FC<{ name: string; capture?: string; page: StageName; energies: Energy[]; frames: number }> = ({ name, capture, page, energies, frames }) => {
  const scene = captureSceneOf(name);
  if (!scene) throw new Error(`${name} plays on a capture, and no capture scene in the motion library plays it`);
  // An empty name would mean "the newest capture", which may be anyone's: only a named demo capture is played.
  if (!capture) throw new Error(`${name} plays on a capture: name a demo-brand capture in the "capture" prop`);
  const loaded = useCapture(capture);
  const { width, height } = useVideoConfig();
  if (loaded === null) throw new Error(`${name}: the capture ${capture} is not in engine/public (record it, or run: node tools/capture/capture.mjs relist)`);
  if (!loaded) return null;
  const [w, h] = sceneFrame(scene, width, height);
  // The gallery's own energy when the style allows it (a whip is a hype move), else the style's.
  const preset = (energies.includes(scene.preset as Energy) ? scene.preset : energies[0] ?? 'confident') as PresetName;
  return (
    <Sequence width={w} height={h} durationInFrames={frames} style={{ transform: `scale(${width / w})`, transformOrigin: '0 0' }}>
      <MoveCaptions.Provider value={false}>
        <scene.Show {...scene.props} brand="demo" preset={preset} page={page} capture={loaded.name} />
      </MoveCaptions.Provider>
    </Sequence>
  );
};

const Moves: FC<{ entry: PreviewEntry; page: StageName; capture?: string }> = ({ entry, page, capture }) => {
  const format = formatOf(entry);
  // A name nothing here can play is an error, not a gap: the render fails and the plan reports the entry.
  for (const n of entry.engine) if (!sceneOf(n) && !needsCapture(n) && !backgroundOf(n)) throw new Error(`${entry.id}: ${n} has no demo scene, background or capture mapping`);
  const moves = entry.engine.filter((n) => sceneOf(n) || needsCapture(n)).slice(0, MAX_MOVES);
  const bg = entry.engine.map(backgroundOf).find(Boolean);
  const Backdrop = bg ? backdrops[bg.component] : null;
  const slot = Math.floor(FRAMES / Math.max(1, moves.length));
  return (
    <>
      {Backdrop ? <Backdrop energy={backdropEnergy[energyOf(entry)]} /> : null}
      {moves.length ? (
      <Series>
        {moves.map((name, i) => {
          const known = sceneOf(name);
          const frames = i === moves.length - 1 ? FRAMES - slot * i : slot;
          return (
            <Series.Sequence key={`${name}-${i}`} durationInFrames={frames}>
              {known ? <known.Scene page={page} format={format} /> : <CaptureMove name={name} capture={capture} page={page} energies={entry.filters.energy} frames={frames} />}
            </Series.Sequence>
          );
        })}
      </Series>
      ) : null}
    </>
  );
};

export const StylePreview: FC<StylePreviewProps> = ({ entry, capture }) => {
  const bg = entry.engine.map(backgroundOf).find(Boolean);
  const page = (bg?.best_page ?? 'light') as StageName;
  return (
    <BrandProvider brand="demo">
      <MotionProvider preset={energyOf(entry) as PresetName}>
        <Stage name={page}>
          <Moves entry={entry} page={page} capture={capture} />
        </Stage>
      </MotionProvider>
    </BrandProvider>
  );
};

const sample: PreviewEntry = { id: 'sample', filters: { energy: ['confident'], sizes: ['9:16'] }, engine: ['blur-in', 'paper'] };

export const StylePreviewComposition: FC = () => (
  <Composition
    id="style-preview"
    component={StylePreview}
    width={270}
    height={480}
    fps={FPS}
    durationInFrames={FRAMES}
    defaultProps={{ entry: sample } satisfies StylePreviewProps}
    calculateMetadata={({ props }) => ({ ...(SIZES[props.entry.filters.sizes[0]] ?? SIZES['9:16']), fps: FPS, durationInFrames: FRAMES })}
  />
);
