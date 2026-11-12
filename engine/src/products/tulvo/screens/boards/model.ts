/**
 * Board screens: data model + pure helpers (no React).
 *
 * Everything a board shows (tab names, card titles, property values, counts) arrives as props in
 * these shapes. `dealToCard` maps the shared `Deal` fixture type (../../fixtures) onto a card, using
 * the Brand Deals template's property names and order verbatim (Status, Deal Type, Priority, Channel,
 * Brand Name, Contact Name, Deal Value, Due Date, Assets, Owners).
 */
import { DEAL_STATUSES, type Deal } from "../../fixtures";

export type BoardView = "grid" | "list" | "kanban";

/** One page tab (e.g. "Prospecting Deals"). */
export type BoardTabItem = { id: string; name: string };

/** One template property value on a record, by field type (as the app renders them inline). */
export type CardField =
  | { kind: "dropdown"; name: string; value: string }
  | { kind: "text"; name: string; value: string }
  | { kind: "number"; name: string; value: number | string }
  /** ISO yyyy-mm-dd. Rendered "Oct 28" / weekday / "Tomorrow" / "Today", coloured relative to `today`. */
  | { kind: "date"; name: string; value: string }
  /** Member names (initials avatars); empty = the app's empty person icon. */
  | { kind: "contributors"; name: string; value: string[] }
  /** File names (never shown inline on cards; list view cell only). */
  | { kind: "attachment"; name: string; value: string[] };

export type BoardCardData = {
  id: string;
  /** "Item" (record title). */
  title: string;
  /** All template properties in template order. Cards show the first 4 inline-able ones that fit. */
  fields: CardField[];
};

/** A kanban column. `total` defaults to cards.length; the header reads "n of total items" / "No Item". */
export type KanbanColumnData = {
  id: string;
  title: string;
  cards: BoardCardData[];
  total?: number;
  /** Override the count chip text entirely. */
  countLabel?: string;
  /**
   * Column body tint. The app tints a column only when the template's dropdown option has a colour
   * (it injects `.kanban-column.k-<value> .kanban-column-body{background-color:<colour> !important}`).
   * The Brand Deals options have no colours (white bodies in every capture): leave unset.
   */
  tint?: string;
};

// ----------------------------------------------------------------------------- helpers

/** The app's class slug: lower-case, every run of non [a-z0-9-] chars -> "-". */
export const appSlug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

/** Field wrapper class, e.g. ("Deal Type","dropdown") -> "t-deal-type-dropdown" (app: `t-${slug}-${fieldType}`). */
export const fieldClass = (name: string, kind: CardField["kind"]): string => `t-${appSlug(name)}-${kind}`;

/** Card-level data classes the app adds to `.board-card` (t-<property>-<value>), from the record's own values. */
export const cardDataClasses = (fields: CardField[]): string =>
  fields
    .map((f) => {
      const v = Array.isArray(f.value) ? f.value.slice(0, 3).join(" ") : String(f.value ?? "");
      if (!v) return "";
      return `t-${appSlug(f.name)}-${appSlug(v)}`.slice(0, 64);
    })
    .filter(Boolean)
    .join(" ");

/** Kanban column count chip, exactly as the app words it. */
export const kanbanCountLabel = (shown: number, total?: number): string => {
  if (shown === 0) return "No Item";
  const t = total != null && total > 0 ? total : shown;
  return `${shown} of ${t} ${t !== 1 ? "items" : "item"}`;
};

/** Field types the board card never shows inline (app: excludeFieldTypes). */
export const CARD_EXCLUDED_KINDS: ReadonlyArray<CardField["kind"]> = ["attachment"];
/** Cards show at most this many inline fields (app: maxInlineFields 4 for a 1-column card). */
export const CARD_MAX_INLINE_FIELDS = 4;

export const cardInlineFields = (fields: CardField[], max = CARD_MAX_INLINE_FIELDS): CardField[] =>
  fields.filter((f) => !CARD_EXCLUDED_KINDS.includes(f.kind)).slice(0, max);

// ----------------------------------------------------------------------------- dates (deterministic)

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const parseIsoDay = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1) / 86400000;
};

export type DateTone = "today" | "tomorrow" | "thisWeek" | "past" | "future";

/** Days from `today` to `iso` (both yyyy-mm-dd). */
export const dayDiff = (iso: string, today: string): number => Math.round(parseIsoDay(iso) - parseIsoDay(today));

/** App date label: Today / Tomorrow / weekday (2..6 days ahead) / "MMM d". */
export const formatDueDate = (iso: string, today: string): string => {
  const diff = dayDiff(iso, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  const dayNum = parseIsoDay(iso);
  const dt = new Date(dayNum * 86400000);
  if (diff >= 0 && diff <= 6) return WEEKDAYS[dt.getUTCDay()];
  return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
};

export const dateTone = (iso: string, today: string): DateTone => {
  const diff = dayDiff(iso, today);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 0 && diff <= 6) return "thisWeek";
  if (diff < 0) return "past";
  return "future";
};

/** Initials as the app's avatar fallback shows them (first letters of the first two words). */
export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

// ----------------------------------------------------------------------------- Deal -> card

/** Brand Deals template property names, verbatim and in template order. */
export const BRAND_DEALS_FIELD_NAMES = [
  "Status",
  "Deal Type",
  "Priority",
  "Channel",
  "Brand Name",
  "Contact Name",
  "Deal Value",
  "Due Date",
  "Assets",
  "Owners",
] as const;

export type DealToCardOptions = {
  /** Show owners in the Owners field (default false: the captured sample records had none). */
  includeOwners?: boolean;
};

export const dealToCard = (d: Deal, opts: DealToCardOptions = {}): BoardCardData => ({
  id: d.id,
  title: d.title,
  fields: [
    { kind: "dropdown", name: "Status", value: d.status },
    { kind: "dropdown", name: "Deal Type", value: d.dealType },
    { kind: "dropdown", name: "Priority", value: d.priority },
    { kind: "dropdown", name: "Channel", value: d.channel },
    { kind: "text", name: "Brand Name", value: d.brandName },
    { kind: "text", name: "Contact Name", value: d.contactName },
    { kind: "number", name: "Deal Value", value: d.dealValue },
    { kind: "date", name: "Due Date", value: d.dueDate },
    { kind: "attachment", name: "Assets", value: [] },
    { kind: "contributors", name: "Owners", value: opts.includeOwners ? d.owners : [] },
  ],
});

/** Same record with one property changed (e.g. Status -> "Pitch Sent" after the dropdown pick). */
export const withField = (card: BoardCardData, name: string, value: CardField["value"]): BoardCardData => ({
  ...card,
  fields: card.fields.map((f) => (f.name === name ? ({ ...f, value } as CardField) : f)),
});

export const fieldValue = (card: BoardCardData, name: string): CardField["value"] | undefined =>
  card.fields.find((f) => f.name === name)?.value;

/** Status options of the Brand Deals template, in the app's order. */
export const STATUS_OPTIONS: string[] = [...DEAL_STATUSES];
