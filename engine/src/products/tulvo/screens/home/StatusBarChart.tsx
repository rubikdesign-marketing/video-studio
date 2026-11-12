/**
 * "Status (bar)" widget body: recharts BarChart as rendered in home-dashboard.html, rebuilt as
 * plain SVG. One bar per category, coloured chart-1..chart-7 by position; zero bars are not drawn
 * (recharts skips zero-height rectangles); value labels sit 5px above each bar.
 *
 * No entry animation: measured live (21 Oct, research/ui-live/day3/README.md) the bars mount at full
 * height with their labels, so there is no grow-in prop. Value labels are hidden whenever any value is
 * fractional (recharts hides LabelList mid-animation), so they never show a number the app never renders.
 */
import React from "react";
import { bandLayout, chartVar, formatCount, isSettled, niceMax, niceTicks, preserveStartEndTicks, topRoundedRectPath } from "./chartMath";
import type { HomeCategory } from "./types";
import { GridLine, RECHARTS_CONTAINER_CLASS, RechartsBox, TickLabel, ValueLabel } from "./WidgetChrome";

/** Plot margins measured from the DOM (clipPath x=4 y=20 w=314 h=198 in a 324x246 surface). */
const M = { top: 20, right: 6, bottom: 28, left: 4 };

export type StatusBarChartProps = {
  /** Chart surface size (the widget body). Captured: 324 x 246. */
  width: number;
  height: number;
  /** Whole counts. Not for live morphing (the live Home does not update while open). */
  categories: HomeCategory[];
  /** Freeze the Y scale while values animate: build it as if the data max were this value
   *  (e.g. 3 -> 0..3). null = from the current values, like the app. */
  scaleDataMax?: number | null;
};

export const StatusBarChart: React.FC<StatusBarChartProps> = ({ width, height, categories, scaleDataMax = null }) => {
  const x0 = M.left;
  const y0 = M.top;
  const pw = Math.max(0, width - M.left - M.right);
  const ph = Math.max(0, height - M.top - M.bottom);
  const dataMax = scaleDataMax ?? categories.reduce((m, c) => Math.max(m, c.value), 0);
  const top = niceMax(dataMax);
  const ticks = niceTicks(dataMax);
  const py = (v: number) => y0 + ph - (top > 0 ? (v / top) * ph : 0);
  const band = bandLayout(categories.length, x0, pw);
  const showLabels = isSettled(categories.map((c) => c.value));
  const bars = categories.map((c, i) => {
    const h = Math.max(0, top > 0 ? (Math.max(0, c.value) / top) * ph : 0);
    const x = band.barX(i);
    const y = y0 + ph - h;
    return { i, x, y, w: band.barWidth, h, value: c.value };
  });
  const tickY = y0 + ph + 14;
  const xTicks = preserveStartEndTicks(
    categories.map((c, i) => ({ text: c.label, coordinate: band.center(i) })),
    0,
    width,
  );

  return (
    <div className={`${RECHARTS_CONTAINER_CLASS} h-full min-h-[180px] w-full flex-1`} style={{ "--color-value": "hsl(var(--chart-1))" } as React.CSSProperties}>
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
        <g className="recharts-zIndex-layer_300">
          <g className="recharts-layer recharts-bar">
            <g className="recharts-layer recharts-bar-rectangles">
              <g className="recharts-layer">
                {bars
                  .filter((b) => b.h > 0)
                  .map((b) => (
                    <g key={b.i} className="recharts-layer recharts-bar-rectangle">
                      <g className="recharts-layer recharts-inactive-bar">
                        <path
                          opacity={1}
                          x={b.x}
                          y={b.y}
                          width={b.w}
                          height={b.h}
                          fill={chartVar(b.i)}
                          className="recharts-rectangle"
                          d={topRoundedRectPath(b.x, b.y, b.w, b.h, 3)}
                        />
                      </g>
                    </g>
                  ))}
              </g>
            </g>
          </g>
        </g>
        <g className="recharts-zIndex-layer_2000">
          <g className="recharts-cartesian-axis-tick-labels recharts-xAxis-tick-labels">
            {xTicks.filter((t) => t.show).map((t, i) => (
              <TickLabel key={i} x={t.tickCoord} y={tickY} text={t.text} />
            ))}
          </g>
          {showLabels ? (
            <g className="recharts-layer recharts-label-list">
              {bars
                .filter((b) => b.h > 0)
                .map((b) => (
                  <ValueLabel key={b.i} x={b.x + b.w / 2} y={b.y - 5} fill={chartVar(b.i)} text={formatCount(b.value)} />
                ))}
            </g>
          ) : null}
        </g>
      </RechartsBox>
    </div>
  );
};
