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

## Phase 2: paper edit and rough cut

```bash
node tools/footage/footage.mjs paper jobs/<job>
```

Writes `edit/paper.json`: every sentence in clip order, fillers and repeated words struck, the earlier takes of a line said more than once struck (the last complete take kept), and the tool's proposals (opening-line ideas with reasons, possible fillers, long pauses). Running it again keeps a person's choices and refreshes the proposals; `--fresh` starts again. `--energy` and `--target` override the job's energy preset and length.

A person then decides on the transcript page: `node studio/server.mjs`, then http://localhost:4317/paper. Click a word to cut it or bring it back, shift-click to hear it, move sentences, keep a pause as it was said, say yes to a flagged join, and play the edit as it stands. Send marks the paper edit as sent; `node studio/wait-for-notes.mjs jobs/<job> --paper` waits for that.

```bash
node tools/footage/footage.mjs cut jobs/<job>
node tools/footage/footage.mjs rough jobs/<job> --render
```

`cut` writes `edit/cutlist.json`. Each cut lands on the quiet dip between words, with room before and after; a long pause becomes a breath (by energy preset); the clip's own room tone fills a breath only where the footage is short of quiet. Every join is checked for meaning: a join inside a sentence that is not just a filler or a shortened pause is flagged, with any "not", number or name it loses, and needs a person's yes (on the page, or `footage.mjs approve jobs/<job> <key>`).

`rough` joins the dialogue sample by sample with 15 ms crossfades (`edit/rough/dialogue.wav`), checks it for clicks, listens back (transcribes it and compares it word for word with the paper edit), makes captions, and hands the engine's `FootageCut` the pictures. `--render` renders `jobs/<job>/out/rough-cut.mp4` (outside Claude's command sandbox). It will not run while a flagged join is unanswered.

## Phase 3: sound repair and dialogue

```bash
node tools/footage/footage.mjs repair jobs/<job>
```

For each clip: a separate recorder is found by its sound and lined up to the sample; two microphones are split, each one's pickup of the other voice turned down, and each word given to its microphone. Then each track gets only the repairs ingest measured: rebuild clipping, remove clicks, notch hum, cut rumble below the voice's lowest notes, soften pops, separate music (Demucs), remove noise (DeepFilterNet), reduce echo (WPE), lower breaths, soften harsh "s" sounds, even the level, and one loudness (−20 LUFS). Separating music, removing noise and reducing echo are guarded by Microsoft's DNSMOS speech-quality score: tried strong, then lighter, and left out if the voice's score drops. A voice's tone is matched across clips when its pitch says it is the same person.

Each clip gets `voice/<track>.wav`, `voice/mix.wav` and `sound.json`: every step with its reason and result, the scores before and after, and earshot's words for the difference. The rough cut then uses the repaired voices, evens the room at every cut, and draws the sound at every cut (`rough/cuts.png`, one fixed scale: a bright vertical line is a click, a dark band a gap, a colour change across the line a change of room).

Credits: DNSMOS models © Microsoft, CC BY 4.0 (github.com/microsoft/DNS-Challenge); DeepFilterNet (MIT or Apache 2.0); Demucs (MIT); nara_wpe (MIT); MediaPipe face landmarker (Apache 2.0); YuNet face detector (MIT, github.com/opencv/opencv_zoo).

## Phase 4: faces and framing

Ingest now also finds each person's face (`faces.json`: up to two people per shot, positions only, never who they are). Each camera change in the footage starts afresh: people are kept apart by position within a shot, and who is who across shots is for a person to say (telling them apart would mean recognising faces, which the tool never does). A small face in a wide 4K shot is first found in overlapping tiles of a few frames, then followed in the area around it; a face turned away from the camera (two people talking to each other) is found by OpenCV's YuNet detector and measured on a close crop. Ingest then works out who speaks each word (`speakers.json`: the mouth that moves, the only face on screen, or on a two-microphone clip the microphone that hears it best), and steadies a shaky clip first (ffmpeg's vidstab with a fixed 5% crop; the movement is found on a copy at most 1080 on its short side, so a minute of 4K phone footage takes about 4 minutes instead of 27; the shaky original is kept as `edit-unsteady.mp4`).

The rough cut then frames every piece for every film size (16:9, 9:16, 1:1, 4:5) with the footage camera (`lib/framing.mjs`): eyes a third of the way down, more room on the side the person faces, never tighter than chin to hairline, never enlarged more than 15% beyond what the size unavoidably needs (counting steadying's crop), still while the face stays in a calm zone and eased moves when it leaves, a punch-in on every cut inside one take (1.22 times tighter than the wide framing, the eye line kept), and a slow push over the opening line. Two people: both in a wide frame; in a tall frame, whoever is speaking. A camera change in the footage is a clean cut in the framing too; the eye line is carried across every cut inside a take; and the frame moves before a face would leave the safe area. The keyframes go into `rough/framing.json` and the engine draws exactly those. Captions are split per size (about 17 characters a line in 9:16), and a line moves to the top of the frame when a face would be under it at the bottom.

```bash
node tools/footage/footage.mjs check-framing jobs/<job>
node tools/footage/footage.mjs rough jobs/<job> --render --size 9:16
```

`check-framing` checks every size ten times a second: the framed face's hairline and chin in frame, the face inside the size's safe area (room for the platform's own buttons and the captions in tall sizes), no enlargement past the limit, the eye line steady across punch-ins, and captions never over a face (brows to chin) and never wider than the frame. Two things the footage itself causes are listed as notes, not failures: a face the footage frames tighter than the safe area allows, with the crop already at the footage's edge ("tight in the footage"), and an eye line the camera cannot hold because the crop is at the footage's edge ("eye line held back by the footage's edge"). The rough cut runs it too.

## How it was checked

`tests/make_clips.mjs` makes four synthetic clips with known contents (fillers and a retake; a sideways HDR phone clip with an uneven frame rate and one-sided sound; a dark, soft, grainy, flickering clip with noise, 50 Hz hum, music, clipping and clicks; two shots with a cut and shake). `tests/check_truth.mjs` checks an ingested job against them: 31 checks. `node --test tools/footage/tests/*.test.mjs` runs the fast tests (32). `tests/check_rough.mjs <job> --render` checks phase 2 on a job holding the synthetic talking clip: the retake and fillers gone, every kept word heard and nothing struck, no clicks, and the rendered picture within one frame of its sound (9 checks). `tests/check_repair.mjs <job>` checks phase 3 on the full synthetic set (it now also makes an interview on two microphones, a separate recorder and an echoey room): 19 checks. `tools/footage/.venv/bin/python -I -m unittest discover -s tools/footage/tests -p 'test_*.py'` runs the repair tests. `tests/make_face_clips.py <job> ...` makes phase 4's footage from two CC0 portrait photos (no recording of anyone): a 4K wide shot with a small, swaying face, two people whose mouths move on their own lines, and a hand-held shot; `tests/check_faces.mjs <job>` checks the faces, who speaks, steadying, the framing check in every size, the punch-ins and the speaker followed in 9:16 against what was put there. The thresholds for the findings were set on these synthetic clips and are checked again on the first real footage.

## Notes

- Transcription is whisper large-v3-turbo with exact word timing, then word edges next to a pause are snapped to the sound: phrase edges land within 30 ms on clean and phone sound. In heavy noise a word's quiet tail can be lost (about 0.1 s); the cut rules in phase 2 leave room for that.
- Inside Claude's command sandbox whisper cannot reach the Mac's graphics chip and runs on the processor (about 0.8 times real time). Outside it, it is faster.
- `tests/make_clips.mjs` uses the Mac's own voice (`say`), which only works outside Claude's command sandbox.
