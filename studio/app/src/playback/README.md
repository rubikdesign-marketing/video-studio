Owned by Worker 2: timeline and playback (ARCHITECTURE_PLAN.md section 6). Other workers do not change files here.

`usePlayback` is the playback store (a Zustand hook whose state is `PlaybackPort`, plus a few extras).

- The canvas hands over its video element: `usePlayback.getState().attachVideo(el)`, and `attachVideo(null)` when it goes away.
- Read: `usePlayback((s) => s.time)`, `playing`, `rate`, `loop`, `duration`, `fps`. `time` changes every frame while the
  film plays, so read it only in small components.
- Do: `seek(t)`, `step(frames)`, `toggle()`, and the extras `play()`, `pause()`, `setRate(rate)`, `setLoop(loop)`,
  `toggleSceneLoop()`, `previousScene()`, `nextScene()`.
- `registerPlaybackShortcuts()` puts Space, the arrows and the scene keys in the shortcut table. Call it once; it returns
  the clean-up function.

`duration` and `fps` follow the film in the store. Opening another film puts the playhead back at the start.
