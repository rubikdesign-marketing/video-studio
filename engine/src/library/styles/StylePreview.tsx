// One short silent loop for a style in the library: the entry's own moves, one after another, each played by its
// own demo scene from the motion library (src/library/motion: demos/ and the sized families), at the entry's size,
// on the entry's background. 30 fps, 90 frames. Nothing here is registered twice: the scenes are only imported.
// Capture-family moves play their own gallery scene (capture.tsx, product.tsx, joins.tsx, relayout.tsx) on the
// demo-brand capture named in the "capture" prop (tools/styles/render-previews.mjs only passes a demo one: the phone
// take for an entry with a phone move). Each capture scene starts just before its defining moment (rules.mjs,
// sceneStart), and a pointer named beside a capture move sets that move's pointer instead of taking a slot. A staging,
// re-layout or camera move named beside marks plays as one scene, the marks on the staged take (motion/compose.tsx).
// Every other scene starts on a frame with its content on screen, from its measured timing (rules.mjs, slotStart;
// library/motion/scene-timing.json), and a scene made only for 16:9 plays in a frame fitted to its content.
import type React from 'react';
import type { FC } from 'react';
import { Composition, Freeze, Sequence, Series, useCurrentFrame, useVideoConfig } from 'remotion';
import { composedScene } from '../motion/compose';
import sceneTiming from '../../../../library/motion/scene-timing.json';
import { useCapture, type LoadedCapture } from '../../capture/load';
import { PointerOverride } from '../../kit/CaptureClip';
import type { CursorStyle } from '../../kit/capture/looks';
import { BrandProvider } from '../../kit/brand';
import * as Backgrounds from '../../kit/backgrounds';
import { MotionProvider, type PresetName } from '../../kit/motion';
import type { StageName } from '../../kit/tokens';
import { Stage } from '../../kit/ui';
import backgroundIndex from '../../../../library/backgrounds/index.json';
import motionIndex from '../../../../library/motion/index.json';
import { captureScenes } from '../motion/capture';
import type { CaptureScene, SceneTiming } from '../motion/capture-scenes';
import { demos } from '../motion/demos';
import { joinScenes } from '../motion/joins';
import { MoveCaptions } from '../motion/parts';
import { productScenes } from '../motion/product';
import { relayoutScenes } from '../motion/relayout';
import type { FormatName, SizedDemo } from '../motion/sized';
import { sizedFamilies } from '../motion/sized-families';
import { CAPTURE_STANDS_IN, COMPOSE_JOIN, composedMembers, fitFrame, isCaptureMove, isPhoneMove, kebab, LEAD_S, MAX_MOVES, PREVIEW_FPS, PREVIEW_FRAMES, previewSlots, sceneNeed, sceneStart, SIZES, slotLengths, slotStart, timingFor } from './rules.mjs';

export const FPS = PREVIEW_FPS;
export const FRAMES = PREVIEW_FRAMES;
/** At most this many moves are played in one clip; each gets an equal share of the frames (rules.mjs). */
export { MAX_MOVES };

type Energy = 'calm' | 'confident' | 'hype';
/** The part of a library entry the preview reads. `engine` holds motion-library move names (or background names). */
export type PreviewEntry = {
  id: string;
  /** The energy the preview plays at: filters.energy[0]. */
  energy?: Energy;
  filters: { energy: Energy[]; sizes: string[] };
  engine: string[];
  /** The pointer the capture moves are drawn with ("hidden", "classic" ...), as the plan resolved it (rules.mjs, previewSlots). */
  pointer?: string;
};
/** `capture` is "<job>/<id>", a demo-brand capture, for entries whose moves play on one. */
export type StylePreviewProps = { entry: PreviewEntry; capture?: string };

export { SIZES };

type Scene = FC<{ page: StageName; format: FormatName }>;
/** `sized`: the scene lays itself out for every size (sized.tsx); the gallery scenes (demos/) are made for 16:9. */
type Known = { name: string; Scene: Scene; seconds: number; sized: boolean };
/** Every move with a standalone demo scene: the gallery scenes, then the sized families (text, transitions, openers, shaders, ugc). */
const scenes = new Map<string, Known>();
for (const d of demos) scenes.set(d.name, { name: d.name, Scene: d.Scene as Scene, seconds: d.seconds, sized: false });
for (const family of sizedFamilies) for (const d of family.demos as SizedDemo[]) scenes.set(d.name, { name: d.name, Scene: d.Scene, seconds: d.seconds, sized: true });

type Named = { name: string; component: string; best_page?: string };
const backgrounds = new Map<string, Named>();
for (const b of (backgroundIndex as { backgrounds: Named[] }).backgrounds) { backgrounds.set(b.name, b); backgrounds.set(b.component, b); }
type Backdrop = FC<{ energy?: 'rest' | 'alive' | 'peak'; seed?: number }>;
const backdrops = Backgrounds as unknown as Record<string, Backdrop>;

const sceneOf = (name: string) => scenes.get(name) ?? scenes.get(kebab(name));
const backgroundOf = (name: string) => { const b = backgrounds.get(name) ?? backgrounds.get(kebab(name)); return b && backdrops[b.component] ? b : undefined; };

/** Moves that play on a real capture: the capture- families, and the join-, stage-, product- and relayout- ones. */
const captureMoves = new Set<string>();
const families = new Map<string, string>();
const phoneMoves = new Set<string>();
for (const m of (motionIndex as { moves: { name: string; family: string; does?: string }[] }).moves) {
  families.set(m.name, m.family);
  if (isCaptureMove(m.name, m.family)) captureMoves.add(m.name);
  if (isPhoneMove(m.name, m.does)) phoneMoves.add(m.name);
}
const isComposed = (name: string) => name.includes(COMPOSE_JOIN);
export const needsCapture = (name: string) => isComposed(name) || captureMoves.has(name) || captureMoves.has(kebab(name));
const familyOf = (name: string) => families.get(name) ?? families.get(kebab(name)) ?? '';
const isPhone = (name: string) => phoneMoves.has(name) || phoneMoves.has(kebab(name));

/** The energy the preview plays at: the first one the entry lists. */
export const energyOf = (entry: PreviewEntry): Energy => entry.energy ?? entry.filters.energy[0] ?? 'confident';
const backdropEnergy = { calm: 'rest', confident: 'alive', hype: 'peak' } as const;
const formatOf = (entry: PreviewEntry): FormatName => (entry.filters.sizes[0] in SIZES ? entry.filters.sizes[0] : '9:16') as FormatName;

/** Every capture-based gallery scene by move name. */
const captureShows = new Map<string, CaptureScene>();
for (const scene of [...captureScenes, ...productScenes, ...joinScenes, ...relayoutScenes]) captureShows.set(scene.name, scene);
/** Capture moves with no gallery scene of their own play the scene named in CAPTURE_STANDS_IN (rules.mjs). */
const STANDS_IN = CAPTURE_STANDS_IN;
export const captureSceneOf = (name: string) =>
  isComposed(name) ? composedScene(composedMembers(name)) : captureShows.get(STANDS_IN[name] ?? name) ?? captureShows.get(STANDS_IN[kebab(name)] ?? kebab(name));

/** A frame of the preview's shape for a scene: its long side 1920, or (contain) at least the scene's own frame. */
export const sceneFrame = (scene: Pick<CaptureScene, 'size' | 'fit'>, width: number, height: number): [number, number] => {
  const scale = scene.fit === 'contain' ? Math.max(scene.size[0] / width, scene.size[1] / height) : 1920 / Math.max(width, height);
  return [Math.round(width * scale), Math.round(height * scale)];
};

/** Each scene's timing on a capture, worked out once per render tab (the plan behind it covers the whole clip). */
const timings = new Map<string, SceneTiming | undefined>();
const timingOf = (scene: CaptureScene, loaded: LoadedCapture, preset: PresetName, w: number, h: number) => {
  const key = `${scene.name}|${loaded.name}|${preset}|${w}x${h}`;
  if (!timings.has(key)) timings.set(key, scene.timing?.(loaded, scene.props, preset, { width: w, height: h }));
  return timings.get(key);
};

/**
 * A capture move: its gallery scene, drawn at a frame of its own size (scaled down to the clip) with the move's name
 * left off, on the named capture, from just before its defining moment, with the entry's pointer if it names one. A
 * missing capture or scene fails the render, so the plan reports the entry.
 */
const CaptureMove: FC<{ name: string; capture?: string; page: StageName; energy: Energy; frames: number; pointer: string | null }> = ({ name, capture, page, energy, frames, pointer }) => {
  const scene = captureSceneOf(name);
  if (!scene) throw new Error(`${name} plays on a capture, and no capture scene in the motion library plays it`);
  // An empty name would mean "the newest capture", which may be anyone's: only a named demo capture is played.
  if (!capture) throw new Error(`${name} plays on a capture: name a demo-brand capture in the "capture" prop`);
  const loaded = useCapture(capture);
  const { width, height, fps } = useVideoConfig();
  if (loaded === null) throw new Error(`${name}: the capture ${capture} is not in engine/public (record it, or run: node tools/capture/capture.mjs relist)`);
  if (!loaded) return null;
  const [w, h] = sceneFrame(scene, width, height);
  // The style's first listed energy always wins, as for every other preview.
  const preset = energy as PresetName;
  // The scene's own moment (its first click, its mark on the product, its join), as the scene works it out: once
  // per scene, capture, energy and frame, not every frame (it plans the whole clip).
  const timing = timingOf(scene, loaded, preset, w, h);
  const start = sceneStart({ cue: timing?.cue, seconds: timing?.seconds ?? undefined, slot: frames, fps });
  return (
    <Sequence from={-start} width={w} height={h} durationInFrames={frames + start} style={{ transform: `scale(${width / w})`, transformOrigin: '0 0' }}>
      <MoveCaptions.Provider value={false}>
        <PointerOverride.Provider value={(pointer as CursorStyle | null) ?? null}>
          <scene.Show {...scene.props} brand="demo" preset={preset} page={page} capture={loaded.name} />
        </PointerOverride.Provider>
      </MoveCaptions.Provider>
    </Sequence>
  );
};

type Measured = Parameters<typeof timingFor>[0];
const measured = (sceneTiming as { scenes?: Measured }).scenes;

/** Plays its children, held on frame `from - 1` from frame `from` on (a scene that has left: its last content frame). */
const Hold: FC<{ from: number | null; children: React.ReactNode }> = ({ from, children }) => {
  const frame = useCurrentFrame();
  return (
    <Freeze frame={Math.max(0, (from ?? 1) - 1)} active={from !== null && frame >= from}>
      {children}
    </Freeze>
  );
};

/**
 * A standalone scene in its slot: from the frame its measured timing picks (its content on screen, never an empty
 * frame when one can be avoided, its change kept; rules.mjs, slotStart), held on its last content frame when it would
 * leave before the slot ends, in its own size's layout, or, made only for 16:9, in a frame of the clip's width just
 * wide enough for its content (rules.mjs, fitFrame).
 */
const SceneMove: FC<{ known: Known; page: StageName; format: FormatName; energy: Energy; frames: number; first: boolean }> = ({ known, page, format, energy, frames, first }) => {
  const { width, height } = useVideoConfig();
  const timing = timingFor(measured, known.name, energy, known.seconds);
  const { start, freeze } = slotStart({ timing, slot: frames, fps: FPS, grace: first ? Math.round(LEAD_S * FPS) : 0, transition: familyOf(known.name) === 'transition' });
  const frame = known.sized ? { width, height, top: 0 } : fitFrame({ width, height }, timing?.extent);
  return (
    <Sequence from={-start} durationInFrames={frames + start} width={frame.width} height={frame.height} style={{ top: frame.top, height: frame.height, width: frame.width }}>
      <Hold from={freeze}>
        <known.Scene page={page} format={format} />
      </Hold>
    </Sequence>
  );
};

const Moves: FC<{ entry: PreviewEntry; page: StageName; capture?: string }> = ({ entry, page, capture }) => {
  const format = formatOf(entry);
  // A name nothing here can play is an error, not a gap: the render fails and the plan reports the entry.
  for (const n of entry.engine) if (!sceneOf(n) && !needsCapture(n) && !backgroundOf(n)) throw new Error(`${entry.id}: ${n} has no demo scene, background or capture mapping`);
  const playable = entry.engine.filter((n) => sceneOf(n) || needsCapture(n));
  // A pointer beside a capture move is that move's setting, not a slot; a picture beside marks is one slot (rules.mjs,
  // the same rule as the plan).
  const slots = previewSlots(playable, { familyOf, phone: playable.some(isPhone) });
  if (slots.refused) throw new Error(`${entry.id}: ${slots.refused}`);
  const moves = slots.moves;
  const pointer = entry.pointer ?? slots.pointer;
  const bg = entry.engine.map(backgroundOf).find(Boolean);
  const Backdrop = bg ? backdrops[bg.component] : null;
  // Each slot as long as its scene needs for its action to complete (rules.mjs, the same as the plan).
  const knownOf = (name: string) => (isComposed(name) ? undefined : sceneOf(name));
  const { frames: lengths } = slotLengths(
    moves.map((name, i) => {
      const known = knownOf(name);
      return known ? sceneNeed(timingFor(measured, known.name, energyOf(entry), known.seconds), FPS, { first: i === 0 }) : null;
    }),
  );
  return (
    <>
      {Backdrop ? <Backdrop energy={backdropEnergy[energyOf(entry)]} /> : null}
      {moves.length ? (
      <Series>
        {moves.map((name, i) => {
          const known = knownOf(name);
          const frames = lengths[i];
          return (
            <Series.Sequence key={`${name}-${i}`} durationInFrames={frames}>
              {known ? (
                <SceneMove known={known} page={page} format={format} energy={energyOf(entry)} frames={frames} first={i === 0} />
              ) : (
                <CaptureMove name={name} capture={capture} page={page} energy={energyOf(entry)} frames={frames} pointer={pointer} />
              )}
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

/** One row of the measuring reel: a standalone scene and the seconds it plays. */
export type ReelItem = { name: string; seconds: number };
export type SceneReelProps = { items: ReelItem[]; lead: number; dark?: number; energy: Energy };

/**
 * Every standalone scene back to back at 16:9 on the light page, after `lead` seconds of empty light page and `dark`
 * seconds of empty dark page (so both empty pages can be recognised), for
 * tools/styles/scene-timing.mjs to measure when each is built, empty or changing, and how wide it draws.
 */
export const SceneReel: FC<SceneReelProps> = ({ items, lead, dark = 0, energy }) => {
  const { fps } = useVideoConfig();
  return (
    <BrandProvider brand="demo">
      <MotionProvider preset={energy as PresetName}>
        <Stage name="light">
          <Series>
            <Series.Sequence durationInFrames={Math.max(1, Math.round(lead * fps))}>{null}</Series.Sequence>
            {dark > 0 ? (
              <Series.Sequence durationInFrames={Math.round(dark * fps)}>
                <Stage name="dark">{null}</Stage>
              </Series.Sequence>
            ) : null}
            {items.map((item) => {
              const known = sceneOf(item.name);
              if (!known) throw new Error(`${item.name} has no standalone scene`);
              return (
                <Series.Sequence key={item.name} durationInFrames={Math.round(item.seconds * fps)}>
                  <known.Scene page="light" format="16:9" />
                </Series.Sequence>
              );
            })}
          </Series>
        </Stage>
      </MotionProvider>
    </BrandProvider>
  );
};

export const SceneReelComposition: FC = () => (
  <Composition
    id="style-scene-reel"
    component={SceneReel}
    width={480}
    height={270}
    fps={FPS}
    durationInFrames={1}
    defaultProps={{ items: [], lead: 1, energy: 'confident' } satisfies SceneReelProps}
    calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round(props.lead * FPS) + Math.round((props.dark ?? 0) * FPS) + props.items.reduce((n, i) => n + Math.round(i.seconds * FPS), 0)) })}
  />
);
