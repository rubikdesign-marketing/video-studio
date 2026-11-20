# 05 Phase 3: motion and audio pack for the UGC slice

Date: 2026-11-19. Worktree `video-studio-05`, branch `creative-library-05`. Nothing committed. Nobody has listened to the new sounds or watched the new film in real time: everything below was measured, or looked at as stills.

## Assets added

Python for every check below is the main checkout's footage venv, called by absolute path (this worktree has none); no package was installed.

| id | path | bytes | sha256 |
|---|---|---|---|
| foley/phone-buzz-table-01 | library/sounds/foley/phone-buzz-table-01.mp3 | 10,964 | 14239b9e7c887a186154ab608edabb510e0f146aa33efa4973833fadbbd5430d |
| foley/phone-buzz-table-02 | library/sounds/foley/phone-buzz-table-02.mp3 | 14,108 | 75c0aeb896eccdd176d21b0a168cae57dffeeb72b440a475dbe7565d52cd2831 |
| click/finger-tap-glass-01 | library/sounds/click/finger-tap-glass-01.mp3 | 1,844 | a96dc55aae5dbb5174f9d340c38f3876255b0e3174397c9cd580354058cc6f5e |
| click/finger-tap-glass-02 | library/sounds/click/finger-tap-glass-02.mp3 | 1,796 | dd32b69f6e18321440562e0869231bdfffb299a4a6848c83d0677ad4a657728c |
| click/finger-tap-glass-03 (double tap) | library/sounds/click/finger-tap-glass-03.mp3 | 2,972 | 27fe30df4982cd7f4cf65064013ff7f43b182b8cbb2c3469d8773b03ebae29b3 |
| swish/glass-swipe-01 | library/sounds/swish/glass-swipe-01.mp3 | 4,796 | ad16cc861c1fd096db27fa4cbcf653be2ce4f731338e1e2bb3f7ce68f8e8d99b |
| swish/glass-swipe-02 | library/sounds/swish/glass-swipe-02.mp3 | 5,372 | 9453be422fae60c560880cf09d20fdd572cbb6a6a45e1256244b0e16b99dd44d |
| swish/glass-swipe-03 | library/sounds/swish/glass-swipe-03.mp3 | 7,052 | 111dcc6c3ef54ab58ac046ecc0cacc13153571a75c211c8f1520e5dddd8533b3 |
| ambience/room-clean-01 (16 s, loop, stereo) | library/sounds/ambience/room-clean-01.mp3 | 455,276 | 55c6d1c94b56d8d7b87e01c88f401ea452ca1dd99e4d0b3ff79e8fdc4bfb1321 |
| move `ugc-comment-reply` preview | library/motion/ugc-comment-reply.mp4 | 79,232 | 1a1d339b4707cad9ddfde0e8b4569bdab057c87a20c1c1672923800643c79be0 |
| move `ugc-screen-rec-tell` preview | library/motion/ugc-screen-rec-tell.mp4 | 24,196 | 371b7ed46d91fbc6043fd228f3b3c0a5daed9850ba3150d28648680d6110a7b2 |
| move `ugc-sticker-pop` preview | library/motion/ugc-sticker-pop.mp4 | 24,676 | fe214ce94b735317bec7e4e695c779a6b4bb8128b2e04b666428dca2f6af68b6 |

Total new media: **632,284 bytes** (504,180 sounds, 128,104 motion previews). Sound index entries (`source: studio`, `licence: CC0-1.0`, full recipe, sha256) are in `click`, `foley`, `swish` and `ambience` `index.json`; motion entries (attribution `original, written in-house`, props, sizes, timing, expected render cost, device fallback, preview sha256) are in `library/motion/index.json`. Credits: `library/sounds/CREDITS.md`.

Budget: `library/sounds/` is now 14,961,238 bytes (260 sounds by the manifests; was 14.46 MB, 251 sounds) against the 30 MB ceiling in LIBRARY-PLAN, "Files in the repository". `sounds.mjs check` passes. The plan sets no separate ceiling for motion previews. Note: the brief says 274 existing sounds; the manifests held 251 before this work (the 274 figure may count something else), 260 now.

Code is plain text and small: `engine/src/kit/ugc/` (4 files), `engine/src/library/motion/ugc/` (2), `entry.tsx`.

## Synthesiser changes (`tools/audio/synth.py`)

- New kind `buzz`: motor tone (172 Hz with harmonics, spins up and down in each pulse), case rattle (bursts of band noise chopped at the motor's rate), table resonances (118 Hz, a fifth above, a wood body near 340 Hz) rung by a knock at the start of each pulse. 2 or 3 pulses, 0.54 s and 0.72 s after trimming.
- New kind `tap`: style `tap` (low body, skin click, glass ring, optional nail, 1 to 3 taps) and style `swipe` (band noise that climbs, with stick-and-slip and a faint squeal).
- New ambience style `clean`: broad soft air only, no sine anywhere, high-passed at 90 Hz with no resonance.
- All seeded; the same recipe in the index remakes each file (checked on 4 of the 9 with `synth.py recipe`: the remade MP3 has the same checksum as the file).

### Hum check on the room bed
Method: Welch spectrum, 1 Hz bins; the worst 3-bin peak between 30 and 200 Hz minus the median of the bins 5 to 25 Hz either side. Limit 6 dB.

| bed | worst peak over its neighbours | where |
|---|---|---|
| ambience/room-clean-01 (the shipped MP3) | 3.5 dB | 31 Hz |
| clean style, seeds 1 / 11 / 51 (test) | all under 6 dB | |
| ambience/room-apartment-window-01 (existing) | **22.9 dB** | 51 Hz |
| ambience/room-house-01 (existing) | **19.4 dB** | 99 Hz |

So both existing room beds fail the same test; README now says so and points to the clean bed. `kit.json` `room-tone` now falls back to `room-clean-01`.

## Dedupe decisions (existing sounds, including 45 Kenney CC0 files)
- Phone buzz: nothing in the library is a buzz (searched ids, names, feel and `use_for` for buzz, vibrate, phone, table). New file.
- Finger tap on glass: `click/mouse-tap-*`, `plastic-click-01`, `micro-tick-*` (Kenney) and `click/glass-press-01` (uisfx) are electronic UI clicks, not a fingertip; `glass-press-01` is the nearest and stays the choice for a UI tap. New taps for the physical touch. Kit slot `finger-tap` added.
- Swipe: `swish/quick-hand-*` and `cloth-*` are air and cloth, with no skin on glass. New swipes. Kit slot `finger-swipe`.
- Kit slots added (30 to 33): `phone-buzz`, `finger-tap`, `finger-swipe`. No existing role was changed except `room-tone`.
- Office or co-working ambience with distant voices and keys: **open gap**. It cannot be synthesised convincingly. Nothing was downloaded or used.

### Kenney and plinkfx (read-only, nothing downloaded)
- Kenney Interface Sounds (https://kenney.nl/assets/interface-sounds, CC0, already in the library through the 45 Kenney files): its `click_*`, `tick_*`, `toggle_*` and `select_*` files are UI sounds, none a phone buzz or a finger on glass, so no file is named. The licence page was not re-read this session; the licence quote in CREDITS.md is from 18 Nov.
- plinkfx (https://github.com/maximilianfeix/plinkfx, `LICENSE-SOUNDS`, CC0): recipes in TypeScript, no audio files; building them needs its code. Nothing adopted. **No download needs the owner's OK.**

## Motion

All in `engine/src/kit/ugc/`, plain 2D (HTML and SVG), no WebGL, no image, no emoji font, no `Math.random` or `Date` (a test greps for them), times in seconds on the scene clock, seeded random for the sticker's specks only. Colours come from the brand's stage (`fill`, `ink`, `accent`, `dot`, `colour`, `outline` can override). All three work in 9:16, 1:1, 4:5 and 16:9 (they lay out from the frame's width, height and short side).

- `CommentReply`: question card (avatar from the handle's initial, handle, heart count, "Replying to" line), arrival with the preset's settle spring, optional like tap, optional dock to the top, exit. Props: comment, handle, label, likes, at, preroll, out, dockAt, dockY, likeAt, x, y, size, fill, ink, accent.
- `ScreenRecTell` (with `RecBadge`, `TapRipple`, `phoneBox`): REC dot that breathes plus an m:ss timer, tap ripples at given times and places, and an original anonymous phone (no logo, no real device shape). Props: frame, taps, at, out, label, timer, timerFrom, x, y, dot, tapColour, body, size.
- `StickerPop`: heart, star, tick, sparkle or starburst from paths, white outline, shadow, bounce, wobble, specks. Props: shape, at, out, x, y, size, rotate, colour, outline, mark, specks, seed. Not used in ugc-01 (the ring already marks that beat).

Gallery: `move-ugc-*` in the "ugc" folder of the sized gallery (`engine/src/library/motion/ugc/`, registered in `sized-families.ts`). I added `engine/src/library/motion/entry.tsx` because `src/index.ts` does not bundle in this checkout (it loads `src/jobs/sample`, whose `public/jobs/sample/captions.json` is not here); previews were rendered through it. Previews: 960x540, 60 fps, 4.2 s, half size like the others.

Checks: `smoothness.py` 0 unplanned jumps and 0 judder windows on all three; `flashes.py` passes on all three. Stills of 9:16 and 16:9 were looked at for each (the first look found the reply label unreadable over the film's light window in the real film, so the label moved inside the card; the preview and the film were re-rendered). 1:1 and 4:5 were not looked at. `npx tsc --noEmit` reports only the errors that were already there in `rubik-ep1` and `sample`.

Catalogue: `library/motion/index.json` has 3 new entries (family `ugc`, added_on 2026-11-19) and a new family description.

### `look-*` file fix
The 8 `look-*` entries (calm-explainer, product-demo, launch, tutorial, social-vertical, feature-montage, documentary, two-people) named `engine/src/kit/CaptureClip.tsx` for the component `CaptureShot`. The export is `engine/src/kit/capture/staging.tsx` (line 307). All 8 now name `staging.tsx`. A new test checks that each named file exists and contains `export const CaptureShot`.

## Source evaluations (none adopted; no shot needed any)

**FFmpeg filters**
1. Licence: the installed build (`ffmpeg-full` 9.0.2) is GPL 3; used as a tool only, no code or output of it is redistributed as code.
2. Would add: more audio chain (compressor, limiter, EQ) and video filters beyond what Remotion does.
3. Already used here: `acompressor` and `alimiter` on the effects stem, and `ebur128` for measuring.
4. Need in this shot: only those; no video filter was needed.
5. Adopt more only for a shot that needs it; nothing else pending.

**Paper Shaders (`@paper-design/shaders-react` 0.0.82)**
1. Licence: Apache 2.0 (read from the installed package's `package.json` and `LICENSE`).
2. Would add: brand-coloured shader backgrounds; already installed and used by the 8 shader backgrounds.
3. Needs WebGL (`--gl=angle`), so it breaks the "CSS/2D fallback" rule for this pack.
4. Need in ugc-01: none (the film uses a dark stage and stills).
5. Not used in the new moves.

**GL Transitions**
1. Licence: MIT for the repository (LIBRARY-PLAN line 51; each transition file has its own header; not re-read this session).
2. Would add: transition ideas only (the 29 transitions already credit theirs; no code was copied).
3. It is GLSL, so it needs WebGL.
4. Need in ugc-01: none (hard cut, motion-matched cut, light sweep already cover its three joins).
5. Not adopted.

**HyperFrames Catalog**
1. Licence: not read this session. Its skill is installed locally (`hyperframes-registry`) but I did not open the catalogue's own licence.
2. Would add: ready-made HyperFrames blocks for a HyperFrames project; this film is Remotion.
3. Cannot be used in a Remotion film without a port.
4. Need in ugc-01: none.
5. Not adopted; check its licence before any future use.

**Three.js**
1. Licence: MIT (from memory; not re-read, and it is not installed in `engine/node_modules`).
2. Would add: 3D scenes and WebGL.
3. Needs WebGL, which this pack avoids on purpose.
4. Need in ugc-01: none; the phone is a flat 2D drawing.
5. Not adopted, no dependency added.

## Re-export of `ugc-01` (the job's own `render.sh export`)

Changes in the job: hook = `CommentReply` card ("Wait, how do you keep every lead in one place?", @maya.runs, a heart tap at 0.9 s, gone at 2.2 s) at the lower middle of the window (first placed at the top, which hid the product; moved). `phone-buzz-table-01` at 0.0 s (replaces the notification chime), `finger-tap-glass-02` at 0.9 s on the heart, `finger-tap-glass-01` at 5.0 s on the sidebar click (replaces `mouse-tap-01`), `RecBadge` (REC and timer) from 2.6 s through the proof, and a `TapRipple` at the click in place of the old ring. The room bed is `ambience/room-clean-01`. `events.json` keys `notificationIn` and `notificationOut` became `commentIn`, `commentLike`, `commentOut`; the old Banner was removed from `ugc.tsx`. The previous export is kept as `jobs/2026-11-19-ugc-01/out/2026-11-19-ugc-01-phase2.mp4` (identical to `export-baseline.mp4`).

### Headroom, fixed in the mix (not in `master.sh`)
First attempt with the old mix settings (`--gain-music 10`): the clean bed is louder than the old one, so it sat at -18 LUFS, above the effects' peaks. Wrong. With the bed at a sensible level the effects (short, sparse, about 20 dB above the film's average) were flattened by master.sh's limiter and the result came out at -0.8 to -1.0 dBTP. `build.mjs` now remixes after `mix.py` (no gain flags): effects stem through `acompressor` (-26 dB, 4:1, +9 dB make-up) and `alimiter` (limit 0.4), the bed 10 dB under the stem, summed back to `audio/mix.wav` (48 kHz stereo, 16.0 s). Master.sh then applies a straight gain.

| | phase 2 (previous) | phase 3 (new) |
|---|---|---|
| file | `2026-11-19-ugc-01-phase2.mp4` | `2026-11-19-ugc-01.mp4` |
| video | h264 1080x1920, 30 fps, 16.000 s | same |
| audio | aac 48 kHz stereo | same |
| bytes | 3,732,477 | 3,880,510 |
| master.sh "after" (loudnorm) | -14.00 LUFS, -1.02 dBTP | **-14.07 LUFS, -1.75 dBTP** |
| ebur128 (independent) | -13.8 LUFS, LRA 1.4, peak -1.0 | **-14.3 LUFS, LRA 7.1, peak -1.8** |

Targets: true peak at most -1.1 dBTP (met, -1.75 / -1.8) and -14 +/- 1 LUFS (met, -14.07 / -14.3). The bed sits at about -31 LUFS once mastered; the effects carry the film. The higher loudness range (7.1 LU against 1.4) is the effects now sitting above a quiet bed instead of a loud one. A person must listen to it.

### Repeat render
`render.sh export` was run twice with no change in between. The video stream framemd5 of `raw.mp4` is identical over all 480 frames, the video framemd5 of the mastered mp4 is identical (480 frames), the decoded audio md5 is identical, and the whole mastered file has the same sha256 both times (`560d883b4df1f322...`). Chrome would not start in the sandbox ("Failed to launch the browser"); only the render commands were retried with the sandbox disabled.

Stills checked (frames at 0.15, 0.9, 1.7, 5.15 and 10.8 s): the card is in, the heart fills after 0.9 s, the REC badge and tap ripple show on the demo, the REC timer carries through the cut (0:08 at 10.8 s; an earlier render had the timer wrong, fixed).

## Tests
- `cd tools/audio/tests && python3 -I -m unittest discover -s . -p 'test_*.py'` (footage venv Python): 52 tests, all pass (added to `test_synth.py`: a case for each new kind, determinism per seed for `buzz` and both `tap` styles, a buzz has two pulses and a table and rattle spectrum, a tap and a swipe have the right shape, the clean room has no hum for three seeds and the old room style fails the same check, the shipped `room-clean-01.mp3` has no hum, `clean` loops without a seam).
- `node --test tools/audio/tests/*.test.mjs tools/checks/tests/*.test.mjs`: 47 pass, 0 fail (includes 2 new in `motion_library.test.mjs`: the `look-*` files export `CaptureShot`; the three ugc moves have a gallery scene, matching preview checksum, props, sizes, timing, cost, 2D fallback and no random or clock).
- `node --test tools/footage/tests/*.test.mjs`: 41 pass, 0 fail.
- `sounds.mjs check`: 260 sounds, every file matches its manifest.
- `npx tsc --noEmit`: only the existing `rubik-ep1` and `sample` errors.

## Changed paths
Modified: `tools/audio/synth.py`, `tools/audio/tests/test_synth.py`, `library/sounds/{CREDITS.md,README.md,kit.json}`, `library/sounds/{ambience,click,foley,swish}/index.json`, `library/motion/{README.md,index.json}`, `engine/src/library/motion/sized-families.ts`, `tools/checks/tests/motion_library.test.mjs`.
New: nine sound files (above), three motion previews, `engine/src/kit/ugc/{CommentReply,ScreenRecTell,StickerPop}.tsx` and `index.ts`, `engine/src/library/motion/ugc/{batch1.tsx,index.ts}`, `engine/src/library/motion/entry.tsx`.
Job (untracked, as before): `jobs/2026-11-19-ugc-01/{build.mjs,events.json}`, `engine/src/jobs/ugc-01/{ugc.tsx,scenes/S01.tsx,S02.tsx,S03.tsx}`; outputs in `jobs/2026-11-19-ugc-01/out/` (never synced), including `2026-11-19-ugc-01-phase2.mp4`.
Not touched: `tools/audio/master.sh`, `tools/audio/mix.py` (its earlier uncommitted changes belong to another prompt).

## Open gaps
- Office or co-working ambience with voices and keys (needs a cleared recording).
- Cafe or kitchen bed (gap 7), laptop lid and mouse wheel (gap 8), mug sip and packaging rustle (gap 10), handheld micro-drift (gap 9): not in this pack's scope.
- Nobody has listened to the new sounds or the film; the buzz, taps and swipes were only measured (shape, level, spectrum). Listen with `sounds.mjs sheet --group foley` and the other three.
- 1:1 and 4:5 stills of the three moves were not looked at; other brands and the light page were not tried; the calm and hype presets were not tried.
- The first `CommentReply` line is an invented comment and handle (`@maya.runs`); no real person's comment is quoted. The Kestrel Studio stills' public-use clearance is still `null`, so the film stays an internal draft.
- The existing room beds `room-apartment-window-01` and `room-house-01` still have a hum; they were left in place with a README note.
