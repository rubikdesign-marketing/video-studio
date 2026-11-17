# Stage 4: storyboard

Ends with the **Storyboard** approval. The storyboard is made of the film's own frames: each shot's key frame is built in the engine, rendered, and laid out on a design canvas with its notes. What is approved is what the film will show.

## Read first

- `jobs/<job>/job.json`, the locked script and word timings, the approved look
- `knowledge/craft/01-direction.md` (shot grammar, eye trace, hand-off objects)
- `knowledge/craft/03-transitions.md`
- `knowledge/craft/14-motion-systems.md` (shot sizes, choreography, restraint, the music grid, the anti-slide checks)
- `knowledge/craft/05-ui-choreography.md` and `jobs/<job>/flow.md`
- `knowledge/craft/12-frame-quality.md` (every key frame is checked against it)
- `library/motion/index.json` (the animations that already work, with when to use each) and `knowledge/craft/09-advanced-motion.md` (choose at most three advanced techniques and say what each means)
- `library/backgrounds/index.json` (the backgrounds that already work)
- `knowledge/craft/11-data-visualisation.md` if any chart or number is on screen
- `knowledge/craft/00-principles.md`
- Product shots: `tools/capture/README.md` and `CAPTURE-PLAN.md` section 7.9 (looks, pointers, camera, staging, animations, transitions); capture scripts are written now and approved with the storyboard
- Skills to load (see "Skills the studio uses" in `SKILL.md`): `motion-design` for each shot's motion notes; `bang-motion` (`references/techniques.md`) for shot sizes, the camera going to what is speaking, and its transition menu; `impeccable` for the key frames' type, colour and layout; `hallmark` and `impeccable` critique before the storyboard goes to a person

## 1. Shot list

Fill `templates/shot-list.md` into `jobs/<job>/shot-list.md`, then write it as `jobs/<job>/shots.json` (format in `templates/shots.json`). Lengths come from the voice timings. Run every check at the bottom of the template before building anything.

## 2. Film skeleton

`node tools/film/captions.mjs jobs/<job>` then `node tools/film/scaffold.mjs jobs/<job>`. Each scene now has its own file with its brief at the top.

## 3. Key frames, built in the engine

For each shot, build how it looks **at rest**, in its scene file: the background from the library, the real capture, the type, the focal point. No movement yet; movement is added at the animation stage to these same files, so nothing is redrawn later.

- One scene per helper agent, one after another. Give the agent the scene file, `engine/README.md` and the craft files that scene needs.
- Colours, fonts and logo only from the brand. Real product captures only.
- Check each key frame against `knowledge/craft/12-frame-quality.md`.

## 4. Render the frames

`node tools/film/storyboard.mjs jobs/<job>` renders one still per shot into `jobs/<job>/storyboard/` and writes `frames.json` with the notes for each. It has to be allowed to run outside the command sandbox.

## 5. Lay them out on a design canvas

1. Start a new design canvas with the Artifact tool (the Design type), titled "<video name> storyboard". Follow that type's own instructions for how its files are written.
2. Upload the rendered frames to the canvas.
3. One artboard per shot, in a row, in the brand's light page colours and typeface. Each shows the frame, then: shot number and scene, when it starts and how long it lasts, what is being said, what is on screen, the shot size and move, the sound, how we arrive (the transition and hand-off object), and the energy from 1 to 5.
4. A title above the row with the film's name, length and number of shots, and one note saying the frames come from the engine and how to comment.
5. For a shot with a large move, add a second artboard with the frame it ends on.

Sentence case, no dots as separators, no coding-style typeface, and wording a person would use.

## 6. Things to list for the approver

- Planned holds and the length of each.
- Every planned instant change (hard cut or one-frame swap), so the smoothness check knows them.
- Any third-party logo, for confirmation.
- The beats that would make the 30 s, 15 s and 6 s versions (promos).
- The new move this video adds to the library.
- The film's motion on paper (`14-motion-systems.md`): each shot's size, choreography and transition; how many scene changes are plain fades (two at most); the kinds of transition used (at least two, one with depth); the most things moving at once in any scene (three at most); and, when music leads, its beats per minute and which beats the big moments land on.

## Hand-over

Give the canvas link and the shot list. The canvas is private until the maker shares it from its Share menu; say so. Comments left on the canvas are feedback: read them, log them in `knowledge/feedback-log/`, change the key frame in the engine, render that frame again and replace it on the canvas. Stop for approval.

After approval the shot list is the contract for animation.

## If a brand's designers want to edit by hand

Use Figma instead of the design canvas for that brand: place the same rendered frames in a new Figma file, one frame per shot with the same notes, and read Figma comments as feedback. Note the choice in the brand's `rules.md`. Hand edits made in Figma have to be carried back into the scene files, so the engine stays the source.
