// One short silent loop for a style in the library: the entry's own moves, one after another, each played by its
// own demo scene from the motion library (src/library/motion: demos/ and the sized families), at the entry's size,
// on the entry's background. 30 fps, 90 frames. Nothing here is registered twice: the scenes are only imported.
// Capture-family moves need a real capture and are not played by this file yet (see CaptureMove below).
import type { FC } from 'react';
import { Composition, Series } from 'remotion';
import { BrandProvider } from '../../kit/brand';
import * as Backgrounds from '../../kit/backgrounds';
import { MotionProvider, type PresetName } from '../../kit/motion';
import type { StageName } from '../../kit/tokens';
import { Stage } from '../../kit/ui';
import backgroundIndex from '../../../../library/backgrounds/index.json';
import motionIndex from '../../../../library/motion/index.json';
import { demos } from '../motion/demos';
import type { FormatName, SizedDemo } from '../motion/sized';
import { sizedFamilies } from '../motion/sized-families';
import { isCaptureMove, kebab, SIZES } from './rules.mjs';

export const FPS = 30;
export const FRAMES = 90;
/** At most this many moves are played in one clip; each gets an equal share of the frames. */
export const MAX_MOVES = 3;

type Energy = 'calm' | 'confident' | 'hype';
/** The part of a library entry the preview reads. `engine` holds motion-library move names (or background names). */
export type PreviewEntry = {
  id: string;
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

/** The energy the preview is timed from: confident, or the entry's only (first) energy. */
export const energyOf = (entry: PreviewEntry): Energy => (entry.filters.energy.includes('confident') ? 'confident' : entry.filters.energy[0] ?? 'confident');
const backdropEnergy = { calm: 'rest', confident: 'alive', hype: 'peak' } as const;
const formatOf = (entry: PreviewEntry): FormatName => (entry.filters.sizes[0] in SIZES ? entry.filters.sizes[0] : '9:16') as FormatName;

/** Moves that play on a real capture. Built in the follow-up task, with a demo-brand capture to play them on. */
const CaptureMove: FC<{ name: string; capture?: string }> = ({ name }) => {
  throw new Error(`${name} plays on a capture, and capture previews are not built yet`);
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
          return (
            <Series.Sequence key={`${name}-${i}`} durationInFrames={i === moves.length - 1 ? FRAMES - slot * i : slot}>
              {known ? <known.Scene page={page} format={format} /> : <CaptureMove name={name} capture={capture} />}
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
