# Batch product-ui-2: what we learned

34 records from the product-ui group. Full data is in `study/product-ui-2.json`.

## What was and was not checked

- I read all 34 records.
- I downloaded six videos, ran `profile.py` on each and looked at their 2 fps contact sheets: revid:57, revid:58, pm:viktoroddy-98c1d8, revid:62, revid:64 and pm:brainextends-e19ac3. These were the six most-liked, and four of them have no prompt.
- I looked at three transitions frame by frame: revid:58 from 3.7 to 4.7 s, revid:64 from 15.0 to 16.2 s and revid:57 from 44.8 to 46.0 s.
- I judged the other 28 records from their prompt or skill text, title and tags only. I did not watch them.
- Sound was measured for loudness only. I did not listen to it.
- Like counts from revid and prompt-motion cannot be compared fairly, and ten records from October have no likes recorded yet.

## Kinds of film

- 16 product launch films
- 4 product feature demos
- 4 ad or social promo cuts
- 3 mobile app promos
- 2 UI morphs
- 2 WebGL pieces
- 1 showreel, 1 portfolio reel and 1 experiment

No new category was needed. Three records have the placeholder `$2c` where the prompt should be. This is a scraping fault, so I treated them as having no prompt.

## What the best-liked films share

- **Real product on screen.** Every film with more than 100 likes shows the real UI or the product's real output for most of its length.
- **One idea carries the film.** Each has a single carrying device:
  - an assistant doing tasks in chat (revid:57)
  - one dark container that keeps changing shape (revid:58)
  - one number counting up to a milestone (viktoroddy)
  - a character roster flashed on the beat (revid:62)
  - a tool showing its own renders (revid:64)
- **Few cuts.** The camera moves instead. revid:57 has 2 hard cuts in 83 s, viktoroddy has 1 in 54 s and revid:58 has 1 in 11 s. revid:62 saves its cuts for one burst of 12 cuts, each 0.333 s apart.
- **Large type.** Headlines in the best-liked films are 7 to 15% of the frame height. In the Spotify film (41 likes) most lines are near 2% because they sit inside an inset stage, so they read as timid.
- **A long prompt is not enough.** The longest brief (Taxtello, about 15,000 characters) got 10 likes. A 106-character prompt about real material got 105.

## Prompt moves worth reusing (in our own words)

- Name the one fact or user flow the film proves.
- Point the model at real material: the repo, a URL, the real components or captured pages.
- Describe a camera journey with a start state and an end state, for example a dot on black, then the full UI, then a zoom out to a point, then a dive into the phone.
- Give a timestamped beat list. Name an element that stays on screen across shots. Make the outgoing title leave before the incoming one takes its place.
- Plan four beats: why it matters, the pain today, the fix and what you get. Use 4 to 5 scenes, each with one short title, and hold each scene long enough to read.
- Show the first product moment by 2 s. Aim for about four visual ideas, with overshoot under 2%.
- Run a self-check: render set timestamps and look for overlap, clipping and rushed scenes.

Prompts that produced weak work:

- The shared "showreel for a résumé, go all out" prompt with no subject. None of its five uses has more than 18 likes.
- Prompts that give only a tone word.
- Prompts that only describe the rendering setup.
- Prompts that ask the model to pull a famous brand's assets. The engine must never do this.

## Transitions and timing, measured

- **Container morph** (revid:58). The shape changes in 5 to 6 frames at 30 fps, with blur along the direction of movement. The new content sharpens over 3 to 4 frames, and the element settles in about 0.3 s. Each state holds for 1 to 1.5 s.
- **Camera push to a button** (revid:57). The push takes about 0.5 s with an ease-out, and the button shows its pressed state about 0.4 s later.
- **Snap cut into a curved 3D wall** (revid:64). About 2 frames of radial zoom blur, settled within about 8 frames at 60 fps.
- **Count-up** (viktoroddy). The count runs from 0 to 1,000,000 in about 3.5 s. Leading zeros are ghosted, a line chart draws in step with the number, and a ring bursts when it lands.
- **Still share** across the six films: 0%, 9%, 10%, 12.5%, 16% and 25%. The 11-second UI morph has no still time at all.
- **End holds** run from 1 to 3 s.

## Things that look cheap or "AI-made"

- Running long on one idea: 83 s, with the same sentence frame six or more times.
- Fading through black between sections, which leaves empty frames.
- A slow opener: 4.5 s of terminal typing before anything visual happens.
- Text cards on black between product shots, which turns the film into a feature list.
- A small, dim end wordmark.
- Confetti on success, which appears in two of the six films.
- Even, uniform motion with no standout moment.
- Overlays nobody asked for, such as tickers and watermarks.

## Gaps in engine-moves.tsv

1. **Container morph through UI states.** Not covered by `container-transform` or `shared-element`.
2. **Inline icon slot inside a kinetic sentence**, where an icon sits between words and swaps with them.
3. **Agent chat choreography**: typing dots, a status chip whose label changes, and an approval card. `stream-answer` covers the answer text only.
4. **Milestone counter** with ghosted leading zeros, a line chart drawn in step and a burst on landing.
5. **Powers-of-ten scale journey** from a desktop to a point in space to a phone.
6. **Persistent anchor element** that stays still while the shots change around it.
7. **Cards converging into the logo.**
8. **Beat flash-card roster**: a new flat colour every 10 frames.
9. **Curved 3D wall of screens** entered with a radial-blur snap cut.
10. **3D object field opener.**
11. **Terminal boot opener** with a progress bar and a character pop.
12. **Brand-colour flood inside an inset stage.**
