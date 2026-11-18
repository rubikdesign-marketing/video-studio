// Question: a question builds word by word with a caret running after it; the last word lands in the accent voice
// and the caret keeps blinking after it.
import type { FC } from 'react';
import { easing, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { Centred, HookText, Opener, starLast, useHookLayout, type OpenerProps } from './core';

/**
 * Words arrive about 0.28 s apart, the first already in frame at 0. A caret follows the newest word and, once the
 * question is complete, blinks twice a second (a small mark: nowhere near the flash limit) while the last word, in
 * the accent voice, pulses once. Write the question's mark inside the last word: "Can you merge two *workspaces?*".
 * Sound: a soft tick per word, a chime or pop on the last.
 * Props: `line` (the last word is set in the accent voice when none is starred), `gap` (seconds between words), `at`, `out`, `next`, `size`.
 */
export const Question: FC<OpenerProps & { line: string; gap?: number }> = ({ line, gap, at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const t = m.t - at;
  const text = starLast(line);
  const layout = useHookLayout(text, { size, balance: true });
  const words = layout.rows.flatMap((r) => r.words);
  const step = gap ?? m.seconds('base') * 0.7;
  const start = (i: number) => (i - 1) * step;
  const shown = (i: number) => progress(t, start(i), start(i) + m.seconds('quick') * 0.9, easing.arrive);
  const newest = Math.min(words.length - 1, Math.max(0, Math.floor(t / step) + 1));
  const done = t >= (words.length - 1) * step + m.seconds('quick');
  const blink = Math.floor(Math.max(0, t - (words.length - 1) * step) / 0.25) % 2 === 0;
  const pulseAt = (words.length - 1) * step + m.seconds('quick');
  const pulse = t > pulseAt ? Math.max(0, Math.sin(((t - pulseAt) / 0.5) * Math.PI)) : 0;
  const caret = layout.size * 0.07;
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        <HookText
          layout={layout}
          word={(w) => {
            const u = shown(w.index);
            const last = w.index === words.length - 1;
            return { opacity: u, translate: `0 ${(1 - u) * layout.size * 0.2}px`, scale: last ? String(1 + 0.08 * pulse) : undefined, transformOrigin: '50% 80%' };
          }}
          decorate={(w) =>
            w.index === newest && (!done || blink) ? (
              <span style={{ position: 'absolute', left: `calc(100% + ${caret}px)`, top: '14%', width: caret, height: '74%', background: stage.accent, borderRadius: caret }} />
            ) : null
          }
        />
      </Centred>
    </Opener>
  );
};
