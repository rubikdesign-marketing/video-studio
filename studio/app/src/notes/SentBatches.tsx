import { api } from '../api';
import { formatTime, sceneName } from '../canvas/format';
import { usePlayback } from '../playback';
import { useEditedFilm, useFilm } from '../store';
import { Chip } from '../ui';
import './notes.css';

const status: Record<string, string> = { sent: 'Sent, waiting', 'picked up': 'Being worked on', done: 'Done' };
const when = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

/** What was sent earlier, newest first, with where each batch stands and any reply. */
export function SentBatches() {
  const film = useEditedFilm();
  const job = useFilm((s) => s.job);
  const batches = useFilm((s) => s.batches);
  if (!batches.length || !job) return <p className="notes-quiet">Nothing has been sent yet.</p>;
  return (
    <div className="notes-batches">
      {[...batches].reverse().map((batch) => (
        <section key={batch.batch} className="notes-batch" aria-label={`Sent ${when(batch.sent_at)}`}>
          <p className="notes-meta">
            <strong>{when(batch.sent_at)}</strong>
            {batch.reviewer ? <span>from {batch.reviewer}</span> : null}
            <Chip>{status[batch.status] ?? batch.status}</Chip>
            {batch.approved ? <Chip>Approved</Chip> : null}
            {batch.good_scenes.length ? <Chip>{batch.good_scenes.map((id) => sceneName(film, id)).join(', ')} good</Chip> : null}
          </p>
          <ul className="notes-list">
            {batch.notes.map((note) => (
              <li key={note.id} className="notes-card is-sent">
                <button type="button" className="notes-card-main" onClick={() => usePlayback.getState().seek(note.time)}>
                  {note.frame ? <img className="notes-frame" src={api.frameUrl(job, note.frame)} alt="" /> : null}
                  <span className="notes-meta">
                    <strong className="time">{note.end ? `${formatTime(note.time)} to ${formatTime(note.end)}` : formatTime(note.time)}</strong>
                    <span>{sceneName(film, note.scene)}</span>
                    {note.kind === 'keep' ? <Chip>Keep</Chip> : null}
                    {note.must ? <Chip>Must fix</Chip> : null}
                    {note.topic ? <Chip>{note.topic}</Chip> : null}
                    {note.box ? <Chip>Area marked</Chip> : null}
                  </span>
                  <span className="notes-text">{note.text}</span>
                  {note.reply ? <span className="notes-reply"><span className="notes-reply-who">Claude</span>{note.reply}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
