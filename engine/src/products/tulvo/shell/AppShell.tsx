/**
 * AppShell: the live Tulvo app frame (sidebar + page header + main column), rebuilt from
 * the day-2 DOM snapshots. Render it inside <TulvoApp> (which loads the scoped app CSS and
 * Inter). Page teams put their screen into `children`; it lands exactly where the app's
 * page content sits (below the 48px header, inside the scroll column).
 *
 *   <TulvoApp>
 *     <AppShell workspace={...} sidebar={...} activeNav="home" crumbs={[{ label: "Home" }]}>
 *       <MyPage />
 *     </AppShell>
 *   </TulvoApp>
 */
import React from "react";
import type { SidebarData, Workspace } from "../fixtures";
import { Sidebar, type NavId, type SidebarLabels, type SidebarSectionId } from "./Sidebar";
import { TopBar, type Crumb } from "./TopBar";

export type AppShellProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  /** Highlighted nav item: "home" | "deploy" | "data-templates" | "tulvo-ai" | null. */
  activeNav?: NavId | null;
  /** Highlighted page id (SidebarPage.id). */
  activePageId?: string | null;
  /** Simulated hover target in the sidebar (see SidebarProps.hoverKey). */
  sidebarHoverKey?: string | null;
  sidebarOpenSections?: Partial<Record<SidebarSectionId, boolean>>;
  sidebarScrollTop?: number;
  sidebarWidth?: number;
  showSupportCard?: boolean;
  integrationLogos?: Partial<Record<string, React.ReactNode>>;
  sidebarLabels?: Partial<SidebarLabels>;

  /** Breadcrumb; the last crumb defaults to the "current" style, earlier ones to "link". */
  crumbs: Crumb[];
  showBack?: boolean;
  topBarLeftExtras?: React.ReactNode;
  topBarRight?: React.ReactNode;
  /** Hide the header entirely (e.g. full-bleed editors). */
  hideTopBar?: boolean;

  /**
   * The app's "Cookie settings" button (fixed, bottom-left, over the sidebar). It is on the
   * live site but not part of the product UI; off by default, on for capture comparisons.
   */
  showCookieSettings?: boolean;
  cookieSettingsLabel?: string;

  /** Page content (the app's main column below the header). */
  children?: React.ReactNode;
};

export const AppShell: React.FC<AppShellProps> = ({
  workspace,
  sidebar,
  activeNav = null,
  activePageId = null,
  sidebarHoverKey = null,
  sidebarOpenSections,
  sidebarScrollTop = 0,
  sidebarWidth = 248,
  showSupportCard = true,
  integrationLogos,
  sidebarLabels,
  crumbs,
  showBack = true,
  topBarLeftExtras,
  topBarRight,
  hideTopBar = false,
  showCookieSettings = false,
  cookieSettingsLabel = "Cookie settings",
  children,
}) => {
  return (
    <>
      <div className="flex flex-col h-screen">
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            workspace={workspace}
            sidebar={sidebar}
            activeNav={activeNav}
            activePageId={activePageId}
            hoverKey={sidebarHoverKey}
            openSections={sidebarOpenSections}
            scrollTop={sidebarScrollTop}
            width={sidebarWidth}
            showSupportCard={showSupportCard}
            integrationLogos={integrationLogos}
            labels={sidebarLabels}
          />
          <main className="flex flex-1 min-w-0 transition-all duration-300" style={{ width: `calc(100% - ${sidebarWidth}px)` }}>
            <div className="flex w-full min-h-0 flex-1 flex-col overflow-x-auto [scrollbar-gutter:stable] h-full">
              {hideTopBar ? null : (
                <TopBar crumbs={crumbs} showBack={showBack} leftExtras={topBarLeftExtras} right={topBarRight} />
              )}
              {children}
            </div>
          </main>
        </div>
      </div>
      {showCookieSettings ? (
        <button
          id="tulvo-cookie-settings"
          type="button"
          style={{
            position: "fixed",
            bottom: 8,
            left: 8,
            zIndex: 2147482000,
            background: "white",
            color: "rgb(51, 51, 51)",
            border: "1px solid rgb(221, 221, 221)",
            borderRadius: 6,
            padding: "5px 8px",
            font: "12px system-ui",
            cursor: "pointer",
          }}
        >
          {cookieSettingsLabel}
        </button>
      ) : null}
    </>
  );
};

export type { Crumb, NavId, SidebarSectionId };
