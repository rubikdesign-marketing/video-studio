# Release test, run by Claude standing in for a first-time creator

18 November 2026, Apple M4, 16 GB. The test: install, make a video for a brand other than Tulvo, change one specific shot, export it, start a second video in the same style, and survive an interrupted job. Claude played the creator, so **this proves the tools, not the first-time experience**. The human trial is `docs/trial/first-time-creator.md`.

## The example

Halden Bakehouse, an invented bakery (`brands/halden`, marked as not a real business). Episode 1: `jobs/2026-11-18-halden-launch`, a 12 s vertical reel, no voice, type and CC0 library sound. Episode 2: `jobs/2026-11-18-halden-saturday-croissants`, started from the saved style `halden/morning-type`.

| Step | Command | Result |
|---|---|---|
| New brand | `tools/brand/new.mjs halden --from demo`, colours, type and logo edited | Brand check passed |
| The creator's words | `brief.mjs new` with "A short vertical reel announcing that our bakery now opens at 6:30…" | 9:16 and launch reel taken from their words, said back, not asked |
| Questions | `brief.mjs check` | 4 asked (what the reference is liked for, what the viewer should do, voice, length), at most 3 at a time |
| Shot list | `shots.json`, every shot with a point and an eye | `brief.mjs check` clean |
| First preview | `scaffold.mjs` then `render.sh preview` | **11 s** to render, in the brand's colours and type, from placeholder scenes; 13 s with the built scenes |
| Defect found by looking | The logo's name was cut off ("BAKEHOUS") | Caught by viewing the board, not by any automatic check. Added to "what still needs a person" |
| Revision notes | "keep everything I liked, slow down the 6:30 part, and fix the ending: bigger, and the name is cut off" | 4 notes in `revisions.json`, mapped to S02, S04 and the rest |
| First revision attempt | `revisions.mjs verify` | **Caught a miss:** the 6:30 hold was 3.15 s, not the 3.4 s asked for. Also flagged S03 as changed (48 dB) when only film grain had moved with time; the threshold was recalibrated from this measurement |
| Second attempt | `verify` again | 4 of 4 notes done, nothing changed without a note |
| Export | `render.sh master` | **19 s**: 1080×1920, -13.5 LUFS, -1.4 dBTP; 0 jumps, 0 judder, flashes within limits |
| 4:5 feed cut | `tools/film/cut.py` | Written, 48 moments checked, nothing lost. The same tool refused a 16:9 crop of this film and a 9:16 crop of Imagine Notion |
| Second episode | `style.mjs save`, then `style.mjs new … "croissants every Saturday from 7, only 60 a week"` | Started in under a second; **1 question** asked (what the viewer should do); the bigger-logo and longer-hold corrections carried over; preview **11 s** after the words were filled |
| Studio change, no film change | Labels moved from scene code into the shot list | `verify` with "keep all" caught that the film had not been refreshed (2 scenes changed), then confirmed nothing moved once it was. Snapshots now refresh the film themselves |
| Interrupted job | Kill a 50 s preview render at frame 647 of 3,000 | Previous preview intact (same checksum); next render cleared the dead lock on its own |

## Before and after, same inputs

| Measure | Before | After | Source |
|---|---|---|---|
| Storyboard, Imagine Notion, 19 frames | 37.6 s | 8.3 s (12.7 s one at a time; 22.1 s first run) | `docs/benchmarks/2026-11-18-speed-and-recovery.md` |
| Review copy of a 9:16 film | 1280×2276 | 720×1280 | same |
| A failed master | Overwrote the last good one | Last good one kept | same |
| A killed storyboard | Every later render waited forever | Next render proceeds | same |
| A retried paid generation | Could pay twice | Paid once | stand-in server tests |
| Revision accuracy | Not measured: notes were read and answered in prose | Every note checked; one miss and one false alarm caught in this test | `jobs/2026-11-18-halden-launch/revisions/r2/report.md` |
| Questions before production | Grilling rounds on every topic | Only decisions that change the film; settled words said back | `brief.mjs` |
| Cost per job | "not recorded" in all four Imagine Notion stages | Machine time recorded automatically; tokens and credits marked "not recorded" until supplied | `tools/film/costs.mjs` |
| Second video in a style | Full six approvals and a new library move | 1 question, then storyboard | this test |

## Not measured, needs a person

- Whether the films are good: visual quality, whether the pacing feels right, whether the sound works at speed. Claude cannot watch at speed or hear.
- First-pass approval rate and reference fidelity: needs real creators and real references, over several films.
- Whether a viewer understands the action after one watch (the audit's phone test on Imagine Notion's copy-and-paste scene is still to be done).
- Token use per stage (not available to the session).
- Install on a clean Mac by someone new.
