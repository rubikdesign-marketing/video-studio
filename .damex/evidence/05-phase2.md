# 05 Phase 2: ugc-01 preset, grade, mix, job (preset-footage-2)

Worktree `video-studio-05`, branch `creative-library-05` @ 47480ad. Nothing committed. Internal draft: rights are privateStudy only; nothing published.

## Outputs (all under `jobs/2026-11-19-ugc-01/out/`, never synced)
- Keyless preview, 540x960: `preview.mp4` (480 frames, 30 fps, bt709). Also `preview-before.mp4`, `preview-edit.mp4`, `preview-reset.mp4` (grade edit proof).
- Export: `raw.mp4` (render) and `2026-11-19-ugc-01.mp4` (after `tools/audio/master.sh`), plus `2026-11-19-ugc-01-preview-720p.mp4`. `export-baseline.mp4` and `raw-baseline.mp4` are copies taken before the grade edit (byte-identical to the final export).
- Grade stills: `grade-edit-before-after.png` (frame at 11 s, before | after exposure +0.3), `grade-before-after-source.png` (the hstack still from `beforeAfter()`), `f11-before/edit/reset.png`. Logs: `preview.log`, `export.log`, `master.log`.

## Commands run (main ones)
```
cd engine && npm ci --ignore-scripts --cache $TMPDIR/npmcache      # engine/node_modules was missing in this worktree (default npm cache is not writable in the sandbox)
node jobs/2026-11-19-ugc-01/build.mjs                              # audio + mix.py + grade once + scaffold (as "ugc-01") + fps 30 / 16.0 s
bash jobs/2026-11-19-ugc-01/render.sh preview                      # remotion render ... --scale 0.5 --crf 28 --color-space=bt709   (sandbox off)
bash jobs/2026-11-19-ugc-01/render.sh export                       # remotion render ... --crf 16 --color-space=bt709, then tools/audio/master.sh   (sandbox off)
python3 jobs/2026-11-19-ugc-01/check-sync.py jobs/2026-11-19-ugc-01/out/2026-11-19-ugc-01.mp4
node tools/footage/lib/grade.mjs set jobs/2026-11-19-ugc-01 demo-3 exposure=0.3
node tools/footage/lib/grade.mjs reset jobs/2026-11-19-ugc-01 demo-3
node tools/footage/lib/grade.mjs before-after <campaign-board-new.png> <out.png> exposure=0.3 look=clean-cool
node --test tools/footage/tests/grade.test.mjs
python3 -m unittest discover -s tools/audio/tests -p 'test_mix*.py'
```
mix.py inside build.mjs: `mix.py jobs/2026-11-19-ugc-01 --tail 0.5 --ref-db -20 --under 0.3 --gain-music 10 --gain-sfx -6` (exit 1 is expected: the "music 20-30% of the voice" rule is meaningless with a placeholder voice; build.mjs accepts it).

## Gate: full export (`2026-11-19-ugc-01.mp4`)
ffprobe: `h264 | 1080x1920 | 30/1 | yuv420p | color_range=tv | color_space=bt709 | color_transfer=bt709 | color_primaries=bt709 | 480 frames | 16.000000 s`; audio `aac 48000 Hz stereo`.
Loudness (master.sh): before -20.62 LUFS / -7.64 dBTP, after **-14.00 LUFS, true peak -1.02 dBTP** (own check with ffmpeg loudnorm: input_i -14.00, input_tp -1.02; ebur128 reads -13.8 LUFS). Target -14 +-1 LUFS: met. True peak <= -1 dBTP: met, but only by 0.02 dB (master.sh itself would pass anything up to -0.5, so this was tuned by hand: an earlier mix with louder effects measured -0.85 dBTP and was rejected; effects were lowered 6 dB and the bed raised 10 dB with the new mix.py stem gains). LRA 1.4-1.6.
Preview: 540x960, 30 fps, 480 frames, bt709.

## Sync (every cue within 1 frame; measured on the finished, mastered file)
Method (`jobs/2026-11-19-ugc-01/check-sync.py`): picture cause = first frame whose region differs from a reference frame; sound onset = the cue's first audible sample (found in the effects stem by waveform match, lead-in added) moved by how far the film's audio sits after `audio/mix.wav` (2 ms, envelope match 1.000).
| Cue | On-screen cause | Picture frame | Sound onset (frame) | Offset |
|---|---|---|---|---|
| whip | hard cut hook to demo | 75 (2.500 s) | 75.06 | +0.06 |
| soft-click | pointer clicks the sidebar item (press and ring) | 150 (5.000 s) | 150.06 | +0.06 |
| toast-pop | glow opens on New | 237 (7.900 s) | 237.06 | +0.06 |
| offer-sting | "Try it free" lands | 399 (13.300 s) | 399.06 | +0.06 |
| logo-sting | wordmark appears | 420 (14.000 s) | 420.11 | +0.11 |
Each animation was built so its first visible frame is the cause frame (fades start one frame early). The other six cues (notification at frame 0, impact-soft at 0.4 s, riser ending on the cut, small-whoosh at 5.6 s, text-swish at 9.3 s, success-chime at 10.5 s) are placed from the same `events.json` the scenes read, but were not separately measured. No two sounds of one kind sit within 0.3 s (build.mjs refuses it).

## Grade edit (job `edit/grade.json`, one file per job)
- Baseline: all three stills `look: clean-cool`. Edit: `demo-3` exposure 0 to +0.3, `build.mjs` re-graded once, preview re-rendered. Only the frames showing demo-3 changed: PSNR before vs edit = inf at 4 s (demo-1) and 14 s (CTA), 31.8 dB at 11 s (demo-3). See `grade-edit-before-after.png`: the card greys lift to near white.
- Reset: `grade.mjs reset ... demo-3` writes the neutral recipe; the regraded `demo-3.png` is md5-identical (f37cd778...) to `gradeStill(src, neutral)` and 66.4 dB PSNR to the source still (colour round trip only). 11 s frame vs edit: 31.5 dB, vs baseline look: 36.8 dB.
- Restored the baseline recipe: `demo-3.png` md5 5518506c... equals the baseline's, and a re-render of `raw.mp4` is byte-identical to `raw-baseline.mp4`, so the delivered export matches the recorded recipe.
- Preview and export read the same pictures: `engine/public/jobs/ugc-01/graded/{demo-1,demo-2,demo-3}.png`, written once by `applyGrade()` from `edit/grade.json`; neither render grades anything itself. Neutral recipe: `gradeFilter()` returns '' and the chain is unchanged.

## Tests
- `node --test tools/footage/tests/grade.test.mjs`: 9 pass, 0 fail (identity, chain order and bt709 tags, slider/look filters, 3 looks, bad values, per-clip recipe + reset, file round trip, neutral still = 66 dB round trip, brighter with exposure, beforeAfter width).
- `python3 -m unittest discover -s tools/audio/tests -p 'test_mix*.py'`: 12 pass (3 existing + 9 new in `test_mix_options.py`: golden pin of the default filter graph, each control changes it, duck depth is exact (6 dB under a line, 0 dB outside, measured on a real render), stem gain moves that stem by that much, crossfade edges, 80 ms limit).
- Existing footage tests (footage, framing, paper): 29 pass.
- Default-off check: the filter graph of the new `mix.py` equals the old one for a fixed input (golden string in the test), and `mix.wav` from old and new code with no flags on this job's audio is md5-identical (1a345ad6...). Not identical: the `stems/sfx.wav` of the OLD code differs run to run on this degenerate silent-voice job (ffmpeg amix at extreme gains), so stems were not used as the proof.

## What changed (paths)
New: `brands/tulvo/styles/ugc-phone-take/style.json`; `tools/footage/lib/grade.mjs`; `tools/footage/tests/grade.test.mjs`; `tools/audio/tests/test_mix_options.py`; `engine/src/jobs/ugc-01/{Film.tsx,film.json,ugc.tsx,entry.tsx,scenes/S01-S04.tsx}` (Film.tsx and film.json are scaffold output); `jobs/2026-11-19-ugc-01/{job.json,shots.json,events.json,build.mjs,render.sh,check-sync.py,audio/*,edit/grade.json,out/*}`.
Edited: `tools/audio/mix.py` only (new flags `--duck-db`, `--gain-voice/--gain-music/--gain-sfx`, `--xfade-ms` (max 80), `--ref-db`; all default off). `workcopy.mjs`, `master.sh`, `scaffold.mjs`, `engine/src/jobs/index.ts` untouched (index.ts was rewritten by scaffold and restored with `git checkout`). Git-ignored and local: `engine/node_modules`, `engine/public/jobs/ugc-01/` (graded stills, audio, captions).

## Decisions and deviations to know about
1. **Captions are drawn by the scenes, not the shared `Captions` pill.** The shared pill sits in the platform-safe band (about 57-65% of the height in 9:16), but the approved card and preset need 82-93% (y 1574-1786). `Film.tsx` is regenerated by the scaffold, so the shared captions get an empty file (`audio/captions.json` has no lines) and `ugc.tsx` draws its own pill (brand headline type, max 7 words, one highlighted phrase). The word times are spread over each line by letter count (there is no voice).
2. **Scaffold limits worked around, not edited:** it fixes 60 fps and names the engine folder from the job folder. `build.mjs` scaffolds through a temp link named `ugc-01` (engine name `ugc-01`, as asked), then writes fps 30 and 16.0 s into `film.json`. `tools/film/render.sh` would scaffold again at 60 fps, so the job has its own `render.sh`. The scaffold's `jobs/index.ts` lists the hand-built `rubik-ep1` (no `job` export, needs a `rubik` brand), which breaks the shared bundle, so ugc-01 renders through its own entry `engine/src/jobs/ugc-01/entry.tsx`.
3. **Voice** is a silent `audio/voice.wav` placeholder; `mix.py --ref-db -20` stands in for the voice level so cues and the bed get sensible gains. Music is off (card: off by default); the room-tone bed (ambience/room-apartment-window-01, 16 s) is fed in as mix.py's "music".
4. **Hook sound times:** notification at frame 0 (banner), impact-soft at 0.4 s when the first caption lands (card said 0.0; the banner owns 0.0).
5. **Notification banner** text ("Your Lead Pipeline is open") is an invented UI flourish, not a product screenshot. Proof caption names only visible things (tab names); no numbers or result claims. The "Try it free" wording has no owner approval for this fixture (card open question 4).
6. Two stills swap at 5.1 s (page click-through) and 7.9 s (demo-2 to demo-3, same pixels unless a grade edit differs; so a grade edit on one still shows as a step at its boundary).
7. Grade extras: still PNGs are graded in 4:4:4 (the stills chain swaps pictureChain's last `format=yuv420p` for 4:4:4, in `stillChain`, without touching `workcopy.mjs`); a clip path `gradeClip()` exists and writes bt709-tagged yuv420p but was not exercised in the render (the film uses stills).
8. Browser: this worktree has no Chrome Headless Shell and Remotion could not download one (no network), so `render.sh` falls back read-only to the one cached in the main checkout's `engine/node_modules/.remotion`. Chrome ran with the sandbox off.

## Not done / needs the owner
- Nobody has listened to the film (kit sounds carry the library's "not checked" note; the room-tone has a fan-hum doubt).
- `tools/checks` smoothness/flash checks from the card were not run.
- Rights: publicUse/bundling still null; demo client names on screen not confirmed fictional; voice, offer wording and the take-5 60 fps recording still pending (stills only, so the "real motion" gap remains).
- The true-peak margin is 0.02 dB; a different encoder build could tip it over -1 dBTP. Lowering `--gain-sfx` a further 1 dB buys margin.
- The doubt on `master.sh` (looser -0.5 dBTP gate) stands; not edited, as instructed.
