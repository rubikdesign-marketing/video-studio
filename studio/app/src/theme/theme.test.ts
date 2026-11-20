// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const system = (light: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: light && query.includes('light'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
};

/** A fresh copy of the theme module, as after a page load. */
const load = async () => {
  vi.resetModules();
  return import('./theme');
};

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => vi.restoreAllMocks());

describe('theme', () => {
  it('follows a light system setting on a first visit', async () => {
    system(true);
    const { useTheme, startTheme } = await load();
    startTheme();
    expect(useTheme.getState().theme).toBe('paper');
    expect(document.documentElement.dataset.theme).toBe('paper');
    expect(window.localStorage.length).toBe(0);
  });

  it('starts in Night when the system is dark or says nothing', async () => {
    system(false);
    expect((await load()).useTheme.getState().theme).toBe('night');
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect((await load()).useTheme.getState().theme).toBe('night');
  });

  it('remembers the choice after a reload, over the system setting', async () => {
    system(false);
    const first = await load();
    first.useTheme.getState().setTheme('paper');
    expect(document.documentElement.dataset.theme).toBe('paper');

    const second = await load();
    second.startTheme();
    expect(second.useTheme.getState()).toMatchObject({ theme: 'paper', chosen: true });
    expect(document.documentElement.dataset.theme).toBe('paper');
  });

  it('still works when storage is blocked', async () => {
    system(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { useTheme } = await load();
    expect(useTheme.getState().theme).toBe('night');
    expect(() => useTheme.getState().setTheme('paper')).not.toThrow();
    expect(useTheme.getState().theme).toBe('paper');
  });
});
