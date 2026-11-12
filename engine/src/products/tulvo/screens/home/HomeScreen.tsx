/**
 * Home dashboard (route "/"), rebuilt from research/ui-live/dom/home-dashboard.html and
 * day2/06-home-widgets-before.jpg: AppShell (Home active) + "Home" header with the Customize and
 * "Add widgets" buttons + the widget grid (Due Date trend line, 4 status KPIs, Status bar, Status pie).
 *
 * Every visible string and number is a prop. The Status widgets (KPIs, bar, pie) all read the same
 * `categories`, like the app.
 *
 * NOT FOR LIVE MORPHING. The live Home does not update while it is open: after a deal moved
 * Prospecting -> Pitch Sent, the widgets changed only after a reload, about 11 s later
 * (13-product-truth A5-5: RED for "live / instantly / on its own while you watch"). Show a change as
 * two static states across a cut: `homeScreen` (before) -> cut -> `homeAfterMoveScreen` (after the
 * reload, which may replay the page-load line draw via `trendDrawProgress`). See HomeMotionDemo.
 */
import React from "react";
import { DEAL_STATUSES, captureMatch, tulvoFixtures, type SidebarData, type TrendPoint, type TulvoDataset, type Workspace } from "../../fixtures";
import { AppShell } from "../../shell/AppShell";
import type { NavId } from "../../shell/Sidebar";
import { HomeTopBarActions, type Crumb } from "../../shell/TopBar";
import type { TulvoUiScreen } from "../types";
import { CAPTURED_GRID, HomeDashboard } from "./HomeDashboard";
import type { DashboardGrid, HomeCategory, HomeWidgetSpec, WidgetMotion } from "./types";

export type HomeScreenProps = {
  // ---- shell
  workspace: Workspace;
  sidebar: SidebarData;
  activeNav: NavId | null;
  sidebarHoverKey: string | null;
  sidebarScrollTop: number;
  showSupportCard: boolean;
  showCookieSettings: boolean;
  crumbs: Crumb[];
  addWidgetsLabel: string;
  /** "Add widgets" button in its pressed/hover look. */
  addWidgetsPressed: boolean;
  showTourButton: boolean;

  // ---- data (static per shot: whole counts, NOT for live morphing, see the file header)
  /** Status categories in app order; drive the KPIs, the bar and the pie. Whole counts only.
   *  Not for live morphing: the live Home only shows new counts after a reload, so change them
   *  across a cut (moveDeal() builds the after state). Fractional values hide every chart label. */
  categories: HomeCategory[];
  /** Due Date (trend) points (whole values; same rule as categories). */
  trend: TrendPoint[];
  /** KPI "updated" label, e.g. "about 2 hours ago" / "less than a minute ago". */
  updatedLabel: string;
  /** Widget layout + titles (see captureLayout()). */
  widgets: HomeWidgetSpec[];
  grid: DashboardGrid;

  // ---- motion (all frame-agnostic numbers; drive them from useCurrentFrame() in the parent)
  /** Line draw-in 0..1, the app's only chart entry animation on page load (measured live: about
   *  1500 ms, CSS ease, starting about 115 ms after the widgets appear; dots show throughout,
   *  value labels at 1). The bar and the pie mount complete, so they have no entry prop. */
  trendDrawProgress: number;
  /** Freeze the trend Y scale at the nice domain for this data max (null = from the data, like the app). */
  trendScaleDataMax: number | null;
  /** Freeze the bar Y scale at the nice domain for this data max (null = from the data). */
  barScaleDataMax: number | null;
  /** Pie "Category details" popover transition 0 (closed) .. 1 (open). Live: 200 ms ease-out. */
  pieLegendOpen: number;
  /** The popover's open state (flips on the click): footer "Hide details", chevron. null = open
   *  while pieLegendOpen > 0. Set false on the closing click so the label flips back at once. */
  pieLegendExpanded: boolean | null;
  /** Popover row under the pointer, or null. */
  pieLegendHoverIndex: number | null;
  /** Pointer over the pie widget ("widget": every popover % goes /45 -> /70) or its footer. */
  piePointer: "outside" | "widget" | "footer";
  /** Per-widget offset / opacity / scale, keyed by widget id. */
  widgetMotion: Record<string, WidgetMotion>;
  /** Scroll of the dashboard column (px). */
  scrollTop: number;
};

export const HomeScreen: React.FC<HomeScreenProps> = (p) => (
  <AppShell
    workspace={p.workspace}
    sidebar={p.sidebar}
    activeNav={p.activeNav}
    sidebarHoverKey={p.sidebarHoverKey}
    sidebarScrollTop={p.sidebarScrollTop}
    showSupportCard={p.showSupportCard}
    showCookieSettings={p.showCookieSettings}
    crumbs={p.crumbs}
    topBarRight={<HomeTopBarActions addLabel={p.addWidgetsLabel} pressed={p.addWidgetsPressed} />}
  >
    <HomeDashboard
      widgets={p.widgets}
      categories={p.categories}
      trend={p.trend}
      updatedLabel={p.updatedLabel}
      grid={p.grid}
      trendDrawProgress={p.trendDrawProgress}
      trendScaleDataMax={p.trendScaleDataMax}
      barScaleDataMax={p.barScaleDataMax}
      pieLegendOpen={p.pieLegendOpen}
      pieLegendExpanded={p.pieLegendExpanded}
      pieLegendHoverIndex={p.pieLegendHoverIndex}
      piePointer={p.piePointer}
      widgetMotion={p.widgetMotion}
      scrollTop={p.scrollTop}
      showTourButton={p.showTourButton}
    />
  </AppShell>
);

// ---------------------------------------------------------------- defaults

/** Status categories (verbatim deal statuses, app order) from a dataset's status counts. */
export const statusCategories = (ds: TulvoDataset): HomeCategory[] =>
  DEAL_STATUSES.map((s) => ({ label: s, value: ds.widgets.statusCounts[s] }));

/**
 * The counts after `count` deals moved from one status to another (whole counts). Use it for the
 * after-reload state on the far side of a cut, never as a live tween.
 */
export const moveDeal = (categories: HomeCategory[], from: string, to: string, count = 1): HomeCategory[] =>
  categories.map((c) => (c.label === from ? { ...c, value: c.value - count } : c.label === to ? { ...c, value: c.value + count } : c));

/**
 * The captured Home layout (home-dashboard.html), widget for widget, with the app's generated
 * widget titles verbatim. `categoryCount` feeds the pie's "N categories" strings.
 */
export const captureLayout = (categoryCount: number): HomeWidgetSpec[] => [
  { id: "due-date-trend", kind: "trend", col: 0, row: 0, rowSpan: 3, title: "Due Date (trend)", subtitle: "Showing Value trend over Dimension" },
  { id: "kpi-negotiation", kind: "kpi", col: 1, row: 0, rowSpan: 1, title: "Negotiation", category: "Negotiation", value: null, icon: "chart-column", accent: 2 },
  {
    id: "status-pie",
    kind: "pie",
    col: 2,
    row: 0,
    rowSpan: 3,
    title: "Status (pie)",
    subtitle: `Distribution of Value across ${categoryCount} categories`,
    footerLabel: `${categoryCount} categories`,
    footerOpenLabel: "Hide details",
    legendTitle: "Categories",
    legendTotalLabel: `${categoryCount} total`,
  },
  { id: "kpi-contract-review", kind: "kpi", col: 1, row: 1, rowSpan: 1, title: "Contract Review", category: "Contract Review", value: null, icon: "star", accent: 3 },
  { id: "status-bar", kind: "bar", col: 1, row: 2, rowSpan: 3, title: "Status (bar)", subtitle: "Showing Value by Dimension" },
  { id: "kpi-prospecting", kind: "kpi", col: 0, row: 3, rowSpan: 1, title: "Prospecting", category: "Prospecting", value: null, icon: "hash", accent: 3 },
  { id: "kpi-pitch-sent", kind: "kpi", col: 2, row: 3, rowSpan: 1, title: "Pitch Sent", category: "Pitch Sent", value: null, icon: "mail", accent: 3 },
];

/** Static (finished) state of every motion prop. */
export const HOME_MOTION_REST = {
  trendDrawProgress: 1,
  trendScaleDataMax: null,
  barScaleDataMax: null,
  pieLegendOpen: 0,
  pieLegendExpanded: null,
  pieLegendHoverIndex: null,
  piePointer: "outside",
  widgetMotion: {},
  scrollTop: 0,
} satisfies Partial<HomeScreenProps>;

export const homePropsFrom = (ds: TulvoDataset, opts: { showCookieSettings: boolean }): HomeScreenProps => {
  const categories = statusCategories(ds);
  return {
    workspace: ds.workspace,
    sidebar: ds.sidebar,
    activeNav: "home",
    sidebarHoverKey: null,
    sidebarScrollTop: 0,
    showSupportCard: true,
    showCookieSettings: opts.showCookieSettings,
    crumbs: [{ label: "Home" }],
    addWidgetsLabel: "Add widgets",
    addWidgetsPressed: false,
    showTourButton: true,
    categories,
    trend: ds.widgets.dueDateTrend,
    updatedLabel: ds.widgets.updatedLabel,
    widgets: captureLayout(categories.length),
    grid: CAPTURED_GRID,
    ...HOME_MOTION_REST,
  };
};

/**
 * Capture-match: same counts / layout as day2/06-home-widgets-before.jpg, cleared names. This is
 * also the BEFORE state of the "deal moves" beat (Prospecting 2, Pitch Sent 1, "about 2 hours ago").
 */
export const homeScreen: TulvoUiScreen<HomeScreenProps> = {
  id: "Home",
  component: HomeScreen,
  defaultProps: homePropsFrom(captureMatch, { showCookieSettings: true }),
};

/**
 * AFTER state of the "deal moves" beat, as the live Home showed it after a reload (13-product-truth
 * A5-5): one deal moved Prospecting -> Pitch Sent (Prospecting 1, Pitch Sent 2, the rest unchanged),
 * KPI timestamps "less than a minute ago". Static: put it on the far side of a cut from `homeScreen`.
 */
export const homeAfterMoveScreen: TulvoUiScreen<HomeScreenProps> = {
  id: "Home-AfterMove",
  component: HomeScreen,
  defaultProps: {
    ...homePropsFrom(captureMatch, { showCookieSettings: true }),
    categories: moveDeal(statusCategories(captureMatch), "Prospecting", "Pitch Sent"),
    updatedLabel: "less than a minute ago",
  },
};

/** The ad's default data (tulvoFixtures: "3 members", "less than a minute ago"). */
export const homeFixturesScreen: TulvoUiScreen<HomeScreenProps> = {
  id: "Home-Fixtures",
  component: HomeScreen,
  defaultProps: homePropsFrom(tulvoFixtures, { showCookieSettings: false }),
};

/**
 * Fixtures with the pie's Category details popover open and the "Live" row hovered. Verified against
 * the live open state on 21 Oct (research/ui-live/day3/02-home-pie-legend-open-hover-live-2x.png).
 */
export const homeLegendScreen: TulvoUiScreen<HomeScreenProps> = {
  id: "Home-Legend",
  component: HomeScreen,
  defaultProps: { ...homePropsFrom(tulvoFixtures, { showCookieSettings: false }), pieLegendOpen: 1, pieLegendHoverIndex: 5, piePointer: "widget" },
};
