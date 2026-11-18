// Punch in: the line is in frame at once, then the camera cuts hard to a tight crop on its key word and eases back
// out to the full line. The pattern interrupt of a handheld zoom, made in the engine.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { easing, lerp, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { Bar, Centred, HookText, Opener, starLast, useHookLayout, wordCentre, type OpenerProps } from './core';

/**
 * A slow creep in on the whole line, then one hard cut to a tight crop on the starred word (the last word when none
 * is starred), and an ease out to the full line. The cut is a planned instant change (one frame); nothing flashes.
 * Sound: impact on the cut.
 * Props: `line` (the hook, star a word to aim the punch at it), `at`, `out`, `next`, `size`.
 */
export const PunchIn: FC<OpenerProps & { line: string }> = ({ line, at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const { width } = useVideoConfig();
  const t = m.t - at;
  const text = starLast(line);
  const layout = useHookLayout(text, { size });
  const focus = layout.rows.flatMap((r) => r.words).find((w) => w.accent) ?? layout.rows[0].words[0];
  const centre = wordCentre(layout, focus);
  const cut = m.seconds('base') * 0.9;
  const tight = Math.min(2.6, (width * 0.9) / focus.width);
  const back = progress(t, cut, cut + m.seconds('hero') * 1.3, easing.arrive);
  const creep = 1 + 0.06 * progress(t, 0, cut, easing.travel);
  const scale = t < cut ? creep : lerp(tight, 1, back);
  const bar = progress(t, cut + m.seconds('hero') * 0.9, cut + m.seconds('hero') * 1.4, easing.arrive);
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        <div style={{ transformOrigin: `${centre.x}px ${centre.y}px`, scale: String(scale), display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <HookText layout={layout} />
          <Bar width={layout.width} thickness={layout.size * 0.07} share={bar} colour={stage.accent} style={{ marginTop: layout.size * 0.2 }} />
        </div>
      </Centred>
    </Opener>
  );
};
