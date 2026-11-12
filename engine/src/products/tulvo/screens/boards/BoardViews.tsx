/**
 * The three board views of a page tab, rebuilt from the live DOM:
 *  - GridView   <- board-grid-pitch-sent.html (virtualised absolute grid, 372x164 cards)
 *  - KanbanView <- board-kanban-prospecting.html (300 px columns, "n of n items" chips)
 *  - ListView   <- the same build's BoardTableView (no list snapshot was captured; see boards.md)
 * Pure and props-driven; everything that moves is a prop (cardMotion, arrival, hidden ids, scroll).
 */
import React from "react";
import { ArrowUpDown, ChevronRight, Ellipsis, GripVertical, Pencil, Plus } from "lucide-react";
import { cn } from "../../cn";
import { BoardCard, type CardMotion, type OpenFieldMenu } from "./BoardCard";
import { BOARD, gridCellOffset } from "./layout";
import { cardDataClasses, kanbanCountLabel, type BoardCardData, type KanbanColumnData } from "./model";
import { FieldChip } from "./PropertyChips";

/** Shared per-card state, keyed by card id. */
export type CardStates = {
  /** Pointer over this card (title actions shown). */
  hoverCardId?: string | null;
  /** A dropdown select open on this card. */
  openMenu?: ({ cardId: string } & OpenFieldMenu) | null;
  /** Per-card motion (offset / lift / scale / rotate / opacity) on top of the laid-out position. */
  cardMotion?: Record<string, CardMotion>;
  /** Cards kept in the layout but not painted (e.g. while a floating copy is being dragged). */
  hiddenCardIds?: string[];
  today?: string;
};

const cardProps = (card: BoardCardData, s: CardStates) => ({
  hovered: s.hoverCardId === card.id,
  openMenu: s.openMenu && s.openMenu.cardId === card.id ? s.openMenu : null,
  motion: s.cardMotion?.[card.id],
  today: s.today,
});

// =============================================================================== Grid

export type GridViewProps = CardStates & {
  cards: BoardCardData[];
  /**
   * "Card arrives in tab": the card with this id eases in at its final slot. progress 0 = not there yet
   * (transparent, 12 px lower, 98%), 1 = settled exactly as the live capture (day2/08).
   */
  arrival?: { cardId: string; progress: number } | null;
  /** Width the cards are laid out in (default: the 1512 px window's 1156). */
  contentWidth?: number;
  showExpandWidthAction?: boolean;
};

export const GridView: React.FC<GridViewProps> = ({ cards, arrival = null, contentWidth = BOARD.contentWidth, showExpandWidthAction, ...s }) => {
  const rows = Math.ceil(cards.length / Math.max(1, Math.floor((contentWidth + 20) / 370)));
  const wrapperHeight = rows * (BOARD.grid.cardHeight + BOARD.grid.gap);
  return (
    <div className="w-full px-4 lg:!px-[3.375rem]">
      <div className="mt-2 sm:mt-2 relative">
        <div
          className="rounded-lg py-1 mb-7"
          style={{ position: "relative", minHeight: "calc(var(--tulvo-vh) * 100 - 160px)", overflowAnchor: "none" }}
        >
          <div className="card-grid" style={{ position: "absolute", width: "100%", height: 0, opacity: 0, pointerEvents: "none", zIndex: -1 }} />
          <div className="board-card-wrapper" style={{ position: "relative", height: wrapperHeight, width: "100%" }}>
            {cards.map((card, i) => {
              const o = gridCellOffset(i, contentWidth);
              const p = cardProps(card, s);
              const arriving = arrival && arrival.cardId === card.id ? Math.max(0, Math.min(1, arrival.progress)) : null;
              const motion: CardMotion | undefined =
                arriving == null
                  ? p.motion
                  : {
                      ...p.motion,
                      y: (p.motion?.y ?? 0) + (1 - arriving) * 12,
                      scale: (p.motion?.scale ?? 1) * (0.98 + 0.02 * arriving),
                      opacity: (p.motion?.opacity ?? 1) * arriving,
                    };
              const elevated = p.openMenu != null;
              return (
                <div
                  key={card.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: `translate3d(${o.x}px, ${o.y}px, 0px)`,
                    width: o.width,
                    height: o.height,
                    zIndex: elevated ? 30 : 1,
                    willChange: "transform",
                    // the live wrapper has contain: layout paint; dropped while a menu, lift or motion offset must paint outside it
                    contain: elevated || motion != null ? undefined : "layout paint",
                    visibility: s.hiddenCardIds?.includes(card.id) ? "hidden" : undefined,
                  }}
                >
                  <BoardCard card={card} variant="grid" {...p} motion={motion} showExpandWidthAction={showExpandWidthAction} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================== Kanban

export type KanbanViewProps = CardStates & {
  columns: KanbanColumnData[];
  /** Horizontal scroll of the board in px. */
  scrollLeft?: number;
  /** Per-column vertical scroll in px (by column id). */
  columnScrollTop?: Record<string, number>;
};

const COLUMN_ADD_BTN =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-6 w-6 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200";
const COUNT_CHIP =
  "kanban-column-count flex items-center justify-center min-h-5 min-w-[1.25rem] max-w-[min(100%,11rem)] shrink-0 text-[10px] font-medium text-foreground bg-muted/50 rounded-full border border-border px-1.5 py-0.5 text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis";
const SCROLL_Y =
  "kanban-column-content flex-1 overflow-y-auto min-h-0 !scrollbar !scrollbar-w-0.5 scrollbar-track-transparent scrollbar-thumb-transparent hover:scrollbar-thumb-gray-400/50  dark:scrollbar-thumb-transparent dark:hover:scrollbar-thumb-gray-400/50 pl-2 pr-[7.5px] pt-2";

export const KanbanView: React.FC<KanbanViewProps> = ({ columns, scrollLeft = 0, columnScrollTop, ...s }) => {
  const { columnStep, columnWidth, cardStep } = BOARD.kanban;
  return (
    <div className="w-full px-4 flex flex-1 min-h-0 min-w-0 flex-col lg:!px-[3.375rem]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="h-full min-h-0 w-full">
          <div className="h-full min-h-0 pb-0">
            <div className="kanban-board-container relative flex h-full overflow-x-auto overflow-y-hidden pt-4 pb-3.5 !scrollbar !scrollbar-h-1 scrollbar-track-transparent scrollbar-thumb-transparent hover:scrollbar-thumb-gray-400/50 dark:scrollbar-thumb-transparent dark:hover:scrollbar-thumb-gray-400/50">
              <div style={{ width: columns.length * columnStep, height: "100%", position: "relative", transform: scrollLeft ? `translateX(${-scrollLeft}px)` : undefined }}>
                {columns.map((col, ci) => {
                  const menuHere = s.openMenu != null && col.cards.some((c) => c.id === s.openMenu!.cardId);
                  // any card motion (lift, offset) may paint outside the column: relax its overflow clipping
                  const liftHere = col.cards.some((c) => s.cardMotion?.[c.id] != null);
                  const open = menuHere || liftHere;
                  const visible = open ? ({ overflow: "visible" } as const) : undefined;
                  const label = col.countLabel ?? kanbanCountLabel(col.cards.length, col.total);
                  const scrollTop = columnScrollTop?.[col.id] ?? 0;
                  return (
                    <div
                      key={col.id}
                      data-index={ci}
                      style={{ position: "absolute", top: 0, left: 0, transform: `translateX(${ci * columnStep}px)`, width: columnWidth, height: "100%", zIndex: open ? 30 : undefined }}
                    >
                      <div className="kanban-column min-w-[300px] h-full flex flex-col gap-5 min-h-0 overflow-hidden" style={visible}>
                        <div className="kanban-column-header flex h-10 shrink-0 items-center justify-between rounded-xl bg-[var(--kanban-column-header-bg)] px-2 group">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <h3 className="kanban-column-title text-sm font-semibold text-muted-foreground truncate select-none" title={col.title}>
                              {col.title}
                            </h3>
                            <span className={COUNT_CHIP} title={label}>
                              {label}
                            </span>
                          </div>
                          <button className={COLUMN_ADD_BTN}>
                            <Plus size={14} strokeWidth={2.5} absoluteStrokeWidth={false} className="" />
                          </button>
                        </div>
                        <div
                          className="kanban-column-body flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl"
                          style={{ ...visible, ...(col.tint ? { backgroundColor: col.tint } : null) }}
                        >
                          <div className={SCROLL_Y} style={{ overflowAnchor: "none", ...visible }}>
                            {col.cards.length > 0 ? (
                              <div style={{ height: col.cards.length * cardStep, width: "100%", position: "relative", transform: scrollTop ? `translateY(${-scrollTop}px)` : undefined }}>
                                {col.cards.map((card, i) => {
                                  const p = cardProps(card, s);
                                  const elevated = p.openMenu != null;
                                  return (
                                    <div
                                      key={card.id}
                                      data-index={i}
                                      style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        transform: `translateY(${i * cardStep}px)`,
                                        paddingBottom: 8,
                                        zIndex: elevated ? 30 : undefined,
                                        visibility: s.hiddenCardIds?.includes(card.id) ? "hidden" : undefined,
                                      }}
                                    >
                                      <BoardCard card={card} variant="kanban" {...p} />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================== List

export type ListViewProps = {
  rows: BoardCardData[];
  /** Header of the title column (the template's title property label, "Item" for Brand Deals). */
  titleLabel: string;
  /** Property columns in order (default: every field name of the first row). */
  columnNames?: string[];
  /** Expanded rows (chevron down). */
  expandedRowIds?: string[];
  today?: string;
  /** Horizontal scroll of the table in px. */
  scrollLeft?: number;
  /** Per-row motion (e.g. a row sliding in). */
  rowMotion?: Record<string, { y?: number; opacity?: number }>;
};

const TH = "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]";
const TD = "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]";
const TR = "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted";
const GHOST_SM =
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground text-xs h-6 w-6 p-0 flex-shrink-0";
const GHOST_ICON = "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground";

const HeaderCell: React.FC<{ label: string; title?: boolean; width: number }> = ({ label, title, width }) => (
  <th
    className={cn(TH, title ? "w-[300px] relative group task-table-header-cell task-name-header py-4" : "relative group task-table-header-cell py-4")}
    style={title ? { width } : { width, minWidth: 100 }}
  >
    <div className={title ? "flex items-center justify-between group/header pl-2" : "flex items-center justify-between group/header"}>
      <div className="flex items-center">
        <span className="text-t-table-header text-t-muted-bg font-normal whitespace-nowrap">{label}</span>
        <span className="cursor-pointer hover:bg-muted rounded p-0.5">
          <ArrowUpDown className="h-4 w-4 ml-1 opacity-0 group-hover/header:opacity-50" />
        </span>
      </div>
      <div className="opacity-0 group-hover:opacity-100 cursor-col-resize p-1 hover:bg-muted rounded transition-opacity">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  </th>
);

export const ListView: React.FC<ListViewProps> = ({ rows, titleLabel, columnNames, expandedRowIds = [], today = "2026-10-20", scrollLeft = 0, rowMotion }) => {
  const cols = columnNames ?? (rows[0]?.fields.map((f) => f.name) ?? []);
  return (
    <div className="w-full px-4 lg:!px-[3.375rem]">
      <div className="">
        <div className="board-table-list-wrapper w-full bg-background  task-table-container">
          <div className="relative w-full overflow-x-auto !scrollbar !scrollbar-h-0.5 scrollbar-track-transparent scrollbar-thumb-transparent hover:scrollbar-thumb-gray-400/50 dark:scrollbar-thumb-transparent dark:hover:scrollbar-thumb-gray-400/50">
            <table className="w-full caption-bottom text-sm task-table min-w-full" style={scrollLeft ? { transform: `translateX(${-scrollLeft}px)` } : undefined}>
              <thead className="[&_tr]:border-b task-table-header bg-t-header-bg border-t">
                <tr className={cn(TR, "task-table-header-row h-12")}>
                  <HeaderCell label={titleLabel} title width={300} />
                  {cols.map((c) => (
                    <HeaderCell key={c} label={c} width={200} />
                  ))}
                  <th className={cn(TH, "task-table-header-cell w-full py-4")} />
                  <th className={cn(TH, "w-[50px] py-4 sticky right-0 z-20 bg-t-header-bg")} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const m = rowMotion?.[r.id];
                  const expanded = expandedRowIds.includes(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={cn(TR, "task-table-row group/parent border-border", cardDataClasses(r.fields))}
                      style={m ? { transform: m.y ? `translateY(${m.y}px)` : undefined, opacity: m.opacity } : undefined}
                    >
                      <td className={cn(TD, "font-medium align-center task-table-cell task-name-cell relative")}>
                        <div className="flex items-center gap-2 min-w-[350px] max-w-full relative">
                          <button className={GHOST_SM}>
                            <ChevronRight className="h-4 w-4" style={expanded ? { transform: "rotate(90deg)" } : undefined} />
                          </button>
                          <div className="relative w-full min-w-0 flex-1">
                            <div className="group/title flex min-w-0 items-center gap-1">
                              <button
                                type="button"
                                title={r.title}
                                className="min-w-0 truncate rounded-md text-left text-foreground text-[length:inherit] leading-relaxed task-table-cell-title px-0 py-0 cursor-pointer hover:underline"
                              >
                                {r.title}
                              </button>
                              <button
                                type="button"
                                aria-label="Edit untitled title"
                                className={cn(
                                  GHOST_ICON,
                                  "h-6 w-6 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/title:opacity-100 [&_svg]:size-3.5",
                                )}
                              >
                                <Pencil aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          <button
                            className={cn(GHOST_ICON, "h-6 w-6 p-0 opacity-0 group-hover/parent:opacity-100 transition-opacity flex-shrink-0")}
                            title="Add Subtask"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      {cols.map((c) => {
                        const f = r.fields.find((x) => x.name === c);
                        return (
                          <td key={c} className={cn(TD, "align-center task-table-cell")} style={{ width: 200, minWidth: 100 }}>
                            {f ? <FieldChip field={f} today={today} /> : null}
                          </td>
                        );
                      })}
                      <td className="task-table-cell w-full border-b border-border" />
                      <td className={cn(TD, "align-center text-right task-table-cell sticky right-0 z-10 border-b border-border bg-background group-hover/parent:bg-muted transition-colors")}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button className={cn(GHOST_ICON, "h-8 w-8")}>
                            <Ellipsis className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
