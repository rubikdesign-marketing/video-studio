/**
 * "Due Date (trend)" widget body: recharts LineChart as rendered in home-dashboard.html,
 * rebuilt as plain SVG (margins, grid, dots, labels and tick placement match the DOM).
 *
 * Entry animation, measured live on 21 Oct (research/ui-live/day3/README.md): when Home mounts, the
 * line draws in over about 1500 ms with CSS `ease`, starting about 115 ms after the widgets appear.
 * The dots are there from the first frame; the value labels appear when the line is complete.
 */
import React from "react";
import type { TrendPoint } from "../../fixtures";
import { isSettled, niceMax, niceTicks, preserveStartEndTicks } from "./chartMath";
import { GridLine, RECHARTS_CONTAINER_CLASS, RechartsBox, TickLabel, ValueLabel } from "./WidgetChrome";

/** Plot margins measured from the DOM (clipPath x=4 y=22 w=312 h=196 in a 324x246 surface). */
const M = { top: 22, right: 8, bottom: 28, left: 4 };

export type TrendLineChartProps = {
  /** Chart surface size (the widget body). Captured: 324 x 246. */
  width: number;
  height: number;
  points: TrendPoint[];
  /** Line draw-in (the app's entry animation on page load): 0 = no line, 1 = full line. The dots
   *  show throughout; the value labels appear at 1 (measured live). */
  drawProgress?: number;
  /** Freeze the Y scale while values animate: build it as if the data max were this value
   *  (recharts' nice domain for it, e.g. 6 -> 0..8). null = from the current points, like the app. */
  scaleDataMax?: number | null;
};

export const TrendLineChart: React.FC<TrendLineChartProps> = ({ width, height, points, drawProgress = 1, scaleDataMax = null }) => {
  const x0 = M.left;
  const y0 = M.top;
  const pw = Math.max(0, width - M.left - M.right);
  const ph = Math.max(0, height - M.top - M.bottom);
  const dataMax = scaleDataMax ?? points.reduce((m, p) => Math.max(m, p.value), 0);
  const top = niceMax(dataMax);
  const ticks = niceTicks(dataMax);
  const n = points.length;
  // recharts point scale (LineChart category axis): first/last point on the plot edges.
  const px = (i: number) => (n <= 1 ? x0 + pw / 2 : x0 + (i * pw) / (n - 1));
  const py = (v: number) => y0 + ph - (top > 0 ? (v / top) * ph : 0);
  const coords = points.map((p, i) => ({ x: px(i), y: py(p.value) }));
  const d = coords.length ? "M" + coords.map((c) => `${c.x},${c.y}`).join("L") : "";
  const length = coords.reduce((acc, c, i) => (i === 0 ? 0 : acc + Math.hypot(c.x - coords[i - 1].x, c.y - coords[i - 1].y)), 0);
  const p = Math.min(1, Math.max(0, drawProgress));
  // Labels only at the end of the draw, and never for fractional (in-between) values.
  const showLabels = p >= 1 && isSettled(points.map((pt) => pt.value));
  const tickY = y0 + ph + 14;
  const xTicks = preserveStartEndTicks(
    points.map((pt, i) => ({ text: pt.label, coordinate: px(i) })),
    0,
    width,
  );

  return (
    <div className={`${RECHARTS_CONTAINER_CLASS} h-full min-h-[160px] w-full flex-1`} style={{ "--color-value": "hsl(var(--chart-1))" } as React.CSSProperties}>
      <RechartsBox width={width} height={height}>
        <g className="recharts-zIndex-layer_-100">
          <g className="recharts-cartesian-grid">
            <g className="recharts-cartesian-grid-horizontal">
              {[...ticks].reverse().map((t) => (
                <GridLine key={t} x={x0} y={y0} width={pw} height={ph} at={py(t)} />
              ))}
            </g>
          </g>
        </g>
        <g className="recharts-zIndex-layer_400">
          <g className="recharts-layer recharts-line">
            <g className="recharts-layer recharts-shape">
              {d ? (
                <path
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="none"
                  className="recharts-curve recharts-line-curve"
                  strokeDasharray={`${length * p}px ${length}px`}
                  d={d}
                />
              ) : null}
            </g>
          </g>
        </g>
        {coords.length ? (
          <g className="recharts-zIndex-layer_600">
            <g className="recharts-layer recharts-line-dots">
              {coords.map((c, i) => (
                <circle
                  key={i}
                  r={3.5}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  fill="hsl(var(--chart-1))"
                  cx={c.x}
                  cy={c.y}
                  className="recharts-dot recharts-line-dot"
                />
              ))}
            </g>
          </g>
        ) : null}
        <g className="recharts-zIndex-layer_2000">
          <g className="recharts-cartesian-axis-tick-labels recharts-xAxis-tick-labels">
            {xTicks.filter((t) => t.show).map((t, i) => (
              <TickLabel key={i} x={t.tickCoord} y={tickY} text={t.text} />
            ))}
          </g>
          {showLabels ? (
            <g className="recharts-layer recharts-label-list">
              {coords.map((c, i) => (
                <ValueLabel key={i} x={c.x} y={c.y - 8} fill="#808080" text={String(Math.round(points[i].value))} />
              ))}
            </g>
          ) : null}
        </g>
      </RechartsBox>
    </div>
  );
};
