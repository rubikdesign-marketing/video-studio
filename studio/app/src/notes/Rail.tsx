import type { ReactNode } from 'react';
import { editor, useEditedFilm, useFilm, useNotes, useSelection } from '../store';
import { Button, Icon, Segmented } from '../ui';
import { NoteEditor } from './NoteEditor';
import { NotesList } from './NotesList';
import { useRail, type RailTab } from './railTab';
import { SentBatches } from './SentBatches';
import './notes.css';

/** How many scenes are ticked as looking good, as a row of marks: the review's progress at a glance. */
export function SceneProgress({ children }: { children?: ReactNode }) {
  const film = useEditedFilm();
  const good = useNotes((s) => s.goodScenes);
  if (!film) return null;
  const done = film.scenes.filter((s) => good.includes(s.id)).length;
  return (
    <div className="rail-progress">
      <p className="rail-progress-row">
        <span>Scenes that look good</span>
        <span><strong className="time">{done}</strong> of {film.scenes.length}</span>
      </p>
      <div className="rail-ticks" style={{ gridTemplateColumns: `repeat(${film.scenes.length}, 1fr)` }} aria-hidden="true">
        {film.scenes.map((s) => <i key={s.id} className={good.includes(s.id) ? 'is-on' : undefined} title={s.title} />)}
      </div>
      {children}
    </div>
  );
}

export interface RailProps {
  /** The inspector, shown in place of the notes while a scene or on-screen words are selected. */
  inspector: ReactNode;
  /** Extra controls under the progress bar (the guided review button). */
  progressExtra?: ReactNode;
  /** The replies tab's content, when the latest batch has replies to check. */
  replies?: { count: number; content: ReactNode };
}

/**
 * The notes rail: tabs, progress, the notes in film order and the composer pinned at the bottom.
 * While a scene or on-screen words are selected, the inspector takes the notes' place (EDITOR-V2-PLAN.md, phase A).
 */
export function Rail({ inspector, progressExtra, replies }: RailProps) {
  const selection = useSelection();
  const notes = useNotes((s) => s.notes.length);
  const sent = useFilm((s) => s.batches.reduce((n, b) => n + b.notes.length, 0));
  const tab = useRail((s) => s.tab);
  const setTab = useRail((s) => s.setTab);
  const inspecting = selection !== null && selection.kind !== 'note';
  const shown: RailTab = tab === 'replies' && !replies ? 'send' : tab;
  const tabs: { value: RailTab; label: string }[] = [
    { value: 'send', label: `To send (${notes})` },
    { value: 'sent', label: `Sent (${sent})` },
    ...(replies ? [{ value: 'replies' as const, label: `Replies (${replies.count})` }] : []),
  ];

  return (
    <div className="rail">
      <div className="rail-head">
        <Segmented label="Notes" className="rail-tabs" options={tabs} value={shown} onChange={(t) => { setTab(t); editor.select(null); }} />
        <SceneProgress>{progressExtra}</SceneProgress>
      </div>
      <div className="rail-body">
        {inspecting ? (
          <>
            <Button variant="quiet" className="rail-back" onClick={() => editor.select(null)}>
              <Icon name="back" />
              Back to the notes
            </Button>
            {inspector}
          </>
        ) : shown === 'sent' ? <SentBatches /> : shown === 'replies' && replies ? replies.content : <NotesList />}
      </div>
      {!inspecting && shown === 'send' ? <div className="rail-foot"><NoteEditor /></div> : null}
    </div>
  );
}
