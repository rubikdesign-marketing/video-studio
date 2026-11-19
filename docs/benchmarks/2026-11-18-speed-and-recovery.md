# Speed and recovery: before and after

18 November 2026. One machine for every figure: Apple M4, 10 cores, 16 GB, macOS 26 (Darwin 25.6). Same inputs before and after: the Imagine Notion film (`jobs/2026-11-17-bf-imagine-notion`, 50.0 s, 1:1, 60 fps, 9 scenes, 19 storyboard cues), its code unchanged. Raw run records: `2026-11-18-storyboard-runs.jsonl` here, and the job's own `runs.jsonl`.

## Storyboard frames (19 frames at two-thirds size)

| Method | Time | Per frame |
|---|---|---|
| Before: one `npx remotion still` per frame, PNG then JPEG (Remotion's own build cache warm) | 37.6 s | 1.98 s (1.47 to 4.07) |
| After, first run (bundles the engine, 1.2 s) | 22.1 s | 1.16 s |
| After, bundle reused, one frame at a time | 12.7 s | 0.67 s |
| After, bundle reused, two at a time (default) | 8.3 s | 0.44 s |
| After, bundle reused, three at a time | 6.5 s | 0.34 s |
| After, one scene only (`--only S01`, 4 frames) | 6.7 s | |

Peak memory, one at a time: 0.73 GB. Frames compared with the old method at the same frame numbers: same picture; PSNR 30 to 41 dB, the difference being the shader background's noise and the JPEG encoder (side-by-side checked by eye for frame 12).

**Correction to the audit:** it assumed every frame paid a full cold start. Remotion's own build cache already made each `still` about 2 s once warm. The real gain is 4.5 to 5.8 times on a warm board, not an order of magnitude. Remotion's build cache, used through its Node API, produced a bundle that never loaded ("Waiting for root component to load"); the new bundle helper turns that cache off and bundles in about a second instead.

## Preview and one-shot revision (same film)

| Step | Time |
|---|---|
| Whole film, half size (`render.sh preview`) | 84 s |
| One scene changed and swapped into the preview (`render.sh scene S05 --splice`, 6.7 s of film) | 33 s |
| Full-size master (from the job record, not re-measured today) | about 240 s |

So a revision of one shot costs about 40% of a full preview and about 14% of a master. Not yet measured: the same splice after a voice change (it refuses, by design, and asks for a full preview).

## Recovery

| Test | Result |
|---|---|
| Kill a preview render (SIGKILL) after 30 s, at frame 647 of 3,000 | The previous preview was untouched (same checksum). No partial file left in place of it. |
| The next render after that kill | Cleared the dead lock on its own ("process 23884 has ended") and ran. Before: a killed storyboard left a lock with no owner, and every later render waited forever. |
| A lock with no owner, 80 minutes old | Cleared on its own. A young one (under 30 s) is left alone. |
| Same paid generation sent twice (stand-in server) | One paid request. The second run prints the existing task. |
| Generation refused (balance), then sent again | Allowed, and noted as a resend. |
| Connection dropped after sending | Marked "may have been charged"; not re-sent until the person checks the provider's task list and passes `--resend`. |
| Master that fails its loudness check | The previous master stays. Before: the old master was overwritten before the check. |

## Review copies

| Film | Before | After |
|---|---|---|
| 1080 × 1920 | 1280 × 2276 | 720 × 1280 |
| 1920 × 1080 | 1280 × 720 | 1280 × 720 |
| 1080 × 1080 | 1280 × 1280 | 720 × 720 |
| 640 × 360 | 1280 × 720 (enlarged) | 640 × 360 |

## Not measured

AI tokens per stage (the app does not give them to the session; the cost report says "not recorded" and shows how to add them), ElevenLabs spend, and time waiting for approval in hours (job records keep dates only).
