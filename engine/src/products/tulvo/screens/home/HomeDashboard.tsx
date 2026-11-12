/**
 * The Home page body below the header (home-dashboard.html): the "Replay Dashboard Tour" button,
 * the welcome-page scroll column and the widget grid. The live grid positions every widget
 * absolutely (translate3d + width/height inside a relative box); so does this, from the specs.
 *
 * Omitted on purpose: the page's decorative backdrop (two blurred colour blobs + a dot pattern,
 * all `-z-10`). In the live app they paint beneath the welcome-page's own white background, so
 * they are invisible (the capture is pure #fff there); rendering them would only cost blur time.
 */
import React from "react";
import { Compass } from "lucide-react";
import type { TrendPoint } from "../../fixtures";
import { KpiWidget } from "./KpiWidget";
import { StatusBarChart } from "./StatusBarChart";
import { StatusPieWidget } from "./StatusPieWidget";
import { TrendLineChart } from "./TrendLineChart";
import type { DashboardGrid, HomeCategory, HomeWidgetSpec, WidgetMotion } from "./types";
import { CHART_HEADER_H, ChartWidgetCard } from "./WidgetChrome";

/** Captured grid: 1156px content width = 3 x 372 + 2 x 20; KPI row 108px. */
export const CAPTURED_GRID: DashboardGrid = { columnWidth: 372, rowHeight: 108, gap: 20 };

export type HomeDashboardProps = {
  widgets: HomeWidgetSpec[];
  categories: HomeCategory[];
  trend: TrendPoint[];
  updatedLabel: string;
  grid?: DashboardGrid;
  trendDrawProgress?: number;
  trendScaleDataMax?: number | null;
  barScaleDataMax?: number | null;
  pieLegendOpen?: number;
  pieLegendExpanded?: boolean | null;
  pieLegendHoverIndex?: number | null;
  piePointer?: "outside" | "widget" | "footer";
  widgetMotion?: Record<string, WidgetMotion>;
  /** Vertical scroll of the welcome-page column (px). */
  scrollTop?: number;
  showTourButton?: boolean;
  tourButtonLabel?: string;
};

const slot = (g: DashboardGrid, col: number, row: number, rowSpan: number) => ({
  x: col * (g.columnWidth + g.gap),
  y: row * (g.rowHeight + g.gap),
  w: g.columnWidth,
  h: rowSpan * g.rowHeight + (rowSpan - 1) * g.gap,
});

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  widgets,
  categories,
  trend,
  updatedLabel,
  grid = CAPTURED_GRID,
  trendDrawProgress = 1,
  trendScaleDataMax = null,
  barScaleDataMax = null,
  pieLegendOpen = 0,
  pieLegendExpanded = null,
  pieLegendHoverIndex = null,
  piePointer = "outside",
  widgetMotion = {},
  scrollTop = 0,
  showTourButton = true,
  tourButtonLabel = "Replay Dashboard Tour",
}) => {
  const slots = widgets.map((w) => ({ w, s: slot(grid, w.col, w.row, w.rowSpan) }));
  const boxHeight = slots.reduce((m, { s }) => Math.max(m, s.y + s.h), 0);

  const body = (spec: HomeWidgetSpec, w: number, h: number) => {
    switch (spec.kind) {
      case "kpi": {
        const value = spec.value ?? categories.find((c) => c.label === spec.category)?.value ?? 0;
        return <KpiWidget title={spec.title} value={value} updatedLabel={updatedLabel} icon={spec.icon} accent={spec.accent} />;
      }
      case "trend":
        return (
          <ChartWidgetCard variant="cartesian" title={spec.title} subtitle={spec.subtitle}>
            <div className="p-4 flex min-h-0 flex-1 flex-col px-6 pt-0 pb-6">
              <TrendLineChart width={w - 48} height={h - CHART_HEADER_H - 24} points={trend} drawProgress={trendDrawProgress} scaleDataMax={trendScaleDataMax} />
            </div>
          </ChartWidgetCard>
        );
      case "bar":
        return (
          <ChartWidgetCard variant="cartesian" title={spec.title} subtitle={spec.subtitle}>
            <div className="p-4 flex min-h-0 flex-1 flex-col px-6 pt-0 pb-6">
              <StatusBarChart width={w - 48} height={h - CHART_HEADER_H - 24} categories={categories} scaleDataMax={barScaleDataMax} />
            </div>
          </ChartWidgetCard>
        );
      case "pie":
        return (
          <StatusPieWidget
            width={w}
            height={h}
            title={spec.title}
            subtitle={spec.subtitle}
            footerLabel={spec.footerLabel}
            footerOpenLabel={spec.footerOpenLabel}
            legendTitle={spec.legendTitle}
            legendTotalLabel={spec.legendTotalLabel}
            categories={categories}
            legendOpen={pieLegendOpen}
            legendExpanded={pieLegendExpanded}
            legendHoverIndex={pieLegendHoverIndex}
            pointer={piePointer}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col" aria-hidden="false">
        <div className="contents">
          {showTourButton ? (
            <button
              className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 w-9 fixed bottom-4 right-4 z-40 rounded-full border bg-background shadow-md"
              aria-label={tourButtonLabel}
              data-state="closed"
              type="button"
            >
              <Compass className="h-4 w-4" />
            </button>
          ) : null}
          <div className="welcome-page bg-background flex flex-1 flex-col w-full pt-2.5 pb-8 sm:pt-4 sm:pb-8 overflow-y-auto">
            <div className="w-full px-4 lg:px-[3.375rem] flex flex-col pt-0" style={scrollTop ? { transform: `translateY(${-scrollTop}px)` } : undefined}>
              <div className="relative flex flex-col">
                <div className="relative flex flex-col gap-3">
                  <section aria-label="Template widgets" className="flex flex-col gap-4 p-1 sm:gap-5 sm:p-0">
                    <div aria-label="Dashboard widgets" className="flex min-w-0 flex-col gap-6">
                      <div className="flex min-w-0 items-start" style={{ gap: grid.gap }}>
                        <div className="flex min-w-0 flex-1 flex-col gap-6">
                          <section aria-label="Main section" className="flex min-w-0 flex-col">
                            <div style={{ position: "relative", height: boxHeight }}>
                              {slots.map(({ w, s }) => {
                                const m = widgetMotion[w.id] ?? {};
                                const scale = m.scale ?? 1;
                                return (
                                  <div
                                    key={w.id}
                                    className="flex min-w-0 flex-col motion-safe:transition-[transform,width,height]"
                                    style={{
                                      position: "absolute",
                                      top: 0,
                                      left: 0,
                                      transform: `translate3d(${s.x + (m.x ?? 0)}px, ${s.y + (m.y ?? 0)}px, 0px)${scale !== 1 ? ` scale(${scale})` : ""}`,
                                      width: s.w,
                                      height: s.h,
                                      willChange: "transform",
                                      opacity: m.opacity ?? undefined,
                                    }}
                                  >
                                    {body(w, s.w, s.h)}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
