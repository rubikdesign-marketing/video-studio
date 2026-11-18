// Sudden stop: rows of the hook line rush across the frame, motion blurred, and stop dead on the line, the way a
// ticker or a train stops at a platform.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { easing, progress, useMotion } from '../motion';
import { MotionBlur, useTravel } from '../moves/core';
import { useStage } from '../ui';
import { Bar, Centred, HookText, hit, Opener, rowOf, useHookLayout, type OpenerProps } from './core';

/**
 * Each row of the line is a ribbon of copies of itself that enters at speed (alternate rows from opposite sides)
 * and brakes hard to rest with the line centred. The blur follows the speed and is gone by the time it can be read;
 * the copies fade as it stops, and an accent bar snaps under the line on the stop.
 * Sound: whoosh into a hard impact on the stop.
 * Props: `line`, `at`, `out`, `next`, `size`.
 */
export const SuddenStop: FC<OpenerProps & { line: string }> = ({ line, at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const travel = useTravel();
  const { width } = useVideoConfig();
  const t = m.t - at;
  const layout = useHookLayout(line, { size });
  const run = m.seconds('hero') * 0.8;
  const gap = layout.size * 1.3;
  const stopped = progress(t, run, run + m.seconds('quick'), easing.arrive);
  const decoy = 1 - progress(t, run * 0.3, run * 0.75, easing.leave);
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        <div style={{ position: 'relative', width, height: layout.height }}>
          {layout.rows.map((row, r) => {
            const rowLayout = rowOf(layout, r);
            const dir = r % 2 === 0 ? 1 : -1;
            const reach = 3 * (row.width + gap);
            const place = (time: number) => dir * reach * (1 - hit((time - at) / run));
            const x = travel(place);
            const offset = place(m.t);
            return (
              <MotionBlur key={r} fill x={x} style={{ top: r * layout.lineHeight, height: layout.lineHeight, bottom: 'auto' }}>
                {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
                  <div key={k} style={{ position: 'absolute', top: 0, left: width / 2 + k * (row.width + gap) + offset, translate: '-50% 0', opacity: k === 0 ? 1 : decoy }}>
                    <HookText layout={rowLayout} />
                  </div>
                ))}
              </MotionBlur>
            );
          })}
        </div>
        <Bar width={layout.width} thickness={layout.size * 0.07} share={stopped} colour={stage.accent} style={{ marginTop: layout.size * 0.25 }} />
      </Centred>
    </Opener>
  );
};
