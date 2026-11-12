// Editorial: a page with generous margins marked by thin rules, like a magazine spread, and slow bands of light
// crossing it one after another, always the same way. The rules stay still; only the light moves.
import type { FC } from 'react';
import { alpha } from '../tokens';
import { band, Fill, pool, useBackdrop, type BackgroundProps } from './shared';

/** Margins as shares of the frame, and how many columns the short marks along each rule divide the page into. */
const MARGIN_X = 0.06;
const MARGIN_Y = 0.09;
const COLUMNS = 4;
/** The band of light: its angle in degrees, its half width and how far it moves each second at "alive", both in % of the way across the frame. */
const ANGLE = 100;
const HALF = 34;
const PACE = 2.4;

export const Editorial: FC<BackgroundProps> = ({ energy = 'rest', seed = 1 }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height, vh, hair } = b;
  // Two bands half a crossing apart, so that as one leaves the page the other is in the middle of it. Each is out
  // of sight when it starts again, so nothing jumps.
  const crossing = 100 + HALF * 2;
  const at = b.travel(0, PACE, crossing);
  const lights = [at, (at + crossing / 2) % crossing].map((place) => band(dark ? stage.soft : b.bright, dark ? 0.7 : 0.9, ANGLE, place - HALF, HALF));
  const corner = pool(stage.soft, dark ? 0.35 : 0.45, width * 0.95 + b.drift(1, 10), height * 1.02 + b.drift(2, 6), height * 0.7);

  const left = Math.round(width * MARGIN_X);
  const top = Math.round(height * MARGIN_Y);
  const across = width - left * 2;
  const mark = vh(1.8);
  return (
    <Fill colour={stage.page} layers={[...lights, corner]}>
      {/* The top rule is the stronger one, as on a printed page. */}
      <div style={{ position: 'absolute', left, top, width: across, height: hair, background: alpha(stage.ink, 0.22) }} />
      <div style={{ position: 'absolute', left, top: height - top, width: across, height: hair, background: b.rule }} />
      {Array.from({ length: COLUMNS + 1 }, (_, i) => {
        const x = Math.round(left + (across * i) / COLUMNS - (i === COLUMNS ? hair : 0));
        return (
          <div key={i}>
            <div style={{ position: 'absolute', left: x, top, width: hair, height: mark, background: alpha(stage.ink, 0.22) }} />
            <div style={{ position: 'absolute', left: x, top: height - top - mark + hair, width: hair, height: mark, background: b.rule }} />
          </div>
        );
      })}
    </Fill>
  );
};
