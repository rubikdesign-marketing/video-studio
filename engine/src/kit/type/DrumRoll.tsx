// Drum roll: every letter is a drum that rolls up through the alphabet and stops on its own letter, one drum
// after another, blurred while it spins and sharp as it stops. For a name or a word that is "dialled in".
// After Leonxlnx/cinetic, "slot text" (MIT).
import type { FC } from 'react';
import { easing, progress, rng } from '../motion';
import { MotionBlur, useTravel } from '../moves/core';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { rankOf, SplitText, useFitSize, type Order } from './split';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const poolFor = (ch: string) => (/[A-Z]/.test(ch) ? UPPER : /[a-z]/.test(ch) ? LOWER : /\d/.test(ch) ? DIGITS : '');
/** Distance from one letter on the drum to the next, in em: more than the window is high, so only one shows at rest. */
const PITCH = 1.3;

/**
 * Each letter is a drum in a window as wide and as high as its real letter. From its turn the drum rolls upwards
 * through six to ten letters of the alphabet (its own case) and slows to a stop on the right one; the first
 * letters turn first (`order`, default left to right). While it spins it is blurred along its roll; when it
 * stops, it is sharp and unclipped (descenders and all). Punctuation does not spin.
 */
export const DrumRoll: FC<TextMoveProps & { order?: Order; seed?: number }> = ({ lines, at, out, size = 9, align = 'center', colours, style, order = 'start', seed = 6 }) => {
  const clock = useTextClock(at, out, 'letter');
  const { m } = clock;
  const travel = useTravel();
  const fontPx = useFitSize(asLines(lines), size);
  const enter = progress(m.t, at, at + m.seconds('quick'));
  const gap = m.seconds('tick') * 0.6;
  const roll = m.seconds('scene') * 1.3;
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by="letter"
      style={{ opacity: enter * (1 - clock.exit), ...style }}
      piece={() => ({ position: 'relative' })}
      content={(p) => {
        const pool = poolFor(p.text);
        if (!pool) return p.text;
        const steps = 6 + Math.floor(rng(seed * 4999 + p.index * 211)() * 5);
        const begin = at + rankOf(order, p.index, p.count) * gap;
        const turned = (t: number) => steps * progress(t, begin, begin + roll, easing.arrive);
        const done = m.t >= begin + roll;
        if (done) return p.text;
        const base = pool.indexOf(p.text);
        const whole = Math.floor(turned(m.t));
        const part = turned(m.t) - whole;
        const glyph = (k: number) => pool[(((base - steps + k) % pool.length) + pool.length) % pool.length];
        const speed = travel((t) => turned(t) * PITCH * fontPx);
        return (
          <span style={{ display: 'inline-block', position: 'relative', clipPath: 'inset(0 -0.04em)', verticalAlign: 'top' }}>
            <span style={{ visibility: 'hidden' }}>{p.text}</span>
            <MotionBlur y={speed} fill>
              <DrumFace now={glyph(whole)} next={glyph(whole + 1)} part={part} />
            </MotionBlur>
          </span>
        );
      }}
    />
  );
};

/** Two letters of the drum, the one leaving and the one arriving, offset by how far it has turned. */
const DrumFace: FC<{ now: string; next: string; part: number }> = ({ now, next, part }) => (
  <>
    <span style={{ position: 'absolute', left: '-0.2em', right: '-0.2em', top: 0, textAlign: 'center', translate: `0 ${-part * PITCH}em` }}>{now}</span>
    <span style={{ position: 'absolute', left: '-0.2em', right: '-0.2em', top: 0, textAlign: 'center', translate: `0 ${(1 - part) * PITCH}em` }}>{next}</span>
  </>
);
