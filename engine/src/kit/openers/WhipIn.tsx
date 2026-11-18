// Whip in: a whip-pan across the frame. An accent-coloured streak whips out to the left while the hook line whips in
// from the right and stops dead, both motion blurred along the pan.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useMotion } from '../motion';
import { MotionBlur, useTravel } from '../moves/core';
import { useStage } from '../ui';
import { Centred, HookText, hit, Opener, useHookLayout, type OpenerProps } from './core';

/**
 * Already panning at frame 0: a full-frame accent panel (with two thin bands trailing it) whips off to the left
 * over about 0.5 s, and the line arrives from the right over about 0.7 s, braking hard to rest. The blur follows the
 * speed, so the line is sharp as soon as it is slow enough to read. The only colour change is the panel leaving
 * once, at the pan's speed, not a flash.
 * Sound: a whoosh across, a hit as the line stops.
 * Props: `line`, `at`, `out`, `next`, `size`.
 */
export const WhipIn: FC<OpenerProps & { line: string }> = ({ line, at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const travel = useTravel();
  const { width, height } = useVideoConfig();
  const layout = useHookLayout(line, { size });
  const panelRun = m.seconds('scene') * 0.7;
  const textRun = m.seconds('hero') * 0.45;
  const panel = (time: number) => -width * 1.1 * hit((time - at) / panelRun);
  const text = (time: number) => width * 1.15 * (1 - hit((time - at) / textRun));
  return (
    <Opener out={out} next={next} style={style}>
      <MotionBlur fill x={travel(panel)}>
        <div style={{ position: 'absolute', inset: 0, translate: `${panel(m.t)}px 0`, background: stage.accent }} />
        {[0.3, 0.62].map((y, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, width: width, top: height * y, height: height * 0.035, background: stage.accent, translate: `${panel(m.t) * (1.5 + i * 0.4) + width * 0.4}px 0`, opacity: 0.8 }} />
        ))}
      </MotionBlur>
      <Centred>
        <MotionBlur x={travel(text)}>
          <div style={{ translate: `${text(m.t)}px 0` }}>
            <HookText layout={layout} />
          </div>
        </MotionBlur>
      </Centred>
    </Opener>
  );
};
