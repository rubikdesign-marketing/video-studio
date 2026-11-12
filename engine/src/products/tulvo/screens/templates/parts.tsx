/**
 * Small shared pieces of the templates screens, markup and class strings verbatim from
 * research/ui-live/dom/data-templates-list.html and template-edit-properties.html.
 */
import React from "react";
import {
  BriefcaseBusiness,
  Calendar,
  CircleChevronDown,
  FileText,
  Hash,
  Image as ImageIcon,
  Paperclip,
  Table2,
  TrendingUp,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PropertyType } from "../../fixtures";
import type { TemplateIconKind } from "./data";

// ---------------------------------------------------------------- template icon tile

export const TEMPLATE_ICON: Record<TemplateIconKind, LucideIcon> = {
  sales: TrendingUp,
  contacts: Users,
  content: ImageIcon,
  general: Table2,
  projects: BriefcaseBusiness,
  notes: FileText,
};

const TILE_BASE = "relative grid shrink-0 place-items-center text-muted-foreground transition-[background-color,box-shadow] duration-150";
const STATUS_DOT =
  "absolute -bottom-[3px] -right-[3px] size-[11px] rounded-full border-2 border-[color:var(--row-bg,hsl(var(--background)))] bg-emerald-600 transition-colors duration-150 dark:bg-emerald-400";

/**
 * The template's icon tile with the green "in use" dot.
 *  - variant "row":        38px tile in a list row; `selected` = white tile with an input ring
 *  - variant "quick-look": 34px tile in the quick-look header
 */
export const TemplateIconTile: React.FC<{
  kind: TemplateIconKind;
  variant: "row" | "quick-look";
  selected?: boolean;
  inUse?: boolean;
}> = ({ kind, variant, selected = false, inUse = true }) => {
  const Icon = TEMPLATE_ICON[kind];
  const cls =
    variant === "quick-look"
      ? `${TILE_BASE.replace("place-items-center", "place-items-center bg-muted")} size-[34px] rounded-[9px]`
      : selected
        ? `${TILE_BASE} size-[38px] rounded-[10px] bg-background ring-1 ring-input`
        : `${TILE_BASE.replace("place-items-center", "place-items-center bg-muted")} size-[38px] rounded-[10px]`;
  return (
    <span aria-hidden="true" className={cls}>
      <Icon strokeWidth={1.75} className={variant === "quick-look" ? "size-4" : "size-[17px]"} />
      {inUse ? <span className={STATUS_DOT} /> : null}
    </span>
  );
};

// ---------------------------------------------------------------- property types

/** Quick-look property icon per type (data-templates-list.html). */
export const PROPERTY_TYPE_ICON: Record<PropertyType, LucideIcon> = {
  dropdown: CircleChevronDown,
  text: Type,
  number: Hash,
  date: Calendar,
  attachment: Paperclip,
  contributors: Users,
};

/**
 * Type chip text. The quick look renders "Dropdown" with CSS `lowercase`, the editor renders
 * "dropdown"; both read lowercase on screen.
 */
export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  dropdown: "Dropdown",
  text: "Text",
  number: "Number",
  date: "Date",
  attachment: "Attachment",
  contributors: "Contributors",
};

// ---------------------------------------------------------------- typed text field

/** Focus look of the app's inputs (focus-visible:ring-2 ring-primary/20 border-primary) + shadow-sm. */
export const INPUT_FOCUS_STYLE: React.CSSProperties = {
  borderColor: "hsl(var(--primary))",
  boxShadow: "0 0 0 2px hsl(var(--primary) / 0.2), 0 1px 2px 0 rgb(0 0 0 / 0.05)",
  outline: "none",
};

export type TypedInputProps = {
  /** Full text the field will hold. */
  value: string;
  /** How many characters of `value` are typed so far (animate this). Omit = all of it. */
  typedChars?: number;
  placeholder: string;
  /** Focused look (dark border + soft ring) and the caret. */
  focused?: boolean;
  /** Caret on/off (drive a blink from the frame: e.g. Math.floor(frame / 16) % 2 === 0). */
  caretVisible?: boolean;
  /** The input's class string (verbatim from the DOM). */
  className: string;
  /** Horizontal text inset = border + padding-left (px-3 + 1px border = 13). */
  textInset?: number;
};

/** Visible part of a typed string (clamped). */
export const typedText = (value: string, typedChars?: number) =>
  typedChars === undefined ? value : value.slice(0, Math.max(0, Math.min(value.length, Math.floor(typedChars))));

/**
 * The app's text input with frame-driven typing. The real <input> renders the text and the
 * placeholder exactly as the app; a transparent mirror of the typed text positions the caret
 * (a render cannot focus an input, so focus and caret are drawn from props).
 */
export const TypedInput: React.FC<TypedInputProps> = ({
  value,
  typedChars,
  placeholder,
  focused = false,
  caretVisible = true,
  className,
  textInset = 13,
}) => {
  const shown = typedText(value, typedChars);
  return (
    <>
      <input
        className={className}
        placeholder={placeholder}
        type="text"
        value={shown}
        readOnly
        style={focused ? INPUT_FOCUS_STYLE : undefined}
      />
      {focused && caretVisible ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            paddingLeft: textInset,
            fontSize: 14,
            whiteSpace: "pre",
            pointerEvents: "none",
          }}
        >
          <span style={{ visibility: "hidden" }}>{shown}</span>
          <span style={{ display: "inline-block", width: 1, height: 17, background: "hsl(var(--foreground))" }} />
        </span>
      ) : null}
    </>
  );
};
