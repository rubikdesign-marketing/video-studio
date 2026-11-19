import { useEffect } from 'react';
import { create } from 'zustand';
import { usePlayback } from '../playback';
import { registerReviewShortcuts } from '../shortcuts';
import { editor, useEditedFilm, useNotes } from '../store';
import { Button, Icon } from '../ui';
import { startNote } from './NoteEditor';
import { useRail } from './railTab';
import './notes.css';

/**
 * Review scene by scene (EDITOR-V2-PLAN.md, phase B1). It plays the first scene not yet marked as looking good,
 * stops at its end and asks: looks good, add a note, or watch again. Each answer moves on; the end offers to send.
 * First-time reviewers do not know where to start or when they are done; this gives them both.
 */
export type GuideStatus = 'off' | 'watching' | 'asking' | 'done';
export interface GuideState { status: GuideStatus; index: number; noted: boolean; notesAtAsk: number }

export const useGuide = create<GuideState>(() => ({ status: 'off', index: 0, noted: false, notesAtAsk: 0 }));

const scenes = () => editor.stores.film.getState().film?.scenes ?? [];

function go(index: number): void {
  const scene = scenes()[index];
  if (!scene) return;
  useGuide.setState({ status: 'watching', index, noted: false });
  const p = usePlayback.getState();
  p.setLoop(null);
  p.seek(scene.start);
  p.play();
}

/** Starts the walk from the first scene still to check, or stops it when it is running. */
export function toggleGuide(): void {
  const s = useGuide.getState();
  if (s.status === 'watching' || s.status === 'asking') return stopGuide();
  const good = editor.stores.notes.getState().goodScenes;
  const first = scenes().findIndex((sc) => !good.includes(sc.id));
  useRail.getState().setTab('send');
  editor.select(null);
  go(first < 0 ? 0 : first);
}
export function stopGuide(): void {
  useGuide.setState({ status: 'off', noted: false });
}
export function guideNext(): void {
  const next = useGuide.getState().index + 1;
  if (next < scenes().length) go(next);
  else useGuide.setState({ status: 'done' });
}
export function guideAgain(): void {
  go(useGuide.getState().index);
}
/** The scene looks good: mark it and go on. */
export function guideGood(): void {
  const scene = scenes()[useGuide.getState().index];
  if (scene) editor.setSceneGood(scene.id, true);
  guideNext();
}

/** Stops the film at the end of the scene being watched, and notices a note added while it asks. */
function useGuideWatch(): void {
  useEffect(() => {
    const stopAtEnd = usePlayback.subscribe((s, before) => {
      const g = useGuide.getState();
      if (g.status !== 'watching' || s.time === before.time) return;
      const scene = scenes()[g.index];
      if (!scene) return;
      const frame = 1 / (s.fps || 30);
      if (s.time >= scene.end - frame * 2 || (!s.playing && s.time >= scene.end - 0.25)) {
        s.pause();
        s.seek(Math.max(scene.start, scene.end - frame));
        useGuide.setState({ status: 'asking', notesAtAsk: editor.stores.notes.getState().notes.length });
      }
    });
    const noticeNote = editor.stores.notes.subscribe((n) => {
      const g = useGuide.getState();
      if (g.status === 'asking' && n.notes.length > g.notesAtAsk && !g.noted) useGuide.setState({ noted: true });
    });
    return () => { stopAtEnd(); noticeNote(); };
  }, []);
}

/** The card over the film while the guided review runs. */
export function GuideCard({ onSend }: { onSend?(): void }) {
  useGuideWatch();
  const film = useEditedFilm();
  const { status, index, noted } = useGuide();
  const notes = useNotes((s) => s.notes.length);
  const good = useNotes((s) => s.goodScenes);

  // Again and Next have keys only while the card asks, so R and Enter do nothing anywhere else.
  useEffect(() => {
    if (status !== 'asking') return;
    return registerReviewShortcuts({ guideAgain, ...(noted ? { guideNext } : {}) });
  }, [status, noted]);

  if (status === 'off' || !film) return null;
  const total = film.scenes.length;
  const scene = film.scenes[index];
  const stop = (
    <Button variant="quiet" className="guide-stop" onClick={stopGuide}>
      {status === 'done' ? 'Close' : 'Stop'}
    </Button>
  );

  if (status === 'done') {
    const ok = film.scenes.filter((s) => good.includes(s.id)).length;
    return (
      <section className="guide-card" aria-label="Review scene by scene" aria-live="polite">
        <p className="guide-meta"><span>Scene by scene</span>{stop}</p>
        <h3 className="guide-title">That was the whole film.</h3>
        <p className="guide-text">
          {ok} of {total} scenes look good{notes ? `, and ${notes} note${notes > 1 ? 's are' : ' is'} waiting to send` : ''}.
          {notes ? ' Send them with the button at the top right.' : ' If it is ready, approve it with the button at the top right.'}
        </p>
        {onSend ? <div className="guide-actions"><Button variant="primary" onClick={onSend}>{notes ? 'Review and send' : 'Approve'}</Button></div> : null}
      </section>
    );
  }
  if (!scene) return null;
  return (
    <section className="guide-card" aria-label="Review scene by scene" aria-live="polite">
      <p className="guide-meta"><span>Scene {index + 1} of {total}</span>{stop}</p>
      {status === 'watching' ? (
        <p className="guide-text guide-watching"><Icon name="eye" />Watching “{scene.title}”. It stops at the end of the scene.</p>
      ) : (
        <>
          <h3 className="guide-title">How did “{scene.title}” feel?</h3>
          <div className="guide-actions">
            {noted ? (
              <Button variant="primary" onClick={guideNext}>Next scene <kbd className="guide-key">Enter</kbd></Button>
            ) : (
              <Button variant="primary" onClick={guideGood}><Icon name="circleCheck" />Looks good <kbd className="guide-key">G</kbd></Button>
            )}
            <Button onClick={() => startNote()}><Icon name="note" />{noted ? 'Another note' : 'Add a note'} <kbd className="guide-key">N</kbd></Button>
            <Button variant="quiet" onClick={guideAgain}><Icon name="again" />Again <kbd className="guide-key">R</kbd></Button>
          </div>
          <p className="guide-text guide-hint">Or press 1 to 4 for a quick note.</p>
        </>
      )}
    </section>
  );
}

/** The button under the progress bar that starts, continues or stops the walk. */
export function GuideButton() {
  const status = useGuide((s) => s.status);
  const film = useEditedFilm();
  const good = useNotes((s) => s.goodScenes);
  if (!film) return null;
  const running = status === 'watching' || status === 'asking';
  const some = film.scenes.some((s) => good.includes(s.id));
  return (
    <Button variant="quiet" onClick={toggleGuide} title="Review scene by scene (Shift+G)">
      <Icon name="guide" />
      {running ? 'Stop the scene-by-scene review' : some ? 'Continue scene by scene' : 'Review scene by scene'}
    </Button>
  );
}
