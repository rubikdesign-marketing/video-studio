// Glass: translucent panes at different depths around the edges of the frame. A slow band of light crosses the
// page and shows brighter, and a little displaced, through each pane; every pane has a thin bright top edge and a
// thin dark bottom edge. Panes never overlap (glass never sits on glass) and the middle is left clear.
import type { FC } from 'react';
import { useBrand } from '../brand';
import { alpha } from '../tokens';
import { band, Fill, pool, px, useBackdrop, type BackgroundProps } from './shared';

/** Each pane as shares of the frame. `depth` is 0 far to 1 near: a near pane is clearer and moves further. */
const PANES = [
  { x: 0.04, y: -0.1, w: 0.23, h: 0.46, depth: 0.45 },
  { x: 0.75, y: 0.06, w: 0.17, h: 0.27, depth: 0.6 },
  { x: -0.05, y: 0.6, w: 0.24, h: 0.5, depth: 0.8 },
  { x: 0.79, y: 0.5, w: 0.3, h: 0.44, depth: 1 },
];

/** The band of light: its angle in degrees, its half width and how far it moves each second at "alive", both in % of the way across the frame. */
const ANGLE = 115;
const HALF = 20;
const PACE = 2.4;
/** How much further along the band shows through the nearest pane, in % of the way across the frame. */
const SHIFT = 5;

export const Glass: FC<BackgroundProps> = ({ energy = 'rest', seed = 1 }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height, vh, hair } = b;
  const radius = vh(useBrand().shape.window * 1.6);
  const ray = dark ? stage.second : b.bright;
  // Two bands of light cross the page one after the other, always the same way and half a crossing apart, so one
  // is always on the page. Each is out of sight, through the panes too, when it starts again.
  const crossing = 100 + HALF * 2 + SHIFT;
  const at = b.travel(0, PACE, crossing);
  const centres = [at, (at + crossing / 2) % crossing].map((place) => place - HALF - SHIFT);
  // What a pane is made of: the brightest colour on a light page, the second colour on a dark one, where white glass turns grey.
  const glass = dark ? stage.second : b.bright;

  // The page: the soft fill fading into the page on a light stage, a pool of it on a dark one.
  const wash = dark
    ? pool(stage.soft, 0.85, width * 0.3, height * 0.1, height * 1.15)
    : `linear-gradient(160deg, ${alpha(stage.soft, 0.95)} 0%, ${alpha(stage.soft, 0)} 72%)`;
  const beams = centres.map((centre) => band(ray, dark ? 0.07 : 0.55, ANGLE, centre, HALF));

  return (
    <Fill colour={stage.page} layers={[...beams, wash]}>
      {PANES.map((pane, i) => {
        const clear = 0.5 + 0.5 * pane.depth;
        // Panes have sharp edges, so they move far less than the light: the near ones a little more than the far ones.
        const dx = b.drift(i * 2 + 1, 5 * pane.depth);
        const dy = b.drift(i * 2 + 2, 3.5 * pane.depth);
        const body = `linear-gradient(135deg, ${alpha(glass, (dark ? 0.1 : 0.5) * clear)} 0%, ${alpha(glass, (dark ? 0.02 : 0.12) * clear)} 100%)`;
        // Tinted with the accent at low strength: pure grey glass looks dead.
        const tint = `linear-gradient(${alpha(stage.accent, dark ? 0.09 : 0.04)}, ${alpha(stage.accent, dark ? 0.09 : 0.04)})`;
        const edges = [
          `inset 0 ${hair}px 0 ${alpha(b.bright, (dark ? 0.28 : 0.95) * clear)}`,
          `inset 0 -${hair}px 0 ${alpha(stage.shade, dark ? 0.5 : 0.07)}`,
          `0 0 0 ${hair}px ${alpha(stage.line, dark ? 0.45 : 0.6)}`,
          `0 ${px(vh(3))} ${px(vh(7))} ${alpha(stage.shade, (dark ? 0.35 : 0.07) * clear)}`,
        ];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: width * pane.x,
              top: height * pane.y,
              width: width * pane.w,
              height: height * pane.h,
              translate: `${px(dx)} ${px(dy)}`,
              borderRadius: radius,
              overflow: 'hidden',
              backgroundImage: `${body}, ${tint}`,
              boxShadow: edges.join(', '),
            }}
          >
            {/* The same band of light, seen through the pane: a frame-sized layer held still behind it, brighter and shifted by the pane's depth. */}
            <div
              style={{
                position: 'absolute',
                left: -width * pane.x,
                top: -height * pane.y,
                width,
                height,
                translate: `${px(-dx)} ${px(-dy)}`,
                backgroundImage: centres.map((centre) => band(ray, (dark ? 0.16 : 0.6) * clear, ANGLE, centre + SHIFT * pane.depth, HALF * 0.8)).join(', '),
              }}
            />
          </div>
        );
      })}
    </Fill>
  );
};
