# Footage editing: plan

Written 12 Nov 2026 at the owner's request. The owner accepted all seven recommendations the same day and asked for deeper picture post-processing and sound engineering; sections 6 and 7 cover those, and section 13 records the answers. Phase 1 (ingest and log) was built and tested on synthetic clips on 12 Nov, and phase 2 (paper edit and rough cut) on 17 Nov; each is marked done when the owner's three real clips pass. Face tracks, plates and cutouts were built ahead of phases 4 to 7 for the first real edit (13 Nov, see DESIGN.md); the rest of phases 3 to 8 is not built.

The studio already accepts "edit of raw footage" as a video type, with its own playbook (`knowledge/playbooks/edit.md`) and the usual approvals. What it lacks is the tooling: today only transcription (whisper.cpp) and the sound checks exist, so an edit would be cut by hand. This plan builds the footage tool, `tools/footage/`, and the engine parts that play its output, so that footage a team recorded (a person talking to camera, an interview, an event clip, a hand-made screen recording) becomes a finished, branded video with the care of a professional edit, grade and sound mix.

Four principles hold throughout:

1. **The speaker's meaning never changes.** Every kept stretch is a run of words said together, in one take. A join inside a sentence is shown to a person before it is used. No word is invented, moved, or spoken by a made-up voice.
2. **Analyse once, decide later.** Ingest measures everything (words, faces, shots, sound, quality) and saves it beside the clip. Cuts, framing, repair, grade and mix are recipes made from that data, so they can change without analysing again. The original files are never changed.
3. **Find faces, never identify them.** The tool finds where faces are and how they are turned, to frame them. It never works out who someone is, and keeps no face prints. A person names each face once, by hand, with their consent.
4. **Any company.** Nothing assumes Tulvo. Style, captions, sounds and rules come from the brand's folder.

---

## 1. Where we are

| Part | Status |
|---|---|
| Video type, playbook, approvals for an edit | Written (`knowledge/playbooks/edit.md`) |
| Transcription | whisper.cpp with the small English model; good for checking a voice against its script, not precise enough to cut on |
| Sound measuring, voice checks, the mix (`tools/audio/mix.py`: voice, music and effects with music at 20–30% of the voice) and the master (`master.sh`: −14 LUFS, peaks under −1 dBTP) | Built, for made voices; footage needs the repair and dialogue work in section 7 before them |
| ffmpeg filters for every picture and sound step in sections 6 and 7 (denoise, deflicker, deband, sharpen, lens, scopes, LUTs, HDR conversion, stabilising; declip, declick, hum, gate, compressors, EQ, ducking, loudness, phase) | Present in the installed ffmpeg (all checked 12 Nov) |
| HyperFrames tools (installed, 0.9.34) | Cutouts (`remove-background`), a second transcriber (Parakeet), grades and LUTs (`media-treatment`) |
| Framing in other sizes, platform safe areas, captions-clear check | Built for captures (Phase 8, `engine/src/kit/capture/relayout.ts`, `safeareas.tsx`, `tools/checks/captions_clear.mjs`); the footage tool reuses their rules |
| Ingest and log (phase 1): measuring, working copies, transcripts to cut on, shot changes, picture and sound findings, contact sheets with scopes, the log | Built 12 Nov, tested on synthetic clips (section 12) |
| Paper edit and rough cut (phase 2): proposals, the transcript page, cut rules with the meaning guard, the dialogue joined sample by sample, listen-back, `FootageCut` in the engine | Built 17 Nov, tested on a synthetic clip (section 12) |
| Sound repair, picture repair and grade, framing in the engine's cut | Not built (face tracks, plates and cutouts exist from the first real edit, 13 Nov) |
| Python | The Mac has Python 3.15, too new for the face, video and sound packages. The footage tool gets its own Python 3.12 environment, made by `uv` (already installed) |

---

## 2. What footage we will edit

| Kind | Example | What makes it hard | What the tool needs |
|---|---|---|---|
| **Talking to camera** | A founder explains a feature on a phone | Ums, false starts, several takes of one line, jump cuts, a phone's HDR and changing frame rate | Word-level transcript, retake finder, punch-ins on cuts, HDR to normal colour, steady frame rate |
| **Interview, two people** | A customer story | Two speakers, two microphones that sound different, a separate recorder | Who speaks when, sync by sound, mic matching, framing that follows the speaker |
| **Webinar or long talk** | A 45-minute session cut to clips | Hours of material, laptop microphones, slides on screen | Transcript first, analysis only of the parts chosen; heavy voice repair; slide changes found as shot changes |
| **Event clip** | A booth, a meetup | Noise, music, echo, people in the background, shaky hands, flickering lights | Voice isolation, music separation, de-echo, stabilising, deflicker, blurring bystanders |
| **Hand-made screen recording** | A recording made with Cap | Out-of-date product screens, no motion log | Checked against the current product, as the playbook says; a scripted capture offered instead |
| **Phone vertical footage** | A creator-style clip | Already 9:16; a 16:9 version needs a different frame | Framing in every size from the face track |

---

## 3. Ingest and log

`footage.mjs ingest jobs/<job>` takes everything in `jobs/<job>/footage/` and, for each clip:

| Step | What happens |
|---|---|
| **Measure** | Length, size, frame rate (and whether it varies), rotation, colour (normal, HDR, or Log), sound channels, sample rate and level |
| **Edit copy** | A working copy for the engine: steady frame rate, upright, normal colour (HDR and Log converted with their proper curves), with a keyframe on every frame or close to it so the engine can jump to any frame exactly. The original stays as it was |
| **Transcribe** | Every word with its start and end, including "um", "uh" and false starts (the transcriber is told to keep them). Model: the larger whisper model with exact word timing, or Parakeet; phase 1 compares both on the test clips and keeps the better one. Never translated: the transcript stays in the language spoken |
| **Shot changes** | Every cut already in the clip (PySceneDetect), so a clip edited before can be logged by shot |
| **Faces** | Section 5 |
| **Who speaks** | Each stretch of speech belongs to a face track or to "off camera", from the mouth moving together with the sound; a second microphone or a second camera says it directly |
| **Picture quality** | Per second: soft focus, noise, too dark or too bright, clipped highlights on faces, flicker, shake (from the stabiliser's own measurement) |
| **Sound quality** | Per second: noise floor, hum and its pitch, clipping, clicks, echo, wind, music under speech, a speech-quality score (section 7.8) |
| **Contact sheet and scopes** | One picture per shot with the words said over it, and its brightness and colour scopes (section 6.6) |

It writes `jobs/<job>/edit/log.md`: one table of every clip with what is said, what is seen, and picture and sound notes in plain words, each with the repair the tool proposes. That is the playbook's "Log" step, made automatic, for a person to read before the paper edit.

**Long material.** For anything over 20 minutes, ingest transcribes everything but runs faces, quality and repair only on the stretches the paper edit keeps.

---

## 4. Paper edit and tightening

### 4.1 The transcript page

The studio's review page (`studio/review.html`) gets a transcript view: the words of every clip, with play from any word, strike out to cut, drag a paragraph to reorder, and the running length of what is kept. It is the "Script and voice" approval for an edit job. Notes come back the same way as for any other approval.

### 4.2 What the tool proposes, before a person decides

| Proposal | How |
|---|---|
| **The hook** | The three strongest opening lines, wherever they were said, each with its reason |
| **Retakes** | The same sentence said more than once: all takes shown side by side, the last complete one proposed, a person confirms (owner's answer 4) |
| **Fillers** | "Um", "uh", "you know", "like" used as filler, and repeated words, marked to cut. Some are kept where cutting them would make a jumpy edit |
| **Dead air** | Silences shortened to a breath. The breath length depends on the energy preset (about 0.25 s for hype, 0.45 s for calm). Pauses for effect are kept |
| **Length** | When the kept length is over the target, the lowest-value stretches are listed for a person to drop |

### 4.3 How cuts are made

- A cut lands just before the first sound of a word and just after the last, with a little room each side, at the quietest point nearby.
- Picture and sound may cut at different moments (the sound leads into the next shot, or carries over the next picture), which makes an edit feel smooth.
- The sound side of every cut follows section 7.3.
- **Meaning guard.** The tool lists every join with the words on each side. A join inside a sentence, or one that drops "not", "never", "no", "only", a number or a name, is flagged and needs a yes in the paper edit.

The result is `jobs/<job>/edit/cutlist.json`: every piece, with its source clip, its picture and sound in and out points, and what covers each cut. The "First animation" approval is this cutlist, played rough with captions.

---

## 5. Face tracking and framing

### 5.1 What is measured

The face finder (MediaPipe's face landmarker, free) runs on a smaller copy of each frame, up to 30 times a second, and saves `faces.json` per clip:

| Data | Used for |
|---|---|
| A box around each face, and its track number (person 1, person 2), kept by position from frame to frame | Framing, captions-clear check, bystander blur, skin measurement for colour |
| Eye line, chin and an estimated hairline | The chin-to-hairline rule; keeping the eye line steady across cuts |
| Which way the head is turned | Leaving room on the side the person faces |
| Mouth open or closed | Who is speaking |
| Face lost (turned away, covered, out of frame) | The camera holds; it never chases |

The tracks are smoothed so the frame never jitters, and stored as positions only.

### 5.2 The footage camera

A footage camera follows the same rules as the capture camera (`relayout.ts`): it moves one way per move, eases in and out, stays still during speech unless the person moves out of a calm middle zone, and never goes past the source's own sharpness. On top of that:

| Rule | What it means |
|---|---|
| **Headroom** | The eyes sit about a third of the way down the frame |
| **Lead room** | More space on the side the person faces |
| **Closest framing** | Never tighter than chin to hairline (the playbook rule), checked on every frame |
| **Sharpness** | A 4K source in a 1080 film can be pushed in up to twice. A 1080 source may be enlarged by at most 15%, and the sharpness check reports each time it is (owner's answer 3) |
| **Punch-in on a jump cut** | Each cut inside one take alternates between the wide and a close framing (about 115–130% on 4K sources), keeping the eye line at the same height so the cut reads as chosen |
| **Push on a key line** | A slow push-in over a line the energy map marks as a peak; at most one per 20 seconds |
| **Stabilising** | Clips flagged as shaky are steadied first; the crop that steadying needs counts toward the sharpness limit |

### 5.3 Other sizes

The same face tracks frame 9:16, 1:1 and 4:5 versions: the frame follows the face, keeps the platform's safe areas clear (Phase 8's overlays and check), and keeps captions off the face. With two people in one wide shot, the vertical version either follows whoever is speaking, or stacks the two faces top and bottom; the storyboard chooses per scene.

### 5.4 A separate microphone, and later two cameras

Recordings of the same moment are lined up by their sound, to the sample. A separate microphone is built in phase 3. Two cameras come after phase 8 (owner's answer 5): the edit will cut to the speaker's camera at the start of each thought (never mid-word), and hold a reaction shot for at least 1.5 s.

---

## 6. Picture post-processing

Each clip gets a picture recipe, `treat.json`, proposed from the log and shown on the contact sheet as before and after. The tool applies it to make `treated.mp4`, which is what the engine plays. Changing the recipe only remakes the treated copy.

### 6.1 Repair

Done first, only where the log found a problem, at a strength set by what was measured:

| Problem | Repair |
|---|---|
| **Grain from low light** | Video denoise that compares neighbouring frames (strong on walls and backgrounds, light on the face so skin keeps its texture). Measured noise before and after |
| **Flicker** | From LED and fluorescent lights: evened out frame to frame. Dark stripes that roll through the picture (a phone's shutter under LED lights) cannot be fully removed and are flagged |
| **Wide-lens bend** | Phone ultra-wide and action cameras: straightened with a lens profile, only when straight lines (door frames, shelves) visibly curve |
| **Exposure** | Black and white points set from the brightness scope; faces brought to a steady brightness; highlights pulled back where the sky or a window is blown |
| **Shake** | Steadied (section 5.2). Wobble from a moving phone that steadying cannot fix is flagged |

### 6.2 Matching clips

Each clip's white balance, exposure and contrast are measured on the face (skin is the reference), then matched to one reference clip, so a cut between cameras, rooms or days does not jump. HDR, Log and mixed frame rates were already converted at ingest.

### 6.3 The look

- The video's style family (`knowledge/craft/13-design-styles.md`) sets a grade from the HyperFrames LUT library, applied gently and then tuned: contrast, warmth, saturation (raising quiet colours, not ones already strong).
- **Skin is protected.** Skin tones are held to their natural line on the colour scope through every grade. A look that pulls skin green, grey or orange is turned down until it does not.
- A soft edge darkening only where the style asks for it.
- **Footage and graphics agree.** The darkest black and brightest white of the graded footage are matched to the brand's own colours, so titles and product inserts sit in the same world as the footage instead of floating on it.

### 6.4 Finishing

| Step | Why |
|---|---|
| **Sharpening** | Light, after scaling to the film's size, never before; never on skin more than elsewhere |
| **Debanding** | Smooths steps in flat areas (a plain wall, a sky, a dark background) that compression turns into stripes |
| **Fine grain** | A very light film grain, where the style asks for it, hides banding and makes footage and clean graphics feel like one film |
| **Bystander blur** | Faces that are not a named, consenting person are blurred, or the shot is flagged |

### 6.5 Slow motion

Real slow motion only: footage shot at 60 or 120 frames a second can play slower. Made-up in-between frames are not used on faces (they warp them); on shots without people they may be used if a person asks (section 13, question 9).

### 6.6 What Claude looks at

Claude cannot judge colour by eye from numbers alone, so every shot, before and after, gets pictures it can inspect: the frame itself, a brightness scope, a colour scope with the skin line drawn, and a list of the share of the face that is blown out or crushed. A person approves the look at the full animation.

### 6.7 Not offered

Skin smoothing or retouching, face reshaping, AI upscaling and AI "face restoration" (they invent detail that was never filmed). These change the person, which principle 1 and section 11 rule out.

---

## 7. Sound engineering

The sound of footage is where most amateur edits fail. Each clip gets a sound recipe, proposed from the log, saved with its measurements, and run in this order. A person listens at two approvals (the rough cut and the full animation), as for every film (`knowledge/craft/07-sound.md`).

### 7.1 Repair

| Problem | Repair |
|---|---|
| **Wrong channels** | A microphone on only one side is copied to both. Two microphones on left and right become two separate tracks |
| **Two microphones out of step** | A camera microphone and a clip-on microphone are lined up to the sample, and checked so they do not cancel each other out when mixed |
| **Clipping** | Flattened peaks rebuilt where possible; a stretch too damaged to rebuild is flagged for a different take |
| **Clicks and mouth noises** | Lip smacks, tongue clicks and crackle removed without dulling the voice |
| **Pops** | Bursts of air on "p" and "b" softened |
| **Hum** | Mains hum (50 or 60 Hz) and its overtones found in the spectrum and removed with narrow cuts that leave the voice alone |
| **Wind and rumble** | Low rumble cut below the voice; wind gusts reduced |
| **Noise** | DeepFilterNet on the Mac by default; ElevenLabs' voice isolator when a person asks for it on a hard clip (owner's answer 2). The amount stops before the voice turns watery: the speech-quality score (7.8) must not drop |
| **Echo** | Room echo reduced by the same tools; a very echoey room is flagged, because heavy de-echo makes voices sound processed |
| **Music under speech** | The voice separated from the music (Demucs, free) so the voice can be cleaned and the music lowered or removed. The music's rights are still flagged; separating it does not make it ours (section 13, question 8) |
| **Breaths** | Lowered, never removed. A voice with no breaths sounds unnatural |

### 7.2 Dialogue

| Step | What it does |
|---|---|
| **Rumble cut** | Set from each voice's own lowest note, so deep voices keep their body |
| **Tone matching** | Each speaker's tone is measured across all their clips and microphones and matched, so a cut between a phone and a clip-on microphone, or between two days, does not change how they sound |
| **Clarity** | A gentle lift where words become clear, and harsh "s" sounds softened |
| **Even level** | Gentle compression, then a speech leveller so quiet words carry and loud ones do not jump, without pumping |
| **One loudness per speaker** | Every speaker brought to the same level before the mix, so the music and effects are set against a steady voice |

### 7.3 Sound at the cuts

- Every sound cut gets a short crossfade (10–20 ms) so it never clicks.
- A cut's gap is filled with the room's own quiet sound, taken from the clip, never with digital silence.
- The background noise level is matched between pieces, so a cut does not change the room.
- A breath before a cut is kept or removed to suit the pace, never cut in half.
- Spectrogram pictures of every cut, for Claude to inspect.

### 7.4 Music

- Composed (or chosen) after the paper edit is locked, so its sections fit the cut. The existing beat detection lands music changes on picture changes.
- Cut to length at the end of a bar, never mid-phrase; it ends on a strong beat with the picture.
- **Ducking by speech.** The words' timings say exactly when someone speaks. The music dips about 0.3 s before speech starts and rises within 0.5 s after it ends, keeping the existing rule of 20–30% of the voice.
- **Room for the voice.** As well as getting quieter, the music thins out in the range where words are understood, only while someone is speaking, so it can stay fuller without covering the voice.

### 7.5 Sound design for footage

- A quiet background bed under product inserts and titles, so cutting from a room to a product screen never drops into dead silence.
- Interface sounds on product inserts, as for any film; a soft movement sound on a key-line push only where the style asks for it, never on jump-cut punch-ins.

### 7.6 Mix

Built on the existing mix tool (`tools/audio/mix.py`), with the dialogue from section 7.2 in place of a made voice:

- Dialogue in the centre and in mono; music and background wide.
- **Plays on a phone.** Many people watch on a phone speaker, which plays mono. The mix is checked in mono so nothing disappears or turns hollow.
- **Clear over music.** During speech, the voice stays a set amount louder than everything else, measured, not judged.
- Separate parts kept: dialogue, music, effects (for an editor, or for a version in another language later).

### 7.7 Master and delivery

- The existing master: −14 LUFS with peaks under −1 dBTP for every video platform (section 13, question 10), 48 kHz.
- A limited loudness range for social films, so quiet passages are heard in a noisy place.
- Delivered with the separate parts from 7.6.

### 7.8 What is measured

| Measure | Used for |
|---|---|
| **Speech-quality score** (DNSMOS, free) per line, before and after repair | A repair that lowers the score is turned down; the lighter setting wins |
| Noise floor per piece | Matching rooms at cuts |
| Hum, clipping, click counts | Repair worked, nothing new added |
| Voice over music, per spoken line | The clear-over-music rule |
| Mono check, phase meter | Plays on a phone |
| Loudness, peaks, loudness range | Delivery |
| Spectrogram pictures | Anything the numbers miss |

---

## 8. Cutting the person out

A cutout (the person with a see-through background) makes three things possible: a title behind the person, the background blurred or replaced by the brand's stage, and the person placed over a product capture.

- **Fast cutouts** come from the HyperFrames `remove-background` command already installed. Good enough for titles behind a person who keeps still. This is the default (owner's answer 1).
- **Clean cutouts** (hair, hands, quick moves) need a heavier model (SAM 2, free, Apache 2.0) that takes minutes per clip on this Mac and about 2 GB of download. Added in phase 7 only if the first real edit needs them.
- The cutout is made only for the stretches that use it, and its edges are checked on the contact sheet. It is made from the treated copy, so it carries the grade.

---

## 9. What the tool hands the engine

Saved per clip in `jobs/<job>/edit/clips/<clip>/`, and per job in `jobs/<job>/edit/`. Copied to `engine/public/jobs/<slug>/edit/` the same way captures are.

| File | What it holds |
|---|---|
| `edit.mp4` | The working copy (section 3) |
| `treat.json`, `treated.mp4` | The picture recipe and the repaired, matched and graded copy the engine plays (section 6) |
| `clip.json` | Measurements, conversions done, source file and its fingerprint |
| `words.json` | Every word with its times and speaker |
| `faces.json` | Face tracks (section 5.1) |
| `shots.json` | Shot changes inside the clip |
| `quality.json` | Picture and sound quality per second |
| `sound.json`, `voice/` | The sound recipe, its measurements before and after, and the repaired dialogue per speaker (section 7) |
| `scopes/` | Scope pictures before and after (section 6.6) |
| `cutout/` | Cutouts, where used |
| `log.md`, `paper.json`, `cutlist.json`, `people.json` | The log, the approved paper edit, the cut list, and each named person with their consent (section 11) |

In the engine (`engine/src/kit/footage/`):

- `framing.ts`: the footage camera as plain calculations, like `relayout.ts`, so the checks measure exactly what is drawn.
- `FootageCut`: plays a cut list. Each piece is the treated copy from its in point, moved by the framing plan, with the dialogue on its own track (so sound and picture can cut apart), room sound under every cut, punch-ins, inserts and titles over cuts.
- Inserts of the product are ordinary `CaptureShot`s; the voice carries on under them.
- Titles behind a person use the cutout as a top layer.
- Captions come from `words.json` through the existing captions tool, so they match what was really said.
- The rendered film goes through the mix (7.6) and the master (7.7), then a final picture encode: a high-quality master file, plus platform copies with the colour labels set so uploads do not look washed out, at a bitrate high enough not to band.

**Hand-off to an editor.** The cut list is also written as a timeline that Final Cut Pro, DaVinci Resolve and Premiere Pro open (FCPXML, through OpenTimelineIO, free), with the separate sound parts, so a person can finish an edit by hand (owner's answer 6).

---

## 10. Checks

| Check | What it catches |
|---|---|
| **Meaning** | Every join inside a sentence, or one that drops a "not", number or name, has a person's yes |
| **Face framing** | On every frame and every size: the face inside the safe area, never tighter than chin to hairline, eye line steady across punch-ins |
| **Captions clear of faces** | The existing captions-clear check, with face boxes added to what captions must not cover |
| **Sharpness** | No 1080 source enlarged by more than 15%, each enlargement listed; nothing that fails at 390 px wide (playbook rule) |
| **Picture** | Faces not blown out or crushed beyond a set share; skin on its natural line after the grade; no visible jump in colour or brightness at a cut; no banding in the delivered file; colour labels correct |
| **Sound repair** | Speech-quality score not lowered by any repair; no hum, clipping or new clicks left |
| **Sound at cuts** | No click, no dead silence, no change of room, no level jump between pieces |
| **Mix and master** | Voice clear over music on every line; nothing lost in mono; loudness, peaks and loudness range on target |
| **Consent** | Every face that appears in the film belongs to a named person in `people.json` with consent recorded, or is blurred. A film with an unnamed, unblurred face fails delivery |
| **Smooth** | The existing smoothness check on the finished film |
| **Proof of source** | `tools/film/sources.mjs` extended: every footage piece in the film is listed with its source file, in and out points and the date it was recorded |

---

## 11. Safety, rights and sharing

- **Consent first.** Nothing is delivered with someone's face or voice in it unless the maker confirms that person agreed (playbook rule). `people.json` records each person's name, that they agreed, who confirmed it, and when. Children are never filmed or edited in.
- **No changes to people.** No lip-sync, no eye-contact correction, no face or body reshaping, no skin retouching, no AI upscaling or face restoration, no cloned voice to fix a fluffed word, no made-up people. A missing word means a pick-up recording by the real person, or a different cut. Repair removes noise from a recording; it never changes what a voice says or how it sounds as a person.
- **Detection, not recognition.** Face data is positions and shapes for framing, kept with the job, and deleted with it. No face prints, no matching people across jobs.
- **Music in footage.** Music recorded in the background is not ours to use because it can be separated. It is flagged, and removed or replaced unless the maker confirms the rights.
- **Footage stays private.** `jobs/*/footage/` is already never synced; `jobs/*/edit/clips/` and the engine's copies join it in `.gitignore` in phase 1.
- **Free parts:** MediaPipe and OpenCV (Apache 2.0), PySceneDetect (BSD), DeepFilterNet (MIT and Apache), Demucs (MIT), DNSMOS (free, from Microsoft), whisper.cpp (MIT), OpenTimelineIO (Apache 2.0), SAM 2 if added (Apache 2.0), ffmpeg as already used. Each company installs its own copies through the installer; the heavier ones (Demucs, SAM 2) only when first needed. ElevenLabs' voice isolator is paid, from the company's own plan.

---

## 12. Build order

Each phase is tested on three clips the owner supplies (section 13, question 7): a phone talking-head clip with fluffs and retakes, a noisy clip, and a two-person clip. A phase is done when its test passes and DESIGN.md says what was and was not checked.

| Phase | What | Done when |
|---|---|---|
| **1. Ingest and log** | The footage Python environment and installer step; measuring; working copies (HDR, Log, frame rate, rotation); transcripts with fillers, comparing the two transcribers; shot changes; picture and sound quality; contact sheet and scopes; `log.md`; health check lines; `.gitignore` | All three clips logged; the transcript's word times are within 50 ms of the sound when spot-checked; an HDR phone clip looks right in the working copy<br>**Built 12 Nov 2026, tested on four synthetic clips with known contents; not yet on real footage.** `tools/footage/footage.mjs ingest` (how to use it: `tools/footage/README.md`). Whisper large-v3-turbo with exact word timing was chosen over Parakeet (Parakeet's word ends ran up to 1.4 s late in 80 ms steps); neither was within 50 ms alone, so word edges next to a pause are snapped to the sound: phrase edges now land within 30 ms on clean and phone sound, and within 100 ms at the end of a word buried in heavy noise. HDR (HLG and PQ) is converted with reference white at 203 nits and a soft highlight roll-off, chosen on exact HLG grey patches (18% grey lands at 42%, reference white at 88%); the usual recipe left white at 75%. 31 checks against the clips' known contents pass (`tests/check_truth.mjs`), and 8 fast tests (`node --test tools/footage/tests/*.test.mjs`). Not yet tested: real camera footage, Log footage with a LUT, PQ footage, sound-only files, clips over 20 minutes, a real echoey room (tested with a synthetic one), real wind. The thresholds for the findings were set on the synthetic clips. |
| **2. Paper edit and rough cut** | Transcript page; hook, retake, filler and dead-air proposals; cut rules and meaning guard; `cutlist.json`; `FootageCut` with plain cuts, crossfades, room sound and captions | A 60-second rough cut from the talking-head clip, chosen in the transcript page, plays with no clicks and no flagged join left unanswered<br>**Built 17 Nov 2026, tested on the synthetic talking clip; not yet on real footage.** `footage.mjs paper` writes the first paper edit with the proposals (opening-line ideas with reasons, retakes and false starts with the last complete take kept, fillers struck, possible fillers marked, long pauses listed); the transcript page (`studio/paper.html`, at /paper on the review server) edits it: click a word to cut it, shift-click to hear it, move sentences, keep a pause, approve a flagged join, play the edit at the cut list's exact cut points, and Send (`wait-for-notes.mjs --paper` wakes the waiting session). `footage.mjs cut` places every cut on the quiet dip between words (a struck word that runs straight into a kept one is cut a pad's width into the dip, never by the transcript's edge), keeps a sentence's breath from the footage's own pause and uses the clip's room tone only when the footage is short of quiet, and runs the meaning guard on every join. `footage.mjs rough` joins the dialogue sample by sample with 15 ms crossfades (the engine changes volume only once a frame), listens back (transcribes the joined sound and compares it word for word with the paper edit), and hands the engine `FootageCut` the pictures and captions; `--render` renders it. On the test clip: 19.3 s to 11.9 s with the retake and fillers gone, all 35 kept words heard and nothing struck, no clicks in the joined sound or the render, the picture within one frame of its sound in every piece (`tests/check_rough.mjs`, 9 checks), 18 fast tests. Not yet tested: real footage, more than one clip in an edit, sound-only clips, sizes other than 16:9 (the rough cut fits the footage in the frame; framing comes in phase 4), and a long edit (the page and the cut list were only tried on six sentences). |
| **3. Sound repair and dialogue** | Section 7.1 to 7.3: channels, separate microphone sync, declip, declick, pops, hum, wind, noise, echo, music separation, breaths; tone matching, clarity, levelling, loudness per speaker; cuts that match the room; speech-quality scoring | The noisy clip and the two-person clip pass the sound checks; no repair lowers the speech score; a person listens and hears clean, natural voices |
| **4. Face tracking and framing** | `faces.json`; who speaks; the footage camera; punch-ins; key-line pushes; stabilising; 9:16, 1:1 and 4:5; face and caption checks | The talking-head cut in all four sizes passes the face framing, captions and sharpness checks; the two-person clip follows the speaker in 9:16 |
| **5. Picture post-processing** | Section 6: repair (denoise, deflicker, lens, exposure), matching on skin, the look with skin protected, footage and graphics agreeing, sharpening, debanding, grain, bystander blur, scopes | Two clips from different light cut together without a visible jump; skin stays on its line after the grade; scopes before and after on the contact sheet; a person approves the look |
| **6. Music, mix, master and delivery** | Section 7.4 to 7.7: music cut to the edit, ducking and room for the voice from the word timings, background beds, the mix with separate parts, mono and clarity checks, the master, the final picture encodes with correct colour labels | The talking-head film passes every sound and picture delivery check; it sounds right on a phone speaker and on headphones (a person listens) |
| **7. Cutouts** | Fast cutouts; titles behind a person; background blur or replacement; clean cutouts only if needed | A title behind the speaker with no visible edge on the contact sheet at full size |
| **8. Finish and hand-off** | Product inserts under the voice; consent check; proof of source for footage; the editor timeline export with separate sound parts; the stage files (intake, script, storyboard, animation, delivery) updated for edit jobs | A full edit job runs from footage to delivery pack through every approval, and its timeline opens in DaVinci Resolve with every cut in place |

Phases 1 to 3 make a plain talking-head edit with clean sound possible. Phase 4 (face tracking) and phase 5 (picture) give the biggest jump in how professional it looks; phase 6 does the same for how it sounds. Phases 7 and 8 can follow the first real edit. Two cameras come after phase 8.

---

## 13. Decisions made by the owner (12 Nov 2026)

The owner accepted all seven recommendations, and asked for deeper picture post-processing and sound engineering (now sections 6 and 7):

1. **Cutouts:** fast cutouts now; clean cutouts (SAM 2) only if the first real edit needs them.
2. **Noise removal:** DeepFilterNet on the Mac by default; ElevenLabs' voice isolator only when a person asks for it on a hard clip.
3. **Enlarging 1080 footage:** up to 15%, each enlargement reported by the sharpness check.
4. **Retakes:** the last complete take proposed automatically; a person confirms in the transcript page.
5. **Two cameras:** later, after phase 8, unless a video that needs it is planned.
6. **Editor hand-off:** yes, the Final Cut, Resolve and Premiere timeline export, in phase 8.
7. **Test footage:** the owner supplies three clips (a phone talking-head clip with fluffs and retakes, a noisy clip, a two-person clip) from people who agree to their use in testing. Needed before phase 1 is marked done.

The enhancements raised three smaller questions. Each is set to its recommendation unless the owner says otherwise:

8. **Separating music from voice** (Demucs, about 1–2 GB, installed when first needed): *yes, for clips with music under speech; the music's rights are still flagged.*
9. **Made-up in-between frames for slow motion:** *no for now; real high-frame-rate footage only, and never on faces.*
10. **Delivery loudness:** *−14 LUFS for every video platform, as today; other targets (podcast, broadcast) only on request.*
