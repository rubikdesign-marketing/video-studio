# Library proof: new way against old way

The same 15-second Tulvo film for Reels (9:16), made twice on 18 Nov 2026 with the same words and the same music bed. **Decided 18 Nov 2026:** the owner chose the new way on the studio's recommendation (it is better or level on every measure below), without comparing the two films first.

- New: `out/new.mp4` (composition `LibraryProof-New`)
- Old: `out/old.mp4` (composition `LibraryProof-Old`)
- Side by side, no sound: `out/side-by-side.mp4`

Renders stay on this Mac (`jobs/*/out/` is never synced). To make them again: `bash jobs/2026-11-18-library-proof/prepare.sh engine/out/lib-public`, then in `engine/`: `npx remotion render LibraryProof-New ../jobs/2026-11-18-library-proof/out/new-raw.mp4 --public-dir=out/lib-public` (and `-Old`), then master to -14 LUFS.

## The words

| Second | Line | Beat |
|---|---|---|
| 0 | Ten apps that never *talk* | Hook |
| 2 | Clients here. Invoices *there.* | The stake |
| 5 | In ten apps → In one place | Body |
| 10 | Describe it. Tulvo *builds it.* | Body (the peak) |
| 12.5 | Tulvo. Try it *free* | Payoff and offer |

Only claims Tulvo has made before (the save-the-date film): everything in one place, describe your business and it builds it. No reports, no product screens (none were captured for this test).

## What each uses

| | New | Old |
|---|---|---|
| Opening | Hook opener `opener-punch-in`: the line is on frame 0, then a hard punch into "talk" and out | The kit's headline rise |
| Text | `mask-rise`, `smear-in`, `retype` (types "In ten apps", deletes, types "In one place"), `fade-up`, `highlighter`, `word-pop` | Headline rise, `swap-word`, `blur-in`, `drawn-mark`, `tracking-settle` |
| Changes of scene | `whip-pan`, `iris-wipe`, a hard cut on the downbeat, `panel-wipe` | `momentum-cut`, `slide-off-reveal`, a hard cut, `zoom-through-swap` |
| Sound | 14 library sounds, each on its picture moment: a hit on frame 0 and on the punch, a whip on the swap, swishes on each line, a whoosh into the iris, keyboard bursts on the typing, a soft hit on the cut, a swish on the highlight, a riser into the end, a logo sting, a pop on the offer | The brand's own 6 kit sounds, one whoosh before each change, a pop, a chime, the logo sting |
| Cuts | On the bed's beats: 2.007, 5.007, 10.006, 12.505 s, planned with `beats.py snap` | Where the text seemed to need them: 2.4, 5.4, 10.2, 12.6 s |
| Music | `library/sounds/music/minimal-pulse-01` from its first beat, both films | Same |

## What was checked

| Check | New | Old |
|---|---|---|
| Beat sheet (`tools/plan/beats.mjs`, framework reel-shape) | Nothing to fix: hook 2.06 s (0 to 2 s allowed), stake 3.2 s, body 7.9 s, payoff 1.8 s; energy map 4, 2, 3 then 5, 4 | Same words, same sheet |
| Cuts on the beat (`beats.py check`, reading `music_offset` from `job.json`) | All four cuts on the beat (within 0.1 frame) | All four off: 3 to 6 frames from the nearest beat |
| Hook readable with the sound off (`hook_legible.mjs`) | From 0 s: type 12.5% of the short side (7.8% needed), contrast 17.9:1 (7:1 needed) | From 0.25 s: 16.0%, 16.3:1 |
| Smoothness | No unplanned jumps, no judder | Same |
| Flashes | Pass | Pass |
| No dots on screen | None | None |
| Loudness | -14.2 LUFS, true peak -1.9 dBTP, no clipping | -14.0 LUFS, -1.9 dBTP |

Found while making it, and fixed:
- The iris wipe showed the old scene through the circle and dropped it in one frame. An iris on the same page needs its `page` given; the film now gives it. (Worth a line in the move's notes.)
- The logo-mask wipe darkened the whole frame on a same-page ending and looked muddy; the panel wipe replaced it. The logo-mask wipe is for an ending onto the other page.
- Both hard cuts at 10 s first landed on an empty page for two frames, because the next line faded up from nothing; both films now start that line a moment before the cut.
- The beat sheet ignored the framework named in `job.json`, assumed the film ran past its length, and judged a 2-second hook "long" in a 15-second reel. All three fixed in `tools/plan/` (27 tests pass).
- An independent code review found the panel wipe handing over one frame after the beat (its cue moved 17 ms earlier; the panel now covers the frame on frame 375, 12.5 s) and that `beats.py check` needed the bed's offset given by hand (it now reads `music_offset` from `job.json`).

## Not checked

- Nobody has watched either all the way through with sound; the checks above are measurements, and the contact sheets were looked at frame by frame.
- Nobody has listened to the mixes. The listening tool measured them (loudness, tone, 120 BPM); its critique was not run.
- The cost in tokens of each version. Both were written in one session together with the library, so their cost cannot be separated. What can be counted: each film is about 40 lines in one file; the new one placed 14 sounds by their picture moments against 6.
- Rule 19 of `knowledge/rules/starting-rules.md` was changed by the owner on 18 Nov 2026: sound comes from the brand's kit first, then the shared library, then ElevenLabs.
