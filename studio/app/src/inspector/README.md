Owned by Worker 3: canvas and inspector (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

`Inspector` shows the selected scene (read-only) or the selected on-screen text, whose words and timing can be changed. Every change goes through the store's edit commands (`setCueWords`, `setCueTime`, `resetCue`), so it is checked and can be undone. `SceneList` is the list of scenes and their on-screen texts for the left panel.
