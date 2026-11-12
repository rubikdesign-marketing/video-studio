/**
 * The live Tulvo sidebar, rebuilt element-for-element from the day-2 DOM snapshots
 * (research/ui-live/dom/people-members.html, home-dashboard.html, board-*.html).
 * Class strings are copied verbatim so app.scoped.css styles them exactly like the app.
 *
 * Frame-agnostic: no state, no effects. Hover is not real in a render, so `hoverKey`
 * reproduces the app's :hover look on one item (bg-accent, revealed row actions).
 */
import React from "react";
import { ChevronDown, ChevronRight, CircleHelp, Database, Ellipsis, Plus, Rocket, Search, X } from "lucide-react";
import { cn } from "../cn";
import type { SidebarData, SidebarPage, Workspace } from "../fixtures";
import {
  CollapseSidebarIcon,
  HomeIcon,
  SupportEmailIcon,
  TablerLayoutGrid,
  TrashIcon,
  TulvoAiIcon,
} from "../icons/app-icons";
import { IntegrationLogoSlot } from "../icons/IntegrationLogoSlot";

export type NavId = "home" | "deploy" | "data-templates" | "tulvo-ai";
export type SidebarSectionId = "recents" | "public" | "private" | "integrations";

/** UI chrome labels, verbatim from the live app (override only to follow a product change). */
export const SIDEBAR_LABELS = {
  search: "Search...",
  addNew: "Add New",
  home: "Home",
  deploy: "Deploy",
  dataTemplates: "Data Templates",
  tulvoAi: "Tulvo AI",
  beta: "Beta",
  recents: "Recents",
  public: "Public",
  private: "Private",
  integrations: "Integrations",
  emptyRecents: "No recent pages yet",
  emptyPublic: "No public pages yet",
  /** Not observed live (Private was collapsed in every capture): empty by default = no empty box. */
  emptyPrivate: "",
  help: "Help",
  trash: "Trash",
  supportTitle: "Have questions?",
  // sic: the live app says "vai"
  supportBody: "Feel free to reach out to us vai email or support page",
  supportCta: "Reach out",
};
export type SidebarLabels = typeof SIDEBAR_LABELS;

export type SidebarProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  /** Highlighted top-level nav item (null on pages that are not in the nav, e.g. People). */
  activeNav?: NavId | null;
  /** Highlighted page (matches SidebarPage.id; highlighted in every section it appears in). */
  activePageId?: string | null;
  /**
   * Simulated pointer hover. Keys: "search", "add-new", "nav:<NavId>", "recents:<pageId>",
   * "public:<pageId>", "private:<pageId>", "integration:<id>", "section:<SidebarSectionId>",
   * "footer:help", "footer:trash".
   */
  hoverKey?: string | null;
  /** Section open state (live default: all open except Private). */
  openSections?: Partial<Record<SidebarSectionId, boolean>>;
  /** Support card ("Have questions?") is dismissible in the app; shown by default. */
  showSupportCard?: boolean;
  /** Vertical scroll of the sidebar content in px (animate this for a scroll). */
  scrollTop?: number;
  /** Sidebar width in px (live: 248). */
  width?: number;
  /** Logo nodes per integration id. Default: neutral placeholder tiles (no third-party marks). */
  integrationLogos?: Partial<Record<string, React.ReactNode>>;
  labels?: Partial<SidebarLabels>;
};

const DEFAULT_OPEN: Record<SidebarSectionId, boolean> = { recents: true, public: true, private: false, integrations: true };

// class strings (verbatim) -------------------------------------------------------------
const NAV_LINK_BASE = "flex items-center gap-2 p-2 h-8 text-sm app-sidebar-menu-link ";
const IDLE = "hover:bg-accent dark:hover:bg-sidebar-item-hover text-muted-foreground";
const ACTIVE = "bg-[#f0f0f0] dark:bg-sidebar-item-hover active text-primary";
const PAGE_LINK_BASE =
  "app-sidebar-menu-link group flex items-center p-2 gap-3 justify-between text-sm whitespace-nowrap transition-opacity duration-300 rounded-lg overflow-hidden h-8 opacity-100";
const SECTION_HEADER =
  "flex items-center justify-between mx-2 px-2 rounded-lg h-8 text-muted-foreground cursor-pointer hover:bg-accent dark:hover:bg-sidebar-item-hover hover:text-primary transition-colors select-none group";
const SECTION_LABEL =
  "peer-disabled:cursor-not-allowed peer-disabled:opacity-70 app-sidebar-section-label whitespace-nowrap truncate flex text-xs font-normal items-center gap-1 text-muted-foreground cursor-pointer pointer-events-none";
const BTN_BASE =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
const SECTION_ADD_BTN = `${BTN_BASE.replace("whitespace-nowrap", "whitespace-nowrap rounded-md")} hover:bg-accent hover:text-accent-foreground add-page-btn h-6 w-6`;
const ROW_ADD_BTN = `${BTN_BASE} hover:bg-accent hover:text-accent-foreground add-page-btn cursor-pointer w-5 h-5 rounded-sm bg-accent p-0.5 opacity-0 group-hover:opacity-100`;
const INTEGRATION_LINK = "flex items-center h-8 px-2 text-sm app-sidebar-menu-link rounded-lg transition-colors ";

/** :hover look for elements whose hover classes cannot fire in a render. */
const HOVER_BG: React.CSSProperties = { backgroundColor: "hsl(var(--accent))" };

/**
 * Empty section ("No recent pages yet"). NOT in the DOM snapshots: geometry measured from
 * research/ui-live/02-data-templates-empty.jpg (box 8..237 x 32px, 12px below the header,
 * dashed hairline, centred text-xs muted). Verify against a DOM capture before a close-up.
 */
const EmptySection: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-2 mt-3 pb-5">
    <div className="flex h-8 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">{label}</div>
  </div>
);

export const Sidebar: React.FC<SidebarProps> = ({
  workspace,
  sidebar,
  activeNav = null,
  activePageId = null,
  hoverKey = null,
  openSections,
  showSupportCard = true,
  scrollTop = 0,
  width = 248,
  integrationLogos,
  labels: labelOverrides,
}) => {
  const L = { ...SIDEBAR_LABELS, ...labelOverrides };
  const open = { ...DEFAULT_OPEN, ...openSections };
  const hov = (k: string) => hoverKey === k;

  const navLink = (id: NavId, icon: React.ReactNode, label: string) => {
    const active = activeNav === id;
    return (
      <li className="app-sidebar-menu-item rounded-lg overflow-hidden" key={id}>
        <a
          className={NAV_LINK_BASE + " " + (active ? ACTIVE : IDLE)}
          aria-current={active ? "page" : undefined}
          style={!active && hov(`nav:${id}`) ? HOVER_BG : undefined}
        >
          <span className="flex items-center gap-2 h-[20px]">
            {icon}
            <span className="app-sidebar-label truncate">{label}</span>
          </span>
        </a>
      </li>
    );
  };

  const pageRow = (section: SidebarSectionId, page: SidebarPage) => {
    const active = activePageId === page.id;
    const hovered = hov(`${section}:${page.id}`);
    return (
      <a
        className={cn(PAGE_LINK_BASE, active ? ACTIVE : IDLE)}
        aria-current={active ? "page" : undefined}
        aria-roledescription={section === "recents" ? undefined : "sortable"}
        title={page.title}
        style={hovered && !active ? HOVER_BG : undefined}
      >
        <span className="flex items-center h-[20px] min-w-0 flex-1">
          <TablerLayoutGrid
            className="tabler-icon tabler-icon-layout-grid app-sidebar-icon min-w-[18px] max-w-[18px] h-[18px] flex-shrink-0 cursor-pointer"
            style={page.iconColor ? { color: page.iconColor } : undefined}
          />
          <span className="app-sidebar-label truncate whitespace-nowrap ml-2 min-w-0 flex-1">{page.title}</span>
        </span>
        <div
          className="flex gap-1 items-center max-w-0 overflow-hidden group-hover:max-w-[4.5rem] flex-shrink-0 "
          title=""
          style={hovered ? { maxWidth: "4.5rem" } : undefined}
        >
          <span className="inline-flex" title="Add Subpage">
            <span className="inline-flex" data-state="closed">
              <button className={ROW_ADD_BTN} type="button" aria-label="Add new page" style={hovered ? { opacity: 1 } : undefined}>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            </span>
          </span>
          <span className="inline-flex" title="More Actions">
            <div>
              <Ellipsis
                className="nav-dropdown-action-btn cursor-pointer w-[18px] h-[18px] rounded-sm bg-accent p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100"
                aria-hidden="true"
                style={hovered ? { opacity: 1 } : undefined}
              />
            </div>
          </span>
        </div>
      </a>
    );
  };

  const sectionHeader = (id: SidebarSectionId, label: string, withAdd: boolean, className = SECTION_HEADER) => (
    <div
      className={className}
      style={hov(`section:${id}`) ? { ...HOVER_BG, color: "hsl(var(--primary))" } : undefined}
    >
      <label className={SECTION_LABEL}>
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200",
            open[id] ? "rotate-90" : "",
            "text-muted-foreground"
          )}
        />
        {label}
      </label>
      {withAdd ? (
        <div className="flex items-center gap-0.5">
          <span className="inline-flex" title="Add Page">
            <span className="inline-flex" data-state="closed">
              <button className={SECTION_ADD_BTN} type="button" aria-label="Add new page">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );

  const pageSection = (id: "public" | "private", label: string, pages: SidebarPage[], emptyLabel: string) => (
    <div className="app-sidebar-section">
      {sectionHeader(id, label, true)}
      {open[id] && pages.length === 0 && emptyLabel ? <EmptySection label={emptyLabel} /> : null}
      {open[id] && pages.length > 0 ? (
        <ul className="app-sidebar-menu px-2 mt-1 pb-5 space-y-1" role="list">
          {pages.map((p) => (
            <li key={p.id}>
              <div className="app-sidebar-menu-item space-y-2 min-h-8">{pageRow(id, p)}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <div
      className="app-sidebar group/sidebar h-screen border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out sticky top-0 z-drawer"
      data-expanded="true"
      style={{ width }}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* header: workspace switcher */}
        <div className="app-sidebar-header shrink-0">
          <div className="w-full relative px-2">
            <div className="w-full flex py-2 justify-start cursor-pointer" aria-haspopup="menu" data-state="closed">
              <div className="relative">
                <span className="relative flex shrink-0 overflow-hidden h-8 w-8 rounded-md border bg-muted">
                  <div className="flex h-full w-full items-center justify-center rounded-md bg-muted text-muted-foreground font-medium text-sm">
                    {workspace.initial}
                  </div>
                </span>
              </div>
              <span className="text-primary/80 whitespace-nowrap transition-opacity duration-300 flex items-center gap-2 ml-2 w-full opacity-100">
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="truncate font-medium">{workspace.name}</span>
                    <ChevronDown size={16} className="shrink-0 transition-transform duration-200" />
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{workspace.memberCountLabel}</span>
                </div>
                <CollapseSidebarIcon className="cursor-pointer shrink-0" style={{ fill: "none", flexShrink: 0 }} />
              </span>
            </div>
          </div>
        </div>

        {/* scrolling content */}
        <div className="app-sidebar-content flex-1 min-h-0 hover-custom-y-scrollbar">
          <div className="min-h-full flex flex-col" style={scrollTop ? { transform: `translateY(${-scrollTop}px)` } : undefined}>
            <button
              className="mt-2 border border-border overflow-hidden bg-card h-8 flex items-center gap-2 p-2 text-sm hover:bg-accent cursor-pointer rounded-lg text-muted-foreground mx-2 w-[calc(100%-16px)]"
              role="button"
              tabIndex={0}
              aria-label="Search sidebar and pages"
              data-state="closed"
              style={hov("search") ? HOVER_BG : undefined}
            >
              <Search className="size-4 shrink-0" />
              <span className="truncate">{L.search}</span>
            </button>

            <div className="space-y-1 shrink-0">
              <div>
                <ul className="app-sidebar-menu px-2 pt-1 pb-2" role="list">
                  <li className="app-sidebar-menu-item rounded-lg overflow-hidden ">
                    <button
                      className="inline-flex items-center whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none h-8 p-2 self-stretch rounded-lg gap-2 text-sm font-normal bg-transparent text-muted-foreground shadow-none hover:bg-accent w-full justify-start"
                      type="button"
                      aria-label="New page"
                      style={hov("add-new") ? HOVER_BG : undefined}
                    >
                      <Plus className="w-[18px] h-[18px] shrink-0" />
                      <span className="truncate">{L.addNew}</span>
                    </button>
                  </li>
                </ul>
                <ul className="app-sidebar-menu px-2 py-2 space-y-1" role="list">
                  {navLink("home", <HomeIcon className="app-sidebar-icon w-4 h-4" />, L.home)}
                  {navLink("deploy", <Rocket strokeWidth={1.5} className="app-sidebar-icon w-4 h-4" />, L.deploy)}
                  {navLink(
                    "data-templates",
                    <Database strokeWidth={1.5} className="app-sidebar-icon w-4 h-4" />,
                    L.dataTemplates
                  )}
                  <li className="app-sidebar-menu-item rounded-lg overflow-hidden mb-2 relative">
                    <button
                      className={cn(
                        "w-full flex items-center gap-2 p-2 h-8 text-sm font-normal app-sidebar-menu-link cursor-pointer outline-none border-none transition-colors",
                        activeNav === "tulvo-ai" ? ACTIVE : IDLE
                      )}
                      aria-current={activeNav === "tulvo-ai" ? "page" : undefined}
                      style={activeNav !== "tulvo-ai" && hov("nav:tulvo-ai") ? HOVER_BG : undefined}
                    >
                      <span className="flex items-center gap-2 w-full">
                        <div className="relative w-5 h-5 flex items-center justify-center -ml-0.5">
                          <TulvoAiIcon className="app-sidebar-icon w-4 h-4" />
                        </div>
                        <span className="app-sidebar-label flex min-w-0 flex-1 items-center justify-between gap-2">
                          <span className="truncate min-w-0">{L.tulvoAi}</span>
                          <span className="app-sidebar-beta-badge shrink-0 rounded-full bg-[#e6f4fe] px-2 h-[22px] inline-flex items-center text-xs font-medium text-[#0090ff]">
                            {L.beta}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* Recents */}
              <div className="app-sidebar-section">
                {sectionHeader("recents", L.recents, false)}
                {open.recents && sidebar.recents.length === 0 ? <EmptySection label={L.emptyRecents} /> : null}
                {open.recents && sidebar.recents.length > 0 ? (
                  <ul className="app-sidebar-menu px-2 mt-1 pb-5 space-y-1" role="list">
                    {sidebar.recents.map((p) => (
                      <li className="app-sidebar-menu-item space-y-2 h-8" key={p.id}>
                        {pageRow("recents", p)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {pageSection("public", L.public, sidebar.publicPages, L.emptyPublic)}
              {pageSection("private", L.private, sidebar.privatePages, L.emptyPrivate)}
            </div>

            {/* Integrations */}
            <div className="shrink-0">
              <div>
                {sectionHeader(
                  "integrations",
                  L.integrations,
                  false,
                  SECTION_HEADER.replace("text-muted-foreground", "text-primary/80")
                )}
                {open.integrations ? (
                  <ul className="flex flex-col mt-1 space-y-1 app-sidebar-menu px-2 pb-5">
                    {sidebar.integrations.map((it) => {
                      const logo = (
                        <IntegrationLogoSlot
                          logo={integrationLogos?.[it.id]}
                          className="min-h-[18px] min-w-[18px] max-h-[18px] max-w-[18px]"
                        />
                      );
                      return (
                        <li className="rounded-lg overflow-hidden app-sidebar-menu-item relative " key={it.id}>
                          {it.disabled ? (
                            <span
                              className="flex items-center h-8 px-2 text-sm app-sidebar-menu-link opacity-60 cursor-not-allowed text-primary/70 rounded-lg "
                              data-state="closed"
                            >
                              {logo}
                              <span className="ml-2 app-sidebar-label">{it.name}</span>
                            </span>
                          ) : (
                            <a
                              className={INTEGRATION_LINK + " " + IDLE}
                              data-state="closed"
                              style={hov(`integration:${it.id}`) ? HOVER_BG : undefined}
                            >
                              {logo}
                              <span className="ml-2 app-sidebar-label">{it.name}</span>
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </div>

            {/* Support card */}
            {showSupportCard ? (
              <div className="shrink-0">
                <div className="support-email rounded-[18px] border min-w-48 bg-card p-3 m-2 mb-4 space-y-4">
                  <div className="flex justify-between">
                    <div className="support-email-icon flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground">
                      <SupportEmailIcon className="size-4" />
                    </div>
                    <button
                      className={`${BTN_BASE} hover:bg-accent hover:text-accent-foreground h-8 w-8 rounded-[10px] support-email-close-button`}
                    >
                      <X />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h3 className="support-email-title text-sm font-medium">{L.supportTitle}</h3>
                    <p className="support-email-sub-title text-xs text-muted-foreground">{L.supportBody}</p>
                  </div>
                  <a className="inline-flex items-center justify-center gap-1 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3 w-full text-sm font-normal rounded-[10px] support-email-action-button">
                    {L.supportCta}
                  </a>
                </div>
              </div>
            ) : null}

            <div className="flex-1 min-h-0" aria-hidden="true" />

            {/* footer */}
            <div className="shrink-0">
              <nav className="px-2 app-sidebar-header dark:border-white/10">
                <ul className="space-y-2 py-2 app-sidebar-menu">
                  <li className="rounded-lg overflow-hidden app-sidebar-menu-item ">
                    <a
                      className={INTEGRATION_LINK + " " + IDLE}
                      data-state="closed"
                      style={hov("footer:help") ? HOVER_BG : undefined}
                    >
                      <CircleHelp className="w-4 h-4 app-sidebar-icon" />
                      <span className="ml-2">{L.help}</span>
                    </a>
                  </li>
                  <li
                    className="flex items-center h-8 px-2 text-sm cursor-pointer rounded-lg app-sidebar-menu-item app-sidebar-menu-link transition-colors  text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    data-state="closed"
                    style={
                      hov("footer:trash")
                        ? { backgroundColor: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }
                        : undefined
                    }
                  >
                    <TrashIcon className="w-4 h-4 app-sidebar-icon" />
                    <span className="ml-2">{L.trash}</span>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>
      <button
        className="app-sidebar-resizer absolute -right-[5px] top-0 bottom-0 px-1 cursor-ew-resize"
        data-sidebar="rail"
        data-slot="sidebar-rail"
        aria-label="Resize Sidebar"
        tabIndex={-1}
        title="Resize Sidebar"
      />
    </div>
  );
};
