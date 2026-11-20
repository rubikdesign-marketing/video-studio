import { api } from '../../api';
import { useReviewer } from '../../notes';
import { editor, history } from '../../store';
import { createPlayer } from './player';
import { createPaper } from './store';

/** The paper edit of this page. Its steps go into the same history as the rest of the editor, so Undo covers them. */
export const paper = createPaper({
  api,
  history: { run: (c) => history.run(c), clear: () => editor.stores.history.getState().clear() },
  reviewer: () => useReviewer.getState().name,
});

/** The one player of the paper edit: a word, or the whole edit. */
export const player = createPlayer({
  clips: () => paper.store.getState().data?.clips ?? [],
  runs: () => paper.store.getState().check.runs,
  isCut: (clip, index) => !paper.store.getState().blocks.some((b) => b.clip === clip && b.words.includes(index)),
  url: (clip) => paper.clipUrl(clip),
});
