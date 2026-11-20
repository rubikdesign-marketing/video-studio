Owned by Worker 4: state, history, server and shortcuts (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

The editor's state. Import from `../store`:

- `editor`: the one editor of the page. `editor.open(job)` loads a film. Every change is a method on it
  (`addNote`, `changeNote`, `removeNote`, `setSceneGood`, `setCueWords`, `setCueTime`, `resetCue`, `send`, ...), and each
  one that changes notes or text goes through the history with a plain label, so it can be undone.
- `history`: the History contract (`run`, `undo`, `redo`, `canUndo`, `canRedo`, `labels`). For a change of your own
  that is not a method above, build a Command and call `history.run(command)`.
- Hooks: `useFilm`, `useEditedFilm`, `useEditedCue`, `useNotes`, `useEdits`, `useSelection`, `useHistory`, `useSaving`,
  `useSaveLabel`. Select one value per hook call.
- Saving happens by itself a moment after the last change. `useSaving` says where it stands; when `stale` is true the
  film changed under the text edits: show `message` and offer a button that calls `editor.reloadFilm()`.

Playback and snapping are not here: they are Worker 2's.
