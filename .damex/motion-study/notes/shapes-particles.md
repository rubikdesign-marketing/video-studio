# Shapes and particles: batch notes

Eleven records, all Prompt kind, all made with Opus 5.5. Full data: `study/shapes-particles.json`.

## What was checked

- All 11 records read. All 11 videos downloaded and measured with `profile.py`.
- Six watched in full on 2 fps contact sheets: tdinh-me (319 likes), chrisjdimarco (6), kamstudiolabs (2), kantamk (1), then hbcoop and monokern (no likes, chosen for craft). Every record here has a prompt, so the "prefer no-prompt records" rule could not apply.
- Frame-by-frame window sheets for three transitions: the tdinh-me logo-to-icon move, the monokern zoom through the pupil, and the hbcoop sphere turning into a flock.
- The other five (two ajith-io films, raphaelaubryy, manuelogomigo, deebeeeff) were measured and skimmed at 1 fps, enough to classify them but not a full study.
- Not checked: I did not listen to the audio. Sound claims come from the loudness track and the prompts. Some "hard cuts" counted by the profiler are white flashes inside one shot; these are flagged in the JSON.

## What kind of films these are

- Particles, generative or physics: 3 (a samurai made of fire effects, a music machine played by bouncing balls, a ball escaping twelve rings).
- Showreel or capability reel: 4 (two product showreels for one brand, a psychedelic shader reel, a Swiss-style résumé reel).
- One each: logo reveal, abstract geometric figure sequence, product launch film, anniversary social post.

## What separates the best from the weakest

- **One object, one idea, given time.** The most-liked film builds a single logo from coloured triangles over 12 seconds, flashes it into its app icon and types the name. The best-crafted film (hbcoop) turns one dot into a line, circle, sphere, lens, ball, flock and globe in a single unbroken shot.
- **An ending that closes the idea.** In hbcoop the dot becomes the full stop of the closing sentence. In monokern the eye returns before the title. The weaker films end on a stock logo card.
- **A rule the viewer can see.** The physics films work because of a stated rule ("every bounce plays the next note") and a counter on screen (rings left, notes struck).
- **Weakest:** a template anniversary post (sunburst, confetti, rotated logo card, script font) and a technique checklist cut on an exact 2-second grid that ignores the music.

## Prompt patterns

- Good: name one subject and the change it goes through ("assemble and reveal this logo, slowly"). The model supplies the visual idea.
- Good: give a checkable rule (every note from a visible collision), two mood words, a music reference to compose from, or a reference video for style.
- Weak: the shared showreel template (show what a motion designer you are, go all out) appears five times. Without a subject it gives a checklist; with a product name it gives a feature list.
- Weak: a logo image plus the occasion and nothing else gives a template look. Hype adjectives buy effects, not drawing quality.
- No prompt here gives aspect ratio, palette, beat list or timings.

## Useful numbers

- Logo reveal: 12 s build, a 0.1 s bloom and 0.35 s tile growth, a 0.15 s make-room slide, the wordmark typed at about 8 characters per second, then a 3.5 s hold.
- Pupil zoom: about 0.45 s of accelerating push, a 2-frame white flash, then 0.15 s of radial blur settling.
- Figure sequence: 29 s with no cuts, nine figures at 2.5 to 4.8 s each, captions deleted at about 60 and retyped at about 15 characters per second.
- Ring escape: about 2.2 s per ring in a 9:16 frame.
- Checklist reel: hard cuts at exactly 4, 6, 8, 12 and 14 s.

## What looks cheap or made by AI

Stock celebration effects, technique checklists, raw browser recordings with on-screen control hints and no sound, tiny elements in an empty wide frame, effects hiding weak drawing, nine worlds in 20 s with no rest, and sign-offs about being "made in code". The engine should never add that last one to a client film.

## Gaps in the engine's moves

The move list has no particle family at all. Missing moves:

- particles that gather into a logo
- an object that breaks into particles
- flocking
- building a mark from facets
- shape morphs and changes of dimension
- tilting a flat drawing into 3D
- physics moves: bounces with trails, collisions, launches
- sound triggered by on-screen hits
- a zoom through a detail into a new world
- pattern worlds: tunnels, kaleidoscopes, chrome blobs
- halftone and dot-matrix motifs
- a figure caption that retypes as the object changes
- a progress counter used to tell the story
- bookend endings
- light trails and impact rings
