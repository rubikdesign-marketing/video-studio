// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleFilm } from '../fixtures/sample-film';
import { usePlayback } from '../playback';
import { handleKey, shortcutStore } from '../shortcuts';
import { editor } from '../store';
import { useToasts } from '../ui';
import { Timeline } from './index';
import { clampPps, clock, clockExact, fitPps, HEAD, scrollAfterZoom, ticks, tickStep, useTimelineView } from './view';

const PPS = 100;                                                  // 100 pixels a second, so the sums are easy to read
const cueOf = (scene: number, cue: number) => editor.stores.edits.getState().edits.filter((e) => e.scene === `S0${scene}` && e.cue === cue);
const pointer = (type: string, target: Element | Window, clientX: number) => act(() => { fireEvent(target, new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 })); });
const left = (el: Element) => Number.parseFloat((el as HTMLElement).style.left);
const width = (el: Element) => Number.parseFloat((el as HTMLElement).style.width);
const lane = (name: string) => screen.getByRole('group', { name: `${name} lane` });
const cueButton = (words: RegExp) => screen.getByRole('button', { name: words });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}')));          // autosave has somewhere to go
  localStorage.clear();
  editor.stores.film.setState({ job: 'demo', status: 'ready', film: sampleFilm, filmModified: 1 });
  editor.stores.edits.setState({ edits: [], filmModified: 1 });
  editor.stores.notes.setState({ notes: [], goodScenes: [], previous: null });
  editor.stores.saving.setState({ stale: false, message: null });
  editor.stores.history.getState().clear();
  editor.select(null);
  usePlayback.getState().attachVideo(null);
  usePlayback.setState({ time: 0, playing: false, rate: 1, loop: null });
  const lanes = useTimelineView.getState().lanes;
  for (const id of Object.keys(lanes) as (keyof typeof lanes)[]) lanes[id] = { hidden: false, locked: false };
  useTimelineView.setState({ pps: PPS, fitted: false, width: 0, guide: null, lanes: { ...lanes } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); shortcutStore.setState({ shortcuts: [] }); useToasts.setState({ toasts: [] }); });

describe('the timeline', () => {
  it('says so when no film is open', () => {
    editor.stores.film.setState({ film: null });
    render(<Timeline />);
    expect(screen.getByText('The timeline appears here once a film is open.')).toBeTruthy();
  });

  it('draws the ruler and five lanes from the film, each thing at its time', () => {
    editor.stores.notes.setState({ notes: [{ localId: 'a', time: 6.4, kind: 'change', topic: null, must: true, text: 'Bigger', box: null }] });
    render(<Timeline />);
    for (const name of ['Scenes', 'Voice', 'On-screen words', 'Notes', 'Pace']) expect(lane(name)).toBeTruthy();
    const scenes = within(lane('Scenes')).getAllByRole('button', { name: /^Scene \d/ });
    expect(scenes.map((s) => [left(s.parentElement as Element), width(s.parentElement as Element)])).toEqual([[0, 350], [350, 510], [860, 360]]);
    expect(within(lane('Voice')).getAllByRole('button', { name: /^Voice line/ })).toHaveLength(3);
    const second = cueButton(/scene 2: Picture fitted to the sound/).parentElement as HTMLElement;
    expect([left(second), width(second)]).toEqual([620, 205]);                    // (3.5 + 2.7) and (4.75 - 2.7) seconds
    expect(left(screen.getByRole('button', { name: 'Note 1 at 0:06, Must fix: Bigger' }))).toBe(640);
    expect(within(lane('Pace')).getAllByRole('img').map((e) => e.getAttribute('aria-label'))).toEqual(['Scene 1 pace: 3 of 5', 'Scene 2 pace: 4 of 5', 'Scene 3 pace: 5 of 5']);
    expect(screen.getByRole('slider', { name: 'Playhead' }).getAttribute('aria-valuemax')).toBe('12.2');
  });

  it('shows the film with pending text edits applied', () => {
    editor.setCueTime('S01', 0, 1, 2);
    render(<Timeline />);
    const cue = cueButton(/scene 1: A sample film/).parentElement as HTMLElement;
    expect([left(cue), width(cue)]).toEqual([100, 100]);
  });
});

describe('lane controls', () => {
  // Hide and lock live in one Lanes menu (EDITOR-V2-PLAN.md, phase A5), not on every lane.
  const openLanes = () => fireEvent.click(screen.getByRole('button', { name: 'Lanes' }));
  const showItem = (name: string) => screen.getAllByRole('menuitemcheckbox', { name })[0] as HTMLElement;
  const lockItem = (name: string) => screen.getAllByRole('menuitemcheckbox', { name })[1] as HTMLElement;

  it('hides and shows a lane from the Lanes menu, with real buttons', () => {
    render(<Timeline />);
    openLanes();
    const voice = showItem('Voice');
    expect([voice.tagName, voice.getAttribute('aria-checked')]).toEqual(['BUTTON', 'true']);
    fireEvent.click(voice);
    expect(screen.queryByRole('group', { name: 'Voice lane' })).toBeNull();
    expect(showItem('Voice').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(showItem('Voice'));
    expect(within(lane('Voice')).getAllByRole('button', { name: /^Voice line/ })).toHaveLength(3);
  });

  it('lists every lane to show, and the two that can be dragged to lock', () => {
    render(<Timeline />);
    openLanes();
    for (const name of ['Scenes', 'Voice', 'On-screen words', 'Notes', 'Pace']) expect(showItem(name)).toBeTruthy();
    expect(screen.getAllByRole('menuitemcheckbox', { name: 'On-screen words' })).toHaveLength(2);
    expect(screen.getAllByRole('menuitemcheckbox', { name: 'Notes' })).toHaveLength(2);
    expect(screen.getAllByRole('menuitemcheckbox', { name: 'Scenes' })).toHaveLength(1);
  });

  it('lock a lane: nothing in it can be picked or dragged, and it is remembered', () => {
    render(<Timeline />);
    openLanes();
    fireEvent.click(lockItem('On-screen words'));
    expect(lane('On-screen words').getAttribute('data-locked')).toBe('true');
    const body = cueButton(/scene 2: Three beeps/);
    expect((body as HTMLButtonElement).disabled).toBe(true);
    pointer('pointerdown', body, 400); pointer('pointermove', window, 500); pointer('pointerup', window, 500);
    pointer('pointerdown', body.parentElement?.lastElementChild as Element, 400); pointer('pointermove', window, 500); pointer('pointerup', window, 500);
    fireEvent.keyDown(body, { key: 'ArrowRight', altKey: true });
    expect(editor.stores.edits.getState().edits).toEqual([]);
    expect(editor.history.canUndo).toBe(false);
    expect(JSON.parse(localStorage.getItem('studio-editor:timeline-lanes') ?? '{}')).toMatchObject({ text: { locked: true }, voice: { locked: false } });
    openLanes();                                                                     // the press on the film closed the menu
    fireEvent.click(lockItem('On-screen words'));
    expect((cueButton(/scene 2: Three beeps/) as HTMLButtonElement).disabled).toBe(false);
  });

  it('leaves out the Voice lane when the film has no voice', () => {
    editor.stores.film.setState({ film: { ...sampleFilm, scenes: sampleFilm.scenes.map((s) => ({ ...s, lines: [] })) } });
    render(<Timeline />);
    expect(screen.queryByRole('group', { name: 'Voice lane' })).toBeNull();
    openLanes();
    const voice = screen.getByRole('menuitemcheckbox', { name: /^Voice/ }) as HTMLButtonElement;
    expect([voice.disabled, voice.textContent]).toEqual([true, '✓VoiceNo voice in this film'.replace('✓', '')]);
  });
});

describe('the playhead', () => {
  it('moves with the keyboard: a frame, a second, the ends, and scene by scene', () => {
    render(<Timeline />);
    const slider = screen.getByRole('slider', { name: 'Playhead' });
    expect(slider.tabIndex).toBe(0);
    const press = (key: string, shiftKey = false) => { fireEvent.keyDown(slider, { key, shiftKey }); return usePlayback.getState().time; };
    expect(press('ArrowRight')).toBeCloseTo(1 / 60, 10);
    expect(press('ArrowRight')).toBeCloseTo(2 / 60, 10);
    expect(press('ArrowLeft')).toBeCloseTo(1 / 60, 10);
    expect(press('ArrowRight', true)).toBeCloseTo(1 + 1 / 60, 10);
    expect(press('End')).toBe(12.2);
    expect(press('Home')).toBe(0);
    expect(press('PageDown')).toBe(3.5);
    expect(press('PageDown')).toBe(8.6);
    expect(press('PageUp')).toBe(3.5);
    expect(slider.getAttribute('aria-valuenow')).toBe('3.5');
    expect(slider.getAttribute('aria-valuetext')).toBe('0:03.50 of 0:12.20');
    expect((screen.getByTestId('playhead') as HTMLElement).style.transform).toBe('translateX(350px)');
  });

  it('does not step twice when the page-wide arrow shortcut is also there', () => {
    render(<Timeline />);
    const slider = screen.getByRole('slider', { name: 'Playhead' });
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    act(() => { slider.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(handleKey(event)).toBe(false);                                          // the page-wide handler leaves it alone
    expect(usePlayback.getState().time).toBeCloseTo(1 / 60, 10);
  });

  it('scrubs: a click on the ruler goes there, and a drag follows the pointer', async () => {
    render(<Timeline />);
    const slider = screen.getByRole('slider', { name: 'Playhead' });
    pointer('pointerdown', slider, 420);
    expect(usePlayback.getState().time).toBe(4.2);
    pointer('pointermove', window, 500); pointer('pointermove', window, 615);
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });        // the next frame
    expect(usePlayback.getState().time).toBe(6.15);
    pointer('pointerup', window, 700);
    expect(usePlayback.getState().time).toBe(7);
    pointer('pointermove', window, 100);                                            // let go: no longer following
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    expect(usePlayback.getState().time).toBe(7);
    pointer('pointerdown', slider, 99999); pointer('pointerup', window, 99999);
    expect(usePlayback.getState().time).toBe(12.2);                                 // never past the end
  });

  it('leaves play, speed and repeat to the one transport under the film', () => {
    render(<Timeline />);
    for (const name of ['Play', 'Next scene', 'Scene before', 'Repeat scene']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Half' })).toBeNull();
  });

  it('goes to a scene on a click, and marks it as looking good with its tick', () => {
    render(<Timeline />);
    fireEvent.click(within(lane('Scenes')).getAllByRole('button', { name: /^Scene 2/ })[0] as Element);
    expect(usePlayback.getState().time).toBe(3.5);
    expect(editor.stores.selection.getState().selection).toEqual({ kind: 'scene', scene: 'S02' });
    fireEvent.click(screen.getByRole('button', { name: 'Mark scene 2 as looking good' }));
    expect(editor.stores.notes.getState().goodScenes).toEqual(['S02']);
    expect(screen.getByRole('button', { name: 'Scene 2 looks good. Undo' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('dragging an on-screen text', () => {
  it('one drag is exactly one step in the history, and undo puts the text back', () => {
    render(<Timeline />);
    const body = cueButton(/scene 2: Three beeps/);                                 // 0.3 to 2.35 into scene 2
    const block = body.parentElement as HTMLElement;
    expect([left(block), width(block)]).toEqual([380, 205]);

    pointer('pointerdown', body, 400);
    for (const x of [410, 425, 440, 455, 470, 480]) pointer('pointermove', window, x);   // many moves...
    expect(left(block)).toBe(460);                                                  // the block follows the pointer
    expect(editor.stores.edits.getState().edits).toEqual([]);                       // ...and nothing is written while dragging
    expect(editor.history.canUndo).toBe(false);
    pointer('pointerup', window, 480);

    expect(cueOf(2, 0)).toEqual([{ op: 'text.time', scene: 'S02', cue: 0, at: 1.1, out: 3.15 }]);
    expect(editor.history.labels.undo).toBe('Move the text in scene 2');
    expect(editor.stores.selection.getState().selection).toEqual({ kind: 'cue', scene: 'S02', cue: 0 });
    expect(left(cueButton(/scene 2: Three beeps/).parentElement as HTMLElement)).toBe(460);

    act(() => editor.history.undo());
    expect(editor.history.canUndo).toBe(false);                                     // that one step was all of it
    expect(editor.stores.edits.getState().edits).toEqual([]);
    const back = cueButton(/scene 2: Three beeps/).parentElement as HTMLElement;
    expect([left(back), width(back)]).toEqual([380, 205]);
    act(() => editor.history.redo());
    expect(cueOf(2, 0)).toHaveLength(1);
  });

  it('drags either end, inside the scene only and never shorter than a fifth of a second', () => {
    render(<Timeline />);
    const block = () => cueButton(/scene 2: Three beeps/).parentElement as HTMLElement;
    pointer('pointerdown', block().lastElementChild as Element, 585); pointer('pointermove', window, 20); pointer('pointerup', window, 20);
    expect(cueOf(2, 0)).toEqual([{ op: 'text.time', scene: 'S02', cue: 0, at: 0.3, out: 0.5 }]);
    pointer('pointerdown', block().firstElementChild as Element, 380); pointer('pointermove', window, -900); pointer('pointerup', window, -900);
    expect(cueOf(2, 0)).toEqual([{ op: 'text.time', scene: 'S02', cue: 0, at: 0, out: 0.5 }]);   // stopped at the scene's start
    const last = () => cueButton(/scene 2: Picture fitted/).parentElement as HTMLElement;
    pointer('pointerdown', last().lastElementChild as Element, 825); pointer('pointermove', window, 5000); pointer('pointerup', window, 5000);
    expect(cueOf(2, 1)).toEqual([{ op: 'text.time', scene: 'S02', cue: 1, at: 2.7, out: 5.1 }]);  // stopped at the scene's end
  });

  it('snaps within 8 pixels and shows a guide line while snapped', () => {
    usePlayback.getState().seek(5);                                                 // the playhead, 1.5 into scene 2
    render(<Timeline />);
    const body = cueButton(/scene 2: Three beeps/);
    pointer('pointerdown', body, 400);
    pointer('pointermove', window, 500);                                            // start at 4.8: 20 px from the playhead, nothing near
    expect(screen.queryByTestId('snap-guide')).toBeNull();
    pointer('pointermove', window, 526);                                            // start at 5.06: 6 px from the playhead
    expect((screen.getByTestId('snap-guide') as HTMLElement).style.transform).toBe('translateX(500px)');
    expect(left(body.parentElement as HTMLElement)).toBe(500);
    pointer('pointermove', window, 540);                                            // 20 px away: free again
    expect(screen.queryByTestId('snap-guide')).toBeNull();
    pointer('pointermove', window, 523);
    pointer('pointerup', window, 523);
    expect(cueOf(2, 0)).toEqual([{ op: 'text.time', scene: 'S02', cue: 0, at: 1.5, out: 3.55 }]);
    expect(screen.queryByTestId('snap-guide')).toBeNull();
  });

  it('a click without a drag only selects', () => {
    render(<Timeline />);
    const body = cueButton(/scene 3:/);
    pointer('pointerdown', body, 900); pointer('pointermove', window, 902); pointer('pointerup', window, 902);
    expect(editor.stores.edits.getState().edits).toEqual([]);
    expect(editor.stores.selection.getState().selection).toEqual({ kind: 'cue', scene: 'S03', cue: 0 });
    expect(cueButton(/scene 3:/).getAttribute('aria-current')).toBe('true');
  });

  it('moves by keyboard too: Alt with an arrow, and Shift for the end only', () => {
    render(<Timeline />);
    const body = cueButton(/scene 1: A sample film/);                               // 0.3 to 3.15
    fireEvent.keyDown(body, { key: 'ArrowRight', altKey: true });
    expect(cueOf(1, 0)).toEqual([{ op: 'text.time', scene: 'S01', cue: 0, at: 0.317, out: 3.167 }]);
    fireEvent.keyDown(cueButton(/scene 1: A sample film/), { key: 'ArrowLeft', altKey: true, shiftKey: true });
    expect(cueOf(1, 0)).toEqual([{ op: 'text.time', scene: 'S01', cue: 0, at: 0.317, out: 3.15 }]);
  });

  it('says why when the film has changed and the text cannot be moved', () => {
    render(<Timeline />);
    editor.stores.saving.setState({ stale: true });
    const body = cueButton(/scene 2: Three beeps/);
    pointer('pointerdown', body, 400); pointer('pointermove', window, 480); pointer('pointerup', window, 480);
    expect(editor.stores.edits.getState().edits).toEqual([]);
    expect(useToasts.getState().toasts.map((t) => t.message)).toEqual(['The film has changed. Reload it before changing more text.']);
  });
});

describe('selection', () => {
  it('marks the scene, text or note that was clicked', () => {
    editor.stores.notes.setState({ notes: [{ localId: 'a', time: 6.4, kind: 'keep', topic: null, must: false, text: '', box: null }] });
    render(<Timeline />);
    const scene = () => within(lane('Scenes')).getByRole('button', { name: /^Scene 2/ });
    fireEvent.click(scene());
    expect(editor.stores.selection.getState().selection).toEqual({ kind: 'scene', scene: 'S02' });
    expect(scene().getAttribute('aria-current')).toBe('true');
    expect(within(lane('Scenes')).getByRole('button', { name: /^Scene 1/ }).getAttribute('aria-current')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Note 1 at 0:06, Keep this/ }));
    expect(editor.stores.selection.getState().selection).toEqual({ kind: 'note', localId: 'a' });
    expect(screen.getByRole('button', { name: /^Note 1/ }).getAttribute('aria-current')).toBe('true');
    expect(scene().getAttribute('aria-current')).toBeNull();
    expect(usePlayback.getState().time).toBe(6.4);                                  // a note also takes you to its moment
  });
});

describe('zoom', () => {
  it('fits the film to the width and never zooms out past that', () => {
    expect(fitPps(1000, 12.2)).toBeCloseTo((1000 - HEAD - 24) / 12.2, 10);
    expect(fitPps(0, 12.2)).toBe(80);
    expect(clampPps(1, 1000, 12.2)).toBe(fitPps(1000, 12.2));
    expect(clampPps(5000, 1000, 12.2)).toBe(600);
    const view = useTimelineView.getState();
    view.measure(1000, 12.2);
    expect(view.zoomTo(300, 12.2)).toBe(300);
    expect(useTimelineView.getState().fitted).toBe(false);
    useTimelineView.getState().measure(700, 12.2);
    expect(useTimelineView.getState().pps).toBe(300);                               // a chosen zoom survives a resize
    useTimelineView.getState().fit(12.2);
    expect([useTimelineView.getState().fitted, useTimelineView.getState().pps]).toEqual([true, fitPps(700, 12.2)]);
    useTimelineView.getState().measure(1400, 12.2);
    expect(useTimelineView.getState().pps).toBe(fitPps(1400, 12.2));                // a fitted film stays fitted
  });

  it('keeps the moment under the pointer where it is', () => {
    // 100 px a second, scrolled 200: the pointer at 456 is over second 5. After doubling the zoom it still is.
    const scrollLeft = scrollAfterZoom(100, 200, 200, 456);
    expect((scrollLeft + 456 - HEAD) / 200).toBe(5);
    expect(scrollAfterZoom(200, 100, 0, HEAD)).toBe(0);
  });

  it('zooms with Shift+Z, the keys and the buttons', () => {
    render(<Timeline />);
    act(() => useTimelineView.getState().measure(1000, 12.2));
    act(() => { useTimelineView.getState().zoomTo(100, 12.2); });
    expect(handleKey({ key: '=' })).toBe(true);
    expect(useTimelineView.getState().pps).toBe(150);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(useTimelineView.getState().pps).toBeCloseTo(100, 10);
    act(() => { expect(handleKey({ key: 'Z', shiftKey: true })).toBe(true); });
    expect(useTimelineView.getState()).toMatchObject({ fitted: true, pps: fitPps(1000, 12.2) });
    expect((screen.getByRole('button', { name: 'Zoom out' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(useTimelineView.getState().fitted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
    expect(useTimelineView.getState().fitted).toBe(true);
  });

  it('zooms with a pinch or Cmd and the wheel, and leaves a plain scroll alone', () => {
    const { container } = render(<Timeline />);
    act(() => useTimelineView.getState().measure(1000, 12.2));
    act(() => { useTimelineView.getState().zoomTo(100, 12.2); });
    const scroller = container.querySelector('.tl-scroll') as HTMLElement;
    const wheel = (init: WheelEventInit) => { const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }); act(() => { scroller.dispatchEvent(e); }); return e; };
    expect(wheel({ deltaY: 30 }).defaultPrevented).toBe(false);
    expect(useTimelineView.getState().pps).toBe(100);
    expect(wheel({ deltaY: -50, ctrlKey: true }).defaultPrevented).toBe(true);      // a pinch arrives with Ctrl held
    expect(useTimelineView.getState().pps).toBeCloseTo(100 * Math.exp(0.5), 6);
    wheel({ deltaY: 50, metaKey: true });
    expect(useTimelineView.getState().pps).toBeCloseTo(100, 6);
  });

  it('spaces the ruler marks so their times fit', () => {
    expect([tickStep(600), tickStep(100), tickStep(40), tickStep(5)]).toEqual([0.2, 1, 2, 15]);
    expect(ticks(12.2, 5)).toEqual([0, 5, 10]);
    expect(ticks(1, 0.2)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect([clock(65), clock(4.5, 0.5), clock(0.2, 0.2), clockExact(64.256)]).toEqual(['1:05', '0:04.5', '0:00.2', '1:04.26']);
  });
});

describe('the styles', () => {
  const css = readFileSync('src/timeline/timeline.css', 'utf8');
  it('use no coding typeface and no dot grid', () => {
    expect(css).not.toMatch(/mono|courier|consolas|menlo/i);
    expect(css).not.toMatch(/radial-gradient|dotted/);
  });
  it('use only roles the theme defines', () => {
    const tokens = readFileSync('src/theme/tokens.css', 'utf8');
    const used = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1] ?? ''))];
    expect(used.length).toBeGreaterThan(10);
    for (const name of used) { expect(name.startsWith('--raw-'), name).toBe(false); expect(tokens.includes(`${name}:`), name).toBe(true); }
  });
});
