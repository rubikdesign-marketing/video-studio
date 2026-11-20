# Engine gaps: the ten moves to build next

This list comes from `engine-map.json`, which maps 71 techniques from the motion study onto the engine's 246 moves. 21 techniques are fully covered, 35 are partly covered and 15 have no move at all. The ten below are the gaps that matter most for making a polished film first time.

## How the list was made, and what was not checked

- Each technique was counted across 291 studied records by matching keywords in the study's own technique and transition notes, one count per record. The repost pm:roundtablespace-d3a1be was left out.
- About half the records were judged from tags, a poster or a short strip, not watched. Their notes are thin, so every count is a floor. A keyword can also match a record where the technique is minor.
- The order is a judgement, not a sum. It weighs three things: how well-liked the films that use the technique are, how often it appears, and whether it fits the house styles in craft file 13. The count alone would put particles and logo end cards first. The single-component morph appears in only 10 records, but it is the most-liked product film by a wide margin.
- Engine coverage was checked against `engine-moves.tsv` and the families in `library/motion/index.json`, with a look at `engine/src/kit/` for helpers to reuse (`MotionBlur`, `springs.settle`, `arc`, `PushThrough`). No code was written or rendered.
- Like counts are missing for many prompt-motion records, and counts from revid and prompt-motion cannot be compared fairly.

## Build order


Build shape morph first. The component morph, the carrier and the flood all reuse it.

### 1. `shape-morph`: one primitive becomes another (high)

- **Seen in:** 20 records, including the most-liked record in the corpus (pm:stephanlivera-df17a2, 17.1k likes), revid:14 and hbcoop-de365c, where a dot becomes a line, then a circle, then a sphere.
- **Why:** craft file 09 already describes it (350 to 500 ms, matched points), but no move exists. Three of the other gaps depend on it.
- **Build:** `<ShapeMorph shapes={[path | 'circle' | 'pill' | 'star']} at each>`.
  - Resample each path to the same number of points by arc length.
  - Align the start point and winding direction, then ease the points with `easing.arrive`.
  - Keep the corner count where possible.
  - Expose the current path so other moves can reuse it.

### 2. `morph-chain`: one UI component through many states (high, new `ui` family)

- **Seen in:** the most-liked product film in the corpus, pm:twoclipping-5cba86 (12.6k likes, about four times the next). One black pill moves through 13 states in 14 s with no cuts. The same idea appears in revid:58, revid:43, demonugc-4c5753 and jazzen-chen-4542ae.
- **Why:** `container-transform` and `shared-element` each handle a single change, not a chain of states.
- **Build:** `<MorphChain states={[{at, w, h, radius, fill, content}]}>`.
  - Size, corner radius and colour follow a closed-form spring for each new target. The springs are summed, so a new target never makes the shape jump.
  - Content swap, as measured: the old content blurs out in about 0.12 s, the box resizes in about 0.15 s, and the new content is sharp by about 0.3 s.
  - `MotionBlur` runs along the direction of the resize.
  - About one state per second at 120 BPM.
  - An optional loop makes the last state match the first.
  - `cursor-lead` causes each change.

### 3. `carrier`: one object carried through every scene (high)

- **Seen in:** 17 records. The study names this the strongest repeated pattern: revid:22, revid:14 (no hard cuts at all), revid:19, hbcoop-de365c and miskinho-443898.
- **Why:** today an element can only travel across a single join, and `join-shared-element` works only for captures.
- **Build:** a film-level layer above the scenes, driven by film time.
  - Keys: `[{at, anchorId | rect, shape, fill}]`.
  - It travels on `arc()` between keys and reshapes through `shape-morph`.
  - Joins take 0.1 to 0.17 s, with holds of about 0.4 s.
  - Scenes expose named anchors, so the carrier can become a tittle, a toggle knob, a chart highlight, and finally the full stop of the wordmark (measured from the end card's text layout).

### 4. `particle-form`: particles that assemble and dissolve (high, new `particle` family)

- **Seen in:** 59 records, the most common uncovered technique. The best use is data: in jesscaroline7-1ff7cb one dot per place re-forms from grid to map to number to donut, running 39 s without a cut. It also appears in robvjourney-ce3e1a, revid:13 and revid:2 (9.9k likes).
- **Why:** the engine has no particle family.
- **Build:** `<ParticleForm from to count seed at length>`.
  - Targets can be text (sampled from a canvas set in the brand voice), an SVG path, a grid, data points or a scatter.
  - Each particle's position is a pure function of time: a seeded start, a delay of 0 to 25% of the length, a slightly curling path, and a landing with no overshoot.
  - A dissolve takes about 0.6 to 0.8 s and a re-form about 0.8 to 1.0 s.
- **Guard:** refuse particles as background decoration, because the particle sphere is part of the cheap kit. Use squares where the style bans dots.

### 5. `toggle-flip`, `slider-drag` and `tab-indicator`: live controls on springs (high, `ui` family)

- **Seen in:** 22 records, including 5cba86, demonugc-4c5753, revid:15 and revid:31.
- **Why:** the capture moves can only replay recordings. Nothing authors these controls.
- **Build:**
  - **Toggle:** the knob travels in about 0.18 s on `springs.settle`. It reports its rect so a flood can start from it.
  - **Slider:** past its maximum the thumb rubber-bands at about 30% of the overshoot, then springs back.
  - **Tab indicator:** the leading edge runs on a stiffer spring than the trailing edge, so the pill stretches and then catches up.

### 6. `flood`: a colour or theme flood from a control (high)

- **Seen in:** 8 records, but it is the one surprise in several of the best product films:
  - revid:15: a toggle flip of 0.18 s, a flood of about 0.2 s, and the next headline 0.15 s later.
  - 221cab and 2ddf1e: the flood then contracts into the next object.
- **Why:** it is also the way craft file 13 allows a film to move once from one design family to another.
- **Build:** `<Flood from page at contractTo? next>`.
  - The circle grows from the control's centre to the farthest corner plus 10%, over 0.3 to 0.35 s, so it never reads as a flash.
  - The next scene starts on the new page 0.15 s after full cover.
  - The reverse contracts the page into a target's rect and radius, carrying the next content inside it.

### 7. `agent-chat`: the choreography of an agent working (medium, `ui` family)

- **Seen in:** 26 records. AI agents are the most common subject in the product groups.
- **Why:** `stream-answer` covers only the answer text.
- **Build:** `<AgentChat turns={[{role, text, at, status?, tools?, approval?}]}>`. Each turn runs in this order:
  - the avatar pops in;
  - typing dots show for 0.5 to 0.8 s;
  - the bubble grows from its corner and the answer streams in;
  - a status chip changes its label through `swap-word`;
  - tool-call rows tick;
  - an approval card's button is clicked by `cursor-lead`, with a push of about 0.5 s and the pressed state about 0.4 s later (revid:57).

### 8. `running-overlay`: devices that persist across cuts (medium, new `overlay` family)

- **Seen in:** 36 records.
- **Why:** the meaningful kind holds a film together. In revid:2 (9.9k likes) a date stamp and a story percentage hold steady through 73 cuts. ror-fly-9950f1 uses a six-step tracker, and brainextends-e19ac3 a player bar that stays put. The decorative kind (corner timecode, BPM, labels naming techniques) is the most-cited AI tell in the study.
- **Build:** a film-level layer.
  - Kinds: clock, meter, steps and chapter bar, all driven by keys `[{at, value}]`.
  - Placed by the caption safe areas.
- **Guard:** a required `means` field says what the overlay measures. The code refuses timecodes, frame counts, BPM readouts and scene labels.

### 9. `word-burst`: one word per beat on a new colour field (medium)

- **Seen in:** 15 records. It lands the climax of the most-liked record (stephanlivera-df17a2: half-beat cards, 0.233 s at 128 BPM), and of revid:21, revid:62, astrodevil-3f2054 and heyiammallik-e72d17.
- **Build:** `<WordBurst words beats unit fields treatments>`.
  - Each word is a hard cut on its beat, taken from `tools/audio/beats.py grid`.
  - Each word gets a 5-frame smear settle and its own treatment (fill, outline, accent or reverse) on the next brand page colour.
  - A helper plans scene lengths in bars, escalating from 2 beats to 1 beat to half a beat, and checks the cuts with `beats.py check`.
- **Guard:** one burst per film, and never even 1.0 s steps, which read as a slideshow.

### 10. `unit-fill` and `count-with-line`: data that can be counted (medium)

- **Seen in:** 11 records each.
- **Why:** the data family has only four moves. The best data reels show one true number with one small graphic that draws in step with it.
- **Build:**
  - **`unit-fill`:** a grid of square cells (not dots) fills in reading order, with a number beside it that always equals the filled count. A highlight subset fills in a second colour afterwards. Seen in fionntobin-97b7af, palashbagchi11-0a4b6b and revid:6.
  - **`count-with-line`:** one progress value drives both `number-roll` and `line-draw`, so they cannot drift apart. Options cover ghosted leading zeros and a single ring when the final value lands. A milestone count runs 2.5 to 3.5 s (viktoroddy-98c1d8).
- **Rule:** a count always lands on a true figure.

## Next in line

These gaps are in `engine-map.json` but not in the top ten:

- recap wall of the film's own scenes
- cards absorbed into an icon
- collapse to a point and flare into the logo
- squash-and-stretch physics
- words that act out their meaning
- editorial reading subtitles
- stamp
- map route with pins
- authored loops and bookends
- vertical whip and staircase wipes

One gap is in the render pipeline, not the moves. Every top product prompt asks for subframe motion blur. The engine has a directional `MotionBlur` helper, but nobody checked whether renders can blend subframes.

## Kept out on purpose

The corpus also leans on generative pattern fields (Truchet tiles, halftone, voxel waves, op-art), chrome objects and metaballs, and glitch with RGB split. These are mostly the convergent showreel kit that the study calls cheap. Craft file 13 also keeps dots, mesh blobs and glitch out of every design family. They stay off this list unless a scoped look is approved at a moodboard first.
