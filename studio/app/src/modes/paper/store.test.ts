import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createClient } from '../../api';
import type { PaperData, PaperPayload, PaperSaved } from '../../api';
import { createHistory, liveHistory } from '../../store';
import { flaggedJoin, samplePaper } from './fixture';
import { createPaper, type PaperApi } from './store';
import { clock, excerpt, lengthLine, takeLabels } from './words';

/** A pretend studio that keeps the paper edit it is sent. */
function fakeStudio(data: PaperData = samplePaper()) {
  const saved: { kind: 'save' | 'send'; job: string; payload: PaperPayload }[] = [];
  let failing: ApiError | null = null;
  let check = data.check;
  const answer = (kind: 'save' | 'send'): PaperSaved => ({ ok: true, check, status: kind === 'send' || saved.some((s) => s.kind === 'send') ? 'sent' : 'draft' });
  const api: PaperApi = {
    listPaperJobs: async () => [{ job: 'demo', name: 'Sample footage', status: 'draft' }, { job: 'other', name: 'Other', status: 'sent' }],
    getPaper: async () => JSON.parse(JSON.stringify(data)) as PaperData,
    savePaper: async (job, payload) => { if (failing) throw failing; saved.push({ kind: 'save', job, payload: JSON.parse(JSON.stringify(payload)) as PaperPayload }); return answer('save'); },
    sendPaper: async (job, payload) => { if (failing) throw failing; saved.push({ kind: 'send', job, payload: JSON.parse(JSON.stringify(payload)) as PaperPayload }); return answer('send'); },
    clipMediaUrl: (job, clip) => `/clip-media/${job}/${clip}`,
  };
  return { api, saved, fail: (e: ApiError | null) => { failing = e; }, setCheck: (c: PaperData['check']) => { check = c; } };
}
function make(studio = fakeStudio(), who = 'Sam') {
  const historyStore = createHistory();
  const history = liveHistory(historyStore);
  const paper = createPaper({ api: studio.api, history: { run: (c) => history.run(c), clear: () => historyStore.getState().clear() }, reviewer: () => who });
  return { paper, history, studio, state: () => paper.store.getState() };
}
const edit = (p: ReturnType<typeof make>) => JSON.parse(JSON.stringify({ blocks: p.state().blocks, keepPauses: p.state().keepPauses, approvedJoins: p.state().approvedJoins })) as unknown;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('opening a paper edit', () => {
  it('lists the jobs and opens the one asked for, or the first', async () => {
    const p = make();
    await p.paper.start('other');
    expect([p.state().job, p.state().status, p.state().jobs.length]).toEqual(['other', 'ready', 2]);
    const q = make();
    await q.paper.start('not-there');
    expect(q.state().job).toBe('demo');
    expect(q.state().blocks).toEqual(samplePaper().paper.blocks);
    expect([q.state().sent, q.state().save, q.paper.saveLabel(q.state())]).toEqual([false, null, '']);
    expect(q.paper.clipUrl('take-1')).toBe('/clip-media/demo/take-1');
    await vi.advanceTimersByTimeAsync(5000);
    expect(q.studio.saved).toEqual([]);                                              // opening is not a change
  });

  it('shows no jobs, and says why in plain words when the studio does not answer', async () => {
    const none = fakeStudio(); none.api.listPaperJobs = async () => [];
    const p = make(none); await p.paper.start(null);
    expect([p.state().jobsStatus, p.state().jobs, p.state().status]).toEqual(['ready', [], 'empty']);
    const down = fakeStudio(); down.api.listPaperJobs = async () => { throw new ApiError('offline', 'The studio is not answering.'); };
    const q = make(down); await q.paper.start(null);
    expect([q.state().jobsStatus, q.state().message]).toEqual(['failed', 'The studio is not answering.']);
  });
});

describe('what is sent to the server', () => {
  /** The old page's own `save` function, lifted out of paper.html and run as it is. */
  function oldPageSave(state: { blocks: unknown; keep_pauses: string[]; approved_joins: string[]; note: string; who: string; job: string }) {
    const html = readFileSync('../paper.html', 'utf8');
    const source = /async function save\(sendKind\) \{[\s\S]*?\n\}\n/.exec(html)?.[0];
    if (!source) throw new Error('paper.html no longer has the save function this test reads');
    const calls: { url: string; body: string }[] = [];
    const fetcher = async (url: string, init: { body: string }) => { calls.push({ url, body: init.body }); return { json: async () => ({ ok: true, status: 'draft' }) }; };
    const field = (id: string) => ({ value: id === 'note' ? state.note : id === 'who' ? state.who : '', textContent: '' });
    const data = { paper: { blocks: state.blocks, keep_pauses: state.keep_pauses, approved_joins: state.approved_joins }, check: {} };
    const build = new Function('data', '$', 'fetch', 'job', 'render', 'showLength', `${source}; return save;`) as (...args: unknown[]) => (kind?: string) => Promise<unknown>;
    return { save: build(data, field, fetcher, state.job, () => {}, () => {}), calls };
  }

  it('matches the old page field for field, for a save and for both kinds of send', async () => {
    const mine: { url: string; body: string }[] = [];
    const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => { mine.push({ url: String(url), body: String(init?.body) }); return new Response(JSON.stringify({ ok: true, check: samplePaper().check, status: 'draft' })); }) as typeof fetch;
    const client = createClient({ fetch: fetcher });
    const studio = fakeStudio(); studio.api.savePaper = client.savePaper; studio.api.sendPaper = client.sendPaper;
    const p = make(studio, 'Sam Reviewer');
    await p.paper.open('my job');
    p.paper.toggleWord(1, 9); p.paper.moveSentence(3, 'first'); p.paper.togglePause('take-1:5'); p.paper.toggleJoin('take-1:8>take-1:10');
    p.paper.setNote('Keep it warm.\nTry the second take.');
    await p.paper.flush();
    await p.paper.send('notes');
    await p.paper.send('ok');

    const s = p.state();
    const old = oldPageSave({ blocks: s.blocks, keep_pauses: s.keepPauses, approved_joins: s.approvedJoins, note: s.note, who: 'Sam Reviewer', job: 'my job' });
    await old.save(); await old.save('notes'); await old.save('ok');

    expect(mine).toHaveLength(3);
    expect(mine).toEqual(old.calls);                                                 // same addresses, and the same text byte for byte
    expect(Object.keys(JSON.parse(mine[0]?.body ?? '{}') as object)).toEqual(['blocks', 'keep_pauses', 'approved_joins', 'note', 'reviewer']);
    expect(Object.keys(JSON.parse(mine[2]?.body ?? '{}') as object)).toEqual(['blocks', 'keep_pauses', 'approved_joins', 'note', 'reviewer', 'approved']);
    expect([(JSON.parse(mine[1]?.body ?? '{}') as PaperPayload).approved, (JSON.parse(mine[2]?.body ?? '{}') as PaperPayload).approved]).toEqual([false, true]);
    expect(mine.map((c) => c.url)).toEqual(['/api/paper/save?job=my%20job', '/api/paper/send?job=my%20job', '/api/paper/send?job=my%20job']);
  });

  it('keeps any extra fields a sentence came with, as the old page does', async () => {
    const data = samplePaper(); Object.assign(data.paper.blocks[0] ?? {}, { why: 'kept from the tool' });
    const p = make(fakeStudio(data)); await p.paper.open('demo');
    p.paper.toggleWord(1, 9); await p.paper.flush();
    expect(p.studio.saved[0]?.payload.blocks[0]).toEqual({ clip: 'take-1', sentence: 0, words: [1, 2, 3, 4, 5], why: 'kept from the tool' });
  });
});

describe('undo and redo', () => {
  type P = ReturnType<typeof make>;
  const commands: { name: string; label: string; setup?(p: P): void; run(p: P): void }[] = [
    { name: 'cut a word', label: 'Cut the word “second”', run: (p) => p.paper.toggleWord(1, 9) },
    { name: 'bring a word back', label: 'Bring back the word “Um”', run: (p) => p.paper.toggleWord(0, 0) },
    { name: 'move a sentence up', label: 'Move the sentence “Here is a second…” up', run: (p) => p.paper.moveSentence(1, 'up') },
    { name: 'move a sentence down', label: 'Move the sentence “Um, this is the…” down', run: (p) => p.paper.moveSentence(0, 'down') },
    { name: 'move a sentence to the start', label: 'Move the sentence “We make videos very…” to the start', run: (p) => p.paper.moveSentence(3, 'first') },
    { name: 'cut a sentence', label: 'Cut the sentence “Here is a second…”', run: (p) => p.paper.cutSentence(1) },
    { name: 'keep all of a cut sentence', label: 'Keep all of the sentence “We make videos quickly”', run: (p) => p.paper.keepAll(2) },
    { name: 'keep all of a part-cut sentence', label: 'Keep all of the sentence “Um, this is the…”', setup: (p) => p.paper.toggleWord(0, 3), run: (p) => p.paper.keepAll(0) },
    { name: 'open with an idea', label: 'Open with “We make videos very…”', run: (p) => p.paper.openWith('take-2', 1) },
    { name: 'open with a cut sentence', label: 'Open with “Um, this is the…”', setup: (p) => p.paper.cutSentence(0), run: (p) => p.paper.openWith('take-1', 0) },
    { name: 'keep a pause', label: 'Keep a pause as it was said', run: (p) => p.paper.togglePause('take-1:5') },
    { name: 'shorten a pause again', label: 'Shorten a pause again', setup: (p) => p.paper.togglePause('take-1:5'), run: (p) => p.paper.togglePause('take-1:5') },
    { name: 'approve a join', label: 'Approve a join', run: (p) => p.paper.toggleJoin(flaggedJoin.key) },
    { name: 'take back an approval', label: 'Take back the approval of a join', setup: (p) => p.paper.toggleJoin(flaggedJoin.key), run: (p) => p.paper.toggleJoin(flaggedJoin.key) },
  ];
  for (const c of commands) {
    it(`${c.name}: undo then redo gives back exactly the same paper edit`, async () => {
      const p = make(); await p.paper.open('demo');
      c.setup?.(p);
      const before = edit(p);
      c.run(p);
      const after = edit(p);
      expect(after).not.toEqual(before);
      expect(p.history.labels.undo).toBe(c.label);
      p.history.undo(); expect(edit(p)).toEqual(before);
      p.history.redo(); expect(edit(p)).toEqual(after);
      p.history.undo(); p.history.redo(); p.history.undo(); expect(edit(p)).toEqual(before);
    });
  }

  it('walks back and forward through a whole session, and saves what undo leaves', async () => {
    const p = make(); await p.paper.open('demo');
    const states = [edit(p)];
    const steps = [() => p.paper.toggleWord(1, 9), () => p.paper.moveSentence(3, 'first'), () => p.paper.cutSentence(2), () => p.paper.togglePause('take-1:5'), () => p.paper.openWith('take-1', 1), () => p.paper.toggleJoin('a>b')];
    for (const step of steps) { step(); states.push(edit(p)); }
    for (let i = steps.length - 1; i >= 0; i--) { p.history.undo(); expect(edit(p)).toEqual(states[i]); }
    expect(p.history.canUndo).toBe(false);
    for (let i = 1; i <= steps.length; i++) { p.history.redo(); expect(edit(p)).toEqual(states[i]); }
    p.history.undo(); p.history.undo();
    await vi.advanceTimersByTimeAsync(350);
    expect(p.studio.saved.at(-1)?.payload.blocks).toEqual(p.state().blocks);
    expect(p.studio.saved.at(-1)?.payload.approved_joins).toEqual([]);
  });

  it('does nothing, and records nothing, when there is nothing to change', async () => {
    const p = make(); await p.paper.open('demo');
    p.paper.moveSentence(0, 'up'); p.paper.moveSentence(3, 'down'); p.paper.moveSentence(0, 'first'); p.paper.cutSentence(2); p.paper.keepAll(1);
    p.paper.toggleWord(0, 9); p.paper.toggleWord(9, 0); p.paper.openWith('nope', 0);
    expect(p.history.canUndo).toBe(false);
    expect(edit(p)).toEqual({ blocks: samplePaper().paper.blocks, keepPauses: [], approvedJoins: [] });
  });

  it('keeps the kept words of a sentence in spoken order, and brings a cut opening back without its fillers', async () => {
    const p = make(); await p.paper.open('demo');
    p.paper.toggleWord(0, 3); p.paper.toggleWord(0, 0); p.paper.toggleWord(0, 3);
    expect(p.state().blocks[0]?.words).toEqual([0, 1, 2, 3, 4, 5]);
    p.paper.cutSentence(0); p.paper.openWith('take-1', 0);
    expect(p.state().blocks[0]).toEqual({ clip: 'take-1', sentence: 0, words: [1, 2, 3, 4, 5] });   // "Um," is a filler
    p.paper.cutSentence(2); p.paper.openWith('take-1', 1);
    expect(p.state().blocks[0]?.words).toEqual([6, 7, 8, 9, 10, 11, 12]);                           // a sentence with kept words keeps them
  });
});

describe('autosave', () => {
  it('saves 350 ms after a click and 600 ms after typing a note, and shows each state', async () => {
    const p = make(); await p.paper.open('demo');
    const label = () => p.paper.saveLabel(p.state());
    p.paper.toggleWord(1, 9);
    expect(label()).toBe('Saving');
    await vi.advanceTimersByTimeAsync(349); expect(p.studio.saved).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1); expect(p.studio.saved).toHaveLength(1);
    expect(label()).toBe('Saved');
    p.paper.setNote('Warm'); p.paper.setNote('Warmer');
    await vi.advanceTimersByTimeAsync(599); expect(p.studio.saved).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(p.studio.saved[1]?.payload).toMatchObject({ note: 'Warmer', reviewer: 'Sam' });
    p.history.undo();
    expect(p.state().note).toBe('Warmer');                                           // the note is not part of undo
    await vi.advanceTimersByTimeAsync(350);
    expect(p.studio.saved).toHaveLength(3);
  });

  it('takes the joins and the length the server works out after each save', async () => {
    const p = make(); await p.paper.open('demo');
    p.studio.setCheck({ seconds: 6.1, runs: [], joins: [flaggedJoin] });
    p.paper.toggleWord(1, 9);
    await vi.advanceTimersByTimeAsync(350);
    expect(p.state().check.joins).toEqual([flaggedJoin]);
    expect(lengthLine(p.state().check, 6)).toEqual({ text: 'About 6.1 s of 6 s · 1 join to check', over: true });
  });

  it('says "Not saved" with the reason when a save fails, tries again, and recovers', async () => {
    const p = make(); await p.paper.open('demo');
    p.studio.fail(new ApiError('offline', 'The studio is not answering.'));
    p.paper.cutSentence(1);
    await vi.advanceTimersByTimeAsync(350);
    expect([p.paper.saveLabel(p.state()), p.state().saveMessage]).toEqual(['Not saved', 'Your changes are not saved yet. The studio is not answering.']);
    p.studio.fail(null);
    await vi.advanceTimersByTimeAsync(5000);
    expect([p.paper.saveLabel(p.state()), p.state().saveMessage]).toEqual(['Saved', null]);
    expect(p.studio.saved[0]?.payload.blocks[1]?.words).toEqual([]);
  });
});

describe('sending', () => {
  it('will not send as ready while a join still needs a look', async () => {
    const data = samplePaper(); data.check.joins.push(flaggedJoin, { ...flaggedJoin, key: 'x>y', after: 'take-1:3' });
    const p = make(fakeStudio(data)); await p.paper.open('demo');
    expect(await p.paper.send('ok')).toBe(false);
    expect(p.state().result).toEqual({ text: '2 joins still need a look: each one is marked in the text.', bad: true });
    expect(p.studio.saved).toEqual([]);
    const one = samplePaper(); one.check.joins.push(flaggedJoin);
    const q = make(fakeStudio(one)); await q.paper.open('demo'); await q.paper.send('ok');
    expect(q.state().result?.text).toBe('1 join still needs a look: each one is marked in the text.');
    expect(await q.paper.send('notes')).toBe(true);                                  // with notes it may go
    expect(q.state().result).toEqual({ text: 'Sent with your notes.', bad: false });
  });

  it('sends everything at once, cancels the waiting save, and shows Sent', async () => {
    const p = make(); await p.paper.start('demo');
    p.paper.toggleWord(1, 9); p.paper.setNote('Go');
    expect(await p.paper.send('ok')).toBe(true);
    expect(p.studio.saved).toHaveLength(1);
    expect(p.studio.saved[0]).toMatchObject({ kind: 'send', job: 'demo', payload: { note: 'Go', approved: true, reviewer: 'Sam' } });
    expect(p.state().result).toEqual({ text: 'Sent. The rough cut is made from this paper edit.', bad: false });
    expect([p.state().sent, p.paper.saveLabel(p.state()), p.state().jobs[0]?.status]).toEqual([true, 'Sent', 'sent']);
    await vi.advanceTimersByTimeAsync(5000);
    expect(p.studio.saved).toHaveLength(1);                                          // the save that was waiting did not also go
    p.paper.toggleWord(1, 9);
    await vi.advanceTimersByTimeAsync(350);
    expect(p.paper.saveLabel(p.state())).toBe('Sent');                               // later changes still save; it stays sent
  });

  it('says so when the send does not get through', async () => {
    const p = make(); await p.paper.open('demo');
    p.studio.fail(new ApiError('offline', 'x'));
    expect(await p.paper.send('notes')).toBe(false);
    expect(p.state().result).toEqual({ text: 'Could not send. Is the studio server still running?', bad: true });
    expect(p.paper.saveLabel(p.state())).toBe('Not saved');
  });
});

describe('small helpers', () => {
  it('write times, takes, lengths and sentence openings the way the old page does', () => {
    expect([clock(0), clock(4.26), clock(64.5)]).toEqual(['0:00.0', '0:04.3', '1:04.5']);
    expect(takeLabels(samplePaper())).toEqual({ 'take-2#0': 'Take 1 of 2', 'take-2#1': 'Take 2 of 2, the one proposed' });
    expect(lengthLine({ seconds: 5, runs: [], joins: [] }, 6)).toEqual({ text: 'About 5.0 s of 6 s', over: false });
    expect(lengthLine({ seconds: 5, runs: [], joins: [flaggedJoin, { ...flaggedJoin, key: 'b' }] }, null)).toEqual({ text: 'About 5.0 s · 2 joins to check', over: false });
    expect(excerpt(samplePaper().clips, { clip: 'take-2', sentence: 0, words: [] })).toBe('“We make videos quickly”');
  });
});
