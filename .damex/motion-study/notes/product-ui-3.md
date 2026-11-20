# Batch product-ui-3: study notes

34 records, group product-ui. The full data is in `study/product-ui-3.json`.

## What was and was not checked

- All 34 records were read. Four of them had `$2c` in the prompt field, which is a reference the scraper did not resolve. Their full prompts were recovered from the page text in `raw/prompt-motion-entries.json` (notdwd, rossaxbt, jake11moran, demonugc).
- Likes and views are empty for every record, so nothing could be ranked by popularity. For the visual study I picked those four records, because their prompts were missing from the batch, plus the two Max-effort records (polydao and jesscaroline7).
- I watched six videos as contact sheets at 2 fps and measured them with profile.py. I also made two window sheets, one for the notdwd whip-tilt and one for the polydao band wipe.
- The other 28 records were judged only from their poster frame (I put all 34 posters on one grid) and their prompt. Their look notes may be wrong.
- I did not listen to any audio. I did not read sheet 04 of jesscaroline7, which covers 36 to 48 s.

## Mix of categories

- Product launch film: 8
- Concept explainer: 5
- Showreel: 4
- Feature demo: 4
- Mobile app promo: 4
- Developer-tool film: 2
- Ad cut: 2
- One each: UI morph, illustrated story, logo sting, 3D piece, experiment

Fourteen of the 34 prompts are the same one-line showreel template ("show what an incredible motion designer you are ... go all out").

## The six watched films

| Record | Length and shape | Cuts | Average shot | Still | Notes |
|---|---|---|---|---|---|
| notdwd (Frame by Frame) | 12.1 s, square | 5 | 2.0 s | 12% | Glass-and-blue keynote sting. Every shot enters already moving. The cuts land within one frame of the times its prompt set. |
| rossaxbt (Ora 2) | 22.1 s, square | 11 | 1.8 s | 28% | White canvas, liquid-glass controls and real photos. Captions type to the voiceover. Nine cuts fall in 2.4 s on the drop. The end hold is 3.5 s. |
| polydao (Jev) | 24.0 s, 16:9 | 0 | one shot | 3% | Magenta halftone neo-brutalism with a chapter counter. Scenes change through band wipes that take about 0.2 s. |
| jake11moran (NotchBrowser) | 27.1 s, 16:9 | 0 edits (6 UI events) | continuous | 13% | One slow camera over a Mac desktop. The notch grows into a pill and then opens into a browser. No audio. |
| demonugc (UI morph loop) | 14.0 s, square | 0 | one shot | 48% | Good morph chain with springs, but the parts are tiny in the frame. The camera never zooms in, and one stretch is nearly empty. |
| jesscaroline7 (Onde Fica) | 59.6 s, 9:16 | 6 | 8.5 s | 8% | Particle dots carry the data from grid to map to number to donut, with 39 s uncut. The palette is black, cream and orange. |

## What separates strong from weak

- **One look, kept the whole way.** The strong films use one material and one set of motion rules from start to finish: frosted glass, liquid glass, halftone neo-brutalism, or crop marks with italic serif.
- **A full, moving frame.** The strong films are moving 80 to 97% of the time. The weakest film watched is still 48% of the time and fills about a tenth of the frame.
- **One hero gesture taken from the product.** Examples: the notch opening, the menu-bar prompt springing out, dots that are the data, and the cost cascade.
- **Real content.** Real photos, real copy and real numbers.
- **Unguided one-line prompts look alike.** Judging from posters only, they drift towards a dark field with a glow or rings, and HUD corner labels with a timecode.

## Prompt moves worth reusing (described in my own words)

- Use sections: inputs with defaults, direction, structure, build, gotchas and start. The start section asks for the inputs, then shows a few stills before the full render.
- Write a banned list that names specific cheap looks. Examples: crossfades, frozen frames, glows on interface text, white flashes, highlight boxes that look like a text selection, bouncy easing.
- Give speed rules as numbers. Examples: camera moves of 1.5 to 3 s, half the speed the model would choose by default, every shot entering already moving, a slow camera drift carried across scenes.
- Build deterministically. Every frame is a pure function of time, randomness is seeded, motion blur comes from subframes, and the result is checked with a contact sheet and a frame-difference scan.
- Tie the picture to the sound by measurement. Cuts land just ahead of the beat, the music drop lands on a named script line, and each sound effect sits at its measured peak.
- In short prompts, say where the film will be used and what single action it shows. Examples: the hero video on a README, the hero of a landing page, or "match the design file and add only motion".

## Gaps in engine-moves.tsv

None of the 246 moves covers these:

- A component that morphs through many interface states.
- A frosted or liquid glass material.
- Particle dots that hold the data and reform from one chart into the next. The file has no particle family at all.
- An image cloud that bursts out and then gathers into the logo.
- A vertical whip-tilt.
- A staggered band wipe with soft tails.
- Squares that orbit an icon and lock into a cross.
- A panel that springs out of the menu bar or the notch.
- A rotating list wheel that lands slowly on one item.
- Captions typed to the voiceover's word timings.
- A podium or leaderboard race.
- A checklist whose ticks draw on.
- A chapter counter shown on screen.
- A halftone texture.
- An isometric scene that breaks apart and rebuilds.
- A starfield warp into the end card.

## Rights

The prompts belong to their creators. These notes describe what the prompts do and quote none of them in full. The videos, sheets and posters stay under `.damex/motion-study`, which git ignores.
