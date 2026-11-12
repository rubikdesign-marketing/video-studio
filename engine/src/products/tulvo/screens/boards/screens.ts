/**
 * Gallery entries for the board screens ("TulvoUi-Boards-*").
 *
 *  *-Capture : same layout / counts / states as a live capture, with cleared names (fidelity checks):
 *    Boards-Grid-Capture                <- day2/08-pitch-sent-tab-card-arrived.jpg (3 cards, arrived card last)
 *    Boards-Grid-BeforeArrival-Capture  <- dom/board-grid-pitch-sent.html (the 2 cards before the move)
 *    Boards-Kanban-Capture              <- dom/board-kanban-prospecting.html
 *    Boards-StatusMenu-Capture          <- day2/07-deal-status-options.jpg (card hovered, Status select open)
 *    Boards-List-Capture                <- no list capture exists: Prospecting Deals data in List view
 *  others    : the ad's default data (tulvoFixtures).
 */
import { captureMatch, tulvoFixtures, type Deal, type TulvoDataset } from "../../fixtures";
import type { TulvoUiScreen } from "../types";
import { BoardPage, type BoardPageProps } from "./BoardPage";
import type { BoardToolbarProps } from "./BoardToolbar";
import { dealToCard, STATUS_OPTIONS, withField, type BoardCardData, type BoardView, type KanbanColumnData } from "./model";

const TODAY = "2026-10-20";
const PAGE_ID = "brand-deal-pipeline";
const PAGE_TITLE = "Brand Deal Pipeline";

const tabsOf = (ds: TulvoDataset) => ds.boardTabs.map((t) => ({ id: t.id, name: t.name }));

const toolbar = (ds: TulvoDataset, activeTabId: string, view: BoardView, extra: Partial<BoardToolbarProps> = {}): BoardToolbarProps => {
  const tab = ds.boardTabs.find((t) => t.id === activeTabId)!;
  return { tabs: tabsOf(ds), activeTabId, filterLabel: tab.template, filterCount: tab.count, view, ...extra };
};

const base = (ds: TulvoDataset, showCookieSettings: boolean) => ({
  workspace: ds.workspace,
  sidebar: ds.sidebar,
  activePageId: PAGE_ID,
  pageTitle: PAGE_TITLE,
  showCookieSettings,
});

const card = (ds: TulvoDataset, id: string): BoardCardData => dealToCard(ds.deals.find((d: Deal) => d.id === id)!);

/** The captured Prospecting Deals kanban: columns Prospecting / High / Urgent (the tab's filter values). */
const prospectingColumns = (cards: BoardCardData[]): KanbanColumnData[] => [
  { id: "prospecting", title: "Prospecting", cards },
  { id: "high", title: "High", cards: [] },
  { id: "urgent", title: "Urgent", cards: [] },
];

// ------------------------------------------------------------------------------- capture-match

const CM = captureMatch;
const cmMoved = withField(card(CM, "cm-2"), "Status", "Pitch Sent");

const gridCapture: BoardPageProps = {
  ...base(CM, true),
  toolbar: toolbar(CM, "pitch-sent-campaigns", "grid"),
  grid: { cards: [card(CM, "cm-3"), card(CM, "cm-4"), cmMoved], arrival: { cardId: "cm-2", progress: 1 }, today: TODAY },
};

const gridBeforeCapture: BoardPageProps = {
  ...base(CM, true),
  toolbar: toolbar(CM, "pitch-sent-campaigns", "grid"),
  grid: { cards: [card(CM, "cm-3"), card(CM, "cm-4")], today: TODAY },
};

const kanbanCapture: BoardPageProps = {
  ...base(CM, true),
  toolbar: toolbar(CM, "prospecting-deals", "kanban"),
  kanban: { columns: prospectingColumns([card(CM, "cm-1"), card(CM, "cm-2")]), today: TODAY },
};

const statusMenuCapture: BoardPageProps = {
  ...kanbanCapture,
  kanban: {
    ...kanbanCapture.kanban!,
    hoverCardId: "cm-2",
    openMenu: { cardId: "cm-2", field: "Status", options: STATUS_OPTIONS },
  },
};

const listCapture: BoardPageProps = {
  ...base(CM, true),
  toolbar: toolbar(CM, "prospecting-deals", "list"),
  list: { rows: [card(CM, "cm-1"), card(CM, "cm-2")], titleLabel: "Item", today: TODAY },
};

// ------------------------------------------------------------------------------- fixtures (ad defaults)

const FX = tulvoFixtures;
const fxMoved = withField(card(FX, "d-morrowby"), "Status", "Pitch Sent");

const gridFx: BoardPageProps = {
  ...base(FX, false),
  toolbar: toolbar(FX, "pitch-sent-campaigns", "grid"),
  grid: {
    cards: [card(FX, "d-brackwood"), card(FX, "d-ovenmoor"), card(FX, "d-corwen"), fxMoved],
    arrival: { cardId: "d-morrowby", progress: 1 },
    today: TODAY,
  },
};

const kanbanFx: BoardPageProps = {
  ...base(FX, false),
  toolbar: toolbar(FX, "prospecting-deals", "kanban"),
  kanban: { columns: prospectingColumns([card(FX, "d-kitbury"), card(FX, "d-morrowby")]), today: TODAY },
};

const statusMenuFx: BoardPageProps = {
  ...kanbanFx,
  kanban: { ...kanbanFx.kanban!, hoverCardId: "d-morrowby", openMenu: { cardId: "d-morrowby", field: "Status", options: STATUS_OPTIONS, highlighted: "Pitch Sent" } },
};

const listFx: BoardPageProps = {
  ...base(FX, false),
  toolbar: toolbar(FX, "live-brand-activations", "list"),
  list: { rows: [card(FX, "d-ollaine"), card(FX, "d-lanternly"), card(FX, "d-seabrel")], titleLabel: "Item", today: TODAY },
};

const viewMenuFx: BoardPageProps = {
  ...gridFx,
  toolbar: { ...gridFx.toolbar, viewMenuOpen: true, viewMenuHighlight: "kanban" },
};

/**
 * The Morrowby card taken out of its column: the slot it leaves behind. The live board has no card drag, so
 * BoardPage draws no floating copy; a scene draws the moving card itself, outside the app window, with a
 * standalone <BoardCard> placed from kanbanCardRect() (layout.ts).
 */
const cardMoveFx: BoardPageProps = {
  ...kanbanFx,
  kanban: { ...kanbanFx.kanban!, hiddenCardIds: ["d-morrowby"] },
};

const entry = (id: string, defaultProps: BoardPageProps): TulvoUiScreen<BoardPageProps> => ({ id, component: BoardPage, defaultProps });

export const boardsScreens: TulvoUiScreen<BoardPageProps>[] = [
  entry("Boards-Grid-Capture", gridCapture),
  entry("Boards-Grid-BeforeArrival-Capture", gridBeforeCapture),
  entry("Boards-Kanban-Capture", kanbanCapture),
  entry("Boards-StatusMenu-Capture", statusMenuCapture),
  entry("Boards-List-Capture", listCapture),
  entry("Boards-Grid", gridFx),
  entry("Boards-Kanban", kanbanFx),
  entry("Boards-StatusMenu", statusMenuFx),
  entry("Boards-List", listFx),
  entry("Boards-ViewMenu", viewMenuFx),
  entry("Boards-CardMove", cardMoveFx),
];
