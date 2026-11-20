# Paper edit mode: what it does, and how each part was checked (18 Nov 2026)

Paper edit mode is the old transcript page (`studio/paper.html`, still at `/paper`) inside the editor, at
`/editor/?job=<job>&mode=paper`.

## How it was run for real

- The studio server was started against a temporary folder (`STUDIO_ROOT`), never the real jobs.
- The job in it was made with the footage tool's own `firstPaper` function from two short clips: hand-written word
  times, and two 14-second test videos with a tone, made with ffmpeg. Nothing from it is in the repository.
- The browser was a real Chromium driven by Playwright, not the app's preview pane. That pane was hidden during the
  last ticket and gives a hidden page no animation frames, so it was not used. In this browser the page got about 120
  frames a second and the video really played.
- The screenshots are at the page's true size.

| File | Width | Theme | What it shows |
|---|---|---|---|
| `1440-paper-opened.png` | 1440 | Paper | Just opened |
| `1440-paper-cut-moved-approved.png` | 1440 | Paper | A word cut, a sentence moved, the flagged join approved, a pause kept |
| `1440-paper-sent.png` | 1440 | Paper | After "Send with notes" |
| `1440-paper-after-check.png` | 1440 | Paper | After the full check below |
| `1440-night-after-check.png` | 1440 | Night | After the full check below |
| `768-paper-opened.png` | 768 | Paper | Just opened |
| `768-paper-after-check.png` | 768 | Paper | After the full check, with the right panel open as a drawer |
| `768-night-after-check.png` | 768 | Night | The same in night |
| `old-page-still-works.png` | 1440 | (old page) | The old `/paper` page after the same edits and a send |

**The full check**, run in all four combinations (1440 and 768, night and paper), every line passing in each:
cut a word (the tool then flagged the join), hear a cut word with Shift-click, move a sentence down, approve the
flagged join, play the edit, stop it with Space, send with notes and read the file back from the server. Also no
sideways page scroll, and the video and the Send button in view (at 768 the Send box is in the right-hand drawer).

**Send writes the same file.** The same edits were made in the new mode and then, from the same starting file, on the
old page, each followed by "Send with notes". The two `paper.json` files were identical, key for key and in the same
order, apart from the `saved_at` and `sent_at` times. Neither page wrote any other file.

## Feature list from the old page

"Test" means the automated tests in `src/modes/paper/` (`store.test.ts`, `player.test.ts`, `PaperMode.test.tsx`).
"Browser" means seen in the real run above.

| # | The old page does this | Done | Proof |
|---|---|---|---|
| 1 | Lists the jobs that have a paper edit, marks the sent ones, opens the one in `?job=` (or the first), keeps the address in step | Yes | Test, browser |
| 2 | Remembers "Your name" | Yes | Test. It is the same name as in Review, and a name typed on the old page is taken over once |
| 3 | Says "No paper edits yet" and how to make one | Yes | Test |
| 4 | Shows the length, the target, and how many joins still need a look; marks it when over the target | Yes | Test, browser |
| 5 | Shows Saving, Saved, Not saved, Sent | Yes | Test, browser |
| 6 | One card per sentence: clip and time, "Take 1 of 2", "opening idea"; a fully cut sentence is set back | Yes | Test, browser |
| 7 | Click a word to cut it or bring it back; fillers and possible fillers are marked; the time shows on hover | Yes | Test, browser |
| 8 | Enter or Space on a word does the same | Yes | Test, browser (a real Enter press) |
| 9 | Shift-click, or Shift with Enter, plays from that word for 2.5 seconds, cut or not | Yes | Test, browser (played 2.5 s and stopped) |
| 10 | Long pauses show as "pause 1.4 s → 0.5 s"; click to keep the pause as said | Yes | Test, browser |
| 11 | A flagged join shows why, with "It keeps the meaning"; approved ones show "Approved" with "Undo" | Yes | Test, browser (flagged by the real tool after a cut) |
| 12 | Up, Down, To the start, Cut sentence, Keep all | Yes | Test, browser |
| 13 | Ideas for the opening line with reasons, and "Open with it" (a cut sentence comes back without its fillers) | Yes | Test, browser (the list) |
| 14 | "Lines said more than once" explains the takes | Yes | Test, browser |
| 15 | A note for the editor, saved by itself 600 ms after typing; edits save 350 ms after a click | Yes | Test, browser |
| 16 | "Send: ready for the rough cut" (refused while a join needs a look) and "Send with notes, not ready yet", each with its message | Yes | Test, browser (with notes) |
| 17 | The video shows the opening picture; "Play the edit" plays the kept stretches in order across clips; Stop | Yes | Test, browser (six stretches over two clips, then it stopped) |
| 18 | While playing, the word being said is lit (cut words are not, unless you asked to hear one), the last word and the clip time are shown | Yes | Test, browser |
| 19 | Space plays or stops the edit, but not while typing or with a word or button in focus | Yes | Test, browser |
| 20 | After every save the joins, length and stretches come back fresh from the server | Yes | Test, browser |
| 21 | Clips with sound only still play | Yes | The same player element is used and "This clip is sound only." is shown. Not run with a real sound-only clip |
| 22 | The line of key hints | Yes | Test, browser |

The payloads: a test lifts the old page's own `save` function out of `paper.html`, runs it, and compares its requests
with the new mode's. Addresses and bodies match byte for byte, for a save and for both kinds of send.

## New in the editor, beyond the old page

- Undo and redo for every click (words, sentences, opening ideas, pauses, joins), with plain labels.
- The edit as a strip under the video: click a stretch to play from there.
- Keys for the sentence in focus: Alt with Up or Down moves it, Alt with Backspace cuts it or brings it back, Escape stops playing. They are in the shortcut sheet.
- Night theme, the resizable panels, and the Review / Paper edit switch in the top bar.

## Not checked

- "Send: ready for the rough cut" in the browser (only "with notes" was sent for real; "ready" is covered by tests).
- A real sound-only clip, real speech, and a long transcript (the sample has six sentences).
- A real mouse or touch: clicks were made by Playwright or sent from the page. Safari and Firefox.
- Exact cut points. The stretches the server gave back in this run were word times (its fallback, 0.08 s before the
  first word), not cut points placed on the sound, so "Play the edit" was not heard with the footage tool's own cuts.
