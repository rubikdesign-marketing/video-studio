// One short silent loop for a style in the library: the entry's own moves, one after another, on its background,
// set in the demo brand's sample line. 30 fps, 90 frames. The frame size comes from the entry's first size.
// Moves that need a scene around them (camera, transitions, product components) are not played here; the plan in
// tools/styles/render-previews.mjs skips them (renderable.json is the list both read).
import type { CSSProperties, FC } from 'react';
import { Composition } from 'remotion';
import { BrandProvider, useBrand } from '../../kit/brand';
import * as Backgrounds from '../../kit/backgrounds';
import { MotionProvider, type PresetName } from '../../kit/motion';
import * as Moves from '../../kit/moves';
import * as Type from '../../kit/type';
import { Stage } from '../../kit/ui';
import type { StageName } from '../../kit/tokens';
import motionIndex from '../../../../library/motion/index.json';
import backgroundIndex from '../../../../library/backgrounds/index.json';
import renderable from './renderable.json';

export const FPS = 30;
export const FRAMES = 90;
const SECONDS = FRAMES / FPS;

type Energy = 'calm' | 'confident' | 'hype';
type Timing = { beat_s?: number; hold_s?: number };
/** The part of a library entry the preview reads. */
export type PreviewEntry = {
  id: string;
  filters: { energy: Energy[]; sizes: string[] };
  timing?: Partial<Record<Energy, Timing>>;
  engine: string[];
};
export type StylePreviewProps = { entry: PreviewEntry };

/** Pixels for each size: 480 on the long side. */
export const SIZES: Record<string, { width: number; height: number }> = {
  '9:16': { width: 270, height: 480 },
  '16:9': { width: 480, height: 270 },
  '1:1': { width: 480, height: 480 },
  '4:5': { width: 384, height: 480 },
};

type LineMove = FC<{ lines: string[]; at: number; out?: number }>;
type TextMove = FC<{ text: string; at: number; out?: number }>;
const lineMoves: Record<string, LineMove> = {
  BlurIn: Moves.BlurIn as unknown as LineMove,
  MaskRise: Type.MaskRise, FadeUp: Type.FadeUp, LetterCascade: Type.LetterCascade, SoftWipe: Type.SoftWipe,
  BlurSweep: Type.BlurSweep, FocusIn: Type.FocusIn, OutlineFill: Type.OutlineFill, BlockReveal: Type.BlockReveal,
  Slam: Type.Slam, WordPop: Type.WordPop, DropBounce: Type.DropBounce, FlipUp: Type.FlipUp, ArcSwing: Type.ArcSwing,
  ScatterAssemble: Type.ScatterAssemble, FromLens: Type.FromLens, SmearIn: Type.SmearIn, HumanType: Type.HumanType,
  ScrambleLock: Type.ScrambleLock, SplitFlap: Type.SplitFlap, DrumRoll: Type.DrumRoll,
} as unknown as Record<string, LineMove>;
const textMoves: Record<string, TextMove> = {
  TrackingSettle: Moves.TrackingSettle as unknown as TextMove,
  TypeOn: Moves.TypeOn as unknown as TextMove,
};
type Backdrop = FC<{ energy?: 'rest' | 'alive' | 'peak'; seed?: number }>;
const backdrops = Backgrounds as unknown as Record<string, Backdrop>;

// The list the plan reads must match what this file can play.
for (const name of renderable.moves) if (!lineMoves[name] && !textMoves[name]) throw new Error(`renderable.json lists ${name}, which StylePreview cannot play`);
for (const name of renderable.backgrounds) if (!backdrops[name]) throw new Error(`renderable.json lists background ${name}, which StylePreview cannot play`);

type Named = { name: string; component: string; pages?: string[]; best_page?: string };
const componentOf = new Map<string, string>();
for (const m of (motionIndex as { moves: Named[] }).moves) { componentOf.set(m.name, m.component); componentOf.set(m.component, m.component); }
const backgroundOf = new Map<string, Named>();
for (const b of (backgroundIndex as { backgrounds: Named[] }).backgrounds) { backgroundOf.set(b.name, b); backgroundOf.set(b.component, b); }

/** The energy the preview is timed from: confident, or the entry's only (first) energy. */
export const energyOf = (entry: PreviewEntry): Energy => (entry.filters.energy.includes('confident') ? 'confident' : entry.filters.energy[0] ?? 'confident');
const backdropEnergy = { calm: 'rest', confident: 'alive', hype: 'peak' } as const;

const Scene: FC<{ entry: PreviewEntry }> = ({ entry }) => {
  const brand = useBrand();
  const energy = energyOf(entry);
  const names = entry.engine.map((n) => componentOf.get(n) ?? n);
  const playable = names.filter((n) => lineMoves[n] || textMoves[n]).slice(0, 3);
  const bg = entry.engine.map((n) => backgroundOf.get(n)).find((b) => b && backdrops[b.component]);
  // A style with only a background still shows the sample line, so the clip is not an empty page.
  const moves = playable.length ? playable : ['FadeUp'];
  const sample = brand.name;
  const [first, ...others] = sample.split(' ');
  const rest = others.join(' ') || 'brand';
  const beat = Math.min(entry.timing?.[energy]?.beat_s ?? 0.4, 0.5);
  const slot = SECONDS / moves.length;
  const fill: CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const Backdrop = bg ? backdrops[bg.component] : null;
  return (
    <>
      {Backdrop ? <Backdrop energy={backdropEnergy[energy]} /> : null}
      {moves.map((name, i) => {
        const at = i * slot + Math.min(beat, 0.25);
        const out = Math.min((i + 1) * slot - 0.1, SECONDS - 0.15);
        const Lines = lineMoves[name];
        const Text = textMoves[name];
        return (
          <div key={`${name}-${i}`} style={fill}>
            {Lines ? <Lines lines={name === 'BlurIn' ? [first, `*${rest}*`] : [`${first} *${rest}*`]} at={at} out={out} /> : <Text text={sample} at={at} out={out} />}
          </div>
        );
      })}
    </>
  );
};

export const StylePreview: FC<StylePreviewProps> = ({ entry }) => {
  const energy = energyOf(entry);
  const bg = entry.engine.map((n) => backgroundOf.get(n)).find((b) => b && backdrops[b.component]);
  const page = (bg?.best_page ?? 'light') as StageName;
  return (
    <BrandProvider brand="demo">
      <MotionProvider preset={energy as PresetName}>
        <Stage name={page}>
          <Scene entry={entry} />
        </Stage>
      </MotionProvider>
    </BrandProvider>
  );
};

const sample: PreviewEntry = { id: 'sample', filters: { energy: ['confident'], sizes: ['9:16'] }, timing: { confident: { beat_s: 0.4 } }, engine: ['blur-in', 'paper'] };

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
