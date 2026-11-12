import React from "react";
import { captureMatch, type SidebarData, type Workspace } from "../fixtures";
import { AppShell } from "../shell/AppShell";
import type { NavId } from "../shell/Sidebar";
import { HomeTopBarActions, TopBarSettingsButton, type Crumb } from "../shell/TopBar";
import type { TulvoUiScreen } from "./types";

export type ShellScreenProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  activeNav: NavId | null;
  activePageId: string | null;
  crumbs: Crumb[];
  /** Which captured header actions to show on the right. */
  topBarRight: "settings" | "home-actions" | "none";
  sidebarHoverKey: string | null;
  sidebarScrollTop: number;
  showSupportCard: boolean;
  showCookieSettings: boolean;
};

/** AppShell with an empty main area (fidelity base; page teams build on AppShell directly). */
export const ShellScreen: React.FC<ShellScreenProps> = ({ topBarRight, ...p }) => (
  <AppShell
    workspace={p.workspace}
    sidebar={p.sidebar}
    activeNav={p.activeNav}
    activePageId={p.activePageId}
    crumbs={p.crumbs}
    sidebarHoverKey={p.sidebarHoverKey}
    sidebarScrollTop={p.sidebarScrollTop}
    showSupportCard={p.showSupportCard}
    showCookieSettings={p.showCookieSettings}
    topBarRight={
      topBarRight === "settings" ? <TopBarSettingsButton /> : topBarRight === "home-actions" ? <HomeTopBarActions /> : null
    }
  >
    <div className="min-h-0 flex-1 overflow-y-auto pb-24 pt-4" />
  </AppShell>
);

/** Defaults reproduce day2/03-people-1-owner-0-pending.jpg (People page chrome) with cleared names. */
export const shellScreen: TulvoUiScreen<ShellScreenProps> = {
  id: "Shell",
  component: ShellScreen,
  defaultProps: {
    workspace: captureMatch.workspace,
    sidebar: captureMatch.sidebar,
    activeNav: null,
    activePageId: null,
    crumbs: [{ label: "Home" }, { label: "People" }],
    topBarRight: "settings",
    sidebarHoverKey: null,
    sidebarScrollTop: 0,
    showSupportCard: true,
    showCookieSettings: true,
  },
};
