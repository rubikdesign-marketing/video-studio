# Motion graphics: what the best Claude-made films do

Read at the idea, storyboard and animation stages, and by the checker. This guide adds to `02-motion.md` (timing and easing tokens), `03-transitions.md` (the transition catalogue and its bans) and `14-motion-systems.md` (shot sizes, choreography, restraint, rhythm). Where those already say something, this file points to them and only adds what the study measured.

## Where the numbers come from

- A study of 292 motion-graphics records made with Opus 5.5, from three public galleries. 207 videos were measured with `tools/study/profile.py` (cuts, shot lengths, still time, movement per 0.25 s). About 60 were studied on 2 fps contact sheets, and about 30 transitions were read frame by frame.
- Records are cited by source and the end of their id, so no creator is named: `pm-5cba86` is the prompt-gallery record whose id ends in 5cba86; `revid:16` is record 16 of the ranked gallery. Every cited film is listed with its title and a link under `sources` in `library/recipes/index.json`. The raw study notes stay in the studio's private copy.
- Not checked: nobody listened to the sound (loudness only); stacks are mostly guessed from the picture; 114 of the 207 measured films have no like count, which means missing, not zero. Likes also reward reach, early posting and teaching (a screen-recorded tutorial, revid:202, has 715), so craft was judged by eye as well.
- Prompts and videos belong to their makers. Nothing here copies a prompt; the patterns are described in our own words.

## 1. What people rate highly

The most-liked films: a 15 s reel that teaches easing and ends on a joke (pm-df17a2, 17.1k likes); one black pill that a cursor morphs through 13 interface states in 14 s with no cut (pm-5cba86, 12.6k, about four times the next prompt record); a 142 s illustrated music video that tells AI history through a character (revid:2, 9.9k); a launch film built on one word-play with a number in every chapter (revid:6, 3.2k); a one-take launch where each scene is built from the last object (pm-221cab, 2.1k).

What they share, and what the weak films lack:

- **One idea carries the whole film.** A thesis (easing, timing, "waiting is waste"), one object (a dot, a pill, a post, a blob), one metaphor (a closed lid, a helix, a boomerang throw per model version) or one sum (a price that falls from $196 to $15, pm-10f264). Same-prompt reels without a thesis got single-digit likes. A list of techniques gets ticked off scene by scene and reads as a checklist.
- **Real material.** Every film over 100 likes in the second product batch shows the real product or its real output for most of its length. Real prices, photos, numbers and session history beat invented dashboards. Seven films dropped in a made-up "+%" chart; in a client film that is a false claim.
- **Each claim proved on screen within about a second:** the headline, then the interface doing it (revid:16); a word tile that does its own verb (revid:28).
- **Discipline of look.** Three to five flat colours plus one accent, one type pairing, one material, held for the whole film. The weaker reels change palette every scene.
- **Visible craft.** Squash and stretch with ghost trails in the first second (revid:22), springs that settle without bounce (pm-5cba86), counters that land on true figures (pm-bf062e).
- **Short.** The 30 measured films with 500 or more likes: median 23.1 s (16.6 s if the four over 150 s are left out), median still share 5.8%. The 4 to 5 minute shorts move little; one is still 46% of the time.
- **Same words, different film.** Two records with identical prompts got 640 and 148 likes (pm-c52e09, pm-3ad902): the plain three-step walkthrough beat the one with 3D strips, particles, heavy blur and an 848x480 render. More effects lowered clarity.

## 2. Smoothness

`02-motion.md` sets the tokens. The study adds these measured numbers.

- **Frame rate.** 18 of the 30 measured films with 500 or more likes are 60 fps (59.94 counted as 60), against 19 of 42 in the 100 to 499 band. Two prompts asked for 60 fps and the file came back at 30 (pm-2ddf1e, pm-e19ac3): check the delivered file, not the brief.
- **Entrances start fast and settle long,** covering most of the distance in the first few frames. One creator wrote a per-frame target into their prompt; we did not measure it. A curve that matches is cubic-bezier(0.16, 1, 0.3, 1), close to the `arrive` token.
- **Overshoot.** Liked product films keep it under 2% and show at most one soft settle; the morph reads as a quick ease-out, never a bounce. Bouncy easing is on the banned list of every high-scoring product prompt. Save real bounce for a ball or a character, where squash and stretch prove the craft (about 0.27 s per bounce in revid:22).
- **Settle times.** Smeared type settles in about 5 frames at 60 fps (0.08 s). In a container morph the old content blurs out in about 0.12 s, the container resizes in about 0.15 s and the new content is sharp by about 0.3 s (pm-5cba86); at 30 fps the reshape takes 5 to 6 frames with directional blur and the content sharpens over 3 to 4 more (revid:58).
- **Motion blur.** Every top prompt asks for blur from subframes. Render blur from 8 or more subframes per frame; fewer was not tested here. Blur follows speed and direction: things enter blurred and sharpen as they slow. The render path must offer this (a gap noted in the product study; see `engine_gaps` in the recipes).
- **Never still, except on purpose.** Strong films move 80 to 97% of the time; the weak ones are still 27 to 68%. Two kinds of stillness work: a reading hold of about 0.4 s between quick moves (revid:14), and planned 1 to 3 s holds on large type (revid:6 is still half its length and does not feel dead). Seven separate stills of 0.75 to 1.5 s between beats read as dead time (pm-4c5753, 48% still).
- **Movement level by energy.** In profile units of typical movement: hype reels 4.4 to 6.5, confident launch films 1.2 to 1.7, calm ambient scenes 0.5 to 0.9; illustrated character stories mostly 1.0 to 4.6. Peaks above about 100 come from strobing tunnels and spirals and read as a screensaver, not craft (111 to 168 in pm-86be44 and pm-ff9ab9). The calmest liked reel peaks at 6.2 (revid:14, 932 likes).

## 3. Choreography and continuity

`14-motion-systems.md` names the patterns (cascade, call and response and so on). The study shows which ones the best films lean on.

- **One camera is common, and rated.** 57 of the 207 measured films have no hard cut; so do 9 of the 30 with 500 or more likes. Energy comes from movement inside the shot, not from editing: the film with the most movement among the six best illustrated pieces has no cut (revid:28).
- **A carried object.** One accent shape passes through every scene and becomes the next element: keyframe, then the dot on an i, then a toggle, a chart highlight and finally the full stop of the wordmark (revid:14, revid:22, revid:19). The joins are morphs of 0.1 to 0.17 s with 0.4 s reading holds between them. The engine has no move for this yet.
- **Content is the transition.** A tile becomes the next page (pm-10f264), messages are pulled into the app icon (pm-242285), a chart collapses into light that becomes the logo (pm-6071d5), data marks re-form from grid to map to number to donut for 39 s without a cut (pm-1ff7cb draws them as dots; use squares or bars).
- **Running devices across cuts.** A date stamp, a climbing story percentage and a lyric card survive all 73 cuts of revid:2; a tray of collected photos (revid:55), a step tracker (pm-9950f1), a persistent player bar (pm-e19ac3) or a version badge (pm-891c09) do the same job.
- **Match cuts on shape.** A word's full stop whips aside and grows into the next colour field in about 0.1 s (pm-df17a2). A shape morphs to a square in 0.25 s, scales past the frame in 0.15 s and pulls back to a tile grid by 0.65 s (pm-0f6911). A white beam becomes rainbow bands, which become film strips (pm-ea7f2d).
- **Focus.** The camera pushes so each state fills the frame. The same good morph chain fails when the components sit at a tenth of the frame width and the camera never zooms (pm-4c5753). Long feature tours that repeat one layout (caption left, window right) for 30 to 76 s are the weakest product films.
- **Stagger numbers seen:** letters about 2 frames apart (revid:22); headline lines fading up over about 0.3 s, the second line 0.1 s behind (revid:55); cards landing one at a time while a total counts (pm-10f264). These sit inside the presets in `02-motion.md`.
- **Structure accelerates, then lands.** The top reel runs a 5.6 s continuous first act, middle acts of 1.9 to 3.75 s, a 1.4 s burst of word cards, then a 2.4 s lockup. Escalation by cut rate also works: one locked 12 s shot, then 7 cuts in 10 s (pm-3d4006).

## 4. Transitions

`03-transitions.md` holds the catalogue and the bans. These were measured frame by frame in liked films.

| Transition | Measured | Seen in |
|---|---|---|
| Push into a small element until its colour fills the frame | 0.25 to 0.45 s; revid:16 is 15 frames at 60 fps, then about 0.3 s of plain colour before the next scene | revid:16, revid:28, pm-10f264 |
| Flood from a control (a toggle knob covers the frame) | flip 0.18 s, flood about 0.2 s, next headline 0.15 s later (revid:15); about 0.3 s and overscaled past the corner in pm-221cab | revid:15, pm-221cab |
| Container morph through states | see section 2; about one state per 1.05 s at 120 BPM | pm-5cba86, revid:58 |
| Iris from the carried dot | mark collapses 0.30 s, 3-frame hold, iris 0.15 s; or 4 frames at 60 fps | pm-df17a2, revid:22 |
| Absorb into the icon, icon becomes the window | 0.15 s, then 0.15 s | pm-242285 |
| Pull back to a wall of every earlier scene | 0.35 s; a live recap grid builds 2-up, 4-up, 6-up in about 0.5 s | pm-64c45a, pm-2abdfa |
| Whip-tilt | blur builds over 6 frames, cut at peak blur, new page resolves over 12 frames | pm-7de38a |
| Snap cut into depth | 2 frames of radial blur, settled within 8 frames at 60 fps | revid:64 |
| Zoom through a detail into a new world | 0.45 s accelerating push, 2-frame white flash, 0.15 s radial-blur settle | pm-ade5b6 |
| Light collapse and flare to the logo | about 0.75 s in all | pm-6071d5 |
| Staggered band wipe; stepped staircase wipe | six bands cover in 12 frames (0.2 s); about eight steps in 0.45 s | pm-7a572b, pm-e72d17 |
| A thing in the world wipes the frame (passing train, tunnel, curtains) | used instead of cuts in calm illustrated films | pm-e47532, pm-9cc84f |

What reads as cheap:

- Fading or blurring through black between sections. It leaves empty frames: four in one film (pm-98c1d8), about 2 s of dark in another (pm-2ae354). A blurred frame held as a transition (pm-cc72cb).
- Text cards on black between product shots, which turns a film into a feature list (revid:64).
- Cuts on an even grid: every 1.0 s (pm-54bdee), 2.0 s (pm-4b137e), 3.3 s for 69 s (pm-474bcf), 4.5 s (revid:40). An even rhythm reads as a slideshow.
- Star wipes, word art and clashing gradients (a deliberate parody of bad work, pm-3d3407, lists them); glitch and RGB split as a default; grey flash frames between acts.
- Some liked films use a 1 or 2-frame flash to hide a join. The flash check in `08-directors-checks.md` and the ban in `03-transitions.md` still apply.

## 5. Pace by kind of film

Medians over the measured films, grouped by the study's categories (screen recordings and one duplicate left out). The table was built when 204 profiles existed; 207 exist now and it was not recomputed. "Moving" scene changes inside a shot do not count as cuts, so the last column comes from the studies' frame-by-frame notes.

| Kind | Films | Length | Hard cuts per 15 s | No cut at all | Still share | Scene length seen in good examples |
|---|---|---|---|---|---|---|
| Showreel or capability reel | 48 | 15.1 s | 3.0 | 5 of 48 | 0% | acts 1.9 to 3.75 s; word bursts 0.233 s |
| Product launch film | 39 | 22.1 s | 1.1 | 12 of 39 | 10% | about 1.5 s per scene in 15 to 18 s; 3.3 s in a 40 s tour |
| Ad or social cut | 17 | 15.1 s | 3.0 | 4 of 17 | 6% | vertical ad median shot 0.30 s |
| Feature demo (walkthrough) | 14 | 30.1 s | 0.4 | 6 of 14 | 26% | chapters of 2 to 2.5 s work; 4.5 s per feature reads as a template |
| Mobile app promo | 11 | 25.1 s | 0.9 | 5 of 11 | 7% | 2 to 2.5 s per chapter (revid:15) |
| Kinetic type reel | 8 | 17.5 s | 1.8 | 3 of 8 | 2% | 0.47 s beats at 128 BPM, 0.233 s bursts |
| Illustrated or character story | 13 | 45.6 s | 0.3 | 5 of 13 | 1% | a fixed frame with the world changing inside it |
| Lyric or music video | 6 | 60.8 s | 2.3 | 1 of 6 | 0% | one composition per sung line; 1.7 to 2.4 s median |
| UI morph (one element) | 5 | 14.1 s | 0 | 4 of 5 | 17% | 1 to 1.5 s per state |
| Data story and diagram explainers | 13 | 29 to 54 s | 0.5 to 2.2 | 3 of 13 | 6 to 26% | 5 to 6 s per counter chapter; 3 to 5.5 s per recipe step |

- The data and explainer films stop too much: 27% and 46% still in two of them (pm-0a4b6b, pm-1a54fe). Give every hold a moving background or cut it.
- Without a length in the prompt, films ran 23 to 76 s (median 33.5 s) and were the slowest; with one, they hit it within 0.1 s. Two template films overran 15 s by 11 and 30 s. The engine sets and enforces the length itself.
- `16-structure-and-retention.md` section 4 gives starting shot lengths by kind of shot; the table above is what these films measured.

## 6. Type in motion

Sizes, the text budget and the move library are in `04-type-and-captions.md`. The study adds:

- **Big.** Headlines about 6% of frame height or larger (revid:16 measured about 6%); text size was measured in only three films, so treat this as a floor, not a range. Lines near 2% inside an inset stage read as timid on a phone (pm-e19ac3).
- **The word does what it says.** SQUASH is squashed, STRETCH is tall (pm-38deff); scattered letters snap onto one line for "straight" (pm-61f424); a tile labelled SPIN spins (revid:28). This is the strongest type idea in the study and has no engine move yet.
- **A fixed stem with a changing payload.** "I can" holds while the verb, its treatment and the full-frame colour change on every beat (pm-38deff).
- **One pairing.** A heavy grotesque with one italic serif accent word, or one serif family with an italic accent and a drawn highlighter (pm-d2dfd2). Changing face inside a sentence works only when the change carries the meaning.
- **Speeds measured:** a five-letter word rises from its mask in about 0.12 s; a line builds at about one word per 0.5 s; blur-in to sharp about 0.5 s; a wordmark types at about 8 characters a second; a caption deletes at about 60 and retypes at about 15 characters a second (pm-de365c).
- **A slogan split across the film.** The first half opens, the second half closes on the logo (revid:21); the end feels like a completion.
- **Numbers.** A count lands on a true figure and stays there. A count caught mid-way (0.0%, 0+) looks broken when paused or used as a thumbnail (pm-0c85c2). Ghosted leading zeros and a line drawn in step make a count the climax (pm-98c1d8).
- **Faults seen:** headlines cut off by the top edge (three films); corner labels, body copy and contact pills too small to read; the same typed-headline beat used five times (pm-d2dfd2).

## 7. The opening 2 seconds and the ending

`15-hooks.md` sets the rules for the first frame. Measured in the study:

- **Timing of the best hooks.** Something moves by 0.5 s, the mark resolves by 1.0 s, the full-frame wordmark lands at 2.0 s (pm-df17a2). The best product films show a readable line by 0.5 to 1.0 s and the problem by 2.5 s. Every 15 s reel in the data batch landed its hook by 2.0 s.
- **Frame 0 is already the film:** a finished button with the cursor on it, clicked within 0.5 s (pm-5cba86); a full-bleed word in frame 1 (pm-38deff); a ball already in flight with its ghost trail and a note naming the principle (pm-5f4b43).
- **Openings that lost the viewer:** 3 s of near-black (pm-bf062e); 4.5 s of terminal typing on black (revid:62); a 1.5 s logo spinner (revid:50); an empty colour field with only corner labels.
- **The ending closes the idea.** The carried dot becomes the full stop of the last line (pm-de365c, revid:22); the opening scene returns with the result (pm-ea7f2d, revid:2); a receipt shows the answer arrived before the logo (revid:6); the last frame equals the first, so it loops (pm-5cba86).
- **End hold:** 1.0 to 1.75 s of true stillness after the logo settles, or a longer hold that keeps moving (the top reel holds its lockup with only sparks moving). Static end cards of 2 to 3.5 s are where attention drops.
- **Endings that fail:** the logo shown mid-film and again at the end (pm-6071d5); a sudden change of world for the end card (revid:21 cuts to white); 11 s of black padding (pm-54b2ac); a small, dim wordmark; a line saying the film was made in code or by a model. The engine never adds that line to a client film.

## 8. Sound and beat sync

Sound was not listened to; these come from cut positions, on-screen tempo readouts and loudness curves. `07-sound.md` and `14-motion-systems.md` section 4 hold the rules.

- **Cut on bars, burst on half beats.** The best reels cut at 5.633, 7.5, 9.383 and 11.25 s: 3, 4, 5 and 6 bars at 128 BPM (1.875 s a bar). They finish with word cards every 0.233 s (half a beat, 14 frames at 60 fps), then hold. One kinetic reel runs two-beat shots (0.93 s), then one-beat (0.47 s), then a 0.6 s recap at 3 to 7 frames per word (pm-38deff).
- **Other grids seen:** 120 BPM with one interface state per beat pair (pm-5cba86); 12 cards at exactly 0.333 s (10 frames at 30 fps, revid:62); cuts placed 2 frames before the beat, which landed within one frame of the plan (pm-7de38a).
- **Sync lives in events, not in general motion.** Movement follows loudness weakly in almost every film (0.1 to 0.3), even the beat-cut ones. The highest figures (0.52 and 0.61) come from films where each on-screen hit makes the note (pm-447565, pm-5f8bb0). A visible rule ("every note is a collision") is honest sync.
- **A cut grid that ignores the music** reads mechanical: hard cuts at exactly 4, 6, 8, 12 and 14 s with 0.08 correlation (pm-4b137e).
- **Silence.** At least 16 studied files have no audio track. Unless the brief asks for silence, treat a missing track as a failed export. Loudness target as in `07-sound.md`.

## 9. The generic AI-made look, and how to avoid it

The one-line showreel brief (a length, "show what a great motion designer you are", "go all out") appears in about 80 to 90 records. It returns the same film almost every time:

- a dot, line or circle opening on black (11 of 16 in one batch); a big MOTION word on orange; Bauhaus or Truchet tiles; a particle sphere or galaxy; a voxel field; an op-art spiral; a fake "+%" chart;
- corner labels with timecode, frame rate, BPM and "01/06 KINETIC TYPE": the film labelling its own techniques. One maker banned corner text by name as an AI giveaway, and that film had the cleanest frames in its batch (pm-61f424);
- an ending on the model's name in a heavy sans with a coloured full stop and an italic role line (14 of 16 in one batch);
- in product films: hook, logo, dark dashboard, count-up stats, gradient field, logo wall and stat row. Default looks: pastel glass with gradient text, purple SaaS, navy with cyan glow, black with neon green, lavender glass orbs, glowing node networks for anything to do with AI, confetti on success.

How the good films escaped it, in our own words:

- **Inputs, not adjectives:** the real site, repo, design file, photos or drawings; a reference film with what to take from it; one named metaphor or a genre with a fixed ritual. Quality words ("juicier", "best of the best") change little.
- **A ban list by name.** Films whose prompts banned crossfades, glows on interface text, bouncy easing, particle bursts, shake and template looks show none of them (pm-5cba86, pm-6dd14e).
- **Continuity written as physics:** one take, each scene made from the last object, one camera move per scene that never reverses.
- **A review gate:** a beat map and four named stills before the full render; a contact sheet and a frame-difference scan after.
- **House-rule tension.** `04-type-and-captions.md` bans dot grids, and `13-design-styles.md` bans coding-style type and glitch, yet the most-liked reels lean on them. Keep the bans: those devices are the kit above. A carried accent can be any brand shape (a square, a pill); a full stop at the end of a sentence is punctuation and allowed.

## 10. Checks before showing a cut

Run on the master, with `tools/study/profile.py` and `sheets.mjs`, before the checks in `08-directors-checks.md`.

1. **Length** within 0.1 s of the agreed length. **Frame rate** matches the fps in the approved brief.
2. **Still share** at most 10% (warning) and 16% (fail), excluding holds the shot list names. No unplanned still stretch over 1.0 s.
3. **First 2 s:** frame 0 is not empty or black and something moves by 0.5 s; a readable word or the product is on screen by 1.0 s.
4. **End hold** 1.0 to 1.75 s of stillness, or a longer hold where something still moves. No black padding after the last frame.
5. **Cut rhythm:** every hard cut is in the shot list; when there is music each lands on the beat grid within one frame (or 2 frames before, if planned); no three neighbouring shots of equal length outside a planned burst.
6. **Peak movement** under about 100 in profile units unless the shot list marks a peak; the flash check passes.
7. **Transitions:** open a `window` sheet for each one. No frame in it is near-empty or near-black unless planned; floods grow past the farthest corner and take at least about 0.2 s (revid:15, the fastest that read).
8. **Type:** nothing clipped by a frame edge; sizes pass `text_size.mjs`; every count rests on its final true value for at least 0.5 s.
9. **Words on screen:** no timecode, frame rate, BPM, technique names, "made with" lines or the model's name, unless the brief asks (`onscreen_text.py --never`).
10. **One idea:** name the carried object, thesis or sum in one line; if it cannot be named, the cut goes back to the storyboard.
11. **Audio track present** and at the loudness in `07-sound.md`.
