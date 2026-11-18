// On path: text set along a gentle curve that draws on along the path, for a seal, a stamp or a flourish.
import { useId } from 'react';
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { asLines, type TextMoveProps } from './core';
import { flatWords } from './RecentreBuild';
import { useFitSize } from './split';

/** Length of a quadratic curve, by walking it in small steps. */
const curveLength = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) => {
  let length = 0;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= 48; i++) {
    const u = i / 48;
    const x = (1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1;
    const y = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1;
    length += Math.hypot(x - px, y - py);
    px = x;
    py = y;
  }
  return length;
};

/**
 * Sets the text (all lines, as one) along a curve across 86% of the frame width, and draws it on from the left:
 * a stroke along the same curve uncovers the letters as it grows. The curve is drawn from the frame's own width
 * and height, so it scales to every size. `bend` is how far the curve rises, as a share of frame width (default
 * 0.09: gentle); `arc` says whether the middle is above ("up") or below ("down") the ends. The exit erases it the
 * same way, from the left, faster. Starred words are in the accent voice.
 */
export const OnPath: FC<TextMoveProps & { bend?: number; arc?: 'up' | 'down' }> = ({ lines, at, out, size = 7, colours, style, bend = 0.09, arc = 'up' }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const { width, height } = useVideoConfig();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sentence = asLines(lines).join(' ');
  const x0 = width * 0.07;
  const x1 = width * 0.93;
  const lift = (arc === 'up' ? 1 : -1) * width * bend;
  const y0 = height / 2 + lift;
  const cx = width / 2;
  const cy = height / 2 - lift;
  const length = curveLength(x0, y0, cx, cy, x1, y0);
  // Fit the text to 90% of the curve's length (useFitSize works in shares of the frame width).
  const fontSize = useFitSize([sentence], size, (length * 0.9) / width);
  const { headline, accent } = brand.fonts;
  const drawn = progress(m.t, at, at + m.seconds('hero'), easing.travel);
  const erased = out === undefined ? 0 : progress(m.t, out, out + m.seconds('hero') * EXIT_SHARE, easing.leave);
  const words = flatWords([sentence])[0];
  const d = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y0}`;
  const colour = stage[colours?.[0] ?? 'ink'];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', ...style }}>
      <defs>
        <path id={`p${id}`} d={d} />
        <mask id={`m${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          {/* The pen: a wide stroke along the curve; the letters show only where it has been. */}
          <path d={d} fill="none" stroke="white" strokeWidth={fontSize * 2.4} strokeDasharray={`${length} ${length * 2}`} strokeDashoffset={length * (1 - drawn) - length * erased} />
        </mask>
      </defs>
      <g mask={`url(#m${id})`}>
        <text
          fill={colour}
          fontFamily={headline.css}
          fontStyle={headline.style}
          fontWeight={headline.weight}
          fontSize={fontSize}
          letterSpacing={headline.tracking === undefined ? undefined : `${headline.tracking}em`}
          textAnchor="middle"
          style={{ whiteSpace: 'pre' }}
        >
          <textPath href={`#p${id}`} startOffset="50%">
            {words.map((w, i) => (
              <tspan key={i} {...(w.accent ? { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: fontSize * accent.scale } : {})}>
                {i > 0 ? ' ' : ''}
                {w.text}
              </tspan>
            ))}
          </textPath>
        </text>
      </g>
    </svg>
  );
};
