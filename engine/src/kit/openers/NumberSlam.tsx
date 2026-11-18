// Number slam: a big old number lands, is struck through, and a new one slams in under it. The stat is the hook.
import type { FC } from 'react';
import { easing, lerp, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { Bar, Centred, HookText, Opener, useHookLayout, type OpenerProps } from './core';

/**
 * The old figure (`from`, in the stage's second colour) is on screen at once, slamming down to size; a strike
 * draws through it; then the new figure (`to`, in ink, a starred word in the accent voice) slams in below with a
 * short shake when `shake` is set (off by default: screen shakes are banned unless the owner says yes for the film,
 * knowledge/craft/03-transitions.md). Both figures are hook-sized. Nothing flashes: the slam is a scale and a shake, not a colour change.
 * Sound: impact on each slam, a soft tick as the strike draws.
 * Props: `from`, `to` (for example "3 hours" and "3 *minutes*"), `at`, `out`, `next`, `size`, `shake`.
 */
export const NumberSlam: FC<OpenerProps & { from: string; to: string; shake?: boolean }> = ({ from, to, at = 0, out, next, size = 17, style, shake: shaking = false }) => {
  const m = useMotion();
  const stage = useStage();
  const t = m.t - at;
  const before = useHookLayout(from, { size: size * 0.85, maxLines: 2 });
  const after = useHookLayout(to, { size, maxLines: 2 });
  const first = m.settle(at, 'quick');
  const strikeAt = m.seconds('scene') * 1.1;
  const strike = progress(t, strikeAt, strikeAt + m.seconds('quick'), easing.arrive);
  const landAt = strikeAt + m.seconds('quick') * 0.9;
  const land = m.settle(at + landAt, 'quick');
  const since = t - landAt;
  const shake = shaking && since > 0 && since < 0.3 ? Math.sin(since * 70) * (1 - since / 0.3) * before.short * 0.012 : 0;
  const fade = progress(t, landAt, landAt + m.seconds('base'), easing.arrive);
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        <div style={{ translate: `${shake}px ${shake * 0.6}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: before.size * 0.15 }}>
          <div style={{ scale: String(lerp(1.7, 1, Math.min(1.08, first))), opacity: lerp(1, 0.55, fade), transformOrigin: '50% 60%' }}>
            <HookText
              layout={before}
              colour={stage.second}
              rowDecor={(_, row) => (
                <Bar width={row.width} thickness={before.size * 0.09} share={strike} colour={stage.warm} style={{ position: 'absolute', left: 0, top: '52%' }} />
              )}
            />
          </div>
          <div style={{ scale: String(t < landAt ? 0 : lerp(2.4, 1, Math.min(1.06, land))), opacity: t < landAt ? 0 : 1, transformOrigin: '50% 50%' }}>
            <HookText layout={after} />
          </div>
        </div>
      </Centred>
    </Opener>
  );
};
