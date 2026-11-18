// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Edit } from '../contracts/review';
import { sampleFilm } from '../fixtures/sample-film';
import { checkEdit, createEditor, type Editor, type EditorApi } from '../store';
import { Inspector } from './Inspector';

let clock = 0;
let ed: Editor;

/** A pretend studio server that holds one film and remembers nothing. */
const pretendApi = (): EditorApi => ({
  getFilm: async () => ({ film: sampleFilm, videos: [{ file: 'preview.mp4', modified: 1 }], filmModified: 1 }),
  getReview: async () => ({ draft: { notes: [], goodScenes: [] }, batches: [] }),
  getEdits: async () => ({ filmModified: 1, edits: [] }),
  saveDraft: async () => {},
  saveEdits: async () => {},
  sendBatch: async () => {
    throw new Error('not used');
  },
  requestExport: async () => {
    throw new Error('not used');
  },
  events: () => () => {},
  mediaUrl: (job, file) => `/media/${job}/${file}`,
});

const edits = (): Edit[] => ed.stores.edits.getState().edits;
const steps = () => ed.stores.history.getState();
/** Lets a second pass, so the next change is its own step and does not join the one before. */
const later = () => {
  clock += 5000;
};
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const undo = () => act(() => ed.history.undo());

/** What every change must leave behind: a list of edits that all fit the film, and one step that undoes it. */
function expectOneValidStep(before: Edit[]) {
  for (const edit of edits()) expect(checkEdit(sampleFilm, edit), JSON.stringify(edit)).toBeNull();
  expect(edits()).not.toEqual(before);
  expect(steps().canUndo).toBe(true);
  expect(steps().labels.undo).toMatch(/^[A-Z][a-z].* scene \d$/);
  undo();
  expect(edits()).toEqual(before);
}

beforeEach(async () => {
  clock = 1_000_000;
  ed = createEditor({ api: pretendApi(), storage: null, saveDelayMs: 60_000, now: () => clock });
  await ed.open('_sample');
  ed.select({ kind: 'cue', scene: 'S02', cue: 1 });       // "Picture fitted / to the *sound*.", 2.7s to 4.75s of a 5.1s scene
  render(<Inspector editor={ed} />);
});
afterEach(cleanup);

describe('Inspector: an on-screen text', () => {
  it('shows one field per line, the word count and the timing', () => {
    expect((screen.getByLabelText('Line 1') as HTMLInputElement).value).toBe('Picture fitted');
    expect((screen.getByLabelText('Line 2') as HTMLInputElement).value).toBe('to the *sound*.');
    expect(screen.getByText('5 of 7 words')).toBeTruthy();
    expect((screen.getByLabelText('Comes on at (seconds)') as HTMLInputElement).value).toBe('2.7');
    expect((screen.getByLabelText('Goes off at (seconds)') as HTMLInputElement).value).toBe('4.75');
  });

  it('changing the words is one valid edit and one step, and undo puts the words back', () => {
    type('Line 1', 'Picture follows');
    expect(edits()).toEqual([{ op: 'text.words', scene: 'S02', cue: 1, lines: ['Picture follows', 'to the *sound*.'] }]);
    expect(steps().labels.undo).toBe('Change the words in scene 2');
    expectOneValidStep([]);
    expect(steps().canUndo).toBe(false);
    expect((screen.getByLabelText('Line 1') as HTMLInputElement).value).toBe('Picture fitted');
  });

  it('typing a word letter by letter is still one step', () => {
    for (const text of ['Picture f', 'Picture fo', 'Picture fol', 'Picture follows']) type('Line 1', text);
    expect(edits()).toHaveLength(1);
    undo();
    expect(edits()).toEqual([]);
    expect(steps().canUndo).toBe(false);
  });

  it('removing and adding a line are each one valid edit and one step', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Remove the last line' }));
    expect(edits()).toEqual([{ op: 'text.words', scene: 'S02', cue: 1, lines: ['Picture fitted'] }]);
    expect(screen.getByLabelText('Words')).toBeTruthy();
    const oneLine = edits();
    later();
    fireEvent.click(screen.getByRole('button', { name: 'Add a second line' }));
    type('Line 2', 'to sound');
    expect(edits()).toEqual([{ op: 'text.words', scene: 'S02', cue: 1, lines: ['Picture fitted', 'to sound'] }]);
    expectOneValidStep(oneLine);
    expectOneValidStep([]);
    expect(steps().canUndo).toBe(false);
  });

  it('changing the start and the end are each one valid edit and one step', () => {
    type('Comes on at (seconds)', '2.5');
    expect(edits()).toEqual([{ op: 'text.time', scene: 'S02', cue: 1, at: 2.5, out: 4.75 }]);
    expect(steps().labels.undo).toBe('Move the text in scene 2');
    const moved = edits();
    later();
    type('Goes off at (seconds)', '5');
    expect(edits()).toEqual([{ op: 'text.time', scene: 'S02', cue: 1, at: 2.5, out: 5 }]);
    expectOneValidStep(moved);
    expectOneValidStep([]);
    expect(steps().canUndo).toBe(false);
    expect((screen.getByLabelText('Comes on at (seconds)') as HTMLInputElement).value).toBe('2.7');
  });

  it('putting the original back is one step too, and undo brings the change back', () => {
    type('Line 1', 'Picture follows');
    type('Comes on at (seconds)', '2.5');
    const both = edits();
    expect(both).toHaveLength(2);
    later();
    fireEvent.click(screen.getByRole('button', { name: 'Put back the original words' }));
    expect(edits()).toEqual([{ op: 'text.time', scene: 'S02', cue: 1, at: 2.5, out: 4.75 }]);
    expect(steps().labels.undo).toBe('Put back the original words in scene 2');
    expectOneValidStep(both);
    later();
    fireEvent.click(screen.getByRole('button', { name: 'Put back the original timing' }));
    expect(edits()).toEqual([{ op: 'text.words', scene: 'S02', cue: 1, lines: ['Picture follows', 'to the *sound*.'] }]);
    expectOneValidStep(both);
  });

  it('refuses an eighth word, says why, and keeps nothing', () => {
    type('Line 2', 'to the sound of three loud beeps');
    expect(edits()).toEqual([]);
    expect(steps().canUndo).toBe(false);
    expect(screen.getByRole('alert').textContent).toBe('On-screen text can have at most seven words. This has 9.');
    expect(screen.getByText('9 of 7 words')).toBeTruthy();
    // What was typed is still there to be shortened.
    expect((screen.getByLabelText('Line 2') as HTMLInputElement).value).toBe('to the sound of three loud beeps');
    type('Line 2', 'to the sound of beeps');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(edits()).toEqual([{ op: 'text.words', scene: 'S02', cue: 1, lines: ['Picture fitted', 'to the sound of beeps'] }]);
  });

  it('refuses a time outside the scene, or an end before the start', () => {
    type('Goes off at (seconds)', '9');
    expect(screen.getByRole('alert').textContent).toBe('The text cannot stay on past the end of its scene (5.1s).');
    type('Goes off at (seconds)', '1');
    expect(screen.getByRole('alert').textContent).toBe('The text has to end after it starts.');
    type('Goes off at (seconds)', '');
    expect(screen.getByRole('alert').textContent).toBe('The text needs a start and an end time.');
    expect(edits()).toEqual([]);
    expect(steps().canUndo).toBe(false);
  });
});

describe('Inspector: a scene', () => {
  it('shows the scene read-only, and opens one of its texts', () => {
    act(() => ed.select({ kind: 'scene', scene: 'S02' }));
    expect(screen.getByRole('heading', { name: 'Scene 2' })).toBeTruthy();
    expect(screen.getByText('Picture follows sound')).toBeTruthy();
    expect(screen.getByText('0:03.50')).toBeTruthy();
    expect(screen.getByText('0:08.60')).toBeTruthy();
    expect(screen.getByText('5.1s')).toBeTruthy();
    expect(screen.getByText(/Three beeps stand in for three voice lines/)).toBeTruthy();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Three beeps.' }));
    expect(ed.stores.selection.getState().selection).toEqual({ kind: 'cue', scene: 'S02', cue: 0 });
    expect((screen.getByLabelText('Words') as HTMLInputElement).value).toBe('Three beeps.');
  });

  it('asks for a choice when nothing is selected', () => {
    act(() => ed.select(null));
    expect(screen.getByText('Choose a scene or an on-screen text to see it here.')).toBeTruthy();
  });
});
