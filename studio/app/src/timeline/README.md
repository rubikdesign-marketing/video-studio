Owned by Worker 2: timeline and playback (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

`Timeline` (no props) draws the open film from the store: a ruler, the playhead, and five lanes (scenes, voice,
on-screen text, notes, energy). It shows the film with the pending text edits applied.

- `index.tsx`: the component. `timeline.css`: its styles, theme roles only.
- `snap.ts`: the pure `snap` function (the `Snap` contract), the list of snap points, and `dragCue`, which decides
  where a dragged on-screen text lands.
- `view.ts`: zoom, fit, ruler marks and which lanes are hidden or locked (remembered per browser).
- `demo.html` and `demo.tsx`: a stand-alone page for looking at the timeline with the sample film
  (`npm run dev`, then open /editor/src/timeline/demo.html). Not part of the built app.

Dragging an on-screen text writes nothing while the pointer is down. On release it calls `editor.setCueTime` once,
so one drag is one step to undo.
