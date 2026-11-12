/** Home dashboard screen group: components, props and registry entries. */
export { HomeScreen, homeScreen, homeAfterMoveScreen, homeFixturesScreen, homeLegendScreen, homePropsFrom, captureLayout, statusCategories, moveDeal, HOME_MOTION_REST } from "./HomeScreen";
export type { HomeScreenProps } from "./HomeScreen";
export { HomeMotionDemo, homeMotionDemoScreen } from "./HomeMotionDemo";
export type { HomeMotionDemoProps } from "./HomeMotionDemo";
export { HomeDashboard, CAPTURED_GRID } from "./HomeDashboard";
export type { HomeDashboardProps } from "./HomeDashboard";
export { KpiWidget } from "./KpiWidget";
export type { KpiWidgetProps } from "./KpiWidget";
export { TrendLineChart } from "./TrendLineChart";
export type { TrendLineChartProps } from "./TrendLineChart";
export { StatusBarChart } from "./StatusBarChart";
export type { StatusBarChartProps } from "./StatusBarChart";
export { StatusPieWidget } from "./StatusPieWidget";
export type { StatusPieWidgetProps } from "./StatusPieWidget";
export { ChartWidgetCard, WidgetOptionsButton } from "./WidgetChrome";
export * from "./types";

import { homeScreen, homeAfterMoveScreen, homeFixturesScreen, homeLegendScreen } from "./HomeScreen";
import { homeMotionDemoScreen } from "./HomeMotionDemo";
import type { TulvoUiScreen } from "../types";

/** All Home entries for the gallery (screens/index.ts spreads this). */
export const homeScreens: TulvoUiScreen[] = [homeScreen, homeAfterMoveScreen, homeFixturesScreen, homeLegendScreen, homeMotionDemoScreen];
