/**
 * Deploy editor (/pages/<id> of a Deploy project), rebuilt from research/ui-live/dom/deploy-editor-preview.html,
 * deploy-editor-edit-mode.html and deploy-editor-element-selected.html (class strings verbatim; the hidden
 * AI-assistant drawer and the hidden duplicate header are omitted). Overlays: the Custom domain dialog
 * (CustomDomainDialog) and Connect Data (ConnectDataModal).
 *
 * Modes:  "preview"  canvas = the site iframe at 75% (fit to width), Pages / Files / Assets
 *         "edit"     canvas at 52%, Layers tab, inspector on the right ("Select an element to edit"),
 *                    or, with `selection`, the blue ring + floating "Edit text" bar + Style inspector.
 */
import React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Database,
  GripVertical,
  House,
  Maximize2,
  Monitor,
  MousePointerClick,
  PanelTop,
  Pencil,
  Plus,
  Redo2,
  Save,
  Scan,
  Search,
  Settings,
  Smartphone,
  TableOfContents,
  Tablet,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { SidebarData, Workspace } from "../../fixtures";
import { AppShell } from "../../shell/AppShell";
import { ConnectDataModal, type ConnectDataModalProps } from "./ConnectDataModal";
import { CustomDomainDialog, type CustomDomainDialogProps } from "./CustomDomainDialog";
import { PersonaSiteFrame, type PersonaSiteContent } from "./PersonaSite";
import { appVw } from "./shared";

// ------------------------------------------------------------------------------------------------ header

export type DeployEditorMode = "edit" | "preview";

export type DeployHeaderProps = {
  deployLabel: string;
  siteName: string;
  /** "Draft" (title "Not published"). */
  statusLabel: string;
  savedLabel: string;
  mode: DeployEditorMode;
  modeLabels: { edit: string; preview: string; code: string };
  saveLabel: string;
  publishLabel: string;
  /** Save is disabled (muted) until something changes; the enabled look was not captured. */
  publishState: "idle" | "hover";
  avatarInitials: string;
  /** The app's per-user avatar colour (live: #94FADB). */
  avatarColor: string;
};

const MODE_BTN = "h-[26px] rounded-md px-4 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const DeployHeader: React.FC<DeployHeaderProps> = (h) => (
  <div className="relative flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 bg-t-white px-4 py-1 border-b lg:h-12 lg:flex-nowrap lg:py-0">
    <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[calc(50%-124px)]">
      <div className="min-w-0 shrink overflow-hidden">
        <div className="flex items-center gap-3">
          <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-muted" type="button" aria-label="Go back">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <nav aria-label="breadcrumb">
            <ol className="flex items-center break-words text-sm text-muted-foreground flex-nowrap gap-1 sm:gap-1">
              <li className="inline-flex items-center gap-1.5">
                <a className="transition-colors hover:text-foreground cursor-pointer shrink-0">{h.deployLabel}</a>
              </li>
              <span className="flex items-center gap-1 shrink-0">
                <li className="[&>svg]:w-3.5 [&>svg]:h-3.5" role="presentation" aria-hidden="true">
                  /
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="font-normal text-foreground max-w-[240px] truncate rounded px-1 -mx-1" role="link" aria-disabled="true" aria-current="page">
                    {h.siteName}
                  </span>
                </li>
              </span>
            </ol>
          </nav>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 empty:hidden">
        <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground" title="Not published">
          {h.statusLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 border-l border-border pl-2.5 text-xs text-muted-foreground" title="Saved">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {/* live class "lg:max-xl:sr-only" omitted: no effect at 1512 px, and a Tailwind v4 build would apply it at 1080 px */}
          <span>{h.savedLabel}</span>
        </span>
      </div>
    </div>
    <div className="order-last flex basis-full justify-center pb-1 lg:pointer-events-none lg:absolute lg:inset-0 lg:order-none lg:basis-auto lg:items-center lg:pb-0">
      <div className="lg:pointer-events-auto empty:hidden">
        <div className="flex gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5" role="group" aria-label="Editor mode">
          {(["edit", "preview", "code"] as const).map((m) => (
            <button
              key={m}
              className={`${MODE_BTN} ${h.mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              type="button"
              aria-label={h.modeLabels[m]}
              aria-pressed={h.mode === m}
            >
              {h.modeLabels[m]}
            </button>
          ))}
        </div>
      </div>
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <div className="flex shrink-0 items-center gap-2 empty:hidden">
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors cursor-not-allowed border-border bg-background text-muted-foreground"
            type="button"
            aria-label="Save"
            disabled
            data-state="closed"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {h.saveLabel}
          </button>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 bg-foreground text-background hover:opacity-90"
            type="button"
            aria-label="Publish site"
            style={h.publishState === "hover" ? { opacity: 0.9 } : undefined}
          >
            {h.publishLabel}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div>
          <button className="tiptap-button gap-2 px-2" data-style="ghost" data-appearance="subdued" type="button" aria-haspopup="menu" data-state="closed" style={{ padding: "0.25rem" }}>
            <div className="tiptap-avatar-group " data-max-user-visible="3">
              <span
                className="tiptap-avatar "
                data-size="default"
                style={{ "--dynamic-user-color": h.avatarColor, "--dynamic-user-fallback-text-color": "rgba(15, 23, 42, 0.92)" } as React.CSSProperties}
              >
                <span className="tiptap-avatar-item">
                  <span className="tiptap-avatar-bg " />
                  <span className="tiptap-avatar-fallback ">{h.avatarInitials}</span>
                </span>
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ------------------------------------------------------------------------------------------------ left panel

export type DeployTreeSection = { id: string; label: string };

const TOOL_BTN =
  "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:bg-muted data-[state=open]:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground";
const SEG = "h-[26px] flex-1 rounded-md px-1 text-[13px] font-medium transition-colors";
const SEG_ON = "bg-background text-foreground shadow-[0_0_0_1px_hsl(var(--border))]";
const SEG_OFF = "text-muted-foreground hover:text-foreground";

type PagesPanelProps = {
  mode: DeployEditorMode;
  labels: DeployEditorScreenProps["labels"];
  siteName: string;
  pageFile: string;
  sections: DeployTreeSection[];
  activeTool: "seo" | "database" | "analytics" | "settings" | null;
};

const PagesPanel: React.FC<PagesPanelProps> = ({ mode, labels: L, siteName, pageFile, sections, activeTool }) => {
  const tabs = mode === "edit" ? [L.pages, L.layers, L.files, L.assets] : [L.pages, L.files, L.assets];
  return (
    <div className="relative h-full min-h-0 shrink-0 hidden lg:block" style={{ width: `clamp(220px, ${appVw(18)}, 264px)` }}>
      <div className="bg-card h-full min-h-0 w-full overflow-hidden rounded-xl border">
        <div className="flex h-full min-h-0 flex-col px-3 pb-3 pt-4">
          <div className="shrink-0">
            <p className="text-sm font-medium tracking-wide">{L.websitePages}</p>
          </div>
          <div className="mt-3 min-h-0 overflow-y-auto !scrollbar max-h-[40%] shrink-0 !scrollbar-w-0.5 scrollbar-track-transparent scrollbar-thumb-transparent hover:scrollbar-thumb-gray-400/50  dark:scrollbar-thumb-transparent dark:hover:scrollbar-thumb-gray-400/50">
            <div className="flex flex-col gap-1">
              <div className="group relative flex min-h-9 items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-accent/60 bg-accent">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <House className="size-3.5" aria-hidden="true" />
                </span>
                <button className="min-w-0 flex-1 truncate py-2 text-left text-sm font-medium" type="button" aria-current="page">
                  {siteName}
                </button>
                <span className="shrink-0 rounded border border-border/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{L.main}</span>
              </div>
              <div className="ml-3 border-l border-border/40 pl-1">
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{L.noSubpages}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-border/60 pt-3">
            <section className="flex min-h-0 flex-1 flex-col" aria-label="Project content">
              <div className="flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5" role="group" aria-label="Project sections">
                {tabs.map((t, i) => (
                  <button key={t} className={`${SEG} ${i === 0 ? SEG_ON : SEG_OFF}`} type="button" aria-pressed={i === 0}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <label className="relative block min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <input
                        className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder={L.search}
                        aria-label="Search pages"
                        type="search"
                        value=""
                        readOnly
                      />
                    </label>
                    <button
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
                      type="button"
                      aria-label="Add HTML page"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div>
                    <ul className="flex flex-col gap-0.5" role="tree" aria-label="Pages and sections">
                      <li>
                        <div
                          className="group/row relative flex h-8 items-center gap-1 rounded-lg pr-1 text-[13px] transition-colors cursor-pointer pl-1 outline-none focus-visible:ring-1 focus-visible:ring-ring bg-muted font-medium text-foreground"
                          role="treeitem"
                          aria-expanded="true"
                          aria-current="page"
                        >
                          <button
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                            type="button"
                          >
                            <ChevronRight className="h-3.5 w-3.5 transition-transform rotate-90" aria-hidden="true" />
                          </button>
                          <House className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="min-w-0 truncate">{pageFile}</span>
                        </div>
                        <ul className="flex flex-col" role="group">
                          {sections.map((s) => (
                            <li className="relative" key={s.id}>
                              <div
                                className="group/row relative flex h-8 items-center gap-1 rounded-lg pr-1 text-[13px] transition-colors cursor-pointer pl-4 outline-none focus-visible:ring-1 focus-visible:ring-ring  text-foreground hover:bg-muted"
                                role="treeitem"
                                aria-selected="false"
                                aria-expanded="false"
                              >
                                <span className="inline-flex h-5 w-4 shrink-0 items-center justify-center cursor-grab text-muted-foreground/40 group-hover/row:text-muted-foreground active:cursor-grabbing" aria-hidden="true">
                                  <GripVertical className="h-3.5 w-3.5" />
                                </span>
                                <button className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground" type="button">
                                  <ChevronRight className="h-3 w-3 transition-transform" aria-hidden="true" />
                                </button>
                                <PanelTop className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span className="min-w-0 truncate">{s.label}</span>
                                <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100">
                                  <button className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-background" type="button">
                                    <Pencil className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                  <button className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-background" type="button">
                                    <Copy className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                  <button className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-destructive/10 hover:text-destructive" type="button">
                                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="-mx-3 -mb-3 mt-3 flex shrink-0 flex-col gap-0.5 border-t border-border px-3 pb-3 pt-2" role="toolbar" aria-label="Project tools">
                <button className={TOOL_BTN} type="button" aria-pressed={activeTool === "seo" ? true : undefined}>
                  <Search className="h-4 w-4" aria-hidden="true" />
                  {L.seo}
                </button>
                <button className={TOOL_BTN} type="button" aria-pressed={activeTool === "database" ? true : undefined}>
                  <Database className="h-4 w-4" aria-hidden="true" />
                  {L.database}
                </button>
                <button className={TOOL_BTN} type="button" aria-pressed="false" disabled>
                  <ChartNoAxesCombined className="h-4 w-4" aria-hidden="true" />
                  {L.analytics}
                </button>
                <button className={TOOL_BTN} type="button" aria-haspopup="menu" data-state={activeTool === "settings" ? "open" : "closed"}>
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  {L.settings}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
      <button className="hidden lg:block absolute -right-[5px] top-0 bottom-0 w-[10px] cursor-ew-resize z-10" type="button" aria-label="Resize panel" tabIndex={-1} />
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ canvas

const DEVICE_BTN = "relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 ease-out active:scale-95 h-7 w-7";
const ICON_BTN = "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-95";

const CanvasToolbar: React.FC<{ offsetX: number; viewportLabel: string; zoomLabel: string }> = ({ offsetX, viewportLabel, zoomLabel }) => (
  <div className="flex shrink-0 items-center justify-center gap-2 pointer-events-none" role="toolbar" aria-label="Canvas controls" style={{ transform: `translateX(${offsetX}px)` }}>
    <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border/60 bg-background px-1.5 py-1 shadow-sm">
      <div className="flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5" role="tablist" aria-label="Preview device size">
        <button className={`${DEVICE_BTN} text-foreground`} type="button" role="tab" aria-selected="true" aria-label="Desktop" data-state="closed">
          <span className="absolute inset-0 rounded-md bg-muted" style={{ opacity: 1 }} />
          <Monitor className="relative h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button className={`${DEVICE_BTN} text-muted-foreground hover:bg-muted hover:text-foreground`} type="button" role="tab" aria-selected="false" aria-label="Tablet" data-state="closed">
          <Tablet className="relative h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button className={`${DEVICE_BTN} text-muted-foreground hover:bg-muted hover:text-foreground`} type="button" role="tab" aria-selected="false" aria-label="Mobile" data-state="closed">
          <Smartphone className="relative h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <span className="inline-flex h-8 items-center px-1.5 font-mono text-xs tabular-nums text-muted-foreground">{viewportLabel}</span>
      <span className="h-4 w-px bg-border" aria-hidden="true" />
      <button
        className="group inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium tabular-nums text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted "
        type="button"
        aria-haspopup="menu"
        data-state="closed"
      >
        <Scan className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-[2.25rem] text-left">{zoomLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
      </button>
      <div className="flex items-center gap-0.5">
        <button className={`${ICON_BTN} cursor-not-allowed opacity-40`} type="button" aria-label="Undo" disabled data-state="closed">
          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button className={`${ICON_BTN} cursor-not-allowed opacity-40`} type="button" aria-label="Redo" disabled data-state="closed">
          <Redo2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <button className={ICON_BTN} type="button" aria-label="Focus mode" aria-pressed="false" data-state="closed">
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  </div>
);

/** Browser-like frame around the site (dots bar + content), at 1280 px wide, scaled into the canvas box. */
const SiteFrame: React.FC<{ box: CanvasBox; children: React.ReactNode }> = ({ box, children }) => (
  <div className="relative h-full min-h-0 w-full min-w-0 overflow-x-auto overflow-y-hidden">
    <div className="mx-auto" style={{ width: box.width, height: box.height }}>
      <div style={{ width: 1280, height: box.height / box.scale, transform: `scale(${box.scale})`, transformOrigin: "0px 0px" }}>
        <div className="flex h-full w-full items-center justify-center">
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-lg">
            <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-border/60 bg-muted/50 px-3" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {children}
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/10 via-transparent to-transparent dark:from-white/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export type CanvasBox = { width: number; height: number; scale: number };

/** Selected element: its box in app CSS px (live: the H1 at top 178.447, left 681.469, 374.062 x 24). */
export type EditorSelection = {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Inspector header + path, e.g. "Heading", "h1", ["Home", "Container", "Heading"]. */
  label: string;
  tag: string;
  path: string[];
};

// ------------------------------------------------------------------------------------------------ inspector

const SELECT_TRIGGER =
  "flex items-center justify-between whitespace-nowrap rounded-full border px-2 py-1 font-medium shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring dark:focus:ring-0 dark:focus:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 mt-1.5 h-8 w-full border-border bg-background text-[13px]";
const FIELD =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-2.5 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 hover:border-muted-foreground/60 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10 h-8";
const SEC = "border-b border-border p-4 last:border-b-0";
const SEC_BTN = "flex w-full items-center gap-1.5 text-left text-[13px] font-medium text-foreground";
const LBL = "block text-xs text-muted-foreground";
const ALIGN_BTN = "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors border-transparent text-muted-foreground hover:bg-muted hover:text-foreground";
const SWATCH_ROW = "mt-1.5 flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-1.5 transition-colors focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/10";

const Select: React.FC<{ value: string }> = ({ value }) => (
  <button className={SELECT_TRIGGER} type="button" role="combobox" aria-expanded="false" data-state="closed" data-placeholder="">
    <span style={{ pointerEvents: "none" }}>{value}</span>
    <ChevronDown className="h-4 w-4 opacity-50 ml-1" aria-hidden="true" />
  </button>
);
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className={SEC}>
    <button className={SEC_BTN} type="button" aria-expanded="true">
      <ChevronDown className="h-3.5 w-3.5 transition-transform" aria-hidden="true" />
      {title}
    </button>
    <div className="mt-3 space-y-3">{children}</div>
  </div>
);

export type InspectorLabels = DeployEditorScreenProps["inspectorLabels"];

const Inspector: React.FC<{ selection: EditorSelection | null; L: InspectorLabels; scrollTop: number }> = ({ selection, L, scrollTop }) => (
  <div className="relative h-full min-h-0 shrink-0 hidden lg:block" style={{ width: `clamp(240px, ${appVw(19)}, 288px)` }}>
    <button className="absolute -left-[5px] top-0 bottom-0 w-[10px] cursor-ew-resize z-10" type="button" aria-label="Resize panel" tabIndex={-1} />
    <div className="bg-card h-full min-h-0 w-full overflow-hidden rounded-xl border">
      <div className="h-full min-h-0">
        <div className="flex h-full min-h-0 flex-col">
          <div className="h-full min-h-0">
            {selection ? (
              <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-left">
                <div className="shrink-0 px-4 pt-4">
                  <nav className="mb-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground" aria-label="Selected element path">
                    {selection.path.map((seg, i) =>
                      i === selection.path.length - 1 ? (
                        <strong className="font-medium text-foreground" key={i}>
                          {seg}
                        </strong>
                      ) : (
                        <React.Fragment key={i}>
                          <span>{seg}</span>
                          <span>/</span>
                        </React.Fragment>
                      ),
                    )}
                  </nav>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-base font-medium tracking-tight text-foreground">{selection.label}</h2>
                      <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-medium uppercase text-muted-foreground">{selection.tag}</span>
                    </div>
                    <button className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" type="button" aria-label="Close style panel">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3.5 flex gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5" role="group" aria-label="Property tabs">
                    <button className="h-[26px] flex-1 rounded-md text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 text-muted-foreground hover:text-foreground" type="button" aria-pressed="false">
                      {L.content}
                    </button>
                    <button className={`h-[26px] flex-1 rounded-md text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SEG_ON}`} type="button" aria-pressed="true">
                      {L.style}
                    </button>
                  </div>
                </div>
                <div className="mt-3.5 min-h-0 flex-1 overflow-y-auto border-t border-border">
                  <div style={scrollTop ? { transform: `translateY(${-scrollTop}px)` } : undefined}>
                    <div className="space-y-3 border-b border-border p-4">
                      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5" role="group" aria-label="Element state">
                        <button className={`h-[26px] flex-1 rounded-md text-[13px] font-medium transition-colors ${SEG_ON}`} type="button" aria-pressed="true">
                          {L.normal}
                        </button>
                        <button className={`h-[26px] flex-1 rounded-md text-[13px] font-medium transition-colors ${SEG_OFF}`} type="button" aria-pressed="false">
                          {L.hover}
                        </button>
                        <button className={`h-[26px] flex-1 rounded-md text-[13px] font-medium transition-colors ${SEG_OFF}`} type="button" aria-pressed="false">
                          {L.focus}
                        </button>
                      </div>
                    </div>
                    <Section title={L.font}>
                      <label className={LBL}>
                        {L.fontFamily}
                        <Select value={L.defaultValue} />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={LBL}>
                          {L.size}
                          <input className={FIELD} placeholder="16px" type="text" value="" readOnly />
                        </label>
                        <label className={LBL}>
                          {L.lineHeight}
                          <input className={FIELD} placeholder="Auto" type="text" value="" readOnly />
                        </label>
                        <div className="col-span-2">
                          <label className={LBL}>
                            {L.weight}
                            <Select value={L.defaultValue} />
                          </label>
                        </div>
                      </div>
                    </Section>
                    <Section title={L.alignment}>
                      <div>
                        <p className="text-xs text-muted-foreground">{L.textAlign}</p>
                        <div className="mt-1.5 flex items-center gap-1">
                          <button className={ALIGN_BTN} type="button" aria-label="Left" aria-pressed="false">
                            <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button className={ALIGN_BTN} type="button" aria-label="Center" aria-pressed="false">
                            <AlignCenter className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button className={ALIGN_BTN} type="button" aria-label="Right" aria-pressed="false">
                            <AlignRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </Section>
                    <Section title={L.layout}>
                      <label className={LBL}>
                        {L.display}
                        <Select value={L.defaultValue} />
                      </label>
                    </Section>
                    <Section title={L.color}>
                      {[
                        [L.backgroundColor, "#ffffff", "Background color swatch"],
                        [L.textColor, "#000000", "Text color swatch"],
                      ].map(([label, hex, aria]) => (
                        <label className={LBL} key={label}>
                          {label}
                          <div className={SWATCH_ROW}>
                            <input className="h-6 w-6 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0" aria-label={aria} type="color" value={hex} readOnly />
                            <input className="w-full truncate bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60" placeholder={hex} type="text" value="" readOnly />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <button className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/70 transition hover:border-primary/50 hover:text-primary" type="button" title="Save to palette">
                              <Plus className="h-3 w-3" aria-hidden="true" />
                            </button>
                          </div>
                        </label>
                      ))}
                    </Section>
                    <Section title={L.spacing}>
                      <label className={LBL}>
                        {L.padding}
                        <input className={FIELD} placeholder="e.g. 8px 16px" type="text" value="" readOnly />
                      </label>
                      <label className={LBL}>
                        {L.margin}
                        <input className={FIELD} placeholder="e.g. 8px 16px" type="text" value="" readOnly />
                      </label>
                    </Section>
                    <Section title={L.sizeSection}>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={LBL}>
                          {L.width}
                          <input className={FIELD} placeholder="e.g. 100%" type="text" value="" readOnly />
                        </label>
                        <label className={LBL}>
                          {L.height}
                          <input className={FIELD} placeholder="e.g. auto" type="text" value="" readOnly />
                        </label>
                      </div>
                    </Section>
                    <Section title={L.borderShadow}>
                      <label className={LBL}>
                        {L.border}
                        <input className={FIELD} placeholder="e.g. 1px solid #e5e5e5" type="text" value="" readOnly />
                      </label>
                      <label className={LBL}>
                        {L.borderRadius}
                        <input className={FIELD} placeholder="e.g. 8px" type="text" value="" readOnly />
                      </label>
                      <label className={LBL}>
                        {L.boxShadow}
                        <input className={FIELD} placeholder="e.g. 0 4px 12px rgba(0,0,0,.1)" type="text" value="" readOnly />
                      </label>
                    </Section>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2.5 p-6 text-center text-muted-foreground" role="status">
                <MousePointerClick className="h-5 w-5" aria-hidden="true" />
                <p className="text-[13px]">{L.selectPrompt}</p>
              </div>
            )}
          </div>
          <div className="hidden" />
        </div>
      </div>
    </div>
  </div>
);

// ------------------------------------------------------------------------------------------------ screen

export type DeployEditorScreenProps = {
  workspace: Workspace;
  sidebar: SidebarData;
  header: DeployHeaderProps;
  site: PersonaSiteContent;
  pageFile: string;
  sections: DeployTreeSection[];
  /** Canvas box per mode (live: preview 964x673 @ 0.753125 "75%", edit 665x673 @ 0.519531 "52%"). */
  canvas: { preview: CanvasBox; edit: CanvasBox };
  /** Canvas toolbar centring offsets the app computes per layout (live: preview -138, edit 12). */
  toolbarOffset: { preview: number; edit: number };
  viewportLabel: string;
  /** Edit mode only: the selected element (null = "Select an element to edit"). */
  selection: EditorSelection | null;
  /** Floating element bar labels + hover state of "Edit text". */
  elementBar: { editText: string; hoverEditText: boolean };
  inspectorScrollTop: number;
  activeTool: "seo" | "database" | "analytics" | "settings" | null;
  labels: {
    websitePages: string;
    main: string;
    noSubpages: string;
    pages: string;
    layers: string;
    files: string;
    assets: string;
    search: string;
    seo: string;
    database: string;
    analytics: string;
    settings: string;
  };
  inspectorLabels: {
    content: string;
    style: string;
    normal: string;
    hover: string;
    focus: string;
    font: string;
    fontFamily: string;
    size: string;
    lineHeight: string;
    weight: string;
    defaultValue: string;
    alignment: string;
    textAlign: string;
    layout: string;
    display: string;
    color: string;
    backgroundColor: string;
    textColor: string;
    spacing: string;
    padding: string;
    margin: string;
    sizeSection: string;
    width: string;
    height: string;
    borderShadow: string;
    border: string;
    borderRadius: string;
    boxShadow: string;
    selectPrompt: string;
  };
  /** Overlays (null = closed). */
  customDomain: CustomDomainDialogProps | null;
  connectData: ConnectDataModalProps | null;
  showTourButton: boolean;
  showCookieSettings: boolean;
  sidebarScrollTop: number;
};

export const DeployEditorScreen: React.FC<DeployEditorScreenProps> = (p) => {
  const edit = p.header.mode === "edit";
  const box = edit ? p.canvas.edit : p.canvas.preview;
  const sel = edit ? p.selection : null;
  return (
    <>
      <AppShell workspace={p.workspace} sidebar={p.sidebar} activeNav={null} crumbs={[]} hideTopBar showCookieSettings={p.showCookieSettings} sidebarScrollTop={p.sidebarScrollTop}>
        <DeployHeader {...p.header} />
        <div className="flex h-full min-h-0 flex-col bg-backgroundGray">
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <div id="page-main-scroll" className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-t-white " aria-hidden="false">
                  <div className="w-full px-0">
                    <div className="flex flex-col mx-auto pb-16 md:pb-0 lg:overflow-hidden lg:h-[calc(100vh-48px)]">
                      <div className="lg:flex h-full min-h-0 space-y-5 lg:space-y-0 justify-center bg-muted/40 lg:gap-3 lg:p-3">
                        <PagesPanel mode={p.header.mode} labels={p.labels} siteName={p.header.siteName} pageFile={p.pageFile} sections={p.sections} activeTool={p.activeTool} />
                        <div className="relative flex-1 w-full min-w-0 min-h-0 bg-transparent">
                          <div className="flex h-auto min-h-0 justify-center lg:h-full">
                            <div className="flex-1 w-full min-w-0 min-h-0">
                              <div className="h-full w-full bg-transparent">
                                <div className="relative flex h-full flex-col min-h-0 ">
                                  <button
                                    className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground absolute left-0 top-0 z-10 h-12 w-12 shrink-0 rounded-xl border border-border/60 bg-background shadow-sm hover:bg-muted"
                                    aria-label="Toggle sidebar"
                                    data-state="closed"
                                  >
                                    <TableOfContents className="h-4 w-4" />
                                  </button>
                                  {p.showTourButton ? (
                                    <button
                                      className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground fixed bottom-4 right-4 z-40 h-8 w-8 shrink-0 rounded-full border bg-background shadow-md"
                                      aria-label="Replay Deploy Tour"
                                      data-state="closed"
                                    >
                                      <Compass className="h-4 w-4" />
                                    </button>
                                  ) : null}
                                  <div className="min-h-0 flex-1">
                                    <div className="flex h-full w-full flex-col gap-3">
                                      <CanvasToolbar
                                        offsetX={edit ? p.toolbarOffset.edit : p.toolbarOffset.preview}
                                        viewportLabel={p.viewportLabel}
                                        zoomLabel={`${Math.round(box.scale * 100)}%`}
                                      />
                                      <div className="contents">
                                        {edit ? (
                                          <div className="flex min-h-0 flex-1 gap-3 ">
                                            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                                              <SiteFrame box={box}>
                                                <PersonaSiteFrame content={p.site} mode="container" className="h-full w-full border-0" />
                                              </SiteFrame>
                                              {sel ? (
                                                <>
                                                  <div
                                                    className="pointer-events-none fixed z-50 rounded-[2px] ring-2 ring-blue-600"
                                                    style={{ top: sel.top, left: sel.left, width: sel.width, height: sel.height, clipPath: "inset(-6px)" }}
                                                  />
                                                  <div
                                                    className="pointer-events-none fixed z-[55]"
                                                    role="toolbar"
                                                    aria-label="Element actions"
                                                    style={{ top: sel.top - 50, left: sel.left + sel.width / 2, transform: "translateX(-50%)" }}
                                                  >
                                                    <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border bg-background p-1 text-[13px] shadow-lg">
                                                      <button
                                                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium text-foreground transition-colors hover:bg-muted"
                                                        type="button"
                                                        style={p.elementBar.hoverEditText ? { backgroundColor: "hsl(var(--muted))" } : undefined}
                                                      >
                                                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                                        {p.elementBar.editText}
                                                      </button>
                                                      <button className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted" type="button" aria-label="Duplicate">
                                                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                                      </button>
                                                      <button
                                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                                        type="button"
                                                        aria-label="Delete"
                                                      >
                                                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                </>
                                              ) : null}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="relative min-h-0 flex-1 overflow-hidden">
                                            <SiteFrame box={box}>
                                              <PersonaSiteFrame content={p.site} mode="document" className="h-full w-full border-0" />
                                            </SiteFrame>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        {edit ? <Inspector selection={sel} L={p.inspectorLabels} scrollTop={p.inspectorScrollTop} /> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </AppShell>
      {p.customDomain ? <CustomDomainDialog {...p.customDomain} /> : null}
      {p.connectData ? <ConnectDataModal {...p.connectData} /> : null}
    </>
  );
};

export const DEPLOY_EDITOR_LABELS: DeployEditorScreenProps["labels"] = {
  websitePages: "Website pages",
  main: "Main",
  noSubpages: "No pages yet. Hover Home and use + to add a subpage.",
  pages: "Pages",
  layers: "Layers",
  files: "Files",
  assets: "Assets",
  search: "Search",
  seo: "SEO",
  database: "Database",
  analytics: "Analytics",
  settings: "Settings",
};

export const DEPLOY_INSPECTOR_LABELS: DeployEditorScreenProps["inspectorLabels"] = {
  content: "Content",
  style: "Style",
  normal: "Normal",
  hover: "Hover",
  focus: "Focus",
  font: "Font",
  fontFamily: "Font family",
  size: "Size",
  lineHeight: "Line height",
  weight: "Weight",
  defaultValue: "Default",
  alignment: "Alignment",
  textAlign: "Text align",
  layout: "Layout",
  display: "Display",
  color: "Color",
  backgroundColor: "Background color",
  textColor: "Text color",
  spacing: "Spacing",
  padding: "Padding",
  margin: "Margin",
  sizeSection: "Size",
  width: "Width",
  height: "Height",
  borderShadow: "Border & shadow",
  border: "Border",
  borderRadius: "Border radius",
  boxShadow: "Box shadow",
  selectPrompt: "Select an element to edit",
};
