# Conductor on the latest engine (RC3)

**Base:** this branch merges d827069, the source of Damex Video Engine 0.1.0-rc3 (release ff9a20f), in dd6f088. It merged cleanly. The branch changes **0 files under `engine/`** compared with that source, so the engine is RC3's as released.

| Check | Result |
|---|---|
| Sample film render (`node setup/runtime/sample.mjs`, RC3's own first-run render) | **passed**: 732 frames, 12.20 s, 0.59 MB, about 10 s wall |
| Engine type check (`tsc --noEmit`) | 3 errors, all `public/jobs/*/captions.json`, which is generated per job and git-ignored; nothing else (`05-engine-typecheck.txt`) |
| All tool tests (`tools/**/tests`, with the engine packages present) | **190 passed, 0 failed**, 6 skipped |
| Setup runtime tests (outside the sandbox: one opens a local port) | **22 passed, 0 failed** |
| Conductor 15, plan 42, library 10, film 14 | all passed |
| Registry against the RC3 release folder | 995 customer items, **0 mismatches**; privacy scan passed with RC3's versioned `release/manifest.json` |

**The conductor on a real engine job.** The job is a copy of `jobs/2026-11-18-halden-launch`, whose scenes are `engine/src/jobs/…/scenes/S01–S04.tsx`. Scripted stand-in workers were used, so there were no model calls (`05-conductor-engine.txt`, script `../verify/engine-check.sh`).
- Routing: scene code goes to Sonnet (scene-builder), critique to Sonnet (frame-critic), lookups to Haiku (checker), renders to scripts, and idea and direction to the lead.
- Approvals are recorded against the job's real files (brief, audio, shots and storyboard). Editing `shots.json` makes the storyboard approval STALE (exit 3); restoring it makes it OK.
- Two scene-builders on S01 and S02 are allowed. A third is refused at the active cap of 2 (exit 4).
- A claim on the whole `scenes/` folder while S01 is held is refused for overlapping writes.
- S03 gets one try plus one retry, then the retry cap stops it.
- `opus` is refused when settings allow only sonnet and haiku, and is not swapped for another model.
- Paid work is refused without a `paid_usage` approval.
- A session that dies with S04 claimed is caught by `resume`: S04 is marked interrupted, its partial file is kept, 1 retry is left, the satisfied gates are skipped, and the next gate is named.
- `usage` totals the claims per stage and model: 5 claims, with tokens recorded for 2 of them.
- Step 3's refusal of `jobs/halden-launch/brief.json` comes from the test setup: the copy sits in a temp folder, so that path cannot resolve from the studio folder. The `jobs/<job>/` form is covered by the unit test, run from the studio folder.

**Not covered here:**
- A live session where real Sonnet helpers write and render scenes.
- Windows: `setup/start.ps1` was written, but there is no PowerShell on this Mac to run it.
- A full native smoke run (`setup/runtime/smoke.mjs`). It reinstalls the packages, and here they were borrowed read-only from the main checkout through a temporary link that has since been removed.
