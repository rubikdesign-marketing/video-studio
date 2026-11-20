import { createStore, type StoreApi } from 'zustand/vanilla';
import { ApiError, isApiError, plainMessage } from '../api';
import type { Batch, Draft, EventsStatus, ExportReceipt, ExportRecord, StudioClient, StudioEvent } from '../api';
import type { Film, Seconds, VideoVersion } from '../contracts/film';
import type { Box, DraftNote, Edit, ExportRequest, NoteKind } from '../contracts/review';
import type { Command, History, Selection } from '../contracts/store';
import { changesNothing, checkEdit, dropEdits, putEdit, sceneNumber } from './edits';
import { createHistory, liveHistory, type HistoryState } from './history';
import { createSaver, type SaveStatus } from './saver';

// ---------------------------------------------------------------- what the stores hold

export interface RenderingState {
  active: boolean;
  /** Seconds since the render began. */
  elapsed: Seconds;
  /** Scene-by-scene progress, when the render tools report it. They do not today, so these are null. */
  scene: number | null;
  of: number | null;
}
export interface FilmState {
  job: string | null;
  status: 'empty' | 'loading' | 'ready' | 'failed';
  /** When `status` is `failed`: why, in plain words. */
  message: string | null;
  film: Film | null;
  /** When film.json last changed. Edits are saved against it. */
  filmModified: number;
  /** Rendered versions, newest first. */
  videos: VideoVersion[];
  /** The version being watched. */
  video: string | null;
  /** Batches of notes sent so far, oldest first. */
  batches: Batch[];
  rendering: RenderingState;
  /** Exports asked for, oldest first, kept current by the live events. */
  exports: ExportRecord[];
  /** The live connection to the studio. */
  live: EventsStatus;
  /** Set when a version arrived while the page was open, until `chooseVideo` is called. */
  newVersion: string | null;
}
export interface SelectionState { selection: Selection; select(selection: Selection): void }
export interface NotesState {
  notes: DraftNote[];
  goodScenes: string[];
  /** The notes of the last batch sent, kept so they can be brought back. */
  previous: Draft | null;
}
export interface EditsState {
  /** The pending direct changes: at most one for the words and one for the timing of each on-screen text. */
  edits: Edit[];
  /** The film these edits were made against. */
  filmModified: number;
}
export interface SavingState {
  notes: SaveStatus;
  edits: SaveStatus;
  /** Why something is not saved, in plain words. Null when all is well. */
  message: string | null;
  /** True when the film changed under the pending edits. Offer "Reload the film" (`reloadFilm`). */
  stale: boolean;
}
/** What an action that can be refused gives back. `problem` is a plain sentence. */
export type Outcome = { ok: true } | { ok: false; problem: string };

export interface NewNote { time: Seconds; text?: string; kind?: NoteKind; topic?: string | null; must?: boolean; box?: Box | null }
export type NotePatch = Partial<Omit<DraftNote, 'localId'>>;

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type EditorApi = Pick<StudioClient, 'getFilm' | 'getReview' | 'saveDraft' | 'sendBatch' | 'getEdits' | 'saveEdits' | 'requestExport' | 'getExports' | 'events' | 'mediaUrl'>;
export interface EditorOptions {
  api: EditorApi;
  /** Where unsaved work is kept between a change and its save, so a reload loses nothing. The browser's localStorage. */
  storage?: StorageLike | null;
  /** How long after the last change the work is saved, in ms. */
  saveDelayMs?: number;
  /** How long to wait before trying a failed save again, in ms. */
  retryDelayMs?: number;
  newId?: () => string;
  now?: () => number;
}

export const STALE_MESSAGE = 'The film was rendered again while you were working, so your text changes are not saved yet. Reload the film to carry on.';

const idle: RenderingState = { active: false, elapsed: 0, scene: null, of: null };
const emptyFilm: FilmState = { job: null, status: 'empty', message: null, film: null, filmModified: 0, videos: [], video: null, batches: [], rendering: idle, exports: [], live: 'closed', newVersion: null };
const clock = (t: Seconds) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
let made = 0;
const defaultId = () => `note-${Date.now().toString(36)}-${(++made).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface Backup { v: 1; notes: DraftNote[]; goodScenes: string[]; previous: Draft | null; notesDirty: boolean; edits: Edit[]; filmModified: number; editsDirty: boolean }

// ---------------------------------------------------------------- the editor's state and everything that changes it

export function createEditor(options: EditorOptions) {
  const { api } = options;
  const storage = options.storage ?? null;
  const saveDelayMs = options.saveDelayMs ?? 800;
  const retryDelayMs = options.retryDelayMs ?? 5000;
  const newId = options.newId ?? defaultId;

  const film = createStore<FilmState>(() => emptyFilm);
  const selection = createStore<SelectionState>((set) => ({ selection: null, select: (s) => set({ selection: s }) }));
  const notes = createStore<NotesState>(() => ({ notes: [], goodScenes: [], previous: null }));
  const edits = createStore<EditsState>(() => ({ edits: [], filmModified: 0 }));
  const saving = createStore<SavingState>(() => ({ notes: 'saved', edits: 'saved', message: null, stale: false }));
  const historyStore = createHistory({ now: options.now });

  let quiet = false;                 // true while the stores are filled from the server: that is not a change to save
  let opened = 0;                    // which `open` is the current one, so a slow answer for an old job is dropped
  let stopEvents: (() => void) | null = null;
  const silently = (work: () => void) => { quiet = true; try { work(); } finally { quiet = false; } };
  const job = () => {
    const j = film.getState().job;
    if (!j) throw new ApiError('failed', 'Open a film first.');
    return j;
  };

  // -------------------------------------------------------------- saving
  const setStatus = (which: 'notes' | 'edits', status: SaveStatus) => {
    const next = { ...saving.getState(), [which]: status };
    if (next.notes === 'saved' && next.edits === 'saved' && !next.stale) next.message = null;
    saving.setState(next);
    backup();
  };
  const notesSaver = createSaver({
    delayMs: saveDelayMs,
    save: async () => { const s = notes.getState(); await api.saveDraft(job(), { notes: s.notes, goodScenes: s.goodScenes }); },
    onStatus: (s) => setStatus('notes', s),
    onError: (e) => { saving.setState({ message: `Your notes are not saved yet. ${plainMessage(e)}` }); return retryDelayMs; },
  });
  const editsSaver = createSaver({
    delayMs: saveDelayMs,
    save: async () => { const s = edits.getState(); await api.saveEdits(job(), s.filmModified, s.edits); },
    onStatus: (s) => setStatus('edits', s),
    onError: (e) => {
      if (isApiError(e) && e.kind === 'stale') { saving.setState({ stale: true, message: STALE_MESSAGE }); return null; }
      saving.setState({ message: `Your text changes are not saved yet. ${plainMessage(e)}` });
      return isApiError(e) && e.kind === 'refused' ? null : retryDelayMs;
    },
  });

  const key = (j: string) => `studio-editor:${j}`;
  /** Keeps a copy in the browser on every change, marked with what the server does not have yet. */
  function backup() {
    const j = film.getState().job;
    if (!storage || !j || film.getState().status !== 'ready') return;
    const n = notes.getState(); const e = edits.getState();
    const copy: Backup = { v: 1, notes: n.notes, goodScenes: n.goodScenes, previous: n.previous, notesDirty: notesSaver.dirty, edits: e.edits, filmModified: e.filmModified, editsDirty: editsSaver.dirty };
    try { storage.setItem(key(j), JSON.stringify(copy)); } catch { /* storage full or switched off: the server copy still saves */ }
  }
  function readBackup(j: string): Backup | null {
    if (!storage) return null;
    try {
      const b = JSON.parse(storage.getItem(key(j)) ?? 'null') as Backup | null;
      return b && b.v === 1 && Array.isArray(b.notes) && Array.isArray(b.goodScenes) && Array.isArray(b.edits) ? b : null;
    } catch { return null; }
  }
  notes.subscribe((s, p) => {
    if (quiet) return;
    if (s.notes !== p.notes || s.goodScenes !== p.goodScenes) notesSaver.touch();
    backup();
  });
  edits.subscribe((s, p) => {
    if (quiet) return;
    if (s.edits !== p.edits || s.filmModified !== p.filmModified) editsSaver.touch();
    backup();
  });

  // -------------------------------------------------------------- opening a film, and keeping up with it
  const markStale = () => saving.setState({ stale: true, message: STALE_MESSAGE });
  const dropLostSelection = () => {
    const sel = selection.getState().selection; const f = film.getState().film;
    if (!sel) return;
    const scene = sel.kind === 'note' ? null : f?.scenes.find((s) => s.id === sel.scene);
    const gone = sel.kind === 'note' ? !notes.getState().notes.some((n) => n.localId === sel.localId)
      : !scene || (sel.kind === 'cue' && sel.cue >= scene.texts.length);
    if (gone) selection.setState({ selection: null });
  };

  /** Opens a job: its film, the notes being written, the pending edits, and the live connection. */
  async function open(jobName: string): Promise<void> {
    await close();
    const mine = ++opened;
    silently(() => {
      film.setState({ ...emptyFilm, job: jobName, status: 'loading' });
      notes.setState({ notes: [], goodScenes: [], previous: null });
      edits.setState({ edits: [], filmModified: 0 });
      saving.setState({ notes: 'saved', edits: 'saved', message: null, stale: false });
      selection.setState({ selection: null });
    });
    notesSaver.settle(); editsSaver.settle(); historyStore.getState().clear();
    try {
      const [f, review, saved, exports] = await Promise.all([api.getFilm(jobName), api.getReview(jobName), api.getEdits(jobName), api.getExports(jobName).catch(() => [] as ExportRecord[])]);
      if (mine !== opened) return;
      const kept = readBackup(jobName);
      const pending = kept?.editsDirty ? { edits: kept.edits, filmModified: kept.filmModified } : saved;
      silently(() => {
        notes.setState(kept?.notesDirty
          ? { notes: kept.notes, goodScenes: kept.goodScenes, previous: kept.previous }
          : { notes: review.draft.notes, goodScenes: review.draft.goodScenes, previous: kept?.previous ?? null });
        edits.setState({ edits: pending.edits, filmModified: pending.edits.length ? pending.filmModified : f.filmModified });
        film.setState({ status: 'ready', film: f.film, filmModified: f.filmModified, videos: f.videos, video: f.videos[0]?.file ?? null, batches: review.batches, exports });
      });
      if (kept?.notesDirty) notesSaver.touch();                      // finish the save a reload cut short
      if (edits.getState().filmModified !== f.filmModified) markStale();
      else if (kept?.editsDirty) editsSaver.touch();
      backup();
      stopEvents = api.events(jobName, {
        onStatus: (live) => { if (mine === opened) film.setState({ live }); },
        onEvent: (e) => {
          if (mine !== opened) return;
          if (e.type === 'version') { film.setState({ newVersion: e.file }); void refreshFilm().catch(() => {}); }
          else if (e.type === 'batch') void refreshBatches().catch(() => {});
          else if (e.type === 'export') onExportEvent(e);
          else if (e.type === 'rendering') film.setState({ rendering: e.active ? { active: true, elapsed: e.elapsed, scene: null, of: null } : idle });
          else film.setState({ rendering: { active: true, elapsed: film.getState().rendering.elapsed, scene: e.scene, of: e.of } });
        },
      });
    } catch (e) {
      if (mine === opened) film.setState({ status: 'failed', message: plainMessage(e) });
    }
  }

  /** Saves what is waiting and stops listening. */
  async function close(): Promise<void> {
    stopEvents?.(); stopEvents = null;
    if (film.getState().job) await flush().catch(() => {});
    opened++;
  }

  /** Reads the film and its versions again without touching the pending edits. Runs by itself when a version arrives. */
  async function refreshFilm(): Promise<void> {
    const mine = opened;
    const f = await api.getFilm(job());
    if (mine !== opened) return;
    const watching = film.getState().video;
    film.setState({ film: f.film, filmModified: f.filmModified, videos: f.videos, video: f.videos.some((v) => v.file === watching) ? watching : f.videos[0]?.file ?? null });
    const e = edits.getState();
    if (e.filmModified !== f.filmModified) {
      if (e.edits.length) markStale();
      else silently(() => edits.setState({ filmModified: f.filmModified }));
    }
    dropLostSelection();
  }
  async function refreshBatches(): Promise<void> {
    const mine = opened;
    const review = await api.getReview(job());
    if (mine === opened) film.setState({ batches: review.batches });
  }

  /**
   * The answer to "the film has changed": reads the new film and carries over every pending edit that still fits it.
   * Edits that no longer fit are left out, and `message` says how many. Undo history starts again.
   */
  async function reloadFilm(): Promise<{ kept: number; dropped: number; message: string | null }> {
    const f = await api.getFilm(job());
    const before = edits.getState().edits;
    const keep = before.filter((e) => checkEdit(f.film, e) === null && !changesNothing(f.film, e));
    const dropped = before.length - keep.length;
    const watching = film.getState().video;
    film.setState({ film: f.film, filmModified: f.filmModified, videos: f.videos, video: f.videos.some((v) => v.file === watching) ? watching : f.videos[0]?.file ?? null });
    historyStore.getState().clear();
    saving.setState({ stale: false, message: null });
    edits.setState({ edits: dropped ? keep : before, filmModified: f.filmModified });
    if (editsSaver.dirty) editsSaver.touch();
    dropLostSelection();
    const message = !dropped ? null : dropped === 1 ? 'One of your text changes no longer fits the new film and was left out.' : `${dropped} of your text changes no longer fit the new film and were left out.`;
    return { kept: keep.length, dropped, message };
  }

  function chooseVideo(file: string) {
    if (film.getState().videos.some((v) => v.file === file)) film.setState({ video: file, newVersion: null });
  }
  /** The address of the version being watched, for a video element. It changes when the file is rendered again. */
  function videoUrl(): string | null {
    const f = film.getState(); const v = f.videos.find((x) => x.file === f.video);
    return f.job && v ? `${api.mediaUrl(f.job, v.file)}?v=${Math.round(v.modified)}` : null;
  }

  // -------------------------------------------------------------- notes: every change is a step in the history
  type NotesSlice = Pick<NotesState, 'notes' | 'goodScenes' | 'previous'>;
  function changeNotes(label: string, change: Partial<NotesSlice>, mergeKey?: string) {
    const s = notes.getState();
    const before: NotesSlice = { notes: s.notes, goodScenes: s.goodScenes, previous: s.previous };
    const after: NotesSlice = { ...before, ...change };
    const command: Command = { label, do: () => notes.setState(after), undo: () => notes.setState(before) };
    if (mergeKey) historyStore.getState().runMerged(mergeKey, command); else historyStore.getState().run(command);
  }

  /** Adds a note and returns its id. */
  function addNote(note: NewNote): string {
    const made: DraftNote = { localId: newId(), time: note.time, kind: note.kind ?? 'change', topic: note.topic ?? null, must: note.must ?? false, text: note.text ?? '', box: note.box ?? null };
    changeNotes(`Add a note at ${clock(made.time)}`, { notes: [...notes.getState().notes, made] });
    return made.localId;
  }
  /** Changes a note. Changes to the same fields made in quick succession (typing) undo as one step. */
  function changeNote(localId: string, patch: NotePatch): void {
    const all = notes.getState().notes; const note = all.find((n) => n.localId === localId);
    if (!note) return;
    const fields = (Object.keys(patch) as (keyof NotePatch)[]).filter((k) => patch[k] !== undefined && JSON.stringify(patch[k]) !== JSON.stringify(note[k]));
    if (!fields.length) return;
    const next = { ...note, ...patch, localId };
    const label = fields.length === 1 && fields[0] === 'time' ? `Move the note to ${clock(next.time)}` : `Change the note at ${clock(note.time)}`;
    changeNotes(label, { notes: all.map((n) => (n === note ? next : n)) }, `note:${localId}:${fields.sort().join(',')}`);
  }
  function removeNote(localId: string): void {
    const all = notes.getState().notes; const note = all.find((n) => n.localId === localId);
    if (!note) return;
    changeNotes(`Remove the note at ${clock(note.time)}`, { notes: all.filter((n) => n !== note) });
    dropLostSelection();
  }
  /** Marks a scene as good, or takes the mark off. */
  function setSceneGood(sceneId: string, good: boolean): void {
    const current = notes.getState().goodScenes;
    if (current.includes(sceneId) === good) return;
    const n = sceneNumber(film.getState().film, sceneId);
    changeNotes(good ? `Mark scene ${n} as good` : `Take the good mark off scene ${n}`, { goodScenes: good ? [...current, sceneId] : current.filter((id) => id !== sceneId) });
  }
  /** Brings back the notes of the last batch sent, next to any written since. False when there are none to bring back. */
  function restorePreviousDraft(): boolean {
    const s = notes.getState();
    if (!s.previous) return false;
    const have = new Set(s.notes.map((n) => n.localId));
    changeNotes('Bring back the notes from before', {
      notes: [...s.previous.notes.filter((n) => !have.has(n.localId)), ...s.notes],
      goodScenes: [...new Set([...s.previous.goodScenes, ...s.goodScenes])],
      previous: null,
    });
    return true;
  }

  // -------------------------------------------------------------- direct text edits
  function changeEdits(label: string, after: Edit[], mergeKey?: string) {
    const before = edits.getState().edits;
    const command: Command = { label, do: () => edits.setState({ edits: after }), undo: () => edits.setState({ edits: before }) };
    if (mergeKey) historyStore.getState().runMerged(mergeKey, command); else historyStore.getState().run(command);
  }
  function tryEdit(edit: Edit, label: (scene: string) => string): Outcome {
    const f = film.getState().film;
    if (!f) return { ok: false, problem: 'The film has not loaded yet.' };
    if (saving.getState().stale) return { ok: false, problem: 'The film has changed. Reload it before changing more text.' };
    const problem = checkEdit(f, edit);
    if (problem) return { ok: false, problem };
    const current = edits.getState().edits;
    const next = changesNothing(f, edit) ? dropEdits(current, edit.scene, edit.cue, edit.op) : putEdit(current, edit);
    if (next.length === current.length && next.every((e, i) => JSON.stringify(e) === JSON.stringify(current[i]))) return { ok: true };
    changeEdits(label(sceneNumber(f, edit.scene)), next, `${edit.op}:${edit.scene}:${edit.cue}`);
    return { ok: true };
  }
  /** Changes the words of an on-screen text. Refused, with the reason, when it breaks the seven-word rule. */
  const setCueWords = (scene: string, cue: number, lines: string[]): Outcome =>
    tryEdit({ op: 'text.words', scene, cue, lines: [...lines] }, (n) => `Change the words in scene ${n}`);
  /** Changes when an on-screen text comes and goes, in seconds from the start of its scene. */
  const setCueTime = (scene: string, cue: number, at: Seconds, out: Seconds): Outcome =>
    tryEdit({ op: 'text.time', scene, cue, at, out }, (n) => `Move the text in scene ${n}`);
  /** Puts an on-screen text back as the film has it. `what` limits it to the words or the timing. */
  function resetCue(scene: string, cue: number, what?: 'words' | 'time'): void {
    const current = edits.getState().edits;
    const next = dropEdits(current, scene, cue, what === 'words' ? 'text.words' : what === 'time' ? 'text.time' : undefined);
    if (next.length === current.length) return;
    const thing = what === 'words' ? 'words' : what === 'time' ? 'timing' : 'text';
    changeEdits(`Put back the original ${thing} in scene ${sceneNumber(film.getState().film, scene)}`, next);
  }

  // -------------------------------------------------------------- sending, exporting, saving now
  /** Sends the notes as a batch. The draft is emptied and kept as "the notes from before"; undo history starts again. */
  async function send(request: { reviewer: string; approved?: boolean; frames?: Record<string, string> }): Promise<Batch> {
    const s = notes.getState(); const f = film.getState();
    const batch = await api.sendBatch(job(), { video: f.video, reviewer: request.reviewer, approved: request.approved ?? false, notes: s.notes, goodScenes: s.goodScenes, frames: request.frames });
    silently(() => notes.setState({ notes: [], goodScenes: [], previous: s.notes.length || s.goodScenes.length ? { notes: s.notes, goodScenes: s.goodScenes } : s.previous }));
    notesSaver.settle();
    historyStore.getState().clear();
    film.setState({ batches: [...film.getState().batches.filter((b) => b.batch !== batch.batch), batch] });
    dropLostSelection();
    backup();
    return batch;
  }
  /** Keeps `exports` current: a change to a known export is applied at once; an unknown one is read from the studio. */
  function onExportEvent(e: Extract<StudioEvent, { type: 'export' }>) {
    const list = film.getState().exports;
    if (!list.some((x) => x.export === e.n)) { void refreshExports().catch(() => {}); return; }
    film.setState({ exports: list.map((x) => (x.export === e.n ? withoutStale({ ...x, status: e.status, file: e.file, error: e.error }) : x)) });
  }
  const withoutStale = (x: ExportRecord): ExportRecord => { const { file, error, ...rest } = x; return { ...rest, ...(file ? { file } : {}), ...(error ? { error } : {}) }; };
  async function refreshExports(): Promise<void> {
    const mine = opened;
    const list = await api.getExports(job());
    if (mine === opened) film.setState({ exports: list });
  }
  async function requestExport(request: ExportRequest): Promise<ExportReceipt> {
    const receipt = await api.requestExport(job(), request);
    const list = film.getState().exports;
    if (!list.some((x) => x.export === receipt.export)) film.setState({ exports: [...list, { export: receipt.export, ratio: receipt.ratio, height: receipt.height, quality: receipt.quality, status: 'requested' }] });
    return receipt;
  }
  /** The address of a finished export, to download. */
  const exportUrl = (file: string): string => api.mediaUrl(job(), file);
  /** Saves now what is waiting. Also the "try again" after a failed save. */
  async function flush(): Promise<void> { await Promise.all([notesSaver.flush(), editsSaver.flush()]); }

  /** The History contract as one lasting object. It always reads the latest state. */
  const history: History = liveHistory(historyStore);

  return {
    stores: { film, selection, notes, edits, saving, history: historyStore as StoreApi<HistoryState> },
    history,
    open, close, refreshFilm, reloadFilm, chooseVideo, videoUrl,
    select: (s: Selection) => selection.getState().select(s),
    addNote, changeNote, removeNote, setSceneGood, restorePreviousDraft,
    setCueWords, setCueTime, resetCue,
    send, requestExport, exportUrl, flush,
  };
}

export type Editor = ReturnType<typeof createEditor>;
