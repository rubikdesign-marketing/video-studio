# Stage 5–6: first animation and full animation

Two approvals: **First animation**, then **Full animation**. Every tool below prints its usage when run with no arguments.

## Read first

- `jobs/<job>/job.json`, the approved shot list and voice
- `engine/README.md` (how a scene is built from the kit)
- `knowledge/craft/02-motion.md`, then the one craft file each scene needs (type, UI, light, advanced motion)
- `knowledge/craft/07-sound.md` when you reach sound
- `knowledge/craft/08-directors-checks.md` before any hand-over
- Skills to load (see "Skills the studio uses" in `SKILL.md`): `remotion-best-practices` before writing any scene code; `motion-design`, `motion-foundations` (and `motion-advanced` for complex moves) while animating; `bang-motion`'s techniques (rebuilt with Remotion's own timing) and `knowledge/craft/14-motion-systems.md` while animating; `hyperframes` for a move Remotion handles poorly; `fixing-motion-performance` when the smoothness check flags a scene; `hallmark` and `impeccable` critique on the contact sheet before a cut goes to a person

## 1. Turn the shot list into a film skeleton

1. Write `jobs/<job>/shots.json` from the approved shot list (format and example in `templates/shots.json`). Each scene names the voice lines it covers; scene times come from the voice, never the other way round.
2. `node tools/film/captions.mjs jobs/<job>` writes the captions from the word timings.
3. `node tools/film/scaffold.mjs jobs/<job>` creates `engine/src/jobs/<name>/`: the film's timing file, one file per scene, and the film itself. Each scene file starts with its brief (times, voice lines, on-screen text, move, transition, hand-off, sound, energy) and renders as a plain placeholder.

Running the scaffold again after a timing change updates the timings and never touches a scene file that already exists.

## 2. First animation

`bash tools/film/render.sh jobs/<job> preview` renders the whole film at half size. With placeholders in place this is already the animatic: real voice, real timings, on-screen text at its cues.

Then build what the playbook asks for at this approval (for a promo: three alternative openings and one scene at full polish). The openings are the three hooks recorded at the script stage (`job.json`, `hooks`), each built to `knowledge/craft/15-hooks.md` sections 1, 2 and 5. Run `node tools/checks/hook_legible.mjs <render> --expect "<the hook's on-screen line>"` on each opening and again on the final film in every size that ships: the written line must be readable with the sound off by 3 s. A failure names the moment; look at that frame before changing anything. If the job uses a clip from viralhooks.org, `node tools/hooks/clips.mjs check jobs/<job>` must pass (`15-hooks.md` section 8). Hand over with the note from `08-directors-checks.md`. Stop for approval.

## 3. Build the scenes

- One scene per helper agent, one after another. Give the agent only the scene file, `engine/README.md`, and the craft files that scene needs.
- Colours, fonts and timings come only from the kit. Cues come from the `scene` prop, never typed-in numbers.
- Product screens that must move are built from `engine/src/products/tulvo/` (inside `<AppStage>`) and compared with the real capture.
- Build to `knowledge/craft/14-motion-systems.md`: the camera goes to what is speaking and text appears after it arrives; entrances 0.7–1.3 s, exits 0.35–0.55 s; no more than three things moving at once; durations on the music's grid when music leads.
- `bash tools/film/render.sh jobs/<job> scene S03` renders one scene alone. Look at it with `tools/study/sheets.sh` before moving on.

## 4. Sound

1. Write `jobs/<job>/audio/sfx.json`: each effect with an id, a prompt, a length, the film time it lands on and a gain between 0.35 and 0.7. One on every scene change, starting 0.15–0.2 s early. A sound lands by its attack or its arrival, not by where its file starts: a riser arrives on the cut, a click's attack is on the press (`real-sfx`, `references/typed-cues.md` and `event-map.md`). Real recorded sounds come through `tools/media/openverse.mjs`, with their licence and credit kept.
2. Write `jobs/<job>/audio/music-brief.json`: style, what to avoid, and one section per scene group with its film times and energy from the energy map.
3. `node tools/audio/sound.mjs plan jobs/<job>`, read the plan, then `sound.mjs music` and `sound.mjs sfx`. These two spend ElevenLabs credits; effects that already exist are not made again.
4. `python3 -I tools/audio/mix.py jobs/<job>` mixes voice, music and effects and measures the result: music at 20–30% of the voice, effects between a third and two thirds. If it reports a miss, fix the cue it names.
5. Listen to the mix: `node tools/audio/listen.mjs jobs/<job>/audio/mix.wav --job jobs/<job>`. Read its report and look at `sheet.png`. Fix any cue that lands more than a frame off its picture moment, any effect buried under the music, and any loudness or tone note, before the master.

## 5. Master and check

1. `bash tools/film/render.sh jobs/<job> master` renders at full quality with the mix, masters the sound to −14 LUFS, and writes `out/<name>.mp4` and a 720p preview. Add `--no-captions` for the version without captions.
2. Run every check on the master:
   - `python3 -I tools/checks/smoothness.py <file> --planned-cuts <times from shots.json>`
   - `python3 -I tools/checks/frame_quality.py <file>`
   - `python3 -I tools/checks/onscreen_text.py <file> --must "<offer wording>" --never "<retired wording>"`
   - `python3 -I tools/study/profile.py <file> jobs/<job>/out` and compare with the energy map and the targets in `knowledge/craft/00-principles.md`
   - `node tools/audio/listen.mjs <file> --job jobs/<job> --critique`: the sound against seven professional launch films, with fixes and times. Name each fix it suggests and whether it was made
   - The anti-slide and restraint checks on the contact sheet (`knowledge/craft/14-motion-systems.md` sections 3 and 7)
3. Look at every flagged moment frame by frame with `tools/study/sheets.sh window`. Fix it, or say why it stands.
4. Do the ten-percent pass.

Hand over with the four-part note. Say plainly that nobody has watched it at speed or listened to it. Stop for approval.

## Review notes

After handing over a cut:

1. Start the review page: the preview server named `tulvo-review` (it runs `studio/server.mjs`). Tell the maker it is open at the job's video. They pause, write a note pinned to that moment, say whether it is a change or something to keep, pick a topic, point at an area if they want, mark whole scenes as good, collect a few, and press Send. They can also approve the version from the page.
2. Run `node studio/wait-for-notes.mjs jobs/<job>` in the background. When the maker presses Send it prints the notes and exits, which wakes you. Each note has its time, its scene, who wrote it, its kind (change or keep), its topic, whether it is a must-fix, the text, the marked area and a saved frame.
3. Read the batch in this order:
   - **Approved:** if the reviewer approved the version, record the approval in `job.json` and move to the next stage.
   - **Must fix** notes first, then the other change notes. Look at each note's frame and the marked area.
   - **Keep** notes are praise. Do not change what they point at. Record what worked in the ledger entry for this video, and treat it as a candidate for the motion library.
   - **Good scenes** are left exactly as they are.
   Change only the scene files the change notes touch. Then update the preview:
   - **One scene changed:** run `bash tools/film/render.sh jobs/<job> scene S02 --splice` (with the scene's id). It renders only that scene and swaps it into `out/preview.mp4` in its place. Every other frame and the whole sound track stay exactly as they were, so the reviewer sees the fix without waiting for the whole film.
   - **Several scenes changed, or the voice or the shot list changed:** render the whole preview again with `bash tools/film/render.sh jobs/<job> preview`. The splice also stops and asks for this when the scene times have moved since the preview was made, when there is no preview yet, or when another render is running.
   Then re-run the checks.
4. Mark the batch done with a one-line reply per note: `node studio/wait-for-notes.mjs jobs/<job> --done <batch> '[{"id":"b001-n1","reply":"what changed"}]'`. The page shows the replies and offers the new version.
5. Start waiting again for the next round.

Every note is saved in `jobs/<job>/review/` and added to `knowledge/feedback-log/<job>.jsonl` at the moment it is sent. If the page cannot be used, take notes in chat with a time and log them the same way.

## Rendering

The render browser cannot start inside Claude's command sandbox. A render command has to be allowed to run outside it. Only one render runs at a time: every render tool holds the lock `engine/out/.render.lock` while it works and removes it when done.

## Not built yet

- A scene with no voice line (a silent end card) is not supported by the scaffold.
