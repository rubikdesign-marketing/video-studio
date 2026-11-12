// Number roll: the digits of a number roll to their value in fixed-width figures, the last digit landing last.
// For prices, counts and percentages.
import type { CSSProperties, FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion, type Ease } from '../motion';
import { useStage, useVh } from '../ui';
import { figureBox, isDigit, MotionBlur, useTravel, voiceStyle, written } from './core';

/** Distance from one digit to the next on its wheel, in em. More than the height of the window, so a waiting digit is hidden. */
const PITCH = 1.15;
/** Digits a wheel rolls through when the number arrives: the first wheel the fewest, each wheel after it one more, up to the most. */
const STEPS = { fewest: 2, most: 5 } as const;
/** The wheels all start within this share of the roll, however many there are. */
const HEAD_START = 1 / 3;
/**
 * How a wheel with nothing on it turns: half way between `arrive` and `travel`. It is moving from its first frame,
 * at about twice its average speed and never fast enough to strobe, and its last digit lands softly.
 */
const rollIn: Ease = (x) => (easing.arrive(x) + easing.travel(x)) / 2;
/** A separator appears this far into the turn of the wheel before it. */
const SEPARATOR_AFTER = 0.15;
/** A unit sits beside the number at this share of its size. */
const UNIT_SIZE = 0.6;

/**
 * One wheel. `turned` counts digits rolled so far, 0 to `steps`; it ends on `end`. The place before the first
 * digit is `first` (the old digit of an update) or empty (a number that arrives, or a new column). The wheel
 * blurs along its roll while it is fast and is sharp again as it slows into its digit.
 */
const Wheel: FC<{ turned: number; steps: number; end: number; first?: number; speed: number }> = ({ turned, steps, end, first, speed }) => {
  const whole = Math.min(steps, Math.floor(turned));
  const part = turned - whole;
  const digitAt = (place: number) => (place === 0 ? first : (((end - steps + place) % 10) + 10) % 10);
  const [now, next] = [digitAt(whole), digitAt(whole + 1)];
  return (
    <span style={{ ...figureBox, clipPath: 'inset(-0.08em 0)' }}>
      <MotionBlur y={speed}>
        <span style={{ position: 'relative', display: 'inline-block' }}>
          {/* An empty place still holds a figure, unseen, so the wheel keeps its height and its baseline. */}
          <span style={{ display: 'inline-block', translate: `0 ${-part * PITCH}em`, opacity: now === undefined ? 0 : 1 }}>{now ?? end}</span>
          {part > 0 && next !== undefined ? (
            <span style={{ position: 'absolute', left: 0, right: 0, top: 0, translate: `0 ${(1 - part) * PITCH}em` }}>{next}</span>
          ) : null}
        </span>
      </MotionBlur>
    </span>
  );
};

/**
 * A number that rolls to `value` from `at`, finishing one `scene` length later. Each digit is a wheel in a box
 * one figure wide; the wheels start left to right, each slows into its digit, and the last one lands last. Without `from` the number arrives rolling: every wheel comes up from empty through a few digits
 * (never a full spin, which strobes), so no wrong number is ever at rest on screen. With `from`, the old value is
 * on screen before `at` and each digit that changes rolls over to the new one; digits that do not change stay
 * still. An old value must not be written longer than the new one. `unit` is set beside the number at 60% of
 * its size.
 */
export const NumberRoll: FC<{
  value: number;
  at: number;
  from?: number;
  out?: number;
  decimals?: number;
  prefix?: string;
  unit?: string;
  size?: number;
  style?: CSSProperties;
}> = ({ value, at, from, out, decimals = 0, prefix, unit, size = 14, style }) => {
  const m = useMotion();
  const { label } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  const travel = useTravel();

  const chars = [...written(value, decimals)];
  const before = from === undefined ? [] : [...written(from, decimals)];
  // The old value, lined up with the new one from the right.
  const startOf = (i: number) => before[before.length - chars.length + i];
  const wheels = chars.filter(isDigit).length;
  // Wheels start a stagger apart and all turn for the same time, so the last one stops on `at` plus a scene.
  const gap = wheels > 1 ? Math.min(m.stagger, (m.seconds('scene') * HEAD_START) / (wheels - 1)) : 0;
  const turning = m.seconds('scene') - gap * (wheels - 1);
  const pitch = PITCH * vh(size);

  const enter = from === undefined ? progress(m.t, at, at + m.seconds('quick')) : 1;
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  let wheel = 0;
  return (
    <div
      style={{
        ...voiceStyle(label, vh(size)),
        lineHeight: 1,
        whiteSpace: 'pre',
        fontVariantNumeric: 'tabular-nums',
        color: stage.ink,
        opacity: enter * (1 - exit),
        ...style,
      }}
    >
      {prefix}
      {chars.map((char, i) => {
        const old = startOf(i);
        if (!isDigit(char)) {
          // A comma or a point the old value did not have comes in once the wheel before it is turning: never on its own.
          const after = at + Math.max(0, wheel - 1) * gap + turning * SEPARATOR_AFTER;
          return (
            <span key={i} style={{ opacity: old === undefined ? progress(m.t, after, after + m.seconds('quick')) : 1 }}>
              {char}
            </span>
          );
        }
        const first = old !== undefined && isDigit(old) ? Number(old) : undefined;
        const end = Number(char);
        const index = wheel++;
        const begins = at + index * gap;
        // An old digit rolls the short way up to the new one. A wheel with nothing on it rolls in through a few
        // digits; the first wheel never rolls through a zero, so the number never shows a leading zero.
        const arriving = index === 0 ? Math.max(1, Math.min(STEPS.fewest, end)) : Math.min(STEPS.most, STEPS.fewest + index);
        const steps = first === undefined ? arriving : (end - first + 10) % 10;
        // An old digit sets off from rest. A wheel that arrives is already turning when it shows, and slows into its digit.
        const turnedAt = (t: number) => steps * progress(t, begins, begins + turning, first === undefined ? rollIn : easing.travel);
        return <Wheel key={i} turned={turnedAt(m.t)} steps={steps} end={end} first={first} speed={travel((t) => turnedAt(t) * pitch)} />;
      })}
      {unit ? <span style={{ fontSize: `${UNIT_SIZE}em` }}>{unit}</span> : null}
    </div>
  );
};
