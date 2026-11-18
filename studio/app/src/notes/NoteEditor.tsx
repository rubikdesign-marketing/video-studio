import { useEffect, useRef, type KeyboardEvent } from 'react';
import { formatTime, sceneAt, sceneName } from '../canvas/format';
import type { DraftNote } from '../contracts/review';
import { usePlayback } from '../playback';
import { editor, useEditedFilm, useNotes, useSelection } from '../store';
import { Button, Chip, Field, Segmented } from '../ui';
import { addNoteInOrder, playhead } from './actions';
import { useComposer } from './composer';
import { TOPICS } from './topics';
import './notes.css';

const kinds = [
  { value: 'change' as const, label: 'Change this' },
  { value: 'keep' as const, label: 'Keep this' },
];
const ask = { change: 'What should change here, and how would you like it instead?', keep: 'What works here, so it is kept and used again?' };

/** Adds the note being written at the playhead. False when there are no words yet. */
export function addComposedNote(): boolean {
  const c = useComposer.getState();
  if (!c.text.trim()) {
    c.askFocus();
    return false;
  }
  if (usePlayback.getState().playing) usePlayback.getState().toggle();
  addNoteInOrder(editor, { time: playhead(), text: c.text, kind: c.kind, topic: c.topic, must: c.must, box: c.box });
  c.clear();
  return true;
}

/** Starts a note at this moment: stops the film and puts the cursor in the note field (the `N` key). */
export function startNote(): void {
  if (usePlayback.getState().playing) usePlayback.getState().toggle();
  editor.select(null);
  // Take the cursor now, so a letter typed straight after the key lands in the note and is not read as a shortcut.
  document.querySelector<HTMLTextAreaElement>('.notes-editor textarea')?.focus();
  useComposer.getState().askFocus();             // and again after the next draw, for a panel that was closed
}

/** Turns "point at an area" on or off for the note in hand. Turning it off takes the area away. */
export function toggleMarking(selected: DraftNote | null): void {
  const c = useComposer.getState();
  if (!c.marking) {
    if (usePlayback.getState().playing) usePlayback.getState().toggle();
    c.set({ marking: true });
    return;
  }
  c.set({ marking: false, box: null });
  if (selected) editor.changeNote(selected.localId, { box: null });
}

/** The note being written, or the selected note. Same controls for both. */
export function NoteEditor() {
  const film = useEditedFilm();
  const selection = useSelection();
  const notes = useNotes((s) => s.notes);
  const good = useNotes((s) => s.goodScenes);
  const composer = useComposer();
  const time = usePlayback((s) => s.time);
  const root = useRef<HTMLDivElement>(null);

  const selected = selection?.kind === 'note' ? (notes.find((n) => n.localId === selection.localId) ?? null) : null;
  const note = selected ?? composer;
  const change = (patch: Partial<Pick<DraftNote, 'kind' | 'text' | 'topic' | 'must'>>) => {
    if (selected) editor.changeNote(selected.localId, patch.kind === 'keep' ? { ...patch, must: false } : patch);
    else composer.set(patch);
  };

  useEffect(() => {
    if (composer.focusAsk) root.current?.querySelector('textarea')?.focus();
  }, [composer.focusAsk]);

  const onKeyDown = (event: KeyboardEvent) => {
    // The shortcut keys are ignored while typing, so the field handles its own: Cmd or Ctrl with Enter adds the note.
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !selected) {
      event.preventDefault();
      addComposedNote();
    }
  };

  const here = sceneAt(film, time);
  const isGood = !!here && good.includes(here.id);
  const marked = selected ? selected.box : composer.box;

  return (
    <div className="notes-editor" ref={root} onKeyDown={onKeyDown}>
      <h3 className="notes-title">
        {selected ? 'Note at ' : 'Your note at '}
        <span className="time">{formatTime(selected ? selected.time : time)}</span>
      </h3>
      <Segmented label="Kind of note" options={kinds} value={note.kind} onChange={(kind) => change({ kind })} />
      <Field label="Note" hideLabel multiline rows={4} value={note.text} onChange={(text) => change({ text })} placeholder={ask[note.kind]} />
      <div className="notes-row" role="group" aria-label="About">
        <span className="notes-label">About</span>
        {TOPICS.map((topic) => (
          <Chip key={topic} selected={note.topic === topic} onClick={() => change({ topic: note.topic === topic ? null : topic })}>
            {topic}
          </Chip>
        ))}
      </div>
      <div className="notes-row">
        <Button aria-pressed={composer.marking} onClick={() => toggleMarking(selected)}>
          {composer.marking ? 'Remove the area' : marked ? 'Point at another area' : 'Point at an area'}
        </Button>
        {note.kind === 'change' ? (
          <Chip selected={note.must} onClick={() => change({ must: !note.must })}>
            Must fix
          </Chip>
        ) : null}
        <span className="notes-gap" />
        {selected ? (
          <>
            <Button variant="quiet" onClick={() => editor.removeNote(selected.localId)}>
              Remove
            </Button>
            <Button variant="primary" onClick={() => editor.select(null)}>
              Done
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => addComposedNote()}>
            Add note
          </Button>
        )}
      </div>
      {composer.marking ? <p className="notes-quiet">Drag on the film to mark the area this note is about.</p> : null}
      <div className="notes-row">
        <Button
          aria-pressed={isGood}
          disabled={!here}
          onClick={() => here && editor.setSceneGood(here.id, !isGood)}
        >
          {isGood ? `${sceneName(film, here?.id)} is marked as good` : 'This scene is good'}
        </Button>
      </div>
    </div>
  );
}
