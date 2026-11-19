# Editor v2: build plan

Source of the design: the approved prototype "Video Studio Editor" (claude.ai artifact, version 4, 19 Nov 2026).
Branch: `studio-editor-v2`, from `release-zip` (051911d, the commit Damex Video Engine 0.1.0-rc4 was exported from).

## Rules carried over

- The film on disk stays the truth. Only on-screen words and their timing change in the page; everything else is a note.
- Lime (paper: blue) marks only the main decision, the playhead, focus and changed words. Selected states use the raised neutral.
- Plain words for marketers. No promise the data cannot keep.
- Every shortcut lives in `shortcuts/table.ts`, so the sheet and the command menu list it.

## Phase A: review layout

1. **Shell**: two columns (film and the notes rail) over the timeline. `left` becomes optional; with none there is no left panel and no switch for it. Panel switches read "Notes" and "Timeline".
2. **Top bar**: film and version on the left, Review / Paper edit in the middle, then save or render status, undo and redo, the command menu, the shortcut sheet, a "You" menu (name and theme), and one decision button that knows the state:
   "Send N notes" while notes wait, "Check N replies" while a done batch has replies not yet checked, "Waiting for the next version" while a batch is with Claude, else "Approve version". Its menu holds the send panel: name if missing, the four checks, send, approve, bring back earlier notes.
3. **Rail**: tabs To send, Sent, Replies (when there are any). Under the tabs, scenes checked as a bar of ticks. Notes list in film order. The note composer pinned at the bottom. The inspector takes the rail's place while a scene or on-screen words are selected. The left panel's scene list, version list and sent list are dropped (the timeline, the version picker and the Sent tab cover them).
4. **Canvas**: one transport under the film (frame back, play, frame forward, time, speed, repeat scene) with "Note at 0:04.60" at its end. Phone size, title-safe, thirds, safe zones and compare move into one View menu over the film. The timeline's own play, scene and speed controls go.
5. **Timeline**: Scenes, On-screen words and Notes by default. Voice only when the film has voice lines; Energy (renamed Pace) off by default. Hide and Lock move into a Lanes menu. Each scene block gets a "looks good" tick.
6. **Accent**: Segmented, Chip and toggle buttons show selection with the raised neutral, not the accent.

## Phase B: the review loop

1. **Review scene by scene**: plays the first unchecked scene, stops at its end, asks Looks good (G), Add a note (N) or Again (R); Enter goes on after a note. Ends with send or approve.
2. **Quick reactions**: keys 1 to 4 (Too fast, Too slow, Hard to read, Keep) add a note at once. Keep uses the existing `keep` kind.
3. **Notes on a stretch**: `DraftNote.end` (optional). I and O mark from or to the playhead; dragging in the Notes lane does the same. The server keeps `end` in the batch and the feedback log; the skill reads it.
4. **Replies**: when a batch is done, its notes with replies show in the Replies tab with Fixed and Not yet. Not yet adds the note back as must fix. Checked state is remembered per film in the browser.
5. **Frame preview**: hovering the ruler or a lane shows the frame there, from a second hidden video.
6. **Commands**: every new action gets a row in the shortcut table, so Cmd+K finds it.

## Phase C: Paper edit

One reading column with the take and time in a margin, a handle and a menu per sentence, Edit and Read views, the length against `target_seconds`, joins to check as the decision button's first step, retakes as a choice of take, fillers in bulk, opening ideas with reasons, a readable edit strip with the target line.

## Not in this build

- **Suggested cuts to fit the target** (Paper edit): needs a new footage-tool step that ranks sentences; the page only shows them. Next build.
- Claude's progress as named steps ("reading notes", "changing the film"): the run log does not record them yet. The page shows what exists: rendering progress and a new version arriving.

## Status (19 Nov 2026)

Phases A, B and C are built on `studio-editor-v2`. Checked: 296 app tests, 24 server tests, typecheck, build, and the
running editor on the Halden example film (desktop, Paper theme, phone width) and on a transcript-only copy of a
real paper edit. Not checked: video playback of a paper edit (the copy had no clips), a real batch answered by Claude
end to end, and Windows.

## Checks

`npm run typecheck`, `npm test` (282 passing before the build), `npm run build`, the server tests in `studio/tests`, and a look at the running editor on a real job at desktop and phone width.
