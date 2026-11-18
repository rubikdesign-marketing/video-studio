import { beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '../api';
import type { Box, NoteKind } from '../contracts/review';
import { sampleFilm } from '../fixtures/sample-film';
import { createEditor, type Editor } from '../store';
import { addNoteInOrder } from './actions';
import { NAME_FIRST, sendNotes, whatToSend } from './send';

/** What a reviewer does to make one note, on either page. */
interface Written { currentTime: number; typed: string; kind: NoteKind; topic: string | null; must: boolean; box: Box | null }

const written: Written[] = [
  { currentTime: 5.1234567, typed: '  The second line comes in late.  ', kind: 'change', topic: 'Pacing', must: true, box: { x: 0.25, y: 0.5, w: 0.3, h: 0.2 } },
  { currentTime: 1.2, typed: 'Lovely opening.', kind: 'keep', topic: null, must: false, box: null },
  { currentTime: 9.75, typed: 'Make the last word bigger.', kind: 'change', topic: 'Design', must: false, box: null },
];
const goodScenes = ['S01', 'S03'];

/** A stand-in for the picture taken from the video: it only has to be the same on both sides. */
const capture = (time: number, box: Box | null) => `data:image/jpeg;base64,${Buffer.from(`${time}:${JSON.stringify(box)}`).toString('base64')}`;

/**
 * The payload the way studio/review.html builds it. These lines are that page's own, with its form fields and
 * its video element passed in: the "Add note" handler, then `sendAll`.
 */
function oldPagePayload(who: string, version: string, approved: boolean) {
  const notes: Record<string, unknown>[] = [];
  const good = [...goodScenes];
  for (const w of written) {
    const v = { currentTime: w.currentTime };
    const text = w.typed.trim();
    const { kind, topic, must, box } = w;
    notes.push({ time: Number(v.currentTime.toFixed(3)), text, kind, topic, must, box, frame: capture(Number(v.currentTime.toFixed(3)), box) });
    notes.sort((a, b) => (a.time as number) - (b.time as number));
  }
  return { video: version, reviewer: who.trim(), notes, good_scenes: good, approved };
}

let ed: Editor;
let posted: { url: string; body: Record<string, unknown> }[];

beforeEach(async () => {
  posted = [];
  const answers: Record<string, unknown> = {
    '/api/film': { film: sampleFilm, videos: [{ file: 'preview.mp4', modified: 1 }], film_modified: 1 },
    '/api/review': { draft: { notes: [], good_scenes: [] }, batches: [] },
    '/api/edits': { film_modified: 1, edits: [] },
    '/api/draft': { ok: true },
  };
  const pretendFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.split('?')[0] as string;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    if (body) posted.push({ url, body });
    if (path === '/api/send') {
      const batch = { batch: 1, job: '_sample', video: body?.video, reviewer: body?.reviewer, sent_at: '2026-11-18T12:00:00.000Z', status: 'sent', approved: body?.approved, good_scenes: body?.good_scenes, notes: [] };
      return new Response(JSON.stringify({ ok: true, batch }));
    }
    return new Response(JSON.stringify(answers[path] ?? { error: 'no such thing' }), { status: answers[path] ? 200 : 404 });
  }) as typeof fetch;
  // The real client, so what is compared is what would go over the wire.
  const client = createClient({ fetch: pretendFetch });
  ed = createEditor({ api: { ...client, events: () => () => {} }, storage: null, saveDelayMs: 60_000 });
  await ed.open('_sample');
  for (const w of written) addNoteInOrder(ed, { time: w.currentTime, text: w.typed, kind: w.kind, topic: w.topic, must: w.must, box: w.box });
  for (const id of goodScenes) ed.setSceneGood(id, true);
});

const sent = () => posted.filter((p) => p.url.startsWith('/api/send'));

describe('sending notes', () => {
  it.each([[false], [true]])('posts what the old review page posts, field for field (approved: %s)', async (approved) => {
    const result = await sendNotes({ editor: ed, reviewer: '  Sam ', approved, capture: async (t, b) => capture(t, b) });
    expect(result.ok).toBe(true);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]?.url).toBe('/api/send?job=_sample');

    const old = oldPagePayload('  Sam ', 'preview.mp4', approved);
    const { notes: newNotes, ...newTop } = sent()[0]?.body as { notes: Record<string, unknown>[] } & Record<string, unknown>;
    const { notes: oldNotes, ...oldTop } = old;

    // Everything around the notes: the same fields with the same values, nothing more and nothing less.
    expect(Object.keys(newTop).sort()).toEqual(Object.keys(oldTop).sort());
    expect(newTop).toEqual(oldTop);

    // The notes: the same number, in the same (film) order, every old field with the same value.
    expect(newNotes).toHaveLength(oldNotes.length);
    newNotes.forEach((note, i) => {
      const before = oldNotes[i] as Record<string, unknown>;
      for (const field of Object.keys(before)) expect(note[field], `note ${i + 1}, ${field}`).toEqual(before[field]);
      // The one field the new page adds: the note's own id, which the server does not write into the batch file.
      expect(Object.keys(note).sort()).toEqual([...Object.keys(before), 'localId'].sort());
      expect(typeof note.localId).toBe('string');
    });
    expect(newNotes.map((n) => n.time)).toEqual([1.2, 5.123, 9.75]);
  });

  it('empties the notes after sending and keeps them to bring back', async () => {
    const result = await sendNotes({ editor: ed, reviewer: 'Sam', approved: false, capture: async () => null });
    expect(result).toMatchObject({ ok: true, message: 'Sent. Only the scenes your notes touch will be changed, and the new version will appear here.' });
    expect(ed.stores.notes.getState().notes).toEqual([]);
    expect(ed.stores.notes.getState().previous?.notes).toHaveLength(3);
    // A picture that could not be taken is sent as "no picture", not left out.
    expect((sent()[0]?.body.notes as { frame: unknown }[]).map((n) => n.frame)).toEqual([null, null, null]);
  });

  it('asks for a name first and sends nothing without one', async () => {
    const result = await sendNotes({ editor: ed, reviewer: '   ', approved: false, capture: async () => null });
    expect(result).toEqual({ ok: false, problem: NAME_FIRST, needsName: true });
    expect(sent()).toHaveLength(0);
    expect(ed.stores.notes.getState().notes).toHaveLength(3);
  });

  it('says in plain words when the studio refuses', async () => {
    const failing = { stores: ed.stores, send: async () => { throw new Error('boom'); } };
    const result = await sendNotes({ editor: failing, reviewer: 'Sam', approved: false, capture: async () => null });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem).toMatch(/^That did not send\. /);
  });
});

describe('notes in film order', () => {
  it('adds each note as one step that undo takes away again', () => {
    const before = ed.stores.notes.getState().notes;
    expect(before.map((n) => n.time)).toEqual([1.2, 5.123, 9.75]);
    addNoteInOrder(ed, { time: 3, text: 'In the middle', kind: 'change', topic: null, must: false, box: null });
    expect(ed.stores.notes.getState().notes.map((n) => n.time)).toEqual([1.2, 3, 5.123, 9.75]);
    expect(ed.history.labels.undo).toBe('Add a note at 0:03');
    ed.history.undo();
    expect(ed.stores.notes.getState().notes).toEqual(before);
  });

  it('a "keep" note is never a must-fix', () => {
    const id = addNoteInOrder(ed, { time: 2, text: 'Good', kind: 'keep', topic: null, must: true, box: null });
    expect(ed.stores.notes.getState().notes.find((n) => n.localId === id)?.must).toBe(false);
  });
});

describe('the Send button', () => {
  it('says what will be sent', () => {
    expect(whatToSend(0, 0)).toBe('');
    expect(whatToSend(1, 0)).toBe('1 note');
    expect(whatToSend(3, 1)).toBe('3 notes and 1 good scene');
    expect(whatToSend(0, 2)).toBe('2 good scenes');
  });
});
