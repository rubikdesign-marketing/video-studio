import { createStore, type StoreApi } from 'zustand/vanilla';
import { isApiError, plainMessage } from '../../api';
import type { PaperBlock, PaperCheck, PaperData, PaperJob, PaperPayload, PaperSaved, StudioClient } from '../../api';
import type { Command, History } from '../../contracts/store';
import { createSaver, type SaveStatus } from '../../store/saver';
import { clipOf, excerpt, isFiller, keyOf, openJoins } from './words';

/** The part of a paper edit a person changes by clicking. Undo and redo put exactly this back. */
export interface PaperEdit { blocks: PaperBlock[]; keepPauses: string[]; approvedJoins: string[] }

export interface PaperState extends PaperEdit {
  jobs: PaperJob[];
  jobsStatus: 'loading' | 'ready' | 'failed';
  job: string | null;
  status: 'empty' | 'loading' | 'ready' | 'failed';
  /** When `status` or `jobsStatus` is `failed`: why, in plain words. */
  message: string | null;
  /** The clips, their words and the tool's proposals. These never change while the page is open. */
  data: PaperData | null;
  note: string;
  /** What the server makes of the edit: the stretches to play, the joins and the length. Fresh after every save. */
  check: PaperCheck;
  /** True once the paper edit has been sent. */
  sent: boolean;
  /** Null until something has been saved in this visit, as on the old page. */
  save: SaveStatus | null;
  /** Why the last save failed, in plain words. */
  saveMessage: string | null;
  /** The result of the last Send, shown under the buttons. */
  result: { text: string; bad: boolean } | null;
}

export type PaperApi = Pick<StudioClient, 'listPaperJobs' | 'getPaper' | 'savePaper' | 'sendPaper' | 'clipMediaUrl'>;
export interface PaperOptions {
  api: PaperApi;
  /** Where the steps go. `clear` is called when another job is opened. */
  history: Pick<History, 'run'> & { clear?(): void };
  /** Who the edit is from: read at the moment of each save. */
  reviewer(): string;
  /** The old page's waits: 350 ms after a click, 600 ms after typing in the note. */
  editDelayMs?: number;
  noteDelayMs?: number;
}

const noCheck: PaperCheck = { runs: [], joins: [], seconds: 0 };
const empty: PaperState = {
  jobs: [], jobsStatus: 'loading', job: null, status: 'empty', message: null, data: null,
  blocks: [], keepPauses: [], approvedJoins: [], note: '', check: noCheck, sent: false, save: null, saveMessage: null, result: null,
};
const toggled = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

export function createPaper(options: PaperOptions) {
  const { api, history } = options;
  const editDelayMs = options.editDelayMs ?? 350;
  const noteDelayMs = options.noteDelayMs ?? 600;
  const store = createStore<PaperState>(() => empty);
  const get = store.getState; const set = store.setState;
  let opened = 0;

  /** What goes to the server, field for field as the old page builds it. */
  function payload(): PaperPayload {
    const s = get();
    return { blocks: s.blocks, keep_pauses: s.keepPauses, approved_joins: s.approvedJoins, note: s.note, reviewer: options.reviewer() };
  }
  function took(answer: PaperSaved) {
    if (answer.check) set({ check: answer.check, sent: answer.status === 'sent' });
  }
  let delay = editDelayMs;
  const saver = createSaver({
    get delayMs() { return delay; },
    save: async () => {
      const job = get().job;
      if (!job) return;
      took(await api.savePaper(job, payload()));
    },
    onStatus: (save) => set(save === 'failed' ? { save } : { save, saveMessage: null }),
    onError: (e) => { set({ saveMessage: `Your changes are not saved yet. ${plainMessage(e)}` }); return isApiError(e) && e.kind === 'not-found' ? null : 5000; },
  });

  // -------------------------------------------------------------- opening
  /** Reads the list of jobs that have a paper edit and opens the wanted one, or the first. */
  async function start(wanted: string | null): Promise<void> {
    set({ jobsStatus: 'loading', message: null });
    try {
      const jobs = await api.listPaperJobs();
      set({ jobs, jobsStatus: 'ready' });
      const pick = jobs.find((j) => j.job === wanted) ?? jobs[0];
      if (pick) await open(pick.job);
    } catch (e) {
      set({ jobsStatus: 'failed', message: plainMessage(e) });
    }
  }
  async function open(job: string): Promise<void> {
    await saver.flush().catch(() => {});
    const mine = ++opened;
    saver.settle();
    set({ ...empty, jobs: get().jobs, jobsStatus: get().jobsStatus, job, status: 'loading' });
    history.clear?.();
    try {
      const data = await api.getPaper(job);
      if (mine !== opened) return;
      set({
        status: 'ready', data, blocks: data.paper.blocks, keepPauses: data.paper.keep_pauses ?? [], approvedJoins: data.paper.approved_joins ?? [],
        note: data.paper.note ?? '', check: data.check ?? noCheck, sent: data.paper.status === 'sent',
      });
    } catch (e) {
      if (mine === opened) set({ status: 'failed', message: plainMessage(e) });
    }
  }

  // -------------------------------------------------------------- changes: each one a step in the history
  function change(label: string, next: Partial<PaperEdit>) {
    const s = get();
    const before: PaperEdit = { blocks: s.blocks, keepPauses: s.keepPauses, approvedJoins: s.approvedJoins };
    const after: PaperEdit = { ...before, ...next };
    const apply = (edit: PaperEdit) => () => { set(edit); delay = editDelayMs; saver.touch(); };
    const command: Command = { label, do: apply(after), undo: apply(before) };
    history.run(command);
  }
  const clips = () => get().data?.clips ?? [];
  const sentenceOf = (b: PaperBlock) => clipOf(clips(), b.clip)?.sentences[b.sentence] ?? [];
  const withBlock = (index: number, words: number[]) => get().blocks.map((b, i) => (i === index ? { ...b, words } : b));

  /** Cuts a word, or brings it back. */
  function toggleWord(blockIndex: number, wordIndex: number): void {
    const block = get().blocks[blockIndex]; const word = block && clipOf(clips(), block.clip)?.words[wordIndex];
    if (!block || !word || !sentenceOf(block).includes(wordIndex)) return;
    const kept = new Set(block.words);
    const cutting = kept.has(wordIndex);
    if (cutting) kept.delete(wordIndex); else kept.add(wordIndex);
    const text = word.text.replace(/[,.;:!?]+$/, '');
    change(cutting ? `Cut the word “${text}”` : `Bring back the word “${text}”`, { blocks: withBlock(blockIndex, sentenceOf(block).filter((i) => kept.has(i))) });
  }
  /** Moves a sentence one place up or down, or to the very start. */
  function moveSentence(blockIndex: number, where: 'up' | 'down' | 'first'): void {
    const blocks = [...get().blocks]; const block = blocks[blockIndex];
    const to = where === 'up' ? blockIndex - 1 : where === 'down' ? blockIndex + 1 : 0;
    if (!block || to < 0 || to >= blocks.length || to === blockIndex) return;
    blocks.splice(blockIndex, 1); blocks.splice(to, 0, block);
    const what = `Move the sentence ${excerpt(clips(), block)}`;
    change(where === 'first' ? `${what} to the start` : `${what} ${where}`, { blocks });
  }
  function cutSentence(blockIndex: number): void {
    const block = get().blocks[blockIndex];
    if (!block || !block.words.length) return;
    change(`Cut the sentence ${excerpt(clips(), block)}`, { blocks: withBlock(blockIndex, []) });
  }
  function keepAll(blockIndex: number): void {
    const block = get().blocks[blockIndex];
    if (!block || block.words.length === sentenceOf(block).length) return;
    change(`Keep all of the sentence ${excerpt(clips(), block)}`, { blocks: withBlock(blockIndex, [...sentenceOf(block)]) });
  }
  /** Opens the edit with a sentence. A sentence that was cut comes back without its filler words, as on the old page. */
  function openWith(clip: string, sentence: number): void {
    const blocks = [...get().blocks]; const from = blocks.findIndex((b) => b.clip === clip && b.sentence === sentence);
    const found = blocks[from];
    if (!found) return;
    const words = clipOf(clips(), clip)?.words ?? [];
    const block = found.words.length ? found : { ...found, words: sentenceOf(found).filter((i) => { const w = words[i]; return !!w && !isFiller(w); }) };
    if (from === 0 && block === found) return;
    blocks.splice(from, 1); blocks.splice(0, 0, block);
    change(`Open with ${excerpt(clips(), block)}`, { blocks });
  }
  /** Keeps a long pause as it was said, or lets it be shortened again. `key` is "clip:word index". */
  function togglePause(key: string): void {
    const keeping = !get().keepPauses.includes(key);
    change(keeping ? 'Keep a pause as it was said' : 'Shorten a pause again', { keepPauses: toggled(get().keepPauses, key) });
  }
  /** Says a flagged join keeps the meaning, or takes that back. */
  function toggleJoin(key: string): void {
    const approving = !get().approvedJoins.includes(key);
    change(approving ? 'Approve a join' : 'Take back the approval of a join', { approvedJoins: toggled(get().approvedJoins, key) });
  }
  /** The note for the editor. Typing has the field's own undo, so it is not a history step. */
  function setNote(note: string): void {
    if (note === get().note) return;
    set({ note }); delay = noteDelayMs; saver.touch();
  }

  // -------------------------------------------------------------- sending
  /** Sends the paper edit: `ok` for "ready for the rough cut", `notes` for "not ready yet". */
  async function send(kind: 'ok' | 'notes'): Promise<boolean> {
    const job = get().job;
    if (!job) return false;
    const open = openJoins(get().check);
    if (kind === 'ok' && open) {
      set({ result: { text: `${open} join${open > 1 ? 's still need' : ' still needs'} a look: each one is marked in the text.`, bad: true } });
      return false;
    }
    saver.settle();                                              // the send carries everything, as on the old page
    set({ save: 'saving' });
    try {
      const answer = await api.sendPaper(job, { ...payload(), approved: kind === 'ok' });
      took(answer);
      set({ save: 'saved', saveMessage: null, result: { text: kind === 'ok' ? 'Sent. The rough cut is made from this paper edit.' : 'Sent with your notes.', bad: false } });
      set({ jobs: get().jobs.map((j) => (j.job === job ? { ...j, status: 'sent' } : j)) });
      return true;
    } catch {
      set({ save: 'failed', result: { text: 'Could not send. Is the studio server still running?', bad: true } });
      return false;
    }
  }

  /** The save line, in the old page's words. */
  const saveLabel = (s: PaperState): string =>
    s.save === 'failed' ? 'Not saved' : s.save === 'unsaved' || s.save === 'saving' ? 'Saving' : s.sent ? 'Sent' : s.save === 'saved' ? 'Saved' : '';

  return {
    store: store as StoreApi<PaperState>,
    start, open, toggleWord, moveSentence, cutSentence, keepAll, openWith, togglePause, toggleJoin, setNote, send, saveLabel, payload,
    flush: () => saver.flush(),
    clipUrl: (clip: string) => { const job = get().job; return job ? api.clipMediaUrl(job, clip) : ''; },
    keyOf,
  };
}
export type PaperEditor = ReturnType<typeof createPaper>;
