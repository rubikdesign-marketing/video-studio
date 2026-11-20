# 05 corrective pass (corrective-5)

Worktree `video-studio-05`, branch `creative-library-05`, nothing committed. Python was the footage venv, `-I`. Remotion render commands (and `build.mjs`, whose last step is a `git checkout` inside the worktree's git folder) ran with the sandbox off; nothing else did.

## Per failure

| # | Failure | Before | After | Verdict |
|---|---|---|---|---|
| 2 | Hard cut at 13.0 s | smoothness: 1 unplanned jump at 13.0 s (change 133.9 against 13.8 around); flashes: 2 sudden brightness changes (13.0, 13.1); frames 390-392 luminance 0.07-0.29 | S04 now draws the board window (`ProofBoard`, exported from S03) under the light wipe, and the wipe takes 0.4 s (was 0.27). Smoothness: no jump at 13.0 s; the wipe's own fastest frame reads 35.4 against 8.5 at 13.1 s, which is the planned light sweep, so with `--planned-cuts 13.1` it reports 0 unplanned jumps, 0 judder. flashes.py: "no sudden brightness changes", pass. Frame strip 388-397 shows board, then a white edge rising over it, no empty dark stage | FIXED (the wipe still shows as one planned event in smoothness.py unless declared) |
| 3 | grade.json git-ignored | `.gitignore:8 jobs/*/edit/` hid both recipes | `jobs/*/edit/*` plus `!jobs/*/edit/grade.json` (the parent-directory form blocked the negation). `git check-ignore` (no -v) prints nothing, rc 1, for both jobs' grade.json; other edit files (recording-source.mp4, log) are still ignored | FIXED |
| 4 | RecBadge contrast | text 1.01:1 on the dark stage | `recBadgeColours()`: pill = stage shade at 0.78, text = whichever of ink/onInk contrasts better. Measured by `tools/checks/tests/recbadge_contrast.test.mjs` over a white and a black picture: light stage label 9.54 / timer 8.38 (white picture), dark stage 10.88 / 9.50; lowest 8.38 against 4.5 | FIXED |
| 5 | Skin hue | clean-cool 7.3 deg, chroma collapse on 2 tones; warm-film 7.0 deg | Retuned (casts kept to the shadows, a little saturation in clean-cool). Max hue shift, gated at chroma >= 6: clean-cool 3.0 (D50) / 3.1 (D65), warm-film 3.2 / 3.6, soft-daylight unchanged 4.9 / 5.5; no gated tone below chroma 6 (min ratio 0.94 and 0.90). The test (`grade.test.mjs`) holds D50 to 5 deg, D65 to 6 deg, chroma >= 6, and the three looks at least 2 dE apart. Caveat: soft-daylight is 5.5 deg under D65 (the verifier measured 4.8 and it was not asked to change); synthetic patches only | FIXED (synthetic patches) |
| 6 | Stale paperwork | see report | `style.json`, `shots.json` now name the comment card, phone-buzz, finger-tap, `room-clean-01`; `check-sync.py` uses `finger-tap` and runs clean on the new film (5 cues, offsets 0.06-0.11 frame); card.json kit.json checksum is 92907b4c...; the take-5 recording gap and probe note now say it exists in the main checkout (`jobs/_tulvo-capture-test/capture/boards/take-5/recording.mp4`, 3840x2160, 60 fps, 12.867 s, privateStudy only like the stills). `out/preview.mp4` re-rendered from the current build (half size, decodes with no errors) | FIXED (preview not compared by PSNR again) |
| 7 | mix.py ZeroDivisionError | crash with no spoken line | No spoken line: skips the under-voice measure and correction, prints "no spoken line"; test `NoSpokenLine` (empty lines.json, `--ref-db -20`) passes. I did not re-run the old code to see the test fail | FIXED |
| 9 | Neutral not identity | gradeClip re-encoded (up to 8/255), gradeStill rewrote the picture (1 level) | Neutral: `copyFileSync` of the source (no re-encode); test checks still and clip are byte-identical, and a real grade differs | FIXED |
| 8 | Shader fallbacks | no `device_fallback` on the 8 `shader-*` | each says `"none: needs WebGL"`; test added | FIXED (declared, no fallback built) |

Not touched by design: failure 1 (manifest excludes, Prompt 04), the offer wording, `tools/audio/master.sh`, failure 10 (logo-sting sync and short-clip loudness margin).

## Re-export of ugc-01

`jobs/2026-11-19-ugc-01/out/2026-11-19-ugc-01.mp4` (sha256 a900c545c765...f431); the previous export is kept as `out/2026-11-19-ugc-01-phase3.mp4`.
1080x1920, 30 fps, 16.000 s, h264 yuv420p, bt709/bt709/bt709, aac. Loudness: master.sh -14.07 LUFS, -1.75 dBTP; ffmpeg ebur128 -14.3 LUFS, peak -1.8 dBFS. Sync (check-sync.py): offsets 0.06 to 0.11 frame on whip, finger-tap, toast-pop, offer-sting, logo-sting. Rendered and mastered once; `build.mjs` re-ran the mix, the grade (new clean-cool on the stills) and the scaffold first. Nobody has listened to it or watched it start to end.

## Tests

- `node --test tools/footage/tests/*.test.mjs tools/checks/tests/*.test.mjs`: 84 tests, 84 pass (new: neutral identity, skin hue, REC contrast, shader fallback).
- `tools/audio/tests`, unittest discover `test_*.py`: 53 pass (new: no spoken line).
- `tools/checks/tests` Python tests: 28 pass.

## Changed paths

`.gitignore`; `engine/src/jobs/ugc-01/scenes/{S03,S04}.tsx`; `engine/src/kit/ugc/ScreenRecTell.tsx`; `tools/footage/lib/grade.mjs`, `tools/footage/tests/grade.test.mjs`; `tools/audio/mix.py`, `tools/audio/tests/test_mix_options.py`; `library/motion/index.json`, `tools/checks/tests/{motion_library,recbadge_contrast}.test.mjs`; `brands/tulvo/styles/ugc-phone-take/style.json`; `jobs/2026-11-19-ugc-01/{shots.json,check-sync.py}` and its out/ files; `library/fixtures/ugc-01/card.json`; `.damex/receipts/05-for-04.json` (checksums refreshed; manifest excludes for `library/fixtures` and `.damex` noted as a Prompt 04 action).

## Left unfixed or open

- The product-motion-02 example was not re-rendered: it uses the old REC badge colours and the grade module, so its mp4 is stale against the new code.
- smoothness.py still lists the light wipe as a jump unless `--planned-cuts 13.1` is given.
- Skin hue was measured on synthetic patches only, not real skin.
