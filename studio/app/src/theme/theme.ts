import { create } from 'zustand';

export type ThemeName = 'night' | 'paper';

export const THEME_STORAGE_KEY = 'video-studio.theme';

const isTheme = (value: unknown): value is ThemeName => value === 'night' || value === 'paper';

/** The theme this browser chose before, or null on a first visit or when storage is blocked. */
export function readStoredTheme(): ThemeName | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme: ThemeName): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage is blocked or full. The choice still holds for this visit.
  }
}

const lightQuery = '(prefers-color-scheme: light)';

/** Paper when the system asks for a light look, Night otherwise. */
export function systemTheme(): ThemeName {
  try {
    return window.matchMedia?.(lightQuery).matches ? 'paper' : 'night';
  } catch {
    return 'night';
  }
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
}

interface ThemeState {
  theme: ThemeName;
  /** True once the person has picked a theme. Until then the page follows the system setting. */
  chosen: boolean;
  setTheme(theme: ThemeName): void;
}

const stored = readStoredTheme();

export const useTheme = create<ThemeState>((set) => ({
  theme: stored ?? systemTheme(),
  chosen: stored !== null,
  setTheme(theme) {
    storeTheme(theme);
    applyTheme(theme);
    set({ theme, chosen: true });
  },
}));

/** Call once before the first render. Applies the theme and keeps following the system until a choice is made. */
export function startTheme(): void {
  applyTheme(useTheme.getState().theme);
  try {
    window.matchMedia?.(lightQuery).addEventListener('change', () => {
      if (useTheme.getState().chosen) return;
      const theme = systemTheme();
      applyTheme(theme);
      useTheme.setState({ theme });
    });
  } catch {
    // No system setting to follow.
  }
}
