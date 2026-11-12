/**
 * Types for the rebuilt Home dashboard. Everything is JSON-serialisable (Remotion defaultProps).
 */

/**
 * One category of the Status widgets (KPIs, bar, pie): a deal status and its WHOLE count.
 * Not for live morphing: the live Home does not update while it is open (13-product-truth A5-5);
 * show a change as before -> cut -> after-reload, each a static set of whole counts.
 */
export type HomeCategory = { label: string; value: number };

/** KPI icons seen on the live Home (home-dashboard.html). */
export type KpiIconName = "chart-column" | "star" | "hash" | "mail";

/** Chart palette slot (CSS --chart-1 .. --chart-7). */
export type ChartTone = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Where a widget sits in the dashboard's 3-column grid (captured: columns 372px, rows 108px,
 * gap 20px; a chart widget spans 3 rows = 364px, a KPI 1 row = 108px).
 */
export type WidgetPlacement = { id: string; col: number; row: number; rowSpan: number };

export type KpiWidgetSpec = WidgetPlacement & {
  kind: "kpi";
  title: string;
  /** Category label whose value the KPI shows (e.g. "Negotiation"). */
  category: string;
  /** Explicit value, overriding the category's (null = use the category). */
  value: number | null;
  icon: KpiIconName;
  /** Icon colour slot (captured: Negotiation 2, the other KPIs 3). */
  accent: ChartTone;
};

export type TrendWidgetSpec = WidgetPlacement & { kind: "trend"; title: string; subtitle: string };
export type BarWidgetSpec = WidgetPlacement & { kind: "bar"; title: string; subtitle: string };
export type PieWidgetSpec = WidgetPlacement & {
  kind: "pie";
  title: string;
  subtitle: string;
  /** Footer button text, e.g. "7 categories". */
  footerLabel: string;
  /** Footer button text while the popover is open (live: "Hide details"). */
  footerOpenLabel: string;
  /** Category details popover header, e.g. "Categories" and "7 total". */
  legendTitle: string;
  legendTotalLabel: string;
};

export type HomeWidgetSpec = KpiWidgetSpec | TrendWidgetSpec | BarWidgetSpec | PieWidgetSpec;

/** Per-widget motion (all optional, additive to the grid position). */
export type WidgetMotion = {
  /** px offsets from the grid slot. */
  x?: number;
  y?: number;
  opacity?: number;
  /** Uniform scale around the widget centre. */
  scale?: number;
};

export type DashboardGrid = { columnWidth: number; rowHeight: number; gap: number };
