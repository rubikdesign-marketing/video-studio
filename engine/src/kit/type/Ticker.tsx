// Ticker: a band of text that repeats and scrolls across the frame, for headers such as "Launch day Launch day".
import { measureText } from '@remotion/layout-utils';
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { MotionBlur, useTravel, voiceStyle } from '../moves/core';
import { useStage, useVh } from '../ui';
import { asLines, type TextMoveProps } from './core';

/**
 * Each line is a row of its own text, repeated end to end and scrolling across the whole frame width; the rows go
 * in opposite directions. The scroll is a pure function of time and wraps by exactly one repeat, so the loop has
 * no seam. Copies are separated by a wide space only (the studio uses no dots). With `band` the rows sit on
 * brand bands, accent then ink alternately, in the colour that reads on each. `speed` is frame widths per second
 * (default 0.1: slow enough to read). The band opens from its middle on `at` and closes on `out`. Stars are ignored.
 */
export const Ticker: FC<Omit<TextMoveProps, 'align'> & { band?: boolean; speed?: number; gap?: number; top?: number }> = ({
  lines,
  at,
  out,
  size = 6,
  colours,
  style,
  band = true,
  speed = 0.1,
  gap = 1.4,
  top,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const travel = useTravel();
  const { width, height } = useVideoConfig();
  const voice = brand.fonts.headline;
  const fontSize = vh(size);
  const rows = asLines(lines).map((l) => l.replace(/\*/g, ''));
  const rowHeight = fontSize * 1.7;
  const open = progress(m.t, at, at + m.seconds('base'), easing.arrive);
  const close = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  const shown = open * (1 - close);
  const first = top ?? (height - rows.length * rowHeight) / 2;
  const roles = colours ?? [];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}>
      {rows.map((text, r) => {
        const unit =
          measureText({ text, fontFamily: voice.css, fontSize, fontWeight: String(voice.weight), letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em` }).width +
          gap * fontSize;
        const copies = Math.ceil(width / unit) + 2;
        const direction = r % 2 === 0 ? -1 : 1;
        // Distance scrolled since `at`; wrapping by one unit is invisible because the copies are identical.
        const place = (t: number) => direction * (t - at) * speed * width;
        const shift = ((place(m.t) % unit) + unit) % unit - unit;
        const onBand = band && (r % 2 === 0 ? 'accent' : 'ink');
        const fill = onBand ? stage[onBand] : undefined;
        const colour = onBand ? (onBand === 'accent' ? stage.onAccent : stage.page) : stage[roles[Math.min(r, roles.length - 1)] ?? 'ink'];
        return (
          <div
            key={r}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: first + r * rowHeight,
              height: rowHeight,
              overflow: 'hidden',
              background: fill,
              clipPath: `inset(${(1 - shown) * 50}% 0)`,
              opacity: Math.min(1, shown * 3),
            }}
          >
            <MotionBlur x={travel(place)} fill>
              <div style={{ ...voiceStyle(voice, fontSize), color: colour, display: 'flex', alignItems: 'center', height: '100%', width: unit * copies, translate: `${shift}px 0`, whiteSpace: 'pre' }}>
                {Array.from({ length: copies }, (_, c) => (
                  <span key={c} style={{ flex: 'none', boxSizing: 'border-box', width: unit, paddingRight: gap * fontSize }}>
                    {text}
                  </span>
                ))}
              </div>
            </MotionBlur>
          </div>
        );
      })}
    </div>
  );
};
