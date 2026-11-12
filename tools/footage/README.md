# Footage tool

Turns footage a team recorded into material the studio can edit. The plan is `FOOTAGE-PLAN.md`; this is phase 1, ingest and log.

## Use

1. Put the clips in the job's `footage/` folder (video or sound files; a camera's Log LUT, if any, beside its clip as `<clip>.cube`).
2. Run:

```bash
node tools/footage/footage.mjs ingest jobs/<job>
```

3. Read `jobs/<job>/edit/log.md` and each clip's `edit/clips/<clip>/sheet.jpg` before the paper edit.

Running it again skips what is already done unless a clip changed; `--force` does it all again, `--clip <name>` does one clip. `--engine parakeet` transcribes with Parakeet instead of whisper; `footage.mjs compare jobs/<job> --clip <name>` saves both transcripts side by side. `footage.mjs log jobs/<job>` rewrites the log only.

## What each clip gets

| File | What |
|---|---|
| `clip.json` | Measurements (size, frame rate and whether it varies, rotation, colour, sound channels and level), what the working copy changed, the source's fingerprint |
| `edit.mp4` | Working copy: steady frame rate, upright, HDR converted to normal colour, a keyframe every 10 frames, at most 3840 on the long side |
| `sound.wav` | The sound, 48 kHz; a microphone on one side copied to both |
| `words.json` | Every word with start and end, fillers marked (`"filler": "yes"` or `"maybe"`), edges next to pauses snapped to the sound |
| `shots.json` | Shot changes inside the clip |
| `quality.json` | Picture and sound per second, and findings in plain words |
| `sheet.jpg`, `scopes/` | Contact sheet: a picture per shot, the words said, brightness and colour scopes |

None of it is synced: `jobs/*/edit/` and `jobs/*/footage/` stay on the Mac.

## How it was checked

`tests/make_clips.mjs` makes four synthetic clips with known contents (fillers and a retake; a sideways HDR phone clip with an uneven frame rate and one-sided sound; a dark, soft, grainy, flickering clip with noise, 50 Hz hum, music, clipping and clicks; two shots with a cut and shake). `tests/check_truth.mjs` checks an ingested job against them: 31 checks. `node --test tools/footage/tests/*.test.mjs` runs the fast tests. The thresholds for the findings were set on these synthetic clips and are checked again on the first real footage.

## Notes

- Transcription is whisper large-v3-turbo with exact word timing, then word edges next to a pause are snapped to the sound: phrase edges land within 30 ms on clean and phone sound. In heavy noise a word's quiet tail can be lost (about 0.1 s); the cut rules in phase 2 leave room for that.
- Inside Claude's command sandbox whisper cannot reach the Mac's graphics chip and runs on the processor (about 0.8 times real time). Outside it, it is faster.
- `tests/make_clips.mjs` uses the Mac's own voice (`say`), which only works outside Claude's command sandbox.
