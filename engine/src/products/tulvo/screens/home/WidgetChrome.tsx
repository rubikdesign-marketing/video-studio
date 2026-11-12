/**
 * Shared Home-widget chrome, markup and class strings verbatim from home-dashboard.html.
 */
import React from "react";
import { Ellipsis } from "lucide-react";

/** The "..." widget options button (every widget, top-right). */
export const WidgetOptionsButton: React.FC<{ label?: string }> = ({ label = "Widget options" }) => (
  <div className="shrink-0">
    <div className="flex items-center gap-1">
      <button
        className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-6 w-6 shrink-0 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded="false"
        data-state="closed"
      >
        <Ellipsis className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

/** recharts' wrapper class on every chart container (outline resets). */
export const RECHARTS_CONTAINER_CLASS =
  "[&_svg.recharts-surface]:outline-none [&_svg.recharts-surface]:ring-0 [&_svg.recharts-surface:focus]:outline-none [&_svg.recharts-surface:focus-visible]:outline-none [&_.recharts-sector]:outline-none [&_.recharts-sector]:focus:outline-none [&_.recharts-bar-rectangle]:outline-none [&_.recharts-bar-rectangle]:focus:outline-none [&_.recharts-rectangle]:outline-none [&_.recharts-rectangle]:focus:outline-none [&_.recharts-dot]:outline-none [&_.recharts-dot]:focus:outline-none [&_.recharts-curve]:outline-none [&_.recharts-curve]:focus:outline-none";

/**
 * recharts ResponsiveContainer skeleton: 100% box > 0x0 overflow-visible box > fixed-size wrapper
 * > <svg>. The live app measured the box (ResizeObserver); here the size is computed from the widget
 * size and passed in, so the SVG lands on the same pixels.
 */
export const RechartsBox: React.FC<{ width: number; height: number; children: React.ReactNode; svgProps?: React.SVGProps<SVGSVGElement> }> = ({
  width,
  height,
  children,
  svgProps,
}) => (
  <div className="recharts-responsive-container" style={{ width: "100%", height: "100%", minWidth: 0 }}>
    <div style={{ width: 0, height: 0, overflow: "visible" }}>
      <div className="recharts-wrapper" style={{ position: "relative", cursor: "default", width, height }}>
        <svg
          role="application"
          className="recharts-surface"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "100%", display: "block" }}
          {...svgProps}
        >
          {children}
        </svg>
      </div>
    </div>
  </div>
);

export type ChartCardVariant = "cartesian" | "pie";

/**
 * Card used by the chart widgets (Due Date (trend), Status (bar), Status (pie)):
 * rounded-xl bg-widget, header with title + options button and a muted subtitle.
 */
export const ChartWidgetCard: React.FC<{
  variant: ChartCardVariant;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ variant, title, subtitle, children }) => (
  <div className="group relative flex h-full min-h-0 w-full flex-1 flex-col">
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={
          variant === "pie"
            ? "text-card-foreground relative flex h-full flex-col overflow-hidden rounded-xl border-0 bg-widget"
            : "text-card-foreground flex h-full min-w-0 flex-col rounded-xl border-0 bg-widget"
        }
      >
        <div
          className={
            variant === "pie"
              ? "p-4 flex shrink-0 flex-col gap-1.5 space-y-0 px-6 pt-6 pb-6 text-center sm:text-left"
              : "p-4 flex flex-col gap-1.5 space-y-0 px-6 pt-6 pb-6"
          }
        >
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="tracking-tight min-w-0 flex-1 truncate text-sm font-normal leading-tight text-foreground">{title}</div>
            <WidgetOptionsButton />
          </div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {children}
      </div>
    </div>
  </div>
);

/** Card header height (pt-6 + 24px title row + gap-1.5 + 16px subtitle + pb-6). */
export const CHART_HEADER_H = 94;

/** Faint dashed horizontal grid line, as recharts' CartesianGrid renders it in the app. */
export const GridLine: React.FC<{ x: number; y: number; width: number; height: number; at: number }> = ({ x, y, width, height, at }) => (
  <line
    strokeDasharray="3 6"
    stroke="hsl(var(--foreground))"
    strokeOpacity={0.06}
    fill="none"
    x={x}
    y={y}
    width={width}
    height={height}
    x1={x}
    y1={at}
    x2={x + width}
    y2={at}
  />
);

/** Value label above a point / bar (recharts LabelList, app style). */
export const ValueLabel: React.FC<{ x: number; y: number; fill: string; text: string }> = ({ x, y, fill, text }) => (
  <text
    x={x}
    y={y}
    className="recharts-text recharts-label"
    textAnchor="middle"
    fill={fill}
    style={{ fontSize: 10, fontWeight: 600, fill: "hsl(var(--foreground))", opacity: 0.5 }}
  >
    <tspan x={x} dy="0em">
      {text}
    </tspan>
  </text>
);

/** X-axis tick label (font-size 10, axis-tick colour, 14px below the plot). */
export const TickLabel: React.FC<{ x: number; y: number; text: string }> = ({ x, y, text }) => (
  <g className="recharts-layer recharts-cartesian-axis-tick-label">
    <text
      stroke="none"
      fontSize={10}
      x={x}
      y={y}
      className="recharts-text recharts-cartesian-axis-tick-value"
      textAnchor="middle"
      fill="hsl(var(--chart-axis-tick))"
    >
      <tspan x={x} dy="0.71em">
        {text}
      </tspan>
    </text>
  </g>
);
