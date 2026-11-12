/**
 * A board record card (Grid and Kanban), rebuilt from board-grid-pitch-sent.html and
 * board-kanban-prospecting.html; the hover title actions from the same build's TaskCardActions
 * component, day2/07-deal-status-options.jpg (kanban hover) and the live grid-hover capture
 * research/ui-live/day3/boards/01-grid-card-hovered-3-actions.jpg (21 Oct: svg classes read from the DOM).
 *
 * Hover title actions, verified live:
 *   grid   : Edit title (lucide-pencil-line), Expand to double width (lucide-unfold-horizontal), More actions (lucide-ellipsis)
 *   kanban : Edit title, More actions (the app passes hideExpandButton in Kanban only)
 *
 * Board cards are NOT draggable in the live app (no dnd hooks on cards or columns): a record changes
 * column/tab only through its Status select. So a card has no drag motion here (no lift, no rotate).
 *
 * Inline properties: the app measures the chips and shows as many whole ones as fit in one row
 * (max 4: Status, Deal Type, Priority, Channel for Brand Deals). Here a one-line wrapping row with
 * overflow hidden does exactly that in CSS, so it stays right when a value changes (e.g. the status
 * chip text after a move). Pass `visibleFieldCount` to force a count instead.
 */
import React from "react";
import { Ellipsis, FoldVertical, PencilLine, UnfoldHorizontal } from "lucide-react";
import { cn } from "../../cn";
import { cardDataClasses, cardInlineFields, type BoardCardData } from "./model";
import { FieldChip, SelectMenu, type SelectMenuProps } from "./PropertyChips";

/**
 * Offset / scale / opacity on top of the laid-out position. Used by the grid "load fade" when a tab
 * opens (GridView `arrival`), or on a standalone <BoardCard> drawn by the motion layer OUTSIDE the app
 * window. There is deliberately no rotate / lift: the live board has no card drag.
 */
export type CardMotion = {
  /** Offset in px from the card's laid-out position. */
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
};

export type OpenFieldMenu = {
  /** Property name whose select is open, e.g. "Status". */
  field: string;
  options: string[];
} & Pick<SelectMenuProps, "highlighted" | "offsetY" | "opacity" | "scale">;

export type BoardCardProps = {
  card: BoardCardData;
  /** "grid": fixed 164px tile (h-full); "kanban": natural height (156px), `!mb-0`. */
  variant: "grid" | "kanban";
  /** Pointer over the card: shows the title actions (Edit title, [grid: Expand to double width], More actions). */
  hovered?: boolean;
  /**
   * "Expand to double width" in the hover actions. Default: on for `grid`, off for `kanban`, as live
   * (verified on the 21 Oct grid-hover capture: lucide-unfold-horizontal, 28x28, between pencil and ⋯).
   */
  showExpandWidthAction?: boolean;
  /** A dropdown property's select is open on this card. */
  openMenu?: OpenFieldMenu | null;
  /** Force the number of inline chips (default: as many as fit, like the app). */
  visibleFieldCount?: number;
  /** "today" for date chips (yyyy-mm-dd). */
  today?: string;
  motion?: CardMotion;
  style?: React.CSSProperties;
};

const CARD_BASE =
  "board-card create-task-card overflow-visible border border-t-border bg-card text-card-foreground rounded-2xl relative p-0 group/titlebar shadow-sm";
const TITLE =
  "board-card-title tracking-normal relative transition-colors duration-200 line-clamp-3 w-full text-[14px] font-medium leading-5";
/** Verbatim from the live hovered card (day3/boards/01 DOM). */
const ACTION_BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-7 w-7 shrink-0 rounded-md border-0 bg-transparent p-0 shadow-none text-muted-foreground hover:bg-muted hover:text-foreground";
const EXPAND_WIDTH_BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-8 w-8 shrink-0 rounded-md border-0 bg-transparent p-0 shadow-none text-muted-foreground hover:bg-accent hover:text-accent-foreground !h-7 !w-7 hover:!bg-muted hover:!text-foreground";
const EXPAND_BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 collapsible-arrow-button z-20 size-7 shrink-0 rounded-md border-0 bg-transparent p-0 shadow-none text-muted-foreground hover:bg-accent hover:text-accent-foreground";

/** The live class "z-1" has no rule in app.scoped.css; the value the old project rendered it with. */
const Z1: React.CSSProperties = { zIndex: 1 };

export const motionTransform = (m?: CardMotion): string | undefined => {
  if (!m) return undefined;
  const parts: string[] = [];
  if (m.x || m.y) parts.push(`translate(${m.x ?? 0}px, ${m.y ?? 0}px)`);
  if (m.scale != null && m.scale !== 1) parts.push(`scale(${m.scale})`);
  return parts.length ? parts.join(" ") : undefined;
};

export const BoardCard: React.FC<BoardCardProps> = ({
  card,
  variant,
  hovered = false,
  showExpandWidthAction,
  openMenu = null,
  visibleFieldCount,
  today = "2026-10-20",
  motion,
  style,
}) => {
  const inline = cardInlineFields(card.fields);
  const shown = visibleFieldCount != null ? inline.slice(0, visibleFieldCount) : inline;
  const fit = visibleFieldCount == null;
  const transform = motionTransform(motion);
  const expandWidth = showExpandWidthAction ?? variant === "grid";

  const title = hovered ? (
    // "z-1" is not in the app's CSS; the old project's Tailwind v4 made it z-index 1, kept inline (Z1).
    <div className="flex flex-col flex-shrink-0 relative gap-1.5 z-1 pointer-events-none" style={Z1}>
      <div className="flex flex-col flex-shrink-0 relative gap-4 z-1 pointer-events-none" style={Z1}>
        <div className="relative h-[72px]">
          <div className="flex items-start justify-between">
            <div className="flex gap-2 group/card flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className={TITLE}>{card.title}</div>
              </div>
            </div>
          </div>
          <div
            className="board-card-actions-group-btn absolute right-0 top-0 z-20 -mt-1 -mr-0.5 flex w-fit items-center gap-0.5 rounded-md bg-white   pointer-events-none transition-opacity duration-200 opacity-0 group-hover/titlebar:opacity-100"
            style={{ opacity: 1 }}
          >
            <div className="pointer-events-auto flex items-center gap-0.5">
              <button className={ACTION_BTN} title="Edit title" aria-label="Edit title">
                <PencilLine className="size-4" aria-hidden="true" />
              </button>
              {expandWidth ? (
                <button className={EXPAND_WIDTH_BTN} title="Expand to double width" aria-label="Expand width">
                  <UnfoldHorizontal className="size-4" aria-hidden="true" />
                </button>
              ) : null}
              <button className={ACTION_BTN} title="More actions" aria-label="More actions">
                <Ellipsis className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="relative z-20 pointer-events-auto">
      <div className="flex flex-col flex-shrink-0 relative gap-1.5">
        <div className="flex flex-shrink-0 relative gap-2 z-1" style={Z1}>
          <div className="h-[72px] min-w-0 flex-1">
            <div className={TITLE}>{card.title}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const menuOpen = openMenu != null;
  return (
    <div
      className={cn(CARD_BASE, variant === "grid" ? "dashboard-card h-full w-full" : "!mb-0", cardDataClasses(card.fields))}
      tabIndex={0}
      style={{ gridArea: "span 1 / span 1", transform, transformOrigin: "50% 50%", opacity: motion?.opacity, ...style }}
    >
      <div className="board-card-content relative flex h-full min-h-0 flex-grow flex-col p-0">
        <div className="relative flex h-full min-h-0 flex-col px-4 pt-4">
          <div className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-visible">
            <div className="relative flex shrink-0 flex-col gap-5">
              <div className="absolute inset-0 z-10 cursor-pointer" />
              {title}
              <div className="relative z-20 flex shrink-0 pointer-events-auto">
                <div className="flex w-full items-center gap-2">
                  <div className="min-w-0 flex-1" style={menuOpen ? { position: "relative" } : undefined}>
                    <div className="relative min-w-0 w-full overflow-hidden">
                      <div
                        className="board-card-properties-row flex min-h-7 w-full min-w-0 flex-nowrap items-center gap-2"
                        style={fit ? { flexWrap: "wrap", height: 30, overflow: "hidden" } : undefined}
                      >
                        {shown.map((f, i) => (
                          <FieldChip
                            key={`${f.name}-${i}`}
                            field={f}
                            today={today}
                            editing={menuOpen && openMenu!.field === f.name && f.kind === "dropdown"}
                          />
                        ))}
                      </div>
                    </div>
                    {menuOpen ? (
                      // The open select content is portalled in the app (never clipped by the card). Here: an
                      // invisible one-line copy of the chip row lays the chips out at the same x, and only the
                      // open chip's menu is made visible, so the menu sits under its chip without clipping.
                      <div
                        aria-hidden="true"
                        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 30, display: "flex", alignItems: "center", gap: 8, visibility: "hidden", pointerEvents: "none", zIndex: 40 }}
                      >
                        {shown.map((f, i) => {
                          const isOpen = openMenu!.field === f.name && f.kind === "dropdown";
                          return (
                            <FieldChip
                              key={`m-${f.name}-${i}`}
                              field={f}
                              today={today}
                              editing={isOpen}
                              menu={
                                isOpen ? (
                                  <div style={{ visibility: "visible" }}>
                                    <SelectMenu
                                      options={openMenu!.options}
                                      selected={String(f.value)}
                                      highlighted={openMenu!.highlighted}
                                      offsetY={openMenu!.offsetY}
                                      opacity={openMenu!.opacity}
                                      scale={openMenu!.scale}
                                    />
                                  </div>
                                ) : undefined
                              }
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-1">
                    <button className={EXPAND_BTN} title="Expands the card height" aria-label="Expand">
                      <FoldVertical className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-4 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};
