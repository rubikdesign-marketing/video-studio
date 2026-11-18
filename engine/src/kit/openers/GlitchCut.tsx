// Glitch cut: a short digital interruption (the line torn into slices, colour-split, with bars across it) that
// settles into the clean line. Flash safe: nothing changes the whole frame.
import type { FC } from 'react';
import { easing, progress, rng, useMotion } from '../motion';
import { useStage } from '../ui';
import { Centred, HookText, Opener, useHookLayout, type OpenerProps } from './core';

const SLICES = 7;
/** The glitch changes this many times a second: stepped, like a damaged signal. */
const STEPS_PER_SECOND = 14;

/**
 * The line is already torn at frame 0: seven slices slide sideways by seeded amounts, an accent ghost and a second-
 * colour ghost sit either side of it, and thin accent bars cut across. The tearing decays to nothing over about
 * 0.8 s, hiccups once more briefly, and the line is clean. The steps are planned instant changes. No bar is wider
 * than 60% of the frame or taller than 2.4% of it, and the frame itself never changes colour, so it cannot flash.
 * Sound: a glitch burst on the tear, a small one on the hiccup.
 * Props: `line`, `at`, `out`, `next`, `size`.
 */
export const GlitchCut: FC<OpenerProps & { line: string }> = ({ line, at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const t = m.t - at;
  const layout = useHookLayout(line, { size });
  const main = 1 - progress(t, 0, m.seconds('scene') * 1.1, easing.leave);
  const hiccupAt = m.seconds('hero') * 1.3;
  const hiccup = t > hiccupAt && t < hiccupAt + 0.14 ? 0.45 : 0;
  const level = Math.max(main, hiccup);
  const step = Math.floor(Math.max(0, t) * STEPS_PER_SECOND);
  const random = rng(step * 131 + 17);
  const reach = layout.short * 0.14 * level;
  const blockH = layout.height * 1.25;
  const cuts = Array.from({ length: SLICES + 1 }, (_, i) => (i === 0 ? 0 : i === SLICES ? 1 : (i + (random() - 0.5) * 0.6) / SLICES));
  const slices = Array.from({ length: SLICES }, (_, i) => ({ from: cuts[i], to: cuts[i + 1], dx: random() < 0.65 ? (random() - 0.5) * 2 * reach : 0 }));
  const ghost = reach * 0.3 + layout.short * 0.004 * level;
  const bars = Array.from({ length: 3 }, () => ({ y: random(), h: 0.006 + random() * 0.018, w: 0.2 + random() * 0.4, x: random() * 0.6 }));
  const clean = level < 0.02;
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        {clean ? (
          <HookText layout={layout} />
        ) : (
          <div style={{ position: 'relative', width: layout.width, height: blockH }}>
            <div style={{ position: 'absolute', inset: 0, translate: `${ghost}px 0`, opacity: 0.85 }}>
              <HookText layout={layout} colour={stage.accent} style={{ margin: '0 auto' }} />
            </div>
            <div style={{ position: 'absolute', inset: 0, translate: `${-ghost}px 0`, opacity: 0.6 }}>
              <HookText layout={layout} colour={stage.second} style={{ margin: '0 auto' }} />
            </div>
            {slices.map((s, i) => (
              <div key={i} style={{ position: 'absolute', inset: 0, clipPath: `inset(${s.from * 100}% 0 ${(1 - s.to) * 100}% 0)`, translate: `${s.dx}px 0` }}>
                <HookText layout={layout} style={{ margin: '0 auto' }} />
              </div>
            ))}
          </div>
        )}
      </Centred>
      {clean || level < 0.15
        ? null
        : bars.map((b, i) => (
            <div key={i} style={{ position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, background: stage.accent, opacity: 0.9 * level }} />
          ))}
    </Opener>
  );
};
