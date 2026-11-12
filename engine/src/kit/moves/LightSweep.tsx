// Light sweep: one soft band of light crosses a surface once. On a reveal only; it never loops.
import type { CSSProperties, FC, ReactNode } from 'react';
import { useBrand } from '../brand';
import { easing, lerp, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import { lightOf } from './core';

/** How bright the middle of the band is: 15 to 25%. */
const BRIGHT = 0.22;
/**
 * Light does not show on a surface that is already as light as it is. So the band also carries a wider, fainter
 * wash of the accent: on a near-white card the sweep is seen as a breath of the accent passing; on an accent
 * fill or a dark surface the wash is lost and the light is what shows. This is the strength of the wash.
 */
const WASH = 0.13;
/** The band: its width and the room its lean needs outside the surface, as percentages of the surface, and its lean in degrees. */
const BAND = { width: 45, room: 20, lean: -18 } as const;

/**
 * Wraps a surface (a card, a window, a button) and sends a band of light across it from left to right at `at`,
 * over a `scene` length. The light is the brand's lightest ink with a faint wash of the accent around it, so it
 * shows on dark pages, accent fills, product captures and near-white cards alike. `radius` is the corner radius
 * of the surface as a percentage of frame height (the brand's window radius if left out).
 */
export const LightSweep: FC<{ children: ReactNode; at: number; radius?: number; style?: CSSProperties }> = ({ children, at, radius, style }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const crossed = progress(m.t, at, at + m.seconds('scene'), easing.travel);
  const light = lightOf(brand);
  // Two soft bells, one inside the other: the wash is the full width of the band, the light its middle half.
  const bell = (colour: string, strength: number, from: number, to: number) =>
    `linear-gradient(90deg, ${alpha(colour, 0)} ${from}%, ${alpha(colour, strength * 0.5)} ${lerp(from, to, 0.28)}%, ${alpha(colour, strength)} 50%, ${alpha(colour, strength * 0.5)} ${lerp(from, to, 0.72)}%, ${alpha(colour, 0)} ${to}%)`;
  const band = `${bell(light, BRIGHT, 22, 78)}, ${bell(stage.accent, WASH, 0, 100)}`;
  return (
    <div style={{ position: 'relative', ...style }}>
      {children}
      {crossed > 0 && crossed < 1 ? (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: vh(radius ?? brand.shape.window), pointerEvents: 'none' }}>
          {/* The band starts and ends fully outside the surface, lean included. */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: `${BAND.width}%`,
              left: `${lerp(-BAND.width - BAND.room, 100 + BAND.room, crossed)}%`,
              background: band,
              transform: `skewX(${BAND.lean}deg)`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
};
