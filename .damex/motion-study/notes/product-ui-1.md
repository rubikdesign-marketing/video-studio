# Product UI, batch 1: study notes

34 records. 11 have a prompt; 23 (all from revid) have only the picture. The full record-by-record study is in `study/product-ui-1.json`.

## What was checked

- All 34 records read and classified.
- 33 of 34 videos downloaded to `videos/` and measured with `profile.py`. revid:51 (body scrub ad) returned HTTP 403, so it was not seen.
- Eight films studied in full, with contact sheets and transition windows: 5cba86 (the most liked record, which has a prompt) and the seven most liked picture-only films (revid 6, 7, 10, 12, 13, 15, 17).
- The other 25 films got one 24-frame glance sheet each, enough to classify them but not to time their transitions.
- revid:7 and revid:12 run for nearly three minutes, so they were sheeted at 0.5 fps, and one of the four sheets for each was not read.
- Audio was not listened to. Music sync comes from the profile's movement-to-sound figure and from what the prompts ask for.

## What kinds of film are in it

Product launch film (14), mobile app promo (5), ad or social cut (5), feature walkthrough (3), and one each of: UI morph, concept explainer, 3D/WebGL piece, remake experiment, collage edit, data story and developer-tool film. A few records do not belong in a product group. revid:7 is a narrated essay, revid:38 is a talking head with image cutaways, and revid:48 is UGC beauty footage.

## What separates the best from the rest

- **One idea, carried all the way through.** The top record, 5cba86 (12.6k likes, about four times the next), is a single black pill that a cursor morphs through 13 UI states in 14 seconds, with no cuts, one font and one canvas, and it loops. The next best have the same discipline. revid:6 turns "waiting" into "waste" and backs every chapter with a number. revid:19 carries one red dot from the first frame to the last.
- **The product does real work on screen.** Requests are typed, scores appear, calendars fill and counters tick (revid:13, revid:18, revid:15, 6dd14e). The weaker films hold still screenshots of the whole app, where nothing can be read (revid:27, revid:36, revid:26).
- **Little dead time.** The structured films have no cuts and are still for less than 7% of their length. The weak demos are still for 28–59% of theirs. revid:6 is the exception: it is still half the time, but every hold is a planned 1–3 s read of big type.
- **One surprise.** revid:15 has a toggle in the caption that floods the film into dark mode. 2ddf1e has a send button that becomes a wok. revid:6 ends with a receipt showing the answer arrived before the logo did.
- **The same prompt gave very different results.** c52e09 (640 likes) and 3ad902 (148) came from identical words. The plain three-step walkthrough beat the version with 3D strips, particles, heavy blur and 848x480 output.

## Prompt patterns

What seems to work, seen in every high-scoring prompt (5cba86, 221cab, 6dd14e, 2ddf1e, c2037d):

- **Tagged sections:** inputs to ask for (with defaults), direction, structure, build, gotchas, then a start step.
- **A list of banned effects:** bouncy easing, particle bursts, glows, crossfades, blur-ins, shake, neon, holds over 1 s, anything template-like. The films whose prompts had one show none of those effects.
- **A beat grid:** a BPM and a beat count, something happening on every beat, and the drop placed on a story moment.
- **Continuity written as physics:** one take, each scene made from the last object, shared-element handoffs, one camera move per scene that never reverses.
- **A cursor and a camera:** the cursor causes every change, and the camera zooms so each moment fills the frame.
- **Build discipline:** each frame is a pure function of time, springs are calculated rather than simulated, subframes are rendered for motion blur, and one still per beat is checked before the full render.
- **A review gate:** a beat map and four named stills before the full film.

What produces generic results:

- **The showreel one-liner** ("N-second dynamic motion graphics... show what an incredible motion designer you are... go all out") gives the same SaaS film every time: hook, logo, dark dashboard, count-up stats, gradient field, logo card. These scored 148–410 likes, against 2.1k–12.6k for the structured prompts.
- **Adjectives** such as "juicier" or "more professional" change little. The useful instruction in f3f0e9 is the concrete one: rebuild the screenshots as components.

## Timing numbers worth keeping

- **UI morph (5cba86):** content blurs out in about 0.12 s, the container resizes in about 0.15 s, and the new content is sharp by about 0.3 s. That is about one state per second at 120 BPM.
- **Strike to colour slam (revid:6):** the strike draws in 0.1 s and holds for 0.3 s, a 0.1 s glitch follows, then a hard cut to a full violet field.
- **Theme flood (revid:15):** the toggle flips in 0.18 s, the knob's circle covers the frame in about 0.2 s, and the next headline starts 0.15 s later.
- **Colour floods in the prompts:** 0.3–0.35 s, scaled past the farthest corner, or they read as a flash.
- **Grid collapse to a dot (revid:13):** 1.1 s in all.
- **Beat word cards (revid:17):** about 0.45 s each, with transitions of 2–3 frames.
- **Feature chapters:** about 2–2.5 s each works (revid:15). An even 4.5 s per feature with the same layout reads as a template (revid:40).
- **End holds:** 1 s is fine. Static end cards of 2–3 s are where attention drops.

## What looks cheap

- UI too small to read.
- Even pacing with identical caption layouts.
- Purple neon, glass cubes and laser grids.
- Particle bursts on the logo.
- Logo walls followed by a stat row as the ending.
- Narrated slides with subtitles.
- Low-contrast dark teasers.
- Visible third-party tool watermarks and generated footage (revid:12, 40, 46).
- A render that ignores the brief's spec: 2ddf1e came out at 30 fps although its prompt asked for 60.

## Gaps in the engine's moves

Checked against `engine-moves.tsv`. None of these is covered today:

- **Component morph:** a UI element changes size, radius and colour from state to state, with its content swapped by a blur.
- **Spring-driven live controls:** a toggle, a slider that stretches past its maximum, and a tab indicator whose two edges move on different springs.
- **Control-anchored flood:** a flood that grows from a control and swaps the theme, or contracts into the next object.
- **Glass material:** liquid or frosted glass, including frosted lettering.
- **Aperture iris with blades.**
- **Wordmark accordion:** the letters squeeze into the full stop, and the dot becomes a pill.
- **3D tunnel and curved carousel with reflections.**
- **Grid multiplication and a scan line that picks winners.**
- **Collapse to a dot:** a grid shrinks to a point that seeds the next scene.
- **Rubber-stamp labels.**
- **Film chrome:** chapter labels, running timecode and a HUD.
- **Editorial reading subtitles:** the whole sentence on screen, with words lighting up as the narration reaches them.
- **Particles that assemble into a logo.**
- **Audio-reactive parts.**
- **Icon trim-path draw.**
- **A rolling counter with no bar.**
- **An authored seamless loop:** the last frame matches the first.

One gap is in the render pipeline rather than the moves: subframe motion blur. Every top prompt asks for it.

## Rights

The prompts and videos belong to their creators. Nothing above copies a prompt. Raw files stay under `.damex/motion-study` (git-ignored).
