/**
 * Data for the "templates" screen group (Data Templates list + quick look, Edit properties).
 *
 * Everything here is derived from ../../fixtures (cleared names, verbatim product labels) plus
 * the template metadata the DOM snapshots show and fixtures.ts does not model yet (icon kind,
 * group, status, created-by). Nothing is copied from the snapshots' sample records: the eight
 * template names, their property names / types / counts and the board names are Tulvo-generated
 * labels already in fixtures.ts.
 *
 * Sources: research/ui-live/dom/data-templates-list.html (list + quick look),
 *          research/ui-live/dom/template-edit-properties.html (editor).
 */
import { captureMatch, tulvoFixtures, type DataTemplate, type PropertyType, type TulvoDataset } from "../../fixtures";

// ---------------------------------------------------------------- types

/**
 * The template's icon in the list / quick look. The app picks it from the template's kind; the
 * icon's tooltip reads "<Kind> · In use" (data-templates-list.html). Kinds seen live:
 * Sales (trending-up), Contacts (users), Content (image), General (table-2),
 * Projects (briefcase-business), Notes (file-text).
 */
export type TemplateIconKind = "sales" | "contacts" | "content" | "general" | "projects" | "notes";

/** One property of a template (editor row / quick-look row). */
export type TemplateField = {
  id: string;
  name: string;
  type: PropertyType;
  /**
   * The title property ("Item"): first, "Fixed position" grip (opacity-40), no icon button,
   * no remove button, and not listed in the quick look / property count.
   */
  fixed?: boolean;
  /** Dropdown values (shown in Configure Property when the property is selected). */
  options?: string[];
};

/** A row of the Data Templates list. */
export type TemplateListItem = {
  id: string;
  name: string;
  iconKind: TemplateIconKind;
  /** "Used in ..." values, e.g. ["Page tab", "Tasks", "Widget"]. */
  usedIn: string[];
  /** Non-title properties ("10 properties"). */
  propertyCount: number;
  /** API keys; > 0 shows the key-round chip with the count ("1"), as captured. */
  apiKeys: number;
  /** Green status dot on the icon ("In use"). Every captured template was in use. */
  inUse: boolean;
};

/** The quick-look panel (right column) for the selected template. */
export type TemplateQuickLookData = {
  name: string;
  iconKind: TemplateIconKind;
  /** Non-title properties, in order. */
  properties: TemplateField[];
  /** Boards that use the template ("3 boards"). */
  boardCount: number;
  apiKeys: number;
  webhooks: number;
};

/** A row of the editor's "Boards" table (below the fold). */
export type TemplateBoardRow = { name: string; tabs: string[]; lastUpdated: string };

/** The Edit properties page for one template. */
export type TemplateEditorData = {
  name: string;
  /** "Group:" value (Brand Deals: "Tracking"). */
  group: string;
  usedIn: string[];
  /** "Status:" value ("Used"). */
  status: string;
  /** "Created by:" avatar. Only the Tulvo AI avatar (sparkles) was captured. */
  createdBy: "tulvo-ai";
  properties: TemplateField[];
  apiKeys: number;
  webhooks: number;
  boards: TemplateBoardRow[];
};

// ---------------------------------------------------------------- helpers

/** Icon kind per template, as captured (data-templates-list.html, icon tooltips). */
export const TEMPLATE_ICON_KIND: Record<string, TemplateIconKind> = {
  "brand-deals": "sales",
  "client-campaigns": "contacts",
  "content-calendar": "content",
  "media-kit": "content",
  "run-it-like-a-studio": "general",
  "tasks-tracker": "projects",
  "team-tasks": "projects",
  "workshop-waitlist": "notes",
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** fixtures.ts DataTemplate -> list row. */
export const toListItem = (t: DataTemplate): TemplateListItem => ({
  id: t.id,
  name: t.name,
  iconKind: TEMPLATE_ICON_KIND[t.id] ?? "general",
  usedIn: [...t.usedIn],
  propertyCount: t.propertyCount,
  apiKeys: t.apiKeys,
  inUse: true,
});

/** fixtures.ts DataTemplate.properties -> editor fields (first property = fixed title "Item"). */
export const toFields = (t: DataTemplate): TemplateField[] =>
  (t.properties ?? []).map((p, i) => ({
    id: slug(p.name),
    name: p.name,
    type: p.type,
    // keys omitted rather than undefined: defaultProps must be JSON-serialisable
    ...(i === 0 ? { fixed: true } : {}),
    ...(p.options ? { options: [...p.options] } : {}),
  }));

export const toQuickLook = (t: DataTemplate): TemplateQuickLookData => ({
  name: t.name,
  iconKind: TEMPLATE_ICON_KIND[t.id] ?? "general",
  properties: toFields(t).filter((f) => !f.fixed),
  boardCount: t.boards?.length ?? 0,
  apiKeys: t.apiKeys,
  webhooks: t.webhooks,
});

export const toEditor = (t: DataTemplate, group: string): TemplateEditorData => ({
  name: t.name,
  group,
  usedIn: [...t.usedIn],
  status: "Used",
  createdBy: "tulvo-ai",
  properties: toFields(t),
  apiKeys: t.apiKeys,
  webhooks: t.webhooks,
  boards: (t.boards ?? []).map((b) => ({ name: b.name, tabs: [...b.tabs], lastUpdated: b.lastUpdated })),
});

const brandDeals = (ds: TulvoDataset): DataTemplate => {
  const t = ds.templates.find((x) => x.id === "brand-deals");
  if (!t) throw new Error("fixtures: brand-deals template missing");
  return t;
};

// ---------------------------------------------------------------- the ad's "change" beat (B11)

/**
 * B11: she adds ONE field to Brand Deals in the manual editor: "Usage Rights", Input Type
 * Dropdown, four options typed one by one, then Update Template
 * (script/v1/script-v1.md B11; option pills "30 days", "90 days", "12 months", "Perpetual").
 * When src/tulvo/data/facts.ts lands (field.usageRights), map it here.
 */
export const USAGE_RIGHTS_FIELD: TemplateField = {
  id: "usage-rights",
  name: "Usage Rights",
  type: "dropdown",
  options: ["30 days", "90 days", "12 months", "Perpetual"],
};

/** Group label of Brand Deals on its edit page (template-edit-properties.html). */
export const BRAND_DEALS_GROUP = "Tracking";

// ---------------------------------------------------------------- datasets

export type TemplatesData = {
  list: TemplateListItem[];
  brandDealsQuickLook: TemplateQuickLookData;
  brandDealsEditor: TemplateEditorData;
};

const build = (ds: TulvoDataset): TemplatesData => {
  const bd = brandDeals(ds);
  return {
    list: ds.templates.map(toListItem),
    brandDealsQuickLook: toQuickLook(bd),
    brandDealsEditor: toEditor(bd, BRAND_DEALS_GROUP),
  };
};

/** Same counts / order / layout as day2/09 and day2/10 (cleared workspace name). */
export const templatesCaptureMatch: TemplatesData = build(captureMatch);

/** The ad's default data. */
export const templatesFixtures: TemplatesData = build(tulvoFixtures);

/** Brand Deals after B11's Update Template: 11 properties, Usage Rights last. */
export const brandDealsWithUsageRights = (d: TemplatesData): { list: TemplateListItem[]; quickLook: TemplateQuickLookData } => ({
  list: d.list.map((t) => (t.id === "brand-deals" ? { ...t, propertyCount: t.propertyCount + 1 } : t)),
  quickLook: { ...d.brandDealsQuickLook, properties: [...d.brandDealsQuickLook.properties, USAGE_RIGHTS_FIELD] },
});
