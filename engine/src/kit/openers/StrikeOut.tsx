// Strike out: the old belief is written and struck through, then the real claim lands under it. The contrarian hook.
import type { FC } from 'react';
import { easing, lerp, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { Bar, Centred, HookText, Opener, useHookLayout, type OpenerProps } from './core';

/**
 * The belief (`old`, in the stage's second colour) is on screen from the first frame; a strike in the warm colour
 * draws through each row of it, row after row; the belief dims; the claim (`line`) rises in below it, word by word,
 * larger. Both are hook-sized (the belief a little smaller). Nothing flashes.
 * Sound: a short scratch or tick as the strike draws, an impact as the claim lands.
 * Props: `old` (what people believe), `line` (the claim; star a word), `at`, `out`, `next`, `size`.
 */
export const StrikeOut: FC<OpenerProps & { old: string; line: string }> = ({ old, line, at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const t = m.t - at;
  const belief = useHookLayout(old, { size: size === undefined ? 9 : size * 0.72, maxLines: 2 });
  const claim = useHookLayout(line, { size });
  const strikeAt = 0.12;
  const row = m.seconds('quick') * 0.9;
  const struckBy = strikeAt + belief.rows.length * row;
  const dim = progress(t, struckBy, struckBy + m.seconds('base'), easing.arrive);
  const gap = m.seconds('tick') * 0.5;
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: belief.size * 0.7 }}>
          <div style={{ opacity: lerp(1, 0.5, dim), translate: `0 ${-dim * belief.size * 0.15}px` }}>
            <HookText
              layout={belief}
              colour={stage.second}
              rowDecor={(r, info) => (
                <Bar
                  width={info.width}
                  thickness={belief.size * 0.1}
                  share={progress(t, strikeAt + r * row, strikeAt + (r + 1) * row, easing.travel)}
                  colour={stage.warm}
                  style={{ position: 'absolute', left: 0, top: '54%' }}
                />
              )}
            />
          </div>
          <HookText
            layout={claim}
            word={(w) => {
              const u = progress(t, struckBy + w.index * gap, struckBy + w.index * gap + m.seconds('base'), easing.arrive);
              return { opacity: u, translate: `0 ${(1 - u) * claim.size * 0.35}px` };
            }}
          />
        </div>
      </Centred>
    </Opener>
  );
};
