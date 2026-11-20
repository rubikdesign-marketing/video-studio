import { useEffect } from 'react';
import { create } from 'zustand';
import type { BatchNote } from '../api';
import { formatTime, sceneName } from '../canvas/format';
import { usePlayback } from '../playback';
import { editor, useEditedFilm, useFilm } from '../store';
import { Button, Chip, Icon, showToast } from '../ui';
import { addNoteInOrder } from './actions';
import './notes.css';

/**
 * Claude's replies to the last batch, checked one by one (EDITOR-V2-PLAN.md, phase B4). When Claude finishes a batch
 * it writes a one-line reply per note (`wait-for-notes.mjs --done`). Here each reply gets two answers: Fixed, or
 * Not yet, which puts the note back in your notes as must fix. What you checked is remembered in this browser.
 */
type Mark = 'fixed' | 'again';
const storageKey = (job: string, batch: number) => `studio-editor:replies:${job}:${batch}`;

function read(key: string): Record<string, Mark> {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, Mark>; } catch { return {}; }
}
export const useReplyMarks = create<{ marks: Record<string, Record<string, Mark>>; load(key: string): void; mark(key: string, id: string, m: Mark | null): void }>((set, get) => ({
  marks: {},
  load: (key) => { if (!(key in get().marks)) set({ marks: { ...get().marks, [key]: read(key) } }); },
  mark: (key, id, m) => {
    const next = { ...(get().marks[key] ?? {}) };
    if (m) next[id] = m; else delete next[id];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* not remembered, still works */ }
    set({ marks: { ...get().marks, [key]: next } });
  },
}));

/** The replies of the latest batch, when Claude has finished it, and how many are still to check. */
export function useReplies(): { key: string | null; items: BatchNote[]; marks: Record<string, Mark>; unchecked: number } {
  const job = useFilm((s) => s.job);
  const last = useFilm((s) => s.batches[s.batches.length - 1]);
  const key = job && last && last.status === 'done' ? storageKey(job, last.batch) : null;
  const marks = useReplyMarks((s) => (key ? s.marks[key] : undefined));
  useEffect(() => { if (key) useReplyMarks.getState().load(key); }, [key]);
  const items = key && last ? last.notes.filter((n) => n.reply) : [];
  const m = marks ?? {};
  return { key, items, marks: m, unchecked: items.filter((n) => !m[n.id]).length };
}

const when = (n: BatchNote) => (n.end ? `${formatTime(n.time)} to ${formatTime(n.end)}` : formatTime(n.time));

/** The Replies tab. */
export function Replies() {
  const film = useEditedFilm();
  const { key, items, marks } = useReplies();
  if (!key || !items.length) return <p className="notes-quiet">No replies to check.</p>;
  const done = items.length - items.filter((n) => !marks[n.id]).length;

  const again = (n: BatchNote) => {
    addNoteInOrder(editor, { time: n.time, end: n.end ?? null, text: `Still not right: ${n.text}`, kind: 'change', topic: n.topic, must: true, box: n.box });
    useReplyMarks.getState().mark(key, n.id, 'again');
    showToast('Back in your notes as must fix.', { tone: 'good' });
  };
  return (
    <div className="replies">
      <p className="notes-quiet replies-intro">
        Claude answered each note. Watch the moment, then say whether it is fixed. {done} of {items.length} checked.
      </p>
      <ul className="notes-list">
        {items.map((n) => {
          const m = marks[n.id];
          return (
            <li key={n.id} className="notes-card replies-item" data-mark={m}>
              <button type="button" className="notes-card-main" onClick={() => { const p = usePlayback.getState(); p.pause(); p.seek(n.time); }}>
                <span className="notes-meta">
                  <strong className="time">{when(n)}</strong>
                  <span>{sceneName(film, n.scene)}</span>
                  {m === 'fixed' ? <Chip className="is-keep">Fixed</Chip> : m === 'again' ? <Chip className="is-must">Sent back</Chip> : null}
                </span>
                <span className="replies-yours">You: {n.text}</span>
                <span className="notes-reply"><span className="notes-reply-who">Claude</span>{n.reply}</span>
              </button>
              <div className="replies-actions">
                {m ? (
                  <Button variant="quiet" onClick={() => useReplyMarks.getState().mark(key, n.id, null)}>Change my answer</Button>
                ) : (
                  <>
                    <Button onClick={() => useReplyMarks.getState().mark(key, n.id, 'fixed')}><Icon name="check" />Fixed</Button>
                    <Button variant="quiet" onClick={() => again(n)}>Not yet</Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
