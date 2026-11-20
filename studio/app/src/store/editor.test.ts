import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import type { Batch, Draft, EventsOptions, ExportRecord, StudioEvent } from '../api';
import type { Film } from '../contracts/film';
import type { Edit } from '../contracts/review';
import { sampleFilm } from '../fixtures/sample-film';
import { checkEdit } from './edits';
import { createEditor, STALE_MESSAGE, type Editor, type EditorApi, type StorageLike } from './editor';

/** A pretend studio server that keeps what it is given, like the real one keeps files on disk. */
function fakeStudio(film: Film = sampleFilm) {
  const disk = {
    film, filmModified: 1000, videos: [{ file: 'preview.mp4', modified: 500 }],
    draft: { notes: [], goodScenes: [] } as Draft, edits: [] as Edit[], editsFilm: 1000, batches: [] as Batch[], exports: [] as ExportRecord[],
  };
  const calls = { saveDraft: 0, saveEdits: 0 };
  let failing: ApiError | null = null;
  let listener: EventsOptions | null = null;
  const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  const api: EditorApi = {
    getFilm: async () => copy({ film: disk.film, videos: disk.videos, filmModified: disk.filmModified }),
    getReview: async () => copy({ draft: disk.draft, batches: disk.batches }),
    getEdits: async () => copy({ filmModified: disk.editsFilm, edits: disk.edits }),
    saveDraft: async (_job, draft) => { calls.saveDraft++; if (failing) throw failing; disk.draft = copy(draft); },
    saveEdits: async (_job, filmModified, edits) => {
      calls.saveEdits++;
      if (failing) throw failing;
      if (filmModified !== disk.filmModified) throw new ApiError('stale', 'The film has changed since these changes were made, so they were not saved. Reload the film to carry on.', { status: 409, filmModified: disk.filmModified });
      const problem = edits.map((e) => checkEdit(disk.film, e)).find(Boolean);
      if (problem) throw new ApiError('refused', problem, { status: 400, problems: [problem] });
      disk.edits = copy(edits); disk.editsFilm = filmModified;
    },
    sendBatch: async (job, request) => {
      const batch = { batch: disk.batches.length + 1, job, video: request.video, reviewer: request.reviewer, sent_at: '2026-11-18T10:00:00.000Z', status: 'sent', approved: request.approved, good_scenes: request.goodScenes, notes: [] } satisfies Batch;
      disk.batches.push(batch); disk.draft = { notes: [], goodScenes: [] };
      return copy(batch);
    },
    requestExport: async (job, request) => ({ ...request, export: 1, job, requested_at: '2026-11-18T10:00:00.000Z', status: 'requested' }),
    getExports: async () => copy(disk.exports),
    events: (_job, handlers) => { listener = handlers; handlers.onStatus?.('live'); return () => { listener = null; }; },
    mediaUrl: (job, file) => `/media/${job}/${file}`,
  };
  return { api, disk, calls, fail: (e: ApiError | null) => { failing = e; }, say: (e: StudioEvent) => listener?.onEvent(e), listening: () => listener !== null };
}
function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); } };
}
const snapshot = (e: Editor) => JSON.parse(JSON.stringify({ notes: e.stores.notes.getState(), edits: e.stores.edits.getState() })) as unknown;
let ids = 0;
const make = (studio: ReturnType<typeof fakeStudio>, storage: StorageLike | null = null) =>
  createEditor({ api: studio.api, storage, saveDelayMs: 800, retryDelayMs: 5000, newId: () => `id-${++ids}` });

beforeEach(() => { vi.useFakeTimers(); ids = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('opening a film', () => {
  it('loads the film, its versions, the notes and the edits', async () => {
    const studio = fakeStudio();
    studio.disk.draft = { notes: [{ localId: 'a', time: 4, kind: 'change', topic: null, must: false, text: 'Bigger', box: null }], goodScenes: ['S02'] };
    studio.disk.edits = [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['A film.'] }];
    const editor = make(studio);
    const statuses: string[] = [];
    editor.stores.film.subscribe((s) => { if (statuses.at(-1) !== s.status) statuses.push(s.status); });
    await editor.open('_sample');
    expect(statuses).toEqual(['loading', 'ready']);
    const film = editor.stores.film.getState();
    expect([film.status, film.job, film.video, film.filmModified, film.live]).toEqual(['ready', '_sample', 'preview.mp4', 1000, 'live']);
    expect(film.film).toEqual(sampleFilm);
    expect(editor.stores.notes.getState().notes).toHaveLength(1);
    expect(editor.stores.edits.getState()).toEqual({ edits: studio.disk.edits, filmModified: 1000 });
    expect(editor.stores.saving.getState()).toEqual({ notes: 'saved', edits: 'saved', message: null, stale: false });
    expect(editor.videoUrl()).toBe('/media/_sample/preview.mp4?v=500');
    await vi.advanceTimersByTimeAsync(5000);
    expect(studio.calls).toEqual({ saveDraft: 0, saveEdits: 0 });                 // loading is not a change
  });

  it('says in plain words why a film could not be opened', async () => {
    const studio = fakeStudio();
    studio.api.getFilm = async () => { throw new ApiError('not-found', 'This job has no film yet.', { status: 404 }); };
    const editor = make(studio);
    await editor.open('nope');
    expect(editor.stores.film.getState()).toMatchObject({ status: 'failed', message: 'This job has no film yet.' });
  });
});

describe('undo and redo', () => {
  /** Every kind of change the editor can make, each from a known starting point. */
  const commands: { name: string; label: string; setup?(e: Editor): void; run(e: Editor): void }[] = [
    { name: 'add a note', label: 'Add a note at 0:04', run: (e) => { e.addNote({ time: 4.2, text: 'Make this bigger', box: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }); } },
    { name: 'change a note', label: 'Change the note at 0:04', setup: (e) => { e.addNote({ time: 4.2, text: 'Old' }); }, run: (e) => e.changeNote('id-1', { text: 'New words', must: true, topic: 'text', kind: 'keep' }) },
    { name: 'move a note', label: 'Move the note to 0:09', setup: (e) => { e.addNote({ time: 4.2, text: 'Old' }); }, run: (e) => e.changeNote('id-1', { time: 9 }) },
    { name: 'remove a note', label: 'Remove the note at 1:05', setup: (e) => { e.addNote({ time: 1 }); e.addNote({ time: 65, text: 'Go' }); }, run: (e) => e.removeNote('id-2') },
    { name: 'mark a scene as good', label: 'Mark scene 2 as good', run: (e) => e.setSceneGood('S02', true) },
    { name: 'take a good mark off', label: 'Take the good mark off scene 2', setup: (e) => { e.setSceneGood('S01', true); e.setSceneGood('S02', true); }, run: (e) => e.setSceneGood('S02', false) },
    { name: 'bring back the notes from before', label: 'Bring back the notes from before',
      setup: (e) => { e.stores.notes.setState({ previous: { notes: [{ localId: 'old', time: 2, kind: 'change', topic: null, must: false, text: 'Earlier', box: null }], goodScenes: ['S03'] } }); e.addNote({ time: 5 }); },
      run: (e) => { e.restorePreviousDraft(); } },
    { name: 'change the words', label: 'Change the words in scene 2', run: (e) => { expect(e.setCueWords('S02', 1, ['Picture meets', 'the *sound*.'])).toEqual({ ok: true }); } },
    { name: 'change the words again', label: 'Change the words in scene 1', setup: (e) => { e.setCueWords('S01', 0, ['First try.']); }, run: (e) => { e.setCueWords('S01', 0, ['Second try.']); } },
    { name: 'move the text', label: 'Move the text in scene 2', setup: (e) => { e.setCueWords('S02', 0, ['Beeps.']); }, run: (e) => { expect(e.setCueTime('S02', 0, 0.5, 2)).toEqual({ ok: true }); } },
    { name: 'put the words back by typing them', label: 'Change the words in scene 1', setup: (e) => { e.setCueWords('S01', 0, ['Other.']); }, run: (e) => { e.setCueWords('S01', 0, ['A *sample* film.']); } },
    { name: 'put a text back', label: 'Put back the original text in scene 2', setup: (e) => { e.setCueWords('S02', 0, ['Beeps.']); e.setCueTime('S02', 0, 0.5, 2); e.setCueTime('S02', 1, 3, 4); }, run: (e) => e.resetCue('S02', 0) },
    { name: 'put only the timing back', label: 'Put back the original timing in scene 2', setup: (e) => { e.setCueWords('S02', 0, ['Beeps.']); e.setCueTime('S02', 0, 0.5, 2); }, run: (e) => e.resetCue('S02', 0, 'time') },
  ];

  for (const c of commands) {
    it(`${c.name}: undo then redo gives back exactly the same state`, async () => {
      const editor = make(fakeStudio());
      await editor.open('_sample');
      c.setup?.(editor);
      vi.advanceTimersByTime(2000);                       // so the change is its own step, not joined to the setup
      const before = snapshot(editor);
      c.run(editor);
      const after = snapshot(editor);
      expect(after).not.toEqual(before);
      expect(editor.history.labels.undo).toBe(c.label);

      editor.history.undo();
      expect(snapshot(editor)).toEqual(before);
      expect(editor.history.labels.redo).toBe(c.label);
      editor.history.redo();
      expect(snapshot(editor)).toEqual(after);
      editor.history.undo(); editor.history.redo(); editor.history.undo();
      expect(snapshot(editor)).toEqual(before);
    });
  }

  it('walks back and forward through a whole session', async () => {
    const editor = make(fakeStudio());
    await editor.open('_sample');
    const states = [snapshot(editor)];
    const steps: (() => void)[] = [
      () => { editor.addNote({ time: 1, text: 'One' }); },
      () => { editor.setCueWords('S03', 0, ['New words.']); },
      () => editor.setSceneGood('S01', true),
      () => editor.changeNote('id-1', { must: true }),
      () => { editor.setCueTime('S01', 0, 0.5, 3); },
      () => editor.removeNote('id-1'),
    ];
    for (const step of steps) { step(); vi.advanceTimersByTime(2000); states.push(snapshot(editor)); }
    for (let i = steps.length - 1; i >= 0; i--) { editor.history.undo(); expect(snapshot(editor)).toEqual(states[i]); }
    expect(editor.history.canUndo).toBe(false);
    for (let i = 1; i <= steps.length; i++) { editor.history.redo(); expect(snapshot(editor)).toEqual(states[i]); }
    expect(editor.history.canRedo).toBe(false);
  });

  it('undoes a burst of typing as one step', async () => {
    const editor = make(fakeStudio());
    await editor.open('_sample');
    const id = editor.addNote({ time: 3 });
    vi.advanceTimersByTime(2000);
    for (const text of ['M', 'Ma', 'Mak', 'Make it pop']) { editor.changeNote(id, { text }); vi.advanceTimersByTime(100); }
    for (const lines of [['N'], ['Ne'], ['New']]) { editor.setCueWords('S01', 0, lines); vi.advanceTimersByTime(100); }
    editor.history.undo();
    expect(editor.stores.edits.getState().edits).toEqual([]);
    expect(editor.stores.notes.getState().notes[0]?.text).toBe('Make it pop');
    editor.history.undo();
    expect(editor.stores.notes.getState().notes[0]?.text).toBe('');
    editor.history.redo(); editor.history.redo();
    expect(editor.stores.edits.getState().edits).toEqual([{ op: 'text.words', scene: 'S01', cue: 0, lines: ['New'] }]);
  });

  it('refuses an edit that breaks a rule, says why, and records nothing', async () => {
    const editor = make(fakeStudio());
    await editor.open('_sample');
    expect(editor.setCueWords('S01', 0, ['one two three four', 'five six seven eight'])).toEqual({ ok: false, problem: 'On-screen text can have at most seven words. This has 8.' });
    expect(editor.setCueTime('S01', 0, 1, 9)).toEqual({ ok: false, problem: 'The text cannot stay on past the end of its scene (3.5s).' });
    expect(editor.setCueTime('S01', 0, 2, 2)).toEqual({ ok: false, problem: 'The text has to end after it starts.' });
    expect(editor.setCueWords('S09', 0, ['Hi'])).toMatchObject({ ok: false });
    expect(editor.setCueWords('S01', 3, ['Hi'])).toMatchObject({ ok: false });
    expect(editor.stores.edits.getState().edits).toEqual([]);
    expect(editor.history.canUndo).toBe(false);
  });
});

describe('autosave', () => {
  it('saves once, a little after the last change, and shows each state on the way', async () => {
    const studio = fakeStudio(); const editor = make(studio);
    await editor.open('_sample');
    const seen: string[] = [];
    editor.stores.saving.subscribe((s) => { if (seen.at(-1) !== s.notes) seen.push(s.notes); });
    const id = editor.addNote({ time: 1 });
    await vi.advanceTimersByTimeAsync(500);
    editor.changeNote(id, { text: 'Bigger' });
    await vi.advanceTimersByTimeAsync(799);
    expect(studio.calls.saveDraft).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(studio.calls.saveDraft).toBe(1);
    expect(studio.disk.draft.notes).toEqual(editor.stores.notes.getState().notes);
    expect(seen).toEqual(['unsaved', 'saving', 'saved']);

    editor.history.undo();                                                        // undo is a change to save too
    await vi.advanceTimersByTimeAsync(800);
    expect(studio.disk.draft.notes[0]?.text).toBe('');
    editor.setCueWords('S01', 0, ['New words.']);
    expect(editor.stores.saving.getState().edits).toBe('unsaved');
    await vi.advanceTimersByTimeAsync(800);
    expect(studio.disk.edits).toEqual([{ op: 'text.words', scene: 'S01', cue: 0, lines: ['New words.'] }]);
    expect(editor.stores.saving.getState()).toEqual({ notes: 'saved', edits: 'saved', message: null, stale: false });
  });

  it('shows a failed save in plain words, tries again, and recovers', async () => {
    const studio = fakeStudio(); const editor = make(studio);
    await editor.open('_sample');
    studio.fail(new ApiError('offline', 'The studio is not answering. Check that it is still running on this computer, then try again.'));
    editor.addNote({ time: 1, text: 'Keep me' });
    await vi.advanceTimersByTimeAsync(800);
    expect(editor.stores.saving.getState()).toMatchObject({ notes: 'failed', message: 'Your notes are not saved yet. The studio is not answering. Check that it is still running on this computer, then try again.' });
    studio.fail(null);
    await vi.advanceTimersByTimeAsync(5000);
    expect(editor.stores.saving.getState()).toMatchObject({ notes: 'saved', message: null });
    expect(studio.disk.draft.notes[0]?.text).toBe('Keep me');
  });

  it('does not lose a change made while a save is on its way', async () => {
    const studio = fakeStudio(); const editor = make(studio);
    await editor.open('_sample');
    let release = () => {};
    const real = studio.api.saveDraft;
    studio.api.saveDraft = async (job, draft) => { await new Promise<void>((r) => { release = r; }); await real(job, draft); };
    const id = editor.addNote({ time: 1, text: 'First' });
    await vi.advanceTimersByTimeAsync(800);
    expect(editor.stores.saving.getState().notes).toBe('saving');
    editor.changeNote(id, { text: 'Second' });
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(studio.disk.draft.notes[0]?.text).toBe('First');
    expect(editor.stores.saving.getState().notes).toBe('unsaved');
    await vi.advanceTimersByTimeAsync(800); release(); await vi.advanceTimersByTimeAsync(0);
    expect(studio.disk.draft.notes[0]?.text).toBe('Second');
    expect(editor.stores.saving.getState().notes).toBe('saved');
  });

  it('survives a reload in the middle of an edit', async () => {
    const studio = fakeStudio(); const storage = fakeStorage();
    const first = make(studio, storage);
    await first.open('_sample');
    first.addNote({ time: 4.2, text: 'Typed a moment before the reload', must: true });
    first.setSceneGood('S03', true);
    first.setCueWords('S02', 0, ['Three loud beeps.']);
    first.setCueTime('S02', 1, 2.5, 5);
    await vi.advanceTimersByTimeAsync(300);                                       // the save has not happened yet
    expect(studio.calls).toEqual({ saveDraft: 0, saveEdits: 0 });
    const typed = snapshot(first);

    // The reload: the page and everything in memory are gone. Only the browser's storage and the server remain.
    const second = make(studio, storage);
    await second.open('_sample');
    expect(snapshot(second)).toEqual(typed);
    expect(second.stores.saving.getState()).toMatchObject({ notes: 'unsaved', edits: 'unsaved' });
    await vi.advanceTimersByTimeAsync(800);                                       // and the interrupted save is finished
    expect(studio.disk.draft.notes[0]?.text).toBe('Typed a moment before the reload');
    expect(studio.disk.draft.goodScenes).toEqual(['S03']);
    expect(studio.disk.edits).toHaveLength(2);
    expect(second.stores.saving.getState()).toEqual({ notes: 'saved', edits: 'saved', message: null, stale: false });

    // A reload after everything was saved takes the server's copy, even if another page changed it since.
    studio.disk.draft = { notes: [], goodScenes: ['S01'] };
    const third = make(studio, storage);
    await third.open('_sample');
    expect(third.stores.notes.getState()).toMatchObject({ notes: [], goodScenes: ['S01'] });
    expect(third.stores.edits.getState().edits).toHaveLength(2);
  });

  it('still works when the browser will not store anything', async () => {
    const studio = fakeStudio();
    const broken: StorageLike = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    const editor = make(studio, broken);
    await editor.open('_sample');
    editor.addNote({ time: 1, text: 'Still saved' });
    await editor.flush();
    expect(studio.disk.draft.notes[0]?.text).toBe('Still saved');
  });
});

describe('when the film changes under the edits', () => {
  it('turns the 409 into a clear message, offers a reload, and carries over what still fits', async () => {
    const studio = fakeStudio(); const editor = make(studio);
    await editor.open('_sample');
    editor.setCueWords('S01', 0, ['Kept words.']);
    await vi.advanceTimersByTimeAsync(800);
    expect(studio.disk.edits).toHaveLength(1);

    // Claude renders again: scene 2 loses its second on-screen text and gets shorter.
    studio.disk.film = { ...sampleFilm, scenes: sampleFilm.scenes.map((s) => (s.id === 'S02' ? { ...s, texts: s.texts.slice(0, 1) } : s)) };
    studio.disk.filmModified = 2000;
    vi.advanceTimersByTime(2000);
    editor.setCueWords('S02', 1, ['Will not fit.']);
    await vi.advanceTimersByTimeAsync(800);
    expect(editor.stores.saving.getState()).toEqual({ notes: 'saved', edits: 'failed', message: STALE_MESSAGE, stale: true });
    expect(STALE_MESSAGE).toMatch(/Reload the film/);
    expect(studio.disk.edits).toHaveLength(1);                                    // nothing stale was written
    expect(editor.setCueWords('S03', 0, ['More.'])).toEqual({ ok: false, problem: 'The film has changed. Reload it before changing more text.' });
    await vi.advanceTimersByTimeAsync(60000);
    expect(studio.calls.saveEdits).toBe(2);                                       // it does not keep knocking

    const result = await editor.reloadFilm();
    expect(result).toEqual({ kept: 1, dropped: 1, message: 'One of your text changes no longer fits the new film and was left out.' });
    expect(editor.stores.film.getState().filmModified).toBe(2000);
    expect(editor.stores.edits.getState()).toEqual({ edits: [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['Kept words.'] }], filmModified: 2000 });
    expect(editor.stores.saving.getState().stale).toBe(false);
    expect(editor.history.canUndo).toBe(false);
    await vi.advanceTimersByTimeAsync(800);
    expect(studio.disk.editsFilm).toBe(2000);
    expect(editor.stores.saving.getState()).toEqual({ notes: 'saved', edits: 'saved', message: null, stale: false });
    expect(editor.setCueWords('S03', 0, ['More.'])).toEqual({ ok: true });
  });

  it('notices on opening that saved edits belong to an older film', async () => {
    const studio = fakeStudio();
    studio.disk.edits = [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['Old.'] }]; studio.disk.editsFilm = 900;
    const editor = make(studio);
    await editor.open('_sample');
    expect(editor.stores.saving.getState()).toMatchObject({ stale: true, message: STALE_MESSAGE });
    expect(await editor.reloadFilm()).toEqual({ kept: 1, dropped: 0, message: null });
    await vi.advanceTimersByTimeAsync(800);
    expect(studio.disk.editsFilm).toBe(1000);
  });
});

describe('live events', () => {
  it('shows a new version, a render and a changed batch without a reload', async () => {
    const studio = fakeStudio(); const editor = make(studio);
    await editor.open('_sample');
    studio.say({ type: 'rendering', active: true, elapsed: 12 });
    expect(editor.stores.film.getState().rendering).toEqual({ active: true, elapsed: 12, scene: null, of: null });
    studio.say({ type: 'render', scene: 4, of: 9 });
    expect(editor.stores.film.getState().rendering).toEqual({ active: true, elapsed: 12, scene: 4, of: 9 });
    studio.say({ type: 'rendering', active: false, elapsed: 0 });
    expect(editor.stores.film.getState().rendering.active).toBe(false);

    studio.disk.videos = [{ file: 'v2.mp4', modified: 900 }, { file: 'preview.mp4', modified: 500 }]; studio.disk.filmModified = 3000;
    studio.say({ type: 'version', file: 'v2.mp4' });
    await vi.advanceTimersByTimeAsync(0);
    const film = editor.stores.film.getState();
    expect([film.videos.length, film.video, film.newVersion, film.filmModified]).toEqual([2, 'preview.mp4', 'v2.mp4', 3000]);
    expect(editor.stores.saving.getState().stale).toBe(false);                    // no pending edits, so nothing is in the way
    expect(editor.stores.edits.getState().filmModified).toBe(3000);
    editor.chooseVideo('v2.mp4');
    expect(editor.stores.film.getState()).toMatchObject({ video: 'v2.mp4', newVersion: null });

    studio.disk.batches = [{ batch: 1, job: '_sample', video: null, reviewer: null, sent_at: '', status: 'done', approved: false, good_scenes: [], notes: [] }];
    studio.say({ type: 'batch', n: 1, status: 'done' });
    await vi.advanceTimersByTimeAsync(0);
    expect(editor.stores.film.getState().batches[0]?.status).toBe('done');

    await editor.close();
    expect(studio.listening()).toBe(false);
  });
});

describe('sending and exporting', () => {
  it('sends the notes, empties the draft and can bring the notes back', async () => {
    const studio = fakeStudio(); const storage = fakeStorage(); const editor = make(studio, storage);
    await editor.open('_sample');
    editor.addNote({ time: 2, text: 'Bigger logo' }); editor.setSceneGood('S01', true);
    editor.select({ kind: 'note', localId: 'id-1' });
    const batch = await editor.send({ reviewer: 'Sam' });
    expect(batch).toMatchObject({ batch: 1, reviewer: 'Sam', video: 'preview.mp4', good_scenes: ['S01'] });
    expect(editor.stores.notes.getState()).toMatchObject({ notes: [], goodScenes: [] });
    expect(editor.stores.film.getState().batches).toHaveLength(1);
    expect(editor.stores.selection.getState().selection).toBeNull();
    expect(editor.history.canUndo).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(studio.calls.saveDraft).toBe(0);                                       // the server emptied the draft itself

    const after = make(studio, storage);                                          // even after a reload
    await after.open('_sample');
    expect(after.restorePreviousDraft()).toBe(true);
    expect(after.stores.notes.getState().notes.map((n) => n.text)).toEqual(['Bigger logo']);
    expect(after.stores.notes.getState().goodScenes).toEqual(['S01']);
    expect(after.restorePreviousDraft()).toBe(false);
    after.history.undo();
    expect(after.stores.notes.getState().notes).toEqual([]);
  });

  it('asks for an export', async () => {
    const editor = make(fakeStudio());
    await editor.open('_sample');
    expect(await editor.requestExport({ ratio: '9:16', height: 1080, quality: 'master' })).toMatchObject({ export: 1, ratio: '9:16', status: 'requested' });
  });
});

describe('exports', () => {
  const ask = { ratio: '9:16', height: 1080, quality: 'master' } as const;
  it('shows an export as requested, then running, then done with its file, and a failure with its message', async () => {
    const studio = fakeStudio(); const editor = make(studio);
    await editor.open('_sample');
    expect(editor.stores.film.getState().exports).toEqual([]);
    await editor.requestExport(ask);
    expect(editor.stores.film.getState().exports).toEqual([{ export: 1, ratio: '9:16', height: 1080, quality: 'master', status: 'requested' }]);
    studio.say({ type: 'export', n: 1, status: 'running' });
    expect(editor.stores.film.getState().exports[0]?.status).toBe('running');
    studio.say({ type: 'export', n: 1, status: 'done', file: 'export-001-9x16-1080.mp4' });
    expect(editor.stores.film.getState().exports[0]).toMatchObject({ status: 'done', file: 'export-001-9x16-1080.mp4' });
    expect(editor.exportUrl('export-001-9x16-1080.mp4')).toBe('/media/_sample/export-001-9x16-1080.mp4');

    studio.say({ type: 'export', n: 1, status: 'failed', error: 'The render did not finish, so nothing was exported.' });
    const failed = editor.stores.film.getState().exports[0];
    expect(failed).toMatchObject({ status: 'failed', error: 'The render did not finish, so nothing was exported.' });
    expect(failed?.file).toBeUndefined();
  });
  it('reads the exports already asked for when a film opens, and an unknown one from the studio', async () => {
    const studio = fakeStudio();
    studio.disk.exports = [{ export: 1, ratio: '1:1', height: 720, quality: 'preview', status: 'running' }];
    const editor = make(studio);
    await editor.open('_sample');
    expect(editor.stores.film.getState().exports.map((x) => x.status)).toEqual(['running']);
    studio.disk.exports = [{ ...studio.disk.exports[0]!, status: 'done', file: 'a.mp4' }, { export: 2, ratio: '16:9', height: 720, quality: 'preview', status: 'requested' }];
    studio.say({ type: 'export', n: 2, status: 'requested' });
    await vi.advanceTimersByTimeAsync(0);
    expect(editor.stores.film.getState().exports.map((x) => x.status)).toEqual(['done', 'requested']);
  });
});
