/**
 * "Status (pie)" widget: card header, recharts Pie rebuilt as SVG (slice count + percent labels
 * inside the slices), the "7 categories" footer toggle and its "Category details" popover (the
 * category legend: colour dot, label, count, percent). Markup and classes verbatim from
 * home-dashboard.html (popover closed) and the live open state recorded on 21 Oct
 * (research/ui-live/day3/README.md). Open, the app changes exactly this: the footer text and
 * aria-label become "Hide details", the chevron gets `rotate-180`, and the popover goes to
 * `pointer-events-auto translate-y-0 scale-100 opacity-100` (200 ms ease-out). Nothing else in the
 * widget changes (no pie dimming, no active slice).
 *
 * Hover, as the live CSS does it: the widget wrapper is a Tailwind `group`, so while the pointer is
 * anywhere over the widget every popover percentage goes from /45 to /70 (`group-hover`); the row
 * under the pointer also gets `bg-muted/50`; the footer text goes from /55 to full muted-foreground.
 *
 * No entry animation: measured live, the pie mounts complete with its labels (no sweep prop).
 */
import React from "react";
import { ChevronDown } from "lucide-react";
import { chartVar, formatPercent, integerShares, isSettled, pieSectors, polar } from "./chartMath";
import type { HomeCategory } from "./types";
import { CHART_HEADER_H, ChartWidgetCard, RECHARTS_CONTAINER_CLASS, RechartsBox } from "./WidgetChrome";

/** Footer button height: border-t 1 + py-2.5 (20) + 11px text at line-height 1.5 (16.5). */
const FOOTER_H = 37.5;

export type StatusPieWidgetProps = {
  /** Widget size (captured 372 x 364); the pie surface is derived from it. */
  width: number;
  height: number;
  title: string;
  subtitle: string;
  /** Footer text while closed, e.g. "7 categories". */
  footerLabel: string;
  /** Footer text while open (live: "Hide details"). */
  footerOpenLabel: string;
  legendTitle: string;
  legendTotalLabel: string;
  /** Whole counts. Not for live morphing: the live Home does not update while it is open. */
  categories: HomeCategory[];
  /** Category details popover transition: 0 = closed .. 1 = open (live: 200 ms ease-out). */
  legendOpen?: number;
  /** The app's open/closed state, which flips on the click: footer text, aria and the chevron's
   *  target. null = derived (open while legendOpen > 0). Set it false on the closing click. */
  legendExpanded?: boolean | null;
  /** Popover row under the pointer (index), or null. Implies the pointer is over the widget. */
  legendHoverIndex?: number | null;
  /** Where the pointer is: outside the widget, over the widget, or over the footer button. */
  pointer?: "outside" | "widget" | "footer";
};

export const StatusPieWidget: React.FC<StatusPieWidgetProps> = ({
  width,
  height,
  title,
  subtitle,
  footerLabel,
  footerOpenLabel,
  legendTitle,
  legendTotalLabel,
  categories,
  legendOpen = 0,
  legendExpanded = null,
  legendHoverIndex = null,
  pointer = "outside",
}) => {
  // recharts ResponsiveContainer: px-4 py-3 box below the header and above the footer (rounded).
  const sw = Math.max(0, width - 32);
  const sh = Math.max(0, Math.round(height - CHART_HEADER_H - FOOTER_H - 24));
  // Pie offset box = surface minus 4px margins; outerRadius "85%" of half its short side.
  const bw = Math.max(0, sw - 8);
  const bh = Math.max(0, sh - 8);
  const cx = 4 + bw / 2;
  const cy = 4 + bh / 2;
  const r = (Math.min(bw, bh) / 2) * 0.85;
  const values = categories.map((c) => c.value);
  const sectors = pieSectors(values, cx, cy, r);
  // Labels show whole counts and percent of the whole total, and hide for in-between values.
  const shares = integerShares(values);
  const showSliceLabels = isSettled(values);
  const sliceVars = Object.fromEntries(categories.map((_, i) => [`--color-slice-${i}`, chartVar(i)])) as React.CSSProperties;
  const open = Math.min(1, Math.max(0, legendOpen));
  const expanded = legendExpanded ?? open > 0;
  const overWidget = pointer !== "outside" || legendHoverIndex !== null;

  return (
    <ChartWidgetCard variant="pie" title={title} subtitle={subtitle}>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center px-4 py-3">
          <div className={`${RECHARTS_CONTAINER_CLASS} aspect-square h-full max-h-full w-full max-w-full min-h-[160px] mx-auto`} style={sliceVars}>
            <RechartsBox width={sw} height={sh}>
              <g className="recharts-zIndex-layer_100">
                <g className="recharts-layer recharts-pie">
                  <g className="recharts-layer">
                    {sectors.map((s) => (
                      <g key={s.index} className="recharts-layer recharts-pie-sector">
                        <g className="recharts-layer recharts-shape">
                          {s.path ? <path fill={`var(--color-slice-${s.index})`} stroke="#fff" className="recharts-sector" d={s.path} /> : null}
                        </g>
                      </g>
                    ))}
                  </g>
                  <g className="recharts-layer recharts-pie-labels" />
                </g>
              </g>
              {showSliceLabels ? (
                <g className="recharts-zIndex-layer_2000">
                  {sectors
                    .filter((s) => s.value > 0)
                    .map((s) => {
                      const p = polar(cx, cy, r * 0.55, s.midAngle);
                      return (
                        <g key={s.index} className="recharts-layer">
                          <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" style={{ pointerEvents: "none", userSelect: "none" }}>
                            <tspan x={p.x} dy="-0.4em" fontSize={12} fontWeight={700} fill="hsl(var(--background))">
                              {shares[s.index].count}
                            </tspan>
                            <tspan x={p.x} dy="1.2em" fontSize={10} fontWeight={500} fill="hsl(var(--background))" opacity={0.85}>
                              {formatPercent(shares[s.index].percent)}
                            </tspan>
                          </text>
                        </g>
                      );
                    })}
                </g>
              ) : null}
            </RechartsBox>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="flex w-full shrink-0 items-center justify-center gap-1.5 border-t border-border/40 px-4 py-2.5 text-[11px] font-medium text-muted-foreground/55 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-expanded={expanded}
        aria-label={expanded ? footerOpenLabel : "Show details"}
        style={pointer === "footer" ? { color: "hsl(var(--muted-foreground))" } : undefined}
      >
        <span>{expanded ? footerOpenLabel : footerLabel}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200${expanded && open >= 1 ? " rotate-180" : ""}`}
          aria-hidden="true"
          style={open > 0 && (open < 1 || !expanded) ? { transform: `rotate(${180 * open}deg)` } : undefined}
        />
      </button>
      <div
        role="dialog"
        aria-label="Category details"
        aria-hidden={!expanded}
        className={`absolute inset-x-3 bottom-[46px] z-20 overflow-hidden rounded-xl border border-border/60 bg-card/[0.97] shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06)] transition-[opacity,transform] duration-200 ease-out ${
          open >= 1 ? "pointer-events-auto translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-3 scale-[0.97] opacity-0"
        }`}
        style={open > 0 && open < 1 ? { opacity: open, transform: `translateY(${12 * (1 - open)}px) scale(${0.97 + 0.03 * open})` } : undefined}
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/40">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{legendTitle}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground/35">{legendTotalLabel}</span>
        </div>
        <div className="space-y-0.5 px-2 py-2">
          {categories.map((c, i) => {
            const hover = legendHoverIndex === i;
            return (
              <div
                key={i}
                className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50"
                title={c.label}
                style={hover ? { backgroundColor: "hsl(var(--muted) / 0.5)" } : undefined}
              >
                <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/[0.08]" aria-hidden="true" style={{ backgroundColor: chartVar(i) }} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/80">{c.label}</span>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground/90">{shares[i].count}</span>
                <span
                  className="w-9 shrink-0 text-right text-[11px] tabular-nums transition-colors text-muted-foreground/45 group-hover:text-muted-foreground/70"
                  style={overWidget ? { color: "hsl(var(--muted-foreground) / 0.7)" } : undefined}
                >
                  {formatPercent(shares[i].percent)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ChartWidgetCard>
  );
};
