/**
 * The live page header (back button + breadcrumb + right-side actions), rebuilt from the
 * day-2 DOM snapshots. Class strings are verbatim.
 */
import React from "react";
import { ChevronLeft, ChevronRight, Plus, Settings, SlidersHorizontal } from "lucide-react";

export type CrumbVariant =
  /** Ancestor link, e.g. "Home" on People / Data Templates (muted, max 140px). */
  | "link"
  /** Ancestor link as rendered on board pages (no wrapper span, no max width). */
  | "board-link"
  /** Current page, e.g. "People" (foreground, max 240px). */
  | "current"
  /** Editable page title on a board page, e.g. "Brand Deal Pipeline". */
  | "page-title"
  /** Current tab on a board page, e.g. "Prospecting Deals" (max 160px). */
  | "tab";

export type Crumb = { label: string; variant?: CrumbVariant };

export type TopBarProps = {
  crumbs: Crumb[];
  /** Back chevron button (present on every captured page). */
  showBack?: boolean;
  /** Extra nodes right after the breadcrumb (left group). */
  leftExtras?: React.ReactNode;
  /** Right-aligned actions (e.g. <TopBarSettingsButton/>, <HomeTopBarActions/>). */
  right?: React.ReactNode;
};

const CURRENT_CLASS: Record<Exclude<CrumbVariant, "link" | "board-link">, string> = {
  current: "font-normal text-foreground max-w-[240px] truncate",
  "page-title": "font-normal text-foreground max-w-[240px] truncate rounded px-1 -mx-1 cursor-text",
  tab: "font-normal text-foreground max-w-[160px] truncate",
};

const crumbLeaf = (c: Crumb, defaultVariant: CrumbVariant) => {
  const v = c.variant ?? defaultVariant;
  if (v === "link") return <a className="transition-colors hover:text-foreground cursor-pointer max-w-[140px] truncate shrink-0">{c.label}</a>;
  if (v === "board-link") return <a className="transition-colors hover:text-foreground cursor-pointer shrink-0">{c.label}</a>;
  return (
    <span className={CURRENT_CLASS[v]} role="link" aria-disabled="true" aria-current="page">
      {c.label}
    </span>
  );
};

export const TopBar: React.FC<TopBarProps> = ({ crumbs, showBack = true, leftExtras, right }) => {
  return (
    <div className="relative flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 bg-t-white px-4 py-1 border-b lg:h-12 lg:flex-nowrap lg:py-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 shrink overflow-hidden">
          <div className="flex items-center gap-3">
            {showBack ? (
              <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-muted" type="button" aria-label="Go back">
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
            <nav aria-label="breadcrumb">
              <ol className="flex items-center break-words text-sm text-muted-foreground flex-nowrap gap-1 sm:gap-1">
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  const leaf = crumbLeaf(c, last ? "current" : "link");
                  if (i === 0) {
                    if ((c.variant ?? (last ? "current" : "link")) === "board-link") {
                      return (
                        <li className="inline-flex items-center gap-1.5" key={i}>
                          {leaf}
                        </li>
                      );
                    }
                    return (
                      <span className="flex items-center gap-1 shrink-0" key={i}>
                        <li className="inline-flex items-center gap-1.5">{leaf}</li>
                      </span>
                    );
                  }
                  return (
                    <span className="flex items-center gap-1 shrink-0" key={i}>
                      <li className="[&>svg]:w-3.5 [&>svg]:h-3.5" role="presentation" aria-hidden="true">
                        <ChevronRight />
                      </li>
                      <li className="inline-flex items-center gap-1.5">{leaf}</li>
                    </span>
                  );
                })}
              </ol>
            </nav>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 empty:hidden">{leftExtras}</div>
      </div>
      <div className="hidden">
        <div className="lg:pointer-events-auto empty:hidden" />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="flex shrink-0 items-center gap-2 empty:hidden" />
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </div>
  );
};

const BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

/** People page: outlined settings menu button (people-members.html). */
export const TopBarSettingsButton: React.FC<{ srLabel?: string }> = ({ srLabel = "Settings" }) => (
  <button
    className={BTN.replace("whitespace-nowrap", "whitespace-nowrap rounded-md") + " border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 w-8"}
    type="button"
    aria-haspopup="menu"
    data-state="closed"
  >
    <Settings className="h-4 w-4" aria-hidden="true" />
    <span className="sr-only">{srLabel}</span>
  </button>
);

/** Home page: "Customize" sliders button + primary "Add widgets" button (home-dashboard.html). */
export const HomeTopBarActions: React.FC<{ addLabel?: string; pressed?: boolean }> = ({ addLabel = "Add widgets", pressed }) => (
  <div className="flex shrink-0 items-center gap-2.5">
    <button className={`${BTN} hover:bg-accent h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground`} type="button" aria-label="Customize" data-state="closed">
      <SlidersHorizontal className="h-4 w-4" />
    </button>
    <button
      className="inline-flex items-center justify-center gap-1 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none h-8 rounded-lg px-2.5 text-sm font-normal leading-5 tracking-normal shadow-none"
      type="button"
      style={pressed ? { backgroundColor: "hsl(var(--primary) / 0.9)" } : undefined}
    >
      <Plus className=" h-4 w-4" />
      {addLabel}
    </button>
  </div>
);
