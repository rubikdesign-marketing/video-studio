import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleFilm } from '../fixtures/sample-film';
import { ApiError, createClient, plainMessage, subscribeEvents } from './index';
import type { EventSourceLike, EventsStatus, StudioEvent } from './index';

/** A pretend server: answers each call from a list and remembers what it was asked. */
function fakeServer(...answers: Array<{ status?: number; body?: unknown } | Error>) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const answer = answers.shift();
    if (!answer) throw new Error('no answer left');
    if (answer instanceof Error) throw answer;
    return new Response(answer.body === undefined ? 'not json' : JSON.stringify(answer.body), { status: answer.status ?? 200 });
  }) as typeof fetch;
  return { calls, client: createClient({ fetch: fetcher }) };
}
const caught = async (p: Promise<unknown>): Promise<ApiError> => {
  try { await p; } catch (e) { expect(e).toBeInstanceOf(ApiError); return e as ApiError; }
  throw new Error('expected the call to fail');
};

describe('the studio client', () => {
  it('reads the film, its versions and when it changed', async () => {
    const { client, calls } = fakeServer({ body: { film: sampleFilm, videos: [{ file: 'preview.mp4', modified: 5 }], film_modified: 42.5 } });
    expect(await client.getFilm('_sample')).toEqual({ film: sampleFilm, videos: [{ file: 'preview.mp4', modified: 5 }], filmModified: 42.5 });
    expect(calls[0]).toEqual({ url: '/api/film?job=_sample', method: 'GET', body: undefined });
  });

  it('fills in notes saved by the old review page', async () => {
    const { client } = fakeServer({ body: { draft: { notes: [{ time: 4.674, text: 'Change this', box: null }, { localId: 'a', time: 1, kind: 'keep', topic: 'text', must: true, text: 'Nice', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }], good_scenes: ['S02'] }, batches: [] } });
    const review = await client.getReview('demo');
    expect(review.draft.notes).toEqual([
      { localId: 'saved-1', time: 4.674, kind: 'change', topic: null, must: false, text: 'Change this', box: null },
      { localId: 'a', time: 1, kind: 'keep', topic: 'text', must: true, text: 'Nice', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } },
    ]);
    expect(review.draft.goodScenes).toEqual(['S02']);
  });

  it('saves the draft and sends a batch in the shape the old page used', async () => {
    const note = { localId: 'a', time: 1, kind: 'change' as const, topic: null, must: false, text: 'Bigger', box: null };
    const { client, calls } = fakeServer({ body: { ok: true } }, { body: { ok: true, batch: { batch: 3 } } });
    await client.saveDraft('my job', { notes: [note], goodScenes: ['S01'] });
    expect(calls[0]).toEqual({ url: '/api/draft?job=my%20job', method: 'POST', body: { notes: [note], good_scenes: ['S01'] } });
    const batch = await client.sendBatch('demo', { video: 'preview.mp4', reviewer: 'Sam', approved: false, notes: [note], goodScenes: [], frames: { a: 'data:image/jpeg;base64,AAAA' } });
    expect(batch).toEqual({ batch: 3 });
    expect(calls[1]?.body).toEqual({ video: 'preview.mp4', reviewer: 'Sam', approved: false, good_scenes: [], notes: [{ ...note, frame: 'data:image/jpeg;base64,AAAA' }] });
  });

  it('saves edits against the film they were made on, and asks for exports', async () => {
    const { client, calls } = fakeServer({ body: { film_modified: 7, edits: [] } }, { body: { ok: true } }, { body: { ok: true, export: { export: 1, ratio: '9:16' } } });
    expect(await client.getEdits('demo')).toEqual({ filmModified: 7, edits: [] });
    await client.saveEdits('demo', 7, [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['Hi'] }]);
    expect(calls[1]?.body).toEqual({ film_modified: 7, edits: [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['Hi'] }] });
    expect(await client.requestExport('demo', { ratio: '9:16', height: 1080, quality: 'master' })).toEqual({ export: 1, ratio: '9:16' });
    expect(calls[2]).toEqual({ url: '/api/export?job=demo', method: 'POST', body: { ratio: '9:16', height: 1080, quality: 'master' } });
  });

  it('reads, saves and sends a paper edit at the addresses the old page uses', async () => {
    const payload = { blocks: [{ clip: 'take 1', sentence: 0, words: [0, 1] }], keep_pauses: ['take 1:3'], approved_joins: [], note: 'Warm', reviewer: 'Sam' };
    const saved = { ok: true, check: { runs: [], joins: [], seconds: 3.2 }, status: 'draft' };
    const { client, calls } = fakeServer({ body: { jobs: [{ job: 'a', name: 'A', status: 'draft' }] } }, { body: { paper: { blocks: [] } } }, { body: saved }, { body: { ...saved, status: 'sent' } });
    expect(await client.listPaperJobs()).toEqual([{ job: 'a', name: 'A', status: 'draft' }]);
    expect(await client.getPaper('my job')).toEqual({ paper: { blocks: [] } });
    expect(await client.savePaper('my job', payload)).toEqual(saved);
    expect((await client.sendPaper('my job', { ...payload, approved: true })).status).toBe('sent');
    expect(calls.map((c) => [c.method, c.url])).toEqual([['GET', '/api/paper/jobs'], ['GET', '/api/paper?job=my%20job'], ['POST', '/api/paper/save?job=my%20job'], ['POST', '/api/paper/send?job=my%20job']]);
    expect(calls[2]?.body).toEqual(payload);
    expect(calls[3]?.body).toEqual({ ...payload, approved: true });
    expect(client.clipMediaUrl('my job', 'take 1')).toBe('/clip-media/my%20job/take%201');
  });

  it('builds safe addresses for films and pictures', () => {
    const client = createClient({ baseUrl: 'http://localhost:4317/' });
    expect(client.mediaUrl('demo', 'my film.mp4')).toBe('http://localhost:4317/media/demo/my%20film.mp4');
    expect(client.frameUrl('demo', 'review/frames/b001-n1.jpg')).toBe('http://localhost:4317/frames/demo/b001-n1.jpg');
  });

  it('turns every failure into one error with a plain message', async () => {
    const { client } = fakeServer(
      new TypeError('Failed to fetch'),
      { status: 404, body: { error: 'unknown job' } },
      { status: 409, body: { error: 'The film has changed since these changes were made, so they were not saved. Reload the film to carry on.', film_modified: 99 } },
      { status: 400, body: { error: 'Change 1 puts 9 words on screen in scene S02. On-screen text can have at most seven words.', problems: ['Change 1 puts 9 words on screen in scene S02. On-screen text can have at most seven words.'] } },
      { status: 500, body: { error: "Unexpected token '<'" } },
      { status: 200 },
    );
    const offline = await caught(client.listJobs());
    expect(offline.kind).toBe('offline');
    expect(offline.message).toMatch(/studio is not answering/);

    const missing = await caught(client.getFilm('nope'));
    expect([missing.kind, missing.status, missing.message]).toEqual(['not-found', 404, 'This job could not be found. It may have been renamed or removed.']);

    const stale = await caught(client.saveEdits('demo', 1, []));
    expect([stale.kind, stale.status, stale.filmModified]).toEqual(['stale', 409, 99]);
    expect(stale.message).toMatch(/Reload the film/);

    const refused = await caught(client.saveEdits('demo', 99, []));
    expect(refused.kind).toBe('refused');
    expect(refused.message).toMatch(/9 words on screen in scene S02/);
    expect(refused.problems).toHaveLength(1);

    const broken = await caught(client.getReview('demo'));
    expect(broken.kind).toBe('failed');
    expect(broken.message).toBe('The studio ran into a problem (code 500). Try again in a moment.');   // never the raw code error

    expect((await caught(client.listJobs())).kind).toBe('failed');
    expect(plainMessage(new Error('boom'))).toBe('Something went wrong. Try again.');
    expect(plainMessage(stale)).toBe(stale.message);
  });
});

describe('live events', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function fakeSources() {
    const made: (EventSourceLike & { url: string; closed: boolean })[] = [];
    const open = (url: string) => {
      const s = { url, closed: false, onopen: null, onmessage: null, onerror: null, close() { s.closed = true; } } as EventSourceLike & { url: string; closed: boolean };
      made.push(s); return s;
    };
    return { made, open };
  }

  it('passes on known events and ignores anything else', () => {
    const { made, open } = fakeSources(); const events: StudioEvent[] = [];
    const client = createClient();
    client.events('my job', { onEvent: (e) => events.push(e), open });
    expect(made[0]?.url).toBe('/api/events?job=my%20job');
    made[0]?.onmessage?.({ data: '{"type":"version","file":"preview.mp4"}' });
    made[0]?.onmessage?.({ data: '{"type":"rendering","active":true,"elapsed":12}' });
    made[0]?.onmessage?.({ data: '{"type":"mystery"}' });
    made[0]?.onmessage?.({ data: 'not json' });
    expect(events).toEqual([{ type: 'version', file: 'preview.mp4' }, { type: 'rendering', active: true, elapsed: 12 }]);
  });

  it('reconnects after a drop, waiting longer each time, and starts over once connected', () => {
    const { made, open } = fakeSources(); const status: EventsStatus[] = [];
    const stop = subscribeEvents('/api/events?job=demo', { onEvent: () => {}, onStatus: (s) => status.push(s), open, retryMs: 1000, maxRetryMs: 3000 });
    made[0]?.onopen?.({});
    made[0]?.onerror?.({});
    expect(made[0]?.closed).toBe(true);
    expect(status).toEqual(['connecting', 'live', 'reconnecting']);
    vi.advanceTimersByTime(999); expect(made).toHaveLength(1);
    vi.advanceTimersByTime(1); expect(made).toHaveLength(2);
    made[1]?.onerror?.({}); vi.advanceTimersByTime(2000); expect(made).toHaveLength(3);
    made[2]?.onerror?.({}); vi.advanceTimersByTime(2999); expect(made).toHaveLength(3);   // capped at 3000
    vi.advanceTimersByTime(1); expect(made).toHaveLength(4);
    made[3]?.onopen?.({}); made[3]?.onerror?.({});
    vi.advanceTimersByTime(1000); expect(made).toHaveLength(5);                           // back to the first wait

    stop();
    expect(made[4]?.closed).toBe(true);
    expect(status.at(-1)).toBe('closed');
    made[4]?.onerror?.({}); vi.advanceTimersByTime(60000);
    expect(made).toHaveLength(5);                                                         // stopped means stopped
  });
});
