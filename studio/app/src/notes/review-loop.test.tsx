// @vitest-environment jsdom
// Editor v2, phase B: the review loop (EDITOR-V2-PLAN.md). Quick reactions, notes over a stretch, the guided review,
// checking Claude's replies, and what the decision button says.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Batch } from '../api';
import { toDraftNote } from '../api/client';
import { sampleFilm } from '../fixtures/sample-film';
import { usePlayback } from '../playback';
import { shortcutStore } from '../shortcuts';
import { editor } from '../store';
import { useToasts } from '../ui';
import { addNoteInOrder } from './actions';
import { useComposer } from './composer';
import { decisionLabel } from './Decision';
import { GuideCard, guideGood, guideNext, stopGuide, toggleGuide, useGuide } from './Guide';
import { markSpan, react, REACTIONS } from './reactions';
import { Replies, useReplyMarks } from './Replies';

const notes = () => editor.stores.notes.getState().notes;
const at = (t: number) => act(() => { usePlayback.setState({ time: t }); });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}')));
  localStorage.clear();
  editor.stores.film.setState({ job: 'demo', status: 'ready', film: sampleFilm, filmModified: 1, batches: [] });
  editor.stores.notes.setState({ notes: [], goodScenes: [], previous: null });
  editor.stores.history.getState().clear();
  editor.select(null);
  usePlayback.getState().attachVideo(null);
  usePlayback.setState({ time: 0, playing: false, rate: 1, loop: null, duration: sampleFilm.duration, fps: 60 });
  useComposer.getState().clear();
  useGuide.setState({ status: 'off', index: 0, noted: false, notesAtAsk: 0 });
  useReplyMarks.setState({ marks: {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); shortcutStore.setState({ shortcuts: [] }); useToasts.setState({ toasts: [] }); });

describe('the decision button', () => {
  it('says the one next step: send, check replies, wait, or approve', () => {
    expect(decisionLabel({ notes: 2, good: 0, repliesToCheck: 3, waiting: true })).toMatchObject({ label: 'Send 2 notes', primary: true });
    expect(decisionLabel({ notes: 0, good: 1, repliesToCheck: 1, waiting: false })).toMatchObject({ label: 'Check 1 reply', primary: true });
    expect(decisionLabel({ notes: 0, good: 0, repliesToCheck: 0, waiting: true })).toMatchObject({ label: 'Waiting for the next version', primary: false });
    expect(decisionLabel({ notes: 0, good: 4, repliesToCheck: 0, waiting: false })).toMatchObject({ label: 'Approve version', primary: true });
  });
});

describe('notes over a stretch of time', () => {
  it('keep their end through adding, saving and reading back, and drop an end that is not after the start', () => {
    addNoteInOrder(editor, { time: 4, end: 6.25, text: 'Too slow', kind: 'change', topic: null, must: false, box: null });
    addNoteInOrder(editor, { time: 2, end: 1, text: 'One moment', kind: 'change', topic: null, must: false, box: null });
    expect(notes().map((n) => [n.time, n.end])).toEqual([[2, undefined], [4, 6.25]]);
    expect(editor.history.labels.undo).toBe('Add a note at 0:02');
    expect(toDraftNote({ time: 4, end: 6.25, text: 'x' }, 0).end).toBe(6.25);
    expect('end' in toDraftNote({ time: 4, end: 3, text: 'x' }, 0)).toBe(false);
    expect('end' in toDraftNote({ time: 4, text: 'x' }, 0)).toBe(false);
  });

  it('are marked with I and O from the playhead', () => {
    usePlayback.setState({ time: 5 });
    markSpan('start', sampleFilm.duration);
    expect(useComposer.getState().span).toEqual({ start: 5, end: 6 });
    usePlayback.setState({ time: 7.5 });
    markSpan('end', sampleFilm.duration);
    expect(useComposer.getState().span).toEqual({ start: 5, end: 7.5 });
  });
});

describe('quick reactions', () => {
  it('add a note in one press, over the marked stretch when there is one, and keep is a keep note', () => {
    usePlayback.setState({ time: 1.5 });
    react(REACTIONS[0]!);
    expect(notes()).toMatchObject([{ time: 1.5, kind: 'change', topic: 'Pacing', text: 'Too fast here. Give it more time to land.' }]);
    useComposer.getState().set({ span: { start: 9, end: 11 } });
    react(REACTIONS[3]!);
    expect(notes()[1]).toMatchObject({ time: 9, end: 11, kind: 'keep', must: false });
    expect(useComposer.getState().span).toBeNull();
    editor.history.undo();
    expect(notes()).toHaveLength(1);
  });
});

describe('review scene by scene', () => {
  it('starts at the first scene not marked good, stops at its end and asks', () => {
    editor.setSceneGood('S01', true);
    render(<GuideCard />);
    act(() => toggleGuide());
    expect(useGuide.getState()).toMatchObject({ status: 'watching', index: 1 });
    expect(usePlayback.getState().time).toBe(3.5);
    expect(screen.getByText(/Watching “Picture fitted to the sound”|Watching/)).toBeTruthy();
    at(8.59);
    expect(useGuide.getState().status).toBe('asking');
    expect(screen.getByRole('button', { name: /Looks good/ })).toBeTruthy();
  });

  it('a looks-good answer marks the scene and goes on; a note turns the answer into Next; the end says what is left', () => {
    render(<GuideCard />);
    act(() => toggleGuide());
    at(3.49);
    act(() => guideGood());
    expect(editor.stores.notes.getState().goodScenes).toEqual(['S01']);
    expect(useGuide.getState()).toMatchObject({ status: 'watching', index: 1 });
    at(8.6);
    act(() => { react(REACTIONS[1]!); });
    expect(useGuide.getState().noted).toBe(true);
    expect(screen.getByRole('button', { name: /Next scene/ })).toBeTruthy();
    act(() => guideNext());
    at(12.2);
    act(() => guideNext());
    expect(useGuide.getState().status).toBe('done');
    expect(screen.getByText(/That was the whole film/)).toBeTruthy();
    expect(screen.getByText(/1 note is waiting to send/)).toBeTruthy();
    act(() => stopGuide());
    expect(screen.queryByText(/That was the whole film/)).toBeNull();
  });
});

describe("checking Claude's replies", () => {
  const batch: Batch = {
    batch: 3, job: 'demo', video: 'preview.mp4', reviewer: 'Sam', sent_at: '2026-11-19T10:00:00Z', status: 'done', approved: false, good_scenes: [],
    notes: [
      { id: 'b003-n1', time: 1, scene: 'S01', scene_title: 'One', kind: 'change', topic: 'Pacing', must: false, text: 'Hold it longer', box: null, frame: null, resolved: true, reply: 'Held 0.5 s longer.' },
      { id: 'b003-n2', time: 5, end: 7, scene: 'S02', scene_title: 'Two', kind: 'change', topic: null, must: false, text: 'Too slow', box: null, frame: null, resolved: true, reply: 'Cut a second.' },
    ],
  };

  it('lists each reply; Fixed is remembered, Not yet puts the note back as must fix', () => {
    editor.stores.film.setState({ batches: [batch] });
    render(<Replies />);
    expect(screen.getByText('Held 0.5 s longer.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /Fixed/ })[0]!);
    expect(JSON.parse(localStorage.getItem('studio-editor:replies:demo:3') ?? '{}')).toEqual({ 'b003-n1': 'fixed' });
    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(notes()).toMatchObject([{ time: 5, end: 7, must: true, text: 'Still not right: Too slow' }]);
    expect(screen.getByText('2 of 2 checked.', { exact: false })).toBeTruthy();
  });

  it('shows nothing to check while the batch is still with Claude', () => {
    editor.stores.film.setState({ batches: [{ ...batch, status: 'picked up' }] });
    render(<Replies />);
    expect(screen.getByText('No replies to check.')).toBeTruthy();
  });
});
