# Batch illustrative-and-music: what we learned

38 records from the illustrative-and-music group. Full data is in `study/illustrative-and-music.json`.

## What was and was not checked

- I read all 38 records.
- I downloaded all 38 videos and ran `profile.py` on each, so every record has measured length, cuts, still share and motion.
- I studied six in full at 2 fps: revid:9, revid:16, revid:21, revid:22, revid:28 and revid:202. These are the six most-liked, and none has a prompt.
- I looked at four transitions frame by frame: revid:9 from 1.6 to 3.4 s, revid:16 from 18.4 to 19.7 s, revid:22 from 1.2 to 2.3 s and revid:28 from 3.2 to 4.2 s.
- I judged the other 32 from one 24-frame sheet spread across each film, plus the record text. I did not watch them frame by frame.
- Sound was measured for loudness only. I did not listen to it.
- Likes from revid and prompt-motion cannot be compared fairly. Many prompt-motion records have no likes recorded.

## Kinds of film

- 12 illustrated or character stories
- 6 product launch films
- 4 3D or WebGL pieces
- 3 ad or social promo cuts
- 2 each: showreel, concept explainer, music-synced video, experiment, game capture
- 1 each: photo or collage edit, UI morph, product feature demo

I added one category, **game or interactive capture**, for pm:mandelduck-95fd08 and pm:aisongman-71ffac. Both asked for a playable game, so the video is a recording of someone playing. None of the starting categories fits that.

The group name says "illustrative and music", but the most-liked records are mostly launch films and showreels. Only two records are about music.

## What the best-liked films share

- **One thing runs through every scene.**
  - In revid:22 a red dot bounces, becomes the dot on the i, sits at the centre of every chapter and ends as the full stop in the wordmark.
  - In revid:21 the slogan is split in two: the first half opens the film and the second half closes it on the logo.
- **Each claim is shown within about a second.**
  - revid:16 puts a headline alone on the page, then shows the UI doing it.
  - In revid:28 each word tile does what it says: SPIN spins and DROP drops.
- **The energy comes from movement, not cutting.**
  - revid:28 has the most movement of the six I studied and no hard cuts.
  - revid:16 has no cuts in 30 seconds.
  - revid:22's three cuts all sit inside one glitch.
- **The illustrated stories that work keep the frame still and change the world inside it.**
  - pm:itsolelehmann-e47532 is a train window.
  - pm:x4b47x-9cc84f is a shadow theatre.
  - pm:jake11moran-a269c4 is one desk.
  - pm:loicrambo-ad6830 is one heartbeat line.
- **Short.** The best motion pieces run 15 to 30 seconds. The 4 to 5 minute shorts move little; the black hole film is still 46% of the time.

## Prompt moves

These seem to produce good results:

- Name a genre that has a fixed ritual. For example, the robot-combining sequence: introduce each machine, transform, lock together, pose, title.
- Give a fixed frame and a change over time, such as seasons passing a train window.
- Add a constraint that forces visual storytelling: no dialogue, and sound tells half the story.
- Give real inputs: the user's own drawings, real session history, a raw clip or a website.
- Ask for a story that loops back to its start.
- Use the showreel brief: "show what an incredible motion designer you are, like a résumé showreel".

These produce weak results:

- A length plus a superlative and nothing else ("a 4-minute short that blows my mind").
- A famous reference and nothing else. The film copies the look but not the movement.
- Production instructions with no creative direction.
- Asking for a game when you want a film.

## Measured transitions

- **Push into a small element until its colour fills the frame.**
  - revid:16 goes into a green check badge in about 0.25 s. It holds the plain green for about 0.3 s, then the next scene starts on it.
  - revid:28 goes into the flame icon's yellow core, then a circle opens on the next scene. The whole move takes about 0.45 s.
- **Iris opening from the carried dot.** In revid:22 it takes 4 frames at 60 fps, with a one-frame colour-split flash.
- **Word barrage.** revid:21 makes a hard cut every 0.30 s for six platform names.
- **Wipes from things inside the scene.** A passing train covers the window, a tunnel blacks it out, and stage curtains open and close.
- **Ball bounce.** In revid:22 each bounce takes about 0.27 s, close to half a beat at the 120 BPM shown on screen.
- **End cards** hold for 1.25 to 2 seconds.

## What looks cheap

- Shot notes with garbled letters burnt into the picture (revid:54).
- Slow zooms on still images passed off as stop-motion (pm:davidshulmanfl-371638).
- Long shots with stiff characters in long films (pm:ryzoft-4f85bd, pm:faroukzy-9ff23e).
- Labels and dashboards too small to read in a feed.
- A camera too far away to follow the subject (pm:gorden-sun-041f56).
- Five exports with no sound at all.
- pm:henkpoley-3d3407 makes a bad showreel on purpose. It is a useful checklist of what to avoid: star wipes, word art, clashing gradients and sound cues that do not match the picture.

## Gaps in the engine

No move in `engine-moves.tsv` covers these. The JSON lists 17 gaps; the main ones are:

- **Character moves:**
  - a bounce with squash and stretch and ghost trails
  - blink, breathing and expression swaps for mascots
  - a mascot changing from one shape into another
- **One object carried through every scene** that ends as part of the final type.
- **Scene and atmosphere:**
  - curtain wipes, and wipes made by something passing or a tunnel
  - day-to-night and season colour ramps on a still scene
  - weather and particle layers (snow, rain, leaves, steam)
  - an endless layered scroll seen through a still frame
- **Frame furniture:** corner labels for chapter, BPM, frame rate and timecode, and a colour-split flash on impact.
- **Looks and type:**
  - pixel-art style
  - hand-drawn treatment (sticker outline, wobbly lines, paper grain)
  - vertical Chinese or Japanese text revealed one character at a time
  - sound words and game-style damage numbers
  - word tiles that each do what they say
