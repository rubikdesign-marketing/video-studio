/**
 * Board page toolbar: tab-list toggle, page tabs, "Add new tab", search, template filter chip with
 * its count badge, view switcher (Grid / List / Kanban) and "+ New" (not shown in Kanban).
 * Markup and class strings verbatim from board-grid-pitch-sent.html / board-kanban-prospecting.html.
 * The view switcher's open menu is not in a snapshot; it is rebuilt from the same build's
 * BoardViewSwitcher (DropdownMenuContent "w-36 max-w-[144px] p-2 space-y-1 shadow-dropdown").
 */
import React from "react";
import { Check, ChevronDown, GalleryHorizontal, LayoutGrid, List, ListFilter, Plus, Search, X } from "lucide-react";
import { cn } from "../../cn";
import { KanbanLayoutIcon, TabActionsIcon } from "../../icons/app-icons";
import type { BoardTabItem, BoardView } from "./model";

/** UI chrome labels, verbatim from the live app. */
export const BOARD_LABELS = {
  grid: "Grid",
  list: "List",
  kanban: "Kanban",
  newItem: "New",
  addTab: "Add new tab",
  tabActions: "Tab actions",
  taskFilter: "Task filter",
  clearFilters: "Clear all filters",
};
export type BoardLabels = typeof BOARD_LABELS;

const BUTTON1 =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[var(--button1-icon-size)] [&_svg]:shrink-0";
const BUTTON1_W =
  "inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[var(--button1-icon-size)] [&_svg]:shrink-0";
const OUTLINE = "border border-border bg-[var(--card-input-bg)] text-[var(--card-text)] hover:bg-[var(--card-bg-hover)]";
const ICON_SIZE = "h-8 w-8 p-0 text-[14px] font-normal leading-5 tracking-normal";
const TEXT_SIZE = "h-8 px-2.5 text-[14px] font-normal leading-5 tracking-normal";
const ICON_VAR = { "--button1-icon-size": "16px" } as React.CSSProperties;

const TAB_ACTIVE =
  "tab-list-button group/tab relative flex h-7 max-w-[180px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm leading-none transition-colors pr-1.5 active border-border bg-background text-foreground font-medium";
const TAB_IDLE =
  "tab-list-button group/tab relative flex h-7 max-w-[180px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm font-normal leading-none transition-colors pr-1.5 border-transparent bg-transparent text-muted-foreground hover:text-foreground";
const TAB_ACTIONS_SHOWN = "relative z-20 flex shrink-0 items-center transition-opacity duration-200 opacity-100";
const TAB_ACTIONS_HIDDEN =
  "relative z-20 flex shrink-0 items-center transition-opacity duration-200 pointer-events-none opacity-0 group-hover/tab:pointer-events-auto group-hover/tab:opacity-100";

const VIEW_LABEL: Record<BoardView, keyof BoardLabels> = { grid: "grid", list: "list", kanban: "kanban" };
const ViewIcon: React.FC<{ view: BoardView; className?: string }> = ({ view, className }) =>
  view === "grid" ? <LayoutGrid className={className} /> : view === "list" ? <List className={className} /> : <KanbanLayoutIcon className={cn("lucide lucide-kanban-layout", className)} />;

export type BoardToolbarProps = {
  tabs: BoardTabItem[];
  activeTabId: string;
  /** Pointer over a tab (shows its "Tab actions" dots and the hover text colour). */
  hoverTabId?: string | null;
  /** Template filter chip label (the active template, e.g. "Brand Deals"). */
  filterLabel: string;
  /** Short label the app shows below the lg breakpoint (hidden at 1512 px). Default: initials. */
  filterShortLabel?: string;
  /** Badge number on the filter chip (number of active filter conditions). 0 hides it. */
  filterCount: number;
  view: BoardView;
  /** View switcher menu open (Grid / List / Kanban with a check on the current view). */
  viewMenuOpen?: boolean;
  /** Highlighted (hovered) entry in the open view menu. */
  viewMenuHighlight?: BoardView | null;
  labels?: Partial<BoardLabels>;
};

export const BoardToolbar: React.FC<BoardToolbarProps> = ({
  tabs,
  activeTabId,
  hoverTabId = null,
  filterLabel,
  filterShortLabel,
  filterCount,
  view,
  viewMenuOpen = false,
  viewMenuHighlight = null,
  labels,
}) => {
  const L = { ...BOARD_LABELS, ...labels };
  const short =
    filterShortLabel ??
    filterLabel
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]!.toUpperCase())
      .join("");
  return (
    <div className="relative mr-4 flex w-full items-center gap-1.5 py-2 lg:py-4">
      <div className="flex h-8 shrink-0 items-center">
        <button className={`${BUTTON1} ${ICON_SIZE} tab-toggle-button border-0 bg-transparent text-muted-foreground hover:bg-muted`} data-state="closed" style={ICON_VAR}>
          <GalleryHorizontal />
        </button>
      </div>
      <div className="flex min-h-8 min-w-0 flex-1 items-center overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
          <div className="flex min-w-0 items-center overflow-hidden relative gap-1.5">
            <div className="tab-lists flex min-w-0 shrink items-center gap-0.5 rounded-lg bg-muted p-[2px] overflow-x-auto scrollbar scrollbar-h-0.5 scrollbar-thumb-transparent hover:scrollbar-thumb-muted-foreground flex-nowrap">
              {tabs.map((t) => {
                const active = t.id === activeTabId;
                const hover = !active && t.id === hoverTabId;
                return (
                  <div className="tab-list relative flex items-center group dashboard-tab min-w-0 shrink-0" key={t.id}>
                    <button type="button" className={active ? TAB_ACTIVE : TAB_IDLE} style={hover ? { color: "hsl(var(--foreground))" } : undefined}>
                      <span className="relative z-10 min-w-0 truncate text-center leading-none">{t.name}</span>
                      <span className={active ? TAB_ACTIONS_SHOWN : TAB_ACTIONS_HIDDEN} style={hover ? { opacity: 1 } : undefined}>
                        <div className="" aria-haspopup="menu" aria-expanded="false" data-state="closed">
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={L.tabActions}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors duration-200 hover:text-foreground"
                          >
                            <TabActionsIcon className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="shrink-0">
              <button className={`${BUTTON1} ${OUTLINE} ${ICON_SIZE} tab-add-button`} aria-label={L.addTab} style={ICON_VAR}>
                <Plus />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="">
          <div className="lg:hidden">
            <button className={`${BUTTON1} ${OUTLINE} ${ICON_SIZE} dashboard-search-button`} style={ICON_VAR}>
              <Search />
            </button>
          </div>
          <div className="hidden lg:block">
            <div className="flex h-8 items-center flex-nowrap relative transition-all duration-200 overflow-hidden w-8">
              <button className={`${BUTTON1} ${OUTLINE} ${ICON_SIZE} search-input-btn shrink-0`} style={ICON_VAR}>
                <Search />
              </button>
            </div>
          </div>
        </div>
        <button
          className={`${BUTTON1_W} ${OUTLINE} ${TEXT_SIZE} filter-btn relative group dashboard-filter`}
          title={L.taskFilter}
          type="button"
          aria-haspopup="dialog"
          aria-expanded="false"
          data-state="closed"
          style={ICON_VAR}
        >
          {filterCount > 0 ? (
            <>
              <span className="absolute min-h-5 min-w-5 -top-2 -right-2 block py-0.5 px-1.5 bg-primary shadow-sm rounded-full text-xs text-primary-foreground opacity-100 group-hover:opacity-0 transition-opacity duration-200">
                {filterCount}
              </span>
              <div
                className="absolute min-h-5 min-w-5 -top-2 -right-2 block bg-red-500 p-0.5 hover:bg-red-500 shadow-sm rounded-full text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer z-10"
                title={L.clearFilters}
                role="button"
                tabIndex={0}
              >
                <X className="w-4 h-4 scale-75" />
              </div>
            </>
          ) : null}
          <ListFilter />
          <span className="hidden lg:inline">{filterLabel}</span>
          <span className="lg:hidden">{short}</span>
        </button>
        <div style={{ position: "relative", display: "flex" }}>
          <button
            className={`${BUTTON1_W} ${OUTLINE} ${TEXT_SIZE}`}
            type="button"
            aria-haspopup="menu"
            aria-expanded={viewMenuOpen}
            data-state={viewMenuOpen ? "open" : "closed"}
            style={ICON_VAR}
          >
            <ViewIcon view={view} />
            <span>{L[VIEW_LABEL[view]]}</span>
            <ChevronDown className="opacity-60" />
          </button>
          {viewMenuOpen ? <ViewMenu view={view} highlight={viewMenuHighlight} labels={L} /> : null}
        </div>
        {view !== "kanban" ? (
          <button className={`${BUTTON1_W} bg-primary text-primary-foreground hover:bg-primary/90 ${TEXT_SIZE} new-add-task-btn`} title={L.newItem} style={ICON_VAR}>
            <Plus />
            <span className="hidden sm:inline-block">{L.newItem}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
};

const MENU_ITEM =
  "relative flex select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/** Open view-switcher menu (align end, 4px below the button). */
export const ViewMenu: React.FC<{ view: BoardView; highlight?: BoardView | null; labels: BoardLabels }> = ({ view, highlight, labels }) => (
  <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50 }}>
    <div
      role="menu"
      data-state="open"
      data-side="bottom"
      data-align="end"
      className="z-50 min-w-[8rem] overflow-hidden rounded-2xl border border-t-border bg-popover text-popover-foreground popover-content w-36 max-w-[144px] p-2 space-y-1 shadow-dropdown"
    >
      {(["grid", "list", "kanban"] as BoardView[]).map((v) => (
        <div
          key={v}
          role="menuitem"
          data-highlighted={highlight === v ? "" : undefined}
          className={cn(MENU_ITEM, v === view ? "cursor-pointer bg-accent text-primary" : "cursor-pointer text-primary/80")}
        >
          <ViewIcon view={v} className="h-4 w-4 mr-2" />
          {labels[VIEW_LABEL[v]]}
          {v === view ? <Check className="h-4 w-4 ml-auto" /> : null}
        </div>
      ))}
    </div>
  </div>
);
