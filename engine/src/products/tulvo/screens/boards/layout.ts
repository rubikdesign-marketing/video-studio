/**
 * Board geometry at the captured 1512x805 window (CSS px), from the live DOM:
 *  - main column = 1512 - 248 (sidebar); header 48; toolbar row 64 (py-4 + h-8);
 *  - board content side padding 54 (lg:!px-[3.375rem]) -> content width 1156;
 *  - Grid: cards 372x164 in 3 columns, 20 px gaps (translate3d(392*col, 184*row)), 8 px top margin + 4 px padding;
 *  - Kanban: columns 300 wide every 316 px, 16 px top padding, 40 px header + 20 px gap, 8 px content
 *    padding (left 8 / right 7.5), cards 156 tall every 164 px.
 * Helpers return positions in TulvoApp window coordinates (origin = app top-left), e.g. to place a
 * floating card or a cursor exactly over a laid-out card.
 */
export const BOARD = {
  sidebarWidth: 248,
  topBarHeight: 48,
  toolbarHeight: 64,
  sidePadding: 54,
  contentWidth: 1512 - 248 - 2 * 54,
  grid: { minCardWidth: 350, gap: 20, cardHeight: 164, marginTop: 8, paddingTop: 4 },
  kanban: { columnWidth: 300, columnStep: 316, paddingTop: 16, headerHeight: 40, headerGap: 20, contentPadTop: 8, contentPadLeft: 8, contentPadRight: 7.5, cardHeight: 156, cardStep: 164 },
} as const;

export type Rect = { x: number; y: number; width: number; height: number };

export const gridColumns = (contentWidth: number = BOARD.contentWidth): { count: number; cardWidth: number } => {
  const { minCardWidth, gap } = BOARD.grid;
  const count = Math.max(1, Math.floor((contentWidth + gap) / (minCardWidth + gap)));
  return { count, cardWidth: (contentWidth - gap * (count - 1)) / count };
};

/** Position of the card at `index` inside the grid wrapper (relative to the wrapper). */
export const gridCellOffset = (index: number, contentWidth: number = BOARD.contentWidth): { x: number; y: number; width: number; height: number } => {
  const { count, cardWidth } = gridColumns(contentWidth);
  const col = index % count;
  const row = Math.floor(index / count);
  return { x: col * (cardWidth + BOARD.grid.gap), y: row * (BOARD.grid.cardHeight + BOARD.grid.gap), width: cardWidth, height: BOARD.grid.cardHeight };
};

/** Grid card rectangle in app window coordinates (no page scroll). */
export const gridCardRect = (index: number, contentWidth: number = BOARD.contentWidth): Rect => {
  const o = gridCellOffset(index, contentWidth);
  return {
    x: BOARD.sidebarWidth + BOARD.sidePadding + o.x,
    y: BOARD.topBarHeight + BOARD.toolbarHeight + BOARD.grid.marginTop + BOARD.grid.paddingTop + o.y,
    width: o.width,
    height: o.height,
  };
};

/** Kanban card rectangle in app window coordinates (no horizontal / column scroll). */
export const kanbanCardRect = (columnIndex: number, cardIndex: number): Rect => {
  const k = BOARD.kanban;
  return {
    x: BOARD.sidebarWidth + BOARD.sidePadding + columnIndex * k.columnStep + k.contentPadLeft,
    y: BOARD.topBarHeight + BOARD.toolbarHeight + k.paddingTop + k.headerHeight + k.headerGap + k.contentPadTop + cardIndex * k.cardStep,
    width: k.columnWidth - k.contentPadLeft - k.contentPadRight,
    height: k.cardHeight,
  };
};

/** Top-left of a card's first inline chip (e.g. Status) in app coordinates, for cursor placement. */
export const cardFirstChipOrigin = (card: Rect): { x: number; y: number } => ({ x: card.x + 1 + 16, y: card.y + 1 + 16 + 72 + 20 });
