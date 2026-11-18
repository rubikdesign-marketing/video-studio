import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Shortcut } from '../contracts/store';
import { createHistory, liveHistory } from '../store';
import {
  CommandMenuView, filterShortcuts, formatKeys, groupShortcuts, handleKey, isTyping, keyCaps, matchKeys, registerCoreShortcuts,
  registerNoteShortcuts, registerPanelShortcuts, registerPlaybackShortcuts, registerShortcuts, ShortcutSheetView, shortcutStore, TABLE,
} from './index';

const state = () => shortcutStore.getState();
const ids = () => state().shortcuts.map((s) => s.id);
beforeEach(() => { shortcutStore.setState({ shortcuts: [], sheetOpen: false, menuOpen: false }); });

describe('keys', () => {
  it('matches Command on a Mac and Ctrl elsewhere', () => {
    expect(matchKeys('Mod+Z', { key: 'z', metaKey: true }, true)).toBe(true);
    expect(matchKeys('Mod+Z', { key: 'z', ctrlKey: true }, true)).toBe(false);
    expect(matchKeys('Mod+Z', { key: 'z', ctrlKey: true }, false)).toBe(true);
    expect(matchKeys('Mod+Z', { key: 'Z', metaKey: true, shiftKey: true }, true)).toBe(false);     // that is redo
    expect(matchKeys('Shift+Mod+Z', { key: 'Z', metaKey: true, shiftKey: true }, true)).toBe(true);
    expect(matchKeys('Mod+Z', { key: 'z' }, true)).toBe(false);
    expect(matchKeys('N', { key: 'n' }, true)).toBe(true);
    expect(matchKeys('N', { key: 'n', metaKey: true }, true)).toBe(false);                         // Cmd+N belongs to the browser
    expect(matchKeys('N', { key: 'n', altKey: true }, true)).toBe(false);
  });
  it('matches named keys and signs', () => {
    expect(matchKeys('Space', { key: ' ' })).toBe(true);
    expect(matchKeys('ArrowLeft', { key: 'ArrowLeft' })).toBe(true);
    expect(matchKeys('ArrowLeft', { key: 'ArrowLeft', shiftKey: true })).toBe(false);
    expect(matchKeys('Shift+ArrowLeft', { key: 'ArrowLeft', shiftKey: true })).toBe(true);
    expect(matchKeys('?', { key: '?', shiftKey: true })).toBe(true);                               // Shift is how "?" is typed
    expect(matchKeys('?', { key: '?' })).toBe(true);
    expect(matchKeys('?', { key: '/' })).toBe(false);
  });
  it('writes shortcuts the way each kind of computer does', () => {
    expect(formatKeys('Shift+Mod+Z', true)).toBe('⇧⌘Z');
    expect(formatKeys('Shift+Mod+Z', false)).toBe('Ctrl+Shift+Z');
    expect(keyCaps('Mod+K', true)).toEqual(['⌘', 'K']);
    expect(keyCaps('Shift+ArrowLeft', false)).toEqual(['Shift', '←']);
    expect(keyCaps('Space', true)).toEqual(['Space']);
  });
  it('knows when a key press is typing', () => {
    expect(isTyping({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTyping({ tagName: 'INPUT' })).toBe(true);
    expect(isTyping({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTyping({ tagName: 'SELECT' })).toBe(true);
    expect(isTyping({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTyping({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTyping({ tagName: 'BUTTON' })).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe('the shortcut table', () => {
  it('has no two shortcuts on the same keys or with the same id', () => {
    const all = Object.values(TABLE);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    expect(new Set(all.map((s) => s.keys.toLowerCase())).size).toBe(all.length);
    for (const s of all) expect(s.label).toMatch(/^[A-Z][^.]*$/);
  });

  it('registers undo, redo, the sheet and the menu, and takes them out again', () => {
    const history = createHistory();
    const stop = registerCoreShortcuts(liveHistory(history));
    expect(ids()).toEqual(['history.undo', 'history.redo', 'help.shortcuts', 'help.commands']);
    stop();
    expect(ids()).toEqual([]);
  });

  it('lets each part of the app hand in what its keys do', () => {
    const play = vi.fn(); const note = vi.fn(); const left = vi.fn();
    const stopPlayback = registerPlaybackShortcuts({ playPause: play, fitTimeline: () => {} });
    registerNoteShortcuts({ newNote: note });
    registerPanelShortcuts({ toggleLeft: left });
    expect(ids()).toEqual(['playback.toggle', 'timeline.fit', 'notes.new', 'panels.left']);      // table order, whatever the order of calls
    expect(handleKey({ key: ' ' })).toBe(true);
    expect(handleKey({ key: 'n' })).toBe(true);
    expect(handleKey({ key: '[' })).toBe(true);
    expect([play.mock.calls.length, note.mock.calls.length, left.mock.calls.length]).toEqual([1, 1, 1]);
    stopPlayback();
    expect(ids()).toEqual(['notes.new', 'panels.left']);
    expect(handleKey({ key: ' ' })).toBe(false);
  });

  it('replaces a shortcut registered again under the same id', () => {
    const first = vi.fn(); const second = vi.fn();
    const stopFirst = registerShortcuts([{ id: 'x', keys: 'X', label: 'First', group: 'Help', run: first }]);
    registerShortcuts([{ id: 'x', keys: 'X', label: 'Second', group: 'Help', run: second }]);
    expect(state().shortcuts.map((s) => s.label)).toEqual(['Second']);
    stopFirst();                                                                                  // the old clean-up must not remove the new one
    expect(state().shortcuts).toHaveLength(1);
    handleKey({ key: 'x' });
    expect([first.mock.calls.length, second.mock.calls.length]).toEqual([0, 1]);
  });
});

describe('key handling', () => {
  it('runs undo and redo, with labels that say what would be undone', () => {
    const history = createHistory(); let value = 0;
    registerCoreShortcuts(liveHistory(history));
    history.getState().run({ label: 'Change the words in scene 3', do: () => { value = 1; }, undo: () => { value = 0; } });
    const undo = state().shortcuts.find((s) => s.id === 'history.undo');
    expect(undo?.label).toBe('Undo: change the words in scene 3');
    const prevented = vi.fn();
    expect(handleKey({ key: 'z', metaKey: true, preventDefault: prevented }, true)).toBe(true);
    expect(value).toBe(0);
    expect(prevented).toHaveBeenCalledOnce();
    expect(undo?.label).toBe('Undo');
    expect(state().shortcuts.find((s) => s.id === 'history.redo')?.label).toBe('Redo: change the words in scene 3');
    expect(handleKey({ key: 'Z', metaKey: true, shiftKey: true }, true)).toBe(true);
    expect(value).toBe(1);
    expect(handleKey({ key: 'z', ctrlKey: true }, false)).toBe(true);                             // and with Ctrl off a Mac
    expect(value).toBe(0);
  });

  it('ignores keys typed into fields', () => {
    const history = createHistory(); const note = vi.fn(); let value = 0;
    registerCoreShortcuts(liveHistory(history)); registerNoteShortcuts({ newNote: note });
    history.getState().run({ label: 'Step', do: () => { value = 1; }, undo: () => { value = 0; } });
    for (const target of [{ tagName: 'TEXTAREA' }, { tagName: 'INPUT', type: 'text' }, { tagName: 'DIV', isContentEditable: true }]) {
      expect(handleKey({ key: 'n', target })).toBe(false);
      expect(handleKey({ key: '?', shiftKey: true, target })).toBe(false);
      expect(handleKey({ key: 'z', metaKey: true, target }, true)).toBe(false);                   // the field's own undo
    }
    expect([note.mock.calls.length, value, state().sheetOpen]).toEqual([0, 1, false]);
    expect(handleKey({ key: 'n', target: { tagName: 'BUTTON' } })).toBe(true);
    expect(handleKey({ key: 'n', defaultPrevented: true })).toBe(false);
  });

  it('opens the sheet on "?" and the menu on Cmd+K, one at a time, and closes them on Escape', () => {
    const note = vi.fn();
    registerCoreShortcuts(liveHistory(createHistory())); registerNoteShortcuts({ newNote: note });
    handleKey({ key: '?', shiftKey: true });
    expect([state().sheetOpen, state().menuOpen]).toEqual([true, false]);
    expect(handleKey({ key: 'n' })).toBe(false);                                                  // nothing else runs behind the sheet
    expect(note).not.toHaveBeenCalled();
    handleKey({ key: 'k', metaKey: true }, true);
    expect([state().sheetOpen, state().menuOpen]).toEqual([false, true]);
    expect(handleKey({ key: 'Escape', target: { tagName: 'INPUT', type: 'text' } })).toBe(true);  // even from the menu's own field
    expect([state().sheetOpen, state().menuOpen]).toEqual([false, false]);
    handleKey({ key: '?' }); handleKey({ key: '?' });
    expect(state().sheetOpen).toBe(false);                                                        // "?" again closes it
    expect(handleKey({ key: 'Escape' })).toBe(false);                                             // nothing open: Escape is left alone
  });
});

describe('the sheet and the command menu', () => {
  const list: Shortcut[] = [
    { ...TABLE.playPause, run: () => {} }, { ...TABLE.newNote, run: () => {} }, { ...TABLE.undo, run: () => {} },
    { ...TABLE.sheet, run: () => {} }, { ...TABLE.menu, run: () => {} },
  ];

  it('groups the shortcuts for the sheet', () => {
    expect(groupShortcuts(list).map((g) => [g.group, g.shortcuts.length])).toEqual([['Playback', 1], ['Notes', 1], ['Editing', 1], ['Help', 2]]);
    expect(groupShortcuts([{ id: 'x', keys: 'X', label: 'Extra', group: 'Something new', run: () => {} }])).toHaveLength(1);
  });

  it('draws the sheet from the table', () => {
    const html = renderToStaticMarkup(<ShortcutSheetView shortcuts={list} onClose={() => {}} mac />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Keyboard shortcuts');
    for (const s of list) expect(html).toContain(s.label);
    expect(html).toContain('aria-label="⌘Z"');
    expect(html).toContain('<kbd class="sc-key" aria-hidden="true">Space</kbd>');
    expect(renderToStaticMarkup(<ShortcutSheetView shortcuts={list} onClose={() => {}} mac={false} />)).toContain('aria-label="Ctrl+Z"');
  });

  it('filters the command menu by what is typed', () => {
    expect(filterShortcuts(list, '').map((s) => s.id)).toEqual(['playback.toggle', 'notes.new', 'history.undo', 'help.shortcuts']);   // not the menu itself
    expect(filterShortcuts(list, 'NOTE').map((s) => s.id)).toEqual(['notes.new']);
    expect(filterShortcuts(list, 'play pause').map((s) => s.id)).toEqual(['playback.toggle']);
    expect(filterShortcuts(list, 'help').map((s) => s.id)).toEqual(['help.shortcuts']);                                            // group names count
    expect(filterShortcuts(list, 'zzz')).toEqual([]);
  });

  it('draws the command menu, the lit row, and a plain line when nothing matches', () => {
    const props = { shortcuts: list, active: 1, mac: true, onQuery: () => {}, onActive: () => {}, onRun: () => {}, onClose: () => {} };
    const html = renderToStaticMarkup(<CommandMenuView {...props} query="" />);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('placeholder="Type what you want to do"');
    expect(html.match(/role="option"/g)).toHaveLength(4);
    expect(html).toMatch(/id="sc-option-notes\.new"[^>]*aria-selected="true"/);
    expect(html).toContain('aria-activedescendant="sc-option-notes.new"');
    const none = renderToStaticMarkup(<CommandMenuView {...props} query="zzz" />);
    expect(none).toContain('Nothing matches “zzz”. Try another word.');
    expect(none).not.toContain('role="option"');
  });
});

describe('the styles', () => {
  const css = fs.readFileSync(fileURLToPath(new URL('./shortcuts.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const sources = ['ShortcutSheet.tsx', 'CommandMenu.tsx', 'KeyCaps.tsx'].map((f) => fs.readFileSync(fileURLToPath(new URL(`./${f}`, import.meta.url)), 'utf8')).join('\n');

  it('write no colour of their own: only the role variables', () => {
    for (const text of [css, sources]) {
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/);
      expect(text).not.toMatch(/:\s*(white|black|red|blue|green|gray|grey)\b/);
    }
    const roles = new Set(['--surface-page', '--surface-panel', '--surface-raised', '--surface-canvas', '--text-strong', '--text-body', '--text-quiet', '--line', '--accent', '--on-accent', '--good', '--warn', '--ease']);
    const used = [...css.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(10);
    for (const name of used) expect(roles.has(name ?? '')).toBe(true);
  });

  it('use no coding typeface, and switch motion off when asked', () => {
    expect(css).not.toMatch(/mono|courier|consolas|menlo/i);
    expect(css).toMatch(/\.sc-key\s*\{[^}]*font:\s*inherit/);                 // key caps would otherwise fall back to a coding face
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});
