// Count with its bar: a number counts up while its bar grows, and the two finish on the same frame.
import type { CSSProperties, FC } from 'react';
import { useBrand } from '../brand';
import { useMotion, type TimingToken } from '../motion';
import { useStage, useVh } from '../ui';
import { BarGrow } from './BarGrow';
import { countAt, Figures, useCue, useGrowth, voiceStyle, written } from './core';

/** A unit sits beside the number at this share of its size. */
const UNIT_SIZE = 0.6;

/**
 * A number counting from `from` to `value` in fixed-width figures. It starts from rest at `at`, slows into the
 * final value and shows it only on its last frame. Anything grown with the same `at` and `over` (a BarGrow, a
 * RingSweep, a LineDraw) finishes on that frame too. It is text only: set it inside type of your own.
 */
export const Count: FC<{ value: number; at: number; from?: number; over?: TimingToken; decimals?: number }> = ({
  value,
  at,
  from = 0,
  over = 'scene',
  decimals = 0,
}) => {
  const { grown, done } = useGrowth(at, over);
  return <Figures text={written(countAt(from, value, grown, done, decimals), decimals)} />;
};

/**
 * One number that matters, with a short label and a bar. The label and the faint track arrive at `at`; the count
 * and the bar start together a `quick` later (or at `countAt`) and end together. `max` is the value of a full
 * bar, so the bar starts at zero and is never cut. `width` and `size` are percentages of frame height.
 */
export const CountWithBar: FC<{
  value: number;
  max: number;
  at: number;
  countAt?: number;
  out?: number;
  label?: string;
  prefix?: string;
  unit?: string;
  decimals?: number;
  width?: number;
  size?: number;
  style?: CSSProperties;
}> = ({ value, max, at, countAt: countFrom, out, label, prefix, unit, decimals, width = 56, size = 14, style }) => {
  const m = useMotion();
  const fonts = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  const shell = useCue(at, out, 'quick');
  const start = countFrom ?? at + m.seconds('quick');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: vh(2),
        width: vh(width),
        opacity: shell.enter * (1 - shell.exit),
        translate: `0 ${(1 - shell.settle) * vh(1.2)}px`,
        ...style,
      }}
    >
      {label ? <div style={{ ...voiceStyle(fonts.label, vh(3)), color: stage.second }}>{label}</div> : null}
      <div style={{ ...voiceStyle(fonts.label, vh(size)), lineHeight: 1, whiteSpace: 'pre', color: stage.ink }}>
        {prefix}
        <Count value={value} at={start} decimals={decimals} />
        {unit ? <span style={{ fontSize: `${UNIT_SIZE}em` }}>{unit}</span> : null}
      </div>
      <BarGrow share={value / max} at={start} over="scene" grow="right" length={width} track emphasis />
    </div>
  );
};
