# Before you buy: what Video Studio does, what it needs, what it costs

Draft for the owner, 18 November 2026. Every number here was measured on one Apple M4 Mac (16 GB) on that day, or is marked as not measured. Prices of other companies' services change; check them at purchase.

## Who it is for, and the promise

**For** founders and marketers of a software product, and small shops, who post short videos every week and have no editor.

**The promise we can show today:** describe the video in your own words and add what you have. Get a watchable preview in minutes, in your brand. Ask for changes in plain words, shot by shot, and get a report that each change landed and nothing else moved. Make the next one in the same style with only the new words to decide.

## Formats

| Format | Status | What it is made from | Evidence |
|---|---|---|---|
| Kinetic-type launch reel, 10 to 30 s, no voice or with a voice-over | **Ready** | Type, motion and sound from the studio's library, in your brand | The Halden example: first preview 11 s after the shot list, master 19 s, one revision checked and exported, second episode started from the style (`docs/release-test-2026-11-18.md`). Tulvo's gunshot teaser, sticky-note reel, whiteboard reel and "Sorted" were approved by their owner. |
| Product demo of a web product, 15 to 60 s | **Ready** | Real screen captures of your product, motion, a voice-over | Tulvo's Product Hunt demo (approved, revision 3) and Imagine Notion (50 s; delivered, then revised on comprehension notes, which is why every shot now names what it proves). |
| Edit of your own footage (talking head, event clips) | **Ready, with a person checking the cut by ear** | Your footage: transcript editing, face framing, sound clean-up | Tulvo's Product Hunt launch reel. |
| Platform cuts (4:5, 1:1 from a 9:16 master) | **Ready when the film is centred** | A crop that refuses if anything on screen would be lost | Halden 4:5 cut. Films framed by hand (Imagine Notion) are refused and need a native render. |
| Generated presenter (UGC style) | **Pilot only** | Kling, after a short spoken test with sound is approved | The one attempt (launch remake V5) was scrapped: it missed what the reference was liked for. |
| Animated short with recurring characters | **Pilot only** | Drawn motion or generated shots, after a performance test | Not yet attempted in the studio. |

## What you need

- A Mac (tested only on Apple silicon, macOS 26; older versions not yet tried), about 8 GB free for the studio and its tools (measured on the owner's Mac: engine 1.4 GB, footage tools 0.9 GB, listening models 3.4 GB) plus space for renders (a 12 s master is 8 MB; a 50 s master about 30 MB, plus working files).
- The Claude desktop app with a plan that includes Claude Code. Claude does the directing, writing and building; the studio's tools do the measuring and rendering on your Mac.
- One install step (`ONBOARDING.md`): it installs Homebrew programs, Node, Python tools and the engine, then runs the health check. The check now says what each missing optional piece turns off, instead of stopping.
- Optional: an ElevenLabs paid plan for generated voice-over, music and effects; a Kling account for generated footage; your product open in the browser pane (a demo account) for product demos.
- Remotion, the renderer, is free for individuals and companies of up to three people. Larger companies need a Remotion company licence.

## What it costs to run

| Cost | Where it comes from | Measured |
|---|---|---|
| Your Mac's time | Every render is timed in the job's `runs.jsonl` | 12 s reel: preview 11 to 13 s, master 19 s. 50 s product promo: preview 84 s, one changed scene 33 s, master about 4 min. |
| AI tokens | Your Claude plan | Not yet measured per film: the app does not give the session its own token count. The cost report says "not recorded" and the session can add the figure from the app. |
| Generated footage and images | Your Kling account | Through a ledger that never pays twice for the same request. Kling does not report credits per request; read them in your Kling account. Past example: about 700 credits for one 14 s reel with 18 generated clips over two rounds. |
| Voice and music | Your ElevenLabs plan | Not needed for type-and-sound films; the sound library is free to use. |

## Rights

- **Sound library:** every sound is CC0 (public domain) or made in the studio and given away as CC0, with its source and licence per file (`library/sounds/CREDITS.md`).
- **Fonts:** under their own licences, noted in each brand's `brand.md`. Instrument Serif and Inter (included) are SIL Open Font Licence.
- **Reference films** are for study only and never placed in a film. They are not shipped.
- **People on screen:** filmed people need recorded consent; generated people are never presented as real customers or staff.
- **Your footage and screens** stay on your Mac. Recordings, renders, footage and keys are kept out of the repository by design.
- **The studio itself:** the current `LICENSE.md` reserves all rights and needs written permission for business use. **A customer licence is needed before selling** (owner decision; `LICENSE-DRAFT.md` is a start).

## What you can rely on

- The last good version is never lost: a failed or interrupted render or master leaves the previous file in place, and older versions are kept in `out/versions/`.
- A crashed or closed session leaves nothing stuck: the next render clears a dead lock on its own.
- A paid generation is never paid for twice by a retry.
- Each revision is checked shot by shot against your notes.
- Old projects reopen and render with the current tools (Imagine Notion, made the day before these changes, re-rendered unchanged).

## What you cannot rely on yet

- Judgments of taste, timing heard at speed, and sound. Claude cannot watch at speed or hear. The studio measures and reports; a person watches with sound before anything is published.
- A first-time user installing it without help: not yet tried on a clean Mac by someone new (`docs/trial/first-time-creator.md` is ready).
- Generated presenters and characters (pilot only, above).
