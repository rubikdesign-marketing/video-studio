import { formatTime, sceneAt, sceneName } from '../canvas/format';
import { usePlayback } from '../playback';
import { editor, useEditedFilm, useNotes, useSelection } from '../store';
import { Button, Chip, cx } from '../ui';
import './notes.css';

/** The notes not yet sent, in film order. Choosing one goes to its moment and opens it in the note editor. */
export function NotesList() {
  const film = useEditedFilm();
  const notes = useNotes((s) => s.notes);
  const selection = useSelection();
  if (!notes.length) {
    return (
      <p className="notes-quiet">
        Pause where something feels off and press N, or tick the scenes that already look good. Collect a few notes, then send them together.
      </p>
    );
  }
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  return (
    <ul className="notes-list">
      {sorted.map((note) => {
        const selected = selection?.kind === 'note' && selection.localId === note.localId;
        return (
          <li key={note.localId} className={cx('notes-card', note.kind === 'keep' && 'is-keep', note.must && 'is-must', selected && 'is-selected')}>
            <button
              type="button"
              className="notes-card-main"
              aria-current={selected ? 'true' : undefined}
              onClick={() => {
                if (usePlayback.getState().playing) usePlayback.getState().toggle();
                usePlayback.getState().seek(note.time);
                editor.select({ kind: 'note', localId: note.localId });
              }}
            >
              <span className="notes-meta">
                <strong className="time">{note.end ? `${formatTime(note.time)} to ${formatTime(note.end)}` : formatTime(note.time)}</strong>
                <span>{sceneName(film, sceneAt(film, note.time)?.id)}</span>
                {note.kind === 'keep' ? <Chip className="is-keep">Keep</Chip> : null}
                {note.must ? <Chip className="is-must">Must fix</Chip> : null}
                {note.topic ? <Chip>{note.topic}</Chip> : null}
                {note.box ? <Chip>Area marked</Chip> : null}
              </span>
              <span className="notes-text">{note.text || 'No words yet.'}</span>
            </button>
            <Button variant="quiet" aria-label={`Remove the note at ${formatTime(note.time)}`} onClick={() => editor.removeNote(note.localId)}>
              Remove
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
