/**
 * Data Templates page: search bar, template list and the right-hand "Quick look" panel
 * (Properties with type chips, Edit properties, Integrations: Used in / API keys / Incoming webhooks).
 *
 * Rebuilt from research/ui-live/dom/data-templates-list.html (route /data-templates?preview=<id>),
 * screenshot research/ui-live/day2/10-data-templates-brand-deals-panel.jpg. Class strings are
 * verbatim; `max-md:` variants (never active at the captured 1512px width) are left out so a
 * Tailwind v4 build (the old project had one; the engine has none) cannot evaluate them against a narrow composition.
 *
 * Pure and frame-agnostic: hover, the panel's slide-in and every scroll position are props.
 */
import React from "react";
import { ChevronDown, ChevronRight, Columns3, Ellipsis, KeyRound, Plus, Search, Webhook } from "lucide-react";
import { cn } from "../../cn";
import type { TemplateListItem, TemplateQuickLookData } from "./data";
import { PROPERTY_TYPE_ICON, PROPERTY_TYPE_LABEL, TemplateIconTile } from "./parts";

// ---------------------------------------------------------------- labels (verbatim)

export const DATA_TEMPLATES_LABELS = {
  srTitle: "Data templates",
  searchPlaceholder: "Search by name or property",
  searchKbd: "/",
  statusFilter: "Status",
  newTemplate: "New data template",
  usedInPrefix: "Used in",
  /** "10 properties". Singular not observed; "1 property" assumed. */
  propertiesSuffix: "properties",
  propertySuffix: "property",
  qlProperties: "Properties",
  qlEditProperties: "Edit properties",
  qlIntegrations: "Integrations",
  qlUsedIn: "Used in",
  qlApiKeys: "API keys",
  qlWebhooks: "Incoming webhooks",
  qlNone: "None",
  /** "3 boards". Singular not observed; "1 board" assumed. */
  qlBoards: "boards",
  qlBoard: "board",
};
export type DataTemplatesLabels = typeof DATA_TEMPLATES_LABELS;

// ---------------------------------------------------------------- class strings (verbatim)

const ROW_BASE =
  "group/item relative flex cursor-pointer items-center gap-3.5 rounded-xl bg-[color:var(--row-bg)] py-3 pl-3 pr-2 transition-colors duration-150";
const ROW_SELECTED = `${ROW_BASE} [--row-bg:hsl(var(--muted))] dark:[--row-bg:color-mix(in_srgb,hsl(var(--muted))_70%,hsl(var(--background)))]`;
const ROW_IDLE = `${ROW_BASE} [--row-bg:hsl(var(--background))] hover:[--row-bg:color-mix(in_srgb,hsl(var(--muted))_80%,hsl(var(--background)))] has-[[data-state=open]]:[--row-bg:color-mix(in_srgb,hsl(var(--muted))_80%,hsl(var(--background)))] dark:hover:[--row-bg:color-mix(in_srgb,hsl(var(--muted))_45%,hsl(var(--background)))] dark:has-[[data-state=open]]:[--row-bg:color-mix(in_srgb,hsl(var(--muted))_45%,hsl(var(--background)))]`;
/** Row :hover look (cannot fire in a render). */
const ROW_HOVER_STYLE = { "--row-bg": "color-mix(in srgb, hsl(var(--muted)) 80%, hsl(var(--background)))" } as React.CSSProperties;

const ROW_TITLE =
  "min-w-0 truncate rounded-sm text-[14.5px] font-medium leading-[1.35] tracking-[-0.005em] text-foreground underline-offset-[3px] hover:underline";
const META_ITEM =
  "relative inline-flex items-center gap-1 whitespace-nowrap pl-[15px] before:absolute before:left-1.5 before:top-1/2 before:-mt-[1.5px] before:size-[3px] before:rounded-full before:bg-current before:opacity-50 before:content-['']";
const MORE_BTN_BASE =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-[30px] w-[30px] shrink-0 text-muted-foreground";
const MORE_BTN_IDLE = `${MORE_BTN_BASE} opacity-70 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 group-hover/item:opacity-100`;
const MORE_BTN_SELECTED = `${MORE_BTN_BASE} transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 group-hover/item:opacity-100 opacity-100`;

const SEARCH_INPUT =
  "flex w-full rounded-md border border-input dark:bg-input/30 bg-transparent px-3 py-1 text-base transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary dark:focus-visible:ring-0 dark:focus-visible:border-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm peer h-[34px] pl-[34px] shadow-none [&::-webkit-search-cancel-button]:hidden pr-2.5 md:pr-[34px]";
const STATUS_BTN =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground py-2 h-[34px] gap-1.5 px-3 text-[13px] font-medium shadow-none border-dashed text-foreground/75";
const NEW_BTN =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none py-2 h-[34px] w-[34px] shrink-0 gap-1.5 px-0 text-[13px] shadow-none md:w-auto md:px-3";

const QL_EDIT_BTN =
  "inline-flex h-7 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-[7px] border border-input bg-background pl-2.5 pr-1.5 text-[12.5px] font-medium transition-colors hover:border-muted-foreground hover:bg-muted/60";
const QL_PROP_ROW = "flex items-center justify-between gap-3 border-b border-border px-3 py-[7px] text-[13px] last:border-b-0";
const QL_CHIP =
  "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-[7px] text-[11.5px] lowercase text-muted-foreground";
const QL_INT_LINK = "flex items-center gap-2 rounded-lg border border-border px-3 py-[9px] text-[13px] transition-colors hover:bg-muted/60";
/** :hover look of the quick-look links / buttons (hover:bg-muted/60, Edit properties also darkens its border). */
const QL_HOVER_STYLE: React.CSSProperties = { backgroundColor: "hsl(var(--muted) / 0.6)" };
const QL_EDIT_HOVER_STYLE: React.CSSProperties = { ...QL_HOVER_STYLE, borderColor: "hsl(var(--muted-foreground))" };

// ---------------------------------------------------------------- list row

export type TemplateRowProps = {
  item: TemplateListItem;
  selected?: boolean;
  hovered?: boolean;
  labels?: Partial<DataTemplatesLabels>;
};

export const TemplateRow: React.FC<TemplateRowProps> = ({ item, selected = false, hovered = false, labels }) => {
  const L = { ...DATA_TEMPLATES_LABELS, ...labels };
  const propLabel = `${item.propertyCount} ${item.propertyCount === 1 ? L.propertySuffix : L.propertiesSuffix}`;
  return (
    <li className={selected ? ROW_SELECTED : ROW_IDLE} style={!selected && hovered ? ROW_HOVER_STYLE : undefined}>
      <TemplateIconTile kind={item.iconKind} variant="row" selected={selected} inUse={item.inUse} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <a title={item.name} className={ROW_TITLE}>
            {item.name}
          </a>
        </div>
        <div className="mt-[3px] overflow-hidden">
          <div className="-ml-[15px] flex flex-wrap items-center gap-y-0.5 text-[12.5px] leading-[1.45] text-muted-foreground">
            <span className={`${META_ITEM} text-foreground/70`}>
              {L.usedInPrefix} {item.usedIn.join(", ")}
            </span>
            <span className={META_ITEM}>{propLabel}</span>
            {item.apiKeys > 0 ? (
              <span className={META_ITEM}>
                <KeyRound className="size-[13px] opacity-85" aria-hidden="true" />
                {item.apiKeys}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <button
        className={selected ? MORE_BTN_SELECTED : MORE_BTN_IDLE}
        style={!selected && hovered ? { opacity: 1 } : undefined}
        aria-label={`More actions for ${item.name}`}
        type="button"
        data-state="closed"
      >
        <Ellipsis aria-hidden="true" />
      </button>
    </li>
  );
};

// ---------------------------------------------------------------- quick look

export type QuickLookHover = "edit-properties" | "used-in" | "api-keys" | "webhooks" | null;

export type TemplateQuickLookProps = {
  data: TemplateQuickLookData;
  /** Simulated hover on a link/button of the panel. */
  hover?: QuickLookHover;
  /** Vertical scroll of the panel content (px). */
  scrollTop?: number;
  labels?: Partial<DataTemplatesLabels>;
};

/** Right-hand "Quick look" panel. */
export const TemplateQuickLook: React.FC<TemplateQuickLookProps> = ({ data, hover = null, scrollTop = 0, labels }) => {
  const L = { ...DATA_TEMPLATES_LABELS, ...labels };
  const countLabel = (n: number) => (n > 0 ? String(n) : L.qlNone);
  const integrations: Array<{ key: Exclude<QuickLookHover, "edit-properties" | null>; icon: React.ReactNode; label: string; value: string }> = [
    {
      key: "used-in",
      icon: <Columns3 className="size-[15px] shrink-0" aria-hidden="true" />,
      label: L.qlUsedIn,
      value: `${data.boardCount} ${data.boardCount === 1 ? L.qlBoard : L.qlBoards}`,
    },
    { key: "api-keys", icon: <KeyRound className="size-[15px] shrink-0" aria-hidden="true" />, label: L.qlApiKeys, value: countLabel(data.apiKeys) },
    { key: "webhooks", icon: <Webhook className="size-[15px] shrink-0" aria-hidden="true" />, label: L.qlWebhooks, value: countLabel(data.webhooks) },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
        <div style={scrollTop ? { transform: `translateY(${-scrollTop}px)` } : undefined}>
          <div className="flex items-center gap-3">
            <TemplateIconTile kind={data.iconKind} variant="quick-look" />
            <h2 tabIndex={-1} className="min-w-0 break-words text-lg font-semibold leading-[1.45] tracking-[-0.01em] outline-none">
              {data.name}
            </h2>
          </div>
          <section className="pt-[22px]" aria-labelledby="ql-props">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h3 id="ql-props" className="text-[13.5px] font-semibold">
                {L.qlProperties}
                <span className="ml-1 text-xs font-normal text-muted-foreground">{data.properties.length}</span>
              </h3>
              <a
                aria-label={`${L.qlEditProperties} of ${data.name}`}
                className={QL_EDIT_BTN}
                style={hover === "edit-properties" ? QL_EDIT_HOVER_STYLE : undefined}
              >
                {L.qlEditProperties}
                <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
              </a>
            </div>
            <ul className="rounded-lg border border-border">
              {data.properties.map((p) => {
                const Icon = PROPERTY_TYPE_ICON[p.type];
                return (
                  <li key={p.id} className={QL_PROP_ROW}>
                    <span className="flex min-w-0 items-center gap-[9px]">
                      <Icon className="size-[15px] shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className={QL_CHIP}>{PROPERTY_TYPE_LABEL[p.type]}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="pt-[22px]" aria-labelledby="ql-int">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h3 id="ql-int" className="text-[13.5px] font-semibold">
                {L.qlIntegrations}
              </h3>
            </div>
            <ul className="grid gap-1.5">
              {integrations.map((it) => (
                <li key={it.key}>
                  <a className={QL_INT_LINK} style={hover === it.key ? QL_HOVER_STYLE : undefined}>
                    {it.icon}
                    {it.label}
                    <span className="ml-auto text-muted-foreground">{it.value}</span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- page content

export type DataTemplatesListProps = {
  templates: TemplateListItem[];
  /** Template shown in the quick look (row tinted, icon tile white). null = no selection, no panel. */
  selectedId: string | null;
  quickLook: TemplateQuickLookData | null;
  /** Simulated pointer hover on a row. */
  hoverId?: string | null;
  quickLookHover?: QuickLookHover;
  /**
   * The panel's entrance (the app: `animate-in fade-in-0 slide-in-from-right-2`, 150 ms).
   * 0 = hidden, 1 = in place. Animate this when a row is clicked.
   */
  quickLookProgress?: number;
  quickLookScrollTop?: number;
  /** Search field text (typed) + its focus look. */
  searchText?: string;
  searchTypedChars?: number;
  /** Vertical scroll of the page content (px). */
  scrollTop?: number;
  labels?: Partial<DataTemplatesLabels>;
};

export const DataTemplatesList: React.FC<DataTemplatesListProps> = ({
  templates,
  selectedId,
  quickLook,
  hoverId = null,
  quickLookHover = null,
  quickLookProgress = 1,
  quickLookScrollTop = 0,
  searchText = "",
  searchTypedChars,
  scrollTop = 0,
  labels,
}) => {
  const L = { ...DATA_TEMPLATES_LABELS, ...labels };
  const p = Math.max(0, Math.min(1, quickLookProgress));
  const search = searchTypedChars === undefined ? searchText : searchText.slice(0, Math.max(0, Math.floor(searchTypedChars)));
  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="w-full px-4 lg:px-[3.375rem] flex flex-col gap-4 pb-12 pt-6"
          style={scrollTop ? { transform: `translateY(${-scrollTop}px)` } : undefined}
        >
          <h1 className="sr-only">{L.srTitle}</h1>
          <div role="search" className="mt-1.5 flex flex-nowrap items-center gap-2 md:flex-wrap">
            <div className="relative min-w-0 flex-1 basis-[280px] md:max-w-[380px]">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input className={SEARCH_INPUT} placeholder={L.searchPlaceholder} aria-label="Search data templates" type="search" value={search} readOnly />
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border px-1.5 py-px font-sans text-[11px] font-medium leading-4 text-muted-foreground md:block md:peer-focus:hidden"
              >
                {L.searchKbd}
              </kbd>
            </div>
            <div role="group" aria-label="Filters" className="flex shrink-0 gap-1.5">
              <button className={STATUS_BTN} type="button" aria-haspopup="menu" data-state="closed">
                <span>{L.statusFilter}</span>
                <ChevronDown className="!size-3.5" aria-hidden="true" />
              </button>
            </div>
            <span className="hidden flex-1 md:block" />
            <button className={NEW_BTN} aria-label={L.newTemplate} type="button">
              <Plus aria-hidden="true" />
              <span className="hidden md:inline">{L.newTemplate}</span>
            </button>
          </div>
          <div className="mt-1.5 grid items-start gap-4 grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0">
              <ul className="-mx-1 grid gap-0.5" aria-label="Data templates">
                {templates.map((t) => (
                  <TemplateRow key={t.id} item={t} selected={t.id === selectedId} hovered={t.id === hoverId} labels={labels} />
                ))}
              </ul>
            </div>
            {quickLook && p > 0 ? (
              <aside
                aria-label="Quick look"
                className={cn(
                  "sticky top-4 col-start-2 row-start-1 flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-lg border border-border bg-background duration-150",
                  // entrance classes kept for fidelity; motion is driven by quickLookProgress
                  "animate-in fade-in-0 slide-in-from-right-2",
                )}
                style={p < 1 ? { opacity: p, transform: `translateX(${(1 - p) * 8}px)` } : undefined}
              >
                <TemplateQuickLook
                  data={quickLook}
                  hover={quickLookHover}
                  scrollTop={quickLookScrollTop}
                  labels={labels}
                />
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
