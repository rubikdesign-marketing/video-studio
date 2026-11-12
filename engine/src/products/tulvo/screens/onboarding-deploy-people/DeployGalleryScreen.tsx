/**
 * Deploy gallery (/deploy), rebuilt from research/ui-live/dom/deploy-gallery.html (class strings verbatim).
 * Top row: "start with a blank project" tile, 4 starter templates, "All templates (N)". Below: grid / list toggle
 * and the "Public" group of the workspace's Deploy projects; each project card previews its site (iframe at 400%
 * scaled 0.25, like the app).
 *
 * Template thumbnails: the app loads them from its template CDN; they show third-party template designs, so the
 * slot is a prop (`thumbnailSrc`) and defaults to an empty card (no image). Template names are plain text.
 */
import React from "react";
import { Img } from "remotion";
import { ChevronDown, Ellipsis, LayoutGrid, List, Plus, Star } from "lucide-react";
import type { SidebarData, Workspace } from "../../fixtures";
import { AppShell } from "../../shell/AppShell";
import { PersonaSiteFrame, type PersonaSiteContent } from "./PersonaSite";

export type DeployTemplateCard = { id: string; name: string; tag: string; thumbnailSrc?: string };
export type DeployProjectCard = { id: string; name: string; updatedLabel: string; ownerInitials: string; site: PersonaSiteContent };

export type DeployGalleryScreenProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  templates: DeployTemplateCard[];
  allTemplatesCount: number;
  projects: DeployProjectCard[];
  groupLabel: string;
  /** Project card in its hover state (lift + star / more buttons). */
  hoveredProjectId: string | null;
  labels: { deploy: string; blankLine1: string; blankLine2: string; allTemplates: string; browse: string };
  showCookieSettings: boolean;
  sidebarScrollTop: number;
};

const CHIP =
  "inline-flex items-center border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 max-w-full truncate whitespace-nowrap rounded border-transparent px-1.5 py-px text-[10px] font-normal leading-4 bg-muted/50 text-muted-foreground";
const ZOOM = "absolute inset-0 transform-gpu transition-transform duration-200 ease-out group-hover:scale-[1.03] group-focus-within:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100";

const MiniBrowser: React.FC = () => (
  <div className="shrink-0" style={{ width: 112, height: 70, transform: "scale(0.847366)" }}>
    <div className="relative h-full w-full">
      <div className="absolute inset-0 rounded-lg border border-dashed border-border bg-muted/40" />
      <div className="absolute inset-0 rounded-lg rotate-6 border border-border bg-card/80" />
      <div className="absolute inset-0 rounded-lg flex -rotate-6 flex-col overflow-hidden border border-border bg-card shadow-sm">
        <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1">
          <span className="h-1 w-1 rounded-full bg-muted" />
          <span className="h-1 w-1 rounded-full bg-muted" />
          <span className="h-1 w-1 rounded-full bg-muted" />
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1 p-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="flex flex-col gap-[2px] rounded-sm border border-border bg-muted/50 p-[2px]" key={i}>
              <div className="min-h-0 flex-1 rounded-[1px] bg-muted" />
              <div className="h-[2px] w-3/4 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const DeployGalleryScreen: React.FC<DeployGalleryScreenProps> = (p) => (
  <AppShell
    workspace={p.workspace}
    sidebar={p.sidebar}
    activeNav="deploy"
    crumbs={[{ label: p.labels.deploy }]}
    showCookieSettings={p.showCookieSettings}
    sidebarScrollTop={p.sidebarScrollTop}
  >
    <div className="h-screen w-full overflow-y-auto bg-background">
      <div className="w-full px-4 lg:px-[3.375rem] flex min-h-full flex-col py-6 lg:py-8">
        <section className="mb-10 shrink-0">
          <div className="grid w-full grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            <div className="group flex w-full flex-col">
              <div className="border relative aspect-video w-full overflow-hidden rounded-xl shadow-none transition-colors flex flex-col items-center justify-center gap-1.5 border-dashed bg-transparent px-3 text-center text-muted-foreground/70 group-hover:bg-accent/70">
                <Plus className="h-6 w-6" />
                <p className="text-sm font-normal  leading-snug ">
                  {p.labels.blankLine1}
                  <br />
                  {p.labels.blankLine2}
                </p>
                <button className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed" type="button" aria-label="Blank Project" />
              </div>
            </div>
            {p.templates.map((t) => (
              <div className="group flex w-full flex-col gap-2.5" key={t.id}>
                <div className="border bg-card text-card-foreground relative aspect-video w-full overflow-hidden rounded-xl shadow-none transition-colors">
                  <button className="absolute inset-0 block rounded-xl text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed" type="button" aria-label={`Preview the ${t.name} template`}>
                    <div className={ZOOM}>
                      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
                        {t.thumbnailSrc ? <Img className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-300 opacity-100" alt="" src={t.thumbnailSrc} /> : null}
                      </div>
                    </div>
                  </button>
                </div>
                <div className="cursor-pointer">
                  <div className="flex min-w-0 flex-col gap-1.5 px-0.5">
                    <p className="min-h-6 truncate text-xs font-medium leading-6 text-foreground/70">{t.name}</p>
                    <div className="flex flex-wrap gap-1">
                      <div className={CHIP}>{t.tag}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="group flex w-full flex-col gap-2.5">
              <div className="border bg-card text-card-foreground relative aspect-video w-full overflow-hidden rounded-xl shadow-none transition-colors">
                <div className={ZOOM}>
                  <div className="flex h-full w-full items-center justify-center overflow-hidden" aria-hidden="true">
                    <MiniBrowser />
                  </div>
                </div>
                <button className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed" type="button" aria-label={`Browse all ${p.allTemplatesCount} templates`} />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5 px-0.5">
                <p className="min-h-6 truncate text-xs font-medium leading-6 text-foreground/70">{`${p.labels.allTemplates} (${p.allTemplatesCount})`}</p>
                <div className="flex flex-wrap gap-1">
                  <div className={CHIP}>{p.labels.browse}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-4">
            <div className="flex items-center rounded-md border border-border p-0.5">
              <button
                className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-7 w-7 bg-accent text-foreground"
                type="button"
                aria-label="Grid view"
                aria-pressed="true"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent h-7 w-7 text-muted-foreground hover:text-foreground"
                type="button"
                aria-label="List view"
                aria-pressed="false"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="relative w-full" style={{ height: 260 }}>
            <div className="absolute left-0 top-0 w-full" data-index="0" style={{ transform: "translateY(0px)" }}>
              <div className="mb-3 ">
                <div className="flex min-h-8 items-center gap-2">
                  <button className="flex min-w-0 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" type="button" aria-expanded="true">
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
                    <h2 className="truncate text-base font-medium">{p.groupLabel}</h2>
                    <div className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 font-normal tabular-nums">
                      {p.projects.length}
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div className="absolute left-0 top-0 w-full" data-index="1" style={{ transform: "translateY(44px)" }}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ">
                {p.projects.map((pr) => {
                  const hover = p.hoveredProjectId === pr.id;
                  return (
                    <div className="group flex w-full flex-col gap-2.5 rounded-xl text-left transition-colors focus-visible:outline-none cursor-pointer " role="button" tabIndex={0} key={pr.id}>
                      <div
                        className="text-card-foreground relative aspect-video w-full overflow-hidden rounded-xl shadow-none transition-colors border border-transparent hover:border-gray-200/60 bg-muted"
                        style={hover ? { borderColor: "rgb(229 231 235 / 0.6)" } : undefined}
                      >
                        <div
                          className="absolute inset-0 transform-gpu transition-transform duration-200 ease-out motion-reduce:transition-none group-hover:scale-[1.03] group-focus-within:scale-[1.03] motion-reduce:group-hover:scale-100"
                          style={hover ? { transform: "scale(1.03)" } : undefined}
                        >
                          <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
                            <PersonaSiteFrame
                              content={pr.site}
                              mode="thumbnail"
                              title="Project preview"
                              className="absolute inset-0 border-0 transition-opacity duration-300 opacity-100"
                              style={{ width: "400%", height: "400%", transform: "scale(0.25)", transformOrigin: "left top", pointerEvents: "none" }}
                            />
                          </div>
                        </div>
                        <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
                          <button
                            className="items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input hover:text-accent-foreground nav-dropdown-action-btn h-6 w-6 shrink-0 rounded-sm bg-muted p-1 text-foreground shadow-sm hover:bg-muted hidden group-hover:inline-flex"
                            type="button"
                            aria-label="Add to Favorites"
                            style={hover ? { display: "inline-flex" } : undefined}
                          >
                            <Star className="h-full w-full" />
                          </button>
                          <span className="shrink-0 hidden group-hover:inline-flex" style={hover ? { display: "inline-flex" } : undefined}>
                            <Ellipsis className="nav-dropdown-action-btn h-6 w-6 cursor-pointer rounded-sm border border-border bg-muted p-1 text-foreground shadow-sm" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                      <div className="flex min-w-0  flex-col gap-1.5 px-0.5 ">
                        <div className="flex min-h-6 items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/70">{pr.name}</p>
                          <span className="flex shrink-0 items-center gap-1.5" data-state="closed">
                            <span className="relative flex overflow-hidden rounded-full shrink-0 h-4 w-4">
                              <span className="flex h-full w-full items-center justify-center rounded-full bg-muted text-[8px]">{pr.ownerInitials}</span>
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <div className={CHIP}>{pr.updatedLabel}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </AppShell>
);

export const DEPLOY_GALLERY_LABELS: DeployGalleryScreenProps["labels"] = {
  deploy: "Deploy",
  blankLine1: "You can start with a",
  blankLine2: "blank project",
  allTemplates: "All templates",
  browse: "browse",
};

/** Starter templates shown on 20 Oct 2026 (the row rotates; names/tags as captured, thumbnails not used). */
export const DEPLOY_TEMPLATES_CAPTURED: DeployTemplateCard[] = [
  { id: "reflux", name: "Reflux", tag: "creative portfolios" },
  { id: "xmas-countdown", name: "Xmas Countdown", tag: "events & nonprofit" },
  { id: "get-ready", name: "Get Ready", tag: "events" },
  { id: "topic-listing", name: "Topic Listing", tag: "education & learning" },
];
