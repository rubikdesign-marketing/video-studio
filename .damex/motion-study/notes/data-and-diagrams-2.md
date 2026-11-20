# Data and diagrams, batch 2

Fourteen records from prompt-motion.com, all made with Opus 5.5. Full detail is in `study/data-and-diagrams-2.json`.

## What was checked

- All 14 records read. All 14 videos downloaded and measured with `profile.py`. Contact sheets read for all 14, and frame-by-frame window sheets for three transitions.
- Likes and views were empty in every record, so the six films studied closely were chosen on craft and variety, not popularity: astrodevil-3f2054, 3xtihor-0f6911, robvjourney-ce3e1a, pluginplay-3d4006, parkerrex-1a54fe and blueoctopusai-dd17bd.
- Sound was measured for level only. Nobody listened to the music.

## What kinds of film these are

| Kind | Records |
|---|---|
| Showreel or capability reel | astrodevil-3f2054, 3xtihor-0f6911, teslachartz-c58b32 |
| Personal intro or résumé reel | madhav-xo-f97f20, blushpetal795-0c85c2 |
| Process or system explainer | parkerrex-1a54fe (token bucket), blueoctopusai-dd17bd (TV yellow line, in 3D) |
| Data story | palashbagchi11-0a4b6b |
| Product launch or ad | robvjourney-ce3e1a, leadnotifi-e83f94 |
| Kinetic typography reel | rneayan-474bcf (risograph), rneayan-ea6129 (oscilloscope): the same script in two looks |
| Timeline or history | pluginplay-3d4006 (pixel art) |
| Music-synced | rames-jusso-589f80 (live-coded track with ASCII visuals) |

## What separates the good from the weak

1. **One object carries the whole film.** The best films have one thing that changes form and also does the transitions: a particle cloud that is also the logo (robvjourney), a shape that becomes a tile and then a dot (3xtihor), a boomerang throw for each model generation (pluginplay), or a signal trace (rneayan oscilloscope).
2. **One true number and one small graphic per shot.** astrodevil and palashbagchi11 repeat the same layout in every shot: a large figure counting up, with a sparkline, heatmap or dot grid drawing beside it at the same time.
3. **Simulate, don't decorate.** parkerrex drives every panel from one clock, so every number on screen is correct. blueoctopusai builds the real hardware in 3D.
4. **The shared template prompt gives the same film every time.** 3xtihor and teslachartz used the same prompt. They came back with the same palette (red, ultramarine, lime, black), the same 128 BPM readout in the corner and the same name card with a red full stop.

## Numbers worth keeping

- In the 15-second reels, the hook lands by 2.0 s and the end lockup takes the last 1.0 to 1.5 s.
- Hard cuts per 15 s: 13 (astrodevil), 5 (robvjourney), 3 (3xtihor). The best reels have 0 to 10% still time. The data pieces sit still for 27% (palashbagchi11) and 46% (parkerrex) of their running time.
- Word-flash montage: one word every 0.233 s (14 frames at 60 fps), with a different type treatment for each word.
- Staccato lines: 0.5 s each, with the background colour changing on every cut.
- Scale-through into a grid: the shape morphs in 0.25 s, fills the frame in 0.15 s and pulls back to a grid by 0.65 s. This is the biggest motion spike in the batch.
- Rhythm grids seen: 128, 120 and 110 BPM. rneayan-474bcf cuts every 3.3 s for 69 s, and that fixed rhythm makes it feel like a slideshow.

## What looks cheap

- Headlines cut off by the top edge of the frame (blueoctopusai, rneayan-474bcf, leadnotifi).
- Corner labels, body copy and contact pills too small to read.
- Glowing node networks used for anything to do with AI.
- Dead holds at the end with nothing moving.
- Counters caught part-way through their count (0.0%, 0+).
- Films that run past the length they were asked for: 26 s against 15 s, and 45 s against 15 s.

## Prompt lessons for the engine

- A named metaphor or style, plus a real source of facts (a case study or a website), works better than intensity words.
- A technical rule such as "every frame is a pure function of time" should be the engine's default.
- The engine should enforce length itself, because stated lengths were ignored.
- Expect a second turn that asks for music and a second aspect ratio.

## Gaps in the engine's moves

The data family has only four moves: count-with-bar, bar-grow, line-draw and ring-sweep. No current move covers:

- particle assembly into a logo or numeral
- the scale-through-to-grid transition
- morphing one basic shape into another
- unit (waffle) charts and isotype grids
- a count-up with a sparkline beside it
- heatmap fill
- live simulation panels (counter, event log and step chart on one clock)
- node graphs with travelling pulses
- bracket trees
- Venn diagrams
- liquid-fill gauges
- metaball (blob) systems
- dot-matrix and ASCII type
- a code editor with tokens lit in time to the audio
- a rotating cylinder of type
- a 3D staged explainer camera
- pixel-art characters

Two looks are also missing from the six styles: risograph print and CRT oscilloscope.
