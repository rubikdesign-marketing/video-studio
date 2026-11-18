// Spotlight: the frame starts dark, with a pool of light already travelling in from the edge onto the line; the light
// widens until the frame is lit.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, lerp, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { Centred, HookText, Opener, useHookLayout, type OpenerProps } from './core';

/**
 * A dark cover (the brand's dark page) with a soft hole in it. The hole starts at the left edge of the frame, moves
 * onto the middle of the line, then grows past the frame's corners. The line drifts in very slowly under it. Moves
 * in about 1.3 s, fully lit by about 2.6 s. The darkness leaves gradually; nothing flashes.
 * Sound: a low riser, a soft hit as the light reaches the line.
 * Props: `line`, `at`, `out`, `next`, `size`.
 */
export const Spotlight: FC<OpenerProps & { line: string }> = ({ line, at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const dark = useBrand().stages.dark;
  const { width, height } = useVideoConfig();
  const t = m.t - at;
  const layout = useHookLayout(line, { size });
  const travel = progress(t, 0, m.seconds('hero') * 0.9, easing.arrive);
  const open = progress(t, m.seconds('hero') * 0.55, m.seconds('hero') * 1.7, easing.travel);
  const reach = Math.hypot(width, height);
  const x = lerp(-width * 0.05, width * 0.5, travel);
  const y = lerp(height * 0.62, height * 0.5, travel);
  const radius = lerp(Math.min(width, height) * 0.62, reach * 0.8, open);
  const cover = `radial-gradient(circle ${radius}px at ${x}px ${y}px, transparent 0%, transparent 52%, ${alpha(dark.page, 0.8)} 82%, ${alpha(dark.page, 0.98)} 100%)`;
  const glow = `radial-gradient(circle ${radius * 0.8}px at ${x}px ${y}px, ${alpha(stage.accent, 0.2 * (1 - open))} 0%, transparent 70%)`;
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        <div style={{ scale: String(lerp(1.05, 1, progress(t, 0, m.seconds('hero') * 1.8, easing.travel))) }}>
          <HookText layout={layout} />
        </div>
      </Centred>
      <div style={{ position: 'absolute', inset: 0, background: glow }} />
      <div style={{ position: 'absolute', inset: 0, background: cover, opacity: 1 - progress(t, m.seconds('hero') * 1.2, m.seconds('hero') * 1.9, easing.leave) }} />
    </Opener>
  );
};
