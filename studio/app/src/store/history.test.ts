import { describe, expect, it } from 'vitest';
import type { Film } from '../contracts/film';
import { sampleFilm } from '../fixtures/sample-film';
import { applyEdits, checkEdit, countWords, editedCue, putEdit } from './edits';
import { createHistory } from './history';

const step = (log: string[], name: string) => ({ label: name, do: () => { log.push(`do ${name}`); }, undo: () => { log.push(`undo ${name}`); } });

describe('history', () => {
  it('runs, undoes and redoes in order, with labels for the menu', () => {
    const log: string[] = []; const h = createHistory();
    expect(h.getState()).toMatchObject({ canUndo: false, canRedo: false, labels: {} });
    h.getState().run(step(log, 'A')); h.getState().run(step(log, 'B'));
    expect(h.getState()).toMatchObject({ canUndo: true, canRedo: false, labels: { undo: 'B' } });
    h.getState().undo();
    expect(h.getState().labels).toEqual({ undo: 'A', redo: 'B' });
    h.getState().undo(); h.getState().undo();                       // one more than there is: nothing happens
    expect(h.getState()).toMatchObject({ canUndo: false, canRedo: true, labels: { redo: 'A' } });
    h.getState().redo(); h.getState().redo(); h.getState().redo();
    expect(log).toEqual(['do A', 'do B', 'undo B', 'undo A', 'do A', 'do B']);
  });

  it('drops the redo steps once something new is done', () => {
    const log: string[] = []; const h = createHistory();
    h.getState().run(step(log, 'A')); h.getState().undo(); h.getState().run(step(log, 'B'));
    expect(h.getState()).toMatchObject({ canRedo: false, labels: { undo: 'B' } });
  });

  it('joins quick changes with the same key into one step, and only those', () => {
    let time = 0; let value = 0;
    const h = createHistory({ now: () => time, mergeWindowMs: 1000 });
    const set = (to: number) => { const from = value; return { label: `Set ${to}`, do: () => { value = to; }, undo: () => { value = from; } }; };
    h.getState().runMerged('k', set(1)); time = 500; h.getState().runMerged('k', set(2)); time = 900; h.getState().runMerged('k', set(3));
    time = 5000; h.getState().runMerged('k', set(4));               // too late to join
    h.getState().runMerged('other', set(5));
    h.getState().undo(); expect(value).toBe(4);
    h.getState().undo(); expect(value).toBe(3);
    h.getState().undo(); expect(value).toBe(0);
    expect(h.getState().canUndo).toBe(false);
    h.getState().redo(); expect(value).toBe(3);
    expect(h.getState().labels.undo).toBe('Set 3');
  });

  it('keeps a limited number of steps and can forget them all', () => {
    const log: string[] = []; const h = createHistory({ limit: 3 });
    for (const n of ['A', 'B', 'C', 'D']) h.getState().run(step(log, n));
    h.getState().undo(); h.getState().undo(); h.getState().undo(); h.getState().undo();
    expect(log.filter((l) => l.startsWith('undo'))).toEqual(['undo D', 'undo C', 'undo B']);
    h.getState().clear();
    expect(h.getState()).toMatchObject({ canUndo: false, canRedo: false, labels: {} });
  });

  it('ignores a step started from inside another step', () => {
    const log: string[] = []; const h = createHistory();
    h.getState().run({ label: 'Outer', do: () => { log.push('outer'); h.getState().run(step(log, 'Inner')); }, undo: () => {} });
    expect(log).toEqual(['outer']);
  });
});

describe('edit helpers', () => {
  it('counts words the way a person would', () => {
    expect(countWords(['A *sample* film.'])).toBe(3);
    expect(countWords(['Picture fitted', 'to the *sound*.'])).toBe(5);
    expect(countWords(['', '  ', '* — *'])).toBe(0);
    expect(countWords(['Über 100% café'])).toBe(3);
  });

  it('checks an edit against the film', () => {
    expect(checkEdit(sampleFilm, { op: 'text.words', scene: 'S01', cue: 0, lines: ['one two three', 'four five six seven'] })).toBeNull();
    expect(checkEdit(sampleFilm, { op: 'text.words', scene: 'S01', cue: 0, lines: [] })).toBe('On-screen text needs at least one word.');
    expect(checkEdit(sampleFilm, { op: 'text.words', scene: 'S01', cue: 1, lines: ['Hi'] })).toBe('Scene 1 has no on-screen text number 2.');
    expect(checkEdit(sampleFilm, { op: 'text.time', scene: 'S02', cue: 0, at: 0, out: 5.1 })).toBeNull();     // 8.6 - 3.5, to the edge
    expect(checkEdit(sampleFilm, { op: 'text.time', scene: 'S02', cue: 0, at: -1, out: 2 })).toBe('The text cannot start before its scene does.');
    expect(checkEdit(sampleFilm, { op: 'text.time', scene: 'S02', cue: 0, at: 0, out: Number.NaN })).toBe('The text needs a start and an end time.');
  });

  it('applies edits to a copy and leaves the film alone', () => {
    const frozen = JSON.parse(JSON.stringify(sampleFilm)) as Film;
    let edits = putEdit([], { op: 'text.words', scene: 'S02', cue: 1, lines: ['Old try.'] });
    edits = putEdit(edits, { op: 'text.time', scene: 'S02', cue: 1, at: 3, out: 5 });
    edits = putEdit(edits, { op: 'text.words', scene: 'S02', cue: 1, lines: ['New try.'] });
    edits = putEdit(edits, { op: 'text.words', scene: 'S09', cue: 0, lines: ['Ignored: no such scene.'] });
    expect(edits).toHaveLength(3);
    const edited = applyEdits(sampleFilm, edits);
    expect(edited.scenes[1]?.texts[1]).toEqual({ lines: ['New try.'], at: 3, out: 5 });
    expect(edited.scenes[0]).toBe(sampleFilm.scenes[0]);
    expect(sampleFilm).toEqual(frozen);
    expect(editedCue(sampleFilm, edits, 'S02', 1)).toEqual({ cue: { lines: ['New try.'], at: 3, out: 5 }, words: true, time: true });
    expect(editedCue(sampleFilm, edits, 'S02', 0)).toMatchObject({ words: false, time: false });
    expect(applyEdits(sampleFilm, [])).toBe(sampleFilm);
  });
});
