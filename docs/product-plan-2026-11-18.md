# Video Studio as a product: the plan

18 November 2026. Owner of decisions: Claude, by the owner's brief. Starts from `../video-engine-audit-and-roadmap-2026-11-18.md`, checked against the working copy, the job records and the owner's feedback.

## What the evidence says

**Technical checks are not the problem. Recognition is.** Every film that was revised or rejected had passed smoothness, flash, loudness and legibility checks. What sent them back:

| Film | What happened | Why, in the owner's words |
|---|---|---|
| Imagine Notion (50 s promo) | Five storyboard drafts; two approvals withdrawn; reopened after delivery with ten notes | "We don't understand what you're showing." Format wrong on draft 1 (portrait, owner wanted square). Copy and paste: not clear what is copied, from where, to where. Pace too fast to read the product. Crops cut text. |
| Launch remake V5 (presenter) | Scrapped | "Didn't actually follow the ref": the presenter's delivery was what mattered, and it was not tested before the full sequence. |
| Launch remake V3 | Approved after a fix | Voice sync measured correct, heard as late. |
| Launch remake V4 | Revised | Crops tight enough to read lost the context of what the screen was. |

Approved fastest: kinetic-type reels and edits of real footage and real product screens (gunshot teaser, sticky-note reel, whiteboard reel, "Sorted", Product Hunt demo r3). Generated people cost the most per approved second: V1 used about 700 Kling credits across two rounds and V5 was thrown away.

**Speed and cost are not measured.** No job records AI cost; the Imagine Notion record says "not recorded" four times. Masters take about 4 minutes each and the revision round rendered eight of them.

**Dependability gaps, confirmed in code:**
- `render.sh` deletes the previous file before the new one exists. A failed or interrupted master leaves nothing.
- `storyboard.mjs` takes the render lock without writing its owner, so a killed storyboard blocks every render until someone deletes the folder by hand. It also starts a fresh Remotion bundle for every frame.
- `master.sh` scales the review copy to 1,280 wide, so a 9:16 reel's "720p" copy is 1,280 × 2,276.
- `kling.mjs` keeps no record of a paid request before it is sent and no task id unless `--log` is passed. A crash between submit and wait loses the task, and a retry pays again.
- One type error remains (`S07.tsx`, `easing.linear`); the batch2 one was fixed this morning.
- The intake stage tells every brand to "use the Tulvo connector". The scaffold assumes a voice-over.

## The first customer and the promise

**Who:** a SaaS founder or marketer who ships product updates every week and needs short launch reels and product demos from their real product, without an editor.

**Promise we can demonstrate today:** describe the video, get a watchable preview of your real product in minutes, change any shot by saying what you want, and make the next one in the same style for less. Formats ready to sell: product demo (real screen capture), kinetic-type launch reel, edit of supplied footage. Generated presenters and recurring animated characters stay in a paid pilot until a short performance test is in the workflow and approved.

## Priorities

| # | Increment | Done when |
|---|---|---|
| 1 | **Never lose the last good version, never pay twice.** Atomic renders with a version history, a lock that names its owner and recovers, correct review-copy sizes, a paid-generation ledger that reconciles before resubmitting, the type error fixed, and a per-job run log of render time and spend. | Interrupt a master: the previous one is intact. Kill a storyboard: the next render proceeds. Re-run a generation after a crash: no second paid request. |
| 2 | **Fast first preview, fast one-shot revision.** Bundle once and keep one browser for storyboards and stills; reuse the bundle across renders when the code has not changed. | Cold vs warm storyboard and scene revision times on the same machine and inputs, recorded in `docs/benchmarks/`. |
| 3 | **Understand what the creator means.** An editable `brief.json`: what each reference is liked for (camera, delivery, pacing, look), must-shows, format; every shot carries a purpose, a focal point and an observable proof moment. Revision notes become a ledger of keep / change per shot, carried into the next cut and checked against it. The storyboard renders each shot's proof moment, not a fixed 60% point. | A note like "keep everything I liked, slow the demo, change the ending" produces a change list naming shot ids, and a report shows each change landed and nothing marked keep moved. |
| 4 | **The second video is easier.** Save an approved film's style (look, type, motion moves, sound, pacing, caption style, decisions) as a style pack; start a new job from it with only the new decisions asked. Platform cuts from one approved film. | A second job starts with the style filled in and asks only what changed. |
| 5 | **Sellable.** Brand-neutral intake and a silent-film path; a key-free starter project; the setup check names what each missing provider disables and what to do; costs, rights and what customers can rely on written before purchase; a first-time-user trial script including an interrupted job. | A clean install reproduces the demo; the trial script is ready for two people on fresh Macs. |

Each increment ships in its own commit with tests, a line in `DESIGN.md` section 14, and measurements where it claims speed.

## What stays a human judgment

Whether a cut is good, whether a viewer understands the action after one watch, whether the sound feels right at speed, and first-time-user friction. Claude cannot watch at speed or hear. These are listed in the trial kit, not claimed.

## Status at the end of 18 November

| # | Increment | State |
|---|---|---|
| 1 | Never lose the last good version, never pay twice | Built and tested: `tools/film/lib/` (lock, safe replace, run log, ledger), `render.sh`, `master.sh`, `kling.mjs`, `costs.mjs`; type error fixed. Kill test and stand-in-server tests pass. |
| 2 | Fast preview and one-shot revision | Storyboard 4.5 to 5.8 times faster warm; `--only` for one scene. Preview and splice paths unchanged (84 s and 33 s on the 50 s film). Bundling for `render.sh` left to Remotion's own cache, which already performs (about 2 s). |
| 3 | Understand what the creator means | `brief.json` and `brief.mjs` (settled words, focused questions, shot proof checks); `revisions.mjs` (notes per scene, verified against frames and timing); proof moments in the storyboard; no-voice films in the scaffold; `label` on shots. |
| 4 | The second video is easier | `style.mjs` (save, new, list); `cut.py` for platform cuts that refuse to lose content. Episode 2 of the example asked 1 question. |
| 5 | Sellable | Setup check names what each missing provider turns off and no longer assumes Tulvo; intake is brand-neutral; `docs/selling.md`; `docs/trial/first-time-creator.md`; `docs/release-test-2026-11-18.md`. Customer licence still to be decided by the owner. |

Next, in order: run the human trial; native re-framing for platform cuts of hand-framed films; a short motion-test path for generated presenters (spoken take with sound before bulk generation); token figures per stage once the app exposes them.
