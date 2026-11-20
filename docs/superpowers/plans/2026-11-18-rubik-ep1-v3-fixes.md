# Rubik Episode 1, v3: the 40 review notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the owner's 40 notes on `rubik-ep1-v2` into a v3 preview that answers every note, then reply to each note on the review page.

**Architecture:** The film is one Remotion composition (`engine/src/jobs/rubik-ep1/Film.tsx`) driven by a shot list (`spec.ts`) on the approved voice clock (`timeline.json`, never changed). Most notes come from four shared mechanisms, not from individual scenes: cue words, highlights fixed to the screen while the page scrolls under them, a centred-but-unstabilised camera crop, and loud synthetic whooshes. So we fix those first (Phase 1), then rebuild the shared look (Phase 2), then rework scenes on that base (Phase 3), then sound and grade (Phase 4), then a stills look-check before the full render (Phase 5). New logic goes in pure modules with Node tests. Scene look is checked by the studio's frame checks and by the owner's stills approval.

**Tech Stack:** Remotion 4 / React / TypeScript (engine), Node 22 (`node --test --experimental-strip-types`), Python 3 + ffmpeg (footage, audio, checks), Robust Video Matting (`tools/footage/py/matte.py`), the studio sound tools (`tools/audio/*`).

**Spec:** `jobs/2026-11-17-rubik-ep1/review/batch-001.json` (the 40 notes, each with time, scene and frame grab in `review/frames/`). Studio rules: `.claude/skills/video-studio/SKILL.md` and `stages/05-animation.md` ("Review notes").

## Global Constraints

- The voice is the clock. `timeline.json` shot times and `RubikEp1Frames` must not change; the picture is fitted to the voice, the voice is never stretched or cut. Length cap 630 s.
- Colours, fonts and logos come only from `brands/rubik/brand.json` through `C`/`B` in `Film.tsx`. "Neon green" = `C.lime` (the brand accent). No hex values added to scenes. The existing third-party values (`FIBERY_SWATCHES`, the Slite orange in the morph) are the only exceptions.
- Only real captured UI. Every redesign on a third-party page stays labelled "Rubik concept".
- The owner's note 4 overrides the job's earlier rule: remove "FILMED 17 NOV 2026" from every browser frame. Record this in `job.json` `notes`.
- On-screen name stays "Shiyam Kashfiq". The review notes spell him "Kashvi"; that is the same person.
- Nothing from the reference video (`~/Downloads/3 Sound Design Secrets That Feel Like CHEATING.mp4`) goes into the film. Only its techniques are used.
- The FASTEDITOR SFX pack (`~/Downloads/1000+UR.FASTEDITOR SFX`, 938 files, 647 MB) has no known licence, and this repository is public. It stays local and git-ignored, and none of its files are committed. Its catalogue entries say `"licence": "unknown, owner-supplied, local use only"`.
- Claude cannot hear. Every statement about sound quotes a number from `tools/audio/listen.mjs` or `mix.py`. Master to −14 LUFS, −1.5 dBFS true peak.
- Renders run outside the command sandbox (the render browser cannot start inside it).
- Before changing anything, record the review in the revision ledger (Task 0). Afterwards, `revisions.mjs verify` must report no **Not done** and no **changed without a note** before replying.

## Review Focus

1. **A cue word is part of another word.** "call" is inside "basically", and "AI" is inside "said". The step lights early (this is note 17). Expected: a cue lands on the whole word. Pinned by the Task 1 tests.
2. **A mark whose section is still scrolling in at its cue time.** Expected: the view waits or eases so the whole marked box is inside the frame at its cue. Pinned by the `marks_in_view` check in Task 2.
3. **Frames where the face tracker lost his face** (`eyes` missing, as in clip `flow-vid-…-097`: 182 of 216 samples). Expected: the stabilised crop holds and eases back, with no snap. Pinned by a Task 3 test.
4. **Bigger captions and cards colliding** with the PiP, the notes rail or each other. Expected: nothing overlaps the caption. Pinned by `captions_clear.mjs` in Task 18.
5. **A merged or restaged shot that changes total frames.** Expected: `RubikEp1Frames` is identical to v2's. Pinned by a Task 1 test that reads it.

---

## Note → task map

| Note | Task | | Note | Task | | Note | Task | | Note | Task |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3, 7, 9 | | 11 | 11 | | 21 | 15 | | 31 | 11 |
| 2 | 3 | | 12 | 2 | | 22 | 2 | | 32 | 10, 12 |
| 3 | 15 | | 13 | 12 | | 23 | 5 | | 33 | 5, 15 |
| 4 | 4, 5 | | 14 | 2, 12 | | 24 | 8, 12 | | 34 | 11 |
| 5 | 12 | | 15 | 2, 11 | | 25 | 6 | | 35 | 11 |
| 6 | 6 | | 16 | 11 | | 26 | 11 | | 36 | 12, 15 |
| 7 | 6 | | 17 | 1 | | 27 | 3 | | 37 | 12 |
| 8 | 3, 10 | | 18 | 12 | | 28 | 6 | | 38 | 12 |
| 9 | 11 | | 19 | 11 | | 29 | 11 | | 39 | 12 |
| 10 | 11 | | 20 | 5, 11 | | 30 | 11 | | 40 | 13–16 |

Tasks 13 and 14 (studying the sound video, cataloguing the SFX pack) depend on no other task and can run in parallel with Phases 1–3, in their own session.

---

## File structure

| File | Responsibility |
|---|---|
| `engine/src/jobs/rubik-ep1/lib.ts` (new) | Pure helpers with no React: cue timing, scroll lookup, page-to-view boxes, view fitting. |
| `engine/src/jobs/rubik-ep1/lib.test.ts` (new) | Node tests for `lib.ts`. |
| `engine/src/jobs/rubik-ep1/marks.json` (new, generated) | Per capture: the scroll track and every capture mark's time, scroll and named boxes. |
| `projects/rubik/video-1-edit/build/marks.mjs` (new) | Builds `marks.json` from each capture's best take (`tracks.json`, `marks/*.layout.json`). |
| `engine/src/jobs/rubik-ep1/look.tsx` (new) | Shared look: `Browser`, `Highlight`, `Spotlight`, `Card`, `KineticLine`, `Presence`. Split out of `Film.tsx`, which is 594 lines. |
| `engine/src/jobs/rubik-ep1/Film.tsx` | Scenes and the film. Uses `lib.ts` and `look.tsx`. |
| `engine/src/jobs/rubik-ep1/spec.ts` | Per-shot content: new `focus`, `presence`, `mark` fields. |
| `projects/rubik/video-1-edit/build/center.py` | Per-frame face lock instead of the per-piece median. |
| `projects/rubik/video-1-edit/build/test_center.py` (new) | Tests for the face lock. |
| `projects/rubik/video-1-edit/build/grade.py` (new) | Per-clip colour grade from skin tone and exposure. Writes `grade` into `film-cut.json`. |
| `projects/rubik/video-1-edit/build/audio_events.mjs` | Re-spotted sound plan. |
| `library/sounds-local/` (new, git-ignored) | Local catalogue of the FASTEDITOR pack. |
| `knowledge/craft/07-sound.md` | Techniques from the reference video, added as a dated section. |
| `library/references/rubik/sound-design-secrets/` | Study card of the reference video (no media committed). |

---

## Phase 0: Bookkeeping

### Task 0: Record the review in the revision ledger

**Files:** `jobs/2026-11-17-rubik-ep1/` (ledger written by the tool), `job.json`

- [ ] **Step 1:** `node tools/plan/revisions.mjs snapshot jobs/2026-11-17-rubik-ep1 --as v2`
- [ ] **Step 2:** For each of the 40 notes run `node tools/plan/revisions.mjs note jobs/2026-11-17-rubik-ep1 --round v2 --action change --scope S<nn>[,S<nn>] --aspect <topic> --says "<note text, first 200 chars>"`. Add `--target` where the change is measurable: n6/n25 `card_text>=+25%`, n1 `caption_size>=+20%`, n3/n21 `whoosh_gain<=-6dB`. Then add one `--action keep --scope rest --says "keep everything else"`.
- [ ] **Step 3:** Add to `job.json` `notes`: `"18 Nov: owner's batch 1 on v2 (40 notes, 10 must-fix). Filmed-date label removed at the owner's request (note 4), overriding the 17 Nov rule. Plan: docs/superpowers/plans/2026-11-18-rubik-ep1-v3-fixes.md"`.
- [ ] **Step 4:** Commit: `git add jobs/2026-11-17-rubik-ep1/job.json docs/superpowers/plans/2026-11-18-rubik-ep1-v3-fixes.md && git commit -m "Rubik ep1: record v2 review batch and v3 plan"` (renders and review media are not tracked).

---

## Phase 1: Shared mechanisms

### Task 1: Cues land on whole words (note 17)

**Files:**
- Create: `engine/src/jobs/rubik-ep1/lib.ts`, `engine/src/jobs/rubik-ep1/lib.test.ts`
- Modify: `engine/src/jobs/rubik-ep1/Film.tsx:41-49` (`norm`, `cueOf`), and the three local `at`/`rowAt` lookups in `VerdictCard`, `PathCard`, `LessonsCard`
- Modify: `projects/rubik/video-1-edit/build/audio_events.mjs:15-21` (it carries its own copy of `cueOf` and `groupCue`)

**Interfaces:**
- Produces: `export type Word = { w: string; t0: number; t1: number }`; `export function findWord(words: Word[], cue: string): Word | undefined`; `export function cueTime(words: Word[], start: number, cue: number | string | undefined, dflt?: number): number`; `export function groupCueTime(shots: { start: number; words: Word[] }[], cue: number | string, first: number, dflt: number): number`.

- [ ] **Step 1: Write the failing tests** in `lib.test.ts`:
  - `findWord` with words `['basically','we','call','them']` and cue `'call'` returns the word `call`, not `basically`.
  - Cue `'AI'` on `['said','the','AI.']` returns `AI.`.
  - Cue `'do?'` matches `do?` and `'nerds.'` matches `nerds.`: punctuation in the cue is kept when present, ignored when absent.
  - With no whole-word match, it falls back to the first word that starts with the cue, then to the first word containing it, so the old cues still resolve.
  - `cueTime` of a missing cue returns `dflt`. A number cue is returned unchanged.
  - Reading `timeline.json`, `Math.round(T.duration * T.fps)` equals the v2 value (record it from `out/rubik-ep1-v2.mp4` frame count; Review Focus 5).
- [ ] **Step 2:** `node --test --experimental-strip-types engine/src/jobs/rubik-ep1/lib.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement the three functions in `lib.ts`. Order: whole-token equal (after lower-case, punctuation compared only if the cue has it), then token starts with the cue, then substring. Replace every inline lookup in `Film.tsx` and `audio_events.mjs` (which imports `lib.ts` like it imports `spec.ts`).
- [ ] **Step 4:** Run the tests. Expected: PASS. `cd engine && npm run typecheck` is clean.
- [ ] **Step 5: Cue report.** Add `--report` to `audio_events.mjs`: it lists every cue whose time moved against the v2 `audio/sfx.json` (`id`, old time, new time, word). Run it, and look at the frame of every move over 0.3 s. Expected: S37 "Call" now comes after "Find". List any other moves in the hand-over.
- [ ] **Step 6:** Commit `feat(rubik-ep1): cues match whole words`.

### Task 2: Highlights stay on what they mark, and the view contains them (notes 12, 14, 15, 22)

The cause: rings are drawn in fixed viewport coordinates while the capture video scrolls under them, so they drift (notes 14, 22). Zoom boxes are hand-set and can crop a marked box (note 12, where "modular work platform" is cut off).

**Files:**
- Create: `projects/rubik/video-1-edit/build/marks.mjs`, generated `engine/src/jobs/rubik-ep1/marks.json`
- Modify: `lib.ts`, `lib.test.ts`, `spec.ts` (types `Ring`, `Site`), `Film.tsx` (`SiteShot`, `RingMark`)
- Create: `tools/checks/marks_in_view.mjs` and `tools/checks/tests/marks_in_view.test.mjs`

**Interfaces:**
- Produces: `marks.json`: `{ [cap: string]: { scroll: [t: number, y: number][]; marks: { [name: string]: { t: number; scroll: number; things: { name: string; box: Box }[] } } } }`. The scroll is sampled at 30 per second on the capture's clock; a capture's working copy runs on its recording clock (checked: `folk-pricing` tracks 33.68 s against `CAP_LENGTH` 33.6).
- Produces in `lib.ts`: `scrollAt(track: [number, number][], t: number): number` (linear between samples, clamped); `pageBox(box: Box, markScroll: number): Box` (viewport box to page coordinates); `viewBox(page: Box, scrollY: number): Box` (page to viewport); `fitView(boxes: Box[], opts: { margin: number; minW: number }): Box` (the smallest 16:9 box holding every box plus the margin, at least `minW` wide, clamped to 1920×1080); `contains(outer: Box, inner: Box): boolean`.
- Produces in `spec.ts`: `Ring` gains `mark?: string` (the box is in that mark's viewport, so it moves with the page). `Site` gains `focus?: { mark: string; margin?: number }`, which sets the zoom target to `fitView` of the shot's ring boxes (and the mark's box when there are no rings) unless `zoom` is given.

- [ ] **Step 1: Failing tests** in `lib.test.ts`:
  - `scrollAt([[0,0],[1,100]], 0.5) === 50`, clamped at both ends.
  - `viewBox(pageBox([323,358,415,536], 0), 400)` is `[323,-42,415,536]`.
  - `fitView([[292,166,426,268]], { margin: 40, minW: 640 })` contains `[292,166,426,268]` and has a width-to-height ratio of 16:9 within 0.5 px.
  - `fitView` of a box touching the right edge stays inside 1920×1080.
  - `contains(fitView(bs, o), b)` holds for every `b` in `bs`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the `lib.ts` functions. In `marks.mjs`, for each capture in `capture/*/best.json`, read `tracks.json` (`frames[].t`, `frames[].scroll[1]`) and downsample to 30 per second. Each mark's `t` is the first frame after the previous mark's `t` where `|scroll − mark.scroll| ≤ 2` and the page is still for 0.2 s. `things` comes from `marks/<name>.layout.json`. Run it to write `marks.json`.
- [ ] **Step 4:** In `SiteShot`, compute the source time `srcT = from + (t * rate)`, the same mapping `Capture` uses. A `RingMark` with `mark` draws at `viewBox(pageBox(box, marks[cap].marks[mark].scroll), scrollAt(track, srcT))`. Rings without `mark` behave as before.
- [ ] **Step 5: The check.** `node tools/checks/marks_in_view.mjs --job jobs/2026-11-17-rubik-ep1` imports `spec.ts`, `timeline.json` and `marks.json`. For every ring, pause and morph it computes the zoomed view at its cue time and over its visible span, and prints `S<n> <kind> <box> inside|CUT <px>`. It exits 1 on any `CUT`. Test it with a synthetic spec where one ring sits outside its zoom (exit 1) and one where it sits inside (exit 0).
- [ ] **Step 6:** Set `mark` on every ring in `spec.ts` that sits on a scrolling capture (S32, S33, S34, S40, S43, S44, S50, S53, S54, S59). Replace S26's hand-set zoom with `focus` so "modular work platform" is inside the frame (note 12). Run the check. Expected: no `CUT`.
- [ ] **Step 7:** Commit `feat(rubik-ep1): page-anchored highlights and fitted views`.

### Task 3: A steady face, and no PiP drop-outs (notes 1, 2, 8, 27)

Two separate faults:
- (a) `center.py` sets one crop per piece from the median eye position, so the handheld shake stays in the picture.
- (b) The PiP sometimes goes blank for a moment. Likely cause, still to be confirmed: each site shot mounts its own `ARollAt`/`OffthreadVideo`, so the video is reloaded at every shot boundary. Use superpowers:systematic-debugging for (b), and confirm the cause before fixing.

**Files:**
- Modify: `projects/rubik/video-1-edit/build/center.py`
- Create: `projects/rubik/video-1-edit/build/test_center.py`
- Create: `tools/checks/region_dropout.py` and `tools/checks/tests/test_region_dropout.py`
- Modify: `Film.tsx` (`PiP`, and wherever site shots mount it)

**Interfaces:**
- Produces: `lock_track(samples: list[tuple[float, float|None, float|None]], fps: float, sigma_s: float = 0.12) -> list[tuple[float, float, float]]`. Input is `(t, eye_x, eye_y)`, with `None` where no eyes were found. Output is the smoothed eye position per sample: gaps are filled by straight lines between the nearest found samples, and the result is smoothed with a Gaussian of `sigma_s`.
- Produces: crop keys for every face sample (every 2 frames) in `film-cut.json` `pictures[].crop.keys` (same `[f, x, y, w, h]` shape, so `cropAt` in `Film.tsx` needs no change).

- [ ] **Step 1: Failing tests** (`test_center.py`, pytest):
  - A 6 Hz, 30 px sine shake on `eye_x` over 3 s. After `lock_track`, cropping so the smoothed eye sits at the frame centre leaves the residual (raw minus smoothed) with a standard deviation ≤ 3 px. This is the eye's wobble in the output frame.
  - Twenty `None` samples in the middle produce no jump bigger than 4 px between samples (Review Focus 3).
  - A slow 200 px drift over 5 s is followed: the error at the end is ≤ 10 px.
  - Crop keys never leave the source (`0 ≤ x ≤ W − w`).
- [ ] **Step 2:** `cd ../../rubik/video-1-edit/build && python3 -m pytest test_center.py -q`. Expected: FAIL.
- [ ] **Step 3:** Implement `lock_track`. In the main block, replace the median with per-sample keys from `lock_track`. Keep the crop size and the 40%-down eye line. Use `faces.json` `frames[].eyes`, not `smooth`, because `smooth` was built for re-centring, not stabilising.
- [ ] **Step 4:** Tests PASS. Re-run `center.py`. It prints pieces centred and the mean and largest shift.
- [ ] **Step 5: Drop-out check.** `region_dropout.py <video> --box x,y,w,h [--json out]` reports frames where the region's mean luma drops by more than 35% against the median of its ±3 neighbours, or where the region is a byte-exact copy of the previous frame for 4 or more frames while the rest of the frame changes. Test it with a synthetic clip that has one black frame in the region (found) and with a clean clip (none).
- [ ] **Step 6: Diagnose (b).** Run `region_dropout.py out/rubik-ep1-v2.mp4 --box 1570,610,300,300` (the PiP at 1920 scale). Compare the drop-out times with the shot boundaries in `timeline.json` and with the `pictures[]` piece boundaries. Write the cause, and the evidence for it, into the task's commit message.
- [ ] **Step 7: Fix (b) at its cause.** If it is the remounting, render one persistent A-roll layer at film level (a single `ARollAt` over the whole film) and have `PiP`, `Presence` (Task 10) and `ARollShot` show it through masks or transforms, instead of mounting video per shot. Re-run the check on a preview of 0:50–1:20 and 5:20–5:45 (`render.sh … scene` for those shots). Expected: zero drop-outs. `tools/checks/smoothness.py` reports no judder on A-roll shots S02, S03, S09–S15.
- [ ] **Step 8:** Commit `fix(rubik-ep1): face-locked crop; one A-roll layer (no PiP drop-outs)`.

---

## Phase 2: The shared look

Load `impeccable` for the look of these pieces. Before Task 17, `hallmark` and `impeccable` critique the stills. Motion follows `knowledge/craft/14-motion-systems.md`.

### Task 4: A better browser frame, with no filmed date (note 4)

**Files:** `look.tsx` (create; move `Browser` here), `Film.tsx`
- [ ] **Step 1:** Delete the "FILMED 17 NOV 2026" element.
- [ ] **Step 2:** Redesign `Browser`: thinner chrome (40 px), a soft inner border, a 24 px radius, a two-layer shadow (ambient plus contact), and a URL pill that shows the site's favicon (its logo from `logos/`) instead of the lock. The page area stays exactly `PAGE` (1424×801, 16:9) so every box from Task 2 still holds.
- [ ] **Step 3:** `npm run typecheck`. Render stills of S18, S44 and S62 (`node tools/film/storyboard.mjs jobs/2026-11-17-rubik-ep1 --shots 18,44,62`) and confirm the date is gone.
- [ ] **Step 4:** Commit.

### Task 5: The highlight system: a drawn neon line and a spotlight (notes 20, 23, 33, 4)

**Files:** `look.tsx`, `Film.tsx` (`RingMark` → `Highlight`; `pause` overlay → `Spotlight`), `spec.ts`

**Interfaces:**
- Produces: `<Highlight box={Box} at={number} out?={number} k={number} />`. Starting from a dot at the box's top-left corner, a `C.lime` 4 px stroke (no fill, rounded corners, a faint lime glow) draws the whole border in one continuous stroke over 0.9 s, eased with `inOut`. It fades over 0.3 s at `out`. Every `tone` uses the same line; tone appears only in the notes rail.
- Produces: `<Spotlight box={Box} at={number} k={number} />`. Everything outside the box is darkened to 70% black and blurred 8 px. The box stays sharp, with a 14 px corner radius and no border. It eases in over 0.5 s.

- [ ] **Step 1:** Implement both. Remove `RingMark` and the `pause` SVG and badge ("PAUSED · LOOK AT THE BUTTON").
- [ ] **Step 2:** In `spec.ts`:
  - S06: remove the ring and keep the zoom (note 4).
  - S43: remove the ring (note 20).
  - S62–S63: `pause` becomes `spotlight` on `SLITE_BTN`, with no ring (note 33).
  - Every other ring becomes a `Highlight`.
- [ ] **Step 3:** Run `marks_in_view.mjs` (Task 2): still no `CUT`. Render stills of S50 at its cue, mid-draw and fully drawn. Render S63 with the spotlight on.
- [ ] **Step 4:** Commit.

### Task 6: Bigger, better cards (notes 6, 7, 25, 28)

**Files:** `look.tsx` (one `Card` used by `NoteCard`, labels, `tag`), `Film.tsx` (`Rail`, `ARollShot` labels and tag, `ChapterCard`, the `motion` note)
- [ ] **Step 1:** Scale card type and padding by 1.3. Card text runs 28–34 px, tag 15 px, the rail 420 px wide (`RAIL.x` moves left to match, and `PAGE` stays). S14 labels: 34 px, 560 px wide (note 6). S52 tag: 40 px (note 25).
- [ ] **Step 2:** Chapter cards (note 7): rebuild all three as one layout. The logo is the hero at 160 px, "01/02/03" sits small above it, the URL line goes, and the site's own colour shows as a thin stripe. The wipe in is kept, and an exit is added (0.3 s push).
- [ ] **Step 3:** The motion-concept note (note 28): the moving bars stay inside a region that never overlaps the "MOTION CONCEPT" label (label above the bars, bars inset 14 px). Assert this in Step 4.
- [ ] **Step 4:** `node tools/checks/text_size.mjs <scene render> --job jobs/2026-11-17-rubik-ep1 --at <cue times for S14,S52,S55>`. Every card line must measure ≥ 2.6% of frame height (the tool's `--min` default). Render stills of S14, S16, S31, S48, S52 and S55.
- [ ] **Step 5:** Commit.

### Task 7: Bigger captions (note 1)

**Files:** `Film.tsx` (`CaptionLayer`)
- [ ] **Step 1:** Caption size goes from 46 to 56 px on A-roll and from 36 to 44 px over sites. Wrap at 30 characters instead of 34.
- [ ] **Step 2:** `node tools/checks/captions_clear.mjs` on the preview (Task 18) must report no overlap with the PiP, the rail, cards or highlights.
- [ ] **Step 3:** Commit.

### Task 8: Kinetic type for key phrases (note 24, and the opening line of note 1)

**Files:** `look.tsx` (`KineticLine`), `spec.ts` (`Site` and `ARoll` gain `kinetic?: { at: Cue; text: string; hi?: string[] }`)

**Interfaces:**
- Produces: `<KineticLine text={string} hi={string[]} at={number} />`. Words type on left to right (`HumanType` timing from `engine/src/kit/type`), at 90% of the frame width. When the line is complete it scales to full width (1.0 → 1.11 over 0.4 s with `ease`), words in `hi` turn `C.lime`, and it then exits on the next cut. It reuses `kit/type/HumanType` and `kit/type/RecentreBuild`; nothing new is added to the kit.
- [ ] **Step 1:** Implement it and add a library entry (`library/motion/`) as this video's new move. Each video must add one.
- [ ] **Step 2:** Use it on the important lines only, at most one per 20 s: S07 "Never make your users guess", S22 "Show the product. People connect instantly." (replacing `strip`), S39 (Task 12), S43 "Complex pricing makes people leave." (replacing `strip`), and S52.
- [ ] **Step 3:** Render stills mid-type and complete for S07 and S43.
- [ ] **Step 4:** Commit.

---

## Phase 3: Scenes

### Task 9: A new cold open (note 1)

**Files:** `spec.ts` S01–S08, `Film.tsx` (new `ColdOpen` shot type)
- [ ] **Step 1:** S01–S03 become one composed shot. Kashfiq is full-frame from the start (stabilised, Task 3), talking. "What does this startup do?" types on as a `KineticLine` on his first words. Then, 2–3 s in, as he poses the question, a browser window pops in on the right (spring, from 0.85 scale) showing Fibery scrolling (`fibery-tour` 0.7→6 s). He slides to the left 40% of the frame (`Presence` `side`, Task 10). Full-screen, no letterbox.
- [ ] **Step 2:** Run `node tools/checks/hook_legible.mjs <render of S01–S08> --expect "What does this startup do?"`. Expected: readable with the sound off by 3 s.
- [ ] **Step 3:** Render stills at 0.5, 1.5, 3, 5 and 8 s.
- [ ] **Step 4:** Commit.

### Task 10: Where Kashfiq is, shot by shot (notes 8, 32)

**Files:** `look.tsx` (`Presence`), `spec.ts` (`presence` on every shot), `jobs/.../edit/matte/` (cut-outs)

**Interfaces:**
- Produces: `presence?: 'full' | 'side' | 'pip' | 'behind' | 'front' | 'hidden'`.
  - `full`: A-roll full frame.
  - `side`: him in the left 40%, with the content on the right.
  - `pip`: the corner window as now.
  - `behind`: full-frame A-roll, blurred 24 px and darkened to 45%, behind the floating browser.
  - `front`: his cut-out (`matte.py`) at the bottom right, overlapping the browser edge by 120 px, with no window.
  - `hidden`: not shown.
  - All of these draw from the one A-roll layer from Task 3. A change of `presence` between neighbouring shots animates over 0.5 s; there is no hard swap.
- [ ] **Step 1:** Cut him out of the clips used for `front` shots: `tools/footage/.venv/bin/python tools/footage/py/matte.py <clip edit.mp4> jobs/.../edit/matte/<clip>.mov --ratio 0.2`. Look at the `--preview` still for each.
- [ ] **Step 2:** Set `presence` per shot. Rule: his face is on screen when he gives an opinion (keep, fix, verdict) and off when he is reading the page out. No mode runs for more than about 25 s without a change.

  | Shots | Presence |
  |---|---|
  | S01–S03 | `full` → `side` (Task 9) |
  | S04–S06 | `hidden` |
  | S09–S15 | `full`, with S13–S14 as `side` |
  | S17–S20 (anatomy tour) | `hidden` |
  | S21–S22 | `front` |
  | S23–S24 | `hidden` |
  | S25–S27 | `behind` |
  | S28 verdict | `pip` |
  | S32–S37 | `hidden`, with S33 as `front` |
  | S40–S44 | `hidden`, with S42 as `behind` |
  | S45 verdict | `pip` |
  | S49–S51 | `behind` |
  | S53–S59 | `hidden`, with S55 and S58 as `front` |
  | S60–S61 path | `hidden` (note 32: his face is not needed here) |
  | S62–S64 | `behind` |
  | S65 verdict | `pip` |
  | S67–S74 | `full` / `side` |

- [ ] **Step 3:** Render stills of one shot for each mode.
- [ ] **Step 4:** Commit.

### Task 11: Site shots show what he is talking about (notes 9, 10, 11, 15, 16, 19, 20, 26, 29, 30, 31, 34, 35)

**Files:** `spec.ts`, `Film.tsx` (`SiteShot`: `focus` holds, centring)

Rules applied in every site shot:
- When he names a thing, the view goes to its mark (`focus`).
- The capture holds still (`rate: 0` from that point) for at least 1.2 s while he names it.
- Small things zoom until their text is ≥ 2.6% of the frame height (`text_size.mjs`).
- A shot about one section never starts from the page top.

- [ ] **Step 1:** Fibery anatomy (notes 9, 10).
  - S18: on "hero", "product", "features" and "illustrations", `focus` the marks `hero`, `features` and `illustration` in turn, holding each.
  - S19: on "quotations" and "templates", `focus` the marks `templates` and `features`. For the quotes, use the source time where the quotes are on screen; find it from the `marks.json` scroll and look at the frame.
- [ ] **Step 2:** S25–S27 become one continuous view (`until: 27`). The "!" pin stays from its cue until the "?" pin replaces it in place, so nothing goes out and comes back (note 11).
- [ ] **Step 3:** folk.
  - S35: start already focused on the journey section (`focus: { mark: 'journey-intro' }`, `from` = that mark's `t`). Every row he names must be fully in view (note 15).
  - S36: focus `find`, then `engage` (note 16).
  - S42: start at the `plans` mark, not at the page top (note 19).
- [ ] **Step 4:** Slite.
  - S53: start the capture 1.5 s earlier so the product is already moving when the highlight draws (note 26).
  - S56: focus `agents` (note 29).
  - S57: focus `use-cases`, and play the flow (note 30).
  - S58: focus the testimonial block; find its time from the `slite-tour` scroll track and look at the frame (note 31).
- [ ] **Step 5:** S64 (notes 34, 35):
  - Centre the page: the zoom target's centre x is the page's centre (960).
  - Move the `morph` button off the SOC 2 badge: place it at the button's own box, left-aligned with the hero text column. Read the box from `talk-to-us.layout.json`.
- [ ] **Step 6:** Run `marks_in_view.mjs` (no `CUT`) and `text_size.mjs` at every new `focus` cue.
- [ ] **Step 7:** Commit.

### Task 12: Card scenes redesigned (notes 5, 13, 14, 18, 24, 32, 36, 37, 38, 39)

**Files:** `spec.ts`, `Film.tsx` (`MaximCard`, `PathCard`, `LessonsCard`, the timer note, S13 pills)
- [ ] **Step 1:** S13 chips show the logo only, at 44 px, with no URL text (note 5).
- [ ] **Step 2:** S26's "Clear to insiders" note (note 13):
  - Replace the "?" tag and the brown `ask` tone with a two-column card in the brand's light card style. The left column is headed "Insiders read" with the headline. The right column is headed "A new visitor reads" with the plain question "What is it? Who is it for?".
  - The `ask` tone (`C.ask`) is no longer used anywhere on cards.
- [ ] **Step 3:** S32 timer (note 14): a large stopwatch ring on the page itself, over the hero, counting 0.0 → 2.0 s and stopping on "CRM". The ring closes, and then "Understood: a CRM" stamps in. The rail card goes.
- [ ] **Step 4:** S39 (note 18): a `KineticLine` sequence on a light stage. "Make it easy to understand." types on, then "No thinking." and "No guessing." strike through two small confused cursor icons, and "They just understand." lands full width in lime.
- [ ] **Step 5:** S51 (note 24): one animated question mark (draws on, then tilts like a shrug) beside the headline. Only one; the second pin goes.
- [ ] **Step 6:** S60–S61 path (note 32): the diagram stays, and above it a live mini-browser plays the example as he speaks. Most SaaS sites: a cursor clicks "Pricing" and a new page loads, from `folk-pricing`. Slite: the page scrolls to its pricing glimpse, from `slite-tour` at the `pricing-glimpse` mark. Each path step lights in sync with its mini-browser. Something moves on screen at least every 1.5 s.
- [ ] **Step 7:** S67 (notes 36, 37): remove the "What we learned" tag card. Replace the cut into S67 with one transition from `engine/src/kit/transitions` that suits a calm film (`FeatherWipe` or `LumaDissolve`, 0.5 s). The sound for it comes in Task 15.
- [ ] **Step 8:** S68 and S70 lessons (notes 38, 39):
  - Each lesson gets its own visual proof, played as a short clip, not stills.
  - Lesson 1, "Never make your users guess": the Fibery headline at a glance, with a `Highlight` on the headline and the "?" from S26, then the Rubik concept patch from S27.
  - Lesson 2, "Don't hide the product": the folk product panel opening (`folk-hero` at the `product-panel` mark).
  - The number and the text share one type size and baseline (number 76 px in lime, text 76 px in white), and the subline sits at 36 px.
  - No image is used in both lessons.
- [ ] **Step 9:** Render stills of every changed scene.
- [ ] **Step 10:** Commit.

---

## Phase 4: Sound and grade (note 40, plus 3, 21, 33, 36)

### Task 13: Study the sound-design video (can run in parallel)

**Files:** `library/references/rubik/sound-design-secrets/study.md` (copy of `templates/study-card.md`), `library/references/index.json`, `knowledge/craft/07-sound.md`
- [ ] **Step 1:** Copy the video to `library/references/rubik/` (media is git-ignored; check with `git check-ignore`). Run `tools/study/profile.py` and `tools/study/sheets.sh`.
- [ ] **Step 2:** Transcribe it with the footage tool's transcriber (`node tools/footage/footage.mjs` prints its usage). From the transcript and the sheets, write the three techniques as rules the studio can apply, each with its measurable form: what is layered, when it starts against the picture (ms), the level against the voice (dB) and the frequency range. Mark which claims could not be checked, because Claude cannot hear the examples.
- [ ] **Step 3:** Add a dated section "From 'Sound design secrets' (Nov 2026)" to `07-sound.md` with those rules. Add the study to `index.json`.
- [ ] **Step 4:** Commit (study card and rules only, no media).

### Task 14: Catalogue the FASTEDITOR pack, locally (can run in parallel)

**Files:** `library/sounds-local/fasteditor/` (git-ignored), `.gitignore`, `tools/audio/sounds.mjs`
- [ ] **Step 1:** Add `library/sounds-local/` to `.gitignore`. Copy the pack in. Confirm `git status` shows none of it.
- [ ] **Step 2:** Build `library/sounds-local/fasteditor/index.json` in the same shape as the `library/sounds/*/index.json` entries. Include group (from folder and filename), length, peak and integrated loudness, spectral centroid, attack time, and `"licence": "unknown, owner-supplied, local use only"`. Measure with `tools/audio/level.py`. Use `earshot` through `listen.mjs` for feel words where the filename gives none.
- [ ] **Step 3:** Let `sounds.mjs find`, `sheet` and `use` read `sounds-local` too, with a `--local` flag and a warning on every use that the sound cannot be used in a film that is published outside the owner's own channels until its licence is confirmed. Add a test in `tools/audio/tests/sounds.test.mjs` that a local sound is found only with `--local`.
- [ ] **Step 4:** Commit (the tool change and the `.gitignore` only).

### Task 15: Re-spot the sound (notes 3, 21, 33, 36, 40)

**Files:** `projects/rubik/video-1-edit/build/audio_events.mjs`, `jobs/.../audio/sfx.json` (generated), `tools/audio/mix.py` only if the Task 13 rules need a new mix parameter
- [ ] **Step 1:** Apply the Task 13 rules and pick sounds from both libraries.
  - Whooshes and swishes at least 6 dB lower than in v2, and none on an A-roll ↔ site cut that already has a visual move.
  - At most 1.2 audible hits a second over any 10 s window (v2 was measured at 1.92 a second in v1).
  - No sound on the S62–S63 spotlight (note 33).
  - One soft transition sound into S67 (note 36).
  - Remove the cues for the rings, pins and strips deleted in Phase 2, and add cues for `Highlight` draws (a soft tick at the start only), `KineticLine` and the timer.
- [ ] **Step 2:** Run `node --experimental-strip-types build/audio_events.mjs`, then `tools/audio/mix.py jobs/2026-11-17-rubik-ep1`.
- [ ] **Step 3:** Run `node tools/audio/listen.mjs jobs/2026-11-17-rubik-ep1/audio/mix.wav --job jobs/2026-11-17-rubik-ep1`. Expected:
  - every cue within one frame of its picture moment;
  - no effect buried under the music;
  - the voice clearly above music and effects in every line (the report's margin);
  - −14 LUFS and ≤ −1.5 dBFS true peak after mastering;
  - no tone note about harshness (high-pitched) or mud (low-pitched).
  Quote the report in the hand-over.
- [ ] **Step 4:** Commit.

### Task 16: Colour grade (note 40)

**Files:** create `projects/rubik/video-1-edit/build/grade.py` and `test_grade.py`; `center.py` no longer writes `grade`; `Film.tsx` `GradeDefs` reads the new fields

**Interfaces:**
- Produces: `film-cut.json` `grade[clip] = { "gain": [r,g,b], "lift": number, "gamma": number, "sat": number }`. `GradeDefs` maps these to `feColorMatrix` plus `feComponentTransfer`.
- [ ] **Step 1: Failing tests:**
  - For a frame with skin mean `[200,150,120]` and a reference skin `[190,150,125]`, the gains move the skin hue to within 3° of the reference.
  - Every gain stays within [0.85, 1.25].
  - The grade of the reference clip is the identity, within 0.01.
- [ ] **Step 2:** Implement it. Sample skin from the face box in `faces.json` (5 frames per clip). The reference clip is `img-0117`. Match its skin hue and its exposure (median luma). Add a gentle S-curve (gamma 1.04, lift −0.01) and saturation 1.05.
- [ ] **Step 3:** Run `tools/checks/frame_quality.py` on a still from every clip, before and after. Report each clip's skin hue and median luma against the reference, as a table.
- [ ] **Step 4:** Commit.

---

## Phase 5: Look check, render, reply

### Task 17: Stills page for the owner (look approval before the full render)

- [ ] **Step 1:** Run `node tools/film/storyboard.mjs jobs/2026-11-17-rubik-ep1 --shots <every shot changed in Tasks 4–12>` at the cue moments.
- [ ] **Step 2:** Run `hallmark` and then `impeccable` critique on the sheet. Fix what they flag.
- [ ] **Step 3:** Publish one page that pairs each note's v2 frame (`review/frames/b001-nX.jpg`) with its v3 still, grouped by act. Stop for the owner's "go" before Task 18.

### Task 18: Render v3, check, and reply to every note

- [ ] **Step 1:** `bash tools/film/render.sh jobs/2026-11-17-rubik-ep1 preview` (outside the sandbox; several scenes changed, so no splice).
- [ ] **Step 2:** Run every check and record the result:
  - `smoothness.py` (planned cuts given);
  - `region_dropout.py` on the PiP box, which must report zero;
  - `marks_in_view.mjs`;
  - `text_size.mjs`;
  - `captions_clear.mjs`;
  - `hook_legible.mjs --expect "What does this startup do?"`;
  - `listen.mjs`;
  - `knowledge/craft/08-directors-checks.md`.
  List any failures; don't hide them.
- [ ] **Step 3:** `node tools/plan/revisions.mjs verify jobs/2026-11-17-rubik-ep1 --round v2`. Fix every **Not done** and every **changed without a note**, then quote the table.
- [ ] **Step 4:** `bash tools/film/render.sh jobs/2026-11-17-rubik-ep1 master` → `out/rubik-ep1-v3.mp4` and the 720p preview. Update `job.json` `outputs` and `notes`.
- [ ] **Step 5:** Reply to each note: `node studio/wait-for-notes.mjs jobs/2026-11-17-rubik-ep1 --done 1 '<40 replies, one line each: what changed>'`.
- [ ] **Step 6:** Hand over with the four-part note. Say plainly that nobody has watched v3 at speed or listened to it.
- [ ] **Step 7:** Commit.
