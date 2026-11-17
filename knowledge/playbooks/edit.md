# Playbook: editing raw footage

Footage the team recorded (a person talking, a screen recording, an event clip) turned into a finished video.

| | |
|---|---|
| Length | Decided at intake from the footage and where it will run |
| Energy preset | Matched to the footage |
| References to study first | The creator-style clips in `library/references/cursor/`, `elevenlabs/`, `grok/`, and `hostinger/` for live-action ads |

## What changes for this type

The approvals stay, with different contents:

| Approval | For an edit job |
|---|---|
| Idea | The angle: what this footage is really about, in one sentence, and the hook taken from it |
| Script and voice | The paper edit: the transcript with kept lines marked, in order. Any added voice lines |
| Moodboard | Caption look is fixed; this covers titles, colour treatment, music mood, product inserts |
| Storyboard | The cut list on the design canvas: each kept clip, each insert, each title |
| First animation | The rough assembly: cuts only, with captions |
| Full animation | Colour, sound, inserts, titles, music |

## Steps

1. **Ingest.** Footage goes into the job's `footage/` folder. Run `node tools/footage/footage.mjs ingest jobs/<job>`: each clip is measured, given a working copy (steady frame rate, upright, normal colour), transcribed word by word with fillers kept, and checked for picture and sound problems (`tools/footage/README.md`).
2. **Log.** `jobs/<job>/edit/log.md`, written by ingest: every clip with what is said, what is seen, picture and sound notes, and the repair proposed for each. Look at each clip's contact sheet (`edit/clips/<clip>/sheet.jpg`) too.
3. **Paper edit.** Cut by the words. Choose the strongest opening line first; it becomes the hook even if it was said last. Run `node tools/footage/footage.mjs paper jobs/<job>` for the tool's proposals, then hand the person the transcript page (`node studio/server.mjs`, then http://localhost:4317/paper) and wait with `node studio/wait-for-notes.mjs jobs/<job> --paper`.
4. **Tighten.** Remove dead air, filler words and repeats. Leave a breath between thoughts; do not cut every pause. The cut list does this from the paper edit (`footage.mjs cut`), and `footage.mjs rough --render` makes the rough cut for the "First animation" approval; it will not run while a flagged join is unanswered.
5. **Clean the sound.** `node tools/footage/footage.mjs repair jobs/<job>` repairs each clip by what ingest measured, never lowering the voice's speech-quality score, and writes `edit/clips/<clip>/sound.json` (what was done and why, the scores before and after, earshot's words for the difference). A person listens to each `voice/mix.wav` before the rough cut is approved. The rough cut uses the repaired voices.
6. **Cover the cuts.** Every jump in a talking shot is covered by a product insert, a slight reframe (10–15% push), or a title. The footage camera punches in on every cut inside one take by itself (1.22 times, the eye line kept), and frames every film size from the face; `node tools/footage/footage.mjs check-framing jobs/<job>` checks it.
7. **Add product.** Inserts of real Tulvo UI follow `craft/05-ui-choreography.md`.
8. **Captions, music, sound design.** As for any film.

## Rules

- The speaker's meaning is never changed by the cut. No sentence is assembled from words said apart.
- Faces are never reframed tighter than chin to hairline.
- Screen recordings supplied by the team are checked against the current product. Out-of-date screens are flagged, not hidden.
- Footage is never upscaled past what holds up at 390 px wide.
- Nothing is delivered with someone's face or voice in it unless the maker confirms that person agreed.

## What Claude cannot judge here

Whether a take feels natural, whether a joke lands, whether the speaker sounds right. The paper-edit approval is where a person decides that.
