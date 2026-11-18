// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setWidth = (narrow: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: narrow,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
};

/** Loads the shell afresh, as after a page reload: the store is rebuilt from what the browser kept. */
const openPage = async () => {
  cleanup();
  vi.resetModules();
  const { Shell } = await import('./Shell');
  const panels = await import('./panels');
  render(<Shell topBar="Top" left="Left content" canvas="Film" right="Right content" timeline="Lanes" />);
  return panels;
};

const panel = (name: string) => screen.getByLabelText(name, { selector: 'aside, section' });
const handle = (name: string) => screen.getByRole('separator', { name });
const toggleButton = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  window.localStorage.clear();
  setWidth(false);
});
afterEach(cleanup);

describe('Shell', () => {
  it('shows every slot', async () => {
    await openPage();
    for (const text of ['Top', 'Left content', 'Film', 'Right content', 'Lanes']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(panel('Left panel').style.width).toBe('280px');
    expect(panel('Right panel').style.width).toBe('320px');
    expect(panel('Timeline').style.height).toBe('220px');
  });

  it('resizes with the arrow keys, inside the limits', async () => {
    await openPage();
    const left = handle('Resize the left panel');
    fireEvent.keyDown(left, { key: 'ArrowRight' });
    expect(panel('Left panel').style.width).toBe('296px');
    fireEvent.keyDown(left, { key: 'ArrowLeft', shiftKey: true });
    expect(panel('Left panel').style.width).toBe('232px');
    fireEvent.keyDown(left, { key: 'Home' });
    expect(panel('Left panel').style.width).toBe('200px');
    fireEvent.keyDown(left, { key: 'ArrowLeft' });
    expect(panel('Left panel').style.width).toBe('200px');
    expect(left.getAttribute('aria-valuenow')).toBe('200');

    // The right panel and the timeline grow the other way.
    fireEvent.keyDown(handle('Resize the right panel'), { key: 'ArrowLeft' });
    expect(panel('Right panel').style.width).toBe('336px');
    fireEvent.keyDown(handle('Resize the timeline'), { key: 'ArrowUp' });
    expect(panel('Timeline').style.height).toBe('236px');
    fireEvent.keyDown(handle('Resize the timeline'), { key: 'End' });
    expect(panel('Timeline').style.height).toBe('480px');
  });

  it('resizes by dragging the handle', async () => {
    await openPage();
    const left = handle('Resize the left panel');
    fireEvent.pointerDown(left, { button: 0, clientX: 280, pointerId: 1 });
    fireEvent.pointerMove(left, { clientX: 340, pointerId: 1 });
    expect(panel('Left panel').style.width).toBe('340px');
    fireEvent.pointerUp(left, { clientX: 340, pointerId: 1 });
    fireEvent.pointerMove(left, { clientX: 400, pointerId: 1 });
    expect(panel('Left panel').style.width).toBe('340px');

    const timeline = handle('Resize the timeline');
    fireEvent.pointerDown(timeline, { button: 0, clientY: 500, pointerId: 2 });
    fireEvent.pointerMove(timeline, { clientY: 450, pointerId: 2 });
    expect(panel('Timeline').style.height).toBe('270px');
  });

  it('collapses and restores a panel from the top bar and from usePanels', async () => {
    const { usePanelsStore } = await openPage();
    const button = toggleButton(/left panel/);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(button);
    expect(panel('Left panel').hidden).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('separator', { name: 'Resize the left panel' })).toBeNull();
    // The content stays mounted, so nothing inside it is lost.
    expect(screen.getByText('Left content')).toBeTruthy();

    fireEvent.click(button);
    expect(panel('Left panel').hidden).toBe(false);

    fireEvent.click(toggleButton(/timeline/));
    expect(panel('Timeline').hidden).toBe(true);
    expect(usePanelsStore.getState().isOpen('timeline')).toBe(false);
  });

  it('keeps sizes and collapsed panels after a reload', async () => {
    await openPage();
    fireEvent.keyDown(handle('Resize the left panel'), { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(handle('Resize the timeline'), { key: 'ArrowUp' });
    fireEvent.click(toggleButton(/right panel/));

    await openPage();
    expect(panel('Left panel').style.width).toBe('344px');
    expect(panel('Timeline').style.height).toBe('236px');
    expect(panel('Right panel').hidden).toBe(true);

    fireEvent.click(toggleButton(/right panel/));
    await openPage();
    expect(panel('Right panel').hidden).toBe(false);
    expect(panel('Right panel').style.width).toBe('320px');
  });

  it('falls back to the usual layout when what was saved is unreadable or out of range', async () => {
    const { PANELS_STORAGE_KEY } = await openPage();
    window.localStorage.setItem(PANELS_STORAGE_KEY, '{not json');
    await openPage();
    expect(panel('Left panel').style.width).toBe('280px');

    window.localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify({ sizes: { left: 9000, right: 'wide' } }));
    await openPage();
    expect(panel('Left panel').style.width).toBe('480px');
    expect(panel('Right panel').style.width).toBe('320px');
  });

  it('works when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await openPage();
    fireEvent.keyDown(handle('Resize the left panel'), { key: 'ArrowRight' });
    expect(panel('Left panel').style.width).toBe('296px');
    vi.restoreAllMocks();
  });

  it('turns the side panels into drawers on a narrow window and keeps the timeline', async () => {
    setWidth(true);
    const { usePanelsStore } = await openPage();
    expect(panel('Left panel').hidden).toBe(true);
    expect(panel('Right panel').hidden).toBe(true);
    expect(panel('Timeline').hidden).toBe(false);
    expect(screen.queryByRole('separator', { name: 'Resize the left panel' })).toBeNull();
    expect(handle('Resize the timeline')).toBeTruthy();

    fireEvent.click(toggleButton(/left panel/));
    expect(panel('Left panel').hidden).toBe(false);
    expect(panel('Left panel').className).toContain('is-drawer');

    // One drawer at a time.
    fireEvent.click(toggleButton(/right panel/));
    expect(panel('Left panel').hidden).toBe(true);
    expect(panel('Right panel').hidden).toBe(false);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(panel('Right panel').hidden).toBe(true);

    fireEvent.click(toggleButton(/left panel/));
    fireEvent.click(screen.getByRole('button', { name: 'Close the panel' }));
    expect(panel('Left panel').hidden).toBe(true);

    // Opening a drawer does not change what a wide window remembers.
    expect(usePanelsStore.getState().collapsed).toEqual({ left: false, right: false, timeline: false });
  });
});
