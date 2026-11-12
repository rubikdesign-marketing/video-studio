/**
 * A board page (e.g. "Brand Deal Pipeline") with its tab toolbar and one view (Grid / List / Kanban),
 * inside the app shell. Page skeleton verbatim from board-*.html:
 *   bg-backgroundGray column > main > #page-main-scroll > .board-page > sticky .tab-sticky toolbar + view.
 * Renders app content only (no <TulvoApp>): the gallery / <AppStage> wrap it.
 *
 * No card is ever drawn "floating" above the board: the live app has no card drag, and a record
 * changes column / tab only through its Status select (13-product-truth A5-5). A card that leaves the
 * app window in a non-diegetic transition is drawn by the motion layer OUTSIDE <TulvoApp> (standalone
 * <BoardCard>, positioned with layout.ts gridCardRect / kanbanCardRect), never inside this page.
 */
import React from "react";
import type { SidebarData, Workspace } from "../../fixtures";
import { AppShell } from "../../shell/AppShell";
import { BoardToolbar, type BoardToolbarProps } from "./BoardToolbar";
import { GridView, KanbanView, ListView, type CardStates, type GridViewProps, type KanbanViewProps, type ListViewProps } from "./BoardViews";

export type BoardPageProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  /** Sidebar page highlighted (the board page itself). */
  activePageId: string;
  /** Breadcrumb: Home > page title > active tab name. */
  homeLabel?: string;
  pageTitle: string;
  toolbar: BoardToolbarProps;
  /** Exactly one of grid / kanban / list, matching toolbar.view. */
  grid?: GridViewProps;
  kanban?: KanbanViewProps;
  list?: ListViewProps;
  /** Vertical scroll of the page content under the sticky toolbar (Grid / List), px. */
  scrollTop?: number;
  showCookieSettings?: boolean;
  sidebarHoverKey?: string | null;
};

export const BoardPage: React.FC<BoardPageProps> = ({
  workspace,
  sidebar,
  activePageId,
  homeLabel = "Home",
  pageTitle,
  toolbar,
  grid,
  kanban,
  list,
  scrollTop = 0,
  showCookieSettings = false,
  sidebarHoverKey = null,
}) => {
  const activeTab = toolbar.tabs.find((t) => t.id === toolbar.activeTabId);
  const view = toolbar.view;
  let body: React.ReactNode = null;
  if (view === "grid" && grid) body = <GridView {...grid} />;
  else if (view === "kanban" && kanban) body = <KanbanView {...kanban} />;
  else if (view === "list" && list) body = <ListView {...list} />;
  const scrolled = scrollTop && view !== "kanban" ? { transform: `translateY(${-scrollTop}px)` } : undefined;

  return (
    <AppShell
      workspace={workspace}
      sidebar={sidebar}
      activePageId={activePageId}
      sidebarHoverKey={sidebarHoverKey}
      showCookieSettings={showCookieSettings}
      crumbs={[
        { label: homeLabel, variant: "board-link" },
        { label: pageTitle, variant: "page-title" },
        { label: activeTab?.name ?? "", variant: "tab" },
      ]}
      topBarRight={<div />}
    >
      <div className="flex h-full min-h-0 flex-col bg-backgroundGray">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-t-white " aria-hidden="false">
                <div className="flex flex-col h-full board-page">
                  <div className="tab-sticky space-y-5 z-[25] sticky top-0 bg-t-white">
                    <div className="w-full px-4 !px-0">
                      <div className="flex flex-col  px-4 gap-2 ">
                        <BoardToolbar {...toolbar} />
                      </div>
                    </div>
                  </div>
                  {scrolled ? <div style={scrolled}>{body}</div> : body}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AppShell>
  );
};

export type { CardStates };
