/**
 * Inline property values ("propertie" chips) as the live board renders them on cards and in list rows.
 * Class strings are verbatim from board-grid-pitch-sent.html / board-kanban-prospecting.html /
 * waitlist-signups-board.html, or (states the snapshots did not capture: the open dropdown trigger, the
 * text/number cells of the list view) from the same build's compiled components (see boards.md).
 */
import React from "react";
import { Check, ChevronDown, UserRound } from "lucide-react";
import { cn } from "../../cn";
import { dateTone, fieldClass, formatDueDate, initialsOf, type CardField, type DateTone } from "./model";

// ---------------------------------------------------------------------------------------- dropdown

const DROPDOWN_WRAPPER = "inline-flex max-w-full items-center min-h-7 leading-none cursor-pointer rounded-full border border-t-border bg-background hover:bg-muted/30 transition-colors";
/** While the select is open the app drops the cursor/hover classes from the wrapper. */
const DROPDOWN_WRAPPER_EDITING = "inline-flex max-w-full items-center min-h-7 leading-none rounded-full border border-t-border bg-background";
const DROPDOWN_BUTTON =
  "whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-secondary shadow-sm hover:bg-secondary/80 py-2 flex h-7 items-center justify-start gap-1 rounded-full !border-transparent !bg-transparent px-2 !py-0 text-[14px] font-normal leading-none text-inherit focus-visible:ring-0 [&_svg]:!h-3 [&_svg]:!w-3";
/** Radix Select trigger (shadcn SelectTrigger merged with the board's overrides, tailwind-merge order). */
const SELECT_TRIGGER =
  "flex h-6 justify-between whitespace-nowrap border border-input bg-transparent px-2 py-1 shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 !h-7 !px-2 !py-0 font-normal text-[14px] leading-none rounded-full !border-transparent !justify-start items-center gap-1 !bg-transparent !shadow-none text-inherit focus:!ring-0 [&>span]:line-clamp-1 [&>span]:leading-none [&>svg]:!opacity-100 [&>svg]:!ml-0 [&>svg]:!h-3 [&>svg]:!w-3 [&>svg]:shrink-0 [&>svg]:!text-inherit";

export type DropdownChipProps = {
  name: string;
  value: string;
  /** Select open (data-field-editing="true"): the chip becomes the Radix Select trigger. */
  editing?: boolean;
  /** The open options list, rendered anchored under the chip (see SelectMenu). */
  menu?: React.ReactNode;
};

export const DropdownChip: React.FC<DropdownChipProps> = ({ name, value, editing = false, menu }) => (
  <div
    className={cn("propertie group flex items-center text-secondary-foreground rounded-full", fieldClass(name, "dropdown"))}
    data-field-editing={editing ? "true" : "false"}
    style={menu ? { position: "relative" } : undefined}
  >
    <div className="min-w-0 flex items-center">
      <div className={editing ? DROPDOWN_WRAPPER_EDITING : DROPDOWN_WRAPPER}>
        {editing ? (
          <div className="flex-1 min-w-0 inline-flex">
            <div>
              <button type="button" role="combobox" aria-expanded="true" data-state="open" className={SELECT_TRIGGER}>
                <span style={{ pointerEvents: "none" }}>{value}</span>
                <ChevronDown className="h-4 w-4 opacity-50 ml-1" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <button className={DROPDOWN_BUTTON} type="button">
              {value}
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
    {menu}
  </div>
);

// ---------------------------------------------------------------------------------------- select menu

const SELECT_CONTENT =
  "relative z-50 max-h-96 overflow-hidden border bg-popover text-popover-foreground propertie-popover-content min-w-36 max-w-64 rounded-2xl border-t-border p-1 shadow-lg";
const SELECT_ITEM =
  "relative flex w-full cursor-default select-none items-center gap-2 rounded-lg py-1.5 px-2 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50 propertie-popover-item min-w-0 [&_svg]:w-3 [&_svg]:h-3";

export type SelectMenuProps = {
  options: string[];
  selected: string | null;
  /** Keyboard/pointer highlight (data-highlighted): bg-accent, like hovering an option. */
  highlighted?: string | null;
  /** Gap between the chip's bottom edge and the menu, in px (measured on 07-deal-status-options). */
  offsetY?: number;
  /** Menu opacity / scale for an open animation (the app zooms 95%->100% and fades in). */
  opacity?: number;
  scale?: number;
};

/**
 * The open Radix Select content of a dropdown property (Status: the 7 deal statuses, check on the
 * current one). Rendered absolutely under its chip, aligned to the chip's left edge (popper, side
 * bottom, align start), so it lines up wherever the chip is.
 */
export const SelectMenu: React.FC<SelectMenuProps> = ({ options, selected, highlighted = null, offsetY = 3, opacity = 1, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: `calc(100% + ${offsetY}px)`,
      zIndex: 50,
      opacity,
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      transformOrigin: "top left",
    }}
  >
    <div role="listbox" data-state="open" data-side="bottom" data-align="start" className={SELECT_CONTENT}>
      {/* Radix sets --radix-select-trigger-* from the live trigger; unset here, so height/min-width fall back to auto. */}
      <div role="presentation" className="p-1 h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]">
        {options.map((o) => {
          const checked = o === selected;
          return (
            <div
              key={o}
              role="option"
              aria-selected={checked}
              data-state={checked ? "checked" : "unchecked"}
              data-highlighted={o === highlighted ? "" : undefined}
              className={SELECT_ITEM}
            >
              <span className="truncate">{o}</span>
              <span className="ml-auto flex h-4 w-4 items-center justify-center">
                {checked ? <Check className="h-4 w-4" /> : null}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------------------- other field types

/** Text property, inline (list view cell). */
export const TextChip: React.FC<{ name: string; value: string }> = ({ name, value }) => (
  <div className={cn("propertie group flex items-start", fieldClass(name, "text"))} data-field-editing="false">
    <div className="min-w-0 flex items-center">
      <div className="inline-flex max-w-full cursor-pointer hover:bg-muted/30 transition-colors">
        <div className="min-w-0">
          <div className="flex max-w-32 items-center justify-start gap-2 overflow-hidden rounded-lg border border-border bg-background px-2.5 py-1 text-left h-7">
            <span className="min-w-0 truncate text-xs font-normal leading-5 tracking-normal text-muted-foreground">{value}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/** Number property, inline (list view cell): the app shows the raw number (no currency format). */
export const NumberChip: React.FC<{ name: string; value: number | string }> = ({ name, value }) => (
  <div className={cn("propertie group flex items-start", fieldClass(name, "number"))} data-field-editing="false">
    <div className="min-w-0 flex items-center">
      <div className="inline-flex max-w-full">
        <div className="min-w-0">
          <div className="relative w-full min-w-0 flex-1 max-w-32">
            <button
              type="button"
              className="min-w-0 truncate text-left text-xs font-normal leading-5 rounded-lg border border-border bg-background px-2.5 py-1 text-muted-foreground h-7 block w-full transition-colors disabled:cursor-default hover:bg-muted/30"
            >
              {String(value)}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DATE_TONE_CLASS: Record<DateTone, string> = {
  today: "bg-blue-100 hover:bg-blue-100/80 text-blue-700 hover:opacity-80 border-blue-200",
  tomorrow: "bg-green-100 hover:bg-green-100/80 text-green-700 hover:opacity-80 border-green-200",
  thisWeek: "bg-purple-100 hover:bg-purple-100/80 text-purple-700 hover:opacity-80 border-purple-200",
  past: "bg-gray-100 hover:bg-gray-100/80 text-gray-600 hover:opacity-80 border-gray-200",
  future: "bg-orange-100 hover:bg-orange-100/80 text-orange-700 hover:opacity-80 border-orange-200",
};

/** Date property pill (waitlist-signups-board.html: "Oct 28", orange = more than 6 days ahead). */
export const DateChip: React.FC<{ name: string; value: string; today: string }> = ({ name, value, today }) => (
  <div className={cn("propertie group flex items-start", fieldClass(name, "date"))} data-field-editing="false">
    <div className="min-w-0 flex items-center">
      <div className="inline-flex max-w-full cursor-pointer hover:bg-muted/30 transition-colors">
        <div className="min-w-0">
          <button
            className={cn(
              "items-center justify-center whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm py-2 flex flex-wrap gap-1 px-2 !py-0 font-normal rounded-[26px] text-xs h-6",
              DATE_TONE_CLASS[dateTone(value, today)],
            )}
          >
            {formatDueDate(value, today)}
          </button>
        </div>
      </div>
    </div>
  </div>
);

/** Contributors property (waitlist-signups-board.html): empty = person icon; else initials avatars. */
export const ContributorsChip: React.FC<{ name: string; value: string[] }> = ({ name, value }) => {
  const empty = value.length === 0;
  return (
    <div className={cn("propertie group flex items-start", fieldClass(name, "contributors"))} data-field-editing="false">
      <div className="min-w-0 flex items-center">
        <div className="inline-flex max-w-full cursor-pointer hover:bg-muted/30 transition-colors">
          <div className="flex-1 min-w-0 w-full">
            <button
              className={cn(
                "justify-center whitespace-nowrap rounded-md transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 py-2 flex items-center px-1 !py-0 gap-1 font-normal text-xs h-6",
                empty ? "w-6" : "px-0 bg-transparent hover:bg-transparent shadow-none w-auto",
              )}
              type="button"
              aria-haspopup="menu"
              aria-expanded="false"
              data-state="closed"
            >
              <div className="flex -space-x-2">
                {empty ? (
                  <UserRound size={16} className="text-gray-700" />
                ) : (
                  value.slice(0, 2).map((n) => (
                    <span key={n} className="relative flex shrink-0 overflow-hidden rounded-full h-6 w-6 text-xs border-2 border-black/5">
                      <span className="flex items-center justify-center rounded-full bg-muted h-full w-full font-medium text-[11.5px]">{initialsOf(n)}</span>
                    </span>
                  ))
                )}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Renders any inline field by kind (attachment renders nothing: the app never shows it inline on cards). */
export const FieldChip: React.FC<{ field: CardField; today: string; editing?: boolean; menu?: React.ReactNode }> = ({ field, today, editing, menu }) => {
  switch (field.kind) {
    case "dropdown":
      return <DropdownChip name={field.name} value={field.value} editing={editing} menu={menu} />;
    case "text":
      return <TextChip name={field.name} value={field.value} />;
    case "number":
      return <NumberChip name={field.name} value={field.value} />;
    case "date":
      return <DateChip name={field.name} value={field.value} today={today} />;
    case "contributors":
      return <ContributorsChip name={field.name} value={field.value} />;
    default:
      return null;
  }
};
