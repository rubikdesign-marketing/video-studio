// Sheet: a scene painted on a piece of the page that looks exactly like the stage under it, lights and all, so a
// transition can fold, turn or cut a scene into pieces without the page changing colour where it does. Shared by
// CubeTurn, CardFlip, PageTurn and TileReveal (transitions batch 3).
import type { CSSProperties, FC, ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { useRealTime } from '../motion';
import { alpha, type StageName } from '../tokens';
import { useStage, useVh } from '../ui';

/**
 * How far a stage light wanders, as a percentage of frame height. The same number as the stage's own (DRIFT in
 * ui.tsx, which is not exported): if that one changes, change this one, or a sheet stops matching the stage.
 */
const DRIFT = 2.5;

/** The name of the page this component sits on. */
export const useStageName = (): StageName => {
  const brand = useBrand();
  const stage = useStage();
  return stage === brand.stages.dark ? 'dark' : 'light';
};

/**
 * The stage's page as a CSS background for a box the size of the frame at the frame's origin: its colour and its
 * light pools, drifting on the film's real clock exactly as the Stage draws them. Grain and vignette are not here:
 * the Stage draws those over everything, sheets included.
 */
export const usePagePaint = (): CSSProperties => {
  const now = useRealTime();
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const brand = useBrand();
  const name = useStageName();
  const look = brand.looks[name];
  const pools = look.lights.map((light, i) => {
    const x = light.x * width + vh(DRIFT) * (Math.sin(now * 0.11 + i * 2.1) + 0.4 * Math.sin(now * 0.23 + i * 0.7));
    const y = light.y * height + vh(DRIFT) * (Math.cos(now * 0.09 + i * 1.3) + 0.4 * Math.sin(now * 0.19 + i * 2.9));
    const radius = light.radius * height * (1 + 0.04 * Math.sin(now * 0.15 + i * 1.9));
    const stops = [1, 0.45, 0].map((share) => alpha(light.colour, light.opacity * share));
    return `radial-gradient(${radius}px ${radius}px at ${x}px ${y}px, ${stops[0]} 0%, ${stops[1]} 38%, ${stops[2]} 72%)`;
  });
  return { backgroundColor: brand.stages[name].page, backgroundImage: pools.length ? pools.join(', ') : undefined };
};

/**
 * A frame-sized sheet of the page with a scene on it. Laid flat at the frame's origin it cannot be told from the
 * stage. `cut` shows only that rectangle of it (pixels in the frame), placed where it is in the frame: the
 * pieces of a tile grid or the strips of a page are cuts of one sheet. `blank` paints the page with no scene, for
 * the back of a page. `style` is for the box (transforms, shadows, radius).
 */
export const Sheet: FC<{ children?: ReactNode; cut?: { x: number; y: number; width: number; height: number }; style?: CSSProperties; inner?: CSSProperties }> = ({
  children,
  cut,
  style,
  inner,
}) => {
  const { width, height } = useVideoConfig();
  const paint = usePagePaint();
  const box = cut ?? { x: 0, y: 0, width, height };
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, overflow: 'hidden', ...style }}>
      <div style={{ position: 'absolute', left: -box.x, top: -box.y, width, height, ...paint, ...inner }}>{children}</div>
    </div>
  );
};

/** A layer the size of the frame, for the scenes inside a sheet. */
export const fill: CSSProperties = { position: 'absolute', inset: 0 };
