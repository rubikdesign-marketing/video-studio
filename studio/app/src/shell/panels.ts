import { create } from 'zustand';

export type PanelName = 'left' | 'right' | 'timeline';
export type DrawerName = 'left' | 'right';

/** Smallest, largest and starting size of each panel, in pixels. Width for the sides, height for the timeline. */
export const PANEL_LIMITS: Record<PanelName, { min: number; max: number; initial: number }> = {
  left: { min: 200, max: 480, initial: 280 },
  right: { min: 240, max: 520, initial: 320 },
  timeline: { min: 120, max: 480, initial: 220 },
};

/** Under this width the side panels become drawers. */
export const NARROW_QUERY = '(max-width: 1079px)';
export const PANELS_STORAGE_KEY = 'video-studio.panels.v1';

const names: PanelName[] = ['left', 'right', 'timeline'];

export const clampSize = (name: PanelName, size: number): number => {
  const { min, max } = PANEL_LIMITS[name];
  return Math.round(Math.min(max, Math.max(min, size)));
};

interface Saved { sizes: Record<PanelName, number>; collapsed: Record<PanelName, boolean> }

const defaults = (): Saved => ({
  sizes: { left: PANEL_LIMITS.left.initial, right: PANEL_LIMITS.right.initial, timeline: PANEL_LIMITS.timeline.initial },
  collapsed: { left: false, right: false, timeline: false },
});

/** What this browser remembered, with anything missing or odd replaced by the starting layout. */
export function loadPanels(): Saved {
  const saved = defaults();
  try {
    const raw = window.localStorage.getItem(PANELS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      const { sizes, collapsed } = parsed as { sizes?: Record<string, unknown>; collapsed?: Record<string, unknown> };
      for (const name of names) {
        const size = sizes?.[name];
        if (typeof size === 'number' && Number.isFinite(size)) saved.sizes[name] = clampSize(name, size);
        if (typeof collapsed?.[name] === 'boolean') saved.collapsed[name] = collapsed[name];
      }
    }
  } catch {
    // Storage is blocked or holds something unreadable. Start from the usual layout.
  }
  return saved;
}

function savePanels({ sizes, collapsed }: Saved): void {
  try {
    window.localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify({ sizes, collapsed }));
  } catch {
    // Storage is blocked or full. The layout still holds for this visit.
  }
}

export interface PanelsState extends Saved {
  /** True under 1080px wide. The Shell keeps this in step with the window. */
  narrow: boolean;
  /** The side drawer open right now. Only used when `narrow`. Not remembered. */
  drawer: DrawerName | null;
  /** Shows or hides a panel. On a narrow window the sides open and close as drawers. */
  toggle(name: PanelName): void;
  /** True when the panel can be seen right now. */
  isOpen(name: PanelName): boolean;
  /** Sets a panel's size in pixels, kept within its limits. */
  resize(name: PanelName, size: number): void;
  setNarrow(narrow: boolean): void;
  closeDrawer(): void;
}

export const usePanelsStore = create<PanelsState>((set, get) => ({
  ...loadPanels(),
  narrow: false,
  drawer: null,
  toggle(name) {
    const state = get();
    if (state.narrow && name !== 'timeline') {
      set({ drawer: state.drawer === name ? null : name });
      return;
    }
    set({ collapsed: { ...state.collapsed, [name]: !state.collapsed[name] } });
  },
  isOpen(name) {
    const state = get();
    return state.narrow && name !== 'timeline' ? state.drawer === name : !state.collapsed[name];
  },
  resize(name, size) {
    set({ sizes: { ...get().sizes, [name]: clampSize(name, size) } });
  },
  setNarrow(narrow) {
    if (narrow !== get().narrow) set({ narrow, drawer: null });
  },
  closeDrawer() {
    set({ drawer: null });
  },
}));

usePanelsStore.subscribe((state, before) => {
  if (state.sizes !== before.sizes || state.collapsed !== before.collapsed) savePanels(state);
});

/**
 * The panel controls, for components and for shortcuts.
 * In a component: `const { toggle } = usePanels()`. Outside React: `usePanelsStore.getState().toggle('left')`.
 */
export const usePanels = (): PanelsState => usePanelsStore();
